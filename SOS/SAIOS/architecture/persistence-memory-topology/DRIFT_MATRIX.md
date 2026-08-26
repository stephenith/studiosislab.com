# Drift Matrix

**Agent #196 · Persistence & Memory Topology Reconciliation V1**

Compares **runtime reality** against declared architecture and prior certifications.

Status: **MATCH** | **PARTIAL** | **CONFLICT** | **GAP** | **LEGACY**

---

## vs module-roles.json

| Claim / entry | Runtime | Status |
|---------------|---------|--------|
| `runtime.workers.resume-learning` allowed `core.knowledge-learning` | No import of knowledge-learning in resume-learning engine | **CONFLICT** |
| `resume-learning` forbidden `parallel_learning_store_new` | `saios/learning/` parallel root + worker-v2/v3 appends exist | **CONFLICT** |
| `runtime.scheduler` role SERVICE, no learning responsibility | Writes `scheduler-learning.json` | **CONFLICT** |
| `runtime.founder-critic` role LEGACY | Still invoked by `unified-production/StageRunner` + missions; writes critic-learning | **PARTIAL** (label aspirational) |
| `runtime.memory` SERVICE + forbid parallel knowledge authority | Types only; empty log dirs; unused | **GAP** (orphaned) |
| `runtime.knowledge` LEGACY | Types only | **LEGACY** MATCH |
| design-brain / adaptive-composer / benchmark / publication / research / competitive / visual-render | Modules declared; **stores undeclared** as learning/memory responsibilities | **GAP** |
| `runtime.unified-production` LEGACY + forbidden primary entry | Still calls `runFounderCritic` (Runtime Guard may block primary entry; mission path remains) | **PARTIAL** |

---

## vs dependency-graph.json

| Declared | Runtime | Status |
|----------|---------|--------|
| `founder-decisions → knowledge-learning → knowledge` | Matches LearningWriteBack + mergeFounderLearningFromDisk | **MATCH** |
| Evaluation `resume-critic → critic-gate → founder-gate` | Matches critic-gate chain | **MATCH** |
| No nodes for department `*-learning.json` stores | ≥8 runtime learning/memory stores | **GAP** |
| No edge for design-memory fan-out | Cross-module reads of resume design-memory | **GAP** |
| Execution / platform Phase-3 nodes present | Match BaseAppendOnly surfaces | **PARTIAL** (good coverage for gates; incomplete for every company-brain subpath) |
| Scheduler not modeled as learning producer | Writes learning | **CONFLICT** |

---

## vs architecture manifests / Phase certifications

| Certification | Drift |
|---------------|-------|
| Provider Authority (#192) | No conflict with persistence taxonomy — providers do not own learning stores. **MATCH** on isolation. |
| Cost Authority (#193) | Cost ledger uses BaseAppendOnly pattern; estimation≠accounting holds. Learning stores do not write cost ledger. **MATCH**. |
| Execution Authority Model (#194) | Execution Memory surfaces are consistent with distributed stage owners. Scheduler-as-infrastructure assumption **conflicts** with scheduler-learning writer. **CONFLICT** (infra purity). |
| Learning Reconciliation (#195) | Inventory incomplete (missed composer, design-brain preferences, scheduler, benchmark, publication, research). Misclassified `saios/learning` as Resume-only departmental. Founder Critic “LEGACY inert” overstated. **CONFLICT / GAP** vs #196 census. |
| Phase 3 Planning (#188) / Phase 4 charter (#189) | Planning/sim stores use BaseAppendOnly; learning layer outside scope — **GAP** (not wrong, incomplete). |

---

## Specific inconsistency list

1. **Scheduler writing learning** while declared SERVICE infrastructure.  
2. **Infrastructure modules owning memory** — Scheduler; empty MemoryService owned by SERVICE with no impl.  
3. **Multiple DesignMemory implementations** — resume-learning vs design-brain filenames.  
4. **Duplicate learning stores** capturing overlapping founder preference signals.  
5. **Founder Critic still participating** — StageRunner + missions.  
6. **Worker append stores** contradicting `parallel_learning_store_new` forbid.  
7. **Department memories bypass founder learning** — no write path into knowledge-learning.  
8. **Runtime modules do NOT write directly into Knowledge Authority** — boundary **MATCH** (positive).  
9. **Hidden persistence outside BaseAppendOnly** — entire learning/memory cohort uses raw `writeFileSync`.  
10. **Orphaned abstractions** — MemoryService + empty `saios/memory/*`.  
11. **KnowledgeConsumer misnomer** — reads design-memory, not knowledge.  
12. **#195 topology_consistency verify asserts completeness over incomplete map** — process drift.

---

## Drift summary table

| Area | Worst status |
|------|--------------|
| Learning store declaration | GAP |
| resume-learning ↔ knowledge-learning dependency | CONFLICT |
| Scheduler role vs learning write | CONFLICT |
| Founder Critic LEGACY vs active writes | PARTIAL |
| Knowledge Authority write boundary | MATCH |
| Founder learning promotion chain | MATCH |
| BaseAppendOnly adoption (execution) | MATCH |
| BaseAppendOnly adoption (learning) | GAP |
| MemoryService adoption | GAP |
| Agent #195 completeness | CONFLICT |
