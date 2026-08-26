# Notifications Module

Founder-facing delivery channels.

## Interface: `NotificationService`

| Property | Purpose |
|----------|---------|
| `telegram` | Primary founder channel |
| `email` | Approval packets / digest |
| `slack` | **Placeholder** — future workspace alerts |

Each notifier exposes `send(message)`.

## Status

Skeleton v1.0 — interface only. Not wired to `SOS/runtime` services.
