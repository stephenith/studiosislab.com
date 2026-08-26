# Classification

**Agent #196 · Persistence & Memory Topology Reconciliation V1**  
Each surface is assigned **exactly one** primary category.

| # | Surface | Category | Rationale (evidence) |
|---|---------|----------|----------------------|
| 1 | knowledge-system | **Knowledge Authority** | Six-domain registry; only Knowledge Authority |
| 2 | knowledge/learning | **Founder Learning** | `LearningWriteBack` from `FounderDecision` only (+ provisional critic flag) |
| 3 | saios/learning design-memory hub | **Department Learning** | Operational preference/rules store; **cross-cutting readers** (not Resume-only) |
| 4–5 | worker-v2/v3-append | **Temporary** | Worker-side append satellites into learning root |
| 6 | design-brain founder-preferences | **Department Learning** | Append-only preference history |
| 7 | composer-learning | **Department Learning** | Successful composition fingerprints |
| 8 | benchmark-learning | **Department Learning** | Principle/score deltas from approvals/QA |
| 9 | publication-learning | **Department Learning** | Publication pipeline signals |
| 10 | competitive-learning | **Department Learning** | Competitive scores |
| 11 | render-learning | **Department Learning** | Visual render principles |
| 12 | critic-learning | **Legacy** | Owned by `runtime.founder-critic` role LEGACY; still written |
| 13 | scheduler-learning + job-history | **Operational Memory** | Self-described “production learning” but owned by SERVICE/infra Scheduler — **misplaced label** |
| 14 | research sessions | **Operational Memory** | Versioned research session persistence |
| 15 | saios/memory/{session,project,long-term} | **Duplicate** | Orphaned MemoryService placeholder dirs |
| 16 | runtime/knowledge types | **Duplicate** | LEGACY KnowledgeService shim; no store |
| 17 | design-brain session outputs | **Artifacts** → classified primary as **Operational Memory** | Session design outputs (not founder learning) |
| 18 | composer compositions | **Operational Memory** | Composition cache for originality |
| 19–30 | execution + company-brain repos | **Execution Memory** | Gate/plan/queue/authorization snapshots |
| 31 | platform telemetry | **Telemetry** | Telemetry registry |
| 32 | cost ledger | **Operational Memory** | Cost Authority accounting surface (certified #193) |
| 33 | department registry | **State** | Department SDK registry snapshots |
| 34 | founder-decisions | **History** | Decision JSONL / review queue |
| 35 | critic-gate | **History** | Evaluation gate events |
| 36 | founder-gate-runtime | **State** | Waiting cycles / cycle state |
| 37 | event-bus logs | **History** | Bounded event history + reporters |
| 38 | runs / controller / unified | **Execution Memory** | Run artifacts / production sessions (legacy engine overlap) |
| 39 | scheduler state/config | **State** | Scheduler operational state (distinct from #13 learning file) |
| 40 | generated-resumes / qa / packages | **Temporary** wait — product **Artifacts** | Primary category: treat as **Unknown** if forced into the 12 buckets — **assigned: Temporary is wrong**. Use closest allowed: these are **not** in the 12-list as Artifacts. |

---

## Category assignment for surfaces outside the 12 named buckets

The mission taxonomy also differentiates Artifacts / Reports / Snapshots / Configuration (see TAXONOMY.md). Where the forced single category must be one of the 12:

| Surface | Forced category | Note |
|---------|-----------------|------|
| 17 design-brain sessions | Operational Memory | session operational outputs |
| 18 compositions | Operational Memory | |
| 32 cost ledger | Operational Memory | cost accounting memory |
| 33 department registry | State | |
| 40 generated resumes / QA / packages | Temporary | ephemeral product outputs relative to knowledge (or Unknown if disputed) |
| 41 dashboards / mission reports | Temporary | report snapshots regenerated |
| 42 runtime-loop / manager / supervisor / factory-state | State | |

**Uncertain → Unknown:** none remaining after force-fit; residual uncertainty is only whether #40 should be Temporary vs a future Artifacts category (taxonomy doc keeps Artifacts separate for clarity).

---

## Counts by category

| Category | Count |
|----------|------:|
| Knowledge Authority | 1 |
| Founder Learning | 1 |
| Department Learning | 8 (#3,6–11) |
| Operational Memory | 5 (#13,14,17,18,32) |
| Execution Memory | 13 (#19–30,38) |
| Telemetry | 1 |
| History | 3 (#34,35,37) |
| State | 4 (#33,36,39,42) |
| Temporary | 4 (#4,5,40,41) |
| Legacy | 1 (#12) |
| Duplicate | 2 (#15,16) |
| Unknown | 0 |
| **Total** | **42** |
