# Resume Production Batch Director

Permanent orchestration layer for large-scale resume production. **Never designs resumes** — delegates all production to Resume Workers and Cursor Agent.

## Core principle

The Director **NEVER**:

- Designs resumes
- Writes Fabric JSON
- Edits templates
- Researches the internet itself

It only **plans, schedules, monitors, and reports**.

## Production flow

```
Founder
  ↓
Resume Production Director
  ↓
Batch Plan → Resume Jobs → Resume Workers → Cursor Agent
  ↓
Cursor research (MCP Firecrawl when available — temporary knowledge only)
  ↓
QA Pipeline → Founder Approval → Learning Engine
```

## Batch sizes

10, 25, 50, 100 resumes per batch.

## Priorities

ATS, Visual, Executive, Minimal, Creative, Healthcare, Engineering, Finance, Marketing, Sales, HR, Student, Operations, Government, Academic, Hospitality.

## Usage

```bash
cd SOS/SAIOS/runtime/directors/resume-production
npm install
npm run verify
```

From repo root:

```bash
npm run resume-batch:verify
```

## Output

`SOS/07_LOGS/saios/batches/{batch_id}/`

- `batch-plan.json`
- `batch-metrics.json`
- `batch-summary.json`
- `report.md`

## Constraints

- Never modifies `src/`, editor, runtime, published templates, registry, or manifest
- Founder approval required — never bypassed
- External research is temporary unless Founder approves permanent knowledge updates
