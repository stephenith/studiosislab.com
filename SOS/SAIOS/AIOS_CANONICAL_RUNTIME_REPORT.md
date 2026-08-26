# AIOS Canonical Runtime Report — Agent #159

**Status:** Architecture consolidation & freeze (metadata only)  
**Date:** 2026-07-12  
**Mode:** No behaviour change · No provider/publishing/UI implementation · No deletions · No renames  

---

## 1. Executive Summary

Agent #159 consolidates the repository around **one canonical runtime** without rewriting or deleting code.

| Decision | Result |
|----------|--------|
| Canonical execution engine | **Pipeline A spine** — `core/first-production-cycle` orchestrating Knowledge → Skills → Brain Router → Mock Provider → DesignBrief → Renderer → Editor Compatibility → Resume Critic → Critic Gate → Founder Review → Founder Gate Runtime → Learning |
| Pipeline B role | **Orchestration + Workers + Services** — ExecutiveOrchestrator (Company Brain seed), Queue, Registry, Directors; generation modules reclassified as Workers |
| Second engines | Classified **LEGACY / ARCHIVED / REFERENCE** — not deleted |
| Behaviour | **Unchanged** — Dashboard, Founder Review, verify scripts, dry-run guarantees preserved |
| Metadata | `SOS/SAIOS/architecture/*` + per-module `ARCHITECTURE.json` (79 modules) |

**Overall readiness: 84%**

Outstanding blockers are documented (not fixed): real Queue wiring into the canonical spine, router bypasses in legacy workers, structural publish choke point, Manager tier not implemented, Company Brain not yet promoted beyond metadata.

---

## 2. Current Architecture (as found)

Two complete execution paths coexisted:

### Pipeline A (`SOS/SAIOS/core/*`)
Verified dry-run spine with Mock Provider, Critic Gate, interactive Founder Review, Learning write-back, and Dashboard consumption.

### Pipeline B (`SOS/SAIOS/runtime/*`)
Organizational hierarchy (Controller, ExecutiveOrchestrator, Queue, Registry, Directors) plus full generation engines (`unified-production`, `pipeline`, `production-pipeline` v2/v3) that historically produced real templates (`t094`).

They shared artifact folders under `SOS/07_LOGS/saios/` but **not** contracts. Dashboard primarily observes Pipeline A.

---

## 3. Canonical Architecture (frozen)

```
FOUNDER
  ↓
COMPANY BRAIN          ← runtime/chief (ExecutiveOrchestrator) + controller (intake)
  ↓
DEPARTMENTS            ← department-enablement.json; website-department dormant
  ↓
DIRECTORS              ← runtime/directors/* (orchestrate only)
  ↓
MANAGERS               ← not yet a separate module (Batch Director blends role)
  ↓
WORKERS                ← core DesignBrief/Renderer + runtime research/benchmark/
                         design-brain/composer/resume-production/qa/publication
  ↓
SKILLS                 ← core/skills
  ↓
BRAIN ROUTER           ← core/ai-brain (+ resume-integration bridge)
  ↓
MODELS                 ← core/providers/mock (+ provider-validation gate)
  ↓
TOOLS                  ← runtime/cursor (engineering), Firecrawl (research), editor/FS
  ↓
EVALUATION             ← core/resume-critic + critic-gate (+ editor-compatibility)
  ↓
FOUNDER GATE           ← founder-decisions + founder-gate-runtime
  ↓
LEARNING               ← core/knowledge-learning → core/knowledge
  ↓
PUBLISHING             ← runtime/publication (capability; not implemented this agent)
  ↓
DASHBOARD              ← SOS/SAIOS/dashboard (read-only + one decision write)
```

**Substrate:** `runtime/queue` + `runtime/registry` (Production).  
**Canonical spine entry:** `core/first-production-cycle` (until Company Brain + real Queue are wired — intake remains hardcoded; spine stages are canonical).

---

## 4. Module Classification

Full registry: [`SOS/SAIOS/architecture/module-roles.json`](../SAIOS/architecture/module-roles.json)

| Role | Count (approx) | Examples |
|------|----------------|----------|
| CORE_ENGINE | 14 | ai-brain, skills, designbrief, critic-gate, first-production-cycle, … |
| ORCHESTRATION | 5 | chief, controller, directors, website-department |
| WORKER | 12 | renderer, research, benchmark, design-brain, resume-production, publication |
| SERVICE | 30+ | queue, registry, event-bus, monitoring, deployment, … |
| KNOWLEDGE | 3 | core/knowledge, knowledge-learning, domain/studiosislab |
| TOOL | 2 | cursor, tools |
| UI | 1 | dashboard |
| LEGACY | 8 | unified-production, pipeline, founder-critic, old dashboards, … |
| REFERENCE | 2 | first-dry-run, missions |

Every listed module has `ARCHITECTURE.json` declaring role, allowed/forbidden dependencies.

---

## 5. Execution Engine Inventory

Full detail: [`execution-engines.json`](../SAIOS/architecture/execution-engines.json)

| Engine | Classification | Entry |
|--------|----------------|-------|
| `core/first-production-cycle` | **CANONICAL** | `runFirstProductionCycle()` |
| `core/first-dry-run` | REFERENCE | `runFirstDryRun()` |
| `runtime/unified-production` | **ARCHIVED** | `runUnifiedProduction()` |
| `runtime/pipeline` | LEGACY | `PipelineOrchestrator` / `PipelineExecutor` |
| `workers/…/production-pipeline.ts` (v2) | LEGACY (→ WORKER) | `runProductionV2()` |
| `workers/…/production-pipeline-v3.ts` | LEGACY (→ WORKER) | `runProductionV3()` |
| `runtime/controller` sessions | LEGACY (intake valuable) | `submitFounderObjective()` |
| `scheduler/ProductionExecutor` | LEGACY bypass | calls `runUnifiedProduction` |

**Rule:** Do not create another full execution engine. Do not delete these modules.

---

## 6. Execution Path (single canonical)

**Intended / frozen path:**

```
Founder → Company Brain → Director → Manager → Worker
  → Evaluation → Founder Review → Learning → Publishing
```

**Currently proven end-to-end (dry-run):**

```
Founder (implicit hardcoded objective)
  → first-production-cycle stages
  → Knowledge → Skills → Brain Router → Mock
  → DesignBrief → Renderer → Editor Compat
  → Critic → Gate → Founder Review Queue
  → WAITING_FOUNDER → (dashboard decision) → Learning
```

Publishing remains `publication_allowed: false` (not implemented this agent).

### Modules currently bypassing the canonical path

| Bypass | Module | Severity |
|--------|--------|----------|
| Alternate full engine | `runtime/unified-production` | HIGH |
| Alternate full engine | `runtime/pipeline` | HIGH |
| Alternate generator | `production-pipeline-v3` / v2 | HIGH |
| Scheduler → unified | `scheduler/ProductionExecutor` | HIGH |
| Missions call v3 | `SOS/SAIOS/missions/*` | MEDIUM |
| Simulated queue | first-production-cycle stages 1–2 | MEDIUM |
| Parallel critics | self/triple/founder-critic | MEDIUM |

---

## 7. Responsibility Map

Full detail: [`responsibility-map.json`](../SAIOS/architecture/responsibility-map.json)

| Concern | Who (intended) | Current reality |
|---------|----------------|-----------------|
| Schedules | scheduler, chief, directors | Simulated in first-production-cycle; scheduler may call unified |
| Allocates | chief Dispatcher + Registry | Implemented in ExecutiveOrchestrator |
| Executes | Workers only | Core workers + legacy generation workers |
| Evaluates | resume-critic + critic-gate | Also legacy critiques |
| Decides | Founder + Company Brain (delegate only) | Founder HITL; DecisionEngine deterministic |
| Publishes | Publishing after Founder Gate | Draft packages only; spine forbids publish |

**Managers:** not a separate module yet — documented, not implemented (per Agent #159 strict rules).

---

## 8. Dependency Graph

Full detail: [`dependency-graph.json`](../SAIOS/architecture/dependency-graph.json)

- Canonical spine is a **DAG** — no circular execution dependencies.
- Dashboard **observes** artifacts; only write is FounderDecision.
- Archived `unified-production` forms a parallel DAG and must not be the primary feed for Dashboard.

---

## 9. Contract Inventory

Full detail: [`contracts.json`](../SAIOS/architecture/contracts.json)

| Artifact | Producer | Version status |
|----------|----------|----------------|
| KnowledgeSnapshot | core/knowledge | versioned (1.0.0) |
| SkillRequest | resume-integration | **missing explicit version** |
| ReasoningResponse | Mock via Brain Router | provider registry 1.0.0 |
| DesignBrief | designbrief | 1.0.0 |
| ResumeJSON | ResumeJsonMapper | designbrief-resume-json-1.0.0 |
| CanvasJSON | resume-renderer | Fabric 6.9.1 |
| CriticResult | resume-critic | **missing; triplicated normalization** |
| GateResult | critic-gate | package 1.0.0 |
| FounderDecision | founder-decisions | implicit decision_id |
| LearningEvent | knowledge-learning | implicit; parallel stores remain |
| ProviderValidation | provider-validation | 1.0.0 |
| QueueJob | runtime/queue | v1 |
| DashboardSnapshot | loadSnapshot (ephemeral) | types only |
| PublicationPackage | runtime/publication | states; not gate-wired |
| FactoryTemplateJSON | workers template-builder | **parallel producer** vs Canvas path |

Schemas were **not** modified.

---

## 10. Duplicate Inventory

Full detail: [`duplicates.json`](../SAIOS/architecture/duplicates.json)

| System | Verdict |
|--------|---------|
| Execution engines | KEEP core spine; ARCHIVE unified; LEGACY pipeline/v2/v3-as-engine |
| Evaluation | KEEP core critic+gate; MERGE heuristics; ARCHIVE parallel authorities |
| Learning | KEEP knowledge-learning; MERGE B stores |
| Knowledge | KEEP core/knowledge; MERGE runtime/knowledge + memory |
| Rendering | KEEP resume-renderer; MERGE visual-render / template-builder onto spine |
| Publishing | KEEP publication (gated); no auto-publish |
| Reporting | KEEP dashboard + reporter service |
| Orchestration | KEEP chief + directors + queue + registry |
| Dashboard UI | KEEP dashboard; ARCHIVE runtime founder/production dashboards |
| Model routing | KEEP ai-brain; MERGE model-strategy |

**No deletions performed.**

---

## 11. Router Validation

Full detail: [`router-violations.json`](../SAIOS/architecture/router-violations.json)

**Compliant:** core ai-brain, skills, mock provider, resume-integration gateway, designbrief, renderer, critic, gate, founder-gate-runtime, dashboard.

**Violations (no OpenAI SDK installed; reasoning/engine bypasses):**

| ID | Module | Issue |
|----|--------|-------|
| V-001 | production-pipeline-v3 | Embedded judgment + standalone engine |
| V-002 | production-pipeline (v2) | Same |
| V-003 | research/* | Cursor-centric intelligence (partially gateway-backed) |
| V-004 | benchmark/* | Research outside Skills vocabulary |
| V-005 | design-brain/* | Parallel design authority |
| V-006 | unified-production | Alternate execution engine |
| V-007 | pipeline/PipelineExecutor | Legacy full engine |
| V-008 | scheduler/ProductionExecutor | Calls unified — bypasses canonical spine |
| V-009 | cursor/CursorProcess | OK as Engineering Tool if scoped |
| V-010 | self/triple critique | Duplicate evaluation |

**Workers do not import OpenAI.** Violations are architectural (bypass / embed reasoning / second engines), not live API calls.

---

## 12. Migration Status

| Item | Status |
|------|--------|
| Freeze Pipeline A as canonical engine | **DONE** (metadata + report) |
| Classify Pipeline B orchestration | **DONE** |
| Classify generation as Workers | **DONE** (metadata) |
| Per-module ARCHITECTURE.json | **DONE** (79 files) |
| Central architecture registry | **DONE** (`SOS/SAIOS/architecture/`) |
| Wire Company Brain → Queue → spine | **NOT DONE** (would change behaviour — documented) |
| Retarget ProductionExecutor away from unified | **NOT DONE** (behaviour change — documented) |
| Merge critics / learning stores | **NOT DONE** (behaviour change — documented) |
| Implement Managers | **FORBIDDEN this agent** |
| Implement Providers / Publishing / OpenAI | **FORBIDDEN this agent** |
| Delete LEGACY modules | **FORBIDDEN this agent** |

---

## 13. Outstanding Blockers (before claiming 100%)

1. **Dual engines still callable** — `runUnifiedProduction` / `runProductionV3` remain importable. Classification is metadata; call-sites (scheduler, missions) still bypass.
2. **Canonical spine uses simulated scheduler/queue** — not yet real `runtime/queue` jobs.
3. **Company Brain not wired** — ExecutiveOrchestrator exists but does not drive first-production-cycle.
4. **Router violations V-001…V-008** remain in code.
5. **Publication not structurally gated** through Founder Gate Runtime (convention only).
6. **CriticScoresView triplication** — contract debt.
7. **Manager layer absent** as a module.
8. **Cost ledger / real model adapters** — Phase 2+ (explicitly out of scope).

---

## 14. Overall Readiness

| Dimension | Score |
|-----------|-------|
| Canonical engine identified & documented | 100% |
| Module classification complete | 100% |
| Contract inventory complete | 95% |
| Duplicate inventory complete | 100% |
| Router violations inventoried | 100% |
| Behaviour preserved (no runtime change) | 100% |
| Single *callable* execution path in practice | 55% |
| Orchestration wired to spine | 40% |
| **Overall readiness** | **84%** |

---

## 15. Architectural Invariants (frozen)

1. Exactly one execution engine (Pipeline A spine).
2. Pipeline B does not become a second engine.
3. Directors / Managers never execute work.
4. Workers never call providers/OpenAI directly.
5. Reasoning only via Skills → Brain Router → Provider.
6. Cursor = Engineering Tool only; Firecrawl = Research Tool only.
7. Publication only after Founder Gate (when publishing is later enabled).
8. Learning append-only into governed Knowledge.
9. Dashboard observes; only FounderDecision writes.
10. Do not delete LEGACY/REFERENCE without a dedicated cleanup agent.
11. Do not break Dashboard, Founder Review, or verify suites.
12. Dry-run / LIVE OFF / Mock-only remains until Provider Validation clears.

---

## 16. Artifacts Produced by Agent #159

```
SOS/SAIOS/architecture/
  README.md
  ARCHITECTURE.json
  module-roles.json
  execution-engines.json
  contracts.json
  duplicates.json
  responsibility-map.json
  router-violations.json
  dependency-graph.json
  canonical-runtime-tree.json

SOS/SAIOS/**/ARCHITECTURE.json   (79 modules)

SOS/09_REPORTS/AIOS_CANONICAL_RUNTIME_REPORT.md
```

---

## 17. Recommendation

**APPROVE architecture freeze.**  

Agent #159 completed consolidation **as documentation + metadata**. Runtime behaviour is unchanged; verification surfaces are untouched. Next agents (Phase 2+) must:

1. Retarget bypass call-sites to the canonical spine (or mark them verify-only).
2. Wire ExecutiveOrchestrator → Queue → canonical workers (without implementing new Company Brain AI logic beyond existing DecisionEngine).
3. Resolve router violations by reclassification / gateway enforcement — not by adding OpenAI.

Do **not** start Provider, Publishing, Website, SEO, or OpenAI work until bypass engines are no longer the default entry points.
