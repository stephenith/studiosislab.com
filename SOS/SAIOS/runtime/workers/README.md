# Worker Factory

Generic factory for creating standardized SAIOS workers from any future worker definition.

## Components

| File | Role |
|------|------|
| `WorkerFactory.ts` | Public API |
| `WorkerTemplate.ts` | Template → worker materialization |
| `WorkerDefinition.ts` | `FactoryWorker` schema |
| `WorkerLifecycle.ts` | Factory lifecycle states + registry mapping |
| `WorkerCapabilities.ts` | Built-in definitions + capability resolution |
| `WorkerRegistryAdapter.ts` | RegistryManager-only persistence |

## Factory API

| Method | Purpose |
|--------|---------|
| `createWorker()` | Create and register standardized worker |
| `cloneWorker()` | Clone from existing worker template |
| `retireWorker()` | Retire worker |
| `pauseWorker()` / `resumeWorker()` | Lifecycle control |
| `heartbeat()` | Update heartbeat |
| `serialize()` / `deserialize()` | JSON roundtrip |

## Verification

```bash
cd SOS/SAIOS/runtime && npm run workers:verify
```

## Status

Production v1 — definitions only, no business logic.
