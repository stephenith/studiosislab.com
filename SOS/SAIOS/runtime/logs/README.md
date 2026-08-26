# Logs Module

Runtime logging paths and structured log entry contract.

Operational data lives under `SOS/07_LOGS/saios/` (see `SOS/SAIOS/LAYOUT.md`).

## Interface: `LogService`

| Method | Purpose |
|--------|---------|
| `paths()` | Resolved log directory paths |
| `write()` | Append structured log entry |

## Status

Skeleton v1.0 — interface only.
