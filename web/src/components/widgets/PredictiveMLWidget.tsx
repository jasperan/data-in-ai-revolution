"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ModelType = "Decision Tree" | "Neural Network" | "Gradient Boosting";

interface CustomerData {
  name: string;
  age: number;
  income: number;
  previousCars: number;
  city: string;
}

interface DerivedFeatures {
  age_group: string;
  income_bracket: string;
  car_history_score: number;
}

interface EncodedFeatures {
  age_normalized: number;
  income_normalized: number;
  car_history_score: number;
  city_NYC: number;
  city_LA: number;
  city_Chicago: number;
  city_Houston: number;
  city_Phoenix: number;
}

interface FeatureImportance {
  name: string;
  value: number;
  color: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const CITIES = ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix"];

const AMBER = "#fbbf24";
const AMBER_DIM = "rgba(251,191,36,0.25)";
const AMBER_BORDER = "rgba(251,191,36,0.5)";

const FEATURE_IMPORTANCES: FeatureImportance[] = [
  { name: "Income", value: 35, color: "#fbbf24" },
  { name: "Age", value: 25, color: "#f97316" },
  { name: "Previous Cars", value: 20, color: "#22d3ee" },
  { name: "City", value: 12, color: "#a78bfa" },
  { name: "Age Group", value: 8, color: "#4ade80" },
];

const PIPELINE_STAGES = [
  "Raw Data",
  "Feature Engineering",
  "Encoding",
  "Prediction",
];

/* ------------------------------------------------------------------ */
/*  Deterministic ML helpers                                           */
/* ------------------------------------------------------------------ */

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function getAgeGroup(age: number): string {
  if (age < 25) return "young";
  if (age < 35) return "young_adult";
  if (age < 50) return "middle_aged";
  if (age < 60) return "senior";
  return "elderly";
}

function getIncomeBracket(income: number): string {
  if (income < 40000) return "low";
  if (income < 80000) return "medium";
  if (income < 130000) return "high";
  return "very_high";
}

function getCarHistoryScore(previousCars: number): number {
  // Normalize 0-5 to a 0-1 score with diminishing returns
  return 1 - 1 / (1 + previousCars * 0.7);
}

function encodeFeatures(
  data: CustomerData,
  derived: DerivedFeatures
): EncodedFeatures {
  const ageNorm = (data.age - 18) / (70 - 18);
  const incomeNorm = (data.income - 20000) / (200000 - 20000);

  return {
    age_normalized: parseFloat(ageNorm.toFixed(3)),
    income_normalized: parseFloat(incomeNorm.toFixed(3)),
    car_history_score: parseFloat(derived.car_history_score.toFixed(3)),
    city_NYC: data.city === "New York" ? 1 : 0,
    city_LA: data.city === "Los Angeles" ? 1 : 0,
    city_Chicago: data.city === "Chicago" ? 1 : 0,
    city_Houston: data.city === "Houston" ? 1 : 0,
    city_Phoenix: data.city === "Phoenix" ? 1 : 0,
  };
}

function computePrediction(
  encoded: EncodedFeatures,
  model: ModelType
): number {
  // Base weighted sum using feature importances
  const cityBonus =
    encoded.city_NYC * 0.15 +
    encoded.city_LA * 0.12 +
    encoded.city_Chicago * 0.05 +
    encoded.city_Houston * -0.02 +
    encoded.city_Phoenix * -0.05;

  const rawScore =
    encoded.income_normalized * 0.35 +
    encoded.age_normalized * 0.25 +
    encoded.car_history_score * 0.2 +
    cityBonus +
    0.08 * (encoded.age_normalized > 0.5 ? 0.3 : -0.1);

  // Shift so the sigmoid centers around ~50%
  const shifted = (rawScore - 0.35) * 5;

  let probability: number;

  switch (model) {
    case "Decision Tree": {
      // More binary-ish: push toward extremes
      const base = sigmoid(shifted);
      probability = base > 0.5 ? Math.min(base * 1.3, 0.97) : base * 0.7;
      break;
    }
    case "Neural Network": {
      // Smooth probability
      probability = sigmoid(shifted * 0.85);
      break;
    }
    case "Gradient Boosting": {
      // Balanced, slightly higher confidence
      probability = sigmoid(shifted * 1.05);
      break;
    }
  }

  return parseFloat((probability * 100).toFixed(1));
}

function getConfidenceInterval(
  prediction: number,
  model: ModelType
): [number, number] {
  let width: number;
  switch (model) {
    case "Decision Tree":
      width = 8;
      break;
    case "Neural Network":
      width = 12;
      break;
    case "Gradient Boosting":
      width = 6;
      break;
  }
  return [
    Math.max(0, parseFloat((prediction - width).toFixed(1))),
    Math.min(100, parseFloat((prediction + width).toFixed(1))),
  ];
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function PipelineStageCard({
  title,
  active,
  completed,
  children,
}: {
  title: string;
  active: boolean;
  completed: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        flex: "1 1 0",
        minWidth: 180,
        background: active
          ? "rgba(251,191,36,0.06)"
          : completed
          ? "rgba(74,222,128,0.04)"
          : "rgba(255,255,255,0.02)",
        border: `1px solid ${
          active ? AMBER_BORDER : completed ? "rgba(74,222,128,0.3)" : "rgba(255,255,255,0.08)"
        }`,
        borderRadius: 10,
        padding: "12px 14px",
        transition: "all 0.4s ease",
        opacity: active || completed ? 1 : 0.4,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontFamily: "monospace",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 8,
          color: active ? AMBER : completed ? "#4ade80" : "rgba(255,255,255,0.4)",
          fontWeight: 600,
        }}
      >
        {completed && !active ? "\u2713 " : ""}
        {title}
      </div>
      {children}
    </div>
  );
}

function PipelineArrow({ active }: { active: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "0 4px",
        color: active ? AMBER : "rgba(255,255,255,0.15)",
        fontSize: 18,
        transition: "color 0.4s ease",
        flexShrink: 0,
      }}
    >
      &rarr;
    </div>
  );
}

function FeatureBar({
  feature,
  maxValue,
  animated,
  hoveredFeature,
  onHover,
}: {
  feature: FeatureImportance;
  maxValue: number;
  animated: boolean;
  hoveredFeature: string | null;
  onHover: (name: string | null) => void;
}) {
  const isHovered = hoveredFeature === feature.name;
  const barWidth = animated ? (feature.value / maxValue) * 100 : 0;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 6,
        cursor: "pointer",
      }}
      onMouseEnter={() => onHover(feature.name)}
      onMouseLeave={() => onHover(null)}
    >
      <div
        style={{
          width: 100,
          fontSize: 11,
          fontFamily: "monospace",
          color: isHovered ? feature.color : "rgba(255,255,255,0.6)",
          textAlign: "right",
          flexShrink: 0,
          transition: "color 0.2s ease",
        }}
      >
        {feature.name}
      </div>
      <div
        style={{
          flex: 1,
          height: 20,
          background: "rgba(255,255,255,0.04)",
          borderRadius: 4,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            width: `${barWidth}%`,
            height: "100%",
            background: `linear-gradient(90deg, ${feature.color}88, ${feature.color})`,
            borderRadius: 4,
            transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
            transform: isHovered ? "scaleY(1.15)" : "scaleY(1)",
            transformOrigin: "bottom",
          }}
        />
        {isHovered && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: `${barWidth}%`,
              transform: "translate(8px, -50%)",
              fontSize: 10,
              fontFamily: "monospace",
              color: feature.color,
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            {feature.value}% importance
          </div>
        )}
      </div>
      <div
        style={{
          width: 32,
          fontSize: 11,
          fontFamily: "monospace",
          color: "rgba(255,255,255,0.5)",
          textAlign: "left",
          flexShrink: 0,
        }}
      >
        {feature.value}%
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function PredictiveMLWidget() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  /* ---- State ---- */
  const [customerData, setCustomerData] = useState<CustomerData>({
    name: "Alex Johnson",
    age: 34,
    income: 85000,
    previousCars: 2,
    city: "New York",
  });
  const [model, setModel] = useState<ModelType>("Gradient Boosting");
  const [pipelineStage, setPipelineStage] = useState(-1); // -1 = idle
  const [predictionResult, setPredictionResult] = useState<number | null>(null);
  const [confidenceInterval, setConfidenceInterval] = useState<
    [number, number] | null
  >(null);
  const [hoveredFeature, setHoveredFeature] = useState<string | null>(null);
  const [showFeatureChart, setShowFeatureChart] = useState(false);
  const [probabilityFill, setProbabilityFill] = useState(0);
  const animRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---- Derived features (computed deterministically) ---- */
  const derivedFeatures: DerivedFeatures = {
    age_group: getAgeGroup(customerData.age),
    income_bracket: getIncomeBracket(customerData.income),
    car_history_score: parseFloat(
      getCarHistoryScore(customerData.previousCars).toFixed(3)
    ),
  };

  const encodedFeatures = encodeFeatures(customerData, derivedFeatures);

  /* ---- Cleanup ---- */
  useEffect(() => {
    return () => {
      if (animRef.current) clearTimeout(animRef.current);
    };
  }, []);

  /* ---- Run pipeline animation ---- */
  const runPipeline = useCallback(() => {
    // Reset
    setPipelineStage(0);
    setPredictionResult(null);
    setConfidenceInterval(null);
    setShowFeatureChart(false);
    setProbabilityFill(0);

    if (animRef.current) clearTimeout(animRef.current);

    // Stage 0: Raw Data (immediate)
    animRef.current = setTimeout(() => {
      setPipelineStage(1); // Feature Engineering

      animRef.current = setTimeout(() => {
        setPipelineStage(2); // Encoding

        animRef.current = setTimeout(() => {
          setPipelineStage(3); // Prediction

          const result = computePrediction(encodedFeatures, model);
          const ci = getConfidenceInterval(result, model);

          // Animate probability fill
          const steps = 30;
          let currentStep = 0;
          const fillInterval = setInterval(() => {
            currentStep++;
            const progress = currentStep / steps;
            // Ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            setProbabilityFill(result * eased);

            if (currentStep >= steps) {
              clearInterval(fillInterval);
              setPredictionResult(result);
              setConfidenceInterval(ci);
              setShowFeatureChart(true);
              setPipelineStage(4); // all done
            }
          }, 30);
        }, 600);
      }, 600);
    }, 600);
  }, [encodedFeatures, model]);

  /* ---- Handlers ---- */
  const updateField = useCallback(
    (field: keyof CustomerData, value: string | number) => {
      setCustomerData((prev) => ({ ...prev, [field]: value }));
      // Reset pipeline when data changes
      setPipelineStage(-1);
      setPredictionResult(null);
      setConfidenceInterval(null);
      setShowFeatureChart(false);
      setProbabilityFill(0);
    },
    []
  );

  const handleModelChange = useCallback((newModel: ModelType) => {
    setModel(newModel);
    setPipelineStage(-1);
    setPredictionResult(null);
    setConfidenceInterval(null);
    setShowFeatureChart(false);
    setProbabilityFill(0);
  }, []);

  /* ---- Render guard ---- */
  if (!mounted) {
    return (
      <div
        className="widget-container bg-card border border-border rounded-xl p-6 my-8 overflow-hidden"
        style={{ minHeight: 600 }}
      />
    );
  }

  /* ---- Prediction color ---- */
  const predColor =
    predictionResult !== null
      ? predictionResult > 70
        ? "#4ade80"
        : predictionResult >= 40
        ? "#fbbf24"
        : "#f87171"
      : AMBER;

  const predLabel =
    predictionResult !== null
      ? predictionResult > 70
        ? "Likely to buy"
        : predictionResult >= 40
        ? "Uncertain"
        : "Unlikely to buy"
      : "";

  /* ---- Format income ---- */
  const formatIncome = (v: number) => {
    if (v >= 1000) return `$${(v / 1000).toFixed(0)}k`;
    return `$${v}`;
  };

  return (
    <div className="widget-container bg-card border border-border rounded-xl p-6 my-8 overflow-hidden">
      {/* Label */}
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-4 font-mono">
        Interactive &middot; Predictive ML Pipeline
      </div>

      {/* Title + Model toggle */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-lg font-semibold text-foreground m-0">
          Car Purchase Prediction
        </h3>
        <div className="flex gap-1">
          {(["Decision Tree", "Neural Network", "Gradient Boosting"] as ModelType[]).map(
            (m) => (
              <button
                key={m}
                className="btn-mono"
                onClick={() => handleModelChange(m)}
                style={{
                  borderColor: model === m ? AMBER : undefined,
                  color: model === m ? AMBER : undefined,
                  background:
                    model === m ? AMBER_DIM : undefined,
                  fontSize: 11,
                  padding: "4px 10px",
                }}
              >
                {m}
              </button>
            )
          )}
        </div>
      </div>

      {/* Customer data form */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
          marginBottom: 16,
          padding: 16,
          background: "rgba(255,255,255,0.02)",
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* Name */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: 10,
              fontFamily: "monospace",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.4)",
              marginBottom: 4,
              letterSpacing: "0.05em",
            }}
          >
            Name
          </label>
          <input
            type="text"
            value={customerData.name}
            onChange={(e) => updateField("name", e.target.value)}
            className="w-full bg-[rgba(255,255,255,0.04)] border border-border rounded-lg px-3 py-2 font-mono text-sm text-foreground focus:outline-none transition-colors"
            style={{ borderColor: "rgba(255,255,255,0.1)" }}
            spellCheck={false}
          />
        </div>

        {/* Age slider */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: 10,
              fontFamily: "monospace",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.4)",
              marginBottom: 4,
              letterSpacing: "0.05em",
            }}
          >
            Age:{" "}
            <span style={{ color: AMBER, fontWeight: 600 }}>
              {customerData.age}
            </span>
          </label>
          <input
            type="range"
            min={18}
            max={70}
            value={customerData.age}
            onChange={(e) => updateField("age", parseInt(e.target.value))}
            style={{
              width: "100%",
              accentColor: AMBER,
              height: 6,
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 9,
              fontFamily: "monospace",
              color: "rgba(255,255,255,0.25)",
            }}
          >
            <span>18</span>
            <span>70</span>
          </div>
        </div>

        {/* Income slider */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: 10,
              fontFamily: "monospace",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.4)",
              marginBottom: 4,
              letterSpacing: "0.05em",
            }}
          >
            Income:{" "}
            <span style={{ color: AMBER, fontWeight: 600 }}>
              {formatIncome(customerData.income)}
            </span>
          </label>
          <input
            type="range"
            min={20000}
            max={200000}
            step={5000}
            value={customerData.income}
            onChange={(e) => updateField("income", parseInt(e.target.value))}
            style={{
              width: "100%",
              accentColor: AMBER,
              height: 6,
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 9,
              fontFamily: "monospace",
              color: "rgba(255,255,255,0.25)",
            }}
          >
            <span>$20k</span>
            <span>$200k</span>
          </div>
        </div>

        {/* Previous Cars */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: 10,
              fontFamily: "monospace",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.4)",
              marginBottom: 4,
              letterSpacing: "0.05em",
            }}
          >
            Previous Cars:{" "}
            <span style={{ color: AMBER, fontWeight: 600 }}>
              {customerData.previousCars}
            </span>
          </label>
          <div style={{ display: "flex", gap: 4 }}>
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => updateField("previousCars", n)}
                style={{
                  flex: 1,
                  padding: "6px 0",
                  fontSize: 12,
                  fontFamily: "monospace",
                  fontWeight: 600,
                  border: `1px solid ${
                    customerData.previousCars === n
                      ? AMBER
                      : "rgba(255,255,255,0.1)"
                  }`,
                  borderRadius: 6,
                  background:
                    customerData.previousCars === n
                      ? AMBER_DIM
                      : "rgba(255,255,255,0.02)",
                  color:
                    customerData.previousCars === n
                      ? AMBER
                      : "rgba(255,255,255,0.5)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* City dropdown */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: 10,
              fontFamily: "monospace",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.4)",
              marginBottom: 4,
              letterSpacing: "0.05em",
            }}
          >
            City
          </label>
          <select
            value={customerData.city}
            onChange={(e) => updateField("city", e.target.value)}
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              padding: "8px 12px",
              fontFamily: "monospace",
              fontSize: 13,
              color: "rgba(255,255,255,0.85)",
              cursor: "pointer",
              appearance: "none",
              WebkitAppearance: "none",
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23fbbf24' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 12px center",
            }}
          >
            {CITIES.map((c) => (
              <option
                key={c}
                value={c}
                style={{ background: "#1a1a2e", color: "#fff" }}
              >
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Predict button */}
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
        <button
          className="btn-mono"
          onClick={runPipeline}
          disabled={pipelineStage >= 0 && pipelineStage < 4}
          style={{
            borderColor: AMBER,
            color: pipelineStage >= 0 && pipelineStage < 4 ? AMBER : "#1a1a2e",
            background:
              pipelineStage >= 0 && pipelineStage < 4
                ? "transparent"
                : AMBER,
            fontWeight: 700,
            padding: "8px 24px",
            fontSize: 13,
            cursor:
              pipelineStage >= 0 && pipelineStage < 4
                ? "not-allowed"
                : "pointer",
            opacity: pipelineStage >= 0 && pipelineStage < 4 ? 0.7 : 1,
            transition: "all 0.3s ease",
          }}
        >
          {pipelineStage >= 0 && pipelineStage < 4
            ? `Processing Stage ${pipelineStage + 1}/4...`
            : pipelineStage === 4
            ? "Re-run Prediction"
            : "Predict"}
        </button>
        {pipelineStage === 4 && predictionResult !== null && (
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 12,
              color: predColor,
            }}
          >
            Pipeline complete
          </span>
        )}
      </div>

      {/* Pipeline visualization */}
      {pipelineStage >= 0 && (
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: 10,
              fontFamily: "monospace",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.4)",
              marginBottom: 10,
              letterSpacing: "0.05em",
            }}
          >
            Pipeline Stages
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "stretch",
              gap: 0,
              overflowX: "auto",
              paddingBottom: 4,
            }}
          >
            {/* Stage 0: Raw Data */}
            <PipelineStageCard
              title={PIPELINE_STAGES[0]}
              active={pipelineStage === 0}
              completed={pipelineStage > 0}
            >
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 10,
                  color: "rgba(255,255,255,0.7)",
                  lineHeight: 1.6,
                }}
              >
                <div>
                  <span style={{ color: "#a78bfa" }}>&quot;name&quot;</span>:{" "}
                  <span style={{ color: "#4ade80" }}>&quot;{customerData.name}&quot;</span>
                </div>
                <div>
                  <span style={{ color: "#a78bfa" }}>&quot;age&quot;</span>:{" "}
                  <span style={{ color: AMBER }}>{customerData.age}</span>
                </div>
                <div>
                  <span style={{ color: "#a78bfa" }}>&quot;income&quot;</span>:{" "}
                  <span style={{ color: AMBER }}>{customerData.income}</span>
                </div>
                <div>
                  <span style={{ color: "#a78bfa" }}>&quot;prev_cars&quot;</span>:{" "}
                  <span style={{ color: AMBER }}>{customerData.previousCars}</span>
                </div>
                <div>
                  <span style={{ color: "#a78bfa" }}>&quot;city&quot;</span>:{" "}
                  <span style={{ color: "#4ade80" }}>&quot;{customerData.city}&quot;</span>
                </div>
              </div>
            </PipelineStageCard>

            <PipelineArrow active={pipelineStage >= 1} />

            {/* Stage 1: Feature Engineering */}
            <PipelineStageCard
              title={PIPELINE_STAGES[1]}
              active={pipelineStage === 1}
              completed={pipelineStage > 1}
            >
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 10,
                  color: "rgba(255,255,255,0.7)",
                  lineHeight: 1.6,
                }}
              >
                <div>
                  <span style={{ color: "#22d3ee" }}>age_group</span>:{" "}
                  <span style={{ color: "#4ade80" }}>&quot;{derivedFeatures.age_group}&quot;</span>
                </div>
                <div>
                  <span style={{ color: "#22d3ee" }}>income_bracket</span>:{" "}
                  <span style={{ color: "#4ade80" }}>
                    &quot;{derivedFeatures.income_bracket}&quot;
                  </span>
                </div>
                <div>
                  <span style={{ color: "#22d3ee" }}>car_history_score</span>:{" "}
                  <span style={{ color: AMBER }}>
                    {derivedFeatures.car_history_score}
                  </span>
                </div>
                <div style={{ marginTop: 4, color: "rgba(255,255,255,0.3)", fontSize: 9 }}>
                  + original numeric features
                </div>
              </div>
            </PipelineStageCard>

            <PipelineArrow active={pipelineStage >= 2} />

            {/* Stage 2: Encoding */}
            <PipelineStageCard
              title={PIPELINE_STAGES[2]}
              active={pipelineStage === 2}
              completed={pipelineStage > 2}
            >
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 10,
                  color: "rgba(255,255,255,0.7)",
                  lineHeight: 1.6,
                }}
              >
                <div style={{ color: "#f87171", fontSize: 9, marginBottom: 2 }}>
                  name &rarr; dropped
                </div>
                <div>
                  <span style={{ color: "#a78bfa" }}>age_norm</span>:{" "}
                  <span style={{ color: AMBER }}>{encodedFeatures.age_normalized}</span>
                </div>
                <div>
                  <span style={{ color: "#a78bfa" }}>income_norm</span>:{" "}
                  <span style={{ color: AMBER }}>{encodedFeatures.income_normalized}</span>
                </div>
                <div>
                  <span style={{ color: "#a78bfa" }}>car_score</span>:{" "}
                  <span style={{ color: AMBER }}>
                    {encodedFeatures.car_history_score}
                  </span>
                </div>
                <div style={{ marginTop: 2, fontSize: 9, color: "rgba(255,255,255,0.3)" }}>
                  city &rarr; one-hot [{encodedFeatures.city_NYC},{encodedFeatures.city_LA},{encodedFeatures.city_Chicago},{encodedFeatures.city_Houston},{encodedFeatures.city_Phoenix}]
                </div>
              </div>
            </PipelineStageCard>

            <PipelineArrow active={pipelineStage >= 3} />

            {/* Stage 3: Prediction */}
            <PipelineStageCard
              title={PIPELINE_STAGES[3]}
              active={pipelineStage === 3}
              completed={pipelineStage > 3}
            >
              <div style={{ textAlign: "center", padding: "4px 0" }}>
                <div
                  style={{
                    fontSize: 10,
                    fontFamily: "monospace",
                    color: "rgba(255,255,255,0.4)",
                    marginBottom: 6,
                  }}
                >
                  {model}
                </div>
                {/* Probability bar */}
                <div
                  style={{
                    width: "100%",
                    height: 24,
                    background: "rgba(255,255,255,0.04)",
                    borderRadius: 6,
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      width: `${pipelineStage >= 3 ? probabilityFill : 0}%`,
                      height: "100%",
                      background: `linear-gradient(90deg, ${predColor}88, ${predColor})`,
                      borderRadius: 6,
                      transition:
                        pipelineStage === 3
                          ? "none"
                          : "width 0.3s ease",
                    }}
                  />
                  {pipelineStage >= 3 && (
                    <div
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        fontSize: 11,
                        fontFamily: "monospace",
                        fontWeight: 700,
                        color: "#fff",
                        textShadow: "0 1px 3px rgba(0,0,0,0.5)",
                      }}
                    >
                      {probabilityFill.toFixed(1)}%
                    </div>
                  )}
                </div>
              </div>
            </PipelineStageCard>
          </div>
        </div>
      )}

      {/* Prediction result */}
      {pipelineStage === 4 && predictionResult !== null && confidenceInterval && (
        <div
          style={{
            display: "flex",
            gap: 20,
            marginBottom: 24,
            flexWrap: "wrap",
          }}
        >
          {/* Result card */}
          <div
            style={{
              flex: "0 0 auto",
              minWidth: 200,
              background: `${predColor}10`,
              border: `1px solid ${predColor}40`,
              borderRadius: 12,
              padding: "20px 28px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 48,
                fontWeight: 800,
                fontFamily: "monospace",
                color: predColor,
                lineHeight: 1,
                marginBottom: 6,
              }}
            >
              {predictionResult}%
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: predColor,
                marginBottom: 10,
              }}
            >
              {predLabel}
            </div>

            {/* Confidence interval */}
            <div
              style={{
                fontSize: 10,
                fontFamily: "monospace",
                color: "rgba(255,255,255,0.4)",
                marginBottom: 6,
              }}
            >
              {model === "Decision Tree"
                ? "95% CI"
                : model === "Neural Network"
                ? "95% CI"
                : "95% CI"}
            </div>
            <div
              style={{
                position: "relative",
                width: "100%",
                height: 16,
                background: "rgba(255,255,255,0.04)",
                borderRadius: 4,
              }}
            >
              {/* CI range */}
              <div
                style={{
                  position: "absolute",
                  left: `${confidenceInterval[0]}%`,
                  width: `${confidenceInterval[1] - confidenceInterval[0]}%`,
                  height: "100%",
                  background: `${predColor}30`,
                  borderRadius: 4,
                  border: `1px solid ${predColor}50`,
                }}
              />
              {/* Point estimate */}
              <div
                style={{
                  position: "absolute",
                  left: `${predictionResult}%`,
                  top: "50%",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: predColor,
                  transform: "translate(-50%, -50%)",
                  boxShadow: `0 0 6px ${predColor}`,
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 9,
                fontFamily: "monospace",
                color: "rgba(255,255,255,0.3)",
                marginTop: 4,
              }}
            >
              <span>{confidenceInterval[0]}%</span>
              <span>{confidenceInterval[1]}%</span>
            </div>
          </div>

          {/* Feature importance chart */}
          <div style={{ flex: 1, minWidth: 280 }}>
            <div
              style={{
                fontSize: 10,
                fontFamily: "monospace",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.4)",
                marginBottom: 10,
                letterSpacing: "0.05em",
              }}
            >
              Feature Importance
            </div>
            {FEATURE_IMPORTANCES.map((f) => (
              <FeatureBar
                key={f.name}
                feature={f}
                maxValue={40}
                animated={showFeatureChart}
                hoveredFeature={hoveredFeature}
                onHover={setHoveredFeature}
              />
            ))}

            {/* Model comparison note */}
            <div
              style={{
                marginTop: 12,
                padding: "8px 12px",
                background: "rgba(255,255,255,0.02)",
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.05)",
                fontSize: 10,
                fontFamily: "monospace",
                color: "rgba(255,255,255,0.4)",
                lineHeight: 1.6,
              }}
            >
              <span style={{ color: AMBER, fontWeight: 600 }}>
                {model}
              </span>
              {model === "Decision Tree" && (
                <span>
                  {" "}
                  -- Produces high-confidence, binary-leaning predictions.
                  Fast but may overfit.
                </span>
              )}
              {model === "Neural Network" && (
                <span>
                  {" "}
                  -- Smooth probability outputs with wider confidence
                  intervals. Flexible but slower.
                </span>
              )}
              {model === "Gradient Boosting" && (
                <span>
                  {" "}
                  -- Balanced predictions with tight confidence intervals.
                  Industry standard for tabular data.
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Idle state hint */}
      {pipelineStage === -1 && (
        <div
          style={{
            textAlign: "center",
            padding: "32px 20px",
            color: "rgba(255,255,255,0.25)",
            fontFamily: "monospace",
            fontSize: 12,
            border: "1px dashed rgba(255,255,255,0.08)",
            borderRadius: 10,
          }}
        >
          Adjust customer data above, choose a model, then click{" "}
          <span style={{ color: AMBER, fontWeight: 600 }}>Predict</span> to
          run the ML pipeline
        </div>
      )}
    </div>
  );
}
