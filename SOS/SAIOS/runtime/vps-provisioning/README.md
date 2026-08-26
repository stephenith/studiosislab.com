# VPS Provisioning (Agent #114)

Operational documentation and provisioning assets for the **first AI OS VPS install**.

## Scope

- Creates runbooks and configuration guides only
- Reuses existing Deployment Package under `SOS/07_LOGS/saios/deployment-package/`
- Does **not** deploy
- Does **not** enable LIVE mode
- Does **not** modify Runtime Manager / Loop / Supervisor / Resume Factory / departments

## Verify

```bash
npm run vps-provisioning:verify
```

## Outputs

`SOS/07_LOGS/saios/vps-provisioning/`

- `vps-provisioning.json`
- `provisioning-checklist.md`
- `deployment-runbook.md`
- configuration guides (server, env, DNS, Nginx, SSL, firewall, PM2, systemd)
- `backup-strategy.md` / `monitoring-strategy.md` / `rollback-strategy.md`
- `estimated-cost.md`

## Safety

`SOS_AIOS_LIVE=0` until explicit founder approval (runbook step 14).
