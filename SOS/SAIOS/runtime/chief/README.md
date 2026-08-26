# Chief Module — Executive Orchestrator

The **Executive Orchestrator** is the only SAIOS component allowed to make decisions. It plans, delegates, and tracks work. It **never** edits code, runs Cursor, or spawns workers.

## Components

| File | Role |
|------|------|
| `ExecutiveOrchestrator.ts` | Public orchestration API |
| `Planner.ts` | Builds execution plans from founder commands |
| `Dispatcher.ts` | Selects idle workers by capability and priority |
| `ProgressTracker.ts` | Queue-derived progress snapshots |
| `DecisionEngine.ts` | Deterministic intent classification (no AI) |
| `verify.ts` | Integration verification |

## Dependencies

Uses **only**:

- `QueueManager` (`../queue/`)
- `RegistryManager` (`../registry/`)

## API

| Method | Purpose |
|--------|---------|
| `receiveFounderCommand()` | Accept command, plan, create jobs, assign workers |
| `createExecutionPlan()` | One founder request → one execution plan |
| `createJobs()` | Persist plan steps as queue jobs |
| `selectWorkers()` | Match idle workers to jobs |
| `assignJobs()` | Bind workers via queue + registry |
| `trackExecution()` | Progress snapshot (% and counts) |
| `collectReports()` | Gather job report summaries |
| `finishExecution()` | Write completion report to disk |

## Execution plan schema

`id`, `goal`, `summary`, `priority`, `jobs[]`, `estimated_workers`, `estimated_steps`, `estimated_duration`, `created_at`

## Verification

```bash
cd SOS/SAIOS/runtime && npm run chief:verify
```

## Status

Production v1 — orchestration brain only.
