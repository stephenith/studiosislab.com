# Resume Production Worker v2

Production-ready Resume Worker for StudiosisLab. Upgrades v1 with the **mandatory execution pipeline** — research, planning, self-critique, validation, QA, and local review.

## Core principle

**Cursor Agent** is primary intelligence (research delegated). **SAIOS** coordinates and validates.

## Mandatory pipeline

```
Founder Objective → Domain Knowledge → Cursor Research → Design Plan
  → Self-Critique ×2 → Fabric JSON → Editor Validation → QA → Local Review → STOP
```

## Commands

```bash
cd SOS/SAIOS/runtime/workers/resume-production
npm install
npm run verify:v2      # full v2 cycle self-test
npm run generate:v2    # production run
npm run generate       # v1 legacy entry (unchanged)
```

From repo root:

```bash
npm run resume-worker:v2-verify
```

## V2 artifacts

```
SOS/07_LOGS/saios/generated-resumes/{prototype_id}/
  template-preview.json
  thumbnail.png
  design-plan.json
  research-report.md
  design-review-1.md
  design-review-2.md
  validation.json
  confidence.json
  generation-report.md
  thumbnail-analysis.json
  final-summary.md
  localhost/review.json
```

## Constraints

- Never modifies `src/`, manifest, or registry
- Stops after local review — **founder approval mandatory**
- Learning append-only
- Duplicate detection at 70% similarity threshold

## V2 modules

| Module | Role |
|--------|------|
| `production-pipeline.ts` | Full mandatory execution sequence |
| `knowledge-context.ts` | Load all domain + learning knowledge |
| `duplicate-detector.ts` | Corpus similarity + auto-redesign |
| `design-plan.ts` | `design-plan.json` before generation |
| `self-critique.ts` | Two critique passes |
| `confidence-engine.ts` | Overall confidence target ≥95 |
| `editor-validation.ts` | Technical contract + editor map |
| `learning-append.ts` | Append-only learning records |
| `reports-v2.ts` | All v2 report artifacts |

## Premium Resume Generator v3

Highest-quality generation layer — extends v2 without duplicating the pipeline.

### Design source chain

```
Research → Benchmark → Design Brain → Learning → Intelligence → Worker
```

Workers never invent layouts independently.

### V3 pipeline

```
Integration → Pre-generation checklist → Triple critique → Fabric JSON → QA → Local Review → STOP
```

### Commands

```bash
npm run verify:v3       # premium generator verification
npm run generate:v3     # premium production run
```

From repo root:

```bash
npm run premium-generator:verify
```

### Pre-generation checklist (before Fabric JSON)

- `design-intent.json`
- `layout-selection.json`
- `visual-strategy.json`
- `spacing-plan.json`
- `typography-plan.json`
- `color-plan.json`
- `hierarchy-plan.json`
- `originality-check.json`
- `quality-prediction.json`

### V3 artifacts

```
SOS/07_LOGS/saios/generated-resumes/{prototype_id}-v3/
  design-intent.json … quality-prediction.json
  designer-review.md / recruiter-review.md / founder-review.md
  premium-score.json
  comparison-report.md / before-after.md
  generation-report-v3.md
  localhost/review.json
```

**Target:** overall confidence ≥97
