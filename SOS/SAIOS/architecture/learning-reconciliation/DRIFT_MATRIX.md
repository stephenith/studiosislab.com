# Drift Matrix — Declared Architecture vs Runtime Reality

**Agent #195 · STRICTLY READ-ONLY**

| Declared claim | Source | Runtime reality | Drift |
|----------------|--------|-----------------|-------|
| Learning flows `founder-decisions → knowledge-learning → knowledge` | `dependency-graph.json` | True for founder-decision path (`FounderDecisionManager` → `LearningWriteBack` → `mergeFounderLearningFromDisk`) | **MATCH** for that path only |
| `resume-learning` depends on `core.knowledge-learning` | ~~`module-roles.json` allowed_dependencies~~ **removed Agent #200** | `learning-engine.ts` imports only local modules | **RESOLVED (F2)** — intentionally independent |
| `resume-learning` must not create `parallel_learning_store_new` | `module-roles.json` forbidden | Writes to `saios/learning/` parallel to `knowledge/learning/` | **RESOLVED (F3)** — existing root **grandfathered**; forbid = no **new undeclared** stores |
| `core.knowledge-learning` layer = “Learning” | `module-roles.json` | Implements founder-decision learning only | **PARTIAL** (name implies global learning; code is founder-scoped) |
| `core.knowledge` = Knowledge layer | `module-roles.json` + `KnowledgePolicies` | Six-domain Knowledge Authority including domain `learning` | **MATCH** |
| `runtime.knowledge` = LEGACY Knowledge duplicate | `module-roles.json` | Type-only exports; no store | **MATCH** (harmless legacy) |
| `runtime.memory` forbid `parallel_knowledge_authority` | `module-roles.json` | Types only; no store | **MATCH** |
| `runtime.founder-critic` = LEGACY Evaluation duplicate | `module-roles.json` | Still writes `critic-learning.json` and critiques | **MATCH label; live LEGACY store** |
| Dependency graph lists knowledge-learning producers/consumers | `dependency-graph.json` | Omits resume-learning, competitive, visual-render, critic memory, worker appends | **INCOMPLETE** (manifest gap) |
| Knowledge domain `learning` write_by = `learning_pipeline`, `executive_brain` | `KnowledgePolicies.ts` | Founder path uses `learning_pipeline` owner on merge; resume design-memory bypasses Knowledge policies entirely | **PARTIAL** |
| Critic → Gate → Founder → Learning | dependency-graph + first-production-cycle | Canonical evaluation chain intact; parallel design-memory learning bypasses this chain | **PARTIAL** |

---

## Naming drift summary

| Name | Sounds like | Actually is |
|------|--------------|-------------|
| Knowledge Learning (`core/knowledge-learning`) | Global learning authority | Founder-decision learning write-back |
| Resume Learning (`workers/resume-learning`) | Consumer of knowledge-learning | Independent departmental design-memory engine |
| Learning Authority (future Phase 4 language) | Single owner | Does not exist; learning is fragmented |
| Knowledge Authority | Knowledge store | Exists as `core/knowledge` |
