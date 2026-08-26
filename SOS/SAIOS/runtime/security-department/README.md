# Security Department (AI OS)

**Agent #104** — Operational health and protection for the AI Operating System.

This is **not** cybersecurity. It never modifies business logic and never sends alerts.

## Mission

Continuously check whether the AI OS itself is healthy:

- runtime health & heartbeat
- filesystem & folder permissions
- disk usage
- Node version
- environment configuration
- process availability
- dependency graph
- release / publication safety
- backup / rollback metadata

## Levels

`GREEN` · `YELLOW` · `ORANGE` · `RED` · `CRITICAL`

## Outputs

Written to `SOS/07_LOGS/saios/security-department/`:

- `security-health.json`
- `security-risks.json`
- `security-alerts.json` (payloads only — Notification Department consumes later)
- `security-checklist.json`
- `security-summary.md`
- `security-report.md`

## Verify

```bash
npm run security-department:verify
```

## Read-only sources

- `SOS/project-state.json`
- `SOS/07_LOGS/saios/runtime-manager/`
- `SOS/07_LOGS/saios/production-dashboard/`
- `SOS/07_LOGS/saios/timeline-department/`
- `SOS/07_LOGS/saios/notification-department/`
- `SOS/07_LOGS/saios/catalog-integrity/`
- `SOS/07_LOGS/saios/publication/`
