"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */
type ArchMode = "encoder" | "decoder" | "enc-dec";

interface ComponentInfo {
  name: string;
  description: string;
  params: string[];
  inputShape: string;
  outputShape: string;
}

/* ------------------------------------------------------------------ */
/*  Component info database                                           */
/* ------------------------------------------------------------------ */
const COMPONENT_INFO: Record<string, ComponentInfo> = {
  "input-tokens": {
    name: "Input Tokens",
    description:
      "Raw text is split into tokens (subwords) and converted to integer IDs using a vocabulary lookup table.",
    params: ["Vocab size: 50,257", "Max seq length: 512"],
    inputShape: "string",
    outputShape: "[batch, seq_len] int64",
  },
  embedding: {
    name: "Token + Position Embedding",
    description:
      "Each token ID is mapped to a dense vector, then summed with a positional encoding so the model knows token order.",
    params: ["768 dimensions", "Learned positional encoding"],
    inputShape: "[batch, seq_len] int64",
    outputShape: "[batch, seq_len, 768]",
  },
  "multi-head-attention": {
    name: "Multi-Head Self-Attention",
    description:
      "Computes scaled dot-product attention across multiple heads in parallel, allowing the model to attend to different representation subspaces.",
    params: ["12 attention heads", "64 dims per head", "Q, K, V projections"],
    inputShape: "[batch, seq_len, 768]",
    outputShape: "[batch, seq_len, 768]",
  },
  "masked-attention": {
    name: "Masked Multi-Head Attention",
    description:
      "Same as multi-head attention but applies a causal mask so each token can only attend to previous tokens (autoregressive).",
    params: ["12 attention heads", "64 dims per head", "Causal mask applied"],
    inputShape: "[batch, seq_len, 768]",
    outputShape: "[batch, seq_len, 768]",
  },
  "cross-attention": {
    name: "Cross-Attention",
    description:
      "The decoder attends to the encoder output. Keys and Values come from the encoder; Queries come from the decoder.",
    params: ["12 attention heads", "K,V from encoder", "Q from decoder"],
    inputShape: "[batch, seq_len, 768] + encoder out",
    outputShape: "[batch, seq_len, 768]",
  },
  "add-norm": {
    name: "Add & Layer Norm",
    description:
      "Residual connection adds the sublayer input to its output, then layer normalization stabilizes training.",
    params: ["Layer normalization", "Residual skip connection"],
    inputShape: "[batch, seq_len, 768] x2",
    outputShape: "[batch, seq_len, 768]",
  },
  ffn: {
    name: "Feed-Forward Network",
    description:
      "Two linear transformations with a GELU activation in between. Expands dimensionality 4x then projects back down.",
    params: ["768 -> 3072 -> 768", "GELU activation"],
    inputShape: "[batch, seq_len, 768]",
    outputShape: "[batch, seq_len, 768]",
  },
  output: {
    name: "Output Head",
    description:
      "Final linear projection maps hidden states to vocabulary-sized logits. Softmax converts to probabilities.",
    params: ["Linear: 768 -> 50,257", "Softmax over vocab"],
    inputShape: "[batch, seq_len, 768]",
    outputShape: "[batch, seq_len, vocab_size]",
  },
  "encoder-output": {
    name: "Encoder Output",
    description:
      "The encoded representation of the input sequence, passed to the decoder via cross-attention layers.",
    params: ["Contextual embeddings", "Full bidirectional context"],
    inputShape: "[batch, seq_len, 768]",
    outputShape: "[batch, seq_len, 768]",
  },
};

/* ------------------------------------------------------------------ */
/*  SVG Layout constants                                              */
/* ------------------------------------------------------------------ */
const SVG_WIDTH = 680;
const BOX_W = 180;
const BOX_H = 32;
const LAYER_GAP = 8;
const BLOCK_GAP = 18;
const ACCENT = "#38bdf8";
const ACCENT_DIM = "rgba(56,189,248,0.15)";
const ACCENT_GLOW = "rgba(56,189,248,0.5)";
const TEXT_COLOR = "#e4e4e7";
const TEXT_MUTED = "#a1a1aa";
const BORDER_COLOR = "rgba(255,255,255,0.10)";
const BG_BOX = "#1a1a1f";
const BG_BLOCK = "rgba(255,255,255,0.02)";
const MASK_COLOR = "#f472b6";

/* ------------------------------------------------------------------ */
/*  Helper: build component list per layer for a mode                 */
/* ------------------------------------------------------------------ */
interface BlockComponent {
  id: string;
  label: string;
  color: string;
  infoKey: string;
}

function getBlockComponents(
  mode: ArchMode,
  side: "encoder" | "decoder"
): BlockComponent[] {
  if (mode === "encoder") {
    return [
      { id: "mha", label: "Multi-Head Attention", color: ACCENT, infoKey: "multi-head-attention" },
      { id: "an1", label: "Add & Norm", color: TEXT_MUTED, infoKey: "add-norm" },
      { id: "ffn", label: "Feed-Forward Network", color: "#a78bfa", infoKey: "ffn" },
      { id: "an2", label: "Add & Norm", color: TEXT_MUTED, infoKey: "add-norm" },
    ];
  }
  if (mode === "decoder") {
    return [
      { id: "mma", label: "Masked Attention", color: MASK_COLOR, infoKey: "masked-attention" },
      { id: "an1", label: "Add & Norm", color: TEXT_MUTED, infoKey: "add-norm" },
      { id: "ffn", label: "Feed-Forward Network", color: "#a78bfa", infoKey: "ffn" },
      { id: "an2", label: "Add & Norm", color: TEXT_MUTED, infoKey: "add-norm" },
    ];
  }
  // enc-dec
  if (side === "encoder") {
    return [
      { id: "mha", label: "Multi-Head Attention", color: ACCENT, infoKey: "multi-head-attention" },
      { id: "an1", label: "Add & Norm", color: TEXT_MUTED, infoKey: "add-norm" },
      { id: "ffn", label: "Feed-Forward Network", color: "#a78bfa", infoKey: "ffn" },
      { id: "an2", label: "Add & Norm", color: TEXT_MUTED, infoKey: "add-norm" },
    ];
  }
  // enc-dec decoder side
  return [
    { id: "mma", label: "Masked Attention", color: MASK_COLOR, infoKey: "masked-attention" },
    { id: "an1", label: "Add & Norm", color: TEXT_MUTED, infoKey: "add-norm" },
    { id: "xattn", label: "Cross-Attention", color: "#22d3ee", infoKey: "cross-attention" },
    { id: "an2", label: "Add & Norm", color: TEXT_MUTED, infoKey: "add-norm" },
    { id: "ffn", label: "Feed-Forward Network", color: "#a78bfa", infoKey: "ffn" },
    { id: "an3", label: "Add & Norm", color: TEXT_MUTED, infoKey: "add-norm" },
  ];
}

/* ------------------------------------------------------------------ */
/*  Compute SVG layout positions for all clickable regions            */
/* ------------------------------------------------------------------ */
interface LayoutRect {
  key: string;
  infoKey: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  color: string;
}

function computeLayout(
  mode: ArchMode,
  layerCount: number
): { rects: LayoutRect[]; totalHeight: number; flowStops: { x: number; y: number }[] } {
  const rects: LayoutRect[] = [];
  const flowStops: { x: number; y: number }[] = [];

  if (mode === "enc-dec") {
    // Two columns
    const colGap = 40;
    const encX = SVG_WIDTH / 2 - BOX_W - colGap / 2;
    const decX = SVG_WIDTH / 2 + colGap / 2;
    let encY = 0;
    let decY = 0;

    // Encoder input
    rects.push({
      key: "enc-input",
      infoKey: "input-tokens",
      x: encX,
      y: encY,
      w: BOX_W,
      h: BOX_H,
      label: "Input Tokens",
      color: "#4ade80",
    });
    encY += BOX_H + LAYER_GAP;

    // Encoder embedding
    rects.push({
      key: "enc-embed",
      infoKey: "embedding",
      x: encX,
      y: encY,
      w: BOX_W,
      h: BOX_H,
      label: "Embedding",
      color: "#fbbf24",
    });
    encY += BOX_H + BLOCK_GAP;

    // Encoder blocks
    const encComps = getBlockComponents(mode, "encoder");
    for (let layer = 0; layer < layerCount; layer++) {
      for (let c = 0; c < encComps.length; c++) {
        const comp = encComps[c];
        rects.push({
          key: `enc-L${layer}-${comp.id}`,
          infoKey: comp.infoKey,
          x: encX,
          y: encY,
          w: BOX_W,
          h: BOX_H,
          label: layer === 0 ? comp.label : comp.label,
          color: comp.color,
        });
        encY += BOX_H + LAYER_GAP;
      }
      encY += BLOCK_GAP - LAYER_GAP;
    }

    // Encoder output marker
    rects.push({
      key: "enc-out",
      infoKey: "encoder-output",
      x: encX,
      y: encY,
      w: BOX_W,
      h: BOX_H,
      label: "Encoder Output",
      color: "#22d3ee",
    });
    encY += BOX_H + LAYER_GAP;

    // Decoder input
    rects.push({
      key: "dec-input",
      infoKey: "input-tokens",
      x: decX,
      y: decY,
      w: BOX_W,
      h: BOX_H,
      label: "Target Tokens",
      color: "#4ade80",
    });
    decY += BOX_H + LAYER_GAP;

    // Decoder embedding
    rects.push({
      key: "dec-embed",
      infoKey: "embedding",
      x: decX,
      y: decY,
      w: BOX_W,
      h: BOX_H,
      label: "Embedding",
      color: "#fbbf24",
    });
    decY += BOX_H + BLOCK_GAP;

    // Decoder blocks
    const decComps = getBlockComponents(mode, "decoder");
    for (let layer = 0; layer < layerCount; layer++) {
      for (let c = 0; c < decComps.length; c++) {
        const comp = decComps[c];
        rects.push({
          key: `dec-L${layer}-${comp.id}`,
          infoKey: comp.infoKey,
          x: decX,
          y: decY,
          w: BOX_W,
          h: BOX_H,
          label: comp.label,
          color: comp.color,
        });
        decY += BOX_H + LAYER_GAP;
      }
      decY += BLOCK_GAP - LAYER_GAP;
    }

    // Decoder output
    rects.push({
      key: "dec-output",
      infoKey: "output",
      x: decX,
      y: decY,
      w: BOX_W,
      h: BOX_H,
      label: "Output Logits",
      color: "#f97316",
    });
    decY += BOX_H + LAYER_GAP;

    const totalHeight = Math.max(encY, decY) + 10;

    // Flow: goes up the decoder side
    const decRects = rects.filter((r) => r.key.startsWith("dec-") || r.key === "dec-output");
    for (const r of decRects) {
      flowStops.push({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
    }

    return { rects, totalHeight, flowStops };
  }

  // Single-column: encoder-only or decoder-only
  const cx = SVG_WIDTH / 2 - BOX_W / 2;
  let y = 0;

  // Input tokens
  rects.push({
    key: "input",
    infoKey: "input-tokens",
    x: cx,
    y,
    w: BOX_W,
    h: BOX_H,
    label: "Input Tokens",
    color: "#4ade80",
  });
  flowStops.push({ x: cx + BOX_W / 2, y: y + BOX_H / 2 });
  y += BOX_H + LAYER_GAP;

  // Embedding
  rects.push({
    key: "embed",
    infoKey: "embedding",
    x: cx,
    y,
    w: BOX_W,
    h: BOX_H,
    label: "Embedding",
    color: "#fbbf24",
  });
  flowStops.push({ x: cx + BOX_W / 2, y: y + BOX_H / 2 });
  y += BOX_H + BLOCK_GAP;

  // Transformer blocks
  const components = getBlockComponents(mode, mode === "encoder" ? "encoder" : "decoder");
  for (let layer = 0; layer < layerCount; layer++) {
    for (let c = 0; c < components.length; c++) {
      const comp = components[c];
      rects.push({
        key: `L${layer}-${comp.id}`,
        infoKey: comp.infoKey,
        x: cx,
        y,
        w: BOX_W,
        h: BOX_H,
        label: comp.label,
        color: comp.color,
      });
      flowStops.push({ x: cx + BOX_W / 2, y: y + BOX_H / 2 });
      y += BOX_H + LAYER_GAP;
    }
    y += BLOCK_GAP - LAYER_GAP;
  }

  // Output
  rects.push({
    key: "output",
    infoKey: "output",
    x: cx,
    y,
    w: BOX_W,
    h: BOX_H,
    label: "Output Logits",
    color: "#f97316",
  });
  flowStops.push({ x: cx + BOX_W / 2, y: y + BOX_H / 2 });
  y += BOX_H + LAYER_GAP;

  return { rects, totalHeight: y + 10, flowStops };
}

/* ------------------------------------------------------------------ */
/*  Layer bracket labels                                              */
/* ------------------------------------------------------------------ */
function getBlockBrackets(
  mode: ArchMode,
  layerCount: number,
  rects: LayoutRect[]
): { x: number; yTop: number; yBot: number; label: string; side: "left" | "right" }[] {
  const brackets: { x: number; yTop: number; yBot: number; label: string; side: "left" | "right" }[] = [];

  if (mode === "enc-dec") {
    // Encoder blocks
    for (let layer = 0; layer < layerCount; layer++) {
      const layerRects = rects.filter((r) => r.key.startsWith(`enc-L${layer}-`));
      if (layerRects.length > 0) {
        const first = layerRects[0];
        const last = layerRects[layerRects.length - 1];
        brackets.push({
          x: first.x - 8,
          yTop: first.y,
          yBot: last.y + last.h,
          label: `Layer ${layer + 1}`,
          side: "left",
        });
      }
    }
    // Decoder blocks
    for (let layer = 0; layer < layerCount; layer++) {
      const layerRects = rects.filter((r) => r.key.startsWith(`dec-L${layer}-`));
      if (layerRects.length > 0) {
        const first = layerRects[0];
        const last = layerRects[layerRects.length - 1];
        brackets.push({
          x: first.x + first.w + 8,
          yTop: first.y,
          yBot: last.y + last.h,
          label: `Layer ${layer + 1}`,
          side: "right",
        });
      }
    }
  } else {
    for (let layer = 0; layer < layerCount; layer++) {
      const layerRects = rects.filter((r) => r.key.startsWith(`L${layer}-`));
      if (layerRects.length > 0) {
        const first = layerRects[0];
        const last = layerRects[layerRects.length - 1];
        brackets.push({
          x: first.x - 8,
          yTop: first.y,
          yBot: last.y + last.h,
          label: `Layer ${layer + 1}`,
          side: "left",
        });
      }
    }
  }

  return brackets;
}

/* ------------------------------------------------------------------ */
/*  Main Widget                                                       */
/* ------------------------------------------------------------------ */
export function TransformerArchWidget() {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<ArchMode>("decoder");
  const [layerCount, setLayerCount] = useState(2);
  const [selected, setSelected] = useState<string | null>(null);
  const [animating, setAnimating] = useState(false);
  const [animProgress, setAnimProgress] = useState(0);
  const animRef = useRef<number>(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { rects, totalHeight, flowStops } = computeLayout(mode, layerCount);
  const brackets = getBlockBrackets(mode, layerCount, rects);
  const svgPad = 50;
  const svgH = totalHeight + svgPad * 2;

  // Selected component info
  const selectedRect = rects.find((r) => r.key === selected);
  const selectedInfo = selectedRect ? COMPONENT_INFO[selectedRect.infoKey] : null;

  const handleSelect = useCallback(
    (key: string) => {
      setSelected((prev) => (prev === key ? null : key));
    },
    []
  );

  // Animation
  const startAnimation = useCallback(() => {
    if (animating) return;
    setAnimating(true);
    setAnimProgress(0);
    const startTime = performance.now();
    const duration = 2500;
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      setAnimProgress(progress);
      if (progress < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        setAnimating(false);
      }
    };
    animRef.current = requestAnimationFrame(tick);
  }, [animating]);

  useEffect(() => {
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  // Compute glow dot position along flow stops
  const glowPos = (() => {
    if (!animating || flowStops.length < 2) return null;
    const totalStops = flowStops.length;
    const idx = animProgress * (totalStops - 1);
    const lower = Math.floor(idx);
    const upper = Math.min(lower + 1, totalStops - 1);
    const t = idx - lower;
    return {
      x: flowStops[lower].x + (flowStops[upper].x - flowStops[lower].x) * t,
      y: flowStops[lower].y + (flowStops[upper].y - flowStops[lower].y) * t + svgPad,
    };
  })();

  // Mode descriptions
  const modeDesc: Record<ArchMode, string> = {
    encoder:
      "Encoder-Only (BERT-style): bidirectional attention sees all tokens at once. Best for classification, NER, and understanding tasks.",
    decoder:
      "Decoder-Only (GPT-style): causal masked attention means each token only sees previous tokens. Best for text generation.",
    "enc-dec":
      "Encoder-Decoder (T5-style): encoder reads input bidirectionally, decoder generates output autoregressively with cross-attention. Best for translation and summarization.",
  };

  if (!mounted) {
    return (
      <div
        className="widget-container bg-card border border-border rounded-xl p-6 my-8 overflow-hidden"
        style={{ minHeight: 400 }}
      >
        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-4 font-mono">
          Interactive &middot; Transformer Architecture
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
          Loading transformer...
        </div>
      </div>
    );
  }

  return (
    <div className="widget-container bg-card border border-border rounded-xl p-6 my-8 overflow-hidden">
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-4 font-mono">
        Interactive &middot; Transformer Architecture
      </div>

      {/* Mode toggles */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <button
          className={`btn-mono ${mode === "encoder" ? "active" : ""}`}
          onClick={() => { setMode("encoder"); setSelected(null); }}
        >
          Encoder-Only
        </button>
        <button
          className={`btn-mono ${mode === "decoder" ? "active" : ""}`}
          onClick={() => { setMode("decoder"); setSelected(null); }}
        >
          Decoder-Only
        </button>
        <button
          className={`btn-mono ${mode === "enc-dec" ? "active" : ""}`}
          onClick={() => { setMode("enc-dec"); setSelected(null); }}
        >
          Encoder-Decoder
        </button>
      </div>

      {/* Mode description */}
      <div
        style={{
          fontSize: "0.75rem",
          color: "var(--muted-foreground)",
          fontFamily: "var(--font-mono)",
          marginBottom: 16,
          lineHeight: 1.5,
        }}
      >
        {modeDesc[mode]}
      </div>

      {/* Controls row */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 16,
          marginBottom: 16,
        }}
      >
        {/* Layer slider */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 200px" }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.72rem",
              color: "var(--muted-foreground)",
              whiteSpace: "nowrap",
            }}
          >
            Layers: {layerCount}
          </span>
          <input
            type="range"
            min={1}
            max={6}
            value={layerCount}
            onChange={(e) => {
              setLayerCount(Number(e.target.value));
              setSelected(null);
            }}
            style={{ flex: 1, minWidth: 100 }}
          />
        </div>

        {/* Play button */}
        <button
          className="btn-mono"
          onClick={startAnimation}
          disabled={animating}
          style={{
            opacity: animating ? 0.5 : 1,
            borderColor: animating ? ACCENT : undefined,
            color: animating ? ACCENT : undefined,
          }}
        >
          {animating ? "Flowing..." : "Play Flow"}
        </button>
      </div>

      {/* Main area: SVG + info panel */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {/* SVG diagram */}
        <div style={{ flex: "1 1 400px", overflowX: "auto" }}>
          <svg
            width="100%"
            viewBox={`0 0 ${SVG_WIDTH} ${svgH}`}
            style={{ maxWidth: SVG_WIDTH, display: "block" }}
          >
            <defs>
              <filter id="glow-filter">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="box-glow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <g transform={`translate(0, ${svgPad})`}>
              {/* Connection lines between consecutive rects */}
              {rects.map((rect, i) => {
                if (i === 0) return null;
                const prev = rects[i - 1];
                // Only draw line if they share the same column prefix
                const prevPrefix = prev.key.split("-")[0];
                const curPrefix = rect.key.split("-")[0];
                // For single col modes, everything connects
                if (mode !== "enc-dec") {
                  return (
                    <line
                      key={`line-${i}`}
                      x1={prev.x + prev.w / 2}
                      y1={prev.y + prev.h}
                      x2={rect.x + rect.w / 2}
                      y2={rect.y}
                      stroke={BORDER_COLOR}
                      strokeWidth={1.5}
                    />
                  );
                }
                // Enc-dec: connect within same side
                const prevSide = prev.key.startsWith("enc") ? "enc" : "dec";
                const curSide = rect.key.startsWith("enc") ? "enc" : "dec";
                if (prevSide === curSide && prevPrefix !== undefined && curPrefix !== undefined) {
                  return (
                    <line
                      key={`line-${i}`}
                      x1={prev.x + prev.w / 2}
                      y1={prev.y + prev.h}
                      x2={rect.x + rect.w / 2}
                      y2={rect.y}
                      stroke={BORDER_COLOR}
                      strokeWidth={1.5}
                    />
                  );
                }
                return null;
              })}

              {/* Enc-dec: cross-attention arrow from encoder output to decoder cross-attn */}
              {mode === "enc-dec" && (() => {
                const encOut = rects.find((r) => r.key === "enc-out");
                const crossAttns = rects.filter((r) => r.key.includes("xattn"));
                if (!encOut || crossAttns.length === 0) return null;
                return crossAttns.map((ca, i) => (
                  <g key={`xarrow-${i}`}>
                    <line
                      x1={encOut.x + encOut.w}
                      y1={encOut.y + encOut.h / 2}
                      x2={ca.x}
                      y2={ca.y + ca.h / 2}
                      stroke="rgba(34,211,238,0.3)"
                      strokeWidth={1.5}
                      strokeDasharray="6,4"
                    />
                    {/* arrowhead */}
                    <polygon
                      points={`${ca.x},${ca.y + ca.h / 2} ${ca.x - 7},${ca.y + ca.h / 2 - 4} ${ca.x - 7},${ca.y + ca.h / 2 + 4}`}
                      fill="rgba(34,211,238,0.5)"
                    />
                  </g>
                ));
              })()}

              {/* Layer brackets */}
              {brackets.map((b, i) => {
                const bx = b.side === "left" ? b.x - 18 : b.x + 18;
                const indent = b.side === "left" ? -6 : 6;
                return (
                  <g key={`bracket-${i}`}>
                    <path
                      d={`M ${bx + indent} ${b.yTop} L ${bx} ${b.yTop} L ${bx} ${b.yBot} L ${bx + indent} ${b.yBot}`}
                      fill="none"
                      stroke="rgba(255,255,255,0.08)"
                      strokeWidth={1}
                    />
                    <text
                      x={bx + (b.side === "left" ? -4 : 4)}
                      y={(b.yTop + b.yBot) / 2}
                      textAnchor={b.side === "left" ? "end" : "start"}
                      dominantBaseline="middle"
                      fill="rgba(255,255,255,0.15)"
                      fontSize={9}
                      fontFamily="var(--font-mono)"
                    >
                      {b.label}
                    </text>
                  </g>
                );
              })}

              {/* Column headers for enc-dec */}
              {mode === "enc-dec" && (() => {
                const encRect = rects.find((r) => r.key === "enc-input");
                const decRect = rects.find((r) => r.key === "dec-input");
                if (!encRect || !decRect) return null;
                return (
                  <>
                    <text
                      x={encRect.x + encRect.w / 2}
                      y={-16}
                      textAnchor="middle"
                      fill={ACCENT}
                      fontSize={12}
                      fontFamily="var(--font-mono)"
                      fontWeight={600}
                    >
                      ENCODER
                    </text>
                    <text
                      x={decRect.x + decRect.w / 2}
                      y={-16}
                      textAnchor="middle"
                      fill={MASK_COLOR}
                      fontSize={12}
                      fontFamily="var(--font-mono)"
                      fontWeight={600}
                    >
                      DECODER
                    </text>
                  </>
                );
              })()}

              {/* Component boxes */}
              {rects.map((rect) => {
                const isSelected = selected === rect.key;
                const borderCol = isSelected ? ACCENT : BORDER_COLOR;
                return (
                  <g
                    key={rect.key}
                    onClick={() => handleSelect(rect.key)}
                    style={{ cursor: "pointer" }}
                  >
                    {/* Background block highlight for transformer layers */}
                    {/* Selected glow */}
                    {isSelected && (
                      <rect
                        x={rect.x - 3}
                        y={rect.y - 3}
                        width={rect.w + 6}
                        height={rect.h + 6}
                        rx={10}
                        fill="none"
                        stroke={ACCENT_GLOW}
                        strokeWidth={2}
                        filter="url(#box-glow)"
                      />
                    )}
                    <rect
                      x={rect.x}
                      y={rect.y}
                      width={rect.w}
                      height={rect.h}
                      rx={7}
                      fill={isSelected ? ACCENT_DIM : BG_BOX}
                      stroke={borderCol}
                      strokeWidth={isSelected ? 1.5 : 1}
                    />
                    {/* Left accent bar */}
                    <rect
                      x={rect.x}
                      y={rect.y}
                      width={3}
                      height={rect.h}
                      rx={1.5}
                      fill={rect.color}
                      opacity={isSelected ? 1 : 0.6}
                    />
                    <text
                      x={rect.x + 14}
                      y={rect.y + rect.h / 2}
                      dominantBaseline="central"
                      fill={isSelected ? TEXT_COLOR : TEXT_MUTED}
                      fontSize={11}
                      fontFamily="var(--font-mono)"
                      fontWeight={isSelected ? 600 : 400}
                    >
                      {rect.label}
                    </text>
                  </g>
                );
              })}
            </g>

            {/* Animated glow dot */}
            {glowPos && (
              <g filter="url(#glow-filter)">
                <circle cx={glowPos.x} cy={glowPos.y} r={6} fill={ACCENT} opacity={0.9} />
                <circle cx={glowPos.x} cy={glowPos.y} r={12} fill={ACCENT} opacity={0.2} />
                <circle cx={glowPos.x} cy={glowPos.y} r={3} fill="#fff" opacity={0.9} />
              </g>
            )}
          </svg>
        </div>

        {/* Info panel */}
        {selectedInfo && (
          <div
            className="animate-slide-in"
            style={{
              flex: "0 0 260px",
              background: "rgba(56,189,248,0.04)",
              border: `1px solid rgba(56,189,248,0.15)`,
              borderRadius: 10,
              padding: 16,
              fontFamily: "var(--font-mono)",
              fontSize: "0.72rem",
              lineHeight: 1.6,
              alignSelf: "flex-start",
            }}
          >
            <div
              style={{
                fontWeight: 700,
                color: ACCENT,
                fontSize: "0.82rem",
                marginBottom: 8,
              }}
            >
              {selectedInfo.name}
            </div>
            <div style={{ color: TEXT_COLOR, marginBottom: 12 }}>
              {selectedInfo.description}
            </div>

            <div
              style={{
                fontSize: "0.65rem",
                color: TEXT_MUTED,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: 4,
              }}
            >
              Parameters
            </div>
            <ul style={{ margin: 0, paddingLeft: 14, marginBottom: 12, color: TEXT_COLOR }}>
              {selectedInfo.params.map((p, i) => (
                <li key={i} style={{ marginBottom: 2 }}>{p}</li>
              ))}
            </ul>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "0.6rem",
                    color: TEXT_MUTED,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: 2,
                  }}
                >
                  Input
                </div>
                <div style={{ color: "#4ade80", fontSize: "0.65rem" }}>
                  {selectedInfo.inputShape}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: "0.6rem",
                    color: TEXT_MUTED,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: 2,
                  }}
                >
                  Output
                </div>
                <div style={{ color: "#f97316", fontSize: "0.65rem" }}>
                  {selectedInfo.outputShape}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Hint */}
      {!selected && (
        <div
          style={{
            marginTop: 12,
            fontFamily: "var(--font-mono)",
            fontSize: "0.7rem",
            color: "var(--muted-foreground)",
            textAlign: "center",
          }}
        >
          Click any component to inspect it &middot; Use &quot;Play Flow&quot; to animate data passing through
        </div>
      )}
    </div>
  );
}
