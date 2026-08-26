/**
 * Firewall / UFW + Fail2Ban guide.
 * AGENT #114
 */
export function buildFirewallGuide(): string {
  return `# Firewall Configuration

## UFW baseline

\`\`\`bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
\`\`\`

Do **not** expose Node/PM2 ports publicly if Nginx proxies them.

## Fail2Ban (recommended)

\`\`\`bash
sudo apt install -y fail2ban
sudo systemctl enable --now fail2ban
\`\`\`

Minimal jail for SSH (\`/etc/fail2ban/jail.local\`):

\`\`\`ini
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 5
bantime = 1h
\`\`\`

\`\`\`bash
sudo systemctl restart fail2ban
sudo fail2ban-client status sshd
\`\`\`

## Ops notes

- Prefer SSH keys; disable password auth when keys are confirmed.
- Restrict Telegram control via \`SOS_TELEGRAM_ALLOWED_USER_IDS\` in \`.env\`.
- Firewall changes are independent of LIVE mode — keep \`SOS_AIOS_LIVE=0\`.
`;
}
