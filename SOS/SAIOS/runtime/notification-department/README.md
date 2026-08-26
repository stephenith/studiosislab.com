# Notification Department V1

**Agent:** #101  
**Role:** Unified AI OS notification layer

## Mission

Collect alerts and operational signals from AI OS departments and prepare founder-facing notifications.

- Website Department alerts
- Resume Factory / Production Dashboard
- Catalog Integrity
- Scheduler health
- Project state pending actions

## Channels

| Channel | Status |
|---------|--------|
| Telegram | Adapter ready (dry-run until secrets) |
| Email | Adapter ready (dry-run until secrets) |
| Console | Always available |

Reuses payload shapes compatible with `SOS/runtime` Telegram/email services.  
Does **not** send live traffic during `verify`.

## Usage

```bash
npm run notification-department:verify
```

## Digests

- Morning Review (`morning-digest.md`)
- Evening Review (`evening-digest.md`)
- Daily Summary (`daily-summary.md`)

## Outputs

`SOS/07_LOGS/saios/notification-department/`

## Priority

- **CRITICAL** — immediate (still dry-run until live mode enabled)
- **WARNING** — next digest
- **INFO** — digest only
