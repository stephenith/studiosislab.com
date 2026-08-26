/**
 * Recovery / rollback guide.
 * AGENT #114
 */
export function buildRecoveryGuide(): string {
  return `# Rollback Strategy

## Principles

1. Prefer restore from last known-good backup over ad-hoc edits.
2. Keep \`SOS_AIOS_LIVE=0\` during recovery.
3. Re-run verify scripts before any mode change.
4. Publication rollbacks use existing Release Manager snapshots — do not invent new release logic here.

## Process recovery

\`\`\`bash
# PM2
pm2 restart all
# or systemd
sudo systemctl restart aios
\`\`\`

If restart loops: stop process, inspect logs, run:

\`\`\`bash
npm run live-runtime:verify
npm run runtime-supervisor:verify
npm run deployment-readiness:verify
\`\`\`

## Filesystem recovery

\`\`\`bash
bash SOS/07_LOGS/saios/deployment-package/restore.sh <backup-archive>
\`\`\`

Then:

\`\`\`bash
bash SOS/07_LOGS/saios/deployment-package/install.sh
\`\`\`

## Code rollback

\`\`\`bash
cd /opt/aios
git fetch --all
git checkout <known-good-sha>
npm install
npm run deployment-package:verify
\`\`\`

## Publication rollback

Use existing Release Manager rollback snapshots under:

\`SOS/07_LOGS/saios/publication/release-manager/\`

Do not enable LIVE to recover publications.

## Update path

\`\`\`bash
bash SOS/07_LOGS/saios/deployment-package/update.sh
\`\`\`

## Uninstall (last resort)

\`\`\`bash
bash SOS/07_LOGS/saios/deployment-package/uninstall.sh
\`\`\`

## Founder gate

Any return to LIVE requires explicit founder approval after recovery verification.
`;
}
