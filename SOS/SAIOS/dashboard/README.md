# AIOS Founder Dashboard V1

Internal Mission Control for the founder. **Not** the public StudiosisLab website.

- Path: `SOS/SAIOS/dashboard/`
- Bind: `127.0.0.1:4310` only
- Mode: read-only · LIVE OFF · dry_run · Mock provider
- PM2 `aios-dashboard`: **do not activate yet**
- Telegram / Caddy / DNS: **unchanged**

## Setup

```bash
cd SOS/SAIOS/dashboard
npm install
```

## Run (local)

```bash
# from repo root
npm run aios-dashboard:dev
```

Open http://127.0.0.1:4310

## Verify

```bash
npm run aios-dashboard:verify
```

## Design

See `SOS/SAIOS/AIOS_DASHBOARD_DESIGN_SYSTEM.md`.

## Security before VPS cutover

- Founder authentication required
- Do not point Caddy/DNS at this process yet
- Do not replace temporary page at os.studiosislab.com in this agent
