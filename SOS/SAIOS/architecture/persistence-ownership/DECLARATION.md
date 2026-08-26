# Declaration

**Agent #197 · Persistence Ownership & Taxonomy Declaration V1**  
**Official registration of all 42 surfaces from Agent #196.**  
**DOCUMENTATION-ONLY · No runtime changes · LIVE OFF**

Field definitions:

- **architectural category** — one of the 12 taxonomy categories (or N/A for orphan/duplicate shims without a live store)  
- **persistence classification** — durable shape (JSONL, mutable JSON, session dirs, empty placeholder, none)  
- **lifecycle classification** — Active | Temporary | Legacy | Orphan | Placeholder  
- **architectural layer** — Core | Runtime Worker | Runtime Service | Platform | Legacy Engine | Documentation  
- **current implementation** — as exists in repo  
- **intended abstraction** — declared target abstraction **name only** (not an adoption order)  
- **adoption status** — exactly one of: Native BaseAppendOnlyRepository | Native MemoryService | Legacy persistence | Intentional standalone persistence | Temporary persistence | Future adoption candidate | Orphaned abstraction  
- **architectural status** — Declared | Exception | Legacy Declared | Orphan Declared

---

## Complete declaration table

| # | Surface | Canonical owner | Architectural category | Persistence classification | Lifecycle | Layer | Current implementation | Intended abstraction | Adoption status | Architectural status |
|---|---------|-----------------|------------------------|----------------------------|-----------|-------|------------------------|----------------------|-----------------|----------------------|
| 1 | knowledge-system | `core/knowledge` | Knowledge | Mutable JSON domain/ownership logs | Active | Core | KnowledgeRegistry + KnowledgeManager | Intentional KnowledgeRegistry | Intentional standalone persistence | Declared |
| 2 | knowledge/learning | `core/knowledge-learning` | Founder Learning | Append JSONL + snapshot/index | Active | Core | LearningRepository (hand-rolled) | BaseAppendOnlyRepository | Future adoption candidate | Declared |
| 3 | saios/learning design-memory hub | `runtime/workers/resume-learning` | Department Learning | Mutable JSON multi-file hub | Active | Runtime Worker | design-memory.ts + learning-engine | MemoryService (Project/LongTerm) | Legacy persistence | Exception |
| 4 | worker-v2-append | `runtime/workers/resume-production` | Department Learning | Mutable JSON append-style | Temporary | Runtime Worker | learning-append.ts | none (temporary) | Temporary persistence | Declared |
| 5 | worker-v3-append | `runtime/workers/resume-production` | Department Learning | Mutable JSON append-style | Temporary | Runtime Worker | learning-append-v3.ts | none (temporary) | Temporary persistence | Declared |
| 6 | design-brain founder-preferences | `runtime/design-brain` | Department Learning | Append entries in mutable JSON | Active | Runtime Worker | DesignMemory.ts | MemoryService (LongTerm) | Legacy persistence | Declared |
| 7 | composer-learning | `runtime/adaptive-composer` | Department Learning | Append entries in mutable JSON | Active | Runtime Worker | ComposerMemory.ts | MemoryService / BaseAppendOnly | Legacy persistence | Declared |
| 8 | benchmark-learning | `runtime/benchmark` | Department Learning | Append entries in mutable JSON | Active | Runtime Worker | BenchmarkMemory.ts | BaseAppendOnlyRepository | Legacy persistence | Declared |
| 9 | publication-learning | `runtime/publication` | Department Learning | Append entries in mutable JSON | Active | Runtime Worker | PublicationMemory.ts | BaseAppendOnlyRepository | Legacy persistence | Declared |
| 10 | competitive-learning | `runtime/competitive-validation` | Department Learning | Append entries in mutable JSON | Active | Runtime Worker | CompetitiveMemory.ts | BaseAppendOnlyRepository | Legacy persistence | Declared |
| 11 | render-learning | `runtime/visual-render` | Department Learning | Append entries in mutable JSON | Active | Runtime Worker | VisualRenderMemory.ts | BaseAppendOnlyRepository | Legacy persistence | Declared |
| 12 | critic-learning | `runtime/founder-critic` | Department Learning | Append entries in mutable JSON | Legacy | Legacy Engine | CriticMemory.ts | none (legacy) | Legacy persistence | Legacy Declared |
| 13 | scheduler-learning + job-history | `runtime/scheduler` | Operational Memory | Append entries in mutable JSON | Active | Runtime Service | SchedulerMemory.ts | BaseAppendOnlyRepository | Legacy persistence | Exception |
| 14 | research sessions | `runtime/research` | Operational Memory | Session JSON dirs | Active | Runtime Worker | ResearchMemory.ts | MemoryService (Session) | Legacy persistence | Declared |
| 15 | saios/memory tier dirs | `runtime/memory` (declared) | — (no live store) | Empty `.gitkeep` dirs | Orphan | Runtime Service | MemoryService types only | MemoryService | Orphaned abstraction | Orphan Declared |
| 16 | runtime/knowledge shim | `runtime/knowledge` | — (no store) | none | Placeholder | Legacy Engine | types only | none | Orphaned abstraction | Orphan Declared |
| 17 | design-brain session outputs | `runtime/design-brain` | Operational Memory | Session JSON/MD | Active | Runtime Worker | DesignBrain writers | MemoryService (Session) | Legacy persistence | Declared |
| 18 | composer compositions | `runtime/adaptive-composer` | Operational Memory | Composition JSON cache | Active | Runtime Worker | OriginalityGuard / composer | MemoryService (Session) | Legacy persistence | Declared |
| 19 | execution-controller | `runtime/execution-controller` | Execution Memory | JSON+JSONL latest | Active | Runtime Service | ExecutionControllerRepository | BaseAppendOnlyRepository | Native BaseAppendOnlyRepository | Declared |
| 20 | execution-authorization | `runtime/execution-authorization` | Execution Memory | JSON+JSONL latest | Active | Runtime Service | ExecutionAuthorizationRepository | BaseAppendOnlyRepository | Native BaseAppendOnlyRepository | Declared |
| 21 | activation-gate | `runtime/activation-gate` | Execution Memory | JSON+JSONL latest | Active | Runtime Service | ActivationRepository | BaseAppendOnlyRepository | Native BaseAppendOnlyRepository | Declared |
| 22 | pre-dispatch-simulation | `runtime/pre-dispatch-simulation` | Execution Memory | JSON+JSONL latest | Active | Runtime Service | SimulationRepository | BaseAppendOnlyRepository | Native BaseAppendOnlyRepository | Declared |
| 23 | worker-runtime | `runtime/worker-runtime` | Execution Memory | JSON+JSONL latest | Active | Runtime Service | WorkerRuntimeRepository | BaseAppendOnlyRepository | Native BaseAppendOnlyRepository | Declared |
| 24 | runtime-plan | `runtime/planner` | Execution Memory | JSON+JSONL latest | Active | Runtime Service | RuntimePlanRepository | BaseAppendOnlyRepository | Native BaseAppendOnlyRepository | Declared |
| 25 | system-readiness | `runtime/system-readiness` | Execution Memory | JSON+JSONL latest | Active | Runtime Service | SystemReadinessRepository | BaseAppendOnlyRepository | Native BaseAppendOnlyRepository | Declared |
| 26 | runtime-release | `runtime/runtime-release` | Execution Memory | JSON+JSONL latest | Active | Runtime Service | RuntimeReleaseRepository | BaseAppendOnlyRepository | Native BaseAppendOnlyRepository | Declared |
| 27 | shadow-queue | `runtime/queue` | Execution Memory | JSON+JSONL latest | Active | Runtime Service | ShadowQueueRepository | BaseAppendOnlyRepository | Native BaseAppendOnlyRepository | Declared |
| 28 | mission-approvals | `core/company-brain` | Execution Memory | JSON+JSONL latest | Active | Core | MissionApprovalRepository | BaseAppendOnlyRepository | Native BaseAppendOnlyRepository | Declared |
| 29 | queue-admission | `core/company-brain` | Execution Memory | JSON+JSONL latest | Active | Core | QueueAdmissionRepository | BaseAppendOnlyRepository | Native BaseAppendOnlyRepository | Declared |
| 30 | execution-packages / ack / queue-submission | `core/company-brain` | Execution Memory | JSON+JSONL latest | Active | Core | respective repos | BaseAppendOnlyRepository | Native BaseAppendOnlyRepository | Declared |
| 31 | platform telemetry | `platform/telemetry` | Telemetry | JSON+JSONL latest | Active | Platform | TelemetryRepository | BaseAppendOnlyRepository | Native BaseAppendOnlyRepository | Declared |
| 32 | cost ledger | `platform/cost-ledger` | Operational Memory | JSON+JSONL budgets | Active | Platform | BudgetRepository | BaseAppendOnlyRepository | Native BaseAppendOnlyRepository | Declared |
| 33 | department registry | `platform/department-sdk` | State | JSON registry snapshots | Active | Platform | DepartmentRegistry | BaseAppendOnlyRepository | Native BaseAppendOnlyRepository | Declared |
| 34 | founder-decisions | `core/founder-decisions` | History | JSONL + review JSON | Active | Core | FounderReviewRepository / decisions | BaseAppendOnlyRepository | Future adoption candidate | Declared |
| 35 | critic-gate | `core/critic-gate` | History | JSONL gate events | Active | Core | CriticGateStore | BaseAppendOnlyRepository | Future adoption candidate | Declared |
| 36 | founder-gate-runtime | `core/founder-gate-runtime` | State | Cycle/waiting JSON | Active | Core | WaitingFounderRepository etc. | Intentional gate state | Intentional standalone persistence | Declared |
| 37 | event-bus | `runtime/event-bus` | History | In-memory + reporter logs | Active | Runtime Service | EventHistory + reporters | Intentional bounded history | Intentional standalone persistence | Declared |
| 38 | runs / controller / unified | pipeline/controller/unified-production | Execution Memory | Run/session artifacts | Active/Legacy | Runtime Worker / Legacy | RunManager, ProductionSession, StageRunner | Intentional / Legacy engine | Legacy persistence | Exception |
| 39 | scheduler state/config/dashboard | `runtime/scheduler` | State (+ Configuration for config file) | Mutable JSON | Active | Runtime Service | SchedulerState / SchedulerConfig | Intentional standalone | Intentional standalone persistence | Declared |
| 40 | generated-resumes / qa / packages | production / qa / publication | Artifacts | Artifact trees | Active | Runtime Worker | pipeline writers | none (artifacts) | Intentional standalone persistence | Declared |
| 41 | dashboards / mission reports | respective reporters | Reports | Regenerated MD/JSON | Active | Runtime Service | reporters / missions | none (reports) | Intentional standalone persistence | Declared |
| 42 | runtime-loop / manager / supervisor / factory-state | respective modules | State | Health/heartbeat JSON | Active | Runtime Service | respective writers | Intentional standalone | Intentional standalone persistence | Declared |

---

## Adoption status summary

| Adoption status | Count | Surfaces |
|-----------------|------:|----------|
| Native BaseAppendOnlyRepository | 15 | #19–33 |
| Native MemoryService | 0 | — |
| Legacy persistence | 12 | #3, #6–14, #17–18, #38 |
| Intentional standalone persistence | 6 | #1, #36–37, #39–42 |
| Temporary persistence | 2 | #4–5 |
| Future adoption candidate | 3 | #2, #34–35 |
| Orphaned abstraction | 2 | #15–16 |
| **Total** | **42** | |

**Note:** “Future adoption candidate” and “intended abstraction” are **declarations of architectural fit**, not migration orders. Agent #197 performs **no** adoption.

---

## Registration

This table is the **canonical architectural registration** of persistence surfaces for AIOS.  
Runtime manifests that affect execution (`module-roles.json`, `dependency-graph.json`, `runtime-guard.ts`) are **not modified** by this agent.
