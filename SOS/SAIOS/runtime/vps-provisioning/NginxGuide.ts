/**
 * Nginx reverse-proxy guide.
 * AGENT #114
 */
export function buildNginxGuide(): string {
  return `# Nginx Configuration

## Role

Nginx terminates TLS and reverse-proxies the website / health surfaces. AI OS process managers (PM2/systemd) stay behind the proxy.

## Example site

\`/etc/nginx/sites-available/aios\`

\`\`\`nginx
server {
    listen 80;
    server_name aios.studiosis.in;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name aios.studiosis.in;

    # SSL paths filled by certbot — see ssl-configuration.md

    location /health {
        proxy_pass http://127.0.0.1:3000/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
\`\`\`

## Enable

\`\`\`bash
sudo ln -sf /etc/nginx/sites-available/aios /etc/nginx/sites-enabled/aios
sudo nginx -t
sudo systemctl reload nginx
\`\`\`

## Health asset reference

See Deployment Package:

- \`SOS/07_LOGS/saios/deployment-package/healthcheck.js\`
- \`SOS/07_LOGS/saios/deployment-package/health-endpoint-spec.md\`

## Safety

Nginx config does not set \`SOS_AIOS_LIVE\`. Keep LIVE off until founder approval.
`;
}
