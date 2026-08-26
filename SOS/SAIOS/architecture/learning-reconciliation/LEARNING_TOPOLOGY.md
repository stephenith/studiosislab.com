# Learning & Knowledge Reconciliation — Topology

**Agent #195 · STRICTLY READ-ONLY audit**  
**LIVE:** OFF · **No runtime changes · No learning movement**

---

## Persistence roots (evidence)

| Root | Module owner | Schema | Classification |
|------|--------------|--------|----------------|
| `SOS/07_LOGS/saios/knowledge/learning/` | `core/knowledge-learning` | `LearningEntry` JSONL + snapshot | **Canonical founder-learning store** |
| `SOS/07_LOGS/saios/knowledge-system/` | `core/knowledge` (verify/dashboard logs) | domain ownership dumps | **Knowledge system logs** |
| `SOS/07_LOGS/saios/learning/` | `runtime/workers/resume-learning` | design-memory, rules, quality, confidence, worker appends | **Operational departmental memory (Resume write-owner; cross-cutting readers — Agent #200 / F1)** |
| `SOS/07_LOGS/saios/competitive-validation/memory/` | `runtime/competitive-validation` | competitive-learning.json | **Department satellite** |
| `SOS/07_LOGS/saios/visual-render/memory/` | `runtime/visual-render` | render-learning.json | **Department satellite** |
| `SOS/07_LOGS/saios/founder-critic/memory/` | `runtime/founder-critic` | critic-learning.json | **LEGACY duplicate** |
| *(in-memory)* `KnowledgeRegistry` seed | `core/knowledge` | `KnowledgeEntry[]` | **Canonical knowledge authority (in-process)** |
| *(types only)* `runtime/memory`, `runtime/knowledge` | type exports | Session/Project/LongTerm contracts | **PLACEHOLDER / LEGACY shim** |

---

## Topology diagram

```
PRODUCERS                              STORES / ROOTS                         CONSUMERS
─────────                              ──────────────                         ─────────

FounderDecision ──writeFromDecision──► knowledge/learning/                    core/knowledge
(FounderDecisionManager)               LearningEntry jsonl                    (mergeFounderLearningFromDisk)
                                       learning-snapshot.json                 KnowledgeManager
CriticGate (blocked) ──provisional──►  (same root; approved_by_founder=false)  KnowledgeRetriever
(ProvisionalCriticLearning)

Founder feedback / structured ───────► saios/learning/                        design-brain
(resume-learning engine)               design-memory.json                     research (Color/Typography)
                                       learned-rules.json                     resume-production
                                       quality-history.json                   design-system bridge
                                       confidence.json                        adaptive-composer
                                       feedback.json / report.md              missions (FR#001–004)
                                                                              founder-dashboard (read)
                                                                              founder-critic KnowledgeConsumer (LEGACY)

resume-production learning-append ───► saios/learning/                        founder-critic ComparisonEngine
                                       worker-v2-append.json                  duplicate-detector-v3
                                       worker-v3-append.json

CompetitiveValidationDirector ───────► competitive-validation/memory/         CompetitiveReporter
                                       competitive-learning.json

VisualRenderDirector ────────────────► visual-render/memory/                  adaptive-composer
                                       render-learning.json

FounderCriticDirector (LEGACY) ──────► founder-critic/memory/                 FounderCriticDirector
                                       critic-learning.json

KnowledgeRegistry (seed + upsert) ───► in-process KnowledgeEntry[]            KnowledgeManager / Retriever
                                                                              resume pre-skill load
```

---

## Declared dependency graph (architecture)

From `dependency-graph.json`:

```
founder-decisions ──feeds──► knowledge-learning ──feeds──► knowledge
founder-gate-runtime ──feeds──► knowledge-learning
resume-critic ──feeds──► critic-gate ──feeds──► founder-gate-runtime
```

**Declared dependency (Agent #200):** `module-roles.json` sets `resume-learning` `allowed_dependencies: []` — **intentionally independent** of `core.knowledge-learning` (matches runtime; F2 resolved).  

**Historical note:** Prior declaration listed `resume-learning → core.knowledge-learning` without a runtime import; that was incorrect declaration, not missing implementation.  
**Runtime:** `learning-engine.ts` imports only local resume-learning modules — **no edge to knowledge-learning**.

---

## Write surfaces

| Writer | Function / API | Target |
|--------|----------------|--------|
| `LearningWriteBack.writeFromDecision` | append LearningEntry | `knowledge/learning/` |
| `LearningRepository.append` | JSONL append | `learning-entries.jsonl` |
| `persistLearningSnapshot` | snapshot + report | `learning-snapshot.json` |
| `writeProvisionalCriticLearning` | provisional entry | same founder-learning root |
| `runLearningEngine` / `saveDesignMemory` | design memory | `saios/learning/design-memory.json` |
| `saveQualityHistory` / reports | quality + reports | `saios/learning/*` |
| `appendLearningRecord` (v2) | worker append | `worker-v2-append.json` |
| `learning-append-v3` | worker append | `worker-v3-append.json` |
| `appendCompetitiveMemory` | competitive | competitive memory path |
| `appendRenderMemory` | render | render memory path |
| `appendCriticMemory` / `recordCriticRun` | critic | founder-critic memory |
| `KnowledgeManager.writeEntry` / `upsert` | knowledge | in-process registry |

---

## Read surfaces

| Reader | Source |
|--------|--------|
| `KnowledgeManager.mergeFounderLearningFromDisk` | `knowledge/learning/learning-snapshot.json` |
| `loadDesignMemory` consumers (many Resume workers) | `saios/learning/design-memory.json` |
| `loadCompetitiveMemory` | competitive memory |
| `loadRenderMemory` | render memory |
| `loadCriticMemory` | founder-critic memory |
| Dashboard / founder-dashboard aggregators | knowledge-system + learning paths (read) |
| Company Brain `SystemStateReader` | knowledge-system domains (read-only) |
