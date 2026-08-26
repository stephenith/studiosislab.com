# SAIOS Interfaces

TypeScript contracts for cross-module boundaries. **Skeleton only** — no implementations in v1.

## Usage

Future runtime (`SOS/SAIOS/runtime/`) implements these interfaces. Modules communicate only through typed seams — no direct cross-imports of internal logic.

## Files

| File | Contents |
|------|----------|
| `types.ts` | All v1 interfaces and shared types |

## Import convention (future)

```typescript
import type { Job, JobQueue, ChiefAI } from "../interfaces/types.js";
```

## Versioning

Breaking interface changes require `type_version` bump in Agent Registry worker types and a note in `SOS/SAIOS/EXPANSION.md`.

## Not included in v1

- Runtime validation (zod/io-ts)
- HTTP/OpenAPI bindings
- Test mocks

Those ship with `SOS/SAIOS/runtime/` in v1.1.
