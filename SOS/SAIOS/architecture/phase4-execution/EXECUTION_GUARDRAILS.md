# Phase 4 — Execution Guardrails

**Documentation only. No implementation.**

---

## 1. Activation rules

Execution may only exist after **all** certified:

| Prerequisite | Role |
|--------------|------|
| Activation Gate | Eligibility |
| Execution Authorization | Founder intent |
| Provider Registry | Providers *(future — must be certified before LIVE providers)* |
| Execution Controller | Authorization-record owner (one stage in distributed Execution Authority Model) |
| Department SDK | Department contracts |
| Worker Runtime | Worker contracts |
| Telemetry | Observability contracts |
| Cost Ledger | Budget contracts |

Also required: Phase 3 Planning Stack certification · Runtime Guard intact · Pipeline A canonical · Founder-commissioned implementation agent · LIVE policy explicit.

**This charter never enables LIVE.**

---

## 2. Provider architecture (future, docs only)

```
Skills
  ↓
Brain Router
  ↓
Provider Registry
  ↓
Provider Validation
  ↓
Cost Ledger
  ↓
Provider Adapter
  ↓
Model
```

Rules:

- No direct OpenAI / vendor SDK calls from departments or workers.  
- All calls route through Brain Router + Provider Registry.  
- Cost Ledger reservation precedes adapter invoke.  
- Provider Validation must be green for the selected provider profile.

---

## 3. Worker architecture (future, docs only)

| Topic | Rule |
|-------|------|
| Lifecycle | REGISTERED → ASSIGNED → READY → RUNNING → COMPLETED/FAILED (future states) |
| Ownership | Worker Runtime owns sessions/assignments; Execution Controller owns authorization to run |
| Retry ownership | Worker Runtime proposes; Execution Controller / policy admits |
| Rollback ownership | Execution Controller + department policy; Simulation defines non-executable plans today |
| Capability ownership | Department SDK defines capabilities; Worker Runtime maps workers |
| Isolation | No shared mutable mission state across workers without controller tickets |

Today: workers remain `spawned=false`, `running=false`.

---

## 4. Failure model (future, docs only)

| Mode | Intent |
|------|--------|
| Retry | Bounded re-attempt with backoff; Cost Ledger aware |
| Rollback | Compensating actions; never silent partial publish |
| Dead Letter Queue | Terminal quarantine for undeliverable jobs |
| Partial Success | Explicit evaluation path; not auto-complete |
| Cancellation | Founder / controller cancel; workers must stop |
| Timeout | Hard wall-clock; move to TIMED_OUT |
| Recovery | Replay from last durable checkpoint only |

---

## 5. Cost model (future, docs only)

```
Budget → Reservation → Consumption → Settlement → Audit
```

No billing implementation in Phase 4 charter. Estimates remain non-spend.

---

## 6. Telemetry model (future, docs only)

| Facet | Owner |
|-------|-------|
| Trace | Telemetry |
| Correlation | Telemetry |
| Metrics | Telemetry |
| Events | Telemetry |
| Logs | Telemetry (+ append-only platform logs) |
| Snapshots | Telemetry / dashboard plugins |

No event collection activated by this charter.

---

## 7. Security model (future, docs only)

| Area | Principle |
|------|-----------|
| Authentication | Founder / service identity before control APIs |
| Authorization | Capability + mission scoped; Activation + Authorization gates |
| Secrets | Never in contracts/logs; redacted dashboards |
| Audit | Append-only decisions and certificates |
| Policy | Approval Matrix + Priority Matrix remain binding |

---

## 8. Department expansion (future, docs only)

Onboard via Department SDK only:

Resume · Website · SEO · Marketing · Publisher · Finance · Support · HR · Legal

Each department: contract → registry → validation → readiness — never a private execution engine.

---

## 9. Out of scope (Agent #189 and charter freeze)

**NOT IMPLEMENTED**

- No execution  
- No dispatch  
- No providers  
- No QueueManager enablement  
- No Scheduler enablement  
- No worker spawn  
- No billing  
- No publishing  
- No LIVE  

**Must not modify**

- Pipeline A  
- Runtime Guard  
- Governance semantics  
- Phase 3 module behaviour  

---

## 10. Safety flags (remain false until activation agent)

`execution_allowed` · `dispatch_allowed` · `worker_spawn_allowed` · `provider_allowed` · `queue_insert_allowed` · `scheduler_allowed` · `publishing_allowed` · `live_enabled`
