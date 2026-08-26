# AIOS Skill Library — Agent #117.5

Reusable Skills sit between departments and the AI Brain.

```
Founder → Executive Brain → Brain Router → Skill Library → Provider Adapter → Mock/OpenAI/Local/Future
```

## Rules

1. Departments **cannot** send prompts directly  
2. Departments request **Skills**  
3. Skills may compose other Skills  
4. Brain Router routes Skills  
5. Provider Adapter executes Skills  
6. Providers **never** know which department requested them  

## Domains

- **resume** — ATS, layout, typography, critique, feedback, JSON planning, naming, duplicates  
- **website** — UX, a11y, design, SEO, competitors, performance, bugs  
- **common** — reports, summaries, cost, risk, planning, revision  

## Status

Contracts + registry **READY**. Mock provider execution still Agent **#118**.

## Verify

```bash
npm run skill-library:verify
```
