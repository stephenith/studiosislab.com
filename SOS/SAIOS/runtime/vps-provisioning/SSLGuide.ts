/**
 * SSL / Let's Encrypt guide.
 * AGENT #114
 */
export function buildSslGuide(): string {
  return `# SSL Configuration

## Provider

Let's Encrypt via \`certbot\` + Nginx plugin.

## Prerequisites

1. DNS A/AAAA records point to this VPS.
2. UFW allows 80 and 443.
3. Nginx site listening on port 80 for the hostname.

## Issue certificate

\`\`\`bash
sudo certbot --nginx -d aios.studiosis.in
\`\`\`

Or for apex + www:

\`\`\`bash
sudo certbot --nginx -d studiosis.in -d www.studiosis.in
\`\`\`

## Auto-renewal

Certbot installs a systemd timer. Verify:

\`\`\`bash
sudo systemctl status certbot.timer
sudo certbot renew --dry-run
\`\`\`

## Hardening tips

- Prefer TLS 1.2+
- Redirect HTTP → HTTPS
- Keep private keys root-readable only (\`/etc/letsencrypt/live/...\`)

## Notes

- SSL is required for production website traffic.
- SSL does **not** authorize LIVE mode.
`;
}
