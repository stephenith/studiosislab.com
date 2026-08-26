# QA Module

Verification-only workers. **Never implements features.**

## Interface: `QARunnerService`

| Method | Purpose |
|--------|---------|
| `requestVerification()` | Enqueue verify job |
| `receiveVerification()` | Collect QA verdict report |

Supports multiple QA worker types via Registry (future).

## Status

Skeleton v1.0 — interface only.
