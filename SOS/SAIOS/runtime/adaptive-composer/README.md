# Adaptive Resume Composer

Primary composition engine — assembles premium resumes from reusable design components.

## Role

- **Composes** from building blocks (header, summary, experience, etc.)
- **Never** generates fixed full templates
- **Never** modifies `src/`, editor, production worker, or publication flow

## Pipeline Position

```
Research → Benchmark → Design Brain → Adaptive Composer → Premium Generator → Visual Render → Founder Critic → Publication
```

## Component Libraries

Header, Professional Summary, Experience, Education, Skills, Projects, Certification, Achievements, Languages, Contact, Sidebar, Divider, CTA, Accent, Whitespace, Grid — each with 13 premium variants.

## Output

`SOS/07_LOGS/saios/adaptive-composer/compositions/{composition_id}/`

- `composition-plan.json`
- `layout-composition.json`
- `component-selection.json`
- `spacing-strategy.json`
- `hierarchy-strategy.json`
- `typography-strategy.json`
- `visual-composition.md`
- `design-rationale.md`
- `composition-confidence.json`

## Verify

```bash
npm run composer:verify
```

## Quality Targets

| Target | Threshold |
|--------|-----------|
| Premium Score | ≥ 98 |
| ATS Score | 100 |
| Visual Render | ≥ 98 |
| Founder Prediction | LIKELY APPROVE |
