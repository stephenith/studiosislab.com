# Live Monitoring & Commander Bridge (AI OS)

**Agent #107** — Connects AI OS departments to the existing Commander notification pipeline.

## Rules

- **Reuse** `SOS/runtime` (`sendLifecycleNotification` / `sendTelegram`)
- **Do not** create another Telegram bot, email service, ledger, or dispatcher
- **Verify is always dry-run**

## Safe mode

```bash
# dry-run (default)
npm run live-monitoring:verify

# live (explicit opt-in only)
SOS_AIOS_NOTIFY_LIVE=1 npx --yes tsx -e "import('./SOS/SAIOS/runtime/live-monitoring/index.ts').then(m => m.runLiveMonitoring({ forceDryRun: false }))"
```

## Flow

```
Security / Website / Timeline / Runtime
        ↓ publish (adapters read logs only)
Event Bus
        ↓ subscribe
NotificationSubscriber
        ↓
NotificationLiveBridge
        ↓ (if SOS_AIOS_NOTIFY_LIVE=1)
SOS/runtime sendLifecycleNotification → Telegram
```

## Outputs

`SOS/07_LOGS/saios/live-monitoring/`

- `live-monitoring.json`
- `bridge-status.json`
- `publisher-status.json`
- `subscriber-status.json`
- `notification-flow.json`
- `live-monitoring-report.md`
