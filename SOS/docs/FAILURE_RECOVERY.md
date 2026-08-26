# SOS Notification Failure Recovery

> **Phase 2** — file-based retry and dead-letter queues

---

## Architecture

```
events/*.jsonl → dispatcher → Telegram / Resend
                    ↓ fail
              retry.jsonl (exponential backoff, max 5)
                    ↓ exhausted
              dead-letter.jsonl
```

Delivery audit: `dispatch/delivery-YYYY-MM-DD.jsonl`  
Idempotency: `dispatch/_sent.jsonl`  
Circuit breaker state: `dispatch/circuit-breaker.json`  
Quiet-hours queue: `dispatch/queued.jsonl`  
Malformed events: `dispatch/malformed.jsonl`

---

## Retry policy

| Setting | Default | Config |
|---------|---------|--------|
| Max attempts | 5 | `notify.config.json` → `retry.max_attempts` |
| Base delay | 60s | `retry.base_delay_ms` |
| Max delay | 16 min | `retry.max_delay_ms` |
| Backoff | Exponential (2^n) | automatic |

**Process retries:**

```bash
cd SOS/runtime
npm run dispatch:retry
```

Run on a schedule (e.g. every 5 minutes) alongside `npm run dispatch`.

---

## Dead letter queue

After 5 failed delivery attempts, the event is written to:

`SOS/07_LOGS/dispatch/dead-letter.jsonl`

Each entry includes `final_error`, `channel`, and the full `event` envelope.

### Recovery steps

1. Read the dead-letter entry and fix root cause (token, domain, network)
2. Copy the `event` object into a new line in `events/YYYY-MM-DD.jsonl` with a **new** `event_id` (or delete the matching `_sent.jsonl` row if intentionally re-sending — not recommended)
3. Run `npm run dispatch`
4. Emit a P1 `info` event documenting the incident

---

## Circuit breaker

After **5 delivery failures within 10 minutes**, outbound dispatch pauses for all priorities **except P0**.

| State | Behavior |
|-------|----------|
| Closed | Normal dispatch |
| Open | P1+ skipped with `circuit breaker open` in delivery log |
| Recovery | Automatic when failures age out of 10 min window, or delete `circuit-breaker.json` after fixing cause |

---

## Quiet hours

Default: **22:00 – 07:00** local (`SOS_TIMEZONE`).

| Priority | During quiet hours |
|----------|-------------------|
| P0 | Telegram + email still deliver |
| P1+ | Queued to `queued.jsonl`; process after quiet hours ends |

**Morning catch-up:** After 07:00, run dispatch on `queued.jsonl` entries manually (Phase 3 adds automated flush). For Phase 2, re-append queued events to today's events file or run a one-off dispatch after copying events.

---

## Common errors

### Telegram: `Unauthorized` (401)

- Token revoked or wrong — regenerate via BotFather

### Telegram: `Bad Request: chat not found` (400)

- User has not `/start`ed the bot
- Wrong `SOS_TELEGRAM_CHAT_ID` (string vs number — use numeric id)

### Telegram: `Too Many Requests` (429)

- Back off; run `dispatch:retry` later
- Reduce P1 event volume

### Resend: domain not verified

- Verify `studiosis.in` (or your domain) in Resend
- Ensure `SOS_NOTIFY_FROM` uses verified domain

### Resend: `RESEND_API_KEY is not configured`

- Add key to `SOS/runtime/.env`

### Event validation failed → `malformed.jsonl`

- Fix event per `EVENT_SCHEMA.md`
- Do not dispatch malformed lines

---

## Manual reset (last resort)

```bash
# After fixing credentials — clears retry queue only
: > ../07_LOGS/dispatch/retry.jsonl

# Reset circuit breaker
rm -f ../07_LOGS/dispatch/circuit-breaker.json
```

**Do not delete** `dead-letter.jsonl` without archiving — it is the audit trail for missed alerts.

---

## Escalation

If dead-letter grows while Commander is away:

1. P0 events should still pierce circuit breaker — verify Telegram works with `test:notify`
2. Check `delivery-*.jsonl` for last successful send timestamp
3. On return, review `dead-letter.jsonl` and `queued.jsonl` in morning standup §3
