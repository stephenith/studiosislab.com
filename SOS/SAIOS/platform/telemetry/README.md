# Telemetry Contract V1

Canonical execution observability contracts for AIOS.

**Agent #183 · Scaffold only · NO COLLECTION · NO EVENTS · LIVE OFF**

## Design

```
Execution Controller
  → Telemetry Session
  → Timeline
  → Events (catalogue only)
  → Snapshots
  → Reports
```

## Session contract

`telemetry-session-1.0.0`

## Lifecycle

`CREATED → READY → ATTACHED → FROZEN`

## Correlation

Links (metadata only): Mission · Execution Controller · Department · Worker Runtime · Cost Session · Runtime Plan · Telemetry

## API (GET only)

- `/api/platform/telemetry`
- `/api/platform/telemetry/:session`
- `/api/platform/telemetry/events`

## Verify

```bash
npm run telemetry:verify
```
