# Cursor Runner Module

Exclusive execution boundary for **Cursor Agent CLI**. Runs `cursor agent --print` for assigned queue jobs. Does not interpret founder intent or modify product code outside job scope.

## Components

| File | Role |
|------|------|
| `CursorRunner.ts` | Build prompt from job, invoke process |
| `CursorProcess.ts` | Spawn `cursor agent --print`, capture I/O |
| `CursorResultParser.ts` | Parse stdout/stderr into structured result |
| `CursorJobExecutor.ts` | Execute job, write report, update queue |
| `verify.ts` | One real Cursor Agent verification run |

## Execution flow

```
Job (Queue) → CursorJobExecutor → CursorRunner → cursor agent --print
       ↓                                              ↓
  WAITING_QA ← report JSON ← SOS/07_LOGS/saios/reports/
```

## Queue transitions

| Outcome | Status |
|---------|--------|
| Success (exit 0) | `WAITING_QA` |
| Failure | `FAILED` |

## Verification

```bash
cd SOS/SAIOS/runtime && npm run cursor:verify
```

Requires authenticated Cursor Agent (`cursor agent login` or `CURSOR_API_KEY`).

## Status

Production v1 — first real SAIOS execution.
