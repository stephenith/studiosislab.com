# AIOS Infrastructure — PM2 Runtime (Agent #116)

Authoritative process topology for the **Hetzner AIOS control plane**.

## Hosting split

| Surface | Host |
|---|---|
| Public website `studiosislab.com` | **Vercel** |
| AIOS orchestration / workers / Telegram / dashboard | **Hetzner VPS** |
| Temporary `studiosislab` PM2 → `os.studiosislab.com` | Documented only — do not stop here |

## Files

| File | Purpose |
|---|---|
| `pm2.config.cjs` | Authoritative PM2 ecosystem (all apps `autostart: false`) |
| `aios-processes.json` | Full process audit + classifications |
| `department-enablement.json` | Resume enabled (dry_run); Website disabled |
| `runtime-environment.example` | Env var names only — no secrets |
| `process-health-contract.json` | Health artifact contract |
| `startup-order.json` / `shutdown-order.json` | Safe start/stop order |
| `disabled-process.cjs` | Stub for MISSING entrypoints |

## Safety defaults

- `SOS_AIOS_LIVE=0`
- `SOS_AIOS_NOTIFY_LIVE=0`
- dry-run / max cycles = 1
- auto-publish off
- founder approval mandatory
- no OpenAI activation in this agent

## Verify

```bash
npm run aios-pm2:verify
```

## Strategy reference

`SOS/SAIOS/AIOS_MODEL_AND_EXECUTION_STRATEGY.md`
