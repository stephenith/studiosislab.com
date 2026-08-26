# Ownership Topology

**Agent #196 · Persistence & Memory Topology Reconciliation V1**

---

## Canonical owners

| Domain | Canonical owner | Surfaces |
|--------|-----------------|----------|
| Knowledge Authority | `core/knowledge` | #1 knowledge-system |
| Founder Learning | `core/knowledge-learning` | #2 knowledge/learning |
| Execution Memory (governance) | respective Phase-2/3 modules + `BaseAppendOnlyRepository` | #19–30 |
| Telemetry | `platform/telemetry` | #31 |
| Cost accounting | `platform/cost-ledger` | #32 |
| Department registry | `platform/department-sdk` | #33 |
| Founder decisions history | `core/founder-decisions` | #34 |
| Critic-gate history | `core/critic-gate` | #35 |
| Founder-gate state | `core/founder-gate-runtime` | #36 |

---

## Satellite owners (department learning / local memory)

| Owner | Surfaces | Scope |
|-------|----------|-------|
| `runtime/design-brain` | #6 preferences, #17 sessions | Design |
| `runtime/adaptive-composer` | #7 learning, #18 compositions | Composition |
| `runtime/benchmark` | #8 learning (+ pattern JSONs as operational) | Benchmark |
| `runtime/publication` | #9 learning | Publication |
| `runtime/competitive-validation` | #10 | Competitive |
| `runtime/visual-render` | #11 | Visual render |
| `runtime/research` | #14 sessions | Research |
| `runtime/workers/resume-learning` | #3 hub files | **Declared** Resume; **actual** cross-cutting |

---

## Cross-cutting / shared stores

| Store | Declared owner | Actual readers | Classification |
|-------|----------------|----------------|----------------|
| `saios/learning/design-memory.json` | resume-learning WORKER | design-brain (`SpacingEngine`, `TypographyEngine`), research (`ColorPlanner`, `TypographyPlanner`), adaptive-composer + founder-critic `KnowledgeConsumer`, resume-production (multiple), design-system `DesignMemoryBridge`, founder-dashboard, missions | **Shared / cross-cutting** — ownership mismatch |

No other learning store has this fan-out. This is the highest-coupling shared store.

---

## Misplaced stores

| Store | Why misplaced |
|-------|----------------|
| `scheduler-learning.json` | Owner is `runtime.scheduler` role **SERVICE** / layer Services; file self-describes “append-only production learning”. Infrastructure module owning a learning-named store. |
| Worker appends (#4–5) | Written by resume-production into resume-learning root; `module-roles` forbids `parallel_learning_store_new` for resume-learning — conflict. |

---

## Orphaned stores / abstractions

| Item | Status |
|------|--------|
| `runtime/memory` `MemoryService` types | Declared SERVICE; **no implementation**; log dirs empty `.gitkeep` |
| `runtime/knowledge` types | LEGACY shim; no persistence |
| `SOS/07_LOGS/saios/memory/*` | Orphan directories awaiting unimplemented MemoryService |

---

## Duplicate names / naming collisions

| Collision | A | B |
|-----------|---|---|
| `DesignMemory` filename | `runtime/workers/resume-learning/design-memory.ts` → `DesignMemory` type, path `saios/learning/design-memory.json` | `runtime/design-brain/DesignMemory.ts` → `BrainMemory` type, path `design-brain/memory/founder-preferences.json` |
| `KnowledgeConsumer` name | adaptive-composer + founder-critic modules named “Knowledge” but **read design-memory**, not `core/knowledge` | Misleading — learning consumer, not Knowledge Authority consumer |
| `*-learning.json` suffix | Used for founder preferences, composition fingerprints, scheduler durations, competitive scores | Collapses Learning vs Operational Memory |

---

## Duplicate responsibilities

| Signal | Stores that independently capture it |
|--------|--------------------------------------|
| Founder approval / preference bias | knowledge/learning (canonical), design-brain preferences, resume design-memory, benchmark-learning, publication-learning, critic-learning (legacy) |
| Production outcome history | scheduler job-history, controller/runs, publication memory |

Department stores **do not** feed `core/knowledge-learning`. Only the FounderDecision path promotes into Knowledge Authority.

---

## Ownership diagram (learning/memory only)

```
CANONICAL
  core/knowledge  ←── mergeFounderLearningFromDisk ──  core/knowledge-learning
                                                         ↑
                                              FounderDecision / ProvisionalCritic

CROSS-CUTTING SHARED (worker-owned)
  resume-learning design-memory.json
       ↑ writers: learning-engine, founder-calibration
       ↓ readers: design-brain, research, composer, critic, production, design-system, dashboard

SATELLITES (local append JSON)
  design-brain preferences | composer | benchmark | publication
  competitive | visual-render

MISPLACED
  scheduler-learning.json  (SERVICE owner)

LEGACY
  founder-critic critic-learning.json  (still written by StageRunner + missions)

ORPHAN
  runtime/memory MemoryService + saios/memory/{session,project,long-term}
```
