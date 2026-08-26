# SOS Secrets Handling

> **Owner:** Commander (Stephen Pereira)  
> **Rule:** Never commit secrets to git. Never log tokens in JSONL or delivery logs.

---

## Secret inventory

| Secret | Storage | Used by |
|--------|---------|---------|
| `TELEGRAM_BOT_TOKEN` | `SOS/runtime/.env` | Telegram Bot API |
| `SOS_TELEGRAM_CHAT_ID` | `SOS/runtime/.env` | Telegram destination |
| `RESEND_API_KEY` | `SOS/runtime/.env` (or shell env) | Resend email API |

---

## Where secrets must NOT appear

- `SOS/07_LOGS/events/*.jsonl` — event `body` / `metadata`
- `SOS/07_LOGS/dispatch/*.jsonl` — delivery logs
- `SOS/09_REPORTS/` — daily reports
- Git commits
- Screenshots shared externally

`SOS/.gitignore` excludes `runtime/.env` and `07_LOGS/dispatch/*.jsonl`.

---

## Rotation procedure

### Telegram bot token compromised

1. Open @BotFather → `/revoke` on the bot
2. `/token` to issue a new token
3. Update `SOS/runtime/.env`
4. Run `npm run test:notify -- --telegram-only`
5. Record decision in `SOS/07_LOGS/decisions/`

### Resend API key compromised

1. Revoke key in [Resend dashboard](https://resend.com/api-keys)
2. Create new key; update `SOS/runtime/.env` and StudiosisLab deployment env if shared
3. Run `npm run test:notify -- --email-only`

### Chat ID changed (new phone / new group)

1. Re-run `getUpdates` per `NOTIFICATION_SETUP.md`
2. Update `SOS_TELEGRAM_CHAT_ID`

---

## Shared RESEND_API_KEY with product

The repository already uses Resend for e-sign and product email. SOS reuses the same API key but:

- Different **from** address (`SOS_NOTIFY_FROM`)
- Different **to** address (`SOS_NOTIFY_TO`)
- No import from `src/lib/mail/sendEmail.ts`

If you prefer isolation, create a separate Resend API key restricted to SOS sending only.

---

## Local machine security

- `SOS/runtime/.env` file permissions: `chmod 600 .env`
- Do not sync `.env` via iCloud to untrusted devices
- Use macOS Keychain or 1Password for backup of values (not the file itself in git)

---

## Production deployment (future)

Phase 2 runs locally on Commander's Mac. When a VPS or CI runner is added (Phase 5+), secrets move to:

- macOS `launchd` `EnvironmentVariables`
- Or host secret manager

Never embed secrets in `notify.config.json`.
