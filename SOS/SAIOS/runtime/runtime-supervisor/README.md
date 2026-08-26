# Runtime Supervisor & Watchdog (AI OS)

**Agent #110** — Parent orchestration that supervises the Runtime Loop.

## Rules

- Orchestration only — does not modify Runtime Loop or department business logic
- Verify is always **dry-run** and **single-pass** (never infinite)
- Founder actions are **generated only** (`send: false`)

## Flow

```
Supervisor
  → Start Runtime Loop (capped)
  → Watch heartbeat / cycle age
  → Detect failures
  → Watchdog restart if stale
  → Recovery actions (dry-run)
  → Founder monitoring (no send)
  → Reports
```

## Configuration (env)

| Variable | Purpose |
|---|---|
| `SOS_SUPERVISOR_DRY_RUN` | Default true |
| `SOS_SUPERVISOR_MAX_CYCLES` | Cap supervised loop cycles |
| `SOS_SUPERVISOR_HEARTBEAT_TIMEOUT_MS` | Stale heartbeat threshold |
| `SOS_SUPERVISOR_MAX_RESTART_ATTEMPTS` | Restart cap |
| `SOS_SUPERVISOR_MAX_RECOVERY_ATTEMPTS` | Recovery cap |

## Verify

```bash
npm run runtime-supervisor:verify
```

## Outputs

`SOS/07_LOGS/saios/runtime-supervisor/`

- `supervisor-health.json`
- `watchdog.json`
- `restart-history.json`
- `recovery-history.json`
- `runtime-status.json`
- `supervisor-report.md`
- `supervisor-config.json`
