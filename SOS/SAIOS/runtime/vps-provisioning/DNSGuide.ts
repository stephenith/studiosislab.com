/**
 * DNS configuration guide.
 * AGENT #114
 */
export function buildDnsGuide(): string {
  return `# DNS Configuration

## Recommended records

Point the production hostname at the VPS public IPv4 (and IPv6 if used).

| Type | Name | Value | TTL |
|---|---|---|---|
| A | \`@\` or \`app\` / \`aios\` | VPS IPv4 | 300 |
| AAAA | same | VPS IPv6 (optional) | 300 |
| CNAME | \`www\` | apex or app hostname | 300 |

Example hostnames:

- \`studiosis.in\` (website)
- \`aios.studiosis.in\` (AI OS health / ops surface if separated)

## Propagation checklist

1. Create records at DNS provider.
2. Wait for propagation (\`dig +short aios.studiosis.in\`).
3. Confirm VPS firewall allows 80/443 before requesting certificates.
4. Only then run certbot (see SSL guide).

## Notes

- Keep TTL low (300s) during first cutover.
- Do not expose SSH on a public hostname unless intentional; prefer IP + key auth.
- DNS alone does not enable LIVE mode.
`;
}
