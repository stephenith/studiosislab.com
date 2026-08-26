# Cost Ledger V1

Canonical financial authority scaffold for AIOS.

**Agent #181 · Bookkeeping architecture only · NO BILLING · LIVE OFF**

## Ownership (declared)

| Actor | Role |
|-------|------|
| Execution Controller | Owns Cost Sessions (future — referenced, not wired) |
| Company Brain | Proposes budgets (future) |
| Departments | Receive budgets (Department SDK `cost_policy` — not modified) |
| Workers | Consume budgets (future) |
| Providers | Report usage (future) |

## Budget kinds

Mission · Department · Execution · Provider · Worker · Daily · Monthly · Emergency Reserve

All values informational (`informational: true`).

## Cost session

Immutable contract `cost-session-1.0.0`.

## Lifecycle

`CREATED → VALIDATED → APPROVED → RESERVED → READY → CLOSED`

## API (read-only)

- `GET /api/platform/cost-ledger`
- `GET /api/platform/cost-ledger/:session`
- `GET /api/platform/cost-ledger/budgets`

## Verify

```bash
npm run cost-ledger:verify
```
