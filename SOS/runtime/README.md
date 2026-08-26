# SOS Notification + PM Runtime

Isolated Node.js tooling for SOS. **Not part of the Next.js app.**

## Quick start

```bash
cd SOS/runtime
cp .env.example .env   # Telegram, Resend, SOS_NOTIFY_TO
npm install
npm run pm:run         # continuous PM loop
```

## Developer commands

| Script | Description |
|--------|-------------|
| `npm run developer:run` | Continuous worker — watches PM briefs |
| `npm run developer:run -- --once` | Single iteration |
| `npm run developer:run -- --dry-run` | Plan + report without src patches |
| `npm run developer:status` | Heartbeat + current task |
| `npm run developer:reset` | Clear developer state |

State: `SOS/07_LOGS/developer/`

## QA commands

| Script | Description |
|--------|-------------|
| `npm run qa:run` | Continuous QA worker — watches PM QA briefs |
| `npm run qa:run -- --once` | Single iteration |
| `npm run qa:status` | Heartbeat + current task |
| `npm run qa:reset` | Clear QA state |

State: `SOS/07_LOGS/qa/`

## Commander approval loop

| Script | Description |
|--------|-------------|
| `npm run approvals:listen` | Watch inbox for CCP decision files |
| `npm run approvals:listen -- --once` | Process inbox once |
| `npm run approvals:status` | Listener heartbeat + approval records |
| `npm run approvals:test` | Local simulation (drop decision → resume PM) |

Drop a decision file in `SOS/07_LOGS/approvals/inbox/`:

```json
{ "approval_id": "APP-YYYYMMDD-001", "command": "APPROVE A" }
```

Or `APP-YYYYMMDD-001.txt` containing `APPROVE A`.

State: `SOS/07_LOGS/approvals/`

## Project Manager commands

| Script | Description |
|--------|-------------|
| `npm run pm:run` | Continuous coordination loop |
| `npm run pm:run -- --once` | Single iteration (testing) |
| `npm run pm:status` | JSON status snapshot |
| `npm run pm:approve -- APP-... APPROVE A` | Record Commander approval |
| `npm run pm:complete-dev -- TASK-...` | Developer handoff (report JSON) |
| `npm run pm:complete-qa -- TASK-... pass` | QA handoff |

## Notification commands

| Script | Description |
|--------|-------------|
| `npm run dispatch` | Process today's events |
| `npm run test:notify` | Test Telegram + email |

## PM architecture

```
SOS/runtime/src/pm/
  loop.ts          — execution loop
  readers.ts       — backlog, knowledge, standup
  cde.ts           — Commander Decision Engine rules
  ccp.ts           — CCP approval packets
  agents.ts        — Developer/QA queue handoff
  approvals.ts     — CCP submit + wait
  state.ts         — persistent PM state
```

State lives in `SOS/07_LOGS/pm/`.

## Agent handoff

1. PM writes brief to `SOS/07_LOGS/pm/briefs/developer/{task_id}.md`
2. Developer (Cursor agent or human) implements and writes `reports/developer/{task_id}.json`
3. PM reviews → QA if CDE requires → optional CCP approval → close

## Environment

| Variable | Purpose |
|----------|---------|
| `SOS_PM_POLL_MS` | Loop poll interval (default 5000) |
| `SOS_DISPATCH_DRY_RUN` | Skip outbound notifications |
| `TELEGRAM_BOT_TOKEN` | Instant alerts |
| `RESEND_API_KEY` | Approval email |

Full setup: `SOS/docs/NOTIFICATION_SETUP.md`
