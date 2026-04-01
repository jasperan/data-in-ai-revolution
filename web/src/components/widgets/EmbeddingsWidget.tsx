"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";

/* ------------------------------------------------------------------ */
/*  Seeded random (deterministic, Math.sin-based)                     */
/* ------------------------------------------------------------------ */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return parseFloat((x - Math.floor(x)).toFixed(3));
}

/* ------------------------------------------------------------------ */
/*  Static word data with semantic grouping & pre-computed 2D coords  */
/* ------------------------------------------------------------------ */
interface WordEntry {
  word: string;
  group: "animals" | "colors" | "actions" | "tech";
  x: number;
  y: number;
}

const GROUP_COLORS: Record<string, string> = {
  animals: "#4ade80",
  colors: "#f472b6",
  actions: "#fbbf24",
  tech: "#22d3ee",
};

const GROUP_LABELS: Record<string, string> = {
  animals: "Animals",
  colors: "Colors",
  actions: "Actions",
  tech: "Tech",
};

// Cluster centres (in a normalised 0-1 space)
const CLUSTER_CENTRES: Record<string, { cx: number; cy: number }> = {
  animals: { cx: 0.25, cy: 0.25 },
  colors: { cx: 0.75, cy: 0.25 },
  actions: { cx: 0.25, cy: 0.75 },
  tech: { cx: 0.75, cy: 0.75 },
};

function buildWordBank(): WordEntry[] {
  const words: { word: string; group: WordEntry["group"] }[] = [
    { word: "dog", group: "animals" },
    { word: "cat", group: "animals" },
    { word: "fish", group: "animals" },
    { word: "bird", group: "animals" },
    { word: "red", group: "colors" },
    { word: "blue", group: "colors" },
    { word: "green", group: "colors" },
    { word: "yellow", group: "colors" },
    { word: "run", group: "actions" },
    { word: "walk", group: "actions" },
    { word: "jump", group: "actions" },
    { word: "swim", group: "actions" },
    { word: "computer", group: "tech" },
    { word: "algorithm", group: "tech" },
    { word: "neural", group: "tech" },
    { word: "data", group: "tech" },
  ];

  return words.map((w, i) => {
    const centre = CLUSTER_CENTRES[w.group];
    const offsetX = (seededRandom(i * 2 + 1) - 0.5) * 0.18;
    const offsetY = (seededRandom(i * 2 + 2) - 0.5) * 0.18;
    return {
      word: w.word,
      group: w.group,
      x: parseFloat((centre.cx + offsetX).toFixed(3)),
      y: parseFloat((centre.cy + offsetY).toFixed(3)),
    };
  });
}

const ALL_WORDS = buildWordBank();

/* ------------------------------------------------------------------ */
/*  Cosine similarity from 2D positions                               */
/* ------------------------------------------------------------------ */
function cosineSimilarity(a: WordEntry, b: WordEntry): number {
  const dot = a.x * b.x + a.y * b.y;
  const magA = Math.sqrt(a.x * a.x + a.y * a.y);
  const magB = Math.sqrt(b.x * b.x + b.y * b.y);
  if (magA === 0 || magB === 0) return 0;
  return parseFloat((dot / (magA * magB)).toFixed(3));
}

/* ------------------------------------------------------------------ */
/*  K-nearest neighbours                                              */
/* ------------------------------------------------------------------ */
function kNearest(target: WordEntry, pool: WordEntry[], k: number): WordEntry[] {
  return pool
    .filter((w) => w.word !== target.word)
    .map((w) => ({
      entry: w,
      dist: Math.sqrt((w.x - target.x) ** 2 + (w.y - target.y) ** 2),
    }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, k)
    .map((d) => d.entry);
}

/* ------------------------------------------------------------------ */
/*  Scatter Plot (Canvas)                                             */
/* ------------------------------------------------------------------ */
interface ScatterProps {
  words: WordEntry[];
  hoveredWord: string | null;
  onHover: (word: string | null) => void;
}

function ScatterPlot({ words, hoveredWord, onHover }: ScatterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const [canvasSize, setCanvasSize] = useState({ w: 600, h: 400 });

  // Responsive sizing
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.floor(entry.contentRect.width);
        const h = 400;
        setCanvasSize({ w, h });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Map normalised coords to canvas px
  const toCanvas = useCallback(
    (nx: number, ny: number) => {
      const pad = 60;
      const cw = canvasSize.w - pad * 2;
      const ch = canvasSize.h - pad * 2;
      return {
        cx: pad + nx * cw + offset.x,
        cy: pad + ny * ch + offset.y,
      };
    },
    [canvasSize, offset]
  );

  // Hit test
  const hitTest = useCallback(
    (mx: number, my: number): WordEntry | null => {
      const dpr = window.devicePixelRatio || 1;
      for (const w of words) {
        const { cx, cy } = toCanvas(w.x, w.y);
        const dist = Math.sqrt((mx / dpr - cx) ** 2 + (my / dpr - cy) ** 2);
        if (dist < 14) return w;
      }
      return null;
    },
    [words, toCanvas]
  );

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize.w * dpr;
    canvas.height = canvasSize.h * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = "#111114";
    ctx.fillRect(0, 0, canvasSize.w, canvasSize.h);

    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    const gridStep = 40;
    for (let x = 0; x < canvasSize.w; x += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasSize.h);
      ctx.stroke();
    }
    for (let y = 0; y < canvasSize.h; y += gridStep) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasSize.w, y);
      ctx.stroke();
    }

    // KNN lines for hovered
    const hoveredEntry = hoveredWord ? words.find((w) => w.word === hoveredWord) : null;
    let neighbours: WordEntry[] = [];
    if (hoveredEntry) {
      neighbours = kNearest(hoveredEntry, words, 3);
      const { cx: hx, cy: hy } = toCanvas(hoveredEntry.x, hoveredEntry.y);
      for (const n of neighbours) {
        const { cx: nx, cy: ny } = toCanvas(n.x, n.y);
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(nx, ny);
        ctx.strokeStyle = "rgba(34,211,238,0.35)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Similarity label on line midpoint
        const sim = cosineSimilarity(hoveredEntry, n);
        const midX = (hx + nx) / 2;
        const midY = (hy + ny) / 2;
        ctx.font = "500 10px 'JetBrains Mono', monospace";
        ctx.fillStyle = "rgba(34,211,238,0.7)";
        ctx.textAlign = "center";
        ctx.fillText(sim.toFixed(2), midX, midY - 5);
      }
    }

    // Draw dots & labels
    for (const w of words) {
      const { cx, cy } = toCanvas(w.x, w.y);
      const isHovered = w.word === hoveredWord;
      const isNeighbour = neighbours.some((n) => n.word === w.word);
      const color = GROUP_COLORS[w.group];

      // Glow
      if (isHovered) {
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 24);
        grad.addColorStop(0, color + "60");
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, 24, 0, Math.PI * 2);
        ctx.fill();
      }

      // Dot
      ctx.beginPath();
      ctx.arc(cx, cy, isHovered ? 8 : isNeighbour ? 7 : 5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Border
      if (isHovered || isNeighbour) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Label
      ctx.font = `${isHovered ? "600" : "500"} 11px 'Inter', sans-serif`;
      ctx.fillStyle = isHovered ? "#fff" : "rgba(228,228,231,0.8)";
      ctx.textAlign = "center";
      ctx.fillText(w.word, cx, cy - (isHovered ? 14 : 10));
    }

    // Cluster labels (faint)
    ctx.font = "600 10px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    for (const [group, { cx: gcx, cy: gcy }] of Object.entries(CLUSTER_CENTRES)) {
      const { cx, cy } = toCanvas(gcx, gcy);
      ctx.fillStyle = GROUP_COLORS[group] + "30";
      ctx.fillText(GROUP_LABELS[group].toUpperCase(), cx, cy + 50);
    }
  }, [words, hoveredWord, canvasSize, offset, toCanvas]);

  // Mouse handlers
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const dpr = window.devicePixelRatio || 1;
      const mx = (e.clientX - rect.left) * dpr;
      const my = (e.clientY - rect.top) * dpr;

      if (dragging) {
        setOffset((prev) => ({
          x: prev.x + e.movementX,
          y: prev.y + e.movementY,
        }));
        return;
      }

      const hit = hitTest(mx, my);
      onHover(hit ? hit.word : null);
    },
    [dragging, hitTest, onHover]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const dpr = window.devicePixelRatio || 1;
      const mx = (e.clientX - rect.left) * dpr;
      const my = (e.clientY - rect.top) * dpr;
      const hit = hitTest(mx, my);
      if (!hit) {
        setDragging(true);
        dragStart.current = { x: e.clientX, y: e.clientY };
      }
    },
    [hitTest]
  );

  const handleMouseUp = useCallback(() => setDragging(false), []);
  const handleMouseLeave = useCallback(() => {
    setDragging(false);
    onHover(null);
  }, [onHover]);

  return (
    <div ref={containerRef} style={{ width: "100%", position: "relative" }}>
      <canvas
        ref={canvasRef}
        style={{
          width: canvasSize.w,
          height: canvasSize.h,
          borderRadius: 8,
          cursor: dragging ? "grabbing" : "crosshair",
          display: "block",
        }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Similarity Matrix (heatmap)                                       */
/* ------------------------------------------------------------------ */
interface MatrixProps {
  words: WordEntry[];
}

function SimilarityMatrix({ words }: MatrixProps) {
  const [hoverCell, setHoverCell] = useState<{ r: number; c: number } | null>(null);

  const similarities = useMemo(() => {
    return words.map((a) => words.map((b) => cosineSimilarity(a, b)));
  }, [words]);

  // Colour scale: blue (dissimilar) -> orange (similar)
  function cellColor(value: number): string {
    // value is roughly 0.7..1.0 for same-cluster, 0.5..0.9 cross-cluster
    // Normalise: map [minSim, 1] -> [0, 1]
    const t = Math.max(0, Math.min(1, (value - 0.5) / 0.5));
    const r = Math.round(34 + t * (251 - 34));
    const g = Math.round(100 + t * (146 - 100));
    const b = Math.round(238 + t * (60 - 238));
    return `rgb(${r},${g},${b})`;
  }

  const cellSize = words.length <= 8 ? 38 : words.length <= 12 ? 30 : 24;
  const labelWidth = 70;

  return (
    <div style={{ overflowX: "auto", position: "relative" }}>
      <div
        style={{
          display: "inline-grid",
          gridTemplateColumns: `${labelWidth}px repeat(${words.length}, ${cellSize}px)`,
          gridTemplateRows: `28px repeat(${words.length}, ${cellSize}px)`,
          gap: 1,
          fontFamily: "var(--font-mono)",
          fontSize: "0.65rem",
        }}
      >
        {/* Top-left empty */}
        <div />
        {/* Column headers */}
        {words.map((w) => (
          <div
            key={`col-${w.word}`}
            style={{
              textAlign: "center",
              color: GROUP_COLORS[w.group],
              transform: "rotate(-45deg)",
              transformOrigin: "bottom left",
              whiteSpace: "nowrap",
              height: 28,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              paddingBottom: 2,
              fontSize: "0.6rem",
            }}
          >
            {w.word}
          </div>
        ))}

        {/* Rows */}
        {words.map((rowW, r) => (
          <React.Fragment key={`row-${rowW.word}`}>
            {/* Row label */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                paddingRight: 6,
                color: GROUP_COLORS[rowW.group],
                fontSize: "0.6rem",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {rowW.word}
            </div>
            {/* Cells */}
            {words.map((colW, c) => {
              const sim = similarities[r][c];
              const isHovered = hoverCell?.r === r && hoverCell?.c === c;
              return (
                <div
                  key={`cell-${r}-${c}`}
                  className="matrix-cell"
                  style={{
                    width: cellSize,
                    height: cellSize,
                    background: cellColor(sim),
                    borderRadius: 3,
                    position: "relative",
                    cursor: "default",
                    outline: isHovered ? "2px solid #fff" : "none",
                    outlineOffset: -1,
                  }}
                  onMouseEnter={() => setHoverCell({ r, c })}
                  onMouseLeave={() => setHoverCell(null)}
                >
                  {isHovered && (
                    <div
                      className="heatmap-tooltip"
                      style={{
                        top: -32,
                        left: "50%",
                        transform: "translateX(-50%)",
                      }}
                    >
                      <span style={{ color: GROUP_COLORS[rowW.group] }}>{rowW.word}</span>
                      {" / "}
                      <span style={{ color: GROUP_COLORS[colW.group] }}>{colW.word}</span>
                      {": "}
                      <span style={{ color: "#22d3ee", fontWeight: 600 }}>{sim.toFixed(3)}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      {/* Color scale legend */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 12,
          fontFamily: "var(--font-mono)",
          fontSize: "0.65rem",
          color: "var(--muted-foreground)",
        }}
      >
        <span>Dissimilar</span>
        <div
          style={{
            width: 120,
            height: 8,
            borderRadius: 4,
            background: "linear-gradient(90deg, rgb(34,100,238), rgb(142,123,149), rgb(251,146,60))",
          }}
        />
        <span>Similar</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Widget                                                       */
/* ------------------------------------------------------------------ */
export function EmbeddingsWidget() {
  const [mounted, setMounted] = useState(false);
  const [activeWords, setActiveWords] = useState<WordEntry[]>(() =>
    ALL_WORDS.slice(0, 8)
  );
  const [view, setView] = useState<"scatter" | "matrix">("scatter");
  const [hoveredWord, setHoveredWord] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeSet = useMemo(() => new Set(activeWords.map((w) => w.word)), [activeWords]);

  const toggleWord = useCallback((entry: WordEntry) => {
    setActiveWords((prev) => {
      const exists = prev.some((w) => w.word === entry.word);
      if (exists) {
        return prev.filter((w) => w.word !== entry.word);
      }
      return [...prev, entry];
    });
  }, []);

  if (!mounted) {
    return (
      <div
        className="widget-container bg-card border border-border rounded-xl p-6 my-8 overflow-hidden"
        style={{ minHeight: 400 }}
      >
        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-4 font-mono">
          Interactive &middot; Embeddings Explorer
        </div>
        <div
          style={{
            height: 360,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--muted-foreground)",
            fontFamily: "var(--font-mono)",
            fontSize: "0.8rem",
          }}
        >
          Loading embeddings...
        </div>
      </div>
    );
  }

  return (
    <div className="widget-container bg-card border border-border rounded-xl p-6 my-8 overflow-hidden">
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-4 font-mono">
        Interactive &middot; Embeddings Explorer
      </div>

      {/* View toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          className={`btn-mono ${view === "scatter" ? "active" : ""}`}
          onClick={() => setView("scatter")}
        >
          Semantic Clusters
        </button>
        <button
          className={`btn-mono ${view === "matrix" ? "active" : ""}`}
          onClick={() => setView("matrix")}
        >
          Similarity Matrix
        </button>
      </div>

      {/* Word bank */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: "0.7rem",
            color: "var(--muted-foreground)",
            fontFamily: "var(--font-mono)",
            marginBottom: 8,
          }}
        >
          WORD BANK &mdash; click to add/remove
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {ALL_WORDS.map((entry) => {
            const isActive = activeSet.has(entry.word);
            const color = GROUP_COLORS[entry.group];
            return (
              <button
                key={entry.word}
                onClick={() => toggleWord(entry)}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.72rem",
                  padding: "3px 10px",
                  borderRadius: 999,
                  border: `1px solid ${isActive ? color : "var(--border)"}`,
                  background: isActive ? color + "18" : "transparent",
                  color: isActive ? color : "var(--muted-foreground)",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {entry.word}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            marginTop: 10,
            fontSize: "0.65rem",
            fontFamily: "var(--font-mono)",
            color: "var(--muted-foreground)",
          }}
        >
          {Object.entries(GROUP_LABELS).map(([key, label]) => (
            <span key={key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: GROUP_COLORS[key],
                  display: "inline-block",
                }}
              />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Visualization */}
      {activeWords.length === 0 ? (
        <div
          style={{
            height: 300,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px dashed var(--border)",
            borderRadius: 8,
            color: "var(--muted-foreground)",
            fontFamily: "var(--font-mono)",
            fontSize: "0.8rem",
          }}
        >
          Select words from the bank above to visualize embeddings
        </div>
      ) : view === "scatter" ? (
        <ScatterPlot words={activeWords} hoveredWord={hoveredWord} onHover={setHoveredWord} />
      ) : (
        <SimilarityMatrix words={activeWords} />
      )}

      {/* Hover info bar */}
      {hoveredWord && view === "scatter" && (
        <div
          style={{
            marginTop: 12,
            padding: "8px 12px",
            background: "rgba(34,211,238,0.06)",
            border: "1px solid rgba(34,211,238,0.15)",
            borderRadius: 8,
            fontFamily: "var(--font-mono)",
            fontSize: "0.72rem",
            color: "var(--foreground)",
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <span style={{ color: "#22d3ee", fontWeight: 600 }}>
            {hoveredWord}
          </span>
          <span style={{ color: "var(--muted-foreground)" }}>similarities:</span>
          {activeWords
            .filter((w) => w.word !== hoveredWord)
            .map((w) => {
              const hovered = activeWords.find((aw) => aw.word === hoveredWord);
              if (!hovered) return null;
              const sim = cosineSimilarity(hovered, w);
              return (
                <span key={w.word}>
                  <span style={{ color: GROUP_COLORS[w.group] }}>{w.word}</span>
                  <span style={{ color: "var(--muted-foreground)" }}>=</span>
                  <span style={{ color: "#e4e4e7" }}>{sim.toFixed(3)}</span>
                </span>
              );
            })}
        </div>
      )}
    </div>
  );
}
