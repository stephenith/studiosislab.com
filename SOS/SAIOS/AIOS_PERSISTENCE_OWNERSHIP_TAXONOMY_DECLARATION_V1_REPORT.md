# AIOS Persistence Ownership & Taxonomy Declaration V1

**Agent #197** · Chief Software Architect  
**Mode:** DOCUMENTATION-ONLY architectural declaration  
**Not a certification · Not enforcement · Not an implementation**  
**Runtime:** UNCHANGED · **Persistence:** UNCHANGED · **Migrations:** NONE · **LIVE:** OFF  
**Date:** 2026-07-12  
**Source inventory:** Agent #196 Persistence & Memory Topology Reconciliation V1

Supporting package: `SOS/SAIOS/architecture/persistence-ownership/`

---

## 1. Official taxonomy

AIOS persistence is declared under exactly these categories:

1. **Knowledge** — six-domain authoritative store (`core/knowledge`)  
2. **Founder Learning** — decision-derived learning (`core/knowledge-learning`)  
3. **Department Learning** — department-scoped preference/rule/score stores  
4. **Operational Memory** — sessions, job outcomes, composition caches, cost accounting memory  
5. **Execution Memory** — control-plane gates, plans, queues, packages  
6. **Telemetry** — observability registry (`platform/telemetry`)  
7. **History** — founder decisions, critic-gate, event-bus audit  
8. **State** — waiting cycles, scheduler-state, heartbeats, department registry  
9. **Configuration** — tunables (e.g. scheduler-config)  
10. **Artifacts** — generated resumes, QA, publication packages  
11. **Reports** — regenerated dashboards and mission documents  
12. **Snapshots** — `latest-*` / learning-snapshot projections  

Full purpose / write / read / validation / relationships: `PERSISTENCE_TAXONOMY.md`.

---

## 2. Official ownership model

| Authority | Sole owner |
|-----------|------------|
| Knowledge Authority | `core/knowledge` |
| Founder Learning Authority | `core/knowledge-learning` |
| Department Learning Authorities | One module per store (resume-learning, design-brain, adaptive-composer, benchmark, publication, competitive-validation, visual-render) |
| Execution Authorities | Phase-2/3 execution + company-brain modules (per surface) |
| Telemetry Authority | `platform/telemetry` |
| Cost Authority (accounting) | `platform/cost-ledger` |
| Operational Memory Owners | research, scheduler (learning file), design-brain sessions, composer compositions |
| History Owners | founder-decisions, critic-gate, event-bus |
| State Owners | founder-gate-runtime, scheduler state, runtime-loop/manager/supervisor/factory-state, department-sdk |
| Reports / Artifacts / Snapshots Owners | respective producers |

**No ownership overlaps. No duplicated authority.**  
Persistence Authorities (this package) are **documentation only**.

Detail: `OWNERSHIP_MODEL.md`.

---

## 3. Complete declaration table

All **42** surfaces from Agent #196 are registered in `DECLARATION.md` and `SURFACES.json` with:

canonical owner · architectural category · persistence classification · lifecycle · layer · current implementation · intended abstraction · adoption status · architectural status.

Machine registry: `SURFACES.json` (`surface_count: 42`).

---

## 4. Adoption status summary

| Adoption status | Count |
|-----------------|------:|
| Native BaseAppendOnlyRepository | 15 |
| Native MemoryService | 0 |
| Legacy persistence | 12 |
| Intentional standalone persistence | 6 |
| Temporary persistence | 2 |
| Future adoption candidate | 3 |
| Orphaned abstraction | 2 |
| **Total** | **42** |

“Future adoption candidate” and “intended abstraction” name architectural fit only. **This agent performs no adoption.**

---

## 5. Architectural exceptions

| ID | Exception |
|----|-----------|
| E1 | MemoryService exists but has zero implementations |
| E2 | Learning repositories bypass BaseAppendOnlyRepository |
| E3 | Scheduler owns Operational Memory despite SERVICE role |
| E4 | design-memory.json is cross-cutting (single write owner; many readers) |
| E5 | Founder Critic remains legacy |
| E6 | Worker append stores remain temporary |
| E7 | Department Learning does not feed Founder Learning |
| E8 | KnowledgeConsumer misnomer |
| E9 | Two DesignMemory filenames |
| E10 | Agent #196 supersedes #195 for inventory completeness |

Detail: `EXCEPTIONS.md`.

---

## 6. Verification summary

```bash
SOS_AIOS_LIVE=0 npm run persistence-ownership:verify
```

Required verifications (all must PASS):

- Persistence Ownership Verification  
- Taxonomy Verification  
- Authority Verification  
- Architecture Declaration Verification  
- Classification Verification  
- Declaration Consistency Verification  

Runtime modules, `module-roles.json`, `dependency-graph.json`, and Runtime Guard remain present and unmodified by this agent.

---

## 7. CTO declaration

This is an architectural declaration only.

It introduces no runtime behaviour.

No persistence migrations.

No repository migrations.

No MemoryService adoption.

No BaseAppendOnlyRepository adoption.

No execution.

No providers.

No LIVE.

Backward compatibility must remain 100%.

**Verdict: DECLARED.**

Registered into architecture documentation at `SOS/SAIOS/architecture/persistence-ownership/` (documentation manifests only — execution-affecting manifests untouched).
