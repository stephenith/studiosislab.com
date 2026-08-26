/**
 * PM2 process manager guide — reuses deployment-package pm2.config.cjs.
 * AGENT #114
 */
export function buildPm2Guide(): string {
  return `# PM2 Configuration

## Asset (reuse)

\`SOS/07_LOGS/saios/deployment-package/pm2.config.cjs\`

Apps defined:

- \`aios-live-runtime\` — \`SOS_AIOS_LIVE=0\`, max 1 cycle defaults
- \`aios-supervisor\` — dry-run defaults

## Start (VERIFY / DRY_RUN only)

\`\`\`bash
cd /opt/aios
pm2 start SOS/07_LOGS/saios/deployment-package/pm2.config.cjs
pm2 status
pm2 logs
\`\`\`

## Persist across reboot

\`\`\`bash
pm2 save
pm2 startup systemd
# run the printed sudo command once
\`\`\`

## Stop / restart

\`\`\`bash
pm2 restart all
pm2 stop all
\`\`\`

## Safety

The PM2 env block hard-codes:

- \`SOS_AIOS_LIVE=0\`
- \`SOS_SUPERVISOR_DRY_RUN=true\`
- \`SOS_RUNTIME_LOOP_DRY_RUN=true\`
- \`SOS_AIOS_MAX_CYCLES=1\`

Do not override these to enable LIVE without founder approval.

## Alternative

Use systemd (\`aios.service\`) instead of or alongside PM2 — prefer one primary process manager for the live-runtime entrypoint.
`;
}
