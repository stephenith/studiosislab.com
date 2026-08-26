/**
 * Server preparation guide — Ubuntu 24.04 baseline.
 * AGENT #114
 */
export function buildServerPreparationGuide(): string {
  return `# Server Preparation

## Target host

| Item | Value |
|---|---|
| OS | Ubuntu 24.04 LTS |
| Node | 22 LTS |
| Process | PM2 and/or systemd |
| Proxy | Nginx |
| VCS | Git |
| Firewall | UFW |
| Intrusion | Fail2Ban (recommended) |
| SSL | Let's Encrypt (certbot) |
| App root | \`/opt/aios\` |
| App user | \`deploy\` (non-root) |

## First-boot steps

1. Create \`deploy\` user with sudo; disable password SSH root login.
2. \`apt update && apt upgrade -y\`
3. Install base tools:
   \`\`\`bash
   sudo apt install -y curl git ufw fail2ban nginx certbot python3-certbot-nginx
   \`\`\`
4. Install Node 22 LTS (NodeSource or nvm):
   \`\`\`bash
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt install -y nodejs
   node -v   # expect v22.x
   \`\`\`
5. Install PM2 globally (optional if using systemd only):
   \`\`\`bash
   sudo npm install -g pm2
   \`\`\`
6. Create app directory:
   \`\`\`bash
   sudo mkdir -p /opt/aios
   sudo chown deploy:deploy /opt/aios
   \`\`\`
7. Enable unattended security updates:
   \`\`\`bash
   sudo apt install -y unattended-upgrades
   sudo dpkg-reconfigure -plow unattended-upgrades
   \`\`\`

## Disk & permissions

- Prefer ≥160 GB SSD on recommended VPS (disk pressure is a known ops risk).
- Ensure \`SOS/07_LOGS\` is writable by \`deploy\`.
- Never run AI OS as root.

## Safety defaults

- \`SOS_AIOS_LIVE=0\`
- No LIVE enablement during preparation.
`;
}
