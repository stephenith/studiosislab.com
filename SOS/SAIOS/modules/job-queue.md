# Job Queue Module

**Role:** Durable, authoritative store of all work in SAIOS. Single source of truth for job state.

---

## Responsibilities

| Responsibility | Description |
|----------------|-------------|
| Persist jobs | All states on disk (v1.1) or DB (v2) |
| Enforce state machine | Valid transitions only |
| Dependency resolution | Block until parents/deps complete |
| Priority ordering | Dequeue highest priority eligible job |
| Assignment linkage | `assigned_worker` field |
| Audit trail | `updated_at`, status history in metadata |

---

## Job states

| State | Folder (file-based v1.1) |
|-------|--------------------------|
| `pending` | `07_LOGS/saios/jobs/pending/` |
| `running` | `07_LOGS/saios/jobs/running/` |
| `blocked` | `07_LOGS/saios/jobs/blocked/` |
| `completed` | `07_LOGS/saios/jobs/completed/` |
| `cancelled` | `07_LOGS/saios/jobs/cancelled/` |

Transition = atomic move/rename of `{job_id}.json` between folders (v1.1 implementation note).

---

## Required job fields

| Field | Type | Description |
|-------|------|-------------|
| `job_id` | string | `JOB-YYYYMMDD-HHMMSS-{slug}` |
| `priority` | P0\|P1\|P2\|P3 | Founder/orchestrator priority |
| `parent_job_id` | string \| null | Parent in DAG |
| `creator` | string | `chief-ai`, `founder`, `system` |
| `assigned_worker` | string \| null | `WRK-…` instance id |
| `dependencies` | string[] | Job IDs that must complete first |
| `job_type` | enum | `plan`, `implement`, `verify`, `research`, `notify` |
| `status` | enum | pending, running, blocked, completed, cancelled |
| `created_at` | ISO8601 | |
| `updated_at` | ISO8601 | |
| `started_at` | ISO8601 \| null | |
| `completed_at` | ISO8601 \| null | |
| `founder_message` | string | Verbatim intake (optional on child jobs) |
| `prompt_path` | string \| null | `PRM-{job_id}.md` |
| `report_path` | string \| null | `RPT-{job_id}.json` |
| `metadata` | object | Extensible: scope, approval, revenue tags |

---

## Priority rules

1. P0 before P1 before P2 before P3
2. Within tier: FIFO by `created_at`
3. Chief AI may boost priority on founder "urgent" (logged in metadata)
4. Blocked jobs never dequeue until unblocked

---

## Dependency rules

- Job with unsatisfied `dependencies` stays `pending` (not visible to runners)
- Parent job `plan` may remain `running` while children execute
- Completing all children triggers Chief AI completion check on parent

---

## Claim protocol (runners)

1. Runner polls `pending` for matching `job_type` + `assigned_worker` (or open pool)
2. Atomic claim: `pending` → `running`, set `started_at`
3. Only one claimant succeeds (file lock or DB row lock in v2)

---

## Relation to legacy work orders

| Work order field | Job field |
|------------------|-----------|
| `work_order_id` | `job_id` (new format) |
| `classification` | `metadata.classification` |
| `cursor_prompt_path` | `prompt_path` |
| `status: queued` | `status: pending` |

Migration mapping documented in EXPANSION.md; legacy paths untouched in v1.

---

## Interfaces

See `Job`, `JobStatus`, `JobQueue` in `interfaces/types.ts`.

---

## Future

- Postgres with `SELECT … FOR UPDATE SKIP LOCKED`
- Dead letter queue for exhausted retries
- Job templates (recurring nightly audit)
