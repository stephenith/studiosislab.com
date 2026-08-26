# Company Brain — Planning Engine + Mission Contract V1

**Agents #161–#162 · planning only · LIVE OFF · no Queue · no Providers**

```
Founder Objective
  → CompanyBrain.createMission()
  → MissionContract (PLANNED | WAITING_FOUNDER)
  → derived ExecutionPlan (temporary)
  → STOP
```

Mission Contracts are the canonical business object. Execution Plans are derived and temporary.

## Rules

- Never executes work
- Never enqueues jobs / admits to Queue
- Never calls Cursor / Providers / Models
- Never publishes or renders
- Does **not** replace `runtime/chief` ExecutiveOrchestrator
- Founder approval always required
- V1 mission statuses: `PLANNED` | `WAITING_FOUNDER` only

## Commands

```bash
npm run company-brain:verify
npm run company-brain:plan -- --objective="..."
npm run company-brain:plan -- --plan-only --objective="..."
npm run mission-approval:verify
```

## Modules

| File | Role |
|------|------|
| `MissionPlanner.ts` | Objective → Mission Contract + linked plan |
| `MissionRegistry.ts` | Versioned mission store (lookup / history / search) |
| `MissionValidator.ts` | Schema, lifecycle, dependency loop checks |
| `MissionDecisionManager.ts` | Founder APPROVED / REJECTED / CHANGES_REQUESTED |
| `MissionApprovalRepository.ts` | Append-only approval persistence |
| `PlanningEngine.ts` | Temporary ExecutionPlan builder |
| `CompanyBrain.ts` | Facade |

## Artifacts

`SOS/07_LOGS/saios/company-brain/`

- `latest-plan.json` / `status.json` / `plan-index.json` / `plans.jsonl`
- `missions/current-mission.json`
- `missions/index.json`
- `missions/{mission_id}.json`
- `missions/versions/{mission_id}.v{n}.json`
- `missions/missions.jsonl`
- `mission-approvals/mission-decisions.jsonl`
- `mission-approvals/latest-mission-approval.json`
- `mission-approvals/pending-mission-approvals.json`
- `mission-approvals/mission-approval-health.json`
