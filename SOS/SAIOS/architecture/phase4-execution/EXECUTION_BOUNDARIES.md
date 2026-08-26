# Phase 4 — Execution Boundaries

**Documentation only. No implementation.**

---

## Primary execution flow (future)

```
Execution Controller
  ↓
QueueManager
  ↓
Worker Runtime
  ↓
Providers
  ↓
Artifacts
  ↓
Evaluation
  ↓
Learning
```

Company Brain remains **governance / planning** only. It must never call QueueManager, spawn workers, or invoke providers directly.

---

## Allowed dependency direction (future)

| From | May depend on (read / contract) | Must not write |
|------|----------------------------------|----------------|
| Execution Controller | System Readiness, Runtime Release/Plan, Activation, Authorization, Cost Ledger (reserve), Telemetry (session ids) | Company Brain mission state beyond authorized transitions |
| QueueManager | Execution Controller admission tickets | Providers, Learning writes |
| Worker Runtime | QueueManager jobs, Department SDK capabilities | Queue insert, Scheduler activation |
| Provider Adapters | Provider Registry, Cost Ledger reservation, Brain Router routing metadata | Publishing, Learning |
| Evaluation | Artifacts, Telemetry refs | Dispatch |
| Learning | Evaluation results | Dispatch, QueueManager |

---

## Forbidden dependencies (always)

- Company Brain → QueueManager / Worker spawn / Provider execute  
- Department SDK → QueueManager / Provider execute  
- Telemetry → Provider execute / Queue insert  
- Cost Ledger → Provider execute (estimates/reservations only until settlement contracts exist)  
- Pre-Dispatch Simulation → any runtime side effect  
- Activation Gate / Execution Authorization → any `*_allowed=true` mutation  

---

## Layer boundaries

### Planning boundary
Ends at: Activation Gate + Execution Authorization + Pre-Dispatch Simulation certificates.

### Execution boundary
Begins only when: Execution Controller issues a **dispatch-ready** certificate *and* QueueManager admits a job under locked safety policy (future).

### Learning boundary
Begins only after: Evaluation completes for a terminal job; never feeds back into live dispatch without Founder policy.

---

## Pipeline A

`SOS/SAIOS/core/first-production-cycle` remains the sole **canonical product execution spine** for Resume production cycles under Runtime Guard.

Phase 4 company-wide dispatch architecture must **not** create a second product engine. Phase 4 QueueManager/Worker Runtime must integrate with or explicitly defer to Pipeline A for Resume Department work.

---

## Dashboard

Phase 4 surfaces remain read-only until a future agent defines POST/control APIs under Founder gates. Charter does not add routes.
