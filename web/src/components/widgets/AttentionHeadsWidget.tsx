"use client";

import React, { useState, useCallback, useSyncExternalStore } from "react";

/* ------------------------------------------------------------------ */
/*  Static data                                                        */
/* ------------------------------------------------------------------ */

const TOKENS = ["The", "cat", "sat", "on", "the", "mat"];
const N = TOKENS.length;

const HEAD_COLORS: string[] = [
  "#f97316", // Head 1 orange
  "#22d3ee", // Head 2 cyan
  "#4ade80", // Head 3 green
  "#f472b6", // Head 4 pink
];

const HEAD_LABELS = ["Head 1", "Head 2", "Head 3", "Head 4"];
const HEAD_NAMES = ["Positional", "Syntactic", "Global", "Identity"];

const HEAD_DESCRIPTIONS = [
  "Attends primarily to adjacent tokens, capturing local positional relationships and word-order structure.",
  "Captures syntactic dependencies \u2014 determiners attend to their nouns, nouns attend to their governing verbs.",
  "Distributes attention broadly across all tokens, acting like a global [CLS] representation.",
  "Strong self-attention along the diagonal \u2014 each token primarily attends to itself, preserving its own information.",
];

/**
 * Pre-computed attention matrices (row = query, col = key).
 * Each row sums to ~1. Deterministic \u2014 no randomness.
 */

// Head 1 -- Positional: attends strongly to adjacent tokens
const HEAD_1: number[][] = [
  [0.45, 0.40, 0.08, 0.04, 0.02, 0.01],
  [0.30, 0.30, 0.28, 0.06, 0.04, 0.02],
  [0.05, 0.25, 0.30, 0.28, 0.07, 0.05],
  [0.03, 0.05, 0.26, 0.32, 0.27, 0.07],
  [0.02, 0.03, 0.06, 0.28, 0.33, 0.28],
  [0.01, 0.02, 0.04, 0.07, 0.41, 0.45],
];

// Head 2 -- Syntactic: det->noun, noun->verb connections
const HEAD_2: number[][] = [
  [0.10, 0.60, 0.10, 0.05, 0.10, 0.05],
  [0.08, 0.12, 0.55, 0.10, 0.05, 0.10],
  [0.10, 0.35, 0.10, 0.15, 0.10, 0.20],
  [0.05, 0.10, 0.15, 0.10, 0.15, 0.45],
  [0.05, 0.08, 0.07, 0.10, 0.10, 0.60],
  [0.05, 0.15, 0.30, 0.15, 0.15, 0.20],
];

// Head 3 -- Global: broad / uniform attention (like [CLS])
const HEAD_3: number[][] = [
  [0.18, 0.17, 0.17, 0.16, 0.16, 0.16],
  [0.17, 0.17, 0.17, 0.17, 0.16, 0.16],
  [0.16, 0.17, 0.17, 0.17, 0.17, 0.16],
  [0.16, 0.16, 0.17, 0.18, 0.17, 0.16],
  [0.16, 0.16, 0.17, 0.17, 0.17, 0.17],
  [0.16, 0.16, 0.16, 0.17, 0.17, 0.18],
];

// Head 4 -- Identity: strong self-attention diagonal
const HEAD_4: number[][] = [
  [0.70, 0.06, 0.06, 0.06, 0.06, 0.06],
  [0.05, 0.72, 0.06, 0.06, 0.06, 0.05],
  [0.05, 0.05, 0.74, 0.06, 0.05, 0.05],
  [0.05, 0.05, 0.06, 0.72, 0.06, 0.06],
  [0.06, 0.05, 0.05, 0.06, 0.73, 0.05],
  [0.06, 0.06, 0.05, 0.05, 0.06, 0.72],
];

const HEADS = [HEAD_1, HEAD_2, HEAD_3, HEAD_4];

/** Shannon entropy of a probability distribution (bits). */
function computeEntropy(row: number[]): number {
  let h = 0;
  for (const p of row) {
    if (p > 0) h -= p * Math.log2(p);
  }
  return h;
}

/** Average entropy across all query positions for a head. */
function avgEntropy(matrix: number[][]): number {
  let sum = 0;
  for (const row of matrix) sum += computeEntropy(row);
  return sum / matrix.length;
}

// Pre-compute
const HEAD_ENTROPIES = HEADS.map((m) => avgEntropy(m));
const MAX_ENTROPY = Math.log2(N);

function entropyLabel(ent: number): string {
  const ratio = ent / MAX_ENTROPY;
  if (ratio < 0.5) return "Focused";
  if (ratio > 0.85) return "Diffuse";
  return "Moderate";
}

/* ------------------------------------------------------------------ */
/*  Main export                                                        */
/* ------------------------------------------------------------------ */

const emptySubscribe = () => () => {};

export function AttentionHeadsWidget() {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const [activeHead, setActiveHead] = useState(0);
  const [hoveredToken, setHoveredToken] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"single" | "all">("single");

  const handleHover = useCallback((i: number) => setHoveredToken(i), []);
  const handleLeave = useCallback(() => setHoveredToken(null), []);

  /* --- SSR placeholder -------------------------------------------- */
  if (!mounted) {
    return (
      <div
        className="widget-container bg-card border border-border rounded-xl p-6 my-8 overflow-hidden"
        style={{ minHeight: 480 }}
      >
        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-4 font-mono">
          Interactive &middot; Multi-Head Attention
        </div>
        <div className="h-64 flex items-center justify-center text-sm text-muted-foreground font-mono animate-pulse">
          Loading attention visualization&hellip;
        </div>
      </div>
    );
  }

  /* --- Hydrated render -------------------------------------------- */
  return (
    <div className="widget-container bg-card border border-border rounded-xl p-6 my-8 overflow-hidden">
      {/* Label */}
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-4 font-mono">
        Interactive &middot; Multi-Head Attention
      </div>

      {/* Title */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-1" style={{ color: "#a78bfa" }}>
          Self-Attention Heads
        </h3>
        <p className="text-sm text-muted-foreground">
          Each head learns a different attention pattern over the same input
          tokens. Hover a token to see what it attends to.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {HEAD_LABELS.map((label, i) => (
          <button
            key={i}
            onClick={() => {
              setActiveHead(i);
              if (viewMode !== "single") setViewMode("single");
            }}
            className="btn-mono text-xs px-3 py-1.5 rounded-md border transition-all duration-150 inline-flex items-center gap-1.5"
            style={{
              borderColor:
                viewMode === "single" && activeHead === i
                  ? HEAD_COLORS[i]
                  : "rgba(255,255,255,0.1)",
              background:
                viewMode === "single" && activeHead === i
                  ? `${HEAD_COLORS[i]}22`
                  : "transparent",
              color:
                viewMode === "single" && activeHead === i
                  ? HEAD_COLORS[i]
                  : "rgba(255,255,255,0.5)",
            }}
          >
            <span
              className="inline-block w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: HEAD_COLORS[i] }}
            />
            {label}
          </button>
        ))}

        <div className="w-px h-5 bg-border mx-1" />

        {(["single", "all"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className="btn-mono text-xs px-3 py-1.5 rounded-md border transition-all duration-150"
            style={{
              borderColor:
                viewMode === mode ? "#a78bfa" : "rgba(255,255,255,0.1)",
              background:
                viewMode === mode ? "rgba(167,139,250,0.15)" : "transparent",
              color: viewMode === mode ? "#a78bfa" : "rgba(255,255,255,0.5)",
            }}
          >
            {mode === "single" ? "Single Head" : "All Heads"}
          </button>
        ))}
      </div>

      {/* Input sentence */}
      <div className="flex items-center gap-1.5 mb-5 px-1">
        <span className="text-[10px] text-muted-foreground font-mono opacity-50 mr-1">
          input
        </span>
        {TOKENS.map((t, i) => (
          <span
            key={i}
            className="font-mono text-sm px-2 py-0.5 rounded"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            {t}
          </span>
        ))}
      </div>

      {/* === SINGLE HEAD VIEW === */}
      {viewMode === "single" && (
        <SingleHeadView
          headIndex={activeHead}
          hoveredToken={hoveredToken}
          onHover={handleHover}
          onLeave={handleLeave}
        />
      )}

      {/* === ALL HEADS VIEW (2x2 heatmaps) === */}
      {viewMode === "all" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {HEADS.map((_, i) => (
            <MiniHeatmap
              key={i}
              headIndex={i}
              hoveredToken={hoveredToken}
              onHover={handleHover}
              onLeave={handleLeave}
            />
          ))}
        </div>
      )}

      {/* Head description */}
      <div
        className="mt-5 p-3 rounded-lg text-xs font-mono leading-relaxed"
        style={{ background: "rgba(255,255,255,0.03)" }}
      >
        {viewMode === "single" ? (
          <span className="text-muted-foreground">
            <span style={{ color: HEAD_COLORS[activeHead] }} className="font-semibold">
              {HEAD_NAMES[activeHead]} Attention:
            </span>{" "}
            {HEAD_DESCRIPTIONS[activeHead]}
          </span>
        ) : (
          <span className="text-muted-foreground">
            Comparing all four attention heads side-by-side. Each head captures a
            different linguistic pattern. Brighter cells indicate stronger
            attention from the row token (query) to the column token (key).
          </span>
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-border">
        <div className="flex flex-wrap gap-4 text-[11px] text-muted-foreground font-mono">
          <span>
            <strong className="text-foreground">Q</strong> (query) attends to{" "}
            <strong className="text-foreground">K</strong> (key)
          </span>
          <span>Line thickness &amp; opacity = attention weight</span>
          <span>Hover a token to isolate its pattern</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Single head view                                                   */
/* ------------------------------------------------------------------ */

function SingleHeadView({
  headIndex,
  hoveredToken,
  onHover,
  onLeave,
}: {
  headIndex: number;
  hoveredToken: number | null;
  onHover: (i: number) => void;
  onLeave: () => void;
}) {
  const color = HEAD_COLORS[headIndex];
  const matrix = HEADS[headIndex];

  return (
    <div className="space-y-0">
      {/* Query tokens (top row) */}
      <div className="flex justify-between px-2">
        <span className="text-[10px] text-muted-foreground font-mono self-center mr-2 opacity-60">
          Q
        </span>
        {TOKENS.map((t, i) => (
          <div
            key={i}
            className="px-3 py-1.5 rounded-md text-sm font-mono cursor-pointer transition-all duration-150 select-none text-center"
            style={{
              backgroundColor:
                hoveredToken === i
                  ? `${color}33`
                  : "rgba(255,255,255,0.05)",
              borderBottom:
                hoveredToken === i
                  ? `2px solid ${color}`
                  : "2px solid transparent",
              color: hoveredToken === i ? color : "#e4e4e7",
              flex: 1,
              maxWidth: 72,
            }}
            onMouseEnter={() => onHover(i)}
            onMouseLeave={onLeave}
          >
            {t}
          </div>
        ))}
      </div>

      {/* SVG attention lines */}
      <div className="relative" style={{ height: 100 }}>
        <svg
          className="w-full h-full"
          preserveAspectRatio="none"
          style={{ overflow: "visible" }}
        >
          <AttentionLines
            hoveredToken={hoveredToken}
            matrix={matrix}
            color={color}
          />
        </svg>
        {hoveredToken === null && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground font-mono opacity-40 pointer-events-none">
            hover a token above
          </div>
        )}
      </div>

      {/* Key tokens (bottom row) */}
      <div className="flex justify-between px-2">
        <span className="text-[10px] text-muted-foreground font-mono self-center mr-2 opacity-60">
          K
        </span>
        {TOKENS.map((t, i) => {
          const w = hoveredToken !== null ? matrix[hoveredToken][i] : 0;
          const strong = w > 0.15;
          return (
            <div
              key={i}
              className="px-3 py-1.5 rounded-md text-sm font-mono text-center transition-all duration-150"
              style={{
                backgroundColor: "rgba(255,255,255,0.05)",
                color: hoveredToken !== null && strong ? color : "#a1a1aa",
                fontWeight: strong ? 600 : 400,
                flex: 1,
                maxWidth: 72,
              }}
            >
              {t}
              {hoveredToken !== null && (
                <span
                  className="block text-[10px] mt-0.5 font-mono"
                  style={{ opacity: 0.7, color }}
                >
                  {w.toFixed(2)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Entropy bar */}
      <EntropyBar headIndex={headIndex} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SVG attention lines                                                */
/* ------------------------------------------------------------------ */

function AttentionLines({
  hoveredToken,
  matrix,
  color,
}: {
  hoveredToken: number | null;
  matrix: number[][];
  color: string;
}) {
  if (hoveredToken === null) {
    // Show faint overview of all connections
    const lines: React.ReactElement[] = [];
    for (let qi = 0; qi < N; qi++) {
      for (let ki = 0; ki < N; ki++) {
        const w = matrix[qi][ki];
        if (w < 0.08) continue;
        const x1Pct = ((qi + 0.5) / N) * 100;
        const x2Pct = ((ki + 0.5) / N) * 100;
        lines.push(
          <line
            key={`${qi}-${ki}`}
            x1={`${x1Pct}%`}
            y1="0%"
            x2={`${x2Pct}%`}
            y2="100%"
            stroke={color}
            strokeOpacity={w * 0.35}
            strokeWidth={Math.max(0.5, w * 3)}
            strokeLinecap="round"
          />
        );
      }
    }
    return <>{lines}</>;
  }

  const weights = matrix[hoveredToken];
  const maxW = Math.max(...weights);

  return (
    <>
      {weights.map((w, ki) => {
        const norm = maxW > 0 ? w / maxW : 0;
        const opacity = 0.1 + norm * 0.85;
        const strokeWidth = 1 + norm * 5;
        const x1Pct = ((hoveredToken + 0.5) / N) * 100;
        const x2Pct = ((ki + 0.5) / N) * 100;
        return (
          <line
            key={ki}
            x1={`${x1Pct}%`}
            y1="0%"
            x2={`${x2Pct}%`}
            y2="100%"
            stroke={color}
            strokeOpacity={opacity}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Mini heatmap for All Heads view                                    */
/* ------------------------------------------------------------------ */

function MiniHeatmap({
  headIndex,
  hoveredToken,
  onHover,
  onLeave,
}: {
  headIndex: number;
  hoveredToken: number | null;
  onHover: (i: number) => void;
  onLeave: () => void;
}) {
  const matrix = HEADS[headIndex];
  const color = HEAD_COLORS[headIndex];

  return (
    <div
      className="rounded-lg p-3 border border-border"
      style={{ background: "rgba(255,255,255,0.02)" }}
    >
      {/* Head label */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
        <span className="text-xs font-mono font-semibold" style={{ color }}>
          {HEAD_LABELS[headIndex]}: {HEAD_NAMES[headIndex]}
        </span>
      </div>

      {/* Column headers */}
      <div className="flex gap-px" style={{ marginLeft: 36 }}>
        {TOKENS.map((t, i) => (
          <div
            key={i}
            className="text-[9px] font-mono text-muted-foreground text-center truncate"
            style={{ width: 32 }}
          >
            {t}
          </div>
        ))}
      </div>

      {/* Matrix rows */}
      <div className="space-y-px mt-0.5">
        {matrix.map((row, qi) => (
          <div
            key={qi}
            className="flex items-center gap-0"
            onMouseEnter={() => onHover(qi)}
            onMouseLeave={onLeave}
          >
            {/* Row label */}
            <div
              className="text-[9px] font-mono text-muted-foreground text-right pr-1 truncate flex-shrink-0"
              style={{
                width: 36,
                color: hoveredToken === qi ? color : undefined,
                fontWeight: hoveredToken === qi ? 600 : 400,
              }}
            >
              {TOKENS[qi]}
            </div>
            {/* Cells */}
            {row.map((w, ki) => {
              const hex = Math.round(w * 220)
                .toString(16)
                .padStart(2, "0");
              return (
                <div
                  key={ki}
                  className="flex items-center justify-center text-[8px] font-mono cursor-default transition-all duration-100"
                  style={{
                    width: 32,
                    height: 22,
                    backgroundColor: `${color}${hex}`,
                    color: w > 0.4 ? "#000" : "rgba(255,255,255,0.5)",
                    borderRadius: 2,
                    outline:
                      hoveredToken === qi
                        ? `1px solid ${color}88`
                        : "1px solid transparent",
                  }}
                  title={`${TOKENS[qi]} \u2192 ${TOKENS[ki]}: ${w.toFixed(2)}`}
                >
                  {w >= 0.15 ? w.toFixed(2) : ""}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Entropy bar */}
      <EntropyBar headIndex={headIndex} compact />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Entropy bar                                                        */
/* ------------------------------------------------------------------ */

function EntropyBar({
  headIndex,
  compact = false,
}: {
  headIndex: number;
  compact?: boolean;
}) {
  const ent = HEAD_ENTROPIES[headIndex];
  const ratio = ent / MAX_ENTROPY;
  const color = HEAD_COLORS[headIndex];
  const label = entropyLabel(ent);

  return (
    <div
      className={`flex items-center gap-2 ${compact ? "mt-2" : "mt-4 justify-center"}`}
    >
      <span
        className={`font-mono text-muted-foreground flex-shrink-0 ${compact ? "text-[9px]" : "text-[10px]"}`}
      >
        Entropy:
      </span>
      <div
        className="rounded-full overflow-hidden flex-shrink-0"
        style={{
          width: compact ? 52 : 80,
          height: compact ? 4 : 6,
          background: "rgba(255,255,255,0.06)",
        }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${ratio * 100}%`,
            background: color,
          }}
        />
      </div>
      <span
        className={`font-mono flex-shrink-0 ${compact ? "text-[9px]" : "text-[10px]"}`}
        style={{ color }}
      >
        {ent.toFixed(2)} bits
      </span>
      {!compact && (
        <span className="text-[9px] font-mono text-muted-foreground opacity-60 flex-shrink-0">
          ({label})
        </span>
      )}
    </div>
  );
}
