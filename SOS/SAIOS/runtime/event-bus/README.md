# Event Bus & Automation Engine (AI OS)

**Agent #105** — Internal communication backbone of the AI Operating System.

This is **not** a scheduler and **not** an AI engine.

Departments communicate through events instead of directly calling each other.

## Capabilities

- Publish / subscribe
- Event type registry
- Department discovery & routing
- Automation rules (intent routing only — no business-logic calls)
- Event history & reports

## Registered events

`SYSTEM_START` · `SYSTEM_STOP` · `SYSTEM_HEALTHY` · `SYSTEM_WARNING` · `SYSTEM_CRITICAL` · `WEBSITE_WARNING` · `WEBSITE_HEALTHY` · `TIMELINE_REMINDER` · `SECURITY_WARNING` · `SECURITY_CRITICAL` · `RUNTIME_RESTART` · `FOUNDER_REVIEW_PENDING` · `PUBLICATION_READY` · `PUBLICATION_RELEASED` · `BATCH_COMPLETED` · `NOTIFICATION_READY` · `CUSTOM_EVENT`

## Outputs

Written to `SOS/07_LOGS/saios/event-bus/`:

- `event-registry.json`
- `event-history.json`
- `automation-rules.json`
- `department-routing.json`
- `event-report.md`

## Verify

```bash
npm run event-bus:verify
```

## Example automation

```
SECURITY_WARNING
  → Notification Department (queue alert)
  → Timeline Department (TIMELINE_REMINDER)
  → Production Dashboard (health update)
```

No direct module-to-module calls.
