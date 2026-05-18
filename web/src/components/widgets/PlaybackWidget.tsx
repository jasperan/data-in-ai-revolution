"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type PlaybackStep = {
  line: number;
  vars: Record<string, unknown>;
  stack?: string[];
  heap?: Record<string, unknown>;
  note?: string;
};

export type PlaybackTrace = {
  source: string;
  steps: PlaybackStep[];
};

export type PlaybackWidgetProps = {
  trace: PlaybackTrace;
  label?: string;
};

const SPEEDS = [0.5, 1, 2] as const;
type Speed = (typeof SPEEDS)[number];

function safeStringify(value: unknown): string {
  if (typeof value === "function") return "[function]";
  try {
    return JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() + "n" : v));
  } catch {
    return String(value);
  }
}

function diffKeys(prev: Record<string, unknown> | undefined, next: Record<string, unknown>): Set<string> {
  const changed = new Set<string>();
  for (const k of Object.keys(next)) {
    if (!prev || safeStringify(prev[k]) !== safeStringify(next[k])) changed.add(k);
  }
  return changed;
}

export default function PlaybackWidget({ trace, label = "Code Playback" }: PlaybackWidgetProps) {
  const total = trace.steps.length;
  const [stepIndex, setStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const step = total > 0 ? trace.steps[Math.min(stepIndex, total - 1)] : null;
  const prevStep = total > 0 && stepIndex > 0 ? trace.steps[stepIndex - 1] : undefined;
  const changedVars = useMemo(
    () => (step ? diffKeys(prevStep?.vars, step.vars) : new Set<string>()),
    [step, prevStep]
  );

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  useEffect(() => {
    if (!isPlaying || total === 0) return;
    const interval = 800 / speed;
    timerRef.current = setInterval(() => {
      setStepIndex((i) => {
        if (i >= total - 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          setIsPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, interval);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [isPlaying, speed, total]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight") {
        setStepIndex((i) => Math.min(i + 1, total - 1));
      } else if (e.key === "ArrowLeft") {
        setStepIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === " ") {
        e.preventDefault();
        setIsPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total]);

  if (total === 0) {
    return (
      <div className="widget-container bg-card border border-border rounded-xl p-6 my-8 overflow-hidden">
        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-4 font-mono">
          Interactive · {label}
        </div>
        <p className="text-muted-foreground text-sm">No trace provided.</p>
      </div>
    );
  }

  const sourceLines = trace.source.split("\n");

  return (
    <div className="widget-container bg-card border border-border rounded-xl p-6 my-8 overflow-hidden">
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-4 font-mono">
        Interactive · {label}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border rounded-lg overflow-hidden">
        <pre className="bg-card p-4 m-0 font-mono text-sm leading-6 overflow-x-auto">
          {sourceLines.map((line, i) => {
            const lineNum = i + 1;
            const isActive = step!.line === lineNum;
            return (
              <div
                key={i}
                className={
                  isActive
                    ? "bg-cyan-400/15 transition-colors duration-200 -mx-4 px-4"
                    : "transition-colors duration-200 -mx-4 px-4"
                }
              >
                <span className="text-muted-foreground select-none mr-3">{String(lineNum).padStart(2, " ")}</span>
                <span>{line || " "}</span>
              </div>
            );
          })}
        </pre>
        <div className="bg-card p-4 font-mono text-sm space-y-3">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">vars</div>
            {Object.keys(step!.vars).length === 0 ? (
              <div className="text-muted-foreground">—</div>
            ) : (
              Object.entries(step!.vars).map(([k, v]) => (
                <div key={k} className={changedVars.has(k) ? "pulse-highlight rounded px-1" : "px-1"}>
                  <span className="json-key">{k}</span>
                  <span className="json-bracket">: </span>
                  <span>{safeStringify(v)}</span>
                </div>
              ))
            )}
          </div>
          {step!.stack && step!.stack.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">stack</div>
              {step!.stack.map((frame, i) => (
                <div key={i}>{frame}</div>
              ))}
            </div>
          )}
          {step!.heap && Object.keys(step!.heap).length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">heap</div>
              {Object.entries(step!.heap).map(([k, v]) => (
                <div key={k}>
                  <span className="json-key">{k}</span>
                  <span className="json-bracket">: </span>
                  <span>{safeStringify(v)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {step!.note && (
        <p className="text-sm text-muted-foreground mt-3 italic">{step!.note}</p>
      )}

      <div className="playback-controls mt-4">
        <button className="btn-mono playback-btn" onClick={() => setStepIndex(0)} aria-label="First step">⏮</button>
        <button className="btn-mono playback-btn" onClick={() => setStepIndex((i) => Math.max(i - 1, 0))} aria-label="Previous step">◀</button>
        <button
          className="btn-mono playback-btn"
          onClick={() => {
            if (stepIndex >= total - 1) setStepIndex(0);
            setIsPlaying((p) => !p);
          }}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? "⏸" : "▶"}
        </button>
        <button className="btn-mono playback-btn" onClick={() => setStepIndex((i) => Math.min(i + 1, total - 1))} aria-label="Next step">▶</button>
        <button className="btn-mono playback-btn" onClick={() => { stop(); setStepIndex(total - 1); }} aria-label="Last step">⏭</button>
        <input
          type="range"
          min={0}
          max={total - 1}
          value={stepIndex}
          onChange={(e) => setStepIndex(Number(e.target.value))}
          className="playback-timeline"
          aria-label="Timeline"
        />
        <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
          {stepIndex + 1} / {total}
        </span>
        <select
          className="btn-mono"
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value) as Speed)}
          aria-label="Speed"
        >
          {SPEEDS.map((s) => (
            <option key={s} value={s}>{s}×</option>
          ))}
        </select>
      </div>
    </div>
  );
}
