# Phase 4 — Execution Principles

**Immutable. Documentation only.**

---

## Distinctions

| Concept | Principle |
|---------|-----------|
| Planning | Decides eligibility and intent; never runs work |
| Simulation | Models work; every node `executed=false` |
| Execution | Runs work under one controller and one queue |
| Learning | Consumes outcomes; never dispatches |

---

## Single authorities

1. **One execution authority model** (distributed) — decision stages have single owners; Execution Controller owns authorization records only (not sole dispatch/execution)  
2. **One QueueManager** — future single admission/dispatch queue (infrastructure only)  
3. **One Scheduler** — future single scheduling authority (infrastructure only; not execution authority)  
4. **One Provider Registry** — future single provider catalogue  
5. **One Learning authority** — future learning subsystem  
6. **One Evaluation authority** — future evaluation subsystem  
7. **One Publishing authority** — future publishing subsystem  

**No duplicate execution engines.** Legacy paths remain archived / Runtime Guard blocked.  
**No central god-module executor.** See `architecture/execution-authority-model/`.

---

## Safety principles

- All `*_allowed` flags remain false until a Founder-commissioned activation agent flips them under checklist.  
- LIVE remains OFF by default.  
- Authorization is not execution.  
- Activation eligibility is not execution.  
- Simulation is not execution.  
- Cost estimates are not billing.  
- Telemetry references are not collection.

---

## Philosophy chain

```
Planning → Authorization → Dispatch → Execution → Evaluation → Learning
```

Skipping any gate is architecturally forbidden.

---

## Department principle

All departments expand through **Department SDK** contracts. No ad-hoc department runtimes.

---

## Observability principle

Telemetry owns traces/events/metrics contracts. Execution modules emit only through Telemetry APIs (future), never bypass.

---

## Cost principle

Cost Ledger owns budget reservation, consumption recording, and settlement contracts. Providers must not bill outside Cost Ledger.
