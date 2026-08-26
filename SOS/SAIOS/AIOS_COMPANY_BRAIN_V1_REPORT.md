# AIOS Company Brain V1 Report — Agent #161

**Status:** Planning Engine V1 implemented  
**Date:** 2026-07-12  
**Mode:** Planning only · no execution · no Queue enqueue · no Providers  

---

## 1. Executive Summary

Company Brain Planning Engine V1 is the **single planning authority** for AIOS. It reads founder objectives and live system artifacts, produces a structured `CompanyExecutionPlan`, persists it, and **stops**.

It does **not**:

- execute work
- enqueue Queue jobs
- run workers
- call Cursor / Providers / Models
- publish
- replace `runtime/chief` ExecutiveOrchestrator

Founder approval remains mandatory. Default plan status is `PLANNED` (or `BLOCKED` when hard blockers exist). `execution_allowed` and `queue_enqueue_allowed` are always `false`.

---

## 2. Planning Flow

```
Founder Objective
        │
        ▼
CompanyBrain.createPlan()
        │
        ├─ SystemStateReader (enablement, knowledge, queue, health,
        │                     provider validation, waiting reviews)
        │
        ├─ PlanningEngine.plan()
        │     · infer departments / order / workers / dependencies
        │     · detect blockers
        │     · set risk + priority
        │     · force founder_approval_required=true
        │     · force execution_allowed=false
        │
        ├─ PlanRepository.persist() → 07_LOGS/saios/company-brain/*
        │
        └─ STOP  (status PLANNED | BLOCKED)
```

---

## 3. Module Layout

```
SOS/SAIOS/core/company-brain/
  CompanyBrain.ts       facade
  PlanningEngine.ts     planning authority
  SystemStateReader.ts  read-only inputs
  PlanRepository.ts     append-only persistence
  types.ts              ExecutionPlan schema
  run.ts                CLI (plan only)
  verify.ts
  ARCHITECTURE.json
  README.md
```

npm:

- `npm run company-brain:verify`
- `npm run company-brain:plan`

---

## 4. Inputs

| Input | Source |
|-------|--------|
| Founder objective | CLI / `createPlan({ founder_objective })` |
| Department status | `SOS/SAIOS/infra/department-enablement.json` |
| Knowledge | `knowledge-system` / `knowledge-gateway` artifacts |
| Queue summary | `SOS/07_LOGS/saios/jobs/` (count only; never enqueue) |
| Runtime health | `runtime-loop/runtime-heartbeat.json` |
| Provider Validation | `provider-validation/*` |
| Pending founder reviews | `founder-gate-runtime/active-waiting-cycles.json` |
| Founder actions | `founder-control-center/founder-action-queue.json` |
| Critic readiness | `resume-critic/readiness.json` |

Dashboard snapshot is observed indirectly via the same artifact set the dashboard uses.

---

## 5. Outputs — ExecutionPlan Schema

`schema_version: "company-brain-plan-1.0.0"`

| Field | Description |
|-------|-------------|
| `mission_id` | Mission identifier |
| `plan_id` | Plan identifier |
| `objective` | Founder objective text |
| `priority` | P0–P3 |
| `departments_involved` | Resume, Website, SEO, Marketing, Publisher, Finance, Support (+ role) |
| `recommended_order` | Enabled departments only |
| `required_workers` | Recommended worker types (not launched) |
| `estimated_dependencies` | Module/artifact/approval/queue/provider deps |
| `blocking_issues` | Blockers + warnings |
| `risk_level` | low \| medium \| high \| critical |
| `founder_approval_required` | always `true` |
| `execution_status` | default `PLANNED` (or `BLOCKED`) |
| `execution_allowed` | always `false` |
| `queue_enqueue_allowed` | always `false` |
| `canonical_engine` | `core.first-production-cycle` |

Artifacts:

- `SOS/07_LOGS/saios/company-brain/latest-plan.json`
- `SOS/07_LOGS/saios/company-brain/status.json`
- `SOS/07_LOGS/saios/company-brain/plan-index.json`
- `SOS/07_LOGS/saios/company-brain/plans.jsonl`

---

## 6. Planning Lifecycle

```
idle → createPlan() → PLANNED | BLOCKED
                         │
                         └─ pending_approval = (status === PLANNED)
```

V1 does **not** advance to APPROVED/REJECTED automatically. Those statuses exist in the type system for V2+ founder-approval wiring.

---

## 7. Dashboard (read-only)

- Snapshot field: `company_brain` (`CompanyBrainViewData`)
- **Settings** page: Company Brain section (state, objective, plan id, blockers, badges)
- **Mission Control**: info banner when `pending_approval` (does not change workflows)

No new routes. No write controls. No Founder Review changes.

---

## 8. Planning Validation (blockers)

| Code | Severity | Meaning |
|------|----------|---------|
| `RESUME_DEPARTMENT_DISABLED` | blocker | Resume disabled |
| `WAITING_FOUNDER_REVIEW` | blocker | Active waiting cycle(s) |
| `DEPARTMENT_DISABLED` | blocker | Objective needs a disabled dept |
| `PROVIDER_VALIDATION_BLOCKED` | warning | Expected in dry-run |
| `KNOWLEDGE_UNAVAILABLE` | warning | Missing knowledge artifacts |
| `QUEUE_UNAVAILABLE` | warning | Jobs dir missing (V1 still does not enqueue) |
| `RUNTIME_HEARTBEAT_UNKNOWN` | warning | No heartbeat |
| `CRITIC_NOT_READY` | warning | Critic Ready=NO |

Disabled departments remain **informational** unless the objective requires them as primary/supporting.

---

## 9. Verification

| Suite | Result |
|-------|--------|
| `company-brain:verify` | **PASS** |
| `aios-dashboard:verify` | **PASS** |
| `founder-review-ui:verify` | **PASS** |
| `first-production-cycle:verify` | **PASS** |

Guarantees checked: planning_only, no execution, no enqueue, no OpenAI SDK, does not replace ExecutiveOrchestrator, LIVE OFF.

---

## 10. Known Limitations

1. No founder approve/reject API for plans yet (types only).
2. Does not call ExecutiveOrchestrator / Queue (by design).
3. Department inference is keyword-based (deterministic, not LLM).
4. Plans may be `BLOCKED` while a real waiting founder cycle exists (correct).
5. Website/SEO/Marketing/Finance/Support are catalogued but disabled.

---

## 11. Readiness

**Company Brain V1 readiness: 88%**

Planning authority exists, persists, surfaces on dashboard, and cannot execute. Remaining gap is V2 approval → handoff to canonical engine (still human-gated).

---

## 12. Recommendations for V2

1. Founder approve/reject plan endpoints (immutable), still without auto-enqueue.
2. Explicit handoff contract: approved plan → canonical `first-production-cycle` (or Queue job) **only after** founder confirmation.
3. Narrow mission allow-list so legacy engines stay frozen.
4. Optional: Company Brain reasons via Brain Router Skills (still plan-only outputs).
5. Do **not** add autonomy, Managers, or Provider calls in V2 until Queue wiring for the canonical spine is complete.

---

## 13. Project State

- `latest_agent = 161`
- `next_agent = 162`
