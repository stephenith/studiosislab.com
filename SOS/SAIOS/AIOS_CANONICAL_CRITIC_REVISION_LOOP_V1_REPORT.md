# AIOS Canonical Critic Revision Loop V1 Report

**Agent:** #211  
**Overall:** PASS  
**LIVE:** OFF  
**publication_allowed:** false  

## Summary

Bounded automatic revision loop improves candidates that fail ResumeCritic before Founder Review. Maximum **2** automatic revisions (initial + revision 1 + revision 2). After the limit: `CRITIC_BLOCKED`. Founder approval is never bypassed. Publication remains disabled.

## Files changed

| Path | Role |
|------|------|
| `SOS/SAIOS/core/first-production-cycle/RevisionLoop.ts` | Revision orchestration + history persistence |
| `SOS/SAIOS/core/first-production-cycle/runFirstProductionCycle.ts` | Wire loop after render; regenerate with revision context |
| `SOS/SAIOS/core/first-production-cycle/verify-revision.ts` | Verification |
| `SOS/SAIOS/core/first-production-cycle/index.ts` | Export RevisionLoop |
| `SOS/SAIOS/core/first-production-cycle/README.md` | Commands |
| `SOS/SAIOS/architecture/system-integrity/verify-system-integrity.ts` | Agents 211/212 + op gate |
| `package.json` | `aios:revision:verify` |
| `SOS/project-state.json` | latest_agent=211, next_agent=212 |
| `SOS/09_REPORTS/AIOS_CANONICAL_CRITIC_REVISION_LOOP_V1_REPORT.md` | This report |
| `SOS/SAIOS/AIOS_CANONICAL_CRITIC_REVISION_LOOP_V1_REPORT.md` | SAIOS copy |

## Revision architecture

```
render → editor_compat
  → RevisionLoop
       critique (ResumeCritic)
       if PASS → CriticGate → Founder Review → WAITING_FOUNDER
       if FAIL && revisions < 2
         → revise (KnowledgeGateway → DesignBrief → Renderer + preview)
           with revision context (target, research, previous brain, findings, revision_number)
         → critique again
       if FAIL && revisions == 2 → CRITIC_BLOCKED (no Founder pause)
```

| Owner | Responsibility |
|-------|----------------|
| ResumeCritic | PASS / FAIL |
| RevisionLoop | Retry orchestration only |
| ResumeKnowledgeGateway / Brain | Regeneration |
| ResumeRenderer | Re-render |
| FounderGateRuntime | Workflow pause (PASS only) |
| CandidateStore | Persistence of candidate status |

BatchRunner unchanged: each candidate finishes its revision cycle before the next starts (sequential await).

## Retry limit

`MAX_AUTOMATIC_REVISIONS = 2`

| Attempt | Meaning |
|---------|---------|
| revision_number 0 | Initial generation |
| revision_number 1 | Automatic revision 1 |
| revision_number 2 | Automatic revision 2 (final automatic) |

Then: `CRITIC_BLOCKED` — no further automatic retries.

## History persistence

Under `candidates/{candidate_id}/revisions/`:

```
revision-00/   # initial
  critic.json
  mock-provider.json / brain.json
  renderer.json / canvas.json
  designbrief.json
  summary.json
revision-01/
revision-02/
revision-history.json
```

Also flat `revision-history.json` in the candidate root. Prior revision folders are never overwritten.

## Verification

| Command | Result |
|---------|--------|
| `npm run aios:revision:verify` | PASS |
| `npm run system-integrity:verify` | PASS |

Checks covered: PASS with 0 revisions; FAIL retries; max limit → CRITIC_BLOCKED; history persisted; blocked not in Founder Review; PASS in Founder Review; sequential batch; publication off; Runtime Guard; no `src/` writes.

## Limitations

- Revisions re-run planning with Mock/OpenAI path as configured; no separate semantic self-improvement model.
- Verify FAIL paths use `force_fail_through_attempt` (deterministic hook); production uses ResumeCritic only.
- Global designbrief/renderer/critic log dirs remain “latest”; candidate copies preserve isolation.

## Deferred

- Scheduler / continuous mode / budget governor
- Publication / LIVE / parallel batches
- Embedding-based or LLM “semantic” self-improvement beyond structured revision context

## Project state

- `latest_agent` = **211**
- `next_agent` = **212**
- `operations.canonical_critic_revision_loop` = **complete**
