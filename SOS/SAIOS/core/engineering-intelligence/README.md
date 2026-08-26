# Engineering Intelligence (Governance)

**Agent #223** — Canonical Engineering Intelligence V1.

Advisory-only engineering governance & recommendation engine.

## Owns

- Engineering analysis
- Engineering scoring
- Engineering recommendations
- Trend notes
- Recommendation history artifacts

## Does not own

Code · Production · Scheduling · Budget · Policies · Founder decisions · Publication · LIVE

## Commands

```bash
npm run aios:engineering:run
npm run aios:engineering:verify
```

## Outputs

`SOS/07_LOGS/saios/engineering-intelligence/`

- `engineering-intelligence-report.json`
- `history/engineering-*.json`

## Safety

- Never edits code or deletes files
- Never invokes production / BatchRunner / ProductionController
- Never calls OpenAI
- Never modifies project-state or Runtime Guard
- `requires_founder_approval: true` on every recommendation

## Founder Engineering Review (#224)

Mission Control reviews recommendations from this report.

Status overlays only: `founder-review-statuses.json`

```bash
npm run aios:engineering-review:verify
```

Status changes never execute cleanup, refactor, or production.
