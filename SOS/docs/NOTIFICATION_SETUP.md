# SOS Notification Setup

> **Phase:** 2 — Telegram + Resend dispatcher  
> **Runtime:** `SOS/runtime/` (isolated from StudiosisLab `src/`)

---

## Overview

The SOS notification layer reads P0/P1 events from `SOS/07_LOGS/events/`, delivers instant alerts via **Telegram**, sends **P0 email** via **Resend**, and logs all delivery attempts under `SOS/07_LOGS/dispatch/`.

StudiosisLab application code is **not** modified. Product email (`src/lib/mail/sendEmail.ts`) and SOS email share `RESEND_API_KEY` but use different `from` / `to` addresses.

---

## 1. Create a Telegram Bot

1. Open Telegram and search for **@BotFather**
2. Send `/newbot`
3. Choose a display name (e.g. `Studiosis SOS`)
4. Choose a username ending in `bot` (e.g. `studiosis_sos_bot`)
5. BotFather replies with an **HTTP API token** — this is `TELEGRAM_BOT_TOKEN`

**Security:** Treat the token like a password. Never commit it. Store only in `SOS/runtime/.env` (gitignored).

---

## 2. Obtain your Chat ID

The bot must know where to send messages (your personal chat or a private group).

### Option A — Personal chat (recommended)

1. Open your new bot in Telegram and tap **Start** (send any message)
2. On your Mac, run (replace `YOUR_BOT_TOKEN`):

```bash
curl -s "https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates" | python3 -m json.tool
```

3. Find `"chat":{"id":123456789` in the response — that number is `SOS_TELEGRAM_CHAT_ID`

### Option B — @userinfobot

1. Forward a message from your bot chat to **@userinfobot**
2. It returns your user id (use as chat id for direct messages)

### Option C — Private group

1. Add the bot to a private group
2. Send a message in the group
3. Call `getUpdates` as above; use the **negative** group chat id

---

## 3. Configure environment variables

```bash
cd SOS/runtime
cp .env.example .env
# Edit .env with your values
```

See `SOS/docs/ENV.md` for the full variable reference.

**Minimum for instant alerts:**

| Variable | Required |
|----------|----------|
| `TELEGRAM_BOT_TOKEN` | Yes (Telegram) |
| `SOS_TELEGRAM_CHAT_ID` | Yes (Telegram) |
| `RESEND_API_KEY` | Yes (P0 email) |
| `SOS_NOTIFY_TO` | Yes (P0 email) |

---

## 4. Install and run

```bash
cd SOS/runtime
npm install
npm run test:notify          # live test (Telegram + email)
npm run test:notify -- --dry-run   # no outbound sends
npm run dispatch             # process today's events
npm run dispatch:retry       # process due retry queue
```

### Dispatch options

```bash
npm run dispatch -- --date 2026-06-23
npm run dispatch -- --file ../07_LOGS/events/2026-06-23.jsonl
npm run dispatch -- --dry-run
```

---

## 5. Local testing procedure

### Step 1 — Dry run (no credentials needed for validation path)

```bash
cd SOS/runtime
SOS_DISPATCH_DRY_RUN=true npm run test:notify -- --dry-run
```

### Step 2 — Telegram only

```bash
npm run test:notify -- --telegram-only
```

Confirm message on iPhone within seconds.

### Step 3 — Email only

```bash
npm run test:notify -- --email-only
```

Confirm inbox delivery from `SOS_NOTIFY_FROM`.

### Step 4 — End-to-end event

Append a P1 test event to today's JSONL:

```bash
DATE=$(date +%Y-%m-%d)
cat >> ../07_LOGS/events/${DATE}.jsonl << 'EOF'
{"event_id":"00000000-0000-4000-8000-000000000001","timestamp":"2026-06-23T12:00:00-07:00","tenant_id":"studiosis","repo_id":"studiosislab","agent":"system","type":"info","priority":"P1","title":"Dispatch integration test","body":"Phase 2 smoke test.","correlation_id":"00000000-0000-4000-8000-000000000002","requires_approval":false,"approval_status":"not_required"}
EOF
npm run dispatch -- --file ../07_LOGS/events/${DATE}.jsonl
```

Check `SOS/07_LOGS/dispatch/delivery-*.jsonl` for `status: "sent"`.

---

## 6. Failure recovery

See `SOS/docs/FAILURE_RECOVERY.md`.

Quick reference:

| Symptom | Action |
|---------|--------|
| Telegram 401 | Regenerate token via BotFather; update `.env` |
| Telegram 400 chat not found | Send `/start` to bot; verify `SOS_TELEGRAM_CHAT_ID` |
| Resend 403 | Verify domain in Resend dashboard; check `SOS_NOTIFY_FROM` |
| Events not sending | Confirm priority P0/P1; check `delivery-*.jsonl` |
| Repeated failures | Run `npm run dispatch:retry`; inspect `dead-letter.jsonl` |
| Circuit breaker open | Fix root cause; delete `circuit-breaker.json` or wait 10 min |

---

## 7. Scheduling (manual Phase 2)

Phase 2 does **not** ship cron or GitHub Actions. On your Mac:

```bash
# Example: every 5 minutes while away
*/5 * * * * cd /path/to/studiosislab/SOS/runtime && npm run dispatch && npm run dispatch:retry
```

Use `launchd` on macOS for persistence. Phase 5 adds automated scheduling.

---

## Related documents

| Document | Path |
|----------|------|
| Environment variables | `SOS/docs/ENV.md` |
| Secrets handling | `SOS/docs/SECRETS.md` |
| Failure recovery | `SOS/docs/FAILURE_RECOVERY.md` |
| Notification policy | `SOS/02_RULES/NOTIFICATION_POLICY.md` |
| Runtime README | `SOS/runtime/README.md` |
