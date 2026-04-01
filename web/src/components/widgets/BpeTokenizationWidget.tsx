"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";

/* ------------------------------------------------------------------ */
/*  Color palette for token chips                                     */
/* ------------------------------------------------------------------ */
const TOKEN_COLORS = [
  "rgba(249,115,22,0.25)", // orange
  "rgba(34,211,238,0.25)", // cyan
  "rgba(167,139,250,0.25)", // purple
  "rgba(74,222,128,0.25)", // green
  "rgba(244,114,182,0.25)", // pink
  "rgba(251,191,36,0.25)", // yellow
  "rgba(56,189,248,0.25)", // sky
  "rgba(52,211,153,0.25)", // emerald
  "rgba(248,113,113,0.25)", // red
  "rgba(163,230,53,0.25)", // lime
];

const TOKEN_BORDERS = [
  "rgba(249,115,22,0.5)",
  "rgba(34,211,238,0.5)",
  "rgba(167,139,250,0.5)",
  "rgba(74,222,128,0.5)",
  "rgba(244,114,182,0.5)",
  "rgba(251,191,36,0.5)",
  "rgba(56,189,248,0.5)",
  "rgba(52,211,153,0.5)",
  "rgba(248,113,113,0.5)",
  "rgba(163,230,53,0.5)",
];

/* ------------------------------------------------------------------ */
/*  BPE helpers                                                       */
/* ------------------------------------------------------------------ */

/** Count frequency of every adjacent pair in the corpus. */
function countPairs(corpus: string[][]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const word of corpus) {
    for (let i = 0; i < word.length - 1; i++) {
      const pair = `${word[i]}\t${word[i + 1]}`;
      counts.set(pair, (counts.get(pair) ?? 0) + 1);
    }
  }
  return counts;
}

/** Apply one merge to the corpus: replace every occurrence of (a, b) with ab. */
function applyMerge(corpus: string[][], a: string, b: string): string[][] {
  return corpus.map((word) => {
    const merged: string[] = [];
    let i = 0;
    while (i < word.length) {
      if (i < word.length - 1 && word[i] === a && word[i + 1] === b) {
        merged.push(a + b);
        i += 2;
      } else {
        merged.push(word[i]);
        i += 1;
      }
    }
    return merged;
  });
}

/** Split input text into words (preserving spaces as leading markers). */
function textToCorpus(text: string): string[][] {
  // Split on word boundaries; prefix non-first words with a special space marker
  const words = text.split(/(\s+)/);
  const corpus: string[][] = [];
  for (const w of words) {
    if (w.length === 0) continue;
    // Each word becomes an array of characters
    corpus.push(w.split(""));
  }
  return corpus;
}

interface MergeRecord {
  pair: [string, string];
  merged: string;
  frequency: number;
  step: number;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

const DEFAULT_TEXT = "The lowest point of the lower ground";

export function BpeTokenizationWidget() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  /* ---- state ---- */
  const [inputText, setInputText] = useState(DEFAULT_TEXT);
  const [corpus, setCorpus] = useState<string[][]>(() =>
    textToCorpus(DEFAULT_TEXT)
  );
  const [merges, setMerges] = useState<MergeRecord[]>([]);
  const [stepCount, setStepCount] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [highlightedMerge, setHighlightedMerge] = useState<number | null>(null);
  const animRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---- vocabulary ---- */
  const vocabSet = new Set<string>();
  for (const word of corpus) {
    for (const token of word) {
      vocabSet.add(token);
    }
  }
  const vocabSize = vocabSet.size;

  /* ---- core step ---- */
  const doStep = useCallback((): boolean => {
    const pairs = countPairs(corpus);
    if (pairs.size === 0) {
      setIsDone(true);
      return false;
    }
    // Find the most frequent pair
    let bestPair = "";
    let bestFreq = 0;
    for (const [pair, freq] of pairs) {
      if (freq > bestFreq) {
        bestPair = pair;
        bestFreq = freq;
      }
    }
    if (bestFreq < 2) {
      // No pair occurs more than once; stop
      setIsDone(true);
      return false;
    }
    const [a, b] = bestPair.split("\t");
    const newCorpus = applyMerge(corpus, a, b);
    const newStep = stepCount + 1;
    setCorpus(newCorpus);
    setStepCount(newStep);
    setMerges((prev) => [
      ...prev,
      { pair: [a, b], merged: a + b, frequency: bestFreq, step: newStep },
    ]);
    setHighlightedMerge(newStep);
    return true;
  }, [corpus, stepCount]);

  /* We need a ref-based step for animation to avoid stale closures */
  const corpusRef = useRef(corpus);
  const stepCountRef = useRef(stepCount);
  const mergesRef = useRef(merges);

  useEffect(() => {
    corpusRef.current = corpus;
    stepCountRef.current = stepCount;
    mergesRef.current = merges;
  }, [corpus, stepCount, merges]);

  const doStepRef = useCallback((): boolean => {
    const currentCorpus = corpusRef.current;
    const pairs = countPairs(currentCorpus);
    if (pairs.size === 0) {
      setIsDone(true);
      return false;
    }
    let bestPair = "";
    let bestFreq = 0;
    for (const [pair, freq] of pairs) {
      if (freq > bestFreq) {
        bestPair = pair;
        bestFreq = freq;
      }
    }
    if (bestFreq < 2) {
      setIsDone(true);
      return false;
    }
    const [a, b] = bestPair.split("\t");
    const newCorpus = applyMerge(currentCorpus, a, b);
    const newStep = stepCountRef.current + 1;
    corpusRef.current = newCorpus;
    stepCountRef.current = newStep;
    setCorpus(newCorpus);
    setStepCount(newStep);
    const newMerge: MergeRecord = {
      pair: [a, b],
      merged: a + b,
      frequency: bestFreq,
      step: newStep,
    };
    mergesRef.current = [...mergesRef.current, newMerge];
    setMerges(mergesRef.current);
    setHighlightedMerge(newStep);
    return true;
  }, []);

  /* ---- handlers ---- */
  const handleStep = useCallback(() => {
    if (isDone || isAnimating) return;
    doStep();
  }, [doStep, isDone, isAnimating]);

  const handleAuto = useCallback(() => {
    if (isDone || isAnimating) return;
    setIsAnimating(true);

    const tick = () => {
      const continued = doStepRef();
      if (continued) {
        animRef.current = setTimeout(tick, 500);
      } else {
        setIsAnimating(false);
      }
    };
    tick();
  }, [isDone, isAnimating, doStepRef]);

  const handleReset = useCallback(() => {
    if (animRef.current) {
      clearTimeout(animRef.current);
      animRef.current = null;
    }
    setIsAnimating(false);
    const newCorpus = textToCorpus(inputText);
    setCorpus(newCorpus);
    corpusRef.current = newCorpus;
    setMerges([]);
    mergesRef.current = [];
    setStepCount(0);
    stepCountRef.current = 0;
    setIsDone(false);
    setHighlightedMerge(null);
  }, [inputText]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setInputText(val);
      if (animRef.current) {
        clearTimeout(animRef.current);
        animRef.current = null;
      }
      setIsAnimating(false);
      const newCorpus = textToCorpus(val);
      setCorpus(newCorpus);
      corpusRef.current = newCorpus;
      setMerges([]);
      mergesRef.current = [];
      setStepCount(0);
      stepCountRef.current = 0;
      setIsDone(false);
      setHighlightedMerge(null);
    },
    []
  );

  /* Cleanup on unmount */
  useEffect(() => {
    return () => {
      if (animRef.current) clearTimeout(animRef.current);
    };
  }, []);

  /* ---- token color mapping ---- */
  const tokenColorMap = useRef(new Map<string, number>());
  let colorIdx = 0;
  for (const word of corpus) {
    for (const token of word) {
      if (!tokenColorMap.current.has(token)) {
        tokenColorMap.current.set(
          token,
          colorIdx % TOKEN_COLORS.length
        );
        colorIdx++;
      }
    }
  }

  /* ---- render ---- */
  if (!mounted) {
    return (
      <div
        className="widget-container bg-card border border-border rounded-xl p-6 my-8 overflow-hidden"
        style={{ minHeight: 420 }}
      />
    );
  }

  return (
    <div className="widget-container bg-card border border-border rounded-xl p-6 my-8 overflow-hidden">
      {/* Label */}
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-4 font-mono">
        Interactive &middot; BPE Tokenization
      </div>

      {/* Title + vocab counter */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-lg font-semibold text-foreground m-0">
          Byte Pair Encoding
        </h3>
        <div className="flex items-center gap-3 font-mono text-xs">
          <span className="text-muted-foreground">
            Step{" "}
            <span className="text-foreground font-semibold">{stepCount}</span>
          </span>
          <span className="text-muted-foreground">
            Vocab{" "}
            <span
              className="font-semibold"
              style={{ color: "#f97316" }}
            >
              {vocabSize}
            </span>
          </span>
        </div>
      </div>

      {/* Input */}
      <div className="mb-4">
        <input
          type="text"
          value={inputText}
          onChange={handleInputChange}
          placeholder="Type text to tokenize..."
          className="w-full bg-[rgba(255,255,255,0.04)] border border-border rounded-lg px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-[#f97316] transition-colors"
          spellCheck={false}
        />
      </div>

      {/* Controls */}
      <div className="flex gap-2 mb-5">
        <button
          className={`btn-mono ${!isDone && !isAnimating ? "active" : ""}`}
          onClick={handleStep}
          disabled={isDone || isAnimating}
          style={{
            opacity: isDone || isAnimating ? 0.4 : 1,
            cursor: isDone || isAnimating ? "not-allowed" : "pointer",
          }}
        >
          Step
        </button>
        <button
          className={`btn-mono ${isAnimating ? "active" : ""}`}
          onClick={handleAuto}
          disabled={isDone || isAnimating}
          style={{
            opacity: isDone ? 0.4 : 1,
            cursor: isDone ? "not-allowed" : "pointer",
            borderColor: isAnimating ? "#f97316" : undefined,
            color: isAnimating ? "#f97316" : undefined,
          }}
        >
          {isAnimating ? "Running..." : "Auto"}
        </button>
        <button className="btn-mono" onClick={handleReset}>
          Reset
        </button>
        {isDone && (
          <span
            className="font-mono text-xs self-center ml-2"
            style={{ color: "#4ade80" }}
          >
            Done -- no more merges
          </span>
        )}
      </div>

      {/* Corpus display */}
      <div className="mb-5">
        <div className="text-xs text-muted-foreground font-mono mb-2 uppercase tracking-wider">
          Current Tokens
        </div>
        <div
          className="flex flex-wrap gap-1.5 p-3 rounded-lg min-h-[48px] items-center"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          {corpus.map((word, wi) => (
            <React.Fragment key={wi}>
              {wi > 0 && (
                <span
                  className="text-muted-foreground mx-0.5 select-none"
                  style={{ fontSize: "0.6rem", opacity: 0.4 }}
                >
                  |
                </span>
              )}
              {word.map((token, ti) => {
                const cIndex =
                  tokenColorMap.current.get(token) ?? 0;
                const isNewlyMerged =
                  highlightedMerge !== null &&
                  merges.length > 0 &&
                  merges[merges.length - 1]?.merged === token;
                return (
                  <span
                    key={`${wi}-${ti}`}
                    className="inline-flex items-center px-2 py-0.5 rounded font-mono text-xs transition-all duration-300"
                    style={{
                      background:
                        TOKEN_COLORS[cIndex % TOKEN_COLORS.length],
                      border: `1px solid ${TOKEN_BORDERS[cIndex % TOKEN_BORDERS.length]}`,
                      color: "#e4e4e7",
                      boxShadow: isNewlyMerged
                        ? "0 0 8px rgba(249,115,22,0.4)"
                        : "none",
                      transform: isNewlyMerged
                        ? "scale(1.08)"
                        : "scale(1)",
                    }}
                    title={`"${token}" (${token.length} char${token.length > 1 ? "s" : ""})`}
                  >
                    {token === " " ? "\u2423" : token}
                  </span>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Merge history */}
      {merges.length > 0 && (
        <div>
          <div className="text-xs text-muted-foreground font-mono mb-2 uppercase tracking-wider">
            Merge History
          </div>
          <div
            className="rounded-lg overflow-hidden border border-border"
            style={{ maxHeight: 240, overflowY: "auto" }}
          >
            <table className="w-full text-xs font-mono">
              <thead>
                <tr
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <th className="text-left px-3 py-2 text-muted-foreground font-normal">
                    #
                  </th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-normal">
                    Pair
                  </th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-normal">
                    Merged
                  </th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-normal">
                    Freq
                  </th>
                </tr>
              </thead>
              <tbody>
                {merges.map((m, i) => {
                  const isHighlighted = highlightedMerge === m.step;
                  return (
                    <tr
                      key={i}
                      className="transition-colors duration-300"
                      style={{
                        background: isHighlighted
                          ? "rgba(249,115,22,0.1)"
                          : i % 2 === 0
                            ? "transparent"
                            : "rgba(255,255,255,0.02)",
                        borderBottom:
                          "1px solid rgba(255,255,255,0.04)",
                      }}
                    >
                      <td className="px-3 py-1.5 text-muted-foreground">
                        {m.step}
                      </td>
                      <td className="px-3 py-1.5">
                        <span style={{ color: "#a1a1aa" }}>
                          {m.pair[0] === " " ? "\u2423" : m.pair[0]}
                        </span>
                        <span
                          className="mx-1"
                          style={{ color: "#525252" }}
                        >
                          +
                        </span>
                        <span style={{ color: "#a1a1aa" }}>
                          {m.pair[1] === " " ? "\u2423" : m.pair[1]}
                        </span>
                      </td>
                      <td className="px-3 py-1.5">
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 rounded"
                          style={{
                            background: "rgba(249,115,22,0.2)",
                            border:
                              "1px solid rgba(249,115,22,0.35)",
                            color: "#fb923c",
                          }}
                        >
                          {m.merged.replace(/ /g, "\u2423")}
                        </span>
                      </td>
                      <td
                        className="px-3 py-1.5 text-right"
                        style={{ color: "#f97316" }}
                      >
                        {m.frequency}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state hint */}
      {merges.length === 0 && stepCount === 0 && (
        <div className="text-xs text-muted-foreground font-mono text-center py-4 opacity-60">
          Press <span style={{ color: "#f97316" }}>Step</span> to begin
          merging the most frequent character pairs, or{" "}
          <span style={{ color: "#f97316" }}>Auto</span> to animate all
          steps.
        </div>
      )}
    </div>
  );
}
