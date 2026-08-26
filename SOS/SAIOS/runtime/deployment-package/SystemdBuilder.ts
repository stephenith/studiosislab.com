/**
 * systemd unit builder.
 */
export function buildSystemdService(): string {
  return `# AI OS systemd unit — Agent #112
# Assumptions: Ubuntu 24.04 · Node 22 · user deploy
# Install: copy to /etc/systemd/system/aios.service then systemctl enable --now aios
[Unit]
Description=AI OS Live Runtime (StudiosisLab)
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=deploy
WorkingDirectory=/opt/aios
Environment=NODE_ENV=production
Environment=SOS_AIOS_LIVE=0
Environment=SOS_SUPERVISOR_DRY_RUN=true
Environment=SOS_RUNTIME_LOOP_DRY_RUN=true
EnvironmentFile=-/opt/aios/SOS/runtime/.env
ExecStart=/usr/bin/npm run live-runtime:verify
Restart=on-failure
RestartSec=10
TimeoutStartSec=60
TimeoutStopSec=30
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
`;
}
