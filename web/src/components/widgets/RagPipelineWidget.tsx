"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useClientMounted } from "@/hooks/useClientMounted";

/* ------------------------------------------------------------------ */
/*  Seeded hash for deterministic but varying similarity scores       */
/* ------------------------------------------------------------------ */
function hash(s: number, i: number): number {
  return Math.round(((Math.sin(s * 9301 + i * 4973) * 49297) % 1) * 1000) / 1000;
}

/* ------------------------------------------------------------------ */
/*  Knowledge base                                                     */
/* ------------------------------------------------------------------ */
const DOCS = [
  {
    id: 1,
    text: "Transformers are neural network architectures that use self-attention mechanisms to process input data in parallel, enabling efficient handling of long-range dependencies.",
  },
  {
    id: 2,
    text: "Convolutional Neural Networks (CNNs) are primarily used for image processing tasks, applying learnable filters across spatial dimensions.",
  },
  {
    id: 3,
    text: "Recurrent Neural Networks process sequential data using hidden states that carry information across time steps.",
  },
  {
    id: 4,
    text: "The attention mechanism allows models to focus on relevant parts of the input sequence when producing each element of the output.",
  },
  {
    id: 5,
    text: "Fine-tuning adapts a pre-trained model to a specific downstream task by continuing training on a smaller, task-specific dataset.",
  },
];

/* ------------------------------------------------------------------ */
/*  Pipeline stage definitions                                         */
/* ------------------------------------------------------------------ */
const STAGES = [
  { key: "question", label: "Question" },
  { key: "embedding", label: "Embedding" },
  { key: "vector_search", label: "Vector Search" },
  { key: "retrieval", label: "Retrieval" },
  { key: "prompt_assembly", label: "Prompt Assembly" },
  { key: "response", label: "LLM Response" },
] as const;

/* ------------------------------------------------------------------ */
/*  Compute pipeline data for a given query + runId                    */
/* ------------------------------------------------------------------ */
function computePipelineData(query: string, runId: number) {
  // Embedding: fake vector derived from query length + runId
  const baseVec = [0.23, -0.87, 0.45, 0.12, -0.56, 0.78, -0.34, 0.91];
  const embedding = baseVec.map(
    (v, i) => Math.round((v + hash(runId, i) * 0.1) * 1000) / 1000
  );

  // Similarity scores: higher for docs about transformers/attention
  const baseSimilarities = [0.92, 0.34, 0.41, 0.87, 0.28];
  const similarities = DOCS.map((doc, i) => ({
    docId: doc.id,
    score:
      Math.round(
        Math.min(
          0.99,
          Math.max(0.05, baseSimilarities[i] + hash(runId, i + 10) * 0.08)
        ) * 100
      ) / 100,
    text: doc.text,
  })).sort((a, b) => b.score - a.score);

  // Top 2 retrieved
  const retrieved = similarities.slice(0, 2);

  // Prompt assembly
  const assembledPrompt = `Context:\n---\n${retrieved
    .map((r) => `[Doc ${r.docId}] ${r.text}`)
    .join("\n\n")}\n---\n\nQuestion: ${query}\n\nAnswer based on the context above:`;

  // Generated response
  const generatedResponse = `Based on the retrieved context, transformers are neural network architectures that use self-attention mechanisms to process input data in parallel. The attention mechanism is a key component that allows these models to focus on relevant parts of the input sequence, enabling efficient handling of long-range dependencies in the data.`;

  return { embedding, similarities, retrieved, assembledPrompt, generatedResponse };
}

/* ------------------------------------------------------------------ */
/*  Arrow SVG between stages                                           */
/* ------------------------------------------------------------------ */
function Arrow({ active }: { active: boolean }) {
  return (
    <svg
      width="28"
      height="20"
      viewBox="0 0 28 20"
      fill="none"
      style={{ flexShrink: 0, margin: "0 2px" }}
    >
      <path
        d="M2 10 L20 10 M16 4 L22 10 L16 16"
        stroke={active ? "#fb923c" : "#525252"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transition: "stroke 0.3s ease" }}
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Typewriter hook                                                    */
/* ------------------------------------------------------------------ */
function useTypewriter(text: string, active: boolean, speed = 18) {
  const [displayed, setDisplayed] = useState("");
  const idxRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* Reset when deactivated (render-time state adjustment) */
  if (!active && displayed !== "") {
    setDisplayed("");
  }

  useEffect(() => {
    if (!active) {
      idxRef.current = 0;
      return;
    }
    idxRef.current = 0;
    timerRef.current = setInterval(() => {
      idxRef.current += 1;
      if (idxRef.current > text.length) {
        if (timerRef.current) clearInterval(timerRef.current);
        return;
      }
      setDisplayed(text.slice(0, idxRef.current));
    }, speed);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [active, text, speed]);

  return displayed;
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */
export function RagPipelineWidget() {
  const mounted = useClientMounted();
  const [query, setQuery] = useState("What are transformers in AI?");
  const [runId, setRunId] = useState(0);
  const [running, setRunning] = useState(false);
  const [activeStageIdx, setActiveStageIdx] = useState(-1);
  const [completedStages, setCompletedStages] = useState<Set<number>>(new Set());
  const [frozenStage, setFrozenStage] = useState<number | null>(null);
  const [pipelineComplete, setPipelineComplete] = useState(false);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
    };
  }, []);

  const data = computePipelineData(query, runId);

  const typewriterActive =
    pipelineComplete || (frozenStage !== null && frozenStage >= 5);
  const displayedResponse = useTypewriter(
    data.generatedResponse,
    typewriterActive,
    18
  );

  /* ---- Clear all timers ---- */
  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  /* ---- Run pipeline ---- */
  const runPipeline = useCallback(() => {
    clearTimers();
    const nextRun = runId + 1;
    setRunId(nextRun);
    setRunning(true);
    setActiveStageIdx(0);
    setCompletedStages(new Set());
    setFrozenStage(null);
    setPipelineComplete(false);

    for (let i = 1; i <= STAGES.length; i++) {
      const t = setTimeout(() => {
        if (i < STAGES.length) {
          setActiveStageIdx(i);
          setCompletedStages((prev) => {
            const next = new Set(prev);
            next.add(i - 1);
            return next;
          });
        } else {
          setCompletedStages((prev) => {
            const next = new Set(prev);
            next.add(i - 1);
            return next;
          });
          setActiveStageIdx(-1);
          setRunning(false);
          setPipelineComplete(true);
        }
      }, i * 1500);
      timersRef.current.push(t);
    }
  }, [runId, clearTimers]);

  /* ---- Reset ---- */
  const resetPipeline = useCallback(() => {
    clearTimers();
    setRunning(false);
    setActiveStageIdx(-1);
    setCompletedStages(new Set());
    setFrozenStage(null);
    setPipelineComplete(false);
  }, [clearTimers]);

  /* ---- Stage click handler ---- */
  const handleStageClick = useCallback(
    (idx: number) => {
      if (!running && !pipelineComplete) return;
      clearTimers();
      setRunning(false);
      setFrozenStage(idx);
      // Mark all stages up to and including clicked as completed
      const completed = new Set<number>();
      for (let i = 0; i <= idx; i++) completed.add(i);
      setCompletedStages(completed);
      setActiveStageIdx(-1);
    },
    [running, pipelineComplete, clearTimers]
  );

  /* ---- Stage status ---- */
  const getStageStatus = (idx: number) => {
    if (frozenStage !== null) {
      if (idx <= frozenStage) return "completed";
      return "inactive";
    }
    if (completedStages.has(idx)) return "completed";
    if (idx === activeStageIdx) return "active";
    return "inactive";
  };

  /* ---- Animated embedding numbers ---- */
  const [embeddingFrame, setEmbeddingFrame] = useState(0);
  const embAnimRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const isEmbeddingActive =
      activeStageIdx === 1 ||
      (frozenStage !== null && frozenStage >= 1) ||
      pipelineComplete;
    if (isEmbeddingActive && !embAnimRef.current) {
      embAnimRef.current = setInterval(() => {
        setEmbeddingFrame((f) => f + 1);
      }, 120);
    }
    if (!isEmbeddingActive && embAnimRef.current) {
      clearInterval(embAnimRef.current);
      embAnimRef.current = null;
    }
    return () => {
      if (embAnimRef.current) {
        clearInterval(embAnimRef.current);
        embAnimRef.current = null;
      }
    };
  }, [activeStageIdx, frozenStage, pipelineComplete]);

  /* ---- Determine which results to show ---- */
  const visibleUpTo = (() => {
    if (frozenStage !== null) return frozenStage;
    if (pipelineComplete) return STAGES.length - 1;
    if (activeStageIdx >= 0) return activeStageIdx;
    return -1;
  })();

  if (!mounted) {
    return (
      <div className="widget-container bg-card border border-border rounded-xl p-6 my-8 overflow-hidden">
        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-4 font-mono">
          Interactive &middot; RAG Pipeline
        </div>
        <div style={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "#a3a3a3", fontFamily: "monospace" }}>Loading pipeline...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="widget-container bg-card border border-border rounded-xl p-6 my-8 overflow-hidden">
      {/* Label */}
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-4 font-mono">
        Interactive &middot; RAG Pipeline
      </div>

      {/* Input row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={running}
          placeholder="Enter your question..."
          style={{
            flex: "1 1 260px",
            minWidth: 200,
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #404040",
            background: "#1a1a1a",
            color: "#e5e5e5",
            fontFamily: "monospace",
            fontSize: 14,
            outline: "none",
          }}
        />
        <button
          className="btn-mono"
          onClick={runPipeline}
          disabled={running}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "1px solid #fb923c",
            background: running ? "#292524" : "#fb923c20",
            color: "#fb923c",
            fontFamily: "monospace",
            fontSize: 13,
            fontWeight: 600,
            cursor: running ? "not-allowed" : "pointer",
            transition: "all 0.2s ease",
            whiteSpace: "nowrap",
          }}
        >
          {running ? "Running..." : "Run Pipeline"}
        </button>
        <button
          className="btn-mono"
          onClick={resetPipeline}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "1px solid #525252",
            background: "transparent",
            color: "#a3a3a3",
            fontFamily: "monospace",
            fontSize: 13,
            cursor: "pointer",
            transition: "all 0.2s ease",
            whiteSpace: "nowrap",
          }}
        >
          Reset
        </button>
      </div>

      {/* Pipeline stages */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          overflowX: "auto",
          paddingBottom: 8,
          gap: 0,
        }}
      >
        {STAGES.map((stage, idx) => {
          const status = getStageStatus(idx);
          const isActive = status === "active";
          const isCompleted = status === "completed";
          const isFrozen = frozenStage === idx;

          return (
            <React.Fragment key={stage.key}>
              {idx > 0 && <Arrow active={isActive || isCompleted} />}
              <button
                className={`pipeline-stage${isActive ? " active" : ""}${isCompleted ? " completed" : ""}`}
                onClick={() => handleStageClick(idx)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 110,
                  padding: "12px 10px",
                  borderRadius: 10,
                  border: isFrozen
                    ? "2px solid #fb923c"
                    : isActive
                      ? "2px solid #fb923c88"
                      : isCompleted
                        ? "1px solid #fb923c55"
                        : "1px solid #333",
                  background: isActive
                    ? "#fb923c18"
                    : isCompleted
                      ? "#fb923c0a"
                      : "#1a1a1a",
                  cursor:
                    running || pipelineComplete ? "pointer" : "default",
                  transition: "all 0.3s ease",
                  flexShrink: 0,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Pulse animation for active stage */}
                {isActive && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: 10,
                      animation: "ragPulse 1.5s ease-in-out infinite",
                      background: "radial-gradient(circle, #fb923c22 0%, transparent 70%)",
                    }}
                  />
                )}
                <span
                  style={{
                    fontSize: 18,
                    marginBottom: 4,
                  }}
                >
                  {idx === 0
                    ? "\u2753"
                    : idx === 1
                      ? "\u{1F522}"
                      : idx === 2
                        ? "\u{1F50D}"
                        : idx === 3
                          ? "\u{1F4C4}"
                          : idx === 4
                            ? "\u{1F9E9}"
                            : "\u{1F916}"}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: "monospace",
                    fontWeight: 600,
                    color: isActive || isCompleted ? "#fb923c" : "#737373",
                    textAlign: "center",
                    lineHeight: 1.2,
                    transition: "color 0.3s ease",
                  }}
                >
                  {stage.label}
                </span>
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* Hint */}
      {(running || pipelineComplete) && (
        <div
          style={{
            fontSize: 11,
            color: "#737373",
            fontFamily: "monospace",
            marginTop: 8,
            textAlign: "center",
          }}
        >
          Click any stage to inspect intermediate data
        </div>
      )}

      {/* Results panel */}
      {visibleUpTo >= 0 && (
        <div
          style={{
            marginTop: 20,
            borderTop: "1px solid #333",
            paddingTop: 16,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontFamily: "monospace",
              fontWeight: 600,
              color: "#fb923c",
              marginBottom: 12,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Pipeline Results
          </div>

          {/* Stage 0: Question */}
          {visibleUpTo >= 0 && (
            <ResultBlock title="Query" stageIdx={0}>
              <code style={{ color: "#e5e5e5" }}>{query}</code>
            </ResultBlock>
          )}

          {/* Stage 1: Embedding */}
          {visibleUpTo >= 1 && (
            <ResultBlock title="Query Embedding" stageIdx={1}>
              <code style={{ color: "#a3e635", wordBreak: "break-all" }}>
                [{data.embedding
                  .map((v, i) => {
                    if (activeStageIdx === 1) {
                      // Animate numbers while embedding stage is active
                      const jitter =
                        Math.sin(embeddingFrame * 0.3 + i * 2.1) * 0.05;
                      return (v + jitter).toFixed(3);
                    }
                    return v.toFixed(3);
                  })
                  .join(", ")}
                , ...]
              </code>
            </ResultBlock>
          )}

          {/* Stage 2: Vector Search */}
          {visibleUpTo >= 2 && (
            <ResultBlock title="Similarity Scores" stageIdx={2}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontFamily: "monospace",
                  fontSize: 12,
                }}
              >
                <thead>
                  <tr>
                    <th style={thStyle}>Doc</th>
                    <th style={thStyle}>Score</th>
                    <th style={{ ...thStyle, textAlign: "left" }}>Preview</th>
                  </tr>
                </thead>
                <tbody>
                  {data.similarities.map((sim) => (
                    <tr key={sim.docId}>
                      <td style={tdStyle}>Doc {sim.docId}</td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            color: sim.score >= 0.7 ? "#fb923c" : "#737373",
                            fontWeight: sim.score >= 0.7 ? 700 : 400,
                          }}
                        >
                          {sim.score.toFixed(2)}
                        </span>
                        <div
                          style={{
                            height: 3,
                            marginTop: 3,
                            borderRadius: 2,
                            background: "#333",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${sim.score * 100}%`,
                              height: "100%",
                              background:
                                sim.score >= 0.7 ? "#fb923c" : "#525252",
                              borderRadius: 2,
                              transition: "width 0.5s ease",
                            }}
                          />
                        </div>
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          textAlign: "left",
                          color: "#a3a3a3",
                          maxWidth: 300,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {sim.text.slice(0, 60)}...
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ResultBlock>
          )}

          {/* Stage 3: Retrieval */}
          {visibleUpTo >= 3 && (
            <ResultBlock title="Retrieved Chunks (Top 2)" stageIdx={3}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {data.retrieved.map((r) => (
                  <div
                    key={r.docId}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid #fb923c44",
                      background: "#fb923c08",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#fb923c",
                        marginBottom: 4,
                        fontFamily: "monospace",
                      }}
                    >
                      DOC {r.docId} &mdash; score: {r.score.toFixed(2)}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#d4d4d4",
                        lineHeight: 1.5,
                        fontFamily: "monospace",
                      }}
                    >
                      {r.text}
                    </div>
                  </div>
                ))}
              </div>
            </ResultBlock>
          )}

          {/* Stage 4: Prompt Assembly */}
          {visibleUpTo >= 4 && (
            <ResultBlock title="Assembled Prompt" stageIdx={4}>
              <pre
                style={{
                  fontSize: 11,
                  color: "#d4d4d4",
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  margin: 0,
                  fontFamily: "monospace",
                }}
              >
                {data.assembledPrompt}
              </pre>
            </ResultBlock>
          )}

          {/* Stage 5: Response */}
          {visibleUpTo >= 5 && (
            <ResultBlock title="LLM Response" stageIdx={5}>
              <div
                style={{
                  fontSize: 13,
                  color: "#e5e5e5",
                  lineHeight: 1.7,
                  fontFamily: "monospace",
                }}
              >
                {displayedResponse}
                {typewriterActive &&
                  displayedResponse.length < data.generatedResponse.length && (
                    <span
                      style={{
                        display: "inline-block",
                        width: 2,
                        height: 14,
                        background: "#fb923c",
                        marginLeft: 1,
                        verticalAlign: "text-bottom",
                        animation: "ragBlink 0.8s step-end infinite",
                      }}
                    />
                  )}
              </div>
            </ResultBlock>
          )}
        </div>
      )}

      {/* Keyframe animations */}
      <style>{`
        @keyframes ragPulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        @keyframes ragBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */
function ResultBlock({
  title,
  stageIdx,
  children,
}: {
  title: string;
  stageIdx: number;
  children: React.ReactNode;
}) {
  const colors = [
    "#a3a3a3",
    "#a3e635",
    "#38bdf8",
    "#fb923c",
    "#c084fc",
    "#fb923c",
  ];
  return (
    <div
      style={{
        marginBottom: 14,
        padding: "10px 14px",
        borderRadius: 8,
        border: "1px solid #292524",
        background: "#0d0d0d",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontFamily: "monospace",
          fontWeight: 700,
          color: colors[stageIdx] ?? "#a3a3a3",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 8,
        }}
      >
        Stage {stageIdx + 1}: {title}
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Table styles                                                       */
/* ------------------------------------------------------------------ */
const thStyle: React.CSSProperties = {
  padding: "4px 10px",
  textAlign: "center",
  borderBottom: "1px solid #333",
  color: "#737373",
  fontWeight: 600,
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const tdStyle: React.CSSProperties = {
  padding: "6px 10px",
  textAlign: "center",
  borderBottom: "1px solid #1f1f1f",
  fontSize: 12,
  color: "#d4d4d4",
};
