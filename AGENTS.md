# StudiosisLab AIOS Agent Instructions

## Authoritative state

- Before every StudiosisLab task, read `SOS/STUDIOSISLAB_PROJECT_MASTER.md`, the relevant department master if one exists, and `SOS/project-state.json`.
- Compare proposed work with the recorded current department, roadmap and business goal.
- Do not create unrelated architecture, duplicate systems, broad side fixes or speculative hardening.
- Update the project master, the relevant department master, and project-state as required by the change (see the project master update protocol).
- Update project-state only after a meaningful verified milestone and only when the task explicitly authorizes it.
- Milestone timestamps must include exact India time with `+05:30` and corresponding UTC time.

## Product and roadmap

- StudiosisLab is a public SaaS website built with Next.js App Router, TypeScript, React, Tailwind, Fabric.js, Firebase and Vercel.
- AIOS operational code primarily lives under `SOS/SAIOS/`.
- Persisted AIOS evidence/state primarily lives under `SOS/07_LOGS/saios/`.
- Human project-wide source of truth: `SOS/STUDIOSISLAB_PROJECT_MASTER.md`.
- Machine checkpoint: `SOS/project-state.json`.
- Roadmap order:
  1. Resume Template Department — current work; `CONSOLIDATION_REQUIRED` (historical core factory goal remains met; do not assert live `OPERATIONALLY_COMPLETE`)
  2. Website Analysis / QA / Development — next major product department (not current authorized work)
  3. SEO
  4. Paid acquisition/campaigns
  5. Ad placement and monetization
- Do not jump to later departments unless the Founder explicitly changes priority.

## Resume Template boundary

- Canonical department master: `SOS/RESUME_TEMPLATE_DEPARTMENT_MASTER.md`.
- Current live status is `CONSOLIDATION_REQUIRED`. Historical `CORE_RESUME_TEMPLATE_FACTORY_GOAL_MET` remains true.
- C5 live Request Changes proof completed **FAIL** on `revtask-863f67a5-790`. That historical task remains immutable. Do not Approve it. Do not retry `revtask-863f67a5-790`, `revtask-5d933072-daf`, or `revtask-76a04a21-6ff`. Do not start C6.
- C1/C4 semantic fulfillment was corrected offline (`founder-feedback-ir-1.3.0` after the post-third-C5 correction; one public semantic owner remains `compileFounderFeedbackIR`).
- C5 live re-proof **FAIL** (`fd-87ecc16c-f45` / `revtask-4a0c006c-507`): the new Request Changes ran on historical C5 child `…-revfb-f81691`, not the authorized Motion Designer `…-bed721`. Do not retry `revtask-4a0c006c-507`, `revtask-863f67a5-790`, `revtask-5d933072-daf`, or `revtask-76a04a21-6ff`. Do not Approve. Do not start C6. `READY_FOR_C6=NO`.
- Third C5 live proof **FAIL** (`fd-4e2c7c6a-eaa` / `revtask-3f5b2339-73e`) on Motion Designer `…-bed721`. That historical result remains FAIL. A later offline correction added range/group `RELATIONAL_ALIGNMENT` and fixed the layout-only geometry-trial baseline. Do not retry `revtask-3f5b2339-73e`, `revtask-4a0c006c-507`, `revtask-863f67a5-790`, `revtask-5d933072-daf`, or `revtask-76a04a21-6ff`. Do not Approve. Do not start C6. `READY_FOR_C6=NO`.
- Fourth C5 live proof **FAIL** (`fd-eaa0beaa-6fc` / `revtask-0d58e039-326`) on Research Assistant. Task technically reached `READY_FOR_FOUNDER_REVIEW` — that was a **false-positive READY**. Child `…-194bdf-revfb-71bd11` is overlay `audit_invalid` / NOT_DECISIONABLE. A later offline correction generalized structured presentation (`founder-feedback-ir-1.4.0`), atomic logical items, text-box height sync, and intra-box fulfillment. IR 1.4 post-deploy verification then found that approximate cardinality still weakened material continue-beside/grouping, and that C1/C4 used a synthetic skill list rather than the real parent. Do not retry `revtask-0d58e039-326`, `revtask-3f5b2339-73e`, `revtask-4a0c006c-507`, `revtask-863f67a5-790`, `revtask-5d933072-daf`, or `revtask-76a04a21-6ff`. Do not Approve. Do not start C6. `READY_FOR_C6=NO`.
- C1/C4 semantic fulfillment now uses `founder-feedback-ir-1.4.3` after the final C5 offline safety closure; one public semantic owner remains `compileFounderFeedbackIR`. Approximate/soft cardinality remains independent of material structural grouping. Relative object placement, multi-object group alignment to a reference with explicit preserve, and content-preserving `change … from … to …` presentation compile as IR, not as a second English parser. FeedbackCoverage must consume those IR fulfillment predicates and must not mark a specific relational request addressed by generic `LAYOUT_RHYTHM_SATISFIED`. Next authorized step is the C6 Resume Template Department closure audit. Do not execute a seventh C5 live proof. Do not declare the department closed until C6 decides. `READY_FOR_SEVENTH_C5_LIVE_PROOF=NO`. `READY_FOR_C6_CLOSURE_AUDIT=YES`. `READY_FOR_C6=NO`.
- Fifth C5 live proof **FAIL** (`fd-b951abe2-e84` / `revtask-68a5d250-b24`) on Campus Ambassador. Terminal `FAILED_GATE` / `FAILED_GEOMETRY` / owner historically `final_geometry`. True first blocker was pre-execution `plan_geometry_safety` (three transient post-`update_text` overlaps before height-sync/reflow/normalize). C2 was NOT_REACHED. Header compiled as CONTENT_PRESERVATION with no relation; Skills compiled as CONTENT_REWRITE with no PresentationSpec. No child. No false READY. Telegram truthful. Do not retry `revtask-68a5d250-b24`, `revtask-0d58e039-326`, `revtask-3f5b2339-73e`, `revtask-4a0c006c-507`, `revtask-863f67a5-790`, `revtask-5d933072-daf`, or `revtask-76a04a21-6ff`. Do not Approve. Do not start C6.
- Sixth C5 live proof **FALSE READY** (`fd-d679f3f8-f03` / `revtask-3a9bcae2-16c` / child `…-revfb-fcfc81`) on Physical Therapist. Skills request succeeded (8 items, columns, beside, C2 PASS). Header group stayed at left=64 vs body left=80; rail left=50 preserved. IR 1.4.2 compiled empty fulfillment; coverage used generic `LAYOUT_RHYTHM_SATISFIED`. Historical task remains READY. Overlay marks the child `audit_invalid` / NOT_DECISIONABLE. Do not retry `revtask-3a9bcae2-16c` or earlier C5 tasks. Do not Approve. Do not execute a seventh live proof. Do not start C6 inside the 1.4.3 correction.
- Historical technical `READY_FOR_FOUNDER_REVIEW` is not current Founder Review actionability. Authorized audit-invalid results are current-state overlay records (`SOS/SAIOS/core/founder-review/actionability-overlay.json`), not task rewrites and not a candidate-ID blacklist. `NOT_DECISIONABLE` / `audit_invalid` blocks ordinary Approve, Request Changes, and Reject on both UI and server.
- Do not redesign or reopen Resume Template production systems except to execute the recorded C1–C6 plan after Founder-authorized implementation.
- In user-facing text, always use “Resume Template” and “Resume Template ID”.
- Existing `candidate`, `candidate_id` and `candidates/` names are legacy internal identifiers and may remain for compatibility.

## Website Department operating model

- Repository-first and evidence-first.
- Reuse the existing Website Department instead of creating overlapping auditors or QA systems.
- Detect, reproduce, collect evidence, classify and deduplicate before proposing fixes.
- Initial operation is detect-only.
- Do not autonomously modify or deploy the public website.
- Page additions/removals, major UX changes, authentication/data changes and production deployment require Founder approval.
- Preserve existing user journeys and understand historical intent/callers before major changes.
- A security or quality improvement must not silently degrade existing functionality.
- Other AIOS departments may request website work, but the Website Department is the controlled engineering gateway.

## Current deferred scope

- Previously identified e-sign/API/Firebase security and legacy-unused-route findings are deferred to a future Founder-authorized AIOS System Audit/Optimization Department.
- Do not reopen them during Website Department work unless they directly block the current authorized task or the Founder changes priority.

## Git and working-tree safety

- Assume the working tree may contain unrelated Founder work.
- Inspect Git status before editing.
- Preserve unrelated modified and untracked files.
- Stage files explicitly.
- Never use `git add .`, `git add -A`, `git reset --hard`, `git clean`, force push or destructive checkout.
- Do not amend or rewrite historical evidence commits unless explicitly authorized.
- Do not push, merge, deploy or modify VPS state without explicit authorization.
- Use fast-forward-only production updates where applicable.

## Runtime and production safety

- Never expose secrets, passwords, tokens or environment values in prompts, reports or logs.
- Do not invoke paid/external APIs, production OpenAI, Firebase mutations, emails, uploads, publication, advertising interactions or production browser journeys unless explicitly authorized.
- Never click live advertisements or generate artificial ad impressions.
- Local browser tests must use the approved loopback-only Website Department policy.
- Preview and production testing require separate Founder approval.
- `SOS_AIOS_LIVE=0` is the correct guarded Resume Template production posture; do not change it casually.
- Publication auto-apply remains off unless explicitly authorized.

## Verification and reporting

- Verify changes with the narrowest relevant offline tests first.
- Do not claim browser, network, production or deployment proof unless it actually occurred.
- Distinguish `pass`, `fail`, `not_run` and `unsupported`.
- Preserve immutable historical evidence.
- Report exact files changed, commands run, results, unresolved risks and Git state.
- Stop at explicit approval boundaries.
- Never convert temporary/local test findings into production findings without review.

## Communication

- Lead with the result.
- Be concise and factual.
- Mark uncertain conclusions as inferred or unknown.
- When manual Founder action is required, provide one exact step at a time and wait for its result.
