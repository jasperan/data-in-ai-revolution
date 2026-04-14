"use client";

import React, { useState, useCallback } from "react";
import { useClientMounted } from "@/hooks/useClientMounted";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SftExample {
  instruction: string;
  input: string;
  output: string;
  quality: "high" | "low";
}

interface RlhfExample {
  prompt: string;
  chosen: string;
  rejected: string;
  quality: "high" | "low";
}

interface DpoExample {
  prompt: string;
  chosen: string;
  rejected: string;
  chosenScore: number;
  rejectedScore: number;
  quality: "high" | "low";
}

type TabKey = "sft" | "rlhf" | "dpo";

/* ------------------------------------------------------------------ */
/*  Static initial data                                                */
/* ------------------------------------------------------------------ */

const INITIAL_SFT: SftExample[] = [
  {
    instruction: "Explain what a neural network is in simple terms.",
    input: "",
    output:
      "A neural network is a computer system inspired by the human brain. It consists of layers of connected nodes that process information, learning patterns from data to make predictions or decisions.",
    quality: "high",
  },
  {
    instruction: "What is the difference between supervised and unsupervised learning?",
    input: "",
    output:
      "Supervised learning uses labeled data to train models, while unsupervised learning finds hidden patterns in unlabeled data without predefined categories.",
    quality: "high",
  },
  {
    instruction: "Describe the concept of overfitting in machine learning.",
    input: "",
    output:
      "Overfitting occurs when a model learns the training data too well, including its noise and outliers, causing it to perform poorly on new, unseen data.",
    quality: "high",
  },
];

const INITIAL_RLHF: RlhfExample[] = [
  {
    prompt: "How can I improve my model's accuracy?",
    chosen:
      "To improve accuracy, consider these steps: 1) Gather more diverse training data, 2) Try different architectures, 3) Use regularization techniques, 4) Tune hyperparameters systematically, and 5) Use cross-validation to evaluate changes.",
    rejected:
      "Just add more data and train longer. It should get better eventually.",
    quality: "high",
  },
  {
    prompt: "What are transformers in AI?",
    chosen:
      "Transformers are a neural network architecture that uses self-attention mechanisms to process sequential data in parallel. They revolutionized NLP and form the basis of models like GPT and BERT.",
    rejected:
      "Transformers are robots that can change shape. In AI they do something similar with data I think.",
    quality: "high",
  },
];

const INITIAL_DPO: DpoExample[] = [
  {
    prompt: "Explain gradient descent to a beginner.",
    chosen:
      "Gradient descent is an optimization algorithm that iteratively adjusts model parameters by moving in the direction that reduces error the most. Think of it like rolling a ball downhill to find the lowest valley.",
    rejected:
      "Gradient descent is a math thing where you calculate derivatives and update weights. You multiply the learning rate by the gradient and subtract it.",
    chosenScore: 92,
    rejectedScore: 45,
    quality: "high",
  },
  {
    prompt: "Why is data preprocessing important?",
    chosen:
      "Data preprocessing is crucial because raw data often contains noise, missing values, and inconsistencies. Cleaning and normalizing data ensures models can learn meaningful patterns rather than artifacts.",
    rejected:
      "You need to preprocess data because the computer needs it in a specific format. Just normalize everything.",
    chosenScore: 88,
    rejectedScore: 35,
    quality: "high",
  },
];

const DATA_QUALITY_TIPS = [
  "Diverse examples prevent model bias and improve generalization.",
  "Consistent formatting across examples helps the model learn patterns.",
  "Clear, specific instructions produce better fine-tuned outputs.",
  "Include edge cases to make your model more robust.",
  "Review and validate examples before training -- garbage in, garbage out.",
  "For RLHF/DPO, ensure chosen responses are genuinely better, not just longer.",
];

/* ------------------------------------------------------------------ */
/*  Accent colors per tab                                              */
/* ------------------------------------------------------------------ */

const TAB_COLORS: Record<TabKey, string> = {
  sft: "#f472b6",   // pink
  rlhf: "#9886c4",  // purple
  dpo: "#5ba8c8",   // cyan
};

/* ------------------------------------------------------------------ */
/*  Inline-editable text component                                     */
/* ------------------------------------------------------------------ */

function EditableField({
  value,
  onChange,
  label,
  accent,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  accent: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = () => {
    onChange(draft);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-1">
        <span
          className="text-[10px] font-mono uppercase tracking-wider"
          style={{ color: accent, opacity: 0.7 }}
        >
          {label}
        </span>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commit();
            }
          }}
          rows={3}
          className="w-full bg-[rgba(255,255,255,0.06)] border border-border rounded px-2 py-1.5 font-mono text-xs text-foreground focus:outline-none transition-colors resize-none"
          style={{ borderColor: accent }}
          autoFocus
        />
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-1 cursor-pointer group"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
    >
      <span
        className="text-[10px] font-mono uppercase tracking-wider"
        style={{ color: accent, opacity: 0.7 }}
      >
        {label}
      </span>
      <div className="font-mono text-xs text-foreground/80 group-hover:text-foreground transition-colors leading-relaxed">
        {value}
        <span
          className="ml-1.5 text-[10px] opacity-0 group-hover:opacity-60 transition-opacity"
          style={{ color: accent }}
        >
          (click to edit)
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Quality badge                                                      */
/* ------------------------------------------------------------------ */

function QualityBadge({
  quality,
  onToggle,
}: {
  quality: "high" | "low";
  onToggle: () => void;
}) {
  const isHigh = quality === "high";
  return (
    <button
      onClick={onToggle}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider transition-all border cursor-pointer"
      style={{
        background: isHigh ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)",
        borderColor: isHigh ? "rgba(74,222,128,0.3)" : "rgba(248,113,113,0.3)",
        color: isHigh ? "#4ade80" : "#f87171",
      }}
      title="Click to toggle quality"
    >
      <span>{isHigh ? "\u2713" : "\u2717"}</span>
      {isHigh ? "High Quality" : "Low Quality"}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  JSON preview with syntax highlighting                              */
/* ------------------------------------------------------------------ */

function JsonPreview({ data, accent }: { data: unknown; accent: string }) {
  const jsonStr = JSON.stringify(data, null, 2);

  const highlighted = jsonStr.replace(
    /("(?:[^"\\]|\\.)*")\s*:/g,
    '<span class="json-key">$1</span>:'
  ).replace(
    /:\s*("(?:[^"\\]|\\.)*")/g,
    ': <span class="json-string">$1</span>'
  );

  return (
    <div
      className="rounded-lg p-3 overflow-x-auto"
      style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${accent}22` }}
    >
      <pre
        className="text-[11px] font-mono leading-relaxed m-0"
        style={{ color: "#a1a1aa" }}
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Score bar for DPO                                                  */
/* ------------------------------------------------------------------ */

function ScoreBar({ score, color, label }: { score: number; color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono text-muted-foreground w-16 shrink-0">
        {label}
      </span>
      <div
        className="flex-1 h-2 rounded-full overflow-hidden"
        style={{ background: "rgba(255,255,255,0.06)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
      <span className="text-[10px] font-mono w-8 text-right" style={{ color }}>
        {score}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function FineTuningWidget() {
  const mounted = useClientMounted();

  const [activeTab, setActiveTab] = useState<TabKey>("sft");
  const [sftExamples, setSftExamples] = useState<SftExample[]>(INITIAL_SFT);
  const [rlhfExamples, setRlhfExamples] = useState<RlhfExample[]>(INITIAL_RLHF);
  const [dpoExamples, setDpoExamples] = useState<DpoExample[]>(INITIAL_DPO);
  const [showTips, setShowTips] = useState(false);
  const [showJson, setShowJson] = useState(true);

  const accent = TAB_COLORS[activeTab];

  /* ---- SFT handlers ---- */
  const updateSft = useCallback(
    (index: number, field: keyof SftExample, value: string) => {
      setSftExamples((prev) =>
        prev.map((ex, i) => (i === index ? { ...ex, [field]: value } : ex))
      );
    },
    []
  );

  const toggleSftQuality = useCallback((index: number) => {
    setSftExamples((prev) =>
      prev.map((ex, i) =>
        i === index
          ? { ...ex, quality: ex.quality === "high" ? "low" : "high" }
          : ex
      )
    );
  }, []);

  const addSft = useCallback(() => {
    setSftExamples((prev) => [
      ...prev,
      {
        instruction: "New instruction...",
        input: "",
        output: "Expected output...",
        quality: "high",
      },
    ]);
  }, []);

  const removeSft = useCallback((index: number) => {
    setSftExamples((prev) => prev.filter((_, i) => i !== index));
  }, []);

  /* ---- RLHF handlers ---- */
  const updateRlhf = useCallback(
    (index: number, field: keyof RlhfExample, value: string) => {
      setRlhfExamples((prev) =>
        prev.map((ex, i) => (i === index ? { ...ex, [field]: value } : ex))
      );
    },
    []
  );

  const toggleRlhfQuality = useCallback((index: number) => {
    setRlhfExamples((prev) =>
      prev.map((ex, i) =>
        i === index
          ? { ...ex, quality: ex.quality === "high" ? "low" : "high" }
          : ex
      )
    );
  }, []);

  const addRlhf = useCallback(() => {
    setRlhfExamples((prev) => [
      ...prev,
      {
        prompt: "New prompt...",
        chosen: "Better response...",
        rejected: "Worse response...",
        quality: "high",
      },
    ]);
  }, []);

  const removeRlhf = useCallback((index: number) => {
    setRlhfExamples((prev) => prev.filter((_, i) => i !== index));
  }, []);

  /* ---- DPO handlers ---- */
  const updateDpo = useCallback(
    (index: number, field: keyof DpoExample, value: string | number) => {
      setDpoExamples((prev) =>
        prev.map((ex, i) => (i === index ? { ...ex, [field]: value } : ex))
      );
    },
    []
  );

  const toggleDpoQuality = useCallback((index: number) => {
    setDpoExamples((prev) =>
      prev.map((ex, i) =>
        i === index
          ? { ...ex, quality: ex.quality === "high" ? "low" : "high" }
          : ex
      )
    );
  }, []);

  const addDpo = useCallback(() => {
    setDpoExamples((prev) => [
      ...prev,
      {
        prompt: "New prompt...",
        chosen: "Preferred response...",
        rejected: "Less preferred response...",
        chosenScore: 80,
        rejectedScore: 30,
        quality: "high",
      },
    ]);
  }, []);

  const removeDpo = useCallback((index: number) => {
    setDpoExamples((prev) => prev.filter((_, i) => i !== index));
  }, []);

  /* ---- stats ---- */
  const totalExamples =
    sftExamples.length + rlhfExamples.length + dpoExamples.length;

  const allInstructions = [
    ...sftExamples.map((e) => e.instruction),
    ...rlhfExamples.map((e) => e.prompt),
    ...dpoExamples.map((e) => e.prompt),
  ];
  const avgInstructionLength =
    allInstructions.length > 0
      ? Math.round(
          allInstructions.reduce((sum, s) => sum + s.length, 0) /
            allInstructions.length
        )
      : 0;

  /* ---- JSON preview data ---- */
  const getJsonPreview = () => {
    if (activeTab === "sft" && sftExamples.length > 0) {
      const ex = sftExamples[0];
      return { instruction: ex.instruction, input: ex.input, output: ex.output };
    }
    if (activeTab === "rlhf" && rlhfExamples.length > 0) {
      const ex = rlhfExamples[0];
      return { prompt: ex.prompt, chosen: ex.chosen, rejected: ex.rejected };
    }
    if (activeTab === "dpo" && dpoExamples.length > 0) {
      const ex = dpoExamples[0];
      return { prompt: ex.prompt, chosen: ex.chosen, rejected: ex.rejected };
    }
    return {};
  };

  /* ---- render guard ---- */
  if (!mounted) {
    return (
      <div
        className="widget-container bg-card border border-border rounded-xl p-6 my-8 overflow-hidden"
        style={{ minHeight: 500 }}
      />
    );
  }

  /* ---- tabs ---- */
  const tabs: { key: TabKey; label: string; color: string }[] = [
    { key: "sft", label: "SFT", color: TAB_COLORS.sft },
    { key: "rlhf", label: "RLHF", color: TAB_COLORS.rlhf },
    { key: "dpo", label: "DPO", color: TAB_COLORS.dpo },
  ];

  return (
    <div className="widget-container bg-card border border-border rounded-xl p-6 my-8 overflow-hidden">
      {/* Label */}
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-4 font-mono">
        Interactive &middot; Fine-Tuning Data Formats
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-foreground m-0 mb-4">
        Fine-Tuning Data Explorer
      </h3>

      {/* Tab bar */}
      <div className="flex gap-2 mb-6">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              className="btn-mono"
              onClick={() => setActiveTab(tab.key)}
              style={{
                borderColor: isActive ? tab.color : undefined,
                color: isActive ? tab.color : undefined,
                background: isActive ? `${tab.color}15` : undefined,
              }}
            >
              {tab.label}
            </button>
          );
        })}
        <div className="flex-1" />
        <button
          className="btn-mono text-[10px]"
          onClick={() => setShowJson((p) => !p)}
          style={{
            borderColor: showJson ? accent : undefined,
            color: showJson ? accent : undefined,
          }}
        >
          {showJson ? "Hide" : "Show"} JSON
        </button>
      </div>

      {/* ---- Tab description ---- */}
      <div
        className="text-xs font-mono mb-4 px-3 py-2 rounded-lg"
        style={{ background: `${accent}10`, color: accent, border: `1px solid ${accent}20` }}
      >
        {activeTab === "sft" &&
          "Supervised Fine-Tuning: Train on instruction-response pairs. The model learns to generate outputs matching your examples."}
        {activeTab === "rlhf" &&
          "RLHF: Train a reward model from human preferences (chosen vs rejected), then optimize the policy against it."}
        {activeTab === "dpo" &&
          "Direct Preference Optimization: Skip the reward model! Learn directly from preference pairs -- simpler and often just as effective."}
      </div>

      {/* ================================================================ */}
      {/*  SFT View                                                        */}
      {/* ================================================================ */}
      {activeTab === "sft" && (
        <div className="space-y-4">
          {sftExamples.map((ex, idx) => (
            <div
              key={idx}
              className="rounded-lg p-4 space-y-3"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-[10px] font-mono uppercase tracking-wider"
                  style={{ color: accent }}
                >
                  Example {idx + 1}
                </span>
                <div className="flex items-center gap-2">
                  <QualityBadge
                    quality={ex.quality}
                    onToggle={() => toggleSftQuality(idx)}
                  />
                  {sftExamples.length > 1 && (
                    <button
                      onClick={() => removeSft(idx)}
                      className="text-[10px] font-mono text-muted-foreground hover:text-red-400 transition-colors px-1"
                      title="Remove example"
                    >
                      &times;
                    </button>
                  )}
                </div>
              </div>
              <EditableField
                label="Instruction"
                value={ex.instruction}
                onChange={(v) => updateSft(idx, "instruction", v)}
                accent={accent}
              />
              <EditableField
                label="Output"
                value={ex.output}
                onChange={(v) => updateSft(idx, "output", v)}
                accent={accent}
              />
            </div>
          ))}
          <button
            className="btn-mono w-full"
            onClick={addSft}
            style={{ borderColor: `${accent}40`, color: accent }}
          >
            + Add Example
          </button>
        </div>
      )}

      {/* ================================================================ */}
      {/*  RLHF View                                                       */}
      {/* ================================================================ */}
      {activeTab === "rlhf" && (
        <div className="space-y-4">
          {rlhfExamples.map((ex, idx) => (
            <div
              key={idx}
              className="rounded-lg p-4 space-y-3"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-[10px] font-mono uppercase tracking-wider"
                  style={{ color: accent }}
                >
                  Example {idx + 1}
                </span>
                <div className="flex items-center gap-2">
                  <QualityBadge
                    quality={ex.quality}
                    onToggle={() => toggleRlhfQuality(idx)}
                  />
                  {rlhfExamples.length > 1 && (
                    <button
                      onClick={() => removeRlhf(idx)}
                      className="text-[10px] font-mono text-muted-foreground hover:text-red-400 transition-colors px-1"
                      title="Remove example"
                    >
                      &times;
                    </button>
                  )}
                </div>
              </div>
              <EditableField
                label="Prompt"
                value={ex.prompt}
                onChange={(v) => updateRlhf(idx, "prompt", v)}
                accent={accent}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div
                  className="rounded-lg p-3"
                  style={{
                    background: "rgba(74,222,128,0.05)",
                    border: "1px solid rgba(74,222,128,0.15)",
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <span style={{ color: "#4ade80", fontSize: "14px" }}>{"\u2713"}</span>
                    <span
                      className="text-[10px] font-mono uppercase tracking-wider"
                      style={{ color: "#4ade80" }}
                    >
                      Chosen
                    </span>
                  </div>
                  <EditableField
                    label=""
                    value={ex.chosen}
                    onChange={(v) => updateRlhf(idx, "chosen", v)}
                    accent="#4ade80"
                  />
                </div>
                <div
                  className="rounded-lg p-3"
                  style={{
                    background: "rgba(248,113,113,0.05)",
                    border: "1px solid rgba(248,113,113,0.15)",
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <span style={{ color: "#f87171", fontSize: "14px" }}>{"\u2717"}</span>
                    <span
                      className="text-[10px] font-mono uppercase tracking-wider"
                      style={{ color: "#f87171" }}
                    >
                      Rejected
                    </span>
                  </div>
                  <EditableField
                    label=""
                    value={ex.rejected}
                    onChange={(v) => updateRlhf(idx, "rejected", v)}
                    accent="#f87171"
                  />
                </div>
              </div>
            </div>
          ))}
          <button
            className="btn-mono w-full"
            onClick={addRlhf}
            style={{ borderColor: `${accent}40`, color: accent }}
          >
            + Add Example
          </button>
        </div>
      )}

      {/* ================================================================ */}
      {/*  DPO View                                                        */}
      {/* ================================================================ */}
      {activeTab === "dpo" && (
        <div className="space-y-4">
          {dpoExamples.map((ex, idx) => (
            <div
              key={idx}
              className="rounded-lg p-4 space-y-3"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-[10px] font-mono uppercase tracking-wider"
                  style={{ color: accent }}
                >
                  Example {idx + 1}
                </span>
                <div className="flex items-center gap-2">
                  <QualityBadge
                    quality={ex.quality}
                    onToggle={() => toggleDpoQuality(idx)}
                  />
                  {dpoExamples.length > 1 && (
                    <button
                      onClick={() => removeDpo(idx)}
                      className="text-[10px] font-mono text-muted-foreground hover:text-red-400 transition-colors px-1"
                      title="Remove example"
                    >
                      &times;
                    </button>
                  )}
                </div>
              </div>
              <EditableField
                label="Prompt"
                value={ex.prompt}
                onChange={(v) => updateDpo(idx, "prompt", v)}
                accent={accent}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div
                  className="rounded-lg p-3"
                  style={{
                    background: "rgba(74,222,128,0.05)",
                    border: "1px solid rgba(74,222,128,0.15)",
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <span style={{ color: "#4ade80", fontSize: "14px" }}>{"\u2713"}</span>
                    <span
                      className="text-[10px] font-mono uppercase tracking-wider"
                      style={{ color: "#4ade80" }}
                    >
                      Chosen (Preferred)
                    </span>
                  </div>
                  <EditableField
                    label=""
                    value={ex.chosen}
                    onChange={(v) => updateDpo(idx, "chosen", v)}
                    accent="#4ade80"
                  />
                  <div className="mt-2">
                    <ScoreBar score={ex.chosenScore} color="#4ade80" label="Score" />
                  </div>
                </div>
                <div
                  className="rounded-lg p-3"
                  style={{
                    background: "rgba(248,113,113,0.05)",
                    border: "1px solid rgba(248,113,113,0.15)",
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <span style={{ color: "#f87171", fontSize: "14px" }}>{"\u2717"}</span>
                    <span
                      className="text-[10px] font-mono uppercase tracking-wider"
                      style={{ color: "#f87171" }}
                    >
                      Rejected
                    </span>
                  </div>
                  <EditableField
                    label=""
                    value={ex.rejected}
                    onChange={(v) => updateDpo(idx, "rejected", v)}
                    accent="#f87171"
                  />
                  <div className="mt-2">
                    <ScoreBar score={ex.rejectedScore} color="#f87171" label="Score" />
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div
            className="text-[11px] font-mono px-3 py-2 rounded-lg"
            style={{
              background: "rgba(91,168,200,0.06)",
              border: "1px solid rgba(91,168,200,0.15)",
              color: "#5ba8c8",
            }}
          >
            No reward model needed -- DPO learns preferences directly from the
            comparison pairs, making it simpler to implement and train.
          </div>
          <button
            className="btn-mono w-full"
            onClick={addDpo}
            style={{ borderColor: `${accent}40`, color: accent }}
          >
            + Add Example
          </button>
        </div>
      )}

      {/* ================================================================ */}
      {/*  JSON Format Preview                                             */}
      {/* ================================================================ */}
      {showJson && (
        <div className="mt-6">
          <div className="text-xs text-muted-foreground font-mono mb-2 uppercase tracking-wider">
            Data Format Preview
          </div>
          <JsonPreview data={getJsonPreview()} accent={accent} />
        </div>
      )}

      {/* ================================================================ */}
      {/*  Stats panel                                                     */}
      {/* ================================================================ */}
      <div
        className="mt-6 grid grid-cols-3 gap-3"
      >
        <div
          className="rounded-lg p-3 text-center"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="text-lg font-semibold font-mono" style={{ color: accent }}>
            {totalExamples}
          </div>
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
            Total Examples
          </div>
        </div>
        <div
          className="rounded-lg p-3 text-center"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="text-lg font-semibold font-mono" style={{ color: accent }}>
            {avgInstructionLength}
          </div>
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
            Avg Instruction Len
          </div>
        </div>
        <div
          className="rounded-lg p-3 flex items-center justify-center"
          style={{
            background: "rgba(74,222,128,0.08)",
            border: "1px solid rgba(74,222,128,0.2)",
          }}
        >
          <span
            className="text-[11px] font-mono font-semibold uppercase tracking-wider"
            style={{ color: "#4ade80" }}
          >
            Quality &gt; Quantity
          </span>
        </div>
      </div>

      {/* ================================================================ */}
      {/*  Data Quality Tips (collapsible)                                 */}
      {/* ================================================================ */}
      <div className="mt-6">
        <button
          className="btn-mono w-full text-left flex items-center justify-between"
          onClick={() => setShowTips((p) => !p)}
          style={{
            borderColor: showTips ? `${accent}40` : undefined,
            color: showTips ? accent : undefined,
          }}
        >
          <span>Data Quality Tips</span>
          <span
            className="transition-transform duration-200"
            style={{ transform: showTips ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            {"\u25BE"}
          </span>
        </button>
        {showTips && (
          <div
            className="mt-2 rounded-lg p-4 space-y-2"
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {DATA_QUALITY_TIPS.map((tip, i) => (
              <div key={i} className="flex items-start gap-2">
                <span
                  className="text-xs mt-0.5 shrink-0"
                  style={{ color: accent }}
                >
                  {"\u2022"}
                </span>
                <span className="text-xs font-mono text-foreground/70 leading-relaxed">
                  {tip}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
