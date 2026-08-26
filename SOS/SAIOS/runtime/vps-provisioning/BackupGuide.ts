/**
 * Backup strategy guide — reuses deployment-package scripts.
 * AGENT #114
 */
export function buildBackupGuide(): string {
  return `# Backup Strategy

## Assets (reuse)

| Script | Path |
|---|---|
| Backup | \`SOS/07_LOGS/saios/deployment-package/backup.sh\` |
| Restore | \`SOS/07_LOGS/saios/deployment-package/restore.sh\` |
| Log rotation | \`SOS/07_LOGS/saios/deployment-package/rotate-logs.sh\` |

## What to back up

- \`SOS/runtime/.env\` (secrets — store offline / encrypted)
- \`SOS/07_LOGS/\` (ops + publication logs)
- \`SOS/project-state.json\`
- Publication / release snapshots under SAIOS logs
- Website static publish artifacts if present

## Schedule (recommended)

\`\`\`cron
0 2 * * * deploy cd /opt/aios && bash SOS/07_LOGS/saios/deployment-package/backup.sh
0 3 * * 0 deploy cd /opt/aios && bash SOS/07_LOGS/saios/deployment-package/rotate-logs.sh
\`\`\`

## Off-host copies

Copy backup tarballs to object storage or a second region weekly. Keep at least 7 daily + 4 weekly.

## Automatic log rotation

Use \`rotate-logs.sh\` plus optional \`logrotate\` for Nginx/journald. Disk pressure is a known MEDIUM risk (Security ORANGE).

## Verify restore monthly

\`\`\`bash
bash SOS/07_LOGS/saios/deployment-package/restore.sh <backup-archive>
\`\`\`

Restore drills must keep \`SOS_AIOS_LIVE=0\`.
`;
}
