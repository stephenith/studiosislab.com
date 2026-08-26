# Architectural Taxonomy

**Agent #196 · Persistence & Memory Topology Reconciliation V1**

Differentiates concepts that the repository currently **mixes** under names like `learning`, `memory`, and `KnowledgeConsumer`.

---

## Definitions (as evidenced by existing modules)

| Concept | Meaning in AIOS | Canonical home if present |
|---------|-----------------|---------------------------|
| **Knowledge** | Six-domain authoritative entries with ownership policies | `core/knowledge` → `knowledge-system/` |
| **Learning** | Decision-derived or preference/rule updates intended to improve future work | Founder: `knowledge/learning/`; Department: `*-learning.json` / design-memory |
| **Operational Memory** | Working memory of a subsystem (sessions, fingerprints, job outcomes) not promoted to Knowledge | research sessions, compositions, scheduler-learning (misnamed), design-brain sessions |
| **Execution Memory** | Gate/plan/authorization/queue/runtime snapshots for control plane | BaseAppendOnly Phase-2/3 repos |
| **Telemetry** | Observability registry / metrics sessions | `platform/telemetry` |
| **History** | Append-oriented event/decision logs for audit | founder-decisions, critic-gate, event-bus history |
| **State** | Mutable current condition (heartbeats, waiting cycles, scheduler-state) | founder-gate-runtime, scheduler-state, runtime-loop |
| **Configuration** | Tunables / flags | scheduler-config, department registry config |
| **Artifacts** | Product outputs (resumes, packages, QA bundles) | generated-resumes, publication/packages, qa |
| **Reports** | Human-readable regenerated summaries | `*.md` reporters under 07_LOGS |
| **Snapshots** | Point-in-time JSON “latest-*.json” copies | BaseAppendOnly `latest-*`, learning-snapshot |

---

## Where each inventory surface belongs

| # | Surface | Taxonomy bucket |
|---|---------|-----------------|
| 1 | knowledge-system | Knowledge |
| 2 | knowledge/learning | Learning (Founder) |
| 3 | design-memory hub | Learning (Department) + shared Operational Memory of preferences |
| 4–5 | worker appends | Learning (Temporary) |
| 6–11 | department `*-learning.json` | Learning (Department) / Operational Memory mix — labeled Learning |
| 12 | critic-learning | Learning (Legacy) |
| 13 | scheduler-learning | Operational Memory (**mislabeled Learning**) |
| 14 | research sessions | Operational Memory |
| 15–16 | MemoryService / runtime.knowledge | Orphan / Duplicate |
| 17–18 | design-brain sessions / compositions | Operational Memory + Artifacts |
| 19–30 | execution/company-brain | Execution Memory (+ Snapshots) |
| 31 | telemetry | Telemetry |
| 32 | cost ledger | Operational Memory (Cost) |
| 33 | department registry | State + Configuration |
| 34–35 | founder-decisions / critic-gate | History |
| 36 | founder-gate-runtime | State |
| 37 | event-bus | History |
| 38 | runs/controller | Execution Memory + Artifacts |
| 39 | scheduler state/config | State + Configuration |
| 40 | generated resumes / packages | Artifacts |
| 41 | dashboards / mission reports | Reports + Snapshots |
| 42 | runtime-loop / manager / factory-state | State |

---

## Mixing diagnosis

The repository **does not** cleanly separate Learning vs Operational Memory vs Experience:

- Files named `*-learning.json` hold preferences, fingerprints, durations, and competitive scores.  
- Modules named `KnowledgeConsumer` read **department learning**, not Knowledge.  
- `SchedulerMemory` comments say “production learning” inside a SERVICE.  
- Empty `MemoryService` tiers imply a intended separation (Session/Project/LongTerm) that was never adopted.

Knowledge vs Execution Memory vs Telemetry vs History remain **relatively clean** because Phase-2/3 certifications enforced BaseAppendOnly boundaries there.
