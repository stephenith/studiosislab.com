# Founder Decisions

Immutable founder APPROVE / REJECT / REQUEST CHANGES workflow for AIOS dry-run reviews.

- No publication
- No LIVE
- No OpenAI
- Actual pending dry-run review is decided only by Stephen via the dashboard

## Usage

```ts
import { FounderDecisionManager } from "./FounderDecisionManager.js";

const mgr = new FounderDecisionManager();
mgr.recordDecision({
  review_id: "...",
  task_id: "...",
  cycle_id: "...",
  decision: "APPROVED",
  reason: "Planning quality acceptable for dry-run",
});
```

Fixtures: set `fixture: true` — stored under `fixtures/` and never written to Learning Knowledge.
