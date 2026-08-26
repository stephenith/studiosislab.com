# Vercel / Git verification checklist (Phase H)

Complete **before** enabling `aios-publication-nightly.timer` AUTO_APPLY.

## Verify (Founder or engineering with Vercel access)

1. Vercel project for `studiosislab.com` production branch name: ________ (expected `main`)
2. GitHub repo `stephenith/studiosislab.com` auto-deploys production on push to that branch: YES / NO
3. Preview deployments exist for non-main PRs: YES / NO
4. Manual dry-run on VPS:
   ```bash
   cd /root/studiosislab.com
   SOS_AIOS_LIVE=0 npm run aios:publication:status
   SOS_AIOS_LIVE=0 npm run aios:publication:plan
   SOS_AIOS_LIVE=0 npm run aios:publication:verify
   ```
5. Confirm publication git push allowlist paths only touch template/manifest/SEO files.

## Gate

- `SOS_AIOS_PUBLICATION_AUTO_APPLY` remains **0** until steps 1–3 confirmed and one watched apply succeeds.
- `SOS_AIOS_LIVE` remains **0**.

## Status

| Item | Status |
|------|--------|
| Branch confirmed | PENDING_FOUNDER |
| Auto-deploy confirmed | PENDING_FOUNDER |
| Dry-run on VPS | PENDING_DEPLOY |

Record results in `SOS/07_LOGS/saios/publication/vercel-git-verify.json` on VPS (do not commit secrets).
