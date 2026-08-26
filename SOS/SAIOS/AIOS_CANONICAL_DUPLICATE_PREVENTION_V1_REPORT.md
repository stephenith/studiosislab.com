# AIOS Canonical Duplicate Prevention V1 Report

**Agent:** #210  
**Overall:** PASS  
**LIVE:** OFF  
**publication_allowed:** false  

## Summary

Deterministic duplicate preflight (`ALLOW` | `SKIP_DUPLICATE`) runs after ProductionTarget selection and **before** research, ResumeKnowledgeGateway, OpenAI, design, and rendering. Skipped targets never create `WAITING_FOUNDER` candidates and do not inflate Founder Review. BatchRunner retries alternate targets within a bounded maximum-attempt safeguard.

## Files changed

| Path | Role |
|------|------|
| `SOS/SAIOS/core/first-production-cycle/DuplicateDetector.ts` | Normalization, fingerprint, exact/near/batch-local detection |
| `SOS/SAIOS/core/first-production-cycle/runFirstProductionCycle.ts` | Preflight integration; `DUPLICATE_SKIPPED` early return |
| `SOS/SAIOS/core/first-production-cycle/BatchRunner.ts` | Retry after skips; max attempts; batch-local state; forced targets |
| `SOS/SAIOS/core/first-production-cycle/selectProductionTarget.ts` | `excludeFingerprints` for alternate selection |
| `SOS/SAIOS/core/first-production-cycle/CandidateStore.ts` | `duplicate_control` on manifests |
| `SOS/SAIOS/core/first-production-cycle/verify-duplicates.ts` | Agent #210 verification |
| `SOS/SAIOS/core/first-production-cycle/verify-batch.ts` | Unique forced targets under category saturation |
| `SOS/SAIOS/core/first-production-cycle/verify.ts` | `select_target: true` (compat) |
| `SOS/SAIOS/core/first-production-cycle/verify-candidate-isolation.ts` | Opts out of preflight (isolation ≠ duplicate policy) |
| `SOS/SAIOS/core/first-production-cycle/verify-production-target.ts` | Opts out of preflight for DEFAULT-target compat |
| `SOS/SAIOS/core/first-production-cycle/index.ts` | Export DuplicateDetector |
| `SOS/SAIOS/core/first-production-cycle/README.md` | Duplicate + batch commands |
| `SOS/SAIOS/architecture/system-integrity/verify-system-integrity.ts` | Agents 210/211 + op gate |
| `package.json` | `aios:duplicates:verify` |
| `SOS/project-state.json` | latest_agent=210, next_agent=211 |
| `SOS/09_REPORTS/AIOS_CANONICAL_DUPLICATE_PREVENTION_V1_REPORT.md` | This report |
| `SOS/SAIOS/AIOS_CANONICAL_DUPLICATE_PREVENTION_V1_REPORT.md` | SAIOS copy |

## Architectural ownership

**Owns:** deterministic duplicate preflight decision only.

**Reads:** candidate manifests, proposed targets, batch-local attempted fingerprints, statuses.

**Does not own:** target planning, Company Brain, research, content generation, design, rendering, critic, founder decisions, publication.

Production Intake still proposes targets. Duplicate Prevention answers **ALLOW** or **SKIP_DUPLICATE**.

## Normalization rules

Shared `normalizeText` / `normalizeProductionTarget` (version **1**):

- lowercase
- collapse hyphens / underscores / dashes to spaces
- strip punctuation
- collapse whitespace
- conservative title synonyms (e.g. `finance analyst` → `financial analyst`; senior marketing title variants)

Examples that fingerprint identically: `Marketing Manager`, `marketing-manager`, `marketing_manager`, `  Marketing   Manager`.

No LLM. Does not aggressively collapse genuinely different roles (e.g. Product vs Performance Marketing Manager).

## Fingerprint strategy

SHA-256 over:

`v{normalization_version}|category|title|industry|seniority|objective`

Stored on accepted manifests as:

```json
"duplicate_control": {
  "target_fingerprint": "...",
  "normalization_version": 1,
  "duplicate_status": "UNIQUE",
  "decision": "ALLOW",
  "checked_at": "...",
  "comparison_registry_size": N,
  "batch_local_check": true|false
}
```

Historical manifests without fingerprints are fingerprinted at read time from stored target fields (no destructive migration).

## Comparison status policy

**Reserving (exact/near apply):** `RUNNING`, `WAITING_FOUNDER`, `CRITIC_BLOCKED`, `APPROVED`, `COMPLETED`.

**Non-reserving:** `FAILED` — does not permanently reserve the target (no explicit retry policy beyond this).

## Exact duplicate logic

Normalized fingerprint match against any reserving manifest → `SKIP_DUPLICATE` / `EXACT_TARGET`.

## Near-duplicate scoring and thresholds

Conservative, deterministic (no embeddings):

| Rule | Value |
|------|-------|
| Category | must equal |
| Title Jaccard | ≥ **0.85** |
| Objective Jaccard | ≥ **0.70** (mandatory) |
| Industry / seniority agree | ≥ **1** of the two |

Weighted report score ≈ category 0.20 + title×0.35 + industry 0.10 + seniority 0.10 + objective×0.25.

Objective similarity is mandatory so distinct production intents with the same job title are not collapsed.

## Batch retry and maximum-attempt behavior

For requested size **N**:

1. Attempt targets sequentially (never parallel).
2. On `SKIP_DUPLICATE`, record skip, add fingerprint to batch-local set, request another target.
3. Default `maximum_attempts = max(N×3, N+5)`; explicit `max_attempts` is respected as-is.
4. Stop cleanly on: accepted count reached, no eligible alternatives, max attempts, queue capacity, OpenAI batch cap, fatal error.

Batch summary includes `duplicate_skip_count`, `total_attempts`, `maximum_attempts`, and per-skip diagnostics under the batch directory.

## Duplicate event format

```json
{
  "decision": "ALLOW" | "SKIP_DUPLICATE",
  "duplicate_type": null | "EXACT_TARGET" | "NEAR_TARGET" | "BATCH_REPEAT",
  "target_fingerprint": "...",
  "matched_candidate_id": null,
  "matched_batch_sequence": null,
  "score": null,
  "threshold": null,
  "reason": "...",
  "checked_at": "...",
  "normalization_version": 1,
  "comparison_registry_size": 0
}
```

Cycle diagnostic: `SOS/07_LOGS/saios/first-production-cycle/duplicate-preflight-latest.json`.

## Historical manifest compatibility

Fingerprints computed on read when `duplicate_control` is absent. No silent bulk rewrite.

## Verification results

| Command | Result |
|---------|--------|
| `npm run aios:duplicates:verify` | PASS (Mock; fixtures + cycles) |
| `npm run aios:batch:verify` | PASS |
| `npm run aios:founder-review:verify` | PASS |
| `npm run system-integrity:verify` | PASS |

## Known limitations

- Near-duplicate is token/Jaccard based only — no embeddings / LLM classification.
- Category coverage selection still reserves one WAITING_FOUNDER per category; duplicate fingerprints are orthogonal.
- Title synonym list is small and conservative.
- Skips are diagnostic events, not candidate records.

## Deferred work

- Embedding / semantic duplicate detection
- LLM duplicate classification
- Automatic candidate deletion / merging
- Critic remediation / self-revision loop
- Scheduler / continuous mode / full budget governor
- Publication / ReleaseManager / LIVE activation
- Parallel batch execution

## Project state

- `latest_agent` = **210**
- `next_agent` = **211**
- `operations.canonical_duplicate_prevention` = **complete**
