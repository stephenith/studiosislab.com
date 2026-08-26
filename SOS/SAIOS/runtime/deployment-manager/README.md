# Deployment Manager (AI OS)

**Agent #106** — Deployment layer that turns Runtime Manager + departments into one deployable AI Operating System.

This is **not** VPS provisioning and **not** Docker.

## Mission

- Discover every department
- Validate startup order & dependencies
- Validate configuration & environment
- Generate startup / shutdown / restart scripts
- Generate deployment bundle & report

## Discover

Runtime Manager · Security · Timeline · Notification · Website · Resume Factory · Scheduler · Production Dashboard · Founder Dashboard · Release Manager · Catalog Integrity · Batch Release · Event Bus

## Outputs

Written to `SOS/07_LOGS/saios/deployment-manager/`:

- `deployment-plan.json`
- `deployment-bundle.json`
- `startup-order.json`
- `startup.sh`
- `shutdown.sh`
- `restart.sh`
- `environment-check.json`
- `deployment-report.md`

## Verify

```bash
npm run deployment-manager:verify
```

## Notes

Scripts invoke existing `npm run *:verify` targets only. No business logic is modified.
