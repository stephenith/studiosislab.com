# Adoption Gaps

**Agent #196 · Persistence & Memory Topology Reconciliation V1**  
**Classification only — no migration recommendation, no implementation.**

Existing abstractions (already in repo):

1. `platform/repositories/BaseAppendOnlyRepository` (+ `platform/shared/fs.ts`) — Agent #173/#176  
2. `runtime/memory` `MemoryService` / tier stores — **types only, unimplemented**

---

## A. BaseAppendOnlyRepository

### Modules that **already extend** BaseAppendOnlyRepository

Execution controller, execution authorization, activation gate, pre-dispatch simulation, worker runtime, runtime plan, system readiness, runtime release, shadow queue, company-brain mission approval / queue admission / execution package / ack / queue submission, platform telemetry, platform cost-ledger (BudgetRepository pattern), department-sdk registry (platform pattern).

### Modules that **should already be using** BaseAppendOnlyRepository but **do not**

(Criteria: append-oriented durable log/store with repository class or equivalent, same durability needs as Phase-2/3 governance stores.)

| Module / store | Evidence it fits append-only repo pattern | Current impl |
|----------------|-------------------------------------------|--------------|
| `core/knowledge-learning` `LearningRepository` | Already JSONL append + index rebuild; hand-rolled atomic write | raw `appendFileSync` / `writeFileSync` |
| `core/critic-gate` CriticGateStore | JSONL gate events | hand-rolled |
| `core/founder-decisions` FounderReviewRepository / decisions | JSONL decisions | hand-rolled / custom |
| Department `*Memory.ts` append stores (#6–13) | Identical load/append/writeFileSync pattern | raw fs |
| `resume-learning` quality-history / learned-rules writers | Append/update learning root | raw fs |
| Worker append v2/v3 | Append into learning root | raw fs |

### Modules that **intentionally should NOT** use BaseAppendOnlyRepository

| Module / store | Why |
|----------------|-----|
| `core/knowledge` KnowledgeRegistry | In-process Knowledge Authority + domain policies — not an append JSONL governance log |
| Generated resume / QA / preview artifacts | Product artifact trees, not append-only registries |
| Dashboard/report markdown regenerators | Report snapshots |
| Scheduler config / state files | Mutable operational state (distinct from learning file) |
| Runtime-loop heartbeats / health JSON | Ephemeral state |
| Event-bus in-memory history | Bounded memory, not durable append repo |
| `runtime/memory` empty dirs | No implementation yet — adoption N/A until implemented |
| Mission one-shot review roots | Temporary mission artifacts |

---

## B. MemoryService

### Modules that **use** MemoryService

**None.** Interface exported; no implementer; no callers of `tierPath`.

### Modules that **should already be using** MemoryService but **do not**

(Criteria: surface maps to declared tiers Session / Project / LongTerm in `runtime/memory/types.ts`.)

| Store | Natural MemoryService tier | Current |
|-------|----------------------------|---------|
| research sessions | SessionMemory | ResearchMemory hand-roll |
| design-brain / composer session dirs | SessionMemory | hand-roll |
| saios/learning design-memory + rules | ProjectMemory or LongTermMemory (preferences) | hand-roll |
| design-brain founder-preferences | LongTermMemory preferences | hand-roll |
| scheduler job-history | ProjectMemory events | hand-roll |
| long-term empty dir under saios/memory | LongTermMemory | orphan placeholder |

### Modules that **intentionally should NOT** use MemoryService

| Module / store | Why |
|----------------|-----|
| `core/knowledge` | Knowledge Authority ≠ memory tiers |
| `core/knowledge-learning` | Founder Learning Authority — decision-derived entries, not MemoryService tiers |
| Execution Memory BaseAppendOnly stores | Governance/execution snapshots — different concern |
| Telemetry / Cost ledger | Platform accounting / telemetry |
| Product artifacts / reports | Not memory tiers |
| Critic-gate / founder-decisions | Evaluation/decision history, not MemoryService |

---

## C. Bypass summary

| Cohort | Extends BaseAppendOnly | Uses MemoryService | Bypasses both |
|--------|------------------------|--------------------|---------------|
| Phase-2/3 execution/platform repos | Yes | No | No (uses Base) |
| Founder learning LearningRepository | No | No | **Yes** |
| All department `*Memory.ts` | No | No | **Yes** |
| Resume learning hub | No | No | **Yes** |
| Scheduler learning | No | No | **Yes** |
| Knowledge Authority | No | No | **Yes (intentional)** |
| runtime/memory | No | Types only | Orphan |

**Adoption gap headline:** learning/memory layer never joined the #173/#176 BaseAppendOnly consolidation; MemoryService remains an orphaned abstraction.
