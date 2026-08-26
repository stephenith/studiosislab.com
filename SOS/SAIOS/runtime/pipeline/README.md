# Resume Autonomous Production Pipeline

End-to-end integration layer for StudiosisLab resume generation. **Integration only** — reuses existing Queue, Registry, Runtime Loop contracts, Batch Director, Production Worker, QA, Learning, and Local Review Tool.

## Flow

```
Founder Objective
  → Batch Director / Planner
  → Queue
  → Runtime Dispatch
  → Cursor Research + Execution
  → Resume Production Worker
  → Resume QA
  → Local Review Package
  → Founder Approval Gate (APPROVE | REJECT | REVISE)
  → Resume Learning
  → Batch Completion Report
```

## Run folder

Each run creates a unique folder under `SOS/07_LOGS/saios/runs/`:

```
run-YYYYMMDD-001/
├── objective.md
├── batch-plan.json
├── research.md
├── cursor-output.md
├── generated/
├── qa/
├── localhost/review.json
├── learning/
├── pipeline-state.json
├── pipeline-report.md
└── summary.md
```

No existing run is overwritten.

## Recovery

Pipeline state is persisted after every stage. On Cursor or stage failure, resume from the last successful stage (max 2 retries).

## Usage

```bash
cd SOS/SAIOS/runtime/pipeline
npm install
npm run verify
```

From repo root:

```bash
npm run pipeline:verify
```

## Constraints

- Does not create new intelligence modules
- Does not modify `src/`, editor, runtime, published templates, registry, or manifest
- Founder approval required before publication
- External research is temporary execution knowledge only
