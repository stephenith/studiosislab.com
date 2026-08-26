# StudiosisLab Production Controller

The **only** founder entry point for StudiosisLab production. Accepts objectives and delegates everything — never executes work, researches, or edits code.

## Flow

```
Founder Objective
  → Command Interpreter
  → Objective Planner
  → Research Engine (when needed)
  → Queue / Batch Director (multi-job)
  → Autonomous Pipeline
  → QA → Review → Approval → Learning
  → Session Report + Dashboard
```

## Example objectives

- Generate 10 ATS resumes
- Generate 5 Finance resumes
- Improve Healthcare templates
- Generate Executive resumes
- Analyze current template library
- Create Marketing resume collection

## Sessions

Every objective creates a versioned production session under:

`SOS/07_LOGS/saios/controller/sessions/production-YYYYMMDD-NNN/`

History index: `SOS/07_LOGS/saios/controller/history/index.json`  
Dashboard: `SOS/07_LOGS/saios/controller/dashboard.json`

## Usage

```bash
cd SOS/SAIOS/runtime/controller
npm install
npm run verify
```

From repo root:

```bash
npm run production:verify
```

## Constraints

- Reuses all existing SAIOS components (research, pipeline, QA, learning)
- No product, editor, or runtime changes
- Controller orchestrates only
