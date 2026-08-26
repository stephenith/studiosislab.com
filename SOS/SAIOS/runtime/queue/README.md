# Queue Module — v1 Production

First working SAIOS component. JSON file-per-job persistence under `SOS/07_LOGS/saios/jobs/`.

## Classes

| File | Role |
|------|------|
| `QueueManager.ts` | Public API — always reloads from disk |
| `QueueStorage.ts` | Path resolution, directory listing |
| `QueuePersistence.ts` | Atomic read/write per job JSON |
| `QueueEvents.ts` | Append-only `events.jsonl` |
| `verify.ts` | Integration verification script |

## Job statuses

`QUEUED` → `PLANNING` → `RUNNING` → `WAITING_QA` → `COMPLETED`  
Terminal: `COMPLETED`, `FAILED`, `CANCELLED`

## Verify

```bash
cd SOS/SAIOS/runtime
npm run queue:verify
```

## Storage

- One job = `{jobsDir}/{job_id}.json`
- Events = `{jobsDir}/events.jsonl`
- Atomic write: temp file + rename
- No in-memory source of truth
