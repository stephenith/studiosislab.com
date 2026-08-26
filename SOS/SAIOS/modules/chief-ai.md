# Chief AI Module

**Role:** Chief orchestrator. Sole founder-facing intelligence. **Never writes production code.**

---

## Responsibilities

| Responsibility | Description |
|----------------|-------------|
| Receive founder commands | Telegram (primary), future: API, scheduled triggers |
| Understand intent | Classify, disambiguate, confirm destructive actions |
| Prioritize | P0–P3, revenue/roadmap weights, dependency awareness |
| Create execution plans | Decompose into job DAG; no implementation |
| Delegate work | Create jobs, assign workers via Agent Registry |
| Monitor workers | Poll Job Queue + Registry heartbeats |
| Store knowledge outcomes | Curate Memory after job completion |
| Verify completion | Read QA reports; close job chains |
| Notify founder | Progress, blockers, completions via Telegram |

---

## Non-responsibilities

- Spawning `cursor agent` (Cursor Runner)
- Running `npm build` / lint (QA Runner)
- Writing files under `src/`
- Direct PM/Developer loop mutation (legacy frozen)

---

## Internal subcomponents (logical)

```
ChiefAI
├── IntakeAdapter        # Telegram → normalized FounderCommand
├── IntentEngine         # classify + extract entities
├── Planner              # job DAG from intent
├── Prioritizer          # queue ordering policy
├── Monitor              # job/worker polling loop
├── CompletionVerifier   # aggregate QA + reports
├── Notifier             # founder-facing messages
└── MemoryCurator        # session/project/long-term writes
```

---

## Inputs

- Founder messages (Telegram)
- Job Queue state
- Agent Registry status
- Memory (all tiers)
- Knowledge Base snapshots
- Approval responses

## Outputs

- Job records (create/update/cancel)
- Worker assignment requests
- Founder notifications
- Chief decision log (`07_LOGS/saios/chief/`)
- Memory updates

---

## Planning output schema

Every founder execution request produces an **ExecutionPlan** (see `interfaces/types.ts`):

- `plan_id`
- `founder_message` (verbatim)
- `intent_summary`
- `jobs[]` (proposed DAG)
- `knowledge_refs[]`
- `requires_approval: boolean`
- `created_at`

Chief AI persists plan as `job_type=plan` before spawning children.

---

## Safety policy

1. **Scope gate** — `src/` jobs require explicit founder intent or approval metadata
2. **Secrets** — never include `.env` contents in prompts
3. **Destructive** — roadmap clear, mass delete → confirm via Telegram
4. **No self-execution** — Chief AI code path has no `child_process` for Cursor

---

## Relation to legacy Commander

| Legacy | Chief AI v1 |
|--------|-------------|
| `command-router.ts` intent classification | IntakeAdapter + IntentEngine |
| `executeNowFromInbox` | `createJobsFromIntent` (implement job only) |
| `work-orders/router.ts` capture | Unified Job Queue |
| Commander supervisor | Future SAIOS supervisor (monitors runners) |
| PM `loop.ts` task selection | Prioritizer + roadmap knowledge (read-only) |

Legacy code unchanged; Chief AI spec defines the replacement target.

---

## Failure modes

| Condition | Chief AI action |
|-----------|-----------------|
| Worker unavailable | Job stays `pending`; notify founder if SLA exceeded |
| Job blocked | Notify with approval instructions |
| QA fail | Create retry implement job or escalate |
| Registry stale heartbeat | Mark worker retired; reassign |

---

## Metrics (future)

- Jobs created / completed per day
- Mean time founder-message → QA pass
- Blocked job count
- Worker utilization

Stored in `07_LOGS/saios/chief/metrics.jsonl` (v1.1+).
