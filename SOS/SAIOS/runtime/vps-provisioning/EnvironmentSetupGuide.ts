/**
 * Environment setup guide — reuses deployment-package .env.example.
 * AGENT #114
 */
export function buildEnvironmentSetupGuide(): string {
  return `# Environment Setup

## Source of truth

Reuse the Deployment Package template:

\`SOS/07_LOGS/saios/deployment-package/.env.example\`

Copy to:

\`SOS/runtime/.env\`

\`\`\`bash
cp SOS/07_LOGS/saios/deployment-package/.env.example SOS/runtime/.env
chmod 600 SOS/runtime/.env
\`\`\`

**Never commit** \`SOS/runtime/.env\`.

## Required variables

| Variable | Purpose |
|---|---|
| \`TELEGRAM_BOT_TOKEN\` | Commander Telegram bot |
| \`SOS_TELEGRAM_CHAT_ID\` | Founder/ops chat |

## Optional

| Variable | Purpose |
|---|---|
| \`SOS_TELEGRAM_ALLOWED_USER_IDS\` | Restrict Telegram control |
| \`RESEND_API_KEY\` | Email notifications |
| \`SOS_NOTIFY_TO\` / \`SOS_NOTIFY_FROM\` | Email routing |

## Safety flags (must remain off for first install)

\`\`\`
SOS_AIOS_LIVE=0
SOS_AIOS_NOTIFY_LIVE=0
SOS_SUPERVISOR_DRY_RUN=true
SOS_RUNTIME_LOOP_DRY_RUN=true
SOS_DISPATCH_DRY_RUN=true
SOS_AIOS_MAX_CYCLES=1
\`\`\`

## Host settings

\`\`\`
NODE_ENV=production
SOS_TIMEZONE=Asia/Kolkata
SOS_QUIET_HOURS_START=22:00
SOS_QUIET_HOURS_END=07:00
\`\`\`

## Validation

After fill:

\`\`\`bash
npm run deployment-package:verify
npm run live-runtime:verify
\`\`\`

LIVE must remain denied until founder approval.
`;
}
