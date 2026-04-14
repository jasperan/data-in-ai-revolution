"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { useClientMounted } from "@/hooks/useClientMounted";

/* ------------------------------------------------------------------ */
/*  Seeded random for deterministic weight generation                  */
/* ------------------------------------------------------------------ */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 4973) * 49297;
  return Math.round((x - Math.floor(x)) * 1000) / 1000;
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

/* ------------------------------------------------------------------ */
/*  Quantization bit-width configs                                     */
/* ------------------------------------------------------------------ */
type BitWidth = "FP32" | "FP16" | "INT8" | "INT4";

interface BitConfig {
  label: string;
  bits: number;
  levels: number; // number of discrete levels
  compression: number; // compression ratio vs FP32
}

const BIT_CONFIGS: Record<BitWidth, BitConfig> = {
  FP32: { label: "FP32", bits: 32, levels: Infinity, compression: 1 },
  FP16: { label: "FP16", bits: 16, levels: 65536, compression: 2 },
  INT8: { label: "INT8", bits: 8, levels: 256, compression: 4 },
  INT4: { label: "INT4", bits: 4, levels: 16, compression: 8 },
};

/* ------------------------------------------------------------------ */
/*  Generate a 4x4 matrix of FP32 weights from a seed                 */
/* ------------------------------------------------------------------ */
function generateWeights(seed: number): number[][] {
  const matrix: number[][] = [];
  for (let r = 0; r < 4; r++) {
    const row: number[] = [];
    for (let c = 0; c < 4; c++) {
      // Generate values in range roughly [-1.5, 1.5]
      const raw = seededRandom(seed + r * 4 + c);
      const scaled = round4((raw - 0.5) * 3);
      row.push(scaled);
    }
    matrix.push(row);
  }
  return matrix;
}

/* ------------------------------------------------------------------ */
/*  Asymmetric quantization helpers                                    */
/* ------------------------------------------------------------------ */
function quantize(
  matrix: number[][],
  bitWidth: BitWidth
): {
  quantized: number[][];
  dequantized: number[][];
  scale: number;
  zeroPoint: number;
} {
  const config = BIT_CONFIGS[bitWidth];

  if (bitWidth === "FP32") {
    return {
      quantized: matrix.map((r) => r.map((v) => v)),
      dequantized: matrix.map((r) => r.map((v) => v)),
      scale: 0,
      zeroPoint: 0,
    };
  }

  // Find min and max across the matrix
  let min = Infinity;
  let max = -Infinity;
  for (const row of matrix) {
    for (const v of row) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }

  const levels = config.levels;
  const maxLevel = levels - 1;

  // Scale and zero point for asymmetric quantization
  const scale = (max - min) / maxLevel || 1e-8;
  const zeroPoint = Math.round(-min / scale);

  const quantized: number[][] = [];
  const dequantized: number[][] = [];

  for (const row of matrix) {
    const qRow: number[] = [];
    const dRow: number[] = [];
    for (const v of row) {
      // Quantize
      let q = Math.round(v / scale + zeroPoint);
      q = Math.max(0, Math.min(maxLevel, q));
      qRow.push(q);
      // Dequantize
      const dq = round4((q - zeroPoint) * scale);
      dRow.push(dq);
    }
    quantized.push(qRow);
    dequantized.push(dRow);
  }

  return { quantized, dequantized, scale: round4(scale), zeroPoint };
}

/* ------------------------------------------------------------------ */
/*  Compute error stats                                                */
/* ------------------------------------------------------------------ */
function computeErrors(
  original: number[][],
  dequantized: number[][]
): {
  errors: number[][];
  maxError: number;
  meanError: number;
  rmse: number;
} {
  const errors: number[][] = [];
  let sumAbs = 0;
  let sumSq = 0;
  let maxErr = 0;
  let count = 0;

  for (let r = 0; r < 4; r++) {
    const row: number[] = [];
    for (let c = 0; c < 4; c++) {
      const err = round4(Math.abs(original[r][c] - dequantized[r][c]));
      row.push(err);
      sumAbs += err;
      sumSq += err * err;
      if (err > maxErr) maxErr = err;
      count++;
    }
    errors.push(row);
  }

  return {
    errors,
    maxError: round4(maxErr),
    meanError: round4(sumAbs / count),
    rmse: round4(Math.sqrt(sumSq / count)),
  };
}

/* ------------------------------------------------------------------ */
/*  Value-to-color helpers                                             */
/* ------------------------------------------------------------------ */

/** Blue for negative, emerald for positive, intensity by magnitude */
function valueToBg(v: number, maxAbs: number): string {
  const norm = maxAbs > 0 ? Math.min(Math.abs(v) / maxAbs, 1) : 0;
  const alpha = 0.08 + norm * 0.35;
  if (v >= 0) {
    return `rgba(52, 211, 153, ${alpha})`; // emerald
  }
  return `rgba(96, 165, 250, ${alpha})`; // blue
}

/** Red tint proportional to error magnitude */
function errorToBg(err: number, maxErr: number): string {
  if (maxErr === 0) return "rgba(255,255,255,0.04)";
  const norm = Math.min(err / maxErr, 1);
  const alpha = 0.05 + norm * 0.5;
  return `rgba(248, 113, 113, ${alpha})`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function QuantizationWidget() {
  const mounted = useClientMounted();

  /* ---- state ---- */
  const [seed, setSeed] = useState(42);
  const [bitWidth, setBitWidth] = useState<BitWidth>("INT8");
  const [showErrorHeatmap, setShowErrorHeatmap] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [flashCells, setFlashCells] = useState<Set<string>>(new Set());
  const [hoveredCell, setHoveredCell] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const [hasQuantized, setHasQuantized] = useState(true);
  const animRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---- derived data ---- */
  const original = generateWeights(seed);
  const { quantized, dequantized, scale, zeroPoint } = quantize(
    original,
    bitWidth
  );
  const { errors, maxError, meanError, rmse } = computeErrors(
    original,
    dequantized
  );

  // max absolute value for color scaling
  let maxAbs = 0;
  for (const row of original) {
    for (const v of row) {
      if (Math.abs(v) > maxAbs) maxAbs = Math.abs(v);
    }
  }

  const config = BIT_CONFIGS[bitWidth];

  // Accuracy retention estimate (simulated -- based on compression ratio)
  const accuracyRetained =
    bitWidth === "FP32"
      ? "100%"
      : bitWidth === "FP16"
        ? "~99.9%"
        : bitWidth === "INT8"
          ? "~99.1%"
          : "~97.5%";

  // Model size bars (normalized, assume original = 100%)
  const originalSizePct = 100;
  const quantizedSizePct = Math.round(100 / config.compression);

  /* ---- handlers ---- */
  const handleRandomize = useCallback(() => {
    setSeed((s) => s + 1);
    setHasQuantized(true);
  }, []);

  const handleQuantize = useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);
    setHasQuantized(false);

    // Animate cells flashing one by one
    const cells: string[] = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        cells.push(`${r}-${c}`);
      }
    }

    let i = 0;
    const tick = () => {
      if (i < cells.length) {
        setFlashCells(new Set([cells[i]]));
        i++;
        animRef.current = setTimeout(tick, 80);
      } else {
        setFlashCells(new Set());
        setIsAnimating(false);
        setHasQuantized(true);
      }
    };
    tick();
  }, [isAnimating]);

  /* Cleanup on unmount */
  useEffect(() => {
    return () => {
      if (animRef.current) clearTimeout(animRef.current);
    };
  }, []);

  /* ---- tooltip content ---- */
  const tooltipContent =
    hoveredCell && hasQuantized
      ? (() => {
          const { row, col } = hoveredCell;
          const orig = original[row][col];
          const quant = quantized[row][col];
          const deq = dequantized[row][col];
          const err = errors[row][col];
          return { orig, quant, deq, err };
        })()
      : null;

  /* ---- render ---- */
  if (!mounted) {
    return (
      <div
        className="widget-container bg-card border border-border rounded-xl p-6 my-8 overflow-hidden"
        style={{ minHeight: 520 }}
      />
    );
  }

  return (
    <div className="widget-container bg-card border border-border rounded-xl p-6 my-8 overflow-hidden">
      {/* Label */}
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-4 font-mono">
        Interactive &middot; Model Quantization
      </div>

      {/* Title + compression badge */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-lg font-semibold text-foreground m-0">
          Weight Quantization
        </h3>
        <div className="flex items-center gap-3 font-mono text-xs">
          <span className="text-muted-foreground">
            Compression{" "}
            <span
              className="font-semibold"
              style={{ color: "#34d399" }}
            >
              {config.compression}x
            </span>
          </span>
          <span className="text-muted-foreground">
            Bits{" "}
            <span className="text-foreground font-semibold">
              {config.bits}
            </span>
          </span>
        </div>
      </div>

      {/* Bit-width selector */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(Object.keys(BIT_CONFIGS) as BitWidth[]).map((bw) => (
          <button
            key={bw}
            className={`btn-mono ${bitWidth === bw ? "active" : ""}`}
            onClick={() => {
              setBitWidth(bw);
              setHasQuantized(true);
            }}
            style={{
              borderColor: bitWidth === bw ? "#34d399" : undefined,
              color: bitWidth === bw ? "#34d399" : undefined,
            }}
          >
            {bw}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex gap-2 mb-5 flex-wrap">
        <button
          className={`btn-mono ${isAnimating ? "active" : ""}`}
          onClick={handleQuantize}
          disabled={isAnimating}
          style={{
            opacity: isAnimating ? 0.6 : 1,
            cursor: isAnimating ? "not-allowed" : "pointer",
            borderColor: isAnimating ? "#34d399" : undefined,
            color: isAnimating ? "#34d399" : undefined,
          }}
        >
          {isAnimating ? "Quantizing..." : "Quantize"}
        </button>
        <button className="btn-mono" onClick={handleRandomize}>
          Randomize Weights
        </button>
        <button
          className={`btn-mono ${showErrorHeatmap ? "active" : ""}`}
          onClick={() => setShowErrorHeatmap((v) => !v)}
          style={{
            borderColor: showErrorHeatmap ? "#f87171" : undefined,
            color: showErrorHeatmap ? "#f87171" : undefined,
          }}
        >
          {showErrorHeatmap ? "Hide Errors" : "Error Heatmap"}
        </button>
      </div>

      {/* Hover tooltip */}
      {tooltipContent && (
        <div
          className="mb-4 px-3 py-2 rounded-lg font-mono text-xs border border-border"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          <span className="text-muted-foreground">Original: </span>
          <span className="text-foreground">
            {tooltipContent.orig.toFixed(4)}
          </span>
          <span className="text-muted-foreground ml-3">
            Quantized:{" "}
          </span>
          <span style={{ color: "#34d399" }}>
            {bitWidth === "FP32"
              ? tooltipContent.quant.toFixed(4)
              : tooltipContent.quant}
          </span>
          <span className="text-muted-foreground ml-3">
            Dequantized:{" "}
          </span>
          <span className="text-foreground">
            {tooltipContent.deq.toFixed(4)}
          </span>
          <span className="text-muted-foreground ml-3">Error: </span>
          <span style={{ color: "#f87171" }}>
            {tooltipContent.err.toFixed(4)}
          </span>
        </div>
      )}

      {/* Matrices */}
      <div
        className="grid gap-4 mb-5"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        }}
      >
        {/* Original FP32 */}
        <div>
          <div className="text-xs text-muted-foreground font-mono mb-2 uppercase tracking-wider">
            Original (FP32)
          </div>
          <div
            className="rounded-lg overflow-hidden border border-border"
            style={{ background: "rgba(255,255,255,0.02)" }}
          >
            {original.map((row, ri) => (
              <div key={ri} className="flex">
                {row.map((val, ci) => {
                  const cellKey = `${ri}-${ci}`;
                  const isFlashing = flashCells.has(cellKey);
                  const isHovered =
                    hoveredCell?.row === ri &&
                    hoveredCell?.col === ci;
                  return (
                    <div
                      key={ci}
                      className="flex-1 text-center font-mono transition-all duration-150"
                      style={{
                        padding: "6px 2px",
                        fontSize: "0.65rem",
                        background: isFlashing
                          ? "rgba(52, 211, 153, 0.4)"
                          : valueToBg(val, maxAbs),
                        borderRight:
                          ci < 3
                            ? "1px solid rgba(255,255,255,0.06)"
                            : "none",
                        borderBottom:
                          ri < 3
                            ? "1px solid rgba(255,255,255,0.06)"
                            : "none",
                        color: "#e4e4e7",
                        outline: isHovered
                          ? "2px solid #34d399"
                          : "none",
                        outlineOffset: "-2px",
                        cursor: "crosshair",
                      }}
                      onMouseEnter={() =>
                        setHoveredCell({ row: ri, col: ci })
                      }
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      {val.toFixed(4)}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Quantized */}
        <div>
          <div className="text-xs text-muted-foreground font-mono mb-2 uppercase tracking-wider">
            Quantized ({config.label})
          </div>
          <div
            className="rounded-lg overflow-hidden border border-border"
            style={{ background: "rgba(255,255,255,0.02)" }}
          >
            {quantized.map((row, ri) => (
              <div key={ri} className="flex">
                {row.map((val, ci) => {
                  const cellKey = `${ri}-${ci}`;
                  const isFlashing = flashCells.has(cellKey);
                  const isHovered =
                    hoveredCell?.row === ri &&
                    hoveredCell?.col === ci;
                  // Normalize quantized value for color
                  const maxLevel = config.levels - 1;
                  const norm =
                    bitWidth === "FP32"
                      ? 0.5
                      : isFinite(maxLevel)
                        ? val / maxLevel
                        : 0.5;
                  const alpha = 0.1 + norm * 0.35;
                  return (
                    <div
                      key={ci}
                      className="flex-1 text-center font-mono transition-all duration-150"
                      style={{
                        padding: "6px 2px",
                        fontSize: "0.65rem",
                        background: isFlashing
                          ? "rgba(52, 211, 153, 0.5)"
                          : `rgba(52, 211, 153, ${alpha})`,
                        borderRight:
                          ci < 3
                            ? "1px solid rgba(255,255,255,0.06)"
                            : "none",
                        borderBottom:
                          ri < 3
                            ? "1px solid rgba(255,255,255,0.06)"
                            : "none",
                        color: "#e4e4e7",
                        fontWeight: 600,
                        outline: isHovered
                          ? "2px solid #34d399"
                          : "none",
                        outlineOffset: "-2px",
                        cursor: "crosshair",
                      }}
                      onMouseEnter={() =>
                        setHoveredCell({ row: ri, col: ci })
                      }
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      {bitWidth === "FP32"
                        ? val.toFixed(4)
                        : val}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Dequantized / Error Heatmap */}
        <div>
          <div className="text-xs text-muted-foreground font-mono mb-2 uppercase tracking-wider">
            {showErrorHeatmap ? "Error Heatmap" : "Dequantized"}
          </div>
          <div
            className="rounded-lg overflow-hidden border border-border"
            style={{ background: "rgba(255,255,255,0.02)" }}
          >
            {(showErrorHeatmap ? errors : dequantized).map(
              (row, ri) => (
                <div key={ri} className="flex">
                  {row.map((val, ci) => {
                    const cellKey = `${ri}-${ci}`;
                    const isFlashing = flashCells.has(cellKey);
                    const isHovered =
                      hoveredCell?.row === ri &&
                      hoveredCell?.col === ci;
                    const bg = showErrorHeatmap
                      ? errorToBg(val, maxError)
                      : isFlashing
                        ? "rgba(52, 211, 153, 0.4)"
                        : valueToBg(val, maxAbs);
                    return (
                      <div
                        key={ci}
                        className="flex-1 text-center font-mono transition-all duration-150"
                        style={{
                          padding: "6px 2px",
                          fontSize: "0.65rem",
                          background: bg,
                          borderRight:
                            ci < 3
                              ? "1px solid rgba(255,255,255,0.06)"
                              : "none",
                          borderBottom:
                            ri < 3
                              ? "1px solid rgba(255,255,255,0.06)"
                              : "none",
                          color: showErrorHeatmap
                            ? "#fca5a5"
                            : "#e4e4e7",
                          outline: isHovered
                            ? "2px solid #34d399"
                            : "none",
                          outlineOffset: "-2px",
                          cursor: "crosshair",
                        }}
                        onMouseEnter={() =>
                          setHoveredCell({ row: ri, col: ci })
                        }
                        onMouseLeave={() => setHoveredCell(null)}
                      >
                        {val.toFixed(4)}
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Quantization parameters */}
      {bitWidth !== "FP32" && (
        <div
          className="mb-5 px-3 py-2 rounded-lg font-mono text-xs border border-border flex flex-wrap gap-x-5 gap-y-1"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          <span>
            <span className="text-muted-foreground">Scale: </span>
            <span className="text-foreground">{scale}</span>
          </span>
          <span>
            <span className="text-muted-foreground">
              Zero Point:{" "}
            </span>
            <span className="text-foreground">{zeroPoint}</span>
          </span>
          <span>
            <span className="text-muted-foreground">Levels: </span>
            <span className="text-foreground">{config.levels}</span>
          </span>
        </div>
      )}

      {/* Stats panel */}
      <div className="mb-5">
        <div className="text-xs text-muted-foreground font-mono mb-2 uppercase tracking-wider">
          Stats
        </div>
        <div
          className="rounded-lg border border-border p-4"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          {/* Model size bar chart */}
          <div className="mb-4">
            <div className="text-xs text-muted-foreground font-mono mb-2">
              Model Size Comparison
            </div>
            <div className="flex flex-col gap-2">
              {/* Original bar */}
              <div className="flex items-center gap-2">
                <span
                  className="font-mono text-xs text-muted-foreground"
                  style={{ minWidth: 72 }}
                >
                  Original
                </span>
                <div
                  className="flex-1 rounded-sm overflow-hidden"
                  style={{
                    height: 20,
                    background: "rgba(255,255,255,0.06)",
                  }}
                >
                  <div
                    className="h-full rounded-sm transition-all duration-500"
                    style={{
                      width: `${originalSizePct}%`,
                      background:
                        "rgba(96, 165, 250, 0.5)",
                    }}
                  />
                </div>
                <span
                  className="font-mono text-xs text-foreground"
                  style={{ minWidth: 40, textAlign: "right" }}
                >
                  100%
                </span>
              </div>
              {/* Quantized bar */}
              <div className="flex items-center gap-2">
                <span
                  className="font-mono text-xs text-muted-foreground"
                  style={{ minWidth: 72 }}
                >
                  {config.label}
                </span>
                <div
                  className="flex-1 rounded-sm overflow-hidden"
                  style={{
                    height: 20,
                    background: "rgba(255,255,255,0.06)",
                  }}
                >
                  <div
                    className="h-full rounded-sm transition-all duration-500"
                    style={{
                      width: `${quantizedSizePct}%`,
                      background:
                        "rgba(52, 211, 153, 0.6)",
                    }}
                  />
                </div>
                <span
                  className="font-mono text-xs"
                  style={{
                    minWidth: 40,
                    textAlign: "right",
                    color: "#34d399",
                  }}
                >
                  {quantizedSizePct}%
                </span>
              </div>
            </div>
          </div>

          {/* Error metrics */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <div className="text-xs text-muted-foreground font-mono mb-1">
                Max Error
              </div>
              <div
                className="font-mono text-sm font-semibold"
                style={{ color: "#f87171" }}
              >
                {maxError.toFixed(4)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-mono mb-1">
                Mean Error
              </div>
              <div
                className="font-mono text-sm font-semibold"
                style={{ color: "#fbbf24" }}
              >
                {meanError.toFixed(4)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-mono mb-1">
                RMSE
              </div>
              <div
                className="font-mono text-sm font-semibold"
                style={{ color: "#fb923c" }}
              >
                {rmse.toFixed(4)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-mono mb-1">
                Accuracy
              </div>
              <div
                className="font-mono text-sm font-semibold"
                style={{ color: "#34d399" }}
              >
                {accuracyRetained}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Key insight callout */}
      <div
        className="rounded-lg px-4 py-3 font-mono text-xs border"
        style={{
          background: "rgba(52, 211, 153, 0.06)",
          borderColor: "rgba(52, 211, 153, 0.2)",
          color: "#a7f3d0",
        }}
      >
        <span
          style={{ color: "#34d399", fontWeight: 600 }}
        >
          Key insight:
        </span>{" "}
        INT8 quantization typically retains 99%+ accuracy while reducing model
        size by 4x
      </div>
    </div>
  );
}
