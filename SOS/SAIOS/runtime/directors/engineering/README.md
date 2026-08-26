# Engineering Director

First permanent SAIOS Director — orchestration layer for software engineering objectives.

**Not a programmer.** Never edits code, calls Cursor, or runs shell commands.

## Components

| File | Role |
|------|------|
| `EngineeringDirector.ts` | Main orchestration API |
| `EngineeringPlanner.ts` | Objective → `EngineeringPlan` |
| `EngineeringDelegator.ts` | Registry workers + Queue jobs |
| `EngineeringReporter.ts` | Consolidated engineering report |
| `EngineeringPolicies.ts` | Worker definitions + forbidden actions |

## Flow

```
Engineering objective
      ↓
EngineeringPlanner
      ↓
EngineeringDelegator → Registry + Queue
      ↓
Monitor progress
      ↓
EngineeringReporter → ONE consolidated report
```

## Verification

```bash
cd SOS/SAIOS/runtime && npm run engineering:verify
```

## Status

Production v1 — orchestration only.
