"use client";

import { useEffect } from "react";
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

export default function Home() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    );
    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <main>
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/85 backdrop-blur-xl border-b border-border px-4 md:px-6 py-3 flex items-center gap-4">
        <a href="#" className="flex items-center gap-2 font-bold text-foreground no-underline shrink-0">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center font-extrabold text-white text-sm">
            D
          </div>
          <span className="hidden md:inline text-sm font-semibold">Data in AI</span>
        </a>
        <div className="flex gap-3 md:gap-4 overflow-x-auto whitespace-nowrap scrollbar-hide ml-auto">
          <a href="#predictive" className="text-muted-foreground no-underline text-xs md:text-sm font-medium hover:text-foreground transition-colors">Predictive ML</a>
          <a href="#tokenization" className="text-muted-foreground no-underline text-xs md:text-sm font-medium hover:text-foreground transition-colors">Tokenization</a>
          <a href="#embeddings" className="text-muted-foreground no-underline text-xs md:text-sm font-medium hover:text-foreground transition-colors">Embeddings</a>
          <a href="#attention" className="text-muted-foreground no-underline text-xs md:text-sm font-medium hover:text-foreground transition-colors">Attention</a>
          <a href="#transformer" className="text-muted-foreground no-underline text-xs md:text-sm font-medium hover:text-foreground transition-colors">Transformers</a>
          <a href="#vision" className="text-muted-foreground no-underline text-xs md:text-sm font-medium hover:text-foreground transition-colors">Vision</a>
          <a href="#rag" className="text-muted-foreground no-underline text-xs md:text-sm font-medium hover:text-foreground transition-colors">RAG</a>
          <a href="#finetuning" className="text-muted-foreground no-underline text-xs md:text-sm font-medium hover:text-foreground transition-colors">Fine-Tuning</a>
          <a href="#quantization" className="text-muted-foreground no-underline text-xs md:text-sm font-medium hover:text-foreground transition-colors">Quantization</a>
        </div>
      </nav>

      {/* Hero */}
      <div className="relative overflow-hidden py-16 px-6 hero-gradient">
        <div className="hero-glow" />
        <div className="max-w-3xl mx-auto relative">
          <div className="flex items-center gap-3 mb-8 text-sm flex-wrap">
            <span className="text-muted-foreground">2026</span>
            <span className="text-muted-foreground">&middot;</span>
            <span className="text-muted-foreground">Interactive Guide</span>
            <span className="text-muted-foreground">&middot;</span>
            <span className="bg-purple-500/15 text-purple-300 px-2 py-0.5 rounded text-xs font-semibold uppercase">
              AI &amp; Data Science
            </span>
            <span className="bg-blue-500/15 text-blue-300 px-2 py-0.5 rounded text-xs font-semibold uppercase">
              Learn by Play
            </span>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold leading-tight tracking-tight mb-4">
            Data in the AI Revolution<br />from the ground up
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl">
            From <span className="text-predictive">predictive ML</span> and{" "}
            <span className="text-tokenization">tokenization</span> to{" "}
            <span className="text-embeddings">embeddings</span>,{" "}
            <span className="text-attention">attention mechanisms</span>,{" "}
            <span className="text-transformer">transformer architectures</span>,{" "}
            <span className="text-vision">computer vision</span>,{" "}
            <span className="text-rag">RAG pipelines</span>,{" "}
            <span className="text-finetune">fine-tuning</span>, and{" "}
            <span className="text-quantization">quantization</span> — explore every concept hands-on.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 pb-24">
        {/* Table of Contents */}
        <div className="bg-card border border-border rounded-xl p-6 my-8">
          <h4 className="font-semibold mb-3">In this interactive guide, you will learn:</h4>
          <ul className="list-disc pl-5 space-y-1">
            <li><a href="#predictive" className="text-muted-foreground no-underline hover:text-amber-400">How predictive ML pipelines transform raw data into predictions</a></li>
            <li><a href="#tokenization" className="text-muted-foreground no-underline hover:text-orange-400">How Byte Pair Encoding tokenizes text into subword units</a></li>
            <li><a href="#embeddings" className="text-muted-foreground no-underline hover:text-cyan-400">How embeddings capture semantic meaning as dense vectors</a></li>
            <li><a href="#attention" className="text-muted-foreground no-underline hover:text-purple-400">How multi-head attention lets models focus on relevant context</a></li>
            <li><a href="#transformer" className="text-muted-foreground no-underline hover:text-sky-400">How encoder, decoder, and encoder-decoder transformers differ</a></li>
            <li><a href="#vision" className="text-muted-foreground no-underline hover:text-green-400">How computer vision detects and classifies objects in images</a></li>
            <li><a href="#rag" className="text-muted-foreground no-underline hover:text-orange-300">How RAG pipelines ground LLM responses in retrieved knowledge</a></li>
            <li><a href="#finetuning" className="text-muted-foreground no-underline hover:text-pink-400">How SFT, RLHF, and DPO prepare data for model fine-tuning</a></li>
            <li><a href="#quantization" className="text-muted-foreground no-underline hover:text-emerald-400">How quantization compresses models from FP32 to INT8 and beyond</a></li>
          </ul>
        </div>

        {/* ===== Predictive ML Section ===== */}
        <section id="predictive" className="reveal scroll-mt-16">
          <h2 className="text-3xl font-bold leading-tight mt-14 mb-4">The Predictive ML Pipeline</h2>
          <p className="text-muted-foreground mb-4">
            Before the era of large language models, the dominant paradigm in AI was <span className="text-predictive">predictive machine learning</span> — training models on structured, tabular data to forecast outcomes. This is still the backbone of most production AI systems in industries from finance to healthcare.
          </p>
          <p className="text-muted-foreground mb-4">
            The key challenge is <strong>feature engineering</strong>: converting raw data (names, cities, categories) into numerical features a model can process. Categorical variables need encoding, continuous variables need scaling, and domain knowledge determines which derived features matter most.
          </p>
          <p className="text-muted-foreground mb-4">
            Adjust the customer data below and watch how the pipeline transforms raw inputs through <span className="text-predictive">encoding</span>, <span className="text-predictive">feature selection</span>, and <span className="text-predictive">model inference</span> to produce a purchase probability prediction.
          </p>
          <PredictiveMLWidget />
          <p className="text-muted-foreground mb-4">
            Notice how <span className="text-predictive">feature importance</span> reveals which variables drive predictions. Income and age dominate because they correlate most strongly with purchasing behavior. The model type matters too — decision trees give sharper predictions while neural networks produce smoother probability distributions.
          </p>
        </section>

        {/* ===== Tokenization Section ===== */}
        <section id="tokenization" className="reveal scroll-mt-16">
          <h2 className="text-3xl font-bold leading-tight mt-14 mb-4">BPE Tokenization</h2>
          <p className="text-muted-foreground mb-4">
            Language models don&apos;t read text the way humans do. Before any processing, text must be split into <span className="text-tokenization">tokens</span> — discrete units the model understands. <strong>Byte Pair Encoding (BPE)</strong> is the most widely used tokenization algorithm, powering GPT, LLaMA, and most modern LLMs.
          </p>
          <p className="text-muted-foreground mb-4">
            BPE starts with individual characters and iteratively merges the most frequent adjacent pair into a new token. After enough merges, common words become single tokens while rare words stay split into subword pieces. This elegantly handles any text — including words the model has never seen before.
          </p>
          <p className="text-muted-foreground mb-4">
            Type any text below and step through the BPE merge process. Watch how character pairs get combined into larger tokens based on frequency.
          </p>
          <BpeTokenizationWidget />
          <p className="text-muted-foreground mb-4">
            The resulting vocabulary balances efficiency (common words are single tokens) with coverage (any text can be represented). A typical LLM vocabulary contains 32,000–128,000 tokens, each mapped to an integer ID that the model processes.
          </p>
        </section>

        {/* ===== Embeddings Section ===== */}
        <section id="embeddings" className="reveal scroll-mt-16">
          <h2 className="text-3xl font-bold leading-tight mt-14 mb-4">Embeddings: The Language of Vectors</h2>
          <p className="text-muted-foreground mb-4">
            Once text is tokenized, each token is mapped to a dense <span className="text-embeddings">embedding</span> — a vector of hundreds of floating-point numbers (768 for BERT, 4096+ for GPT-4) that encodes semantic meaning. Words with similar meanings end up as vectors pointing in similar directions.
          </p>
          <p className="text-muted-foreground mb-4">
            This is what makes modern NLP work: the geometric structure of embedding space captures relationships. &quot;King&quot; is to &quot;queen&quot; as &quot;man&quot; is to &quot;woman&quot; — not by a rule, but by the learned vector arithmetic. <span className="text-embeddings">Cosine similarity</span> between two vectors measures how semantically related they are.
          </p>
          <p className="text-muted-foreground mb-4">
            Explore the embedding space below. Click words to add them, hover to see similarity connections. Words within the same semantic cluster naturally group together.
          </p>
          <EmbeddingsWidget />
          <p className="text-muted-foreground mb-4">
            The heatmap view reveals the full similarity structure. Notice how &quot;dog&quot; and &quot;cat&quot; score high similarity (both animals), while &quot;dog&quot; and &quot;algorithm&quot; are nearly orthogonal (unrelated concepts). This geometric encoding is what enables semantic search, classification, and every downstream NLP task.
          </p>
        </section>

        {/* ===== Attention Section ===== */}
        <section id="attention" className="reveal scroll-mt-16">
          <h2 className="text-3xl font-bold leading-tight mt-14 mb-4">Multi-Head Self-Attention</h2>
          <p className="text-muted-foreground mb-4">
            The <span className="text-attention">self-attention mechanism</span> is the core innovation that makes transformers powerful. For each token, attention computes how much every other token in the sequence should influence its representation. This is done through <strong>queries</strong>, <strong>keys</strong>, and <strong>values</strong> — a token&apos;s query asks &quot;what am I looking for?&quot;, each token&apos;s key answers &quot;what do I contain?&quot;, and the value provides the actual information to pass along.
          </p>
          <p className="text-muted-foreground mb-4">
            <strong>Multi-head</strong> attention runs this process multiple times in parallel with different learned projections. Each <span className="text-attention">head</span> learns to attend to different linguistic patterns — one head might track syntactic relationships, another might focus on adjacent tokens, and another might capture long-range dependencies.
          </p>
          <p className="text-muted-foreground mb-4">
            Select different attention heads below and hover over tokens to see what each head attends to. Notice how each head captures a different type of linguistic relationship.
          </p>
          <AttentionHeadsWidget />
          <p className="text-muted-foreground mb-4">
            The <span className="text-attention">entropy</span> of each head reveals whether it focuses narrowly on specific tokens (low entropy) or distributes attention broadly (high entropy). Positional heads tend to have focused attention on neighbors, while global heads spread attention more evenly across the sequence.
          </p>
        </section>

        {/* ===== Transformer Architecture Section ===== */}
        <section id="transformer" className="reveal scroll-mt-16">
          <h2 className="text-3xl font-bold leading-tight mt-14 mb-4">Transformer Architectures</h2>
          <p className="text-muted-foreground mb-4">
            The <span className="text-transformer">transformer</span> is the architecture behind every major language model. Introduced in 2017, it replaced recurrent networks with pure attention — enabling massive parallelization and capturing long-range dependencies without the vanishing gradient problem.
          </p>
          <p className="text-muted-foreground mb-4">
            Three variants dominate modern AI: <strong>encoder-only</strong> models like BERT excel at understanding tasks (classification, NER) using bidirectional attention. <strong>Decoder-only</strong> models like GPT use causal (masked) attention for text generation. <strong>Encoder-decoder</strong> models like T5 combine both for sequence-to-sequence tasks like translation.
          </p>
          <p className="text-muted-foreground mb-4">
            Toggle between architectures below and click any component to learn what it does. Hit <strong>Play</strong> to animate data flowing through the layers.
          </p>
          <TransformerArchWidget />
          <p className="text-muted-foreground mb-4">
            Each transformer block applies the same operations: multi-head attention, residual connection with layer normalization, then a feed-forward network with another residual connection. Stacking these blocks (12 for BERT-base, 32 for LLaMA-7B, up to 100+ for the largest models) gives the model progressively deeper representations of the input.
          </p>
        </section>

        {/* ===== Computer Vision Section ===== */}
        <section id="vision" className="reveal scroll-mt-16">
          <h2 className="text-3xl font-bold leading-tight mt-14 mb-4">Computer Vision Detection</h2>
          <p className="text-muted-foreground mb-4">
            <span className="text-vision">Computer vision</span> teaches machines to interpret visual data. Object detection — locating and classifying objects within images — is one of the most impactful applications, powering everything from autonomous vehicles to medical imaging.
          </p>
          <p className="text-muted-foreground mb-4">
            Modern detectors output <strong>bounding boxes</strong> with class labels and <strong>confidence scores</strong>. A confidence threshold filters out uncertain detections — too low and you get false positives, too high and you miss real objects. Finding the right threshold is a core challenge in production vision systems.
          </p>
          <p className="text-muted-foreground mb-4">
            Drag the <strong>confidence threshold</strong> slider below to see how it affects which objects are detected. Toggle between detection modes to see bounding boxes and segmentation masks.
          </p>
          <ComputerVisionWidget />
          <p className="text-muted-foreground mb-4">
            The JSON output below the visualization shows exactly what a vision API returns — class labels, confidence scores, and normalized bounding box coordinates. This structured output is what downstream systems consume for decision-making.
          </p>
        </section>

        {/* ===== RAG Section ===== */}
        <section id="rag" className="reveal scroll-mt-16">
          <h2 className="text-3xl font-bold leading-tight mt-14 mb-4">RAG: Retrieval-Augmented Generation</h2>
          <p className="text-muted-foreground mb-4">
            <span className="text-rag">Retrieval-Augmented Generation</span> is the dominant pattern for building AI applications that need factual, up-to-date answers. Instead of relying solely on what the LLM memorized during training, RAG retrieves relevant documents and injects them into the prompt as context.
          </p>
          <p className="text-muted-foreground mb-4">
            The pipeline has six stages: the user&apos;s <span className="text-rag">question</span> is embedded into a vector, that vector is used for <span className="text-embeddings">similarity search</span> against a document store, the top-k <span className="text-rag">retrieved chunks</span> are assembled into a prompt template, and the LLM generates a <span className="text-rag">grounded response</span>.
          </p>
          <p className="text-muted-foreground mb-4">
            Type a question and click <strong>Run Pipeline</strong> to watch each stage execute. Click any stage to inspect its intermediate output.
          </p>
          <RagPipelineWidget />
          <p className="text-muted-foreground mb-4">
            The power of RAG is transparency — you can inspect and debug every stage. If the response is wrong, check the retrieved chunks. If the chunks are irrelevant, improve your embeddings or chunking strategy. This observability is what makes RAG production-ready.
          </p>
        </section>

        {/* ===== Fine-Tuning Section ===== */}
        <section id="finetuning" className="reveal scroll-mt-16">
          <h2 className="text-3xl font-bold leading-tight mt-14 mb-4">Fine-Tuning Data Formats</h2>
          <p className="text-muted-foreground mb-4">
            <span className="text-finetune">Fine-tuning</span> adapts a pre-trained model to a specific task. The data format determines what the model learns. Three approaches dominate: <strong>Supervised Fine-Tuning (SFT)</strong> uses instruction-response pairs, <strong>RLHF</strong> uses human preference rankings, and <strong>DPO</strong> simplifies preference learning without a separate reward model.
          </p>
          <p className="text-muted-foreground mb-4">
            Data quality trumps quantity in fine-tuning. A curated dataset of 1,000 high-quality examples consistently outperforms 100,000 noisy ones. Each approach requires a specific data structure — getting the format right is essential before training begins.
          </p>
          <p className="text-muted-foreground mb-4">
            Switch between the three formats below to see how training data is structured. Edit examples to see the JSON format update in real time.
          </p>
          <FineTuningWidget />
          <p className="text-muted-foreground mb-4">
            The key insight: SFT teaches the model <em>what</em> to say, while RLHF and DPO teach it <em>how</em> to say it by comparing preferred vs. rejected responses. In practice, most models go through SFT first, then RLHF or DPO for alignment — which is why understanding all three formats matters.
          </p>
        </section>

        {/* ===== Quantization Section ===== */}
        <section id="quantization" className="reveal scroll-mt-16">
          <h2 className="text-3xl font-bold leading-tight mt-14 mb-4">Model Quantization</h2>
          <p className="text-muted-foreground mb-4">
            A 70-billion parameter model in FP32 requires 280 GB of memory — far too much for most hardware. <span className="text-quantization">Quantization</span> compresses model weights from high-precision floating point (FP32) to lower-precision formats (FP16, INT8, INT4), dramatically reducing memory and compute requirements.
          </p>
          <p className="text-muted-foreground mb-4">
            The process works by mapping continuous float values to discrete integer bins. A <strong>scale factor</strong> and <strong>zero point</strong> define the mapping. The trade-off is precision — each weight gets rounded, introducing <span className="text-quantization">quantization error</span>. Remarkably, INT8 quantization typically retains 99%+ of model accuracy while cutting size by 4x.
          </p>
          <p className="text-muted-foreground mb-4">
            Toggle between bit widths below and watch how weight values get compressed. Hover over matrix cells to see the exact quantization error for each weight.
          </p>
          <QuantizationWidget />
          <p className="text-muted-foreground mb-4">
            The error heatmap reveals which weights suffer most from quantization — typically those near the boundaries between integer bins. Advanced techniques like GPTQ and AWQ use calibration data to minimize error on the weights that matter most, preserving model quality even at INT4 precision.
          </p>
        </section>

        {/* ===== Conclusion ===== */}
        <section className="reveal scroll-mt-16">
          <h2 className="text-3xl font-bold leading-tight mt-14 mb-4">The full picture</h2>
          <p className="text-muted-foreground mb-4">
            Every concept in this guide connects. <span className="text-predictive">Predictive ML</span> established that data must be encoded numerically. <span className="text-tokenization">Tokenization</span> does this for text via BPE. <span className="text-embeddings">Embeddings</span> transform tokens into rich vector representations. <span className="text-attention">Attention</span> lets models weigh which parts of the input matter for each output. <span className="text-transformer">Transformers</span> stack these mechanisms into the architectures that power modern AI.
          </p>
          <p className="text-muted-foreground mb-4">
            <span className="text-vision">Computer vision</span> extends these ideas to images. <span className="text-rag">RAG</span> grounds language models in real knowledge. <span className="text-finetune">Fine-tuning</span> adapts models to specific tasks. And <span className="text-quantization">quantization</span> makes it all run efficiently on real hardware.
          </p>
          <p className="text-muted-foreground mb-4">
            Understanding data — how it&apos;s structured, encoded, transformed, and consumed by models — is the foundation of every AI system. The revolution isn&apos;t just in the models; it&apos;s in how we prepare and present data to them.
          </p>
        </section>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center font-extrabold text-white text-xs">D</div>
            <span className="font-semibold">Data in the AI Revolution</span>
          </div>
          <p className="text-muted-foreground text-sm mb-3">
            9 interactive explorations: Predictive ML, BPE Tokenization, Embeddings, Multi-Head Attention, Transformer Architecture, Computer Vision, RAG Pipelines, Fine-Tuning Data Formats, and Model Quantization.
          </p>
          <p className="text-muted-foreground text-xs">
            Built with Next.js + React + TypeScript. Part of the{" "}
            <a href="https://github.com/jasperan/data-in-ai-revolution" className="text-purple-400 hover:text-purple-300 no-underline">
              data-in-ai-revolution
            </a>{" "}
            project by Nacho Martinez.
          </p>
        </div>
      </footer>
    </main>
  );
}
