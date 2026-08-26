# Worker Runtime Contract V1

Canonical runtime contract for every AIOS worker.

**Agent #182 · Scaffold only · WORKER SPAWN DISABLED · LIVE OFF**

## Ownership flow (design)

```
Execution Controller
  → Worker Session
  → Worker Assignment
  → Worker Runtime
  → Worker Result
  → Execution Controller
```

No spawn. No child processes. No scheduling. No execution.

## Lifecycle

`REGISTERED → ASSIGNED → READY → WAITING_CONTROLLER → CONTROLLER_AUTHORIZED → STOP`

## References (not wired)

- Execution Controller (session owner)
- Department SDK workers
- Cost Ledger cost sessions
- Telemetry IDs only

## API (GET only)

- `/api/runtime/worker-runtime`
- `/api/runtime/worker-runtime/:worker`
- `/api/runtime/worker-runtime/assignments`

## Verify

```bash
npm run worker-runtime:verify
```
