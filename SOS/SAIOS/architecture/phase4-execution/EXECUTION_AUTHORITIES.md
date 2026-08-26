# Phase 4 — Execution Authorities

**Single owner per responsibility. No overlapping ownership.**

---

## Authority matrix

| Responsibility | Sole owner | Status |
|----------------|------------|--------|
| Execution authorization records | **Execution Controller** | Scaffold (Phase 3) — one stage; not sole execution authority |
| Department contracts | **Department SDK** | Scaffold (Phase 3) |
| Worker runtime contracts | **Worker Runtime** | Scaffold (Phase 3) |
| Telemetry / observability contracts | **Telemetry** | Scaffold (Phase 3) |
| Budgeting / cost sessions | **Cost Ledger** | Scaffold (Phase 3) |
| Activation eligibility | **Activation Gate** | Scaffold (Phase 3) |
| Founder execution intent | **Execution Authorization** | Scaffold (Phase 3) |
| Execution modelling | **Pre-Dispatch Simulation** | Scaffold (Phase 3) |
| Governance / missions | **Company Brain** | Certified (Phase 2) — never dispatches |
| Provider catalogue | **Provider Registry** | **Future** |
| Job admission / queue | **QueueManager** | **Future** (single instance) |
| Scheduling | **Scheduler** | **Future** (single instance) |
| Evaluation | **Evaluation authority** (TBD module) | **Future** |
| Learning | **Learning authority** (TBD module) | **Future** |
| Publishing | **Publishing authority** | **Future** |
| Canonical Resume product spine | **Pipeline A** (`first-production-cycle`) | Frozen / guarded |

---

## Explicit non-owners

- Company Brain does **not** own dispatch, workers, or providers.  
- Department SDK does **not** own queues or providers.  
- Telemetry does **not** own execution.  
- Cost Ledger does **not** own providers.  
- Activation / Authorization do **not** flip execution flags.  
- Simulation does **not** own runtime objects.

---

## Future provider authority (docs)

Provider Registry owns provider identity, validation status, and adapter binding. Brain Router owns skill→provider routing. Cost Ledger owns spend reservation. No second registry.

---

## Conflict rule

If two modules claim the same authority, Phase 4 implementation is **blocked** until ownership is reconciled in `module-roles.json` and this charter.
