"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BpeTokenizationWidget,
  EmbeddingsWidget,
  AttentionHeadsWidget,
  TransformerArchWidget,
  ComputerVisionWidget,
  RagPipelineWidget,
  FineTuningWidget,
  QuantizationWidget,
  PredictiveMLWidget,
} from "@/components/widgets";

const SECTIONS = [
  { id: "predictive", label: "Predictive ML", num: "01" },
  { id: "tokenization", label: "Tokenization", num: "02" },
  { id: "embeddings", label: "Embeddings", num: "03" },
  { id: "attention", label: "Attention", num: "04" },
  { id: "transformer", label: "Transformers", num: "05" },
  { id: "vision", label: "Vision", num: "06" },
  { id: "rag", label: "RAG", num: "07" },
  { id: "finetuning", label: "Fine-tuning", num: "08" },
  { id: "quantization", label: "Quantization", num: "09" },
];

export default function Home() {
  const [activeSection, setActiveSection] = useState<string>("");

  useEffect(() => {
    // Scroll-triggered reveal
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    );
    document.querySelectorAll(".reveal").forEach((el) => revealObserver.observe(el));

    // Active section tracking for nav
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { threshold: 0.2, rootMargin: "-80px 0px -60% 0px" }
    );
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) sectionObserver.observe(el);
    });

    return () => {
      revealObserver.disconnect();
      sectionObserver.disconnect();
    };
  }, []);

  const scrollToSection = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  return (
    <main>
      {/* Noise texture overlay */}
      <div className="noise-overlay" aria-hidden="true" />

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border px-4 md:px-6 py-3 flex items-center gap-4" role="navigation" aria-label="Main navigation">
        <a href="#" className="flex items-center gap-2.5 font-bold text-foreground no-underline shrink-0" aria-label="Home">
          <div className="w-7 h-7 rounded-md flex items-center justify-center font-extrabold text-sm" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
            D
          </div>
          <span className="hidden md:inline text-sm font-semibold tracking-tight">Data in AI</span>
        </a>
        <div className="flex gap-3 md:gap-4 overflow-x-auto whitespace-nowrap scrollbar-hide ml-auto">
          {SECTIONS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => scrollToSection(id)}
              className={`nav-link text-xs md:text-sm font-medium transition-colors bg-transparent border-none cursor-pointer p-0 ${
                activeSection === id ? "text-foreground active" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      {/* Hero */}
      <header className="relative overflow-hidden py-20 md:py-28 px-6 hero-gradient">
        <div className="hero-glow" aria-hidden="true" />
        <div className="max-w-2xl mx-auto relative">
          <div className="flex items-center gap-3 mb-8 text-sm flex-wrap">
            <span className="font-mono text-xs text-muted-foreground" style={{ letterSpacing: "0.08em" }}>2026</span>
            <span className="text-muted-foreground opacity-40">/</span>
            <span className="font-mono text-xs text-muted-foreground" style={{ letterSpacing: "0.08em" }}>Interactive guide</span>
            <span className="text-muted-foreground opacity-40">/</span>
            <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: "rgba(232, 115, 74, 0.1)", color: "var(--primary)", letterSpacing: "0.05em" }}>
              9 explorations
            </span>
          </div>
          <h1 className="heading-display text-4xl md:text-6xl mb-5">
            Data in the AI<br />Revolution
          </h1>
          <p className="text-lg md:text-xl leading-relaxed max-w-xl" style={{ color: "var(--muted-foreground)" }}>
            From <span className="text-predictive">predictive ML</span> and{" "}
            <span className="text-tokenization">tokenization</span> to{" "}
            <span className="text-embeddings">embeddings</span>,{" "}
            <span className="text-attention">attention</span>,{" "}
            <span className="text-transformer">transformers</span>,{" "}
            <span className="text-vision">vision</span>,{" "}
            <span className="text-rag">RAG</span>,{" "}
            <span className="text-finetune">fine-tuning</span>, and{" "}
            <span className="text-quantization">quantization</span>. Explore every concept hands-on.
          </p>
        </div>
      </header>

      {/* Content */}
      <div id="main-content" className="max-w-2xl mx-auto px-6 pb-28">
        {/* Table of Contents */}
        <div className="bg-card border border-border rounded-xl p-6 md:p-8 my-10">
          <p className="font-mono text-xs tracking-wider mb-5" style={{ color: "var(--primary)", opacity: 0.6 }}>
            Contents
          </p>
          <div className="space-y-0">
            {SECTIONS.map(({ id, label, num }, i) => (
              <button
                key={id}
                onClick={() => scrollToSection(id)}
                className="toc-item w-full text-left bg-transparent border-none cursor-pointer flex items-center gap-3 py-2.5 px-2 rounded-md transition-colors hover:bg-[rgba(255,255,255,0.03)]"
              >
                <span className="font-mono text-xs" style={{ color: "var(--primary)", opacity: 0.4, minWidth: "1.5rem" }}>
                  {num}
                </span>
                <span className="text-muted-foreground text-sm font-medium hover:text-foreground transition-colors">
                  {getSectionDescription(id)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ===== Predictive ML Section ===== */}
        <section id="predictive" className="reveal scroll-mt-20">
          <SectionHeader num="01" title="The predictive ML pipeline" />
          <p className="text-muted-foreground mb-4 leading-relaxed">
            Before the era of large language models, the dominant paradigm in AI was <span className="text-predictive">predictive machine learning</span> — training models on structured, tabular data to forecast outcomes. This is still the backbone of most production AI systems in industries from finance to healthcare.
          </p>
          <p className="text-muted-foreground mb-4 leading-relaxed">
            The key challenge is <strong className="text-foreground font-semibold">feature engineering</strong>: converting raw data (names, cities, categories) into numerical features a model can process. Categorical variables need encoding, continuous variables need scaling, and domain knowledge determines which derived features matter most.
          </p>
          <p className="text-muted-foreground mb-5 leading-relaxed">
            Adjust the customer data below and watch how the pipeline transforms raw inputs through <span className="text-predictive">encoding</span>, <span className="text-predictive">feature selection</span>, and <span className="text-predictive">model inference</span> to produce a purchase probability prediction.
          </p>
          <PredictiveMLWidget />
          <p className="text-muted-foreground mb-4 leading-relaxed">
            Notice how <span className="text-predictive">feature importance</span> reveals which variables drive predictions. Income and age dominate because they correlate most strongly with purchasing behavior. The model type matters too: decision trees give sharper predictions while neural networks produce smoother probability distributions.
          </p>
          <div className="section-divider" />
        </section>

        {/* ===== Tokenization Section ===== */}
        <section id="tokenization" className="reveal scroll-mt-20">
          <SectionHeader num="02" title="BPE tokenization" />
          <p className="text-muted-foreground mb-4 leading-relaxed">
            Language models don&apos;t read text the way humans do. Before any processing, text must be split into <span className="text-tokenization">tokens</span> — discrete units the model understands. <strong className="text-foreground font-semibold">Byte Pair Encoding (BPE)</strong> is the most widely used tokenization algorithm, powering GPT, LLaMA, and most modern LLMs.
          </p>
          <p className="text-muted-foreground mb-4 leading-relaxed">
            BPE starts with individual characters and iteratively merges the most frequent adjacent pair into a new token. After enough merges, common words become single tokens while rare words stay split into subword pieces. This elegantly handles any text, including words the model has never seen before.
          </p>
          <p className="text-muted-foreground mb-5 leading-relaxed">
            Type any text below and step through the BPE merge process. Watch how character pairs get combined into larger tokens based on frequency.
          </p>
          <BpeTokenizationWidget />
          <p className="text-muted-foreground mb-4 leading-relaxed">
            The resulting vocabulary balances efficiency (common words are single tokens) with coverage (any text can be represented). A typical LLM vocabulary contains 32,000 to 128,000 tokens, each mapped to an integer ID that the model processes.
          </p>
          <div className="section-divider" />
        </section>

        {/* ===== Embeddings Section ===== */}
        <section id="embeddings" className="reveal scroll-mt-20">
          <SectionHeader num="03" title="Embeddings: the language of vectors" />
          <p className="text-muted-foreground mb-4 leading-relaxed">
            Once text is tokenized, each token is mapped to a dense <span className="text-embeddings">embedding</span> — a vector of hundreds of floating-point numbers (768 for BERT, 4096+ for GPT-4) that encodes semantic meaning. Words with similar meanings end up as vectors pointing in similar directions.
          </p>
          <p className="text-muted-foreground mb-4 leading-relaxed">
            This is what makes modern NLP work: the geometric structure of embedding space captures relationships. &quot;King&quot; is to &quot;queen&quot; as &quot;man&quot; is to &quot;woman&quot; — not by a rule, but by the learned vector arithmetic. <span className="text-embeddings">Cosine similarity</span> between two vectors measures how semantically related they are.
          </p>
          <p className="text-muted-foreground mb-5 leading-relaxed">
            Explore the embedding space below. Click words to add them, hover to see similarity connections. Words within the same semantic cluster naturally group together.
          </p>
          <EmbeddingsWidget />
          <p className="text-muted-foreground mb-4 leading-relaxed">
            The heatmap view reveals the full similarity structure. Notice how &quot;dog&quot; and &quot;cat&quot; score high similarity (both animals), while &quot;dog&quot; and &quot;algorithm&quot; are nearly orthogonal (unrelated concepts). This geometric encoding is what enables semantic search, classification, and every downstream NLP task.
          </p>
          <div className="section-divider" />
        </section>

        {/* ===== Attention Section ===== */}
        <section id="attention" className="reveal scroll-mt-20">
          <SectionHeader num="04" title="Multi-head self-attention" />
          <p className="text-muted-foreground mb-4 leading-relaxed">
            The <span className="text-attention">self-attention mechanism</span> is the core innovation that makes transformers powerful. For each token, attention computes how much every other token in the sequence should influence its representation. This is done through <strong className="text-foreground font-semibold">queries</strong>, <strong className="text-foreground font-semibold">keys</strong>, and <strong className="text-foreground font-semibold">values</strong> — a token&apos;s query asks &quot;what am I looking for?&quot;, each token&apos;s key answers &quot;what do I contain?&quot;, and the value provides the actual information to pass along.
          </p>
          <p className="text-muted-foreground mb-4 leading-relaxed">
            <strong className="text-foreground font-semibold">Multi-head</strong> attention runs this process multiple times in parallel with different learned projections. Each <span className="text-attention">head</span> learns to attend to different linguistic patterns: one head might track syntactic relationships, another might focus on adjacent tokens, and another might capture long-range dependencies.
          </p>
          <p className="text-muted-foreground mb-5 leading-relaxed">
            Select different attention heads below and hover over tokens to see what each head attends to. Notice how each head captures a different type of linguistic relationship.
          </p>
          <AttentionHeadsWidget />
          <p className="text-muted-foreground mb-4 leading-relaxed">
            The <span className="text-attention">entropy</span> of each head reveals whether it focuses narrowly on specific tokens (low entropy) or distributes attention broadly (high entropy). Positional heads tend to have focused attention on neighbors, while global heads spread attention more evenly across the sequence.
          </p>
          <div className="section-divider" />
        </section>

        {/* ===== Transformer Architecture Section ===== */}
        <section id="transformer" className="reveal scroll-mt-20">
          <SectionHeader num="05" title="Transformer architectures" />
          <p className="text-muted-foreground mb-4 leading-relaxed">
            The <span className="text-transformer">transformer</span> is the architecture behind every major language model. Introduced in 2017, it replaced recurrent networks with pure attention, enabling massive parallelization and capturing long-range dependencies without the vanishing gradient problem.
          </p>
          <p className="text-muted-foreground mb-4 leading-relaxed">
            Three variants dominate modern AI: <strong className="text-foreground font-semibold">encoder-only</strong> models like BERT excel at understanding tasks (classification, NER) using bidirectional attention. <strong className="text-foreground font-semibold">Decoder-only</strong> models like GPT use causal (masked) attention for text generation. <strong className="text-foreground font-semibold">Encoder-decoder</strong> models like T5 combine both for sequence-to-sequence tasks like translation.
          </p>
          <p className="text-muted-foreground mb-5 leading-relaxed">
            Toggle between architectures below and click any component to learn what it does. Hit <strong className="text-foreground font-semibold">Play</strong> to animate data flowing through the layers.
          </p>
          <TransformerArchWidget />
          <p className="text-muted-foreground mb-4 leading-relaxed">
            Each transformer block applies the same operations: multi-head attention, residual connection with layer normalization, then a feed-forward network with another residual connection. Stacking these blocks (12 for BERT-base, 32 for LLaMA-7B, up to 100+ for the largest models) gives the model progressively deeper representations of the input.
          </p>
          <div className="section-divider" />
        </section>

        {/* ===== Computer Vision Section ===== */}
        <section id="vision" className="reveal scroll-mt-20">
          <SectionHeader num="06" title="Computer vision detection" />
          <p className="text-muted-foreground mb-4 leading-relaxed">
            <span className="text-vision">Computer vision</span> teaches machines to interpret visual data. Object detection, locating and classifying objects within images, is one of the most impactful applications, powering everything from autonomous vehicles to medical imaging.
          </p>
          <p className="text-muted-foreground mb-4 leading-relaxed">
            Modern detectors output <strong className="text-foreground font-semibold">bounding boxes</strong> with class labels and <strong className="text-foreground font-semibold">confidence scores</strong>. A confidence threshold filters out uncertain detections: too low and you get false positives, too high and you miss real objects. Finding the right threshold is a core challenge in production vision systems.
          </p>
          <p className="text-muted-foreground mb-5 leading-relaxed">
            Drag the <strong className="text-foreground font-semibold">confidence threshold</strong> slider below to see how it affects which objects are detected. Toggle between detection modes to see bounding boxes and segmentation masks.
          </p>
          <ComputerVisionWidget />
          <p className="text-muted-foreground mb-4 leading-relaxed">
            The JSON output below the visualization shows exactly what a vision API returns: class labels, confidence scores, and normalized bounding box coordinates. This structured output is what downstream systems consume for decision-making.
          </p>
          <div className="section-divider" />
        </section>

        {/* ===== RAG Section ===== */}
        <section id="rag" className="reveal scroll-mt-20">
          <SectionHeader num="07" title="RAG: retrieval-augmented generation" />
          <p className="text-muted-foreground mb-4 leading-relaxed">
            <span className="text-rag">Retrieval-Augmented Generation</span> is the dominant pattern for building AI applications that need factual, up-to-date answers. Instead of relying solely on what the LLM memorized during training, RAG retrieves relevant documents and injects them into the prompt as context.
          </p>
          <p className="text-muted-foreground mb-4 leading-relaxed">
            The pipeline has six stages: the user&apos;s <span className="text-rag">question</span> is embedded into a vector, that vector is used for <span className="text-embeddings">similarity search</span> against a document store, the top-k <span className="text-rag">retrieved chunks</span> are assembled into a prompt template, and the LLM generates a <span className="text-rag">grounded response</span>.
          </p>
          <p className="text-muted-foreground mb-5 leading-relaxed">
            Type a question and click <strong className="text-foreground font-semibold">Run Pipeline</strong> to watch each stage execute. Click any stage to inspect its intermediate output.
          </p>
          <RagPipelineWidget />
          <p className="text-muted-foreground mb-4 leading-relaxed">
            The power of RAG is transparency: you can inspect and debug every stage. If the response is wrong, check the retrieved chunks. If the chunks are irrelevant, improve your embeddings or chunking strategy. This observability is what makes RAG production-ready.
          </p>
          <div className="section-divider" />
        </section>

        {/* ===== Fine-Tuning Section ===== */}
        <section id="finetuning" className="reveal scroll-mt-20">
          <SectionHeader num="08" title="Fine-tuning data formats" />
          <p className="text-muted-foreground mb-4 leading-relaxed">
            <span className="text-finetune">Fine-tuning</span> adapts a pre-trained model to a specific task. The data format determines what the model learns. Three approaches dominate: <strong className="text-foreground font-semibold">Supervised Fine-Tuning (SFT)</strong> uses instruction-response pairs, <strong className="text-foreground font-semibold">RLHF</strong> uses human preference rankings, and <strong className="text-foreground font-semibold">DPO</strong> simplifies preference learning without a separate reward model.
          </p>
          <p className="text-muted-foreground mb-4 leading-relaxed">
            Data quality trumps quantity in fine-tuning. A curated dataset of 1,000 high-quality examples consistently outperforms 100,000 noisy ones. Each approach requires a specific data structure, and getting the format right is essential before training begins.
          </p>
          <p className="text-muted-foreground mb-5 leading-relaxed">
            Switch between the three formats below to see how training data is structured. Edit examples to see the JSON format update in real time.
          </p>
          <FineTuningWidget />
          <p className="text-muted-foreground mb-4 leading-relaxed">
            The key insight: SFT teaches the model <em>what</em> to say, while RLHF and DPO teach it <em>how</em> to say it by comparing preferred vs. rejected responses. In practice, most models go through SFT first, then RLHF or DPO for alignment, which is why understanding all three formats matters.
          </p>
          <div className="section-divider" />
        </section>

        {/* ===== Quantization Section ===== */}
        <section id="quantization" className="reveal scroll-mt-20">
          <SectionHeader num="09" title="Model quantization" />
          <p className="text-muted-foreground mb-4 leading-relaxed">
            A 70-billion parameter model in FP32 requires 280 GB of memory, far too much for most hardware. <span className="text-quantization">Quantization</span> compresses model weights from high-precision floating point (FP32) to lower-precision formats (FP16, INT8, INT4), dramatically reducing memory and compute requirements.
          </p>
          <p className="text-muted-foreground mb-4 leading-relaxed">
            The process works by mapping continuous float values to discrete integer bins. A <strong className="text-foreground font-semibold">scale factor</strong> and <strong className="text-foreground font-semibold">zero point</strong> define the mapping. The trade-off is precision: each weight gets rounded, introducing <span className="text-quantization">quantization error</span>. Remarkably, INT8 quantization typically retains 99%+ of model accuracy while cutting size by 4x.
          </p>
          <p className="text-muted-foreground mb-5 leading-relaxed">
            Toggle between bit widths below and watch how weight values get compressed. Hover over matrix cells to see the exact quantization error for each weight.
          </p>
          <QuantizationWidget />
          <p className="text-muted-foreground mb-4 leading-relaxed">
            The error heatmap reveals which weights suffer most from quantization, typically those near the boundaries between integer bins. Advanced techniques like GPTQ and AWQ use calibration data to minimize error on the weights that matter most, preserving model quality even at INT4 precision.
          </p>
        </section>

        {/* ===== Conclusion ===== */}
        <section className="reveal scroll-mt-20 mt-16">
          <h2 className="heading-display text-3xl md:text-4xl mb-5">The full picture</h2>
          <p className="text-muted-foreground mb-4 leading-relaxed">
            Every concept in this guide connects. <span className="text-predictive">Predictive ML</span> established that data must be encoded numerically. <span className="text-tokenization">Tokenization</span> does this for text via BPE. <span className="text-embeddings">Embeddings</span> transform tokens into rich vector representations. <span className="text-attention">Attention</span> lets models weigh which parts of the input matter for each output. <span className="text-transformer">Transformers</span> stack these mechanisms into the architectures that power modern AI.
          </p>
          <p className="text-muted-foreground mb-4 leading-relaxed">
            <span className="text-vision">Computer vision</span> extends these ideas to images. <span className="text-rag">RAG</span> grounds language models in real knowledge. <span className="text-finetune">Fine-tuning</span> adapts models to specific tasks. And <span className="text-quantization">quantization</span> makes it all run efficiently on real hardware.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Understanding data, how it&apos;s structured, encoded, transformed, and consumed by models, is the foundation of every AI system.
          </p>
        </section>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-14 px-6" role="contentinfo">
        <div className="max-w-2xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-6 h-6 rounded-md flex items-center justify-center font-extrabold text-xs" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>D</div>
                <span className="font-semibold tracking-tight">Data in the AI Revolution</span>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-md">
                9 interactive explorations covering the core concepts that power modern AI systems.
              </p>
            </div>
            <div className="flex flex-col gap-1.5 text-sm">
              <a href="https://github.com/jasperan/data-in-ai-revolution" className="text-muted-foreground hover:text-foreground no-underline transition-colors">
                Source code
              </a>
              <span className="text-muted-foreground text-xs" style={{ opacity: 0.5 }}>
                Built by Nacho Martinez
              </span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  Section Header Component                                          */
/* ------------------------------------------------------------------ */
function SectionHeader({ num, title }: { num: string; title: string }) {
  return (
    <div className="mt-16 mb-5">
      <span className="section-number">{num}</span>
      <h2 className="heading-display text-3xl md:text-4xl mt-1">{title}</h2>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TOC descriptions                                                  */
/* ------------------------------------------------------------------ */
function getSectionDescription(id: string): string {
  const descriptions: Record<string, string> = {
    predictive: "How predictive ML pipelines transform raw data into predictions",
    tokenization: "How Byte Pair Encoding tokenizes text into subword units",
    embeddings: "How embeddings capture semantic meaning as dense vectors",
    attention: "How multi-head attention lets models focus on relevant context",
    transformer: "How encoder, decoder, and encoder-decoder transformers differ",
    vision: "How computer vision detects and classifies objects in images",
    rag: "How RAG pipelines ground LLM responses in retrieved knowledge",
    finetuning: "How SFT, RLHF, and DPO prepare data for model fine-tuning",
    quantization: "How quantization compresses models from FP32 to INT8 and beyond",
  };
  return descriptions[id] ?? "";
}
