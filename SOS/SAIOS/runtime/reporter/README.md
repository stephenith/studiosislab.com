# Reporter Module

Structured reports for jobs (progress, completion, failure).

Artifacts land under `SOS/07_LOGS/saios/reports/` (future).

## Interface: `ReporterService`

| Method | Purpose |
|--------|---------|
| `createProgressReport()` | In-flight update |
| `createCompletionReport()` | Successful terminal state |
| `createFailureReport()` | Failed terminal state |

## Status

Skeleton v1.0 — interface only.
