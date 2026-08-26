# Registry Module — v1 Production

Second production SAIOS component. JSON file-per-worker under `SOS/07_LOGS/saios/registry/`.

**No worker may execute unless registered here.**

## Classes

| File | Role |
|------|------|
| `RegistryManager.ts` | Public API |
| `RegistryStorage.ts` | Paths, list, read |
| `RegistryPersistence.ts` | Atomic JSON write |
| `RegistryEvents.ts` | Append-only `events.jsonl` |
| `worker-status.ts` | 7-state lifecycle |
| `verify.ts` | Integration verification |

## Worker statuses

`REGISTERED` → `IDLE` ↔ `BUSY` | `PAUSED` | `OFFLINE` | `ERROR` → `RETIRED`

## Verify

```bash
cd SOS/SAIOS/runtime
npm run registry:verify
```

## Storage

- One worker = `{registryDir}/{worker_id}.json`
- Events = `{registryDir}/events.jsonl`
- Atomic write + always reload from disk
