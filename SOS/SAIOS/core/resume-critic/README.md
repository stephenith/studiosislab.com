# Resume Critic Engine V1

Deterministic quality gate between Resume Renderer and Founder Review.

```
Canvas JSON → Resume Critic → Founder Review (if ready)
```

## Rules

- Evaluates only — never redesigns, reasons, or mutates
- No AI · No OpenAI · No Mock Provider · No LIVE · No publication

## Readiness gate

- Overall ≥ 90
- ATS ≥ 95
- Technical = 100
- No overflow · no schema mismatch · no missing sections · no renderer errors

## Run

```bash
npm run resume-critic:verify
```
