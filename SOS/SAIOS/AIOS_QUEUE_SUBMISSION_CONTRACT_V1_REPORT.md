# AIOS Queue Submission Contract V1 Report

**Agent #167 · Chief Software Architect · Shadow mode only**  
**Date:** 2026-07-12  
**Status:** COMPLETE — Company Brain produces an immutable Queue Submission Package. Runtime Queue untouched.

---

## Queue submission schema

`schema_version`: `queue-submission-1.0.0`

Immutable fields: submission_id, mission_id, execution_id, execution_package_id/checksum, acknowledgement_id/checksum, department, priority, worker/skill/provider/tool inventories, dependency/execution graphs, estimated cost/duration, rollback_plan, quality_gates, security_state, submission_checksum.

Always: `dry_run=true`, `submission_allowed=false`, `queue_insert_allowed=false`, `execution_allowed=false`, `publishing_allowed=false`.

---

## Lifecycle

```
PACKAGE_ACKNOWLEDGED
  → WAITING_QUEUE_SUBMISSION   (package generated)
  → QUEUE_SUBMISSION_READY     (shadow confirm)
  → QUEUE_SUBMISSION_BLOCKED
→ STOP
```

Not activated: QUEUED · DISPATCHED · RUNNING · EXECUTING.

---

## Validation rules

- Mission exists and is PACKAGE_ACKNOWLEDGED (or already in submission states)
- Execution package exists; package checksum valid
- Consumed ACKNOWLEDGED acknowledgement present; ack checksum matches package
- No stale package versions
- Duplicate submission for same package checksum blocked (idempotent return)
- Review requires exact submission_checksum + configured founder actor
- Forbidden payload keys: enqueue, queue, dispatch, execute, publish, enable_live, provider_call

---

## Persistence

`SOS/07_LOGS/saios/company-brain/queue-submission/`

Append-only: `queue-submissions.jsonl`, `queue-submission-events.jsonl`, `queue-submission-history.jsonl`  
Atomic: `latest-queue-submission.json`, `latest-queue-submission-snapshot.json`, `pending-queue-submissions.json`, `queue-submission-health.json`  
Fixtures isolated. Does not overwrite Mission / Execution Package / Acknowledgement stores.

---

## Dashboard / API

- Page: `QueueSubmissionView` (Mission Control → Queue Submission)
- `GET /api/company-brain/queue-submission`
- `GET /api/company-brain/queue-submission/:mission_id` (auto-builds when PACKAGE_ACKNOWLEDGED)
- `POST /api/company-brain/queue-submission-review` (`CONFIRM_SHADOW_PACKAGE` | `BLOCK_SUBMISSION`)

Permanent banners: Queue disabled · Execution disabled · Publishing disabled.

---

## Verification

`npm run queue-submission:verify` (+ prior suite) → **PASS**

---

## Known limitations

- No runtime Queue write path
- No scheduler / worker / provider activation
- Shadow confirm does not authorize enqueue
- Company Brain still does not hand off to runtime Queue

---

## Readiness

- `operations.queue_submission_contract` = ready
- `operations.execution_mode` = shadow_submission_only
- `interfaces.dashboard_queue_submission` = active_local_only
- `latest_agent` = **167** · `next_agent` = **168**

---

## Exact recommendation for Agent #168

**Queue Handoff Intent Gate V1** — founder-visible intent that a `QUEUE_SUBMISSION_READY` package *would* be handed to the runtime Queue, still without writing to the Queue. Require matching `submission_checksum` + acknowledgement checksum. Keep `queue_insert_allowed=false`, execution/publishing/LIVE off. Do not modify runtime Queue, scheduler, or workers.
