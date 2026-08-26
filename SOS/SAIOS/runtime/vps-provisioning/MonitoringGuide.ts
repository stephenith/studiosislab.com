/**
 * Monitoring strategy guide.
 * AGENT #114
 */
export function buildMonitoringGuide(): string {
  return `# Monitoring Strategy

## Layers

1. **Process** — PM2 status / systemd \`aios\` active
2. **Health** — \`node SOS/07_LOGS/saios/deployment-package/healthcheck.js\`
3. **AI OS departments** — live-monitoring, security, founder control center reports under \`SOS/07_LOGS/saios/\`
4. **Host** — disk, RAM, CPU (\`df -h\`, \`free -m\`, \`uptime\`)
5. **Alerts** — Notification Department dry-run by default; Telegram bridge only when configured and still non-LIVE

## Recommended cadence (first week)

| Check | Frequency |
|---|---|
| \`pm2 status\` / \`systemctl status aios\` | hourly (or on-call) |
| Disk free (\`df -h\`) | daily — Security ORANGE risk |
| Healthcheck script | every 5–15 min (cron) |
| \`npm run founder-control-center:verify\` | daily |
| Backup success | after each scheduled backup |

## Example health cron

\`\`\`cron
*/10 * * * * deploy cd /opt/aios && node SOS/07_LOGS/saios/deployment-package/healthcheck.js >> SOS/07_LOGS/saios/vps-provisioning/health-cron.log 2>&1
\`\`\`

## Escalation

1. Process down → restart PM2/systemd
2. Disk > 80% → rotate logs + free space before any LIVE consideration
3. Gate failures → stay in VERIFY/DRY_RUN; notify founder
4. Never auto-enable \`SOS_AIOS_LIVE=1\`

## Related reports

- Live Monitoring: \`SOS/07_LOGS/saios/live-monitoring/\`
- Security: \`SOS/07_LOGS/saios/security-department/\`
- Founder HQ: \`SOS/07_LOGS/saios/founder-control-center/\`
`;
}
