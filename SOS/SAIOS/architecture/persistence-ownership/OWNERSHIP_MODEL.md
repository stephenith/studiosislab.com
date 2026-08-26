# Ownership Model

**Agent #197 · Persistence Ownership & Taxonomy Declaration V1**  
**DOCUMENTATION-ONLY · No ownership overlaps · No duplicated authority · LIVE OFF**

Source: Agent #196 inventory (42 surfaces).

---

## Authority roster (exclusive)

| Authority | Sole owner module(s) | Surfaces |
|-----------|----------------------|----------|
| **Knowledge Authority** | `core/knowledge` | #1 knowledge-system |
| **Founder Learning Authority** | `core/knowledge-learning` | #2 knowledge/learning |
| **Department Learning Authorities** | One owner per store (below) | #3, #6–11 |
| **Execution Authorities** | Phase-2/3 execution + company-brain modules | #19–30, #38 |
| **Telemetry Authority** | `platform/telemetry` | #31 |
| **Cost Authority** | `platform/cost-ledger` (accounting); BudgetPolicy remains estimation policy elsewhere | #32 |
| **Persistence Authorities** | This declaration package + owning repos for format discipline | Documentation authority only — does **not** supersede domain authorities |
| **Operational Memory Owners** | research, scheduler (learning file), design-brain sessions, adaptive-composer compositions | #13–14, #17–18 |
| **History Owners** | founder-decisions, critic-gate, event-bus | #34–35, #37 |
| **State Owners** | founder-gate-runtime, scheduler state, runtime-loop/manager/supervisor/factory-state, department-sdk | #33, #36, #39, #42 |
| **Reports Owners** | dashboards, mission reporters | #41 |
| **Artifacts Owners** | resume-production, resume-qa, publication | #40 |
| **Snapshots Owners** | Producing repository of the source surface | Embedded in #2 snapshot, #19–30 latest-* |

---

## Department Learning Authorities (no overlap)

| Surface | Sole Department Learning Authority |
|---------|-----------------------------------|
| #3 design-memory hub (+ sibling learning files) | `runtime/workers/resume-learning` |
| #6 founder-preferences | `runtime/design-brain` |
| #7 composer-learning | `runtime/adaptive-composer` |
| #8 benchmark-learning | `runtime/benchmark` |
| #9 publication-learning | `runtime/publication` |
| #10 competitive-learning | `runtime/competitive-validation` |
| #11 render-learning | `runtime/visual-render` |

**Declared exception (not a second owner):** other modules may **read** #3; they do not gain write authority. See EXCEPTIONS.md.

---

## Execution Authorities (no overlap)

| Surface | Sole Execution Authority |
|---------|--------------------------|
| #19 execution-controller | `runtime/execution-controller` |
| #20 execution-authorization | `runtime/execution-authorization` |
| #21 activation-gate | `runtime/activation-gate` |
| #22 pre-dispatch-simulation | `runtime/pre-dispatch-simulation` |
| #23 worker-runtime | `runtime/worker-runtime` |
| #24 runtime-plan | `runtime/planner` |
| #25 system-readiness | `runtime/system-readiness` |
| #26 runtime-release | `runtime/runtime-release` |
| #27 shadow-queue | `runtime/queue` |
| #28–30 company-brain packages | `core/company-brain` |
| #38 runs/controller/unified | respective pipeline/controller modules (legacy unified engine remains LEGACY) |

---

## Non-authority classifications (owned, not crowned)

| Class | Owner | Note |
|-------|-------|------|
| Temporary worker appends #4–5 | `runtime/workers/resume-production` | Temporary persistence — not a Learning Authority |
| Legacy critic-learning #12 | `runtime/founder-critic` | Legacy — not an Evaluation or Learning Authority |
| Orphan MemoryService dirs #15 | declared path `runtime/memory` | Orphaned abstraction — **no** Memory Authority |
| runtime/knowledge #16 | `runtime/knowledge` | Duplicate shim — **no** Knowledge Authority |

---

## Explicit non-duplication rules

1. **Only** `core/knowledge` is Knowledge Authority.  
2. **Only** `core/knowledge-learning` is Founder Learning Authority.  
3. Department Learning Authorities do **not** become Knowledge Authority by reading or writing local stores.  
4. Telemetry Authority does **not** own Cost or Learning.  
5. Cost Authority does **not** own Telemetry or Knowledge.  
6. Execution Authorities do **not** own Learning or Knowledge.  
7. Persistence Ownership Declaration (this package) is **documentation**; it does not execute writes.

---

## Persistence Authorities (documentation sense)

“Persistence Authorities” in this declaration means: the **canonical documentation** of who may own which persistence category. Enforcement is **out of scope** for Agent #197.
