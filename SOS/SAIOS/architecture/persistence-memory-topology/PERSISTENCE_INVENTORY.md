# Persistence Inventory

**Agent #196 · Persistence & Memory Topology Reconciliation V1**  
**STRICTLY READ-ONLY · No runtime changes · LIVE OFF**

Definitive census of every persistence surface discovered under `SOS/SAIOS` TypeScript writers (filesystem JSON/JSONL only — no databases).

A **persistence surface** = one logical store (shared owner + primary root), not every individual JSON file.

**Total surfaces: 42**

Legend for declaration columns:
- **MR** = module-roles.json (module entry exists)
- **DG** = dependency-graph.json (node exists)
- **AM** = other architecture manifests / prior certifications name the store
- **RO** = runtime-only (store path undeclared; only module may be declared)

---

## A. Knowledge / Learning / Memory (18)

| # | Surface | Physical location | Owner module | Writer(s) | Reader(s) | Validator | Repository impl | Format | Append/mutable | MR | DG | AM | RO | Abstraction | BaseAppendOnly? | MemoryService? | Bypasses both? |
|---|---------|-------------------|--------------|-----------|-----------|-----------|-----------------|--------|----------------|----|----|----|----|-------------|---------------|----------------|----------------|
| 1 | Knowledge system | `SOS/07_LOGS/saios/knowledge-system/` | `core/knowledge` | `KnowledgeManager`, `core/knowledge/verify` | company-brain `SystemStateReader`, dashboard | `KnowledgeValidator` / verify | in-module registry + log writers | JSON | mutable snapshots | Y | Y | Y | N | custom KnowledgeRegistry | N | N | Y |
| 2 | Founder learning | `SOS/07_LOGS/saios/knowledge/learning/` | `core/knowledge-learning` | `LearningWriteBack`, `ProvisionalCriticLearning` | `KnowledgeManager.mergeFounderLearningFromDisk`, `CycleResumeManager` | `LearningValidator` | `LearningRepository` (hand-rolled) | JSONL + snapshot/index JSON | append-only entries; mutable index/snapshot | Y | Y | Y (#195) | partial | custom LearningRepository | **N** | N | Y |
| 3 | Resume design memory hub | `SOS/07_LOGS/saios/learning/design-memory.json` (+ quality-history, learned-rules, confidence, feedback, founder-calibration, learned-patterns) | `runtime/workers/resume-learning` | `learning-engine`, `founder-calibration` (`saveDesignMemory`) | design-brain engines, research planners, adaptive-composer + founder-critic `KnowledgeConsumer`, resume-production, design-system bridge, founder-dashboard, missions | `resume-learning/verify` | hand-rolled `design-memory.ts` | JSON | mutable | Y (module) | N (store) | partial (#195 wrong class) | **Y store** | raw fs | N | N | Y |
| 4 | Worker learning append v2 | `SOS/07_LOGS/saios/learning/worker-v2-append.json` | `runtime/workers/resume-production` | `learning-append.ts` | dashboards / detectors | verify-v2 | hand-rolled | JSON | mutable append-style | Y (module) | N | Y (#195) | Y | raw fs | N | N | Y |
| 5 | Worker learning append v3 | `SOS/07_LOGS/saios/learning/worker-v3-append.json` | `runtime/workers/resume-production` | `learning-append-v3.ts` | dashboards | reports-v3 | hand-rolled | JSON | mutable append-style | Y | N | Y | Y | raw fs | N | N | Y |
| 6 | Design-brain preferences | `SOS/07_LOGS/saios/design-brain/memory/founder-preferences.json` | `runtime/design-brain` | `DesignBrain` → `appendBrainMemory` | design-brain session | `design-brain/verify` | `DesignMemory.ts` | JSON | append entries in mutable file | Y | N | N | Y | raw fs | N | N | Y |
| 7 | Composer learning | `SOS/07_LOGS/saios/adaptive-composer/memory/composer-learning.json` | `runtime/adaptive-composer` | `AdaptiveComposerDirector` → `appendComposerMemory` | self / reporter | `adaptive-composer/verify` | `ComposerMemory.ts` | JSON | append in mutable file | Y | N | N | Y | raw fs | N | N | Y |
| 8 | Benchmark learning | `SOS/07_LOGS/saios/benchmark/memory/benchmark-learning.json` | `runtime/benchmark` | `BenchmarkDirector` → `appendBenchmarkMemory` | self | verify | `BenchmarkMemory.ts` | JSON | append in mutable file | Y | N | N | Y | raw fs | N | N | Y |
| 9 | Publication learning | `SOS/07_LOGS/saios/publication/memory/publication-learning.json` | `runtime/publication` | `PublicationDirector` → `appendPublicationMemory` | self | catalog-integration verify | `PublicationMemory.ts` | JSON | append in mutable file | Y | N | N | Y | raw fs | N | N | Y |
| 10 | Competitive learning | `SOS/07_LOGS/saios/competitive-validation/memory/competitive-learning.json` | `runtime/competitive-validation` | CompetitiveMemory writers | CompetitiveReporter | verify | `CompetitiveMemory.ts` | JSON | append in mutable file | Y | N | Y (#195) | Y | raw fs | N | N | Y |
| 11 | Visual render learning | `SOS/07_LOGS/saios/visual-render/memory/render-learning.json` | `runtime/visual-render` | VisualRenderMemory writers | adaptive-composer | verify | `VisualRenderMemory.ts` | JSON | append in mutable file | Y | N | Y (#195) | Y | raw fs | N | N | Y |
| 12 | Critic learning (legacy) | `SOS/07_LOGS/saios/founder-critic/memory/critic-learning.json` | `runtime/founder-critic` | `FounderCriticDirector` → `recordCriticRun` | self | `founder-critic/verify` | `CriticMemory.ts` | JSON | append in mutable file | Y (LEGACY) | N | Y (#195) | Y | raw fs | N | N | Y |
| 13 | Scheduler learning | `SOS/07_LOGS/saios/scheduler/scheduler-learning.json` + `job-history.json` | `runtime/scheduler` | `SchedulerDirector` → `appendSchedulerMemory` / `appendJobHistory` | scheduler reporter/state | scheduler verify | `SchedulerMemory.ts` | JSON | append in mutable file | Y (SERVICE) | N | N | Y | raw fs | N | N | Y |
| 14 | Research sessions | `SOS/07_LOGS/saios/research/sessions/` | `runtime/research` | `persistResearchSession` | research consumers | research verify | `ResearchMemory.ts` | JSON session dirs | append sessions (no overwrite) | Y | N | N | Y | raw fs | N | N | Y |
| 15 | Orphan MemoryService dirs | `SOS/07_LOGS/saios/memory/{session,project,long-term}/` | declared owner `runtime/memory` | **none** (`.gitkeep` only) | none | none | types only (`MemoryService`) | empty | n/a | Y | N | Y (#195 PLACEHOLDER) | Y | **MemoryService types, unimplemented** | N | **declared, unused** | n/a |
| 16 | Runtime knowledge shim | (no store) | `runtime/knowledge` | none | none | none | types only | none | n/a | Y (LEGACY) | N | Y | Y | types | N | N | n/a |
| 17 | Design-brain session artifacts | `SOS/07_LOGS/saios/design-brain/` (session dirs, design-confidence.json, …) | `runtime/design-brain` | `DesignBrain` | reporters | verify | hand-rolled | JSON/MD | session-mutable | Y | N | N | Y | raw fs | N | N | Y |
| 18 | Composer compositions | `SOS/07_LOGS/saios/adaptive-composer/compositions/` | `runtime/adaptive-composer` | AdaptiveComposer / OriginalityGuard | OriginalityGuard | verify | hand-rolled | JSON | append/session | Y | N | N | Y | raw fs | N | N | Y |

---

## B. Execution Memory (BaseAppendOnly adopters) (12)

| # | Surface | Physical location | Owner | Writer | Reader | Validator | Repo | Format | Mode | MR | DG | AM | Extends BaseAppendOnly |
|---|---------|-------------------|-------|--------|--------|-----------|------|--------|------|----|----|----|------------------------|
| 19 | Execution controller | `…/runtime/execution-controller/` | `runtime/execution-controller` | ExecutionControllerRepository | dashboard plugins | verify-execution-controller | ExecutionControllerRepository | JSON+JSONL | append + latest | Y | Y | Y (#194) | **Y** |
| 20 | Execution authorization | `…/runtime/execution-authorization/` | same module | ExecutionAuthorizationRepository | dashboard | verify | same | JSON+JSONL | append + latest | Y | Y | Y | **Y** |
| 21 | Activation gate | `…/runtime/activation-gate/` | same | ActivationRepository | dashboard | verify | same | JSON+JSONL | append + latest | Y | Y | Y | **Y** |
| 22 | Pre-dispatch simulation | `…/runtime/pre-dispatch-simulation/` | same | SimulationRepository | dashboard | verify | same | JSON+JSONL | append + latest | Y | Y | Y | **Y** |
| 23 | Worker runtime | `…/runtime/worker-runtime/` | same | WorkerRuntimeRepository | dashboard | verify | same | JSON+JSONL | append + latest | Y | Y | Y | **Y** |
| 24 | Runtime plan | `…/runtime/runtime-plan/` | `runtime/planner` | RuntimePlanRepository | dashboard | verify | same | JSON+JSONL | append + latest | Y | N* | Y (#188) | **Y** |
| 25 | System readiness | `…/runtime/system-readiness/` | same | SystemReadinessRepository | dashboard | verify | same | JSON+JSONL | append + latest | Y | N* | Y | **Y** |
| 26 | Runtime release | `…/runtime/runtime-release/` | same | RuntimeReleaseRepository | dashboard | verify | same | JSON+JSONL | append + latest | Y | N* | Y | **Y** |
| 27 | Shadow queue | `…/runtime/shadow-queue/` | `runtime/queue` | ShadowQueueRepository | dashboard | verify | same | JSON+JSONL | append + latest | Y | Y | Y | **Y** |
| 28 | Mission approvals | `…/company-brain/mission-approvals/` | `core/company-brain` | MissionApprovalRepository | dashboard / brain | verify | same | JSON+JSONL | append + latest | Y | N* | Y | **Y** |
| 29 | Queue admission | `…/company-brain/queue-admission/` | company-brain | QueueAdmissionRepository | dashboard | verify | same | JSON+JSONL | append + latest | Y | N* | Y | **Y** |
| 30 | Execution packages + ack + queue submission | `…/company-brain/execution-packages/`, `execution-package-ack/`, `queue-submission/` | company-brain | respective repos | dashboard | verify | same | JSON+JSONL | append + latest | Y | N* | Y | **Y** |

\*Module may exist in MR; DG coverage is Phase-3/4 oriented and incomplete for every company-brain sub-store.

---

## C. Telemetry / Cost / Platform (3)

| # | Surface | Location | Owner | Writer | Reader | Repo | BaseAppendOnly | Class hint |
|---|---------|----------|-------|--------|--------|------|----------------|------------|
| 31 | Telemetry registry | `…/platform/telemetry/` | `platform/telemetry` | TelemetryRepository | dashboard | TelemetryRepository | **Y** | Telemetry |
| 32 | Cost ledger / budgets | `…/platform/cost-ledger/` | `platform/cost-ledger` | BudgetRepository | dashboard | BudgetRepository | **Y** | Operational / Cost Authority |
| 33 | Department registry | `…/platform/department-sdk/` | `platform/department-sdk` | DepartmentRegistry | dashboard | DepartmentRegistry | **Y** (pattern) | State / Configuration |

---

## D. History / State / Artifacts / Reports (9 grouped)

| # | Surface | Location | Owner | Notes | Class |
|---|---------|----------|-------|-------|-------|
| 34 | Founder decisions | `…/founder-decisions/` | `core/founder-decisions` | `FounderReviewRepository` / decisions.jsonl | History + Founder gate input |
| 35 | Critic-gate store | `…/critic-gate/` | `core/critic-gate` | CriticGateStore (JSONL) | History / Evaluation |
| 36 | Founder-gate-runtime | `…/founder-gate-runtime/` | `core/founder-gate-runtime` | WaitingFounderRepository, cycle state | State |
| 37 | Event bus | `…/event-bus/` | `runtime/event-bus` | EventHistory in-memory + config/reporter logs | History (bounded) |
| 38 | Pipeline / runs / controller | `…/runs/`, `…/controller/`, unified-production | runtime pipeline/controller | RunArtifacts, ProductionSession | Execution History / Artifacts |
| 39 | Scheduler state/config/dashboard | `…/scheduler/` (non-learning files) | `runtime/scheduler` | scheduler-state, config, health | State + Configuration |
| 40 | Generated resumes / QA / publication packages | `…/generated-resumes/`, `…/qa/`, `…/publication/packages/` | production/qa/publication | product artifacts | Artifacts |
| 41 | Dashboards / reporters / mission review roots | founder-dashboard, production-dashboard, founder-review-00N, quality-calibration, collections | respective | report snapshots | Reports / Snapshots |
| 42 | Runtime-loop / runtime-manager / supervisor / factory-state | respective `07_LOGS` roots | respective | heartbeats, health, factory discovery | State |

---

## Evidence notes

- Persistence is **filesystem-only** (no sqlite/redis/mongo in SAIOS sources; only `node_modules` type defs).
- `platform/shared/fs.ts` + `BaseAppendOnlyRepository` are the **canonical persistence helpers** for Phase-2/3 governance stores.
- **Zero** learning/memory `*Memory.ts` modules extend `BaseAppendOnlyRepository`.
- **Zero** runtime modules implement `MemoryService`; log dirs under `saios/memory/` are empty placeholders.
- Agent #195 inventory covered surfaces **1–5, 10–12, 15–16** incompletely; **6–9, 13–14, 17–18** and the full execution/platform census were out of that audit’s declared scope and must be treated as gaps in #195, not as optional extras.
