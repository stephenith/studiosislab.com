# Dispatch Boundaries

**Agent #194 · Static verification only**  
**Mechanism:** import + process-spawn string scan in `execution-authority-model:verify`  
**No AST framework · No runtime overhead · Not Runtime Guard**

---

## Product modules must NOT use process spawn

Product modules must not import or directly use:

- `child_process`  
- `spawn` / `fork` / `exec` / `execFile`  
- `worker_threads` / `new Worker(`  

**Ignored (non-product):** verify scripts · tooling · engineering utilities · Cursor tooling · developer tooling.

---

## Forbidden import edges

| Consumer root | Must NOT import |
|---------------|-----------------|
| `runtime/execution-controller/` | QueueManager, Scheduler, Worker Runtime, Brain Router, Provider Registry, provider adapters |
| `core/company-brain/` | QueueManager, Scheduler, Worker Runtime, providers |
| `platform/department-sdk/` | execution-controller, activation-gate, execution-authorization, pre-dispatch-simulation, queue, scheduler, worker-runtime, providers |
| `runtime/worker-runtime/` | execution-controller, activation-gate, execution-authorization, queue, scheduler, providers, Brain Router |
| `runtime/scheduler/` | providers, Company Brain, Execution Controller |
| `runtime/queue/` | Execution Controller, Worker Runtime, providers |
| `architecture/runtime-guard.ts` | QueueManager, Worker Runtime, Execution Controller, Company Brain (must remain engine enforcement only) |

---

## Allowed (examples)

| From | To | Why |
|------|----|-----|
| Execution Controller | Company Brain (read-only mission registry) | Authorization record inputs |
| Execution Controller | planner / runtime-release / system-readiness (read-only) | Lifecycle prerequisites |
| Scheduler | QueueManager | Infrastructure substrate |
| Scheduler (legacy path) | Runtime Guard + unified-production | Guard-blocked legacy only |
| Dashboard plugins | read-only scaffolds | Founder visibility |

---

## Reference vs import

String fields (`cost_session_reference`, worker inventory placeholders, checksum chains) are **not** imports and do **not** violate these boundaries.
