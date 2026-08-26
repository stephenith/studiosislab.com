# AIOS Canonical Founder Review Registry Integration V1 Report

**Agent:** #208  
**Overall:** PASS  
**LIVE:** OFF  
**publication_allowed:** false  

## Summary

Founder Review waiting-production discovery is now a **read-model projection** of the Candidate Registry (`candidates/*/candidate.json` with `status === WAITING_FOUNDER`). FounderGateRuntime still owns workflow; CandidateStore still owns artifacts; the dashboard does not maintain a parallel candidate registry.

## Files changed

| Path | Role |
|------|------|
| `SOS/SAIOS/dashboard/src/data/buildFounderReviewQueue.ts` | Registry-first queue (`loadWaitingCandidatesFromRegistry`) |
| `SOS/SAIOS/dashboard/src/data/types.ts` | `artifact_refs` + `production_target` on queue items |
| `SOS/SAIOS/dashboard/src/views/FounderReviewView.tsx` | Show production target summary |
| `SOS/SAIOS/core/first-production-cycle/CandidateStore.ts` | `recordBinaryIfPresent` for preview/thumbnail |
| `SOS/SAIOS/core/first-production-cycle/runFirstProductionCycle.ts` | Invoke `preview-assets` after canvas |
| `SOS/SAIOS/core/first-production-cycle/verify-founder-review.ts` | Registry integration verify |
| `SOS/SAIOS/architecture/system-integrity/verify-system-integrity.ts` | Accept agents 208/209 |
| `package.json` | `aios:founder-review:verify` |
| `SOS/project-state.json` | latest_agent=208, next_agent=209 |
| `SOS/09_REPORTS/AIOS_CANONICAL_FOUNDER_REVIEW_REGISTRY_INTEGRATION_V1_REPORT.md` | This report |

## Registry architecture

```
CandidateStore (artifacts + candidate.json)
        ↓ read-only projection
loadWaitingCandidatesFromRegistry()
        ↓
review_queue (Founder Review UI)
        ↓ decisions
FounderGateRuntime / founder-decisions (workflow unchanged)
```

- **Primary waiting production items:** manifests with `WAITING_FOUNDER`
- **One queue item per candidate**
- **Artifact refs:** relative paths into that candidate folder only (no content duplication)
- **Legacy:** dry-run + historical FR# / decisions remain secondary for compatibility
- **`latest-candidate.json`:** still readable; not used as the multi-candidate source of truth

## Queue implementation

`loadReviewQueueForRepo`:

1. Enumerate registry WAITING_FOUNDER → queue items with `artifact_refs` + `production_target`
2. Optionally add dry-run / historical FR packages / decisions when not already present
3. Sort by `created_at` descending

UI: existing list + open + approve/reject workflow retained; Target field shows category · title.

## Preview integration result

**Wired successfully** using existing `preview-assets` (`writePreviewAssets`) from the canonical cycle after `canvas.json` is written into the candidate folder.

- Writes `preview.png` + `thumbnail.png` into the candidate directory
- Records paths on `candidate.json` via `recordBinaryIfPresent`
- Dual-copies to flat latest-run dir
- On failure: preview remains `null`; cycle still PASSes

Verified on a Mock cycle: `preview: "preview.png"`, `hasPng: true`.

## Verification results

| Command | Result |
|---------|--------|
| `npm run aios:founder-review:verify` | PASS |
| Preview smoke (Mock cycle) | PASS (preview recorded) |
| `npm run system-integrity:verify` | PASS (after project-state update) |

Checks covered: multiple manifests discovered, WAITING_FOUNDER enumerated, queue from registry, artifact paths resolve, preview recorded when available, publication disabled, Runtime Guard present, latest pointer readable.

## Deferred work

- Batch generation
- Duplicate detection
- Critic remediation loop
- Scheduler / continuous mode / budget governor
- Publication / ReleaseManager
- Advanced gallery filters / bulk actions
- Redesign of FounderGateRuntime decision semantics

## Confirmations

- LIVE OFF
- publication_allowed = false
- No ownership move of CandidateStore / FounderGate / ResumeRenderer / preview-assets
- No Runtime Guard / Company Brain / BrainRouter / OpenAI / DesignBrief / Critic redesign
- No `src/` writes from this agent’s cycle path
