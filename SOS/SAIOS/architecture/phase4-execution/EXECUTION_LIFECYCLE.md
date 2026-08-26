# Phase 4 — Execution Lifecycle

**Architectural definitions only. NOT IMPLEMENTED.**

These states describe the future company execution lifecycle. No state machine code is introduced by Agent #189.

---

## Lifecycle

```
SYSTEM_READY
  ↓
ACTIVATION_ELIGIBLE
  ↓
FOUNDER_AUTHORIZED
  ↓
DISPATCH_READY
  ↓
DISPATCHED
  ↓
RUNNING
  ↓
COMPLETED
  ↓
EVALUATED
  ↓
LEARNING_ELIGIBLE
  ↓
LEARNING_COMPLETE
  ↓
ARCHIVED
```

---

## State meanings

| State | Meaning | Today |
|-------|---------|-------|
| `SYSTEM_READY` | System Readiness certificate valid | Exists (Phase 2) |
| `ACTIVATION_ELIGIBLE` | Activation Gate outcome eligible | Contract exists; typically blocked |
| `FOUNDER_AUTHORIZED` | Execution Authorization intent = AUTHORIZED | Contract exists; intent only |
| `DISPATCH_READY` | Controller admits dispatch ticket | **Future** |
| `DISPATCHED` | QueueManager accepted job | **Future** |
| `RUNNING` | Worker Runtime executing | **Future** |
| `COMPLETED` | Terminal success/fail recorded | **Future** |
| `EVALUATED` | Evaluation authority scored outcome | **Future** |
| `LEARNING_ELIGIBLE` | Learning may consume evaluation | **Future** |
| `LEARNING_COMPLETE` | Learning cycle finished | **Future** |
| `ARCHIVED` | Immutable retention | **Future** |

---

## Parallel planning statuses

Controller-local, department, worker, telemetry, and simulation lifecycles remain separate. They must not be conflated with this company execution lifecycle.

---

## Failure branches (see Failure Model in Guardrails / Charter reports)

From `RUNNING` / `DISPATCHED`, future architecture allows:

- `RETRYING`  
- `ROLLING_BACK`  
- `CANCELLED`  
- `TIMED_OUT`  
- `DEAD_LETTER`  
- `PARTIAL_SUCCESS` → `EVALUATED`

These branches are named for design clarity only.
