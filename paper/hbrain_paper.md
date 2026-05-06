# HBrain: A Brain-Inspired Knowledge Graph System

**Simulating Human Semantic Memory through Chunking, Feynman Summarization, and Weighted Associative Retrieval**

*Yuan Jun — May 2026*

---

## Abstract

We present **HBrain**, a knowledge graph system that simulates the working mechanism of human brain semantic memory networks. Unlike traditional knowledge graphs that rely on manual curation or rigid schema, HBrain autonomously transforms unstructured documents into structured knowledge by integrating two cognitive learning theories: **Simon's Chunking Theory**, which decomposes complex information into meaningful knowledge units, and **Feynman's Learning Method**, which generates plain-language summaries that capture the essence and practical significance of each knowledge unit.

The system introduces three key innovations:

1. **Feynman-style extraction agent** — produces self-explanatory entity summaries designed for downstream reasoning rather than mere description.

2. **Weighted associative retrieval mechanism** — mimics human spreading activation through the semantic network, with edge weights reflecting relational strength and exponential hop decay (γ = 0.7) modeling memory attenuation.

3. **Multi-level evidence grading system** — prioritizes full-text evidence over paragraph and summary evidence, mirroring how humans prefer primary sources over secondary interpretations.

**Keywords:** Knowledge Graph, Semantic Memory, Cognitive Learning, Spreading Activation, Feynman Method, Chunking Theory

---

## 1. Introduction

Human memory is not a passive storage system but an active, associative network where concepts are connected through semantic relationships [Collins & Quillian, 1969]. When we encounter new information, our brains naturally decompose it into meaningful chunks [Miller, 1956], elaborate on each chunk through self-explanation [Chi et al., 1989], and later retrieve knowledge by spreading activation through associative links [Anderson, 1983].

Traditional knowledge graph systems capture entities and relations but often produce terse, machine-oriented representations that lack the explanatory richness needed for human-like reasoning. Large Language Models (LLMs) excel at understanding and generating natural language but struggle with structured, long-term memory and multi-hop reasoning over large knowledge bases.

This paper introduces **HBrain** (Human Brain Semantic Network), a system that bridges these gaps by modeling two well-established cognitive learning theories:

### 1.1 Simon's Chunking Theory

Herbert Simon observed that expertise involves recognizing meaningful patterns ("chunks") in information. HBrain implements this by decomposing documents into 13 semantic entity types — from concrete *agents* and *objects* to abstract *concepts* and *rules* — each serving as a cognitive chunk with a distinct role in the knowledge network.

### 1.2 Feynman's Learning Method

Richard Feynman advocated explaining complex ideas in simple terms as a test of true understanding. HBrain's extraction agent generates "Feynman summaries" for each entity — plain-language explanations that answer *what* something is, *why* it matters, and *how* it relates to other knowledge. These summaries are optimized for downstream reasoning rather than mere description.

### 1.3 Key Contributions

- **Feynman-style knowledge extraction pipeline** — produces self-explanatory entity representations with structured summaries, including rule-type entities encoded as judgment logic rather than flat text.
- **Weighted associative retrieval algorithm** — spreading activation with calibrated edge weights for 22 relation types, exponential hop decay (γ = 0.7), and weak-relation pruning.
- **Multi-level evidence grading system** — per-document priority tracking (full-text > paragraph > summary).
- **Integrated evaluation pipeline** — LLM-based quality scoring, automatic filtering (< 0.7), and retry mechanism.

---

## 2. Related Work

### 2.1 Knowledge Graph Construction

Traditional knowledge graph construction methods include information extraction pipelines [Banko et al., 2007], relation extraction models [Riedel et al., 2010], and ontology learning [Maedche & Staab, 2001]. Recent approaches leverage LLMs for zero-shot or few-shot extraction [Wei et al., 2023], but often produce flat, unstructured outputs without the semantic richness needed for reasoning.

### 2.2 Cognitive Models of Memory

Collins and Quillian's semantic network model proposed that human memory organizes knowledge as nodes connected by labeled edges, with properties stored at appropriate levels of abstraction. Anderson's ACT-R architecture introduced spreading activation as a retrieval mechanism, where activation spreads from source nodes through associative links, decaying with distance.

Simon's chunking theory demonstrated that expert memory organizes information into meaningful units (chunks), enabling rapid recognition and retrieval. Chase and Simon showed that chess masters do not memorize more individual pieces but recognize larger, meaningful patterns [Chase & Simon, 1973].

### 2.3 LLM-Based Knowledge Systems

Recent work has explored using LLMs for knowledge graph construction [Pan et al., 2024], retrieval-augmented generation (RAG) [Lewis et al., 2020], and graph-based reasoning [Edge et al., 2024]. However, these systems typically treat knowledge extraction as a mechanical process, lacking the cognitive grounding that enables human-like understanding and retrieval.

### 2.4 Spreading Activation in Knowledge Networks

Spreading activation has been applied to information retrieval [Crestani, 1997], semantic search [Hwang & Kim, 2019], and recommendation systems [Symeonidis et al., 2008]. Our work differs by integrating spreading activation with LLM-generated semantic representations and a principled edge weight calibration based on relational semantics.

---

## 3. System Architecture

HBrain consists of four major components:

```
┌─────────────────────────────────────────────────────────────────────┐
│                           HBrain Architecture                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │
│  │   Document  │───▶│   Feynman   │───▶│  Evaluation │───▶ Storage │
│  │   Input     │    │  Extraction │    │   Agent     │             │
│  └─────────────┘    └─────────────┘    └─────────────┘             │
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │
│  │     User    │───▶│   Weighted  │───▶│   Evidence  │───▶ Answer   │
│  │    Query    │    │  Retrieval  │    │   Grading   │             │
│  └─────────────┘    └─────────────┘    └─────────────┘             │
│                                                                     │
│       Storage (Kuzu Graph DB, SQLite, MinIO)                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.1 Ingestion Pipeline

1. **Document Parsing**: Documents are parsed into markdown format using MinerU VLM API, preserving structure, tables, and images.
2. **Feynman Extraction**: The FeynmanAgent extracts entities and relations, generating self-explanatory summaries.
3. **Quality Evaluation**: The EvaluationAgent scores each entity and relation, filtering out low-confidence results (< 0.7).
4. **Graph Storage**: Accepted entities and relations are persisted in the Kuzu graph database.

### 3.2 Retrieval Pipeline

1. **Query Analysis**: LLM identifies the problem archetype and search keywords.
2. **Entity Matching**: Parallel FTS5 search identifies relevant seed entities.
3. **Weighted BFS Expansion**: Spreading activation expands from seed entities through the graph.
4. **Evidence Gathering**: Multi-level evidence is collected with priority tracking.
5. **Evidence Filtering**: LLM evaluates evidence relevance to the query.
6. **Answer Generation**: Structured answer is generated with evidence citations.

---

## 4. Simon's Chunking: Knowledge Decomposition

Herbert Simon's chunking theory posits that expertise involves recognizing meaningful patterns in information, grouping individual elements into larger, meaningful units (chunks). HBrain implements this principle by decomposing documents into a structured taxonomy of 13 entity types.

### 4.1 Entity Type Taxonomy

| Category | Entity Type | Cognitive Role |
|----------|-------------|----------------|
| **Source** | Document | Knowledge source |
| | Image | Visual evidence |
| **Actor** | Agent | Responsible entity |
| | Object | Passive entity |
| | Concept | Abstract idea |
| **Process** | Event | Temporal occurrence |
| | Activity | Procedural sequence |
| | Rule | Judgment logic |
| **Measurement** | Metric | Quantitative measure |
| | Time | Temporal boundary |
| **Context** | Location | Spatial context |
| | Statement | Claimed assertion |
| **Issue** | Problem | Anomaly detection |

### 4.2 Chunk Definition

> **Knowledge Chunk**: A knowledge chunk $c = (l, s, t)$ consists of:
> - $l$ (label): a concise name
> - $s$ (summary): a Feynman-style explanation
> - $t$ (type): one of 13 entity types

> **Chunk Completeness**: A document $D$ is fully chunked when every semantically significant concept is represented by a chunk, and the relations between chunks capture the document's logical structure.

### 4.3 Relation Type Weights

| Relation | Semantic Meaning | Weight |
|----------|------------------|--------|
| defines | Conceptual definition | **1.00** |
| causes | Causal relationship | 0.95 |
| depends_on | Dependency | 0.92 |
| requires | Prerequisite | 0.90 |
| mitigates | Risk mitigation | 0.90 |
| contradicts | Logical conflict | 0.90 |
| affects | Impact relationship | 0.85 |
| prohibits | Prohibition | 0.85 |
| permits | Permission | 0.82 |
| responsible_for | Accountability | 0.80 |
| performs | Execution | 0.78 |
| uses | Utilization | 0.75 |
| creates | Creation | 0.75 |
| contains | Containment | 0.72 |
| belongs_to | Ownership | 0.72 |
| part_of | Composition | 0.72 |
| measures | Measurement | 0.65 |
| attribute | Property value | 0.58 |
| evidence_for | Supporting evidence | 0.55 |
| describes | Description | 0.45 |
| mentions | Incidental reference | 0.35 |
| derived_from | Derivation | 0.30 |

### 4.4 Weak Relation Pruning

> **Non-Expandable Relations**: The following relation types are included in retrieval results but do not propagate activation:
> - `mentions`, `describes`, `evidence_for`, `derived_from`, `attribute`

This mirrors how humans recall incidental details without following weak associations.

---

## 5. Feynman Summarization: Self-Explanatory Knowledge

Richard Feynman's learning method emphasizes explaining complex ideas in simple, plain language as a test of true understanding. HBrain implements this through a specialized extraction prompt that generates "Feynman summaries" for each entity.

### 5.1 Summary Generation Principles

Each Feynman summary must answer four questions:

1. **What** is this entity? (Definition and nature)
2. **Why** does it matter? (Role and significance)
3. **How** does it relate? (Connections to other entities)
4. **What if**? (How it can be used for judgment or decision)

### 5.2 Type-Specific Summary Templates

| Entity Type | Feynman Summary Template |
|-------------|--------------------------|
| **Agent** | "This agent is responsible for [duties], plays the role of [role] in the process, and can be used to determine who should do what and who is accountable for what." |
| **Rule** | Structured JSON with `rule_type`, `modality`, `condition`, `constraint`, `judgement` fields |
| **Metric** | "This metric measures [what], with threshold [value] and unit [unit], used to determine whether [target] meets requirements." |

### 5.3 Rule Entities as Judgment Logic

A key innovation is the treatment of *rule* entities. Unlike natural language summaries, rules are encoded as structured judgment logic:

```json
{
  "rule_type": "requirement",
  "modality": "must",
  "scope": {
    "domain": "Quality Management",
    "subject": "Quality Department",
    "action": "Outgoing Inspection",
    "object": "Finished Products"
  },
  "condition": {"all": ["Product ready for shipment"]},
  "constraint": {
    "field": "Inspection Result",
    "operator": "eq",
    "value": "Pass"
  },
  "judgement": {
    "compliant_if": "Inspection report shows Pass",
    "non_compliant_if": "Inspection report shows Fail or missing"
  }
}
```

This structured representation enables automated compliance checking, contract review, and risk assessment.

### 5.4 Feynman vs. Conventional Summarization

> **Remark**: Conventional extractive summarization selects key sentences. Feynman summarization generates explanations that capture the entity's *functional role* in the knowledge network. A Feynman summary for "Quality Department" explains how it determines accountability, not just what it is.

---

## 6. Weighted Associative Retrieval

Human memory retrieval follows the spreading activation model: when a concept is activated, activation spreads through associative links to related concepts, with strength decaying over distance.

### 6.1 Activation Score Formula

$$A(e) = \max_{p \in \mathcal{P}(e_0, e)} \prod_{i=1}^{|p|} w(r_i) \cdot \gamma$$

Where:
- $\mathcal{P}(e_0, e)$: set of all paths from seed entity to target
- $w(r_i)$: weight of the $i$-th relation
- $\gamma = 0.7$: hop decay factor

**Hop Decay Effect:**

| Depth | Strength Retained |
|-------|------------------|
| 0 (direct) | 100% |
| 1 hop | 70% |
| 2 hops | 49% |
| 3 hops | 34% |

### 6.2 Retrieval Algorithm

```
1. Initialize seed entities with score 1.0
2. Add seeds to queue
3. While queue not empty:
   a. Dequeue entity e with score A at depth d
   b. If d >= 3: continue (max depth)
   c. For each neighbor e' via relation r with weight w:
      - Calculate A' = A * w(r) * 0.7
      - If e' not in scores or A' > scores[e']:
        - Update scores[e'] = A'
      - If e' not visited and r is expandable:
        - Add e' to queue with score A'
4. Return top-20 entities sorted by score
```

### 6.3 Edge Weight Categories

| Category | Weight Range | Relations |
|----------|-------------|-----------|
| **Strong** | ≥ 0.80 | defines, causes, depends_on, requires, mitigates, contradicts |
| **Medium** | 0.60–0.79 | affects, prohibits, performs, uses, creates, contains, belongs_to, part_of |
| **Weak** | < 0.60 | measures, attribute, evidence_for, describes, mentions, derived_from |

### 6.4 Multi-Seed Aggregation

When multiple seed entities match a query, activations are aggregated:

$$A_{\text{total}}(e) = \max_{s \in S} A_s(e)$$

This mirrors how humans integrate information from multiple sources.

---

## 7. Multi-Level Evidence Grading

Human reasoning prefers primary evidence over secondary interpretations. HBrain implements this through a three-level evidence grading system.

### 7.1 Evidence Levels

| Level | Trigger Condition | Description |
|-------|------------------|-------------|
| **Full-text** | Document < 5000 chars | Entire document as evidence |
| **Paragraph** | Document ≥ 5000 chars | Matching paragraphs (max 10) |
| **Summary** | No document evidence | Entity's Feynman summary as fallback |

### 7.2 Per-Document Priority Tracking

> **Evidence Priority**: For each document, if full-text or paragraph evidence has been collected from any entity, summary evidence from other entities referencing the same document is suppressed.

This prevents redundant evidence: if Document A's full text has been retrieved for Entity X, we do not also include Entity Y's summary of Document A.

### 7.3 LLM-Based Evidence Filtering

- **Relevance criteria**: Does the evidence directly address the question's topic?
- **Conservative approach**: Err on the side of retaining marginal evidence.
- **Fallback**: If filtering returns empty list, retain all evidence.

---

## 8. Extraction Quality Evaluation

### 8.1 Evaluation Pipeline

1. **Format validation** — Check required fields, entity types, relation types
2. **LLM scoring** — Evaluate each entity and relation on 0–1 scale
3. **Filtering** — Reject entities and relations with score < 0.7
4. **Retry mechanism** — If rejection rate > 50%, retry extraction (up to 2 attempts)

### 8.2 Confidence Propagation

```python
# Entity confidence
entity.confidence = evaluation_score(entity)

# Relation confidence = min(endpoint confidences)
relation.confidence = min(confidence(src), confidence(tgt))
```

---

## 9. Evaluation Results

### 9.1 Extraction Quality Comparison

| Entity | Conventional Extraction | Feynman Extraction |
|--------|------------------------|-------------------|
| Quality Department | "Quality management department responsible for quality inspection" | "This agent is responsible for product quality inspection, plays the role of auditor, and can be used to determine accountability for quality issues." |
| Outgoing Inspection Rule | "Products must pass inspection before shipment" | `{rule_type: requirement, modality: must, constraint: inspection result = pass, ...}` |

### 9.2 System Performance

| Metric | Value |
|--------|-------|
| Extraction time | 15–30 seconds per document |
| Retrieval time | 2–5 seconds per query |
| Max entities tested | 10,000+ |
| Max relations tested | 50,000+ |

---

## 10. Conclusion and Future Work

### 10.1 Summary

HBrain simulates human brain semantic memory through the integration of Simon's chunking theory and Feynman's learning method:

1. **Cognitive knowledge decomposition** — 13 entity types capturing the full spectrum of knowledge
2. **Feynman-style summaries** — Self-explanatory representations optimized for reasoning
3. **Weighted associative retrieval** — Spreading activation with calibrated edge weights
4. **Multi-level evidence grading** — Per-document priority tracking

### 10.2 Future Directions

- **Adaptive weight learning** — Learn edge weights from user feedback
- **Temporal reasoning** — Handle event sequences and temporal relations
- **Multi-modal integration** — Incorporate images, tables, and other modalities
- **Collaborative knowledge building** — Multiple users contributing to the knowledge graph
- **Explainable retrieval** — Provide explicit reasoning paths

---

## References

- Anderson, J. R. (1983). *The Architecture of Cognition*. Harvard University Press.
- Banko, M. et al. (2007). Open information extraction from the web. *IJCAI*.
- Brown, T. B. et al. (2020). Language models are few-shot learners. *NeurIPS*.
- Chase, W. G., & Simon, H. A. (1973). Perception in chess. *Cognitive Psychology*, 4(1).
- Chi, M. T. et al. (1989). Self-explanations: How students study and use examples. *Cognitive Science*, 13(2).
- Collins, A. M., & Quillian, M. R. (1969). Retrieval time from semantic memory. *Journal of Verbal Learning and Verbal Behavior*, 8(2).
- Crestani, F. (1997). Application of spreading activation techniques in information retrieval. *Artificial Intelligence Review*, 11(6).
- Feynman, R. P. (1988). *The Pleasure of Finding Things Out*. Perseus Publishing.
- Lewis, P. et al. (2020). Retrieval-augmented generation for knowledge-intensive NLP tasks. *NeurIPS*.
- Miller, G. A. (1956). The magical number seven, plus or minus two. *Psychological Review*, 63(2).
- Pan, S. et al. (2024). Unifying large language models and knowledge graphs. *IEEE TKDE*, 36(7).
- Simon, H. A. (1974). How big is a chunk? *Science*, 183(4124).
- Wei, X. et al. (2023). Zero-shot information extraction via chatting with ChatGPT. *arXiv:2302.10205*.

---

*HBrain — Transforming Knowledge into Wisdom*