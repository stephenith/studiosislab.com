# Persistence Taxonomy

**Agent #197 · Persistence Ownership & Taxonomy Declaration V1**  
**DOCUMENTATION-ONLY · No runtime behaviour · LIVE OFF**

Authoritative source inventory: Agent #196 (`persistence-memory-topology`).

This document **declares** the official AIOS persistence taxonomy. Categories below are mutually exclusive for primary classification of each surface (lifecycle/status flags are separate — see DECLARATION.md).

---

## 1. Knowledge

| Aspect | Declaration |
|--------|-------------|
| **Purpose** | Six-domain authoritative facts and policies for the company |
| **Ownership** | Knowledge Authority = `core/knowledge` only |
| **Write authority** | `KnowledgeManager` / registry upsert + founder-learning merge only |
| **Read authority** | Retrievers, company-brain system state readers, dashboard (read-only) |
| **Validation authority** | `KnowledgeValidator` / `core/knowledge/verify` |
| **Relationships** | Consumes **Founder Learning** via merge; must not be written by Department Learning, Operational Memory, Execution Memory, Telemetry, or Artifacts |

---

## 2. Founder Learning

| Aspect | Declaration |
|--------|-------------|
| **Purpose** | Decision-derived learning entries from founder approvals/revisions/rejections |
| **Ownership** | Founder Learning Authority = `core/knowledge-learning` only |
| **Write authority** | `LearningWriteBack` from `FounderDecision`; provisional critic writes flagged `approved_by_founder=false` |
| **Read authority** | `KnowledgeManager.mergeFounderLearningFromDisk`; founder-gate cycle readers |
| **Validation authority** | `LearningValidator` |
| **Relationships** | Feeds **Knowledge**; distinct from **Department Learning**; not Execution Memory |

---

## 3. Department Learning

| Aspect | Declaration |
|--------|-------------|
| **Purpose** | Department-scoped preference, rule, score, and fingerprint stores that improve local work |
| **Ownership** | Department Learning Authorities = owning runtime modules (resume-learning, design-brain, adaptive-composer, benchmark, publication, competitive-validation, visual-render) |
| **Write authority** | Owning module writers only |
| **Read authority** | Owning module + explicitly documented consumers (see exceptions for cross-cutting design-memory) |
| **Validation authority** | Module `verify` suites |
| **Relationships** | Does **not** write Knowledge or Founder Learning today; parallel to Operational Memory when labeled `*-learning.json` but classified here when purpose is preference/rule learning |

---

## 4. Operational Memory

| Aspect | Declaration |
|--------|-------------|
| **Purpose** | Working memory of a subsystem (sessions, job outcomes, composition caches, cost accounting memory) |
| **Ownership** | Operational Memory Owners = owning modules (research, scheduler learning file, design-brain sessions, composer compositions, cost-ledger) |
| **Write authority** | Owning module |
| **Read authority** | Owning module / reporters |
| **Validation authority** | Module verify |
| **Relationships** | Not Knowledge; not Founder Learning; may be mislabeled “learning” (declared exception for Scheduler) |

---

## 5. Execution Memory

| Aspect | Declaration |
|--------|-------------|
| **Purpose** | Control-plane gate, plan, authorization, queue, worker-runtime, and company-brain package snapshots |
| **Ownership** | Execution Authorities = respective Phase-2/3 modules (execution-controller, authorization, activation-gate, pre-dispatch-simulation, worker-runtime, planner, system-readiness, runtime-release, queue, company-brain) |
| **Write authority** | Module repositories (typically BaseAppendOnly) |
| **Read authority** | Dashboard plugins, planning consumers |
| **Validation authority** | Module `verify-*` |
| **Relationships** | Separate from Learning/Knowledge; may produce **Snapshots**; must not absorb Knowledge Authority |

---

## 6. Telemetry

| Aspect | Declaration |
|--------|-------------|
| **Purpose** | Observability registry and telemetry sessions |
| **Ownership** | Telemetry Authority = `platform/telemetry` |
| **Write authority** | TelemetryRepository |
| **Read authority** | Dashboard telemetry plugins |
| **Validation authority** | `verify-telemetry` |
| **Relationships** | Not Learning; not Cost accounting; not Execution Memory |

---

## 7. History

| Aspect | Declaration |
|--------|-------------|
| **Purpose** | Append-oriented audit of decisions, evaluation gates, and events |
| **Ownership** | History Owners = `core/founder-decisions`, `core/critic-gate`, `runtime/event-bus` |
| **Write authority** | Respective repositories/stores |
| **Read authority** | Gates, dashboards, audit readers |
| **Validation authority** | Module verify |
| **Relationships** | Founder decisions **trigger** Founder Learning but History ≠ Learning store |

---

## 8. State

| Aspect | Declaration |
|--------|-------------|
| **Purpose** | Mutable current condition (waiting cycles, scheduler-state, heartbeats, factory-state, department registry live state) |
| **Ownership** | State Owners = founder-gate-runtime, scheduler (state files), runtime-loop/manager/supervisor, factory-state, department-sdk registry |
| **Write authority** | Owning module |
| **Read authority** | Controllers, dashboards |
| **Validation authority** | Module verify |
| **Relationships** | Distinct from History (point-in-time vs append audit); distinct from Configuration |

---

## 9. Configuration

| Aspect | Declaration |
|--------|-------------|
| **Purpose** | Tunables and flags that shape behaviour without being learning or knowledge |
| **Ownership** | Configuration surfaces under owning modules (e.g. scheduler-config) |
| **Write authority** | Owning module / operator tooling |
| **Read authority** | Owning runtime |
| **Validation authority** | Module verify |
| **Relationships** | Not Learning; not Knowledge; may sit beside State for the same module |

---

## 10. Artifacts

| Aspect | Declaration |
|--------|-------------|
| **Purpose** | Product outputs (generated resumes, QA bundles, publication packages) |
| **Ownership** | Artifacts Owners = resume-production, resume-qa, publication |
| **Write authority** | Production/QA/publication pipelines |
| **Read authority** | Review, publication, dashboards |
| **Validation authority** | QA / publication verify |
| **Relationships** | Not Knowledge; may inform Department Learning writers but is not itself Learning |

---

## 11. Reports

| Aspect | Declaration |
|--------|-------------|
| **Purpose** | Regenerated human-readable summaries and mission review documents |
| **Ownership** | Reports Owners = reporter modules / missions / dashboards |
| **Write authority** | Reporters |
| **Read authority** | Founder / operators |
| **Validation authority** | Mission/verify scripts |
| **Relationships** | Derived views over other categories; not authoritative Knowledge |

---

## 12. Snapshots

| Aspect | Declaration |
|--------|-------------|
| **Purpose** | Point-in-time `latest-*.json` / learning-snapshot copies for dashboards and recovery |
| **Ownership** | Snapshots Owners = producing repository (usually same as Execution Memory or Founder Learning snapshot builder) |
| **Write authority** | Producing repository |
| **Read authority** | Dashboard plugins |
| **Validation authority** | Producing verify |
| **Relationships** | Projection of Execution Memory / Founder Learning / State — not a separate authority |

---

## Category relationship matrix (summary)

```
Knowledge ←── Founder Learning ←── Founder Decisions (History)
                ↑
                (no edge from Department Learning today)

Department Learning ──∥── Operational Memory   (parallel; naming overlap declared as exception)
Execution Memory ──► Snapshots
Telemetry ∥ Cost (Operational Memory under Cost Authority)
Artifacts / Reports ── derived; not authorities
State ∥ Configuration
```
