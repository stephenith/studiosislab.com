# Decision Ownership

**Agent #194**  
Each execution-adjacent **decision** has exactly one owner. Ownership is of the decision stage — not of product execution (which does not exist).

---

## Stage owners

### Planning — Company Brain

- **Owns:** mission creation, planning, objectives, admission/package/submission **contracts** (planning artifacts).  
- **Never:** dispatch, execution, QueueManager insertion, worker execution, provider invoke.

### Eligibility — Activation Gate

- **Owns:** eligibility evaluation certificates.  
- **Never:** execution, flag flips that enable LIVE/dispatch.

### Founder Intent — Execution Authorization

- **Owns:** founder intent records and approval metadata.  
- **Never:** execution, scheduler activation, worker spawn.

### Simulation — Pre-Dispatch Simulation

- **Owns:** simulation / dry-run / prediction graphs.  
- **Never:** execution; simulated nodes remain non-executed.

### Authorization Record — Execution Controller

- **Owns:** execution authorization records and lifecycle record scaffolding.  
- **Never:** queue insertion, worker spawning, scheduler control, provider execution.  
- **Role clarification:** authorization-record owner; **one stage** in the distributed model — **not** the sole execution authority.

### Infrastructure — QueueManager

- **Owns:** queue persistence and job state transitions (including status labels).  
- **Never:** execution authority; deciding whether work may run.

### Infrastructure — Scheduler

- **Owns:** scheduling concerns.  
- **Never:** execution authority; provider ownership; Company Brain planning.

### Workers — Worker Runtime

- **Owns:** worker contracts, assignments, passive references.  
- **Never:** dispatch, `child_process` spawn, scheduling decisions.

### Departments — Department SDK

- **Owns:** capability contracts and registration.  
- **Never:** dispatch or execution.

### Reasoning — Brain Router

- **Owns:** provider reasoning / routing plans.  
- **Never:** execution authority.

### Safety — Runtime Guard

- **Owns:** canonical engine access enforcement and legacy blocking.  
- **Never:** execution ownership or dispatch.

---

## Conflict rule

If two modules claim the same decision stage, certification fails until ownership is reconciled here and in `module-roles.json`.
