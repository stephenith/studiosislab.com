# Website Department — Phase 2A (pre-activation)

**Identity:** `run_id` (not an AIOS Agent number)
**Role:** Detect-only website health monitoring
**Status:** Phase 1 LOCAL_VERIFIED + Phase 2A repairs; department remains **disabled**

## Mission

Verify StudiosisLab’s user-facing frontend surfaces with truthful evidence:

- Critical route registry (source + URL path distinction)
- Static source evidence for gallery / SEO / editor / catalog / sitemap / robots
- Alert payloads for downstream Notification Department
- Website-specific finding ledger (fingerprint + lifecycle)
- Immutable `runs/` + `latest/` + root consumer projections (gated)

Does **not** generate resumes, publish templates, send notifications, run browser automation (Phase 2B), or mutate the public site.

## Safety

- Operational execution **fail-closed** while `operations.website_department.enabled !== true`
- Verification-only: `static`, no network, `persist: false`, no project-state write
- Test bypass requires `SOS_WEBSITE_DEPT_TEST_BYPASS=1` + temporary `output_root` (never production evidence root; never network)
- Production evidence root requires enabled department + `allow_production_evidence: true`
- **Operational entrypoint:** `runWebsiteDepartment` only

## Outcomes

Checks use authoritative `outcome`: `pass` | `fail` | `not_run` | `unsupported`.
`pass: true` only when `outcome === "pass"`. Reports render `NOT_RUN` / `UNSUPPORTED` (never `PASS [not_run]`).

## Usage

```bash
npx tsx SOS/SAIOS/runtime/website-department/verify.ts
npx tsx SOS/SAIOS/runtime/website-department/verify-phase1-core.ts
npx tsx SOS/SAIOS/runtime/website-department/verify-phase2a-core.ts
```

## Outputs (gated persisted runs)

- `runs/<run_id>/` — immutable
- `latest/` — current projection
- root filenames — consumer compatibility (after archive of pre-revival roots)
- `findings/` — Website finding ledger (when `update_findings: true`)

Persistence requires a capability from `assertPersistSafety` (via `runWebsiteDepartment`).
`persistWebsiteReports` is not part of the public package export and rejects ungated calls.

### Accepted V1 limitation — projection layers

`runs/<run_id>/`, `latest/`, and root projections are **not** one cross-directory transaction.
Writes are run-first, then latest, then root; each file is atomic. A crash mid-bundle can leave temporary disagreement between layers. Immutable completed run folders are preserved.

## Status values

`HEALTHY` · `DEGRADED` · `DOWN` · `BLOCKED`
