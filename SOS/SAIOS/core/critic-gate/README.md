# Critic Gate V1

Hard gate between Resume Critic and Founder Review.

```
Resume Critic → Critic Gate → Templates Ready for Review (Ready=YES only)
                           → Blocked resume templates (Ready=NO)
```

- Ready=YES → founder review allowed · publication still false
- Ready=NO → blocked · remediation proposed · never auto-run
- Fixtures isolated from real founder decisions
- No OpenAI · No LIVE · No Telegram · No publish

```bash
npm run critic-gate:verify
```
