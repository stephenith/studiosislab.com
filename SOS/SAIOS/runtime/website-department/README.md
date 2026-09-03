# Website Department — Phase 1 Core Revival

**Identity:** `run_id` (not an AIOS Agent number)
**Role:** Detect-only website health monitoring
**Status:** Core repaired; department remains **disabled** until Founder enablement

## Mission

Verify StudiosisLab’s user-facing frontend surfaces with truthful evidence:

- Critical route registry (source + URL path distinction)
- Static source evidence for gallery / SEO / editor / catalog / sitemap / robots
- Alert payloads for downstream Notification Department

Does **not** generate resumes, publish templates, send notifications, run browser automation, or mutate the public site.

## Safety (Phase 1)

- Operational execution **fail-closed** while `operations.website_department.enabled !== true`
- Verification-only path allowed while disabled only when: `static`, no network, `persist: false`, no project-state write, no production evidence write
- No Agent `#100` coupling; no `latest_agent` / `next_agent` mutation
- July 8 production evidence under `SOS/07_LOGS/saios/website-department/` must remain untouched

## Usage

```bash
# Safe verification-only (default while disabled)
npx tsx SOS/SAIOS/runtime/website-department/verify.ts

# Full Phase 1 offline proof suite (temp dirs only)
npx tsx SOS/SAIOS/runtime/website-department/verify-phase1-core.ts
```

Do **not** run live HTTP / Playwright / production persist in this phase.

## Outputs (future approved persisted runs)

Injectable `output_root` with:

- `runs/<run_id>/` — immutable per-run evidence
- `latest/` — current projection for consumers

## Status values

`HEALTHY` · `DEGRADED` · `DOWN` · `BLOCKED`

## Coverage honesty

| Area | Phase 1 |
|------|---------|
| Browser | `NOT_RUN` |
| Auth behaviour | `NOT_RUN` (routes marked `auth_required` only) |
| Mobile viewport | `static_evidence_only` / `NOT_RUN` |
| Download execution | `static_evidence_only` / `NOT_RUN` |
| Live HTTP | not executed in verification-only |

## Alerts

Alert payloads are generated for downstream Notification Department delivery.  
This module never sends Telegram/email/Slack itself.
