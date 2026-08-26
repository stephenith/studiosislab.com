# SOS Environment Variables

> **Scope:** `SOS/runtime/` notification dispatcher only  
> **File:** Copy `SOS/runtime/.env.example` → `SOS/runtime/.env`

---

## Required for production dispatch

| Variable | Description | Example |
|----------|-------------|---------|
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather | `7123456789:AAH...` |
| `SOS_TELEGRAM_CHAT_ID` | Your Telegram chat id (numeric) | `123456789` |
| `RESEND_API_KEY` | Resend API key (shared with StudiosisLab product email) | `re_...` |
| `SOS_NOTIFY_TO` | Commander email for SOS alerts | `stephen@studiosis.in` |

---

## Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `SOS_NOTIFY_FROM` | `SOS <notifications@studiosis.in>` | Resend sender (must be verified domain) |
| `SOS_TIMEZONE` | `America/Los_Angeles` | IANA timezone for quiet hours |
| `SOS_QUIET_HOURS_START` | `22:00` | Quiet hours start (24h, local) |
| `SOS_QUIET_HOURS_END` | `07:00` | Quiet hours end (24h, local) |
| `SOS_DISPATCH_DRY_RUN` | `false` | If `true`, log deliveries without sending |

---

## StudiosisLab product email (not SOS)

These are used by `src/lib/mail/sendEmail.ts` — **do not change for SOS**:

| Variable | Used by |
|----------|---------|
| `RESEND_API_KEY` | Shared — same key for SOS and product |
| Product `from` | Hardcoded `StudiosisLab <business@studiosis.in>` in `src/` |

SOS uses `SOS_NOTIFY_FROM` and `SOS_NOTIFY_TO` to keep operational alerts separate from product transactional email.

---

## Configuration file (non-secret)

`SOS/runtime/notify.config.json` holds retry limits, circuit breaker thresholds, and channel routing. Edit in git; no secrets.

---

## Loading order

1. `SOS/runtime/.env` (via `load-env.ts` in CLI)
2. Existing `process.env` values take precedence over `.env` file
3. `notify.config.json` for structural defaults
4. Env vars override `notify.config.json` for timezone and quiet hours

---

## Verification

```bash
cd SOS/runtime
npm run test:notify -- --dry-run    # config load only
npm run test:notify                 # live send
```
