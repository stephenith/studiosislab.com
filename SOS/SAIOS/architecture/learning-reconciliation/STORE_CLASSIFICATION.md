# Store Classification

**Agent #195 · Evidence-based classification of every learning / knowledge / memory store**  
**STRICTLY READ-ONLY**

Status ∈ { CANONICAL, SATELLITE, LEGACY, PLACEHOLDER, DUPLICATE, TEMPORARY }

---

## 1. `SOS/07_LOGS/saios/knowledge/learning/`

| Field | Value |
|-------|-------|
| Owner | `core/knowledge-learning` (`LearningRepository`, `LearningWriteBack`) |
| Purpose | Founder-decision learning entries (`LearningEntry`) and provisional critic observations |
| Persistence | `learning-entries.jsonl`, `learning-index.json`, `learning-snapshot.json`, `learning-report.md` |
| Producers | `FounderDecisionManager` → `LearningWriteBack`; `ProvisionalCriticLearning` (blocked gate; `approved_by_founder=false`) |
| Consumers | `KnowledgeManager.mergeFounderLearningFromDisk` → Knowledge domain `learning` |
| Classification | **CANONICAL** — founder-learning store |

**Architectural intent of `core/knowledge-learning`:** **Founder Learning only** (not Knowledge Authority; not global operational memory). Evidence: `LearningWriteBack.writeFromDecision`, `LearningEntryBuilder` consumes only `FounderDecision`, categories are decision-derived (`approved_pattern`, `rejected_pattern`, `revision_instruction`, …).

---

## 2. `core/knowledge` (Knowledge Registry / Manager)

| Field | Value |
|-------|-------|
| Owner | `core/knowledge` (`KnowledgeRegistry`, `KnowledgeManager`, `KnowledgePolicies`) |
| Purpose | Six-domain Knowledge Authority (founder, company, project, department, learning, runtime) |
| Persistence | In-process seeded `SEED_ENTRIES` + upsert; learning domain filled from founder-learning snapshot |
| Producers | Seed corpus; `mergeFounderLearningFromDisk`; `writeEntry` with role checks |
| Consumers | Resume pre-skill knowledge load; KnowledgeRetriever |
| Classification | **CANONICAL** — Knowledge Authority |

---

## 3. `SOS/07_LOGS/saios/learning/`

| Field | Value |
|-------|-------|
| Owner | `runtime/workers/resume-learning` |
| Purpose | Resume design preferences, learned rules, quality history, confidence — operational overlays for Resume workers |
| Persistence | `design-memory.json`, `learned-rules.json`, `quality-history.json`, `confidence.json`, `feedback.json`, `learned-patterns.json`, `report.md`, plus worker appends |
| Producers | `runLearningEngine`, `saveDesignMemory`, learning reports; also resume-production `learning-append*.ts`, `founder-calibration.ts` |
| Consumers | design-brain, research, resume-production, design-system, adaptive-composer, missions, founder-dashboard, founder-critic (LEGACY read) — **cross-cutting readers** |
| Classification | **SATELLITE** — operational departmental memory (Resume **write-owner**; cross-cutting shared reads) |

### Specific determination

Is `SOS/07_LOGS/saios/learning/` …

| Option | Verdict |
|--------|---------|
| Operational departmental memory | **YES** — primary classification (write-owned by Resume Learning) |
| Cross-cutting shared store | **YES** — Agent #200 freeze: readers span design-brain/research/composer/production/dashboard (aligns #197 E4) |
| Duplicate learning authority | **NO** — different schema, different purpose from `LearningEntry`; does not claim Knowledge Authority |
| Temporary historical implementation | **PARTIAL** — durable and actively consumed; not a throwaway stub |
| Something else | **Grandfathered** parallel root under Persistence Ownership (#197); `parallel_learning_store_new` forbids **new undeclared** stores only (Agent #200 / F3) |

Evidence: worker constraints (“Learned rules are overlay layers for Resume Workers”, “Output only to `SOS/07_LOGS/saios/learning/`”); `design-memory.ts` header (“Persistent design memory — founder preferences accumulated over time”); no import of `core/knowledge-learning` (**intentional independence**, Agent #200 / F2).

**Agent #200 resolution (F1):** Canonical ownership declaration is Resume write-owner + cross-cutting readers — not “Resume-only” for consumption.

---

## 4. Competitive Memory

| Field | Value |
|-------|-------|
| Owner | `runtime/competitive-validation` |
| Path | `07_LOGS/saios/competitive-validation/memory/competitive-learning.json` |
| Purpose | Competitive score / strength / weakness learning |
| Classification | **SATELLITE** (department / evaluation-worker satellite) |

---

## 5. Visual Render Memory

| Field | Value |
|-------|-------|
| Owner | `runtime/visual-render` |
| Path | `07_LOGS/saios/visual-render/memory/render-learning.json` |
| Purpose | Visual principles / render score learning |
| Classification | **SATELLITE** |

---

## 6. Learning Append (worker-v2 / worker-v3)

| Field | Value |
|-------|-------|
| Owner | `runtime/workers/resume-production` |
| Path | `saios/learning/worker-v2-append.json`, `worker-v3-append.json` |
| Purpose | Append successful design decisions / prototype notes into departmental learning root |
| Classification | **TEMPORARY / worker-side satellite** writing into the Resume departmental root (not a separate authority) |

---

## 7. Founder Critic Memory

| Field | Value |
|-------|-------|
| Owner | `runtime/founder-critic` |
| Path | `07_LOGS/saios/founder-critic/memory/critic-learning.json` |
| Purpose | Critic-run scores / policy bands |
| Classification | **LEGACY** — module-roles role `LEGACY`, layer “Evaluation (duplicate)” |

---

## 8. Provisional Critic Learning

| Field | Value |
|-------|-------|
| Owner | `core/critic-gate/ProvisionalCriticLearning` |
| Path | founder-learning root (`knowledge/learning/`) |
| Purpose | Non-founder-approved quality observations from blocked critic gates |
| Classification | **SATELLITE** of founder-learning path (confidence `observed`, `approved_by_founder=false`) |

---

## 9. `runtime/memory`

| Field | Value |
|-------|-------|
| Owner | type-only exports (`SessionMemory`, `ProjectMemory`, `LongTermMemory`) |
| Persistence | None implemented |
| Classification | **PLACEHOLDER** |

---

## 10. `runtime/knowledge`

| Field | Value |
|-------|-------|
| Owner | type-only `KnowledgeService` / `KnowledgeRef` |
| Persistence | None |
| Classification | **LEGACY** shim (module-roles: Knowledge duplicate) — no store |

---

## Resume Learning → Knowledge Learning?

| Option | Architectural intent (from repo) |
|--------|----------------------------------|
| Feed Knowledge Learning | Declared in `module-roles` allowed_deps; **not implemented** |
| Remain independent | **Runtime reality** today |
| Remain departmental | **Intent of resume-learning constraints** — overlays for Resume Workers only |

**Determination (intent, not implementation):** Resume Learning should **remain a departmental satellite**. It may eventually *emit* founder-approved signals into `knowledge-learning`, but it must not become a second learning authority and must not replace founder-learning.

**Agent #200 resolution (F2):** Runtime does **not** consume `core.knowledge-learning`. Architecture declaration corrected: `allowed_dependencies: []` — **intentionally independent** (declaration was wrong; runtime unchanged).
