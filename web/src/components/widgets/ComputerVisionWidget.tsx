"use client";

import React, { useState, useEffect, useRef, useCallback, useSyncExternalStore } from "react";

/* ------------------------------------------------------------------ */
/*  Detection data                                                     */
/* ------------------------------------------------------------------ */

interface Detection {
  class: string;
  confidence: number;
  bbox: [number, number, number, number]; // [x, y, w, h] in canvas coords
  color: string;
  colorRgba: string;
  colorFill: string;
}

const DETECTIONS: Detection[] = [
  {
    class: "car",
    confidence: 0.96,
    bbox: [40, 180, 200, 120],
    color: "#4ade80",
    colorRgba: "rgba(74,222,128,0.25)",
    colorFill: "rgba(74,222,128,0.35)",
  },
  {
    class: "person",
    confidence: 0.89,
    bbox: [280, 120, 80, 180],
    color: "#22d3ee",
    colorRgba: "rgba(34,211,238,0.25)",
    colorFill: "rgba(34,211,238,0.35)",
  },
  {
    class: "dog",
    confidence: 0.72,
    bbox: [420, 260, 70, 50],
    color: "#f97316",
    colorRgba: "rgba(249,115,22,0.25)",
    colorFill: "rgba(249,115,22,0.35)",
  },
  {
    class: "traffic_light",
    confidence: 0.61,
    bbox: [460, 20, 40, 90],
    color: "#f472b6",
    colorRgba: "rgba(244,114,182,0.25)",
    colorFill: "rgba(244,114,182,0.35)",
  },
];

const CANVAS_W = 560;
const CANVAS_H = 340;

type DetectionMode = "objects" | "segmentation";

/* ------------------------------------------------------------------ */
/*  Draw helpers                                                       */
/* ------------------------------------------------------------------ */

function drawGrid(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  for (let x = 0; x < CANVAS_W; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CANVAS_H);
    ctx.stroke();
  }
  for (let y = 0; y < CANVAS_H; y += 20) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CANVAS_W, y);
    ctx.stroke();
  }
}

function drawScene(ctx: CanvasRenderingContext2D) {
  // Sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, 200);
  skyGrad.addColorStop(0, "#1a1a2e");
  skyGrad.addColorStop(1, "#2a2a3e");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, CANVAS_W, 200);

  // Ground / road
  ctx.fillStyle = "#252530";
  ctx.fillRect(0, 200, CANVAS_W, 140);

  // Road lines
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 2;
  ctx.setLineDash([20, 15]);
  ctx.beginPath();
  ctx.moveTo(0, 260);
  ctx.lineTo(CANVAS_W, 260);
  ctx.stroke();
  ctx.setLineDash([]);

  // Sidewalk edge
  ctx.fillStyle = "#2e2e3a";
  ctx.fillRect(0, 195, CANVAS_W, 10);

  // --- Car (center-left) ---
  // Body
  ctx.fillStyle = "#3a5a8a";
  ctx.beginPath();
  ctx.roundRect(60, 220, 160, 60, 6);
  ctx.fill();
  // Roof
  ctx.fillStyle = "#2e4a72";
  ctx.beginPath();
  ctx.roundRect(90, 195, 100, 30, [8, 8, 0, 0]);
  ctx.fill();
  // Windows
  ctx.fillStyle = "rgba(100,180,255,0.3)";
  ctx.fillRect(95, 200, 40, 20);
  ctx.fillRect(140, 200, 40, 20);
  // Wheels
  ctx.fillStyle = "#1a1a1f";
  ctx.beginPath();
  ctx.arc(100, 280, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(180, 280, 16, 0, Math.PI * 2);
  ctx.fill();
  // Wheel hubcaps
  ctx.fillStyle = "#444";
  ctx.beginPath();
  ctx.arc(100, 280, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(180, 280, 6, 0, Math.PI * 2);
  ctx.fill();
  // Headlights
  ctx.fillStyle = "rgba(255,255,200,0.6)";
  ctx.beginPath();
  ctx.ellipse(218, 240, 4, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,100,100,0.5)";
  ctx.beginPath();
  ctx.ellipse(62, 240, 4, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // --- Person (center) ---
  // Head
  ctx.fillStyle = "#d4a574";
  ctx.beginPath();
  ctx.arc(320, 145, 14, 0, Math.PI * 2);
  ctx.fill();
  // Body
  ctx.fillStyle = "#4a6fa5";
  ctx.fillRect(308, 160, 24, 50);
  // Legs
  ctx.fillStyle = "#3a3a4a";
  ctx.fillRect(310, 210, 9, 55);
  ctx.fillRect(323, 210, 9, 55);
  // Arms
  ctx.fillStyle = "#4a6fa5";
  ctx.save();
  ctx.translate(308, 165);
  ctx.rotate(-0.2);
  ctx.fillRect(-4, 0, 8, 35);
  ctx.restore();
  ctx.save();
  ctx.translate(332, 165);
  ctx.rotate(0.2);
  ctx.fillRect(-4, 0, 8, 35);
  ctx.restore();
  // Shoes
  ctx.fillStyle = "#2a2a35";
  ctx.fillRect(308, 262, 14, 6);
  ctx.fillRect(321, 262, 14, 6);

  // --- Dog (bottom-right) ---
  // Body
  ctx.fillStyle = "#8B6914";
  ctx.beginPath();
  ctx.ellipse(455, 278, 28, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  // Head
  ctx.fillStyle = "#9B7924";
  ctx.beginPath();
  ctx.ellipse(480, 268, 12, 10, -0.3, 0, Math.PI * 2);
  ctx.fill();
  // Ears
  ctx.fillStyle = "#7a5a10";
  ctx.beginPath();
  ctx.ellipse(485, 260, 5, 7, 0.3, 0, Math.PI * 2);
  ctx.fill();
  // Eye
  ctx.fillStyle = "#111";
  ctx.beginPath();
  ctx.arc(484, 266, 2, 0, Math.PI * 2);
  ctx.fill();
  // Legs
  ctx.fillStyle = "#8B6914";
  ctx.fillRect(435, 290, 5, 14);
  ctx.fillRect(445, 290, 5, 14);
  ctx.fillRect(462, 290, 5, 14);
  ctx.fillRect(472, 290, 5, 14);
  // Tail
  ctx.strokeStyle = "#8B6914";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(428, 274);
  ctx.quadraticCurveTo(418, 258, 422, 250);
  ctx.stroke();

  // --- Traffic Light (top-right) ---
  // Pole
  ctx.fillStyle = "#555";
  ctx.fillRect(476, 80, 6, 120);
  // Housing
  ctx.fillStyle = "#333";
  ctx.beginPath();
  ctx.roundRect(465, 25, 28, 65, 4);
  ctx.fill();
  // Red light
  ctx.fillStyle = "rgba(255,60,60,0.3)";
  ctx.beginPath();
  ctx.arc(479, 40, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,60,60,0.5)";
  ctx.lineWidth = 1;
  ctx.stroke();
  // Yellow light
  ctx.fillStyle = "rgba(255,200,0,0.3)";
  ctx.beginPath();
  ctx.arc(479, 58, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,200,0,0.5)";
  ctx.stroke();
  // Green light (active)
  ctx.fillStyle = "rgba(0,255,100,0.8)";
  ctx.beginPath();
  ctx.arc(479, 76, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = "rgba(0,255,100,0.5)";
  ctx.shadowBlur = 12;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Buildings in background
  ctx.fillStyle = "#222233";
  ctx.fillRect(0, 80, 35, 120);
  ctx.fillRect(510, 60, 50, 140);
  // Building windows
  ctx.fillStyle = "rgba(255,220,100,0.2)";
  for (let row = 0; row < 4; row++) {
    ctx.fillRect(8, 90 + row * 25, 8, 12);
    ctx.fillRect(22, 90 + row * 25, 8, 12);
    ctx.fillRect(518, 70 + row * 28, 10, 14);
    ctx.fillRect(538, 70 + row * 28, 10, 14);
  }
}

function drawBoundingBoxes(
  ctx: CanvasRenderingContext2D,
  detections: Detection[],
  threshold: number,
  selectedIdx: number | null
) {
  for (let i = 0; i < detections.length; i++) {
    const d = detections[i];
    if (d.confidence < threshold) continue;
    const [x, y, w, h] = d.bbox;
    const isSelected = selectedIdx === i;

    // Fill
    ctx.fillStyle = d.colorRgba;
    ctx.fillRect(x, y, w, h);

    // Border
    ctx.strokeStyle = d.color;
    ctx.lineWidth = isSelected ? 3 : 2;
    ctx.setLineDash(isSelected ? [] : []);
    ctx.strokeRect(x, y, w, h);

    if (isSelected) {
      // Glow effect
      ctx.shadowColor = d.color;
      ctx.shadowBlur = 10;
      ctx.strokeRect(x, y, w, h);
      ctx.shadowBlur = 0;
    }

    // Label background
    const label = `${d.class} ${(d.confidence * 100).toFixed(0)}%`;
    ctx.font = "bold 11px monospace";
    const textW = ctx.measureText(label).width;
    const labelH = 18;
    const labelY = y - labelH - 2;
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.roundRect(x, labelY < 0 ? y : labelY, textW + 10, labelH, [3, 3, 0, 0]);
    ctx.fill();

    // Label text
    ctx.fillStyle = "#0d0d0f";
    ctx.fillText(label, x + 5, (labelY < 0 ? y : labelY) + 13);

    // Corner markers
    const cornerLen = 8;
    ctx.strokeStyle = d.color;
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    // Top-left
    ctx.beginPath();
    ctx.moveTo(x, y + cornerLen);
    ctx.lineTo(x, y);
    ctx.lineTo(x + cornerLen, y);
    ctx.stroke();
    // Top-right
    ctx.beginPath();
    ctx.moveTo(x + w - cornerLen, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + cornerLen);
    ctx.stroke();
    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(x, y + h - cornerLen);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x + cornerLen, y + h);
    ctx.stroke();
    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(x + w - cornerLen, y + h);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w, y + h - cornerLen);
    ctx.stroke();
  }
}

function drawSegmentation(
  ctx: CanvasRenderingContext2D,
  detections: Detection[],
  threshold: number,
  selectedIdx: number | null
) {
  for (let i = 0; i < detections.length; i++) {
    const d = detections[i];
    if (d.confidence < threshold) continue;
    const [x, y, w, h] = d.bbox;
    const isSelected = selectedIdx === i;

    // Filled mask region
    ctx.fillStyle = isSelected ? d.color.replace(")", ",0.5)").replace("rgb", "rgba") : d.colorFill;
    // Approximate object shape with a slightly rounded/irregular fill
    ctx.beginPath();
    if (d.class === "car") {
      ctx.roundRect(x + 5, y + 5, w - 10, h - 10, 10);
    } else if (d.class === "person") {
      ctx.ellipse(x + w / 2, y + h / 2, w / 2 - 4, h / 2 - 4, 0, 0, Math.PI * 2);
    } else if (d.class === "dog") {
      ctx.ellipse(x + w / 2, y + h / 2, w / 2 - 2, h / 2 - 2, 0, 0, Math.PI * 2);
    } else {
      ctx.roundRect(x + 3, y + 3, w - 6, h - 6, 4);
    }
    ctx.fill();

    // Outline
    ctx.strokeStyle = d.color;
    ctx.lineWidth = isSelected ? 3 : 1.5;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    if (isSelected) {
      ctx.shadowColor = d.color;
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Label
    const label = `${d.class} ${(d.confidence * 100).toFixed(0)}%`;
    ctx.font = "bold 11px monospace";
    const textW = ctx.measureText(label).width;
    const labelBgX = x + w / 2 - textW / 2 - 5;
    const labelBgY = y - 20 < 0 ? y + 4 : y - 20;
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.beginPath();
    ctx.roundRect(labelBgX, labelBgY, textW + 10, 18, 3);
    ctx.fill();
    ctx.fillStyle = d.color;
    ctx.fillText(label, labelBgX + 5, labelBgY + 13);
  }
}

/* ------------------------------------------------------------------ */
/*  JSON formatting helpers                                            */
/* ------------------------------------------------------------------ */

function formatJsonDetections(
  detections: Detection[],
  threshold: number,
  selectedIdx: number | null
): React.ReactNode[] {
  const lines: React.ReactNode[] = [];
  lines.push(
    <span key="open">
      <span className="json-bracket">{"{"}</span>
      {"\n"}
      {"  "}
      <span className="json-key">&quot;detections&quot;</span>
      <span className="json-bracket">:</span> <span className="json-bracket">[</span>
    </span>
  );

  for (let i = 0; i < detections.length; i++) {
    const d = detections[i];
    const belowThreshold = d.confidence < threshold;
    const isSelected = selectedIdx === i;
    const opacity = belowThreshold ? 0.3 : 1;
    const highlight = isSelected ? "json-highlight" : "";

    lines.push(
      <span
        key={`det-${i}`}
        style={{ opacity }}
        className={highlight}
      >
        {"\n    "}
        <span className="json-bracket">{"{"}</span>
        {"\n      "}
        <span className="json-key">&quot;class&quot;</span>
        <span className="json-bracket">:</span>{" "}
        <span className="json-string">&quot;{d.class}&quot;</span>
        <span className="json-bracket">,</span>
        {"\n      "}
        <span className="json-key">&quot;confidence&quot;</span>
        <span className="json-bracket">:</span>{" "}
        <span className="json-number">{d.confidence.toFixed(2)}</span>
        <span className="json-bracket">,</span>
        {"\n      "}
        <span className="json-key">&quot;bbox&quot;</span>
        <span className="json-bracket">:</span>{" "}
        <span className="json-bracket">[</span>
        <span className="json-number">{d.bbox.join(", ")}</span>
        <span className="json-bracket">]</span>
        {belowThreshold && (
          <span style={{ color: "#f43f5e", fontSize: "0.7rem", marginLeft: 8 }}>
            {"// below threshold"}
          </span>
        )}
        {"\n    "}
        <span className="json-bracket">{"}"}</span>
        {i < detections.length - 1 && <span className="json-bracket">,</span>}
      </span>
    );
  }

  lines.push(
    <span key="close">
      {"\n  "}
      <span className="json-bracket">]</span>
      {"\n"}
      <span className="json-bracket">{"}"}</span>
    </span>
  );

  return lines;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const emptySubscribe = () => () => {};

export function ComputerVisionWidget() {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [threshold, setThreshold] = useState(0.5);
  const [mode, setMode] = useState<DetectionMode>("objects");
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  /* ---- draw ---- */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear
    ctx.fillStyle = "#1a1a1f";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Grid
    drawGrid(ctx);

    // Scene
    drawScene(ctx);

    // Detections
    if (mode === "objects") {
      drawBoundingBoxes(ctx, DETECTIONS, threshold, selectedIdx);
    } else {
      drawSegmentation(ctx, DETECTIONS, threshold, selectedIdx);
    }
  }, [threshold, mode, selectedIdx]);

  useEffect(() => {
    if (mounted) draw();
  }, [mounted, draw]);

  /* ---- canvas click handler ---- */
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_W / rect.width;
      const scaleY = CANVAS_H / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;

      for (let i = DETECTIONS.length - 1; i >= 0; i--) {
        const d = DETECTIONS[i];
        if (d.confidence < threshold) continue;
        const [x, y, w, h] = d.bbox;
        if (mx >= x && mx <= x + w && my >= y && my <= y + h) {
          setSelectedIdx(selectedIdx === i ? null : i);
          return;
        }
      }
      setSelectedIdx(null);
    },
    [threshold, selectedIdx]
  );

  /* ---- visible detections count ---- */
  const visibleCount = DETECTIONS.filter((d) => d.confidence >= threshold).length;

  /* ---- render ---- */
  if (!mounted) {
    return (
      <div
        className="widget-container bg-card border border-border rounded-xl p-6 my-8 overflow-hidden"
        style={{ minHeight: 600 }}
      />
    );
  }

  return (
    <div className="widget-container bg-card border border-border rounded-xl p-6 my-8 overflow-hidden">
      {/* Label */}
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-4 font-mono">
        Interactive &middot; Computer Vision Detection
      </div>

      {/* Title + detection count */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-lg font-semibold text-foreground m-0">
          Object Detection
        </h3>
        <div className="flex items-center gap-3 font-mono text-xs">
          <span className="text-muted-foreground">
            Detected{" "}
            <span className="font-semibold" style={{ color: "#4ade80" }}>
              {visibleCount}
            </span>
            <span className="text-muted-foreground">/{DETECTIONS.length}</span>
          </span>
        </div>
      </div>

      {/* Mode toggles */}
      <div className="flex gap-2 mb-4">
        <button
          className={`btn-mono ${mode === "objects" ? "active" : ""}`}
          onClick={() => {
            setMode("objects");
            setSelectedIdx(null);
          }}
          style={{
            borderColor: mode === "objects" ? "#4ade80" : undefined,
            color: mode === "objects" ? "#4ade80" : undefined,
          }}
        >
          Objects
        </button>
        <button
          className={`btn-mono ${mode === "segmentation" ? "active" : ""}`}
          onClick={() => {
            setMode("segmentation");
            setSelectedIdx(null);
          }}
          style={{
            borderColor: mode === "segmentation" ? "#4ade80" : undefined,
            color: mode === "segmentation" ? "#4ade80" : undefined,
          }}
        >
          Segmentation
        </button>
      </div>

      {/* Threshold slider */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
            Confidence Threshold
          </span>
          <span
            className="font-mono text-sm font-semibold"
            style={{ color: "#4ade80" }}
          >
            {threshold.toFixed(2)}
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={threshold}
          onChange={(e) => {
            setThreshold(parseFloat(e.target.value));
            setSelectedIdx(null);
          }}
          className="w-full"
          style={
            {
              "--thumb-color": "#4ade80",
            } as React.CSSProperties
          }
        />
        <div className="flex justify-between text-xs text-muted-foreground font-mono mt-1">
          <span>0.00</span>
          <span>1.00</span>
        </div>
      </div>

      {/* Canvas */}
      <div className="mb-5 rounded-lg overflow-hidden border border-border">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onClick={handleCanvasClick}
          style={{
            width: "100%",
            height: "auto",
            display: "block",
            cursor: "crosshair",
            background: "#1a1a1f",
          }}
        />
      </div>

      {/* Detection legend */}
      <div className="flex flex-wrap gap-3 mb-5">
        {DETECTIONS.map((d, i) => {
          const belowThreshold = d.confidence < threshold;
          const isSelected = selectedIdx === i;
          return (
            <button
              key={d.class}
              onClick={() => {
                if (!belowThreshold) {
                  setSelectedIdx(isSelected ? null : i);
                }
              }}
              className="flex items-center gap-1.5 font-mono text-xs transition-all duration-200"
              style={{
                opacity: belowThreshold ? 0.3 : 1,
                cursor: belowThreshold ? "default" : "pointer",
                padding: "4px 10px",
                borderRadius: 6,
                border: `1px solid ${isSelected ? d.color : "rgba(255,255,255,0.08)"}`,
                background: isSelected ? d.colorRgba : "transparent",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: d.color,
                }}
              />
              <span style={{ color: belowThreshold ? "#555" : d.color }}>
                {d.class}
              </span>
              <span style={{ color: "#71717a" }}>
                {(d.confidence * 100).toFixed(0)}%
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected detection details */}
      {selectedIdx !== null && DETECTIONS[selectedIdx].confidence >= threshold && (
        <div
          className="mb-5 p-4 rounded-lg border font-mono text-xs animate-fade-in"
          style={{
            borderColor: DETECTIONS[selectedIdx].color,
            background: DETECTIONS[selectedIdx].colorRgba,
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span
              style={{
                display: "inline-block",
                width: 12,
                height: 12,
                borderRadius: 3,
                background: DETECTIONS[selectedIdx].color,
              }}
            />
            <span
              className="font-semibold text-sm"
              style={{ color: DETECTIONS[selectedIdx].color }}
            >
              {DETECTIONS[selectedIdx].class}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            <div>
              <span className="text-muted-foreground">Confidence:</span>{" "}
              <span style={{ color: "#4ade80" }}>
                {(DETECTIONS[selectedIdx].confidence * 100).toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Class ID:</span>{" "}
              <span className="text-foreground">{selectedIdx}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Position:</span>{" "}
              <span className="text-foreground">
                ({DETECTIONS[selectedIdx].bbox[0]}, {DETECTIONS[selectedIdx].bbox[1]})
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Size:</span>{" "}
              <span className="text-foreground">
                {DETECTIONS[selectedIdx].bbox[2]} x {DETECTIONS[selectedIdx].bbox[3]}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Area:</span>{" "}
              <span className="text-foreground">
                {(DETECTIONS[selectedIdx].bbox[2] * DETECTIONS[selectedIdx].bbox[3]).toLocaleString()}px
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Mode:</span>{" "}
              <span className="text-foreground">{mode}</span>
            </div>
          </div>
        </div>
      )}

      {/* JSON output */}
      <div>
        <div className="text-xs text-muted-foreground font-mono mb-2 uppercase tracking-wider">
          API Response
        </div>
        <div
          className="rounded-lg overflow-hidden border border-border p-4 font-mono text-xs"
          style={{
            background: "rgba(255,255,255,0.02)",
            maxHeight: 280,
            overflowY: "auto",
            whiteSpace: "pre",
            lineHeight: 1.6,
          }}
        >
          {formatJsonDetections(DETECTIONS, threshold, selectedIdx)}
        </div>
      </div>

      {/* Hint */}
      <div className="text-xs text-muted-foreground font-mono text-center mt-4 opacity-60">
        Click a detection in the canvas or legend to inspect details. Adjust the{" "}
        <span style={{ color: "#4ade80" }}>threshold</span> to filter by confidence.
      </div>
    </div>
  );
}
