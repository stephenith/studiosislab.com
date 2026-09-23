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
- Next authorized Resume step is consolidation planning, not another Operations Analyst Request Changes retry.
- Do not redesign or reopen Resume Template production systems unless the Founder authorizes consolidation work or a new real production regression is proven.
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
