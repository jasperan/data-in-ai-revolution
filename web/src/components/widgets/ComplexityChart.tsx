"use client";

import { useMemo, useState } from "react";

export type Complexity = "O(1)" | "O(log n)" | "O(n)" | "O(n log n)" | "O(n^2)" | "O(2^n)";

export type Curve = {
  label: string;
  complexity: Complexity;
  color: string;
  space?: string;
};

export type ComplexityChartProps = {
  curves: Curve[];
  nRange?: [number, number];
  label?: string;
};

const SAFE_MAX = Number.MAX_SAFE_INTEGER;

function opsAt(complexity: Complexity, n: number): number {
  if (n <= 0) return 0;
  switch (complexity) {
    case "O(1)": return 1;
    case "O(log n)": return Math.log2(Math.max(n, 1));
    case "O(n)": return n;
    case "O(n log n)": return n * Math.log2(Math.max(n, 1));
    case "O(n^2)": return n * n;
    case "O(2^n)": {
      if (n >= 53) return SAFE_MAX;
      return Math.pow(2, n);
    }
  }
}

function formatOps(value: number): string {
  if (value >= SAFE_MAX) return "> 2^53";
  if (value < 10) return value.toFixed(2).replace(/\.?0+$/, "");
  return Math.round(value).toLocaleString();
}

export default function ComplexityChart({
  curves,
  nRange = [1, 100],
  label = "Complexity Comparison",
}: ComplexityChartProps) {
  const [n, setN] = useState(Math.floor((nRange[0] + nRange[1]) / 2));
  const [scale, setScale] = useState<"linear" | "log">("linear");
  const [visible, setVisible] = useState<Set<string>>(() => new Set(curves.map((c) => c.label)));

  const visibleCurves = curves.filter((c) => visible.has(c.label));

  const samples = 60;
  const W = 600;
  const H = 360;
  const padL = 40, padR = 16, padT = 16, padB = 32;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const xs = useMemo(
    () => Array.from({ length: samples }, (_, i) => nRange[0] + (i / (samples - 1)) * (nRange[1] - nRange[0])),
    [nRange]
  );

  const transformY = (v: number, maxY: number) => {
    if (scale === "log") {
      const lv = Math.log10(Math.max(v, 0) + 1);
      const lmax = Math.log10(maxY + 1);
      return padT + innerH - (lv / lmax) * innerH;
    }
    return padT + innerH - (v / maxY) * innerH;
  };

  const transformX = (nv: number) =>
    padL + ((nv - nRange[0]) / (nRange[1] - nRange[0])) * innerW;

  const maxY = useMemo(() => {
    let m = 1;
    for (const c of visibleCurves) {
      for (const x of xs) {
        const y = opsAt(c.complexity, x);
        if (y < SAFE_MAX && y > m) m = y;
      }
    }
    return m;
  }, [visibleCurves, xs]);

  return (
    <div className="widget-container bg-card border border-border rounded-xl p-6 my-8 overflow-hidden">
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-4 font-mono">
        Interactive · {label}
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <button
          className={`btn-mono ${scale === "linear" ? "active" : ""}`}
          onClick={() => setScale("linear")}
        >
          LIN
        </button>
        <button
          className={`btn-mono ${scale === "log" ? "active" : ""}`}
          onClick={() => setScale("log")}
        >
          LOG
        </button>
        <div className="flex-1" />
        {curves.map((c) => (
          <button
            key={c.label}
            className={`btn-mono ${visible.has(c.label) ? "active" : ""}`}
            onClick={() => {
              setVisible((s) => {
                const next = new Set(s);
                if (next.has(c.label)) next.delete(c.label); else next.add(c.label);
                return next;
              });
            }}
            style={{ borderColor: visible.has(c.label) ? c.color : undefined, color: visible.has(c.label) ? c.color : undefined }}
          >
            {c.label}
          </button>
        ))}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={label}>
        <rect x={padL} y={padT} width={innerW} height={innerH} fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.06)" />
        <line x1={padL} y1={padT + innerH} x2={padL + innerW} y2={padT + innerH} stroke="rgba(255,255,255,0.2)" />
        <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="rgba(255,255,255,0.2)" />

        {visibleCurves.length === 0 ? (
          <text x={W / 2} y={H / 2} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="14">
            Enable at least one curve.
          </text>
        ) : (
          visibleCurves.map((c) => {
            const points = xs.map((x) => {
              const y = opsAt(c.complexity, x);
              const yClamped = Math.min(y, maxY);
              return `${transformX(x).toFixed(2)},${transformY(yClamped, maxY).toFixed(2)}`;
            });
            const d = "M " + points.join(" L ");
            const atN = opsAt(c.complexity, n);
            const atNClamped = Math.min(atN, maxY);
            return (
              <g key={c.label}>
                <path d={d} fill="none" stroke={c.color} strokeWidth={2} />
                <circle cx={transformX(n)} cy={transformY(atNClamped, maxY)} r={4} fill={c.color} />
              </g>
            );
          })
        )}

        <line
          x1={transformX(n)}
          y1={padT}
          x2={transformX(n)}
          y2={padT + innerH}
          stroke="rgba(255,255,255,0.3)"
          strokeDasharray="4 4"
        />
        <text x={transformX(n)} y={padT + innerH + 20} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="11" fontFamily="monospace">
          n = {n}
        </text>
      </svg>

      <input
        type="range"
        min={nRange[0]}
        max={nRange[1]}
        value={n}
        onChange={(e) => setN(Number(e.target.value))}
        className="w-full mt-2"
        aria-label="Input size n"
      />

      <table className="w-full mt-4 text-sm font-mono">
        <thead>
          <tr className="text-xs text-muted-foreground uppercase tracking-wider">
            <th className="text-left py-1">algo</th>
            <th className="text-left py-1">time</th>
            <th className="text-left py-1">space</th>
            <th className="text-right py-1">ops at n={n}</th>
          </tr>
        </thead>
        <tbody>
          {curves.map((c) => (
            <tr key={c.label} className="border-t border-border">
              <td className="py-1.5" style={{ color: c.color }}>{c.label}</td>
              <td className="py-1.5">{c.complexity}</td>
              <td className="py-1.5 text-muted-foreground">{c.space ?? "—"}</td>
              <td className="py-1.5 text-right">{formatOps(opsAt(c.complexity, n))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
