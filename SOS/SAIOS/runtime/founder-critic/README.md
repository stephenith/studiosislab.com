# Founder AI Design Critic

Final quality gate before Founder Review. Answers one question:

**"Would Stephen approve this template?"**

This is NOT a resume generator, QA engine, or production worker.

## Pipeline position

```
Research → Benchmark → Design Brain → Premium Generator → Resume QA
  → Founder AI Design Critic → Local Review → Founder → Learning
```

## Design knowledge (reused only)

- Research Engine
- Benchmark Engine
- Design Brain memory
- Resume Intelligence
- Resume Learning Memory
- Resume Technical Contract
- Resume QA reports
- Premium Generator reports

## Approval policy

| Score | Policy |
|-------|--------|
| <95 | Automatically reject for founder review |
| 95–97 | Revision recommended |
| 98+ | Recommend founder approval |

**Founder approval is always mandatory** — critic never auto-approves.

## Output artifacts

Under `SOS/07_LOGS/saios/founder-critic/reviews/{prototype_id}/`:

- `founder-review.json`
- `founder-prediction.json`
- `improvement-plan.json`
- `visual-strengths.json`
- `visual-weaknesses.json`
- `approval-recommendation.json`
- `comparison-report.json`
- `critic-report.md`

## Verification

```bash
npm run founder-critic:verify
```

## Entry point

```typescript
import { runFounderCritic } from "./FounderCriticDirector.js";

const result = await runFounderCritic({
  prototype_dir: "/path/to/generated-resumes/modern-ats-professional-v1-v3",
});
```
