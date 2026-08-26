/**
 * systemd unit guide — reuses deployment-package aios.service.
 * AGENT #114
 */
export function buildSystemdGuide(): string {
  return `# systemd Configuration

## Asset (reuse)

\`SOS/07_LOGS/saios/deployment-package/aios.service\`

Defaults:

- User: \`deploy\`
- WorkingDirectory: \`/opt/aios\`
- \`SOS_AIOS_LIVE=0\`
- ExecStart: \`npm run live-runtime:verify\`
- EnvironmentFile: \`SOS/runtime/.env\`

## Install

\`\`\`bash
sudo cp SOS/07_LOGS/saios/deployment-package/aios.service /etc/systemd/system/aios.service
sudo systemctl daemon-reload
sudo systemctl enable aios
sudo systemctl start aios
sudo systemctl status aios
\`\`\`

## Logs

\`\`\`bash
journalctl -u aios -f
\`\`\`

## Stop / restart

\`\`\`bash
sudo systemctl restart aios
sudo systemctl stop aios
\`\`\`

## Safety

The unit intentionally runs **verify**, not LIVE. Changing ExecStart or \`SOS_AIOS_LIVE\` requires explicit founder approval after smoke tests pass.
`;
}
