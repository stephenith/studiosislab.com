# First Supervised Production Run — Local Operations Runbook

Agent #230 · StudiosisLab AIOS Resume Factory  
Repository-specific. LIVE OFF. Publication disabled. Founder approval required.

---

## 1. Required software and environment

- macOS (local Founder machine)
- Node.js 20+ (repo uses npm + `tsx`)
- Git clone of `studiosislab` at this workspace root
- Optional for **real** generation: `OPENAI_API_KEY` and `SOS_AI_FOUNDER_OPENAI_ONE_TEST=1` in `.env.local`
- Simulation (mock) works without OpenAI credentials

## 2. Install dependencies (only if required)

From repository root:

```bash
npm install
npm install --prefix SOS/SAIOS/dashboard
```

## 3. Verify environment readiness

```bash
npm run aios:production-bootstrap:verify
npm run aios:supervised-run:verify
npm run system-integrity:verify
```

Bootstrap readiness must be **READY**. Supervised verify may report preflight **BLOCKED** if the Founder Review queue exceeds Budget capacity (currently common when many `WAITING_FOUNDER` resume templates exist). That is expected until the queue is cleared.

## 4. Start Mission Control (exact command)

From repository root:

```bash
npm run aios-dashboard:dev
```

This runs `SOS/SAIOS/dashboard/server.ts` (Vite + Founder APIs) as **one process**.

## 5. Mission Control URL

**http://127.0.0.1:4310**

Port override: `AIOS_DASHBOARD_PORT` (default `4310`).

## 6. Separate worker / orchestrator process

**Not required for the supervised run.**

Production executes inside the Mission Control Node process when Founder approves (via Founder Action Adapter → System Orchestrator → `ProductionController.runProduction`).

Optional CLI (not used by the MC button; same owner):

```bash
npm run aios:controller:run -- --size 5 --mock
```

## 7. Separate terminals?

| Process | Terminal |
|---------|----------|
| Mission Control (`aios-dashboard:dev`) | **Yes — keep one terminal open** |
| Browser to MC | Optional after start |
| Extra worker | **No** |

## 8. Founder action to start the batch

1. Open **http://127.0.0.1:4310**
2. Scroll to **First Supervised Production Run**
3. Click **Prepare Batch** (optional but recommended)
4. Review templates (5), roles, estimated calls/cost, concurrency 1, publication disabled, LIVE OFF
5. Choose **Simulation (mock)** or uncheck for real provider (only if credentials + one-test flag are set)
6. Click **START FIRST SUPERVISED RUN** and confirm the dialog

## 9. Verify the run is progressing

- Panel **Status** moves: `PENDING_APPROVAL` → `VALIDATING` → `QUEUED` → `RUNNING` → `AWAITING_FOUNDER_REVIEW` (or `BLOCKED` / `FAILED` / `PARTIALLY_COMPLETED`)
- Progress shows completed/requested
- Report file updates (see §13)

## 10. Exact panel to monitor

Mission Control home → section **First Supervised Production Run**

## 11. Founder Review location

- UI: Mission Control → nav **Founder Review** (`http://127.0.0.1:4310/#review`)
- Artifacts: candidate dirs under `SOS/07_LOGS/saios/first-production-cycle/candidates/` with status `WAITING_FOUNDER`

## 12. Generated-template location

```
SOS/07_LOGS/saios/first-production-cycle/candidates/
```

Isolated from public catalogue (`src/data/template-json/`). **Do not publish.**

## 13. Reports and logs

| Artifact | Path |
|----------|------|
| Supervised run report | `SOS/07_LOGS/saios/supervised-production-runner/first-supervised-production-run-report.json` |
| Immutable history | `SOS/07_LOGS/saios/supervised-production-runner/history/` |
| Verify log | `SOS/07_LOGS/saios/supervised-production-runner/supervised-production-runner-verify.json` |
| Controller executions | `SOS/07_LOGS/saios/first-production-cycle/executions/` |
| Orchestrator | `SOS/07_LOGS/saios/system-orchestrator/` |
| FAA audits | `SOS/07_LOGS/saios/founder-action-adapters/` |

## 14. Cancel safely

In the **First Supervised Production Run** panel click **Cancel** (delegates to System Orchestrator `coordinateCancel`).  
Does not publish. Does not enable LIVE. In-flight `runProduction` may finish its current cycle before idle.

## 15. If internet disconnects

- **Simulation (mock):** usually continues (local only).
- **Real OpenAI:** provider calls fail; run may `FAILED` / partial. Reconnect, then prepare a **new** run only after prior status is terminal (do not duplicate while `RUNNING`).

## 16. If the laptop sleeps

**The run stops.** The Node process suspends; HTTP/provider calls fail. Keep the Mac awake for overnight.

## 17. If Cursor closes

**OK** if Mission Control was started in a standalone terminal (`npm run aios-dashboard:dev`). Cursor is not required.

## 18. If the Mission Control terminal closes

**The dashboard process dies.** Any in-flight supervised production in that process stops. Restart MC (§4), inspect report status (§13), then prepare/start only if not already `RUNNING`.

## 19. Automatic resume after restart?

**No.** There is no daemon, LaunchAgent, or cron for this runner. Status is restored from the report file for display only; Founder must explicitly start again if incomplete.

## 20. Restart safely without duplicating the batch

1. Read `first-supervised-production-run-report.json`
2. If status is `RUNNING` / `QUEUED` / `VALIDATING` — do **not** start another batch; restart MC and wait or Cancel
3. If terminal (`COMPLETED` / `AWAITING_FOUNDER_REVIEW` / `FAILED` / `CANCELLED` / `BLOCKED` / `PARTIALLY_COMPLETED`) — Founder may Prepare + Start a new supervised run

## 21. What to check the following morning

- Panel final status and progress (target: 5 completed → `AWAITING_FOUNDER_REVIEW`)
- Founder Review queue for new resume templates
- Report `templates_completed` / `errors` / `warnings`
- Confirm `live: false` and `publication_allowed: false`
- Budget/Health results in the panel

## 22. Concise overnight checklist

- [ ] Mac plugged in, sleep disabled (or long sleep timer)
- [ ] Internet connected (required for real OpenAI; optional for mock)
- [ ] `.env.local` configured if using real provider
- [ ] `npm run aios-dashboard:dev` running in a dedicated terminal
- [ ] Browser open to http://127.0.0.1:4310 (optional after start)
- [ ] Bootstrap READY; Budget allows (Founder queue under capacity)
- [ ] Prepare Batch → review cost/roles → **START FIRST SUPERVISED RUN**
- [ ] Confirm status reaches `RUNNING` before leaving
- [ ] Morning: Founder Review + report (do not publish)

---

## Overnight laptop requirements (summary)

| Requirement | Answer |
|-------------|--------|
| Mac powered on | **Yes** |
| Mac awake | **Yes** |
| Terminal open (MC) | **Yes** |
| Cursor open | **No** (if MC in external terminal) |
| Browser open | **No** (after Founder starts) |
| Internet | **Yes** for real provider; **No** for mock |
| Persistent daemon | **No** — do not install one |

## Known local blocker

If Budget Governor reports founder queue ≥ capacity (`DEFAULT_QUEUE_MAX` = 20), preflight **BLOCKED**. Clear or decide existing `WAITING_FOUNDER` resume templates in Founder Review before starting.
