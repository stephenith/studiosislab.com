# SAIOS Shadow Mode

Runs SAIOS **in parallel** with the legacy Commander pipeline for observation. **No production cutover** — legacy remains authoritative.

## Flow

```
Telegram founder message
        │
        ├──────────────► Legacy Commander (unchanged, authoritative)
        │
        └──────────────► SAIOS Shadow (isolated under shadow/)
```

## Components

| File | Role |
|------|------|
| `ShadowCoordinator.ts` | Dual-path processing per founder command |
| `ShadowComparator.ts` | Legacy vs SAIOS outcome comparison |
| `ShadowReport.ts` | Persist comparison reports |
| `ShadowCursorExecutor.ts` | Cursor runs scoped to `shadow/workspace/` only |

## Shadow workspace

All SAIOS shadow Cursor work is confined to:

`SOS/07_LOGS/saios/shadow/{run_id}/workspace/`

## Verification

```bash
cd SOS/SAIOS/runtime && npm run shadow:verify
```

## Status

Shadow Mode v1 — observation only, no telegram-poll replacement.
