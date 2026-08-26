# Visual Render Evaluation Engine

Judges the **final rendered resume** — not JSON, QA reports, or design plans.

The founder approves what is visually rendered.

## Input

- `template-preview.json`
- Fabric offscreen render (pixel-accurate, same canvas path as editor)

## Quality gate

If **Render Score < 96** → STOP. Publication Manager must not continue.

## Output

`SOS/07_LOGS/saios/visual-render/evaluations/{template_name}/`

- `visual-analysis.json`
- `render-score.json`
- `premium-perception.json`
- `eye-flow.json`
- `whitespace-analysis.json`
- `layout-balance.json`
- `typography-analysis.json`
- `hierarchy-analysis.json`
- `improvement-plan.md`
- `founder-review-preview.md`

## Verification

```bash
npm run visual-render:verify
```

## Entry point

```typescript
import { runVisualRenderEvaluation } from "./VisualRenderDirector.js";

const result = await runVisualRenderEvaluation({
  template_path: "/path/to/template-preview.json",
});
```
