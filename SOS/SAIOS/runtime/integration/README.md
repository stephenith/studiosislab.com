# SAIOS Telegram Integration

Production founder intake for SAIOS via Telegram. Bridges existing legacy Telegram auth and notification pipeline — **no duplicate Telegram implementation**.

## Components

| File | Role |
|------|------|
| `TelegramBridge.ts` | Receive Telegram messages, route to SAIOS (no execution) |
| `FounderCommandParser.ts` | Telegram text → `FounderCommand` + intent |
| `FounderSession.ts` | Per-chat plan tracking and notification state |
| `SaiosGateway.ts` | Public API: submit, status, cancel, list running |
| `LegacyTelegramAdapter.ts` | Wraps `SOS/runtime` Telegram send + notification pipeline |

## Flow

```
Founder (Telegram)
      ↓
TelegramBridge
      ↓
SaiosGateway.submitFounderCommand()
      ↓
Executive Orchestrator → Execution Plan → Queue
      ↓
Runtime Loop → Cursor Runner
      ↓
SaiosGateway.notifyCompletedPlans() → Telegram completion
```

## Public API (`SaiosGateway`)

| Method | Purpose |
|--------|---------|
| `submitFounderCommand()` | Intake → orchestrator → queue |
| `getJobStatus()` | Single job status |
| `cancelJob()` | Cancel job + release worker |
| `listRunningJobs()` | Active jobs snapshot |
| `notifyCompletedPlans()` | Send completion via legacy notification pipeline |

## Verification

```bash
cd SOS/SAIOS/runtime && npm run telegram:verify
```

## Legacy reuse

- **Auth:** `loadConfig()` from `SOS/runtime/src/config.js`
- **Inbox replies:** `sendTelegramInboxReply`
- **Completions:** `sendLifecycleNotification` (respects `SOS_NOTIFICATION_MODE=mock`)

## Status

Production v1 — SAIOS execution backend for Telegram intake.
