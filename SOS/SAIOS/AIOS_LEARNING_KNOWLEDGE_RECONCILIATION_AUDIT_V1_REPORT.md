# AIOS Learning & Knowledge Reconciliation Audit V1

**Agent #195** · Chief Software Architect  
**Mode:** STRICTLY READ-ONLY architectural audit  
**Not a certification · Not a redesign · Not an implementation**  
**Runtime:** UNCHANGED · **Learning stores:** UNMOVED · **LIVE:** OFF  
**Date:** 2026-07-12

---

## 1. Purpose

Produce the definitive architectural reconciliation of the Learning and Knowledge ecosystem **before** any Learning Authority certification.

This audit answers, with repository evidence only:

- Who owns which learning / knowledge / memory store  
- Whether `SOS/07_LOGS/saios/learning/` is departmental memory, a duplicate authority, or something else  
- Whether `core/knowledge-learning` is founder learning, global learning, or Knowledge Authority  
- Whether Resume Learning should feed Knowledge Learning, remain independent, or remain departmental  
- Whether AIOS should adopt one Learning Authority, a distributed model, or department satellites  

Supporting packages: `SOS/SAIOS/architecture/learning-reconciliation/`.

---

## 2. Evidence base

**Core / knowledge**

- `SOS/SAIOS/core/knowledge/KnowledgeManager.ts`  
- `SOS/SAIOS/core/knowledge/KnowledgePolicies.ts`  
- `SOS/SAIOS/core/knowledge/KnowledgeRegistry.ts`  
- `SOS/SAIOS/core/knowledge-learning/LearningWriteBack.ts`  
- `SOS/SAIOS/core/knowledge-learning/LearningRepository.ts`  
- `SOS/SAIOS/core/knowledge-learning/LearningEntryBuilder.ts`  
- `SOS/SAIOS/core/knowledge-learning/types.ts`  
- `SOS/SAIOS/core/knowledge-learning/LearningSnapshotBuilder.ts`  

**Founder / evaluation**

- `SOS/SAIOS/core/founder-decisions/FounderDecisionManager.ts`  
- `SOS/SAIOS/core/critic-gate/ProvisionalCriticLearning.ts`  
- `SOS/SAIOS/core/resume-critic/*` (exports)  
- `SOS/SAIOS/architecture/dependency-graph.json`  
- `SOS/SAIOS/architecture/module-roles.json`  

**Resume learning & satellites**

- `SOS/SAIOS/runtime/workers/resume-learning/learning-engine.ts`  
- `SOS/SAIOS/runtime/workers/resume-learning/design-memory.ts`  
- `SOS/SAIOS/runtime/workers/resume-learning/index.ts`  
- `SOS/SAIOS/runtime/workers/resume-production/learning-append.ts`  
- `SOS/SAIOS/runtime/competitive-validation/CompetitiveMemory.ts`  
- `SOS/SAIOS/runtime/visual-render/VisualRenderMemory.ts`  
- `SOS/SAIOS/runtime/founder-critic/CriticMemory.ts`  
- `SOS/SAIOS/runtime/memory/types.ts`  
- `SOS/SAIOS/runtime/knowledge/types.ts`  

---

## 3. Store classification

| Store / module | Owner | Purpose | Persistence | Producers | Consumers | Class |
|----------------|-------|---------|-------------|-----------|-----------|-------|
| `knowledge/learning/` | `core/knowledge-learning` | Founder-decision `LearningEntry` + provisional critic observations | JSONL + snapshot | `LearningWriteBack`, `ProvisionalCriticLearning` | `KnowledgeManager.mergeFounderLearningFromDisk` | **CANONICAL** (founder learning) |
| `core/knowledge` registry | `KnowledgeRegistry` / `KnowledgeManager` | Six-domain Knowledge Authority | In-process seed + upsert | Seed; merge founder learning; `writeEntry` | Retriever; resume pre-skill | **CANONICAL** (knowledge) |
| `saios/learning/` | `runtime/workers/resume-learning` | Resume design preferences / rules / quality | JSON files under learning root | Learning engine; worker appends; calibration | Resume workers; missions; dashboard; LEGACY founder-critic | **SATELLITE** (departmental) |
| Competitive memory | `competitive-validation` | Competitive scores / strengths | `competitive-validation/memory/` | CompetitiveValidationDirector | CompetitiveReporter | **SATELLITE** |
| Visual render memory | `visual-render` | Render principles | `visual-render/memory/` | VisualRenderDirector | adaptive-composer | **SATELLITE** |
| Critic memory | `founder-critic` | Critic-run learning | `founder-critic/memory/` | FounderCriticDirector | Self | **LEGACY** |
| Learning append v2/v3 | `resume-production` | Prototype decision appends | `saios/learning/worker-v*-append.json` | production workers | Comparison / duplicate detectors | **TEMPORARY** satellite write |
| `runtime/memory` | types only | Session/project/long-term contracts | None | — | — | **PLACEHOLDER** |
| `runtime/knowledge` | types only | KnowledgeService shim | None | — | — | **LEGACY** shim |

Full detail: `STORE_CLASSIFICATION.md`.

---

## 4. Learning topology

```
PRODUCERS                         ROOTS                              CONSUMERS
─────────                         ─────                              ─────────
FounderDecision ────────────────► knowledge/learning/ ─────────────► core/knowledge
ProvisionalCriticLearning ──────► (same; approved_by_founder=false)

resume-learning engine ─────────► saios/learning/ ─────────────────► design-brain, research,
worker appends / calibration ───► (design-memory, rules, …)          resume-production, …

CompetitiveValidation ──────────► competitive-validation/memory/
VisualRender ───────────────────► visual-render/memory/
FounderCritic (LEGACY) ─────────► founder-critic/memory/
```

Declared graph (`dependency-graph.json`) only models:

`founder-decisions / founder-gate-runtime → knowledge-learning → knowledge`  
and evaluation: `resume-critic → critic-gate → founder-gate-runtime`.

It **omits** resume-learning, competitive memory, visual-render memory, critic memory, and worker appends.

Full diagram: `LEARNING_TOPOLOGY.md`.

---

## 5. Specific determinations

### 5.1 Is `SOS/07_LOGS/saios/learning/` …

| Option | Determination |
|--------|---------------|
| Operational departmental memory | **YES — primary** |
| Duplicate learning authority | **NO** (different schema/purpose from `LearningEntry`; does not own Knowledge) |
| Temporary historical implementation | **PARTIAL** (durable and actively consumed) |
| Something else | Undeclared parallel persistence vs `module-roles` forbid `parallel_learning_store_new` |

**Evidence:** `design-memory.ts` LEARNING_ROOT; worker constraints (“overlay layers for Resume Workers”, “Output only to `SOS/07_LOGS/saios/learning/`”); consumers are Resume-department modules; no `knowledge-learning` import in `learning-engine.ts`.

### 5.2 Is `core/knowledge-learning` …

| Option | Determination |
|--------|---------------|
| Founder Learning only | **YES** |
| Global Learning | **NO** |
| Knowledge Authority | **NO** (`core/knowledge` is) |
| Something else | Founder-decision write-back + provisional critic observations into founder-learning root |

**Evidence:** `LearningWriteBack.writeFromDecision(FounderDecision)`; `LearningEntryBuilder` maps decision categories; `KnowledgeManager.mergeFounderLearningFromDisk` merges snapshot into domain `learning`.

### 5.3 Should Resume Learning …

| Option | Architectural intent |
|--------|----------------------|
| Feed Knowledge Learning | Declared in `module-roles` allowed_deps; **not implemented** |
| Remain independent | Runtime reality |
| Remain departmental | **Intent** — satellite overlays for Resume workers |

**Determination:** Remain a **departmental satellite**. Do not merge stores in this audit. Do not treat it as a second learning authority.

### 5.4 Satellites / legacy / temporary

| Module | Class |
|--------|-------|
| Competitive Memory | Department satellite |
| Visual Render Memory | Department satellite |
| Learning Append / worker learning writes | Temporary worker-side satellite writes into Resume root |
| Founder Critic + CriticMemory | **LEGACY** (module-roles) |
| Provisional Critic Learning | Satellite of founder-learning path (`approved_by_founder=false`) |

---

## 6. Drift matrix

| Declared | Runtime | Drift |
|----------|---------|-------|
| `resume-learning → knowledge-learning` allowed | No import | **CONFLICT** |
| Forbid `parallel_learning_store_new` | `saios/learning/` exists parallel to `knowledge/learning/` | **CONFLICT / PARTIAL** |
| Dependency graph learning chain | Omits departmental / satellite stores | **INCOMPLETE** |
| `knowledge-learning` layer name “Learning” | Founder-scoped only | **PARTIAL** |
| Founder → learning → knowledge | Implemented | **MATCH** |
| `founder-critic` LEGACY | Still live memory | **MATCH label; live LEGACY** |
| Worker Runtime / Telemetry / Company Brain never write learning | No learning imports | **MATCH** |

Full: `DRIFT_MATRIX.md`.

---

## 7. Reconciliation matrix

Status ∈ { MATCH, PARTIAL, CONFLICT, LEGACY, PLACEHOLDER }.

| Subsystem | Status |
|-----------|--------|
| `core/knowledge` | **MATCH** |
| `core/knowledge-learning` | **PARTIAL** |
| Founder Review → learning | **MATCH** |
| resume-critic / critic-gate | **MATCH** |
| resume-learning + `saios/learning/` | **CONFLICT** (declaration) / **PARTIAL** (valuable satellite) |
| Competitive / Visual Render memory | **PARTIAL** |
| Learning append v2/v3 | **PLACEHOLDER** / temporary |
| founder-critic | **LEGACY** |
| runtime/knowledge | **LEGACY** |
| runtime/memory | **PLACEHOLDER** |
| Worker Runtime / Telemetry / Company Brain / Execution Controller | **MATCH** (clean non-writers) |

Full: `RECONCILIATION_MATRIX.md`.

---

## 8. Evaluation note

Evaluation is **not** the primary problem. The declared chain `resume-critic → critic-gate → founder-gate-runtime` is consistent. The only evaluation debt for learning topology is **LEGACY** `runtime/founder-critic` (duplicate evaluator + CriticMemory). Evaluation does not need a separate certification round before learning topology is named correctly.

---

## 9. CTO recommendation

**Adopt a distributed Learning Model with department satellites.**

| Option | Decision |
|--------|----------|
| One Learning Authority | **NO** — god-module risk |
| Distributed Learning Model | **YES** |
| Department satellites | **YES** (Resume design-memory, competitive, visual-render) |

Intended ownership (docs only — no moves):

- **Knowledge Authority** → `core/knowledge`  
- **Founder Learning Authority** → `core/knowledge-learning`  
- **Department Learning Satellites** → `saios/learning/`, competitive memory, visual-render memory  
- **Evaluation** stays separate (`resume-critic` → `critic-gate` → founder)  
- **LEGACY** → founder-critic  

**Next agent should not** crown a single Learning Authority. Prefer a future **Learning Distribution Model Certification & Boundary Enforcement** (docs + static scan), after accepting this topology — same pattern as Agent #194 for execution.

What must never absorb into “Learning Authority”: evaluation, founder approval, Knowledge Authority itself, telemetry, execution, Worker Runtime, Company Brain, or all department satellites into one mega-store.

Full: `CTO_RECOMMENDATION.md`.

---

## 10. Certification

**This agent does not certify.**

**Audit verdict: REQUIRES CONSOLIDATION**

Meaning: consolidate *architecture naming and topology documentation* to match runtime (distributed model + satellites). Do **not** merge modules, move persistence, or redesign learning in this agent.

### Safety

- LIVE OFF  
- No execution / dispatch / worker spawn  
- No learning movement / no code movement  
- Runtime Guard unchanged  
- All listed runtime learning files remain present  

### Verify

```bash
SOS_AIOS_LIVE=0 npm run learning-reconciliation:verify
```

### Project state

- `latest_agent` = 195  
- `next_agent` = 196  
- `operations.learning_reconciliation_audit` = complete

---

## Agent #200 freeze addendum (architecture declarations only)

**F1 resolved:** `saios/learning/` remains **operational departmental memory** with Resume as **write-owner** and **cross-cutting readers** (aligns Persistence Ownership #197 E4). Not Resume-only for consumption.

**F2 resolved:** `resume-learning` is **intentionally independent** of `core.knowledge-learning`. False `allowed_dependencies` entry removed from `module-roles.json`. Runtime imports unchanged.

**F3 resolved:** `parallel_learning_store_new` means no **new undeclared** parallel learning roots. Existing `saios/learning/` (+ worker appends) are **grandfathered**.

**Next-step supersession:** Learning Distribution Model Certification is **not** the next agent; path completed via #196–#200 final freeze.

Historical verdict **REQUIRES CONSOLIDATION** retained for this audit document.
