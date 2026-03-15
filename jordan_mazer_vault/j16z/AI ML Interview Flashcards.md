# AI/ML Interview Flashcards
#flashcards #ml-interview #llm #ai-engineering

> Based on Akshay Pachaar's (@akshay_pachaar) "Interview Over" series, visual explainers, Daily Dose of Data Science, and his AI Engineering Roadmap
> 42 cards • 10 topics • Use with the **Spaced Repetition** Obsidian plugin

---

## Interview Over Series
#flashcards/interview-over

**[Netflix] You've trained a new recommendation model. How do you make sure it's ready to replace the old one?**
?
**BAD:** "I'll compare metrics on validation and test sets."
**GOOD:** Don't just test offline — test in production. Use **Shadow Testing** (dark launches): deploy the candidate model alongside the legacy model, but don't show its output to users. Log predictions and compare. Then **A/B test** with gradually increasing traffic. Measure latency, throughput, resource usage, and downstream success metrics. A model 2% more accurate but 3x slower isn't a win.
**Key:** Shadow testing, A/B testing, canary deployments, production testing, model rollout strategy

---

**[Google] We need to train an LLM across 1,000 GPUs. How would you ensure all GPUs share what they learn?**
?
**BAD:** "Use a central parameter server to aggregate and redistribute the weights."
**GOOD:** Central server = massive bottleneck at scale. Use **Ring AllReduce** — each GPU communicates with neighbors in a ring, averaging gradients without a central server. Combine **Data Parallelism** (split batches), **Tensor Parallelism** (split layers across GPUs), and **Pipeline Parallelism** (split model into stages). Frameworks: **DeepSpeed ZeRO**, **FSDP**.
**Key:** Ring AllReduce, Data/Tensor/Pipeline Parallelism, DeepSpeed ZeRO, FSDP

---

**[Apple] Two models are 88% accurate. Model A: 89% confident. Model B: 99% confident. Which do you pick?**
?
**BAD:** "Any would work since both have the same accuracy."
**GOOD:** Pick **Model A** — it's better calibrated. Model B is overconfident (99% confidence vs 88% accuracy = dangerous in decision-making). Use **Reliability Diagrams** to visualize calibration. Measure with **Expected Calibration Error (ECE)**. Fix with: Platt Scaling, Temperature Scaling, Histogram Binning, Isotonic Regression.
**Key:** Model calibration, overconfidence, reliability diagrams, ECE, Platt/temperature scaling

---

## LLM Architecture & Internals
#flashcards/llm-architecture

**Walk through how an LLM works under the hood (transformer pipeline).**
?
Input → **Tokenization** (BPE/SentencePiece → subwords) → **Embeddings** (high-dim vectors) → **Positional Encoding** (RoPE/sinusoidal) → **Self-Attention** (QKV computes weighted relationships) → **Feed-Forward Network** → Repeat N layers → Output projection → **Softmax** → Next token.
**Resource:** bbycroft.net/llm (interactive 3D viz)
**Key:** Tokenization, embeddings, positional encoding, self-attention, QKV, autoregressive generation

---

**Explain KV Caching in LLMs — why does it speed up inference?**
?
During autoregressive generation, each new token needs attention over ALL previous tokens. Without caching, you'd recompute K and V for every past token at every step → O(n²) redundant work. **KV Cache** stores the Key and Value tensors from previous steps and only computes K,V for the new token. This turns generation from O(n²) to O(n) per step. Trade-off: memory usage grows linearly with sequence length. Solutions: **PagedAttention** (vLLM), **GQA** (Grouped Query Attention) to reduce cache size.
**Key:** KV cache, autoregressive bottleneck, PagedAttention, GQA, memory vs compute trade-off

---

**What are the 4 stages of training LLMs from scratch? (Akshay's visual)**
?
1. **Pre-training:** Train on massive text corpus (internet-scale). Learn language patterns, facts, reasoning. Self-supervised (next token prediction). Costs millions of dollars.
2. **Instruction Fine-tuning (SFT):** Teach the model to follow instructions using (instruction, response) pairs. Makes it useful as a chatbot/assistant.
3. **Preference Fine-tuning (RLHF/DPO):** Align model outputs with human preferences. RLHF uses reward model + PPO. DPO skips the reward model entirely.
4. **Reasoning Fine-tuning (GRPO):** DeepSeek's breakthrough — teaches models to "think" step-by-step using Group Relative Policy Optimization. No reward model needed.
**Key:** Pre-training, SFT, RLHF, DPO, GRPO, reasoning models

---

**Explain the Mixture of Experts (MoE) architecture.**
?
Replace standard feed-forward layer with multiple "expert" networks + **gating/router**. For each token, the router picks a few experts (e.g., 2/8). Massive total params but sparse activation per token. **Mixtral 8x7B:** 46.7B total → ~12.9B active per token. Benefits: better performance at lower compute. Challenges: load balancing across experts, training instability.
**Key:** MoE, expert networks, gating/routing, sparse activation, conditional computation

---

**NVIDIA's TiDAR: How does it solve the LLM speed vs quality trade-off?**
?
Autoregressive models (GPT) = smart but slow (one token at a time). Diffusion models = fast but incoherent. **TiDAR** gets both in a single forward pass: (1) **Draft** multiple tokens at once using diffusion ("thinking" phase), (2) **Verify** them using autoregression ("talking" phase). Both happen simultaneously using smart attention masks — bidirectional for drafting, causal for verifying. Exploits "free slots" on GPU that standard generation leaves idle.
**Key:** TiDAR, speculative decoding, diffusion + autoregressive hybrid, GPU utilization

---

**What is the attention mechanism? Explain Scaled Dot-Product Attention.**
?
For each token, generate **Q** (Query), **K** (Key), **V** (Value).
`Attention(Q,K,V) = softmax(QK^T / √d_k) × V`
`√d_k` scaling prevents large dot products → prevents near-one-hot softmax → preserves gradients. **Multi-Head Attention** runs this in parallel across multiple heads (each learns different patterns), then concatenates.
**Key:** Q/K/V, scaled dot-product, multi-head attention, softmax, dim scaling

---

**What is the context window and why does it matter?**
?
Max tokens an LLM processes at once ("working memory"). Larger = longer docs, more history, better RAG. **Trade-off:** standard attention is O(n²). **Solutions:** FlashAttention (memory-efficient), Ring Attention (distributed), sparse attention. **Scale:** 4K ≈ 3 pages, 128K ≈ a novel. Practical impact: drives architecture decisions in every LLM app.
**Key:** Context window, O(n²) cost, FlashAttention, Ring Attention, sparse attention

---

**What are the key decoding strategies and sampling parameters?**
?
- **Greedy:** always pick highest prob token (fast, repetitive)
- **Beam Search:** explore top-k paths, pick best sequence
- **Temperature:** low (<1) = deterministic, high (>1) = creative
- **Top-k:** sample from top k tokens only
- **Top-p (Nucleus):** sample from smallest set exceeding cumulative probability p
- **Repetition Penalty:** penalizes already-generated tokens
**Key:** Greedy, beam search, temperature, top-k, top-p/nucleus

---

## Tokenization & Embeddings
#flashcards/tokenization-embeddings

**Why does the choice of tokenizer matter? Compare BPE, SentencePiece, WordPiece.**
?
- **BPE** (Byte Pair Encoding): iteratively merges frequent character pairs. Used by GPT.
- **SentencePiece:** language-agnostic, works on raw bytes. Used by LLaMA.
- **WordPiece:** likelihood-based merging. Used by BERT.
**Why it matters:** vocab size → model size; subword splits → multilingual quality; same text = different token counts across tokenizers → affects effective context window.
**Key:** BPE, SentencePiece, WordPiece, vocabulary size, subword tokenization

---

**New embedding model cuts vector DB costs by ~200x. How? (Akshay's post)**
?
Traditional embedding models generate embeddings **independently** for each chunk — no awareness of the full document. New approach: embeddings with **full document context**, so each chunk's vector knows what surrounds it. Result: dramatically better retrieval → fewer chunks needed → fewer vectors stored → ~200x cost reduction. Outperforms OpenAI and Cohere on benchmarks.
**Key:** Context-aware embeddings, document-level context, chunk independence problem, vector DB cost

---

## RAG Systems
#flashcards/rag

**Traditional RAG vs HyDE (Hypothetical Document Embeddings)**
?
**Traditional RAG:** Query → embed query → retrieve similar chunks → feed to LLM. **Problem:** queries are short/vague, don't match document embedding space well.
**HyDE:** Query → LLM generates hypothetical answer → embed *that* → retrieve. The hypothetical doc is much closer in embedding space to actual docs. Key insight: questions aren't semantically similar to their answers, but answers are similar to other answers.
**Key:** RAG, HyDE, query-document mismatch, embedding space alignment

---

**Traditional RAG vs Agentic RAG (Akshay's visual explainer)**
?
**Traditional RAG:** Retrieve once → generate once. Can't dynamically search for more info. Can't reason through complex multi-step queries.
**Agentic RAG:** Agent decides WHEN and WHAT to retrieve. Can: (1) reformulate queries if initial retrieval is poor, (2) do multi-hop retrieval across different sources, (3) use tools alongside retrieval, (4) reason about whether it has enough info before answering. The agent orchestrates the entire retrieval loop.
**Key:** Agentic RAG, multi-hop retrieval, query reformulation, retrieval agent, tool use

---

**RAG vs Graph RAG (Akshay's post)**
?
**Traditional RAG** only retrieves top-k relevant chunks → fails on questions needing **global context** (e.g., "What are the main themes across all documents?"). **Graph RAG** builds a knowledge graph from documents, then queries both the graph structure AND text chunks. Enables: cross-document reasoning, relationship traversal, thematic summaries. Microsoft's GraphRAG popularized this with community detection + summarization.
**Key:** Graph RAG, knowledge graphs, global context, cross-document reasoning, community detection

---

**REFRAG (Meta): How does it improve RAG efficiency?**
?
Most RAG wastes compute on irrelevant chunks. **REFRAG** compresses and filters at embedding level: (1) Compress each chunk → single embedding, (2) RL-trained policy scores relevance, (3) Only best chunks expand back to full tokens for LLM, (4) Rest stay compressed. **Results:** 30x faster TTFT, 16x larger context windows, 2-4x fewer tokens.
**Key:** REFRAG, context compression, RL-based filtering, token efficiency

---

**New RAG approach: no vector DB, no embeddings, no chunking — 98.7% accuracy. How?**
?
Researchers skipped the entire traditional pipeline (chunk → embed → vector DB → similarity search). Instead, the LLM directly processes full documents with clever context engineering. Hit 98.7% on a financial benchmark (SOTA). Insight: chunking destroys context, similarity search is a lossy proxy. For some domains, full-document processing beats retrieval.
**Key:** Chunkless RAG, full-document processing, retrieval-free approaches, context engineering

---

## Fine-Tuning
#flashcards/fine-tuning

**When and how should you fine-tune an LLM?**
?
**When:** Adapt behavior/style for specific domain. **Not for:** adding knowledge (use RAG).
**How:** (1) Prepare instruction-response pairs, (2) Choose base model, (3) Apply LoRA/QLoRA with **Unsloth** (Akshay's go-to), (4) Evaluate, (5) Merge adapters for deployment.
**LoRA:** Freeze weights, inject low-rank trainable matrices. **QLoRA:** Add 4-bit quantization → fine-tune 70B+ on single GPU.
**Key:** LoRA, QLoRA, Unsloth, PEFT, adapter merging, behavior vs knowledge

---

**5 techniques to fine-tune LLMs (Akshay's post)**
?
1. **Full Fine-Tuning:** Update all params. Most expensive, best quality.
2. **LoRA:** Low-rank adapters on frozen weights. Efficient.
3. **QLoRA:** LoRA + 4-bit quantization. Single GPU for huge models.
4. **Prefix Tuning:** Trainable "virtual tokens" prepended to input. Very lightweight.
5. **RLHF/DPO:** Align with human preferences post-SFT. RLHF uses reward model; DPO directly optimizes from preference pairs.
**Key:** Full fine-tuning, LoRA, QLoRA, prefix tuning, RLHF, DPO

---

**GRPO — how DeepSeek built reasoning models**
?
**Group Relative Policy Optimization.** Unlike RLHF (needs separate reward model), GRPO: (1) generates multiple completions per prompt, (2) scores them with simple verifier (e.g., is the math correct?), (3) uses **group's relative scores** as reward signal. No reward model needed. This trained DeepSeek-R1. The model learns chain-of-thought reasoning through RL alone.
**Key:** GRPO, DeepSeek-R1, reasoning fine-tuning, reward-model-free RL, group relative scoring

---

## Classical ML
#flashcards/classical-ml

**DBSCAN: How does it solve K-Means' two major problems?**
?
K-Means: (1) must specify K, (2) can't handle outliers. **DBSCAN:** (1) Pick point, find neighbors within **eps** radius, (2) If ≥ **minPts** → core point → start cluster, (3) Expand via density-reachability, (4) Unreachable = **noise**. No K needed — clusters emerge from density.
**Key:** DBSCAN, eps, minPts, core/border/noise points, density-reachable

---

**K-Means vs DBSCAN — when to use each?**
?
**K-Means:** spherical clusters, known K, no outliers, fast.
**DBSCAN:** arbitrary shapes, unknown K, outliers, varying density.
**DBSCAN limits:** varying density (→ **HDBSCAN**), sensitive to params, poor in high dims.
**Key:** Trade-offs, HDBSCAN, cluster shape assumptions, K-Means++

---

## Neural Networks & Deep Learning
#flashcards/deep-learning

**How can you remove 74% of neurons and only lose 0.5% accuracy? (Akshay's post)**
?
**Neural Network Pruning.** Techniques: **Magnitude** (weights near zero), **Structured** (entire neurons/heads), **Unstructured** (individual weights → sparse). Process: Train → Prune → Fine-tune. **Lottery Ticket Hypothesis:** within any large network, a smaller subnetwork exists matching full performance.
**Key:** Pruning, Lottery Ticket Hypothesis, model compression, sparsity

---

**Explain Batch Normalization — why does it help training?**
?
Normalize activations in each mini-batch to mean ≈ 0, std ≈ 1 at every layer. Solves **internal covariate shift**. Benefits: higher learning rates, less sensitivity to init, mild regularization (batch noise), prevents vanishing/exploding gradients. Learnable γ (scale) + β (shift). Inference uses running mean/variance.
**Key:** Batch norm, internal covariate shift, γ/β, running statistics, regularization

---

**Explain Dropout — how does it prevent overfitting?**
?
During training, randomly zero out neurons with probability p. Forces network to not rely on any single neuron (prevents co-adaptation). Effectively trains an ensemble of sub-networks. At test time, all neurons active, weights scaled by (1-p). **With BatchNorm:** Linear → BN → Activation → Dropout. Rates: 0.1-0.5.
**Key:** Dropout, co-adaptation, ensemble effect, inverted dropout, BN ordering

---

**Vanishing and exploding gradients — causes and fixes?**
?
**Vanishing:** gradients shrink through deep layers → early layers stop learning. Cause: sigmoid/tanh. Fix: ReLU, residual connections, He/Xavier init.
**Exploding:** gradients grow → divergence. Fix: gradient clipping, batch norm, lower LR.
**Key:** Vanishing/exploding gradients, ReLU, skip connections, gradient clipping, He init

---

## Prompt & Context Engineering
#flashcards/prompt-engineering

**Prompt engineering vs Context engineering**
?
**Prompt:** crafting the instruction. Techniques: CoT, few-shot, roles.
**Context** (superset): designing the ENTIRE input — system prompts, retrieved docs, history, tools, memory. What to include, structure, exclude. Industry shifting here as systems grow complex.
**Key:** Prompt vs context engineering, CoT, system prompts

---

**Zero-shot vs Few-shot learning**
?
**Zero-shot:** no examples, just task description + pretraining knowledge.
**Few-shot:** examples in prompt. Quality (selection, ordering, format) matters hugely.
**In-Context Learning (ICL):** learning from prompt examples without weight updates.
**Key:** Zero/few/one-shot, ICL, prompt design

---

**3 Prompting Techniques for Reasoning (Akshay's post)**
?
1. **Chain-of-Thought (CoT):** "Think step by step." Huge boost for math/logic.
2. **Tree of Thoughts (ToT):** Explore multiple reasoning paths, evaluate, prune, continue best. BFS/DFS on reasoning.
3. **JSON/Structured Prompting:** JSON format for clarity, modularity, deterministic outputs. Better than free-form for complex tasks.
**Key:** CoT, Tree of Thoughts, structured prompting

---

## MCP & Tool Integration
#flashcards/mcp

**MCP vs Function Calling (Akshay's visual)**
?
**Function Calling:** define functions in prompt → LLM outputs JSON → you execute → feed back. One-directional, stateless, hardcoded.
**MCP:** standardized protocol. Servers advertise capabilities. Client discovers tools dynamically. Supports streaming, stateful sessions, any LLM provider. Function calling = hardcoded wiring; MCP = universal adapter.
**Key:** Function calling vs MCP, dynamic discovery, stateful sessions

---

## AI Agents
#flashcards/ai-agents

**5 Agentic Design Patterns (from Illustrated Guidebook)**
?
1. **Reflection:** Critique own output → improve
2. **Tool Use:** Call APIs, code execution, DBs
3. **ReAct:** Think → Act → Observe → Think (interleaved)
4. **Planning:** Decompose into sub-tasks + execution plans
5. **Multi-Agent:** Specialized agents collaborate
**Key:** Reflection, Tool Use, ReAct, Planning, Multi-Agent

---

**5 Levels of Agentic AI Systems**
?
L1: Basic Responder (chatbot) → L2: Tool-Augmented (APIs) → L3: Autonomous Task Executor (multi-step) → L4: Collaborative Multi-Agent → L5: Fully Autonomous (self-improving)
**Key:** Agent maturity levels, autonomy spectrum

---

**Agent memory architecture (Akshay's blog)**
?
**Short-term:** session-scoped (history, docs, tool outputs).
**Long-term:** cross-session (preferences, facts). Stored in: vector DBs (semantic), graph DBs (relational), relational DBs (metadata).
**Problems:** needle-in-haystack (buried info ignored), recency decay (old instructions forgotten). **Fix:** weighted memory (RL-strengthened paths), composable pipelines, self-improving via memify.
**Key:** Memory types, vector/graph DBs, needle-in-haystack, weighted memory

---

## MLOps & LLMOps
#flashcards/mlops-llmops

**8 Pillars of LLM development (Akshay's thread)**
?
1. Prompt Engineering (engineering, not copywriting)
2. MCP & Tool Integration
3. 4-Stage LLM Training (pre-train → SFT → preference → reasoning)
4. GRPO (reward-free reasoning fine-tuning)
5. Prompting for Reasoning (CoT, ToT, structured)
6. RAG vs Agentic RAG
7. Graph RAG (global context)
8. KV Caching (inference speedup)
**Key:** LLM engineering pillars, production systems

---

**Drift detection in ML — types and tools?**
?
**Data Drift:** input distribution shifts. **Concept Drift:** input→output relationship changes. **Prediction Drift:** output distribution shifts. Tools: KS test, PSI, chi-squared. Monitor: Evidently + Prometheus + Grafana. Without detection, models **silently degrade**.
**Key:** Drift types, KS test, PSI, Evidently

---

**CI/CD for ML vs software CI/CD?**
?
Adds **data + model validation**. CI: code + data quality + training tests. CD: model artifacts + canary/shadow + A/B tests. Tools: DVC (data versioning), Docker, GitHub Actions, GitOps + K8s/EKS. Version **data AND code**.
**Key:** ML CI/CD, DVC, model versioning, GitOps

---

## AI Engineering Roadmap
#flashcards/roadmap

**Akshay's AI Engineering Roadmap (2M+ views)**
?
**Foundations:** Python, FastAPI, Pydantic, async, Docker, Git, basic ML/stats
**Core AI:** LLM APIs, prompt engineering, structured outputs (Instructor)
**RAG:** Vector DBs, chunking, embeddings, hybrid search
**Agents:** Tool use, MCP, multi-agent (LangGraph, CrewAI)
**Fine-tuning:** LoRA/QLoRA, Unsloth, DPO
**Production:** vLLM, KV caching, eval (LangSmith, Opik), CI/CD, observability
**Key:** Practical > theoretical, build → ship → iterate

---

**Open-source vs Closed-source LLMs (Akshay's breakdown)**
?
**Open** (customize, privacy, cost): LLaMA 3, Mistral/Mixtral, Qwen, Phi. Fine-tuning freedom, transparent.
**Closed** (reliability, scale): GPT-4, Claude, Gemini, Cohere. Strong reasoning, optimized infra.
**Decision:** Need customization/privacy → open. Best reasoning + minimal ops → closed. Production often uses **both** via model routing.
**Key:** Open vs closed, model routing, self-hosting trade-offs

---

## Resources from Akshay

- **bbycroft.net/llm** — Interactive 3D LLM visualization
- **Unsloth** — Open-source fine-tuning tool
- **dailydoseofds.com** — LLMOps, MLOps, Agents crash courses
- **AI Agents Illustrated Guidebook** (2025, free, 117pp)
- **MCP Illustrated Guidebook** (2025, free)
- **Top 50 LLM Interview Questions** — June 2025
- **NN-SVG** — Neural network diagram generator
- Follow: **@akshay_pachaar** on X
