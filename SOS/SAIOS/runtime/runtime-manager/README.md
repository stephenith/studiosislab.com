# AI OS Runtime & Deployment Manager V1

**Agent:** #103  
**Role:** Startup, supervision, heartbeat, recovery, and deployment readiness for all AI OS departments

## Mission

Permanent execution backbone of the AI Operating System.

- Discover and register existing departments (never modify them)
- Resolve startup dependency order
- Supervise lifecycle states
- Emit heartbeats
- Restart only failed departments
- Report VPS packaging readiness (no Docker / provisioning yet)

## Usage

```bash
npm run runtime-manager:verify
```

## Startup order

Factory State → Timeline → Notification → Website → Scheduler → Resume Factory → Production Dashboard → Founder Dashboard → Release Manager → Catalog Integrity → Batch Release

## Outputs

`SOS/07_LOGS/saios/runtime-manager/`

## Lifecycle states

`STOPPED` · `STARTING` · `RUNNING` · `PAUSED` · `RECOVERING` · `FAILED` · `SHUTTING_DOWN`
