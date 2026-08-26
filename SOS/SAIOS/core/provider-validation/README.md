# Provider Validation Preparation V1

Prepare one founder-approved dry-run resume template for controlled real-provider comparison.

```
Founder-approved resume template
  → Freeze Validation Input Package
  → Mock Baseline Run
  → Persist Baseline Evidence
  → Real-Provider Run Contract (blocked)
  → Side-by-Side Comparison Contract
```

## Hard rules

- No OpenAI SDK · no external API · no credentials added
- LIVE OFF · dry_run · publication impossible
- No automatic `READY_FOR_ONE_TEST`
- Mock is a structural baseline only — not a quality claim

## Resume template eligibility

Requires interactive dashboard APPROVED decision consumed by founder-gate-runtime.
Historical Agent #132 auto-decisions are not eligible.

If blocked, founder action:

`Approve one waiting dry-run resume template through the dashboard`

## Verify

```bash
npm run provider-validation:verify
```
