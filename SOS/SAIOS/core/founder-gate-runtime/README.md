# Founder Gate Runtime V1

Interactive pause/resume for Resume Department cycles.

```
… → Critic Gate → WAITING_FOUNDER → STOP
Founder Dashboard Decision → Resume → Learning → Complete
```

- Real cycles never auto-decide
- Fixtures only for automated verification
- No LIVE · No OpenAI · No publication

## Security (local V1)

- Dashboard binds to `127.0.0.1` only
- No public exposure · no bypass endpoint
- No unauthenticated API outside localhost
- Secrets never displayed in the UI
- VPS cutover later requires founder authentication (Caddy/public auth not implemented here)

```bash
npm run founder-gate-runtime:verify
```
