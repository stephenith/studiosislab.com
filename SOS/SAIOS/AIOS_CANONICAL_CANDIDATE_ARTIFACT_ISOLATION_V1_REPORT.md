# AIOS Canonical Candidate Artifact Isolation V1 Report

**Agent:** #207  
**Overall:** PASS  
**LIVE:** OFF  
**publication_allowed:** false  

## Summary

Canonical Resume Factory runs no longer overwrite a shared flat artifact directory. Each execution allocates a run-unique candidate identity and persists an authoritative record under:

`SOS/07_LOGS/saios/first-production-cycle/candidates/{candidate_id}/`

Flat files under `first-production-cycle/` plus `latest-candidate.json` remain **latest-run diagnostics only**.

## Files changed

| Path | Role |
|------|------|
| `SOS/SAIOS/core/first-production-cycle/CandidateIdentity.ts` | Run-unique ID allocation |
| `SOS/SAIOS/core/first-production-cycle/CandidateStore.ts` | Per-candidate dirs, manifest, dual-write, waiting counts |
| `SOS/SAIOS/core/first-production-cycle/runFirstProductionCycle.ts` | Workspace isolation, progressive status, founder artifact refs |
| `SOS/SAIOS/core/first-production-cycle/selectProductionTarget.ts` | Canonical WAITING_FOUNDER reservation in coverage |
| `SOS/SAIOS/core/first-production-cycle/verify-candidate-isolation.ts` | Isolation verification (Mock) |
| `SOS/SAIOS/core/first-production-cycle/verify-production-target.ts` | Accept run-unique IDs for default-target check |
| `SOS/SAIOS/core/first-production-cycle/index.ts` | Export identity/store |
| `SOS/SAIOS/core/first-production-cycle/README.md` | Document candidates + verify command |
| `SOS/SAIOS/dashboard/src/data/buildFounderReviewQueue.ts` | Resolve latest candidate paths via pointer |
| `SOS/SAIOS/architecture/system-integrity/verify-system-integrity.ts` | Accept agents 207/208 + isolation op |
| `package.json` | `aios:candidate-isolation:verify` |
| `SOS/project-state.json` | latest_agent=207, next_agent=208 |
| `SOS/09_REPORTS/AIOS_CANONICAL_CANDIDATE_ARTIFACT_ISOLATION_V1_REPORT.md` | This report |

## Candidate directory structure

```
SOS/07_LOGS/saios/first-production-cycle/
  latest-candidate.json
  canvas.json                    # latest-run copy only
  dashboard.json                 # latest-run copy only
  …
  candidates/
    {candidate_id}/
      candidate.json             # manifest (authoritative)
      production-target.json
      research-context.json
      research-handoff.json
      brain.json
      resume-json-instructions.json
      canvas.json
      editor-compatibility.json
      critic.json
      gate.json
      review.json
      dashboard.json
      waiting-founder.json
      execution-summary.json
      preview.png / thumbnail.png   # only when legitimately present
```

## ID strategy

Format: `{target_slug}-{UTC_stamp}-{6hex}`

Examples:

- `candidate_id`: `cand-marketing-marketing-manager-20260721T082208Z-ba73c2`
- `task_id`: `cycle-marketing-marketing-manager-20260721T082208Z-ba73c2`
- `review_id`: `founder-review-cycle-marketing-…`
- `run_id` / `cycle_id`: derived from the same run component

Collision safety: UTC stamp + 3 random bytes. Same category/title/objective may be selected again without ID reuse.

`stableIdsForTarget()` remains for legacy callers that expect historical stable IDs; **new canonical runs** always use `allocateCandidateIdentity()`.

## Latest-run compatibility method

**Option A + pointer:**

1. Authoritative writes go to `candidates/{candidate_id}/`
2. Each JSON artifact is dual-written to the flat `first-production-cycle/` directory
3. `latest-candidate.json` points at the latest candidate id/dir/review/status

Existing verifies that read flat `dashboard.json`, `brain.json`, `research-context.json`, etc. continue to work.

## WAITING_FOUNDER reservation behavior

`countCanonicalWaitingByCategory()` scans candidate manifests with `status === "WAITING_FOUNDER"`.

`selectNextProductionTarget()`:

- Includes those counts in coverage saturation
- **Filters out** categories with `waiting_founder > 0` when alternatives exist
- Does not require legacy unified-production runs
- Remains deterministic (no AI selector)

## Founder checkpoint changes

`FounderGateRuntime.pause` artifact references now point at **candidate-directory** paths:

- canvas, critic, gate, review, designbrief, production_target, research_context, dashboard
- candidate_dir, candidate_manifest
- preview / thumbnail only when files exist in the candidate folder

Decision semantics unchanged. No auto-publish.

Dashboard / Founder Review latest item resolves candidate paths through `latest-candidate.json` when present.

## Preview / thumbnail result

**Deferred to Agent #208.**

No safe canonical-only preview generator is wired into the cycle. Manifest `preview` / `thumbnail` remain `null`. Isolation does not fail when images are absent. Stale shared previews are intentionally not copied.

## Failure persistence behavior

- Candidate folder created when identity is assigned
- Status progressive: `RUNNING` → `WAITING_FOUNDER` | `CRITIC_BLOCKED` | `FAILED`
- Partial artifacts preserved on failure
- Failed runs never remain `WAITING_FOUNDER`
- Existing candidate directories are never reused/overwritten (create refuses if dir exists)
- Atomic JSON writes via temp + rename

## Verification results

| Command | Result |
|---------|--------|
| `npm run aios:candidate-isolation:verify` | PASS (Mock; 3 runs) |
| `npm run aios:canonical:verify` | PASS |
| `npm run aios:production-target:verify` | PASS |
| `npm run aios:research:verify` | PASS |
| `npm run system-integrity:verify` | PASS |

Isolation checks confirmed: distinct directories, non-colliding IDs, first-run artifacts intact after second run, manifests valid, coverage reservation, latest-run pointer, `WAITING_FOUNDER`, `publication_allowed=false`, no `src/` writes, no ReleaseManager.

## Deferred to Agent #208

- Multi-candidate Founder Review gallery / enumeration UI
- Dashboard filters / bulk actions
- Preview/thumbnail generation if a safe path is introduced
- Batch generation loop
- Duplicate detection
- Critic remediation loop
- Scheduler / continuous mode / budget governor

## Confirmations

- LIVE OFF
- publication_allowed = false
- No automatic publication
- No ReleaseManager activation
- Runtime Guard ownership unchanged
- Company Brain / BrainRouter / OpenAIProvider / DesignBrief / Renderer / Critic / CriticGate ownership unchanged
- No writes to `src/`, live templates, or publication drafts from this agent’s cycle path
