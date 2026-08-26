# Runtime Loop (AI OS)

**Agent #109** — Continuous orchestration that turns verified departments into a running OS.

## Rules

- Orchestration only — no business logic
- Verify is always **dry-run** and **single-cycle** (never infinite)
- Departments are discovered from Runtime Manager (+ deployment/health registries)

## Cycle

1. Heartbeat  
2. Department health  
3–9. Website / Security / Timeline / Notification / Production Dashboard / Founder Dashboard / Founder Control Center refresh probes  
10. Event Bus dispatch  
11. Scheduler tick  
12. Recovery check  
13. Snapshot  
14. Sleep → repeat  

## Configuration (env)

| Variable | Purpose |
|---|---|
| `SOS_RUNTIME_LOOP_INTERVAL_MS` | Sleep between cycles |
| `SOS_RUNTIME_LOOP_DRY_RUN` | Default true |
| `SOS_RUNTIME_LOOP_MAX_CYCLES` | Cap cycles (`1` for verify) |
| `SOS_RUNTIME_LOOP_MAX_RUNTIME_MS` | Cap wall time |
| `SOS_RUNTIME_LOOP_SLEEP_MS` | Override sleep |

## Verify

```bash
npm run runtime-loop:verify
```

## Outputs

`SOS/07_LOGS/saios/runtime-loop/`

- `runtime-loop.json`
- `runtime-cycle.json`
- `runtime-health.json`
- `runtime-heartbeat.json`
- `runtime-snapshot.json`
- `runtime-report.md`
