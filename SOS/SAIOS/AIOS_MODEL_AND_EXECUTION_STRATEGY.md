# AIOS Model and Execution Strategy

**Status:** LOCKED — authoritative for all future AIOS agents  
**Agent:** #115  
**Effective:** 2026-07-11  
**Scope:** StudiosisLab AI Operating System on Hetzner VPS (control plane only)

This document locks the approved model and execution strategy. Future agents must not contradict these decisions without an explicit founder amendment recorded in `SOS/07_LOGS/decisions/`.

---

## 1. Founder objective

Operate a **24/7 AI Operating System** that continuously researches, designs, improves, and generates resume templates for StudiosisLab — always stopping at founder approval before any publication.

The public website remains a separate production application. The AIOS is the autonomous control plane that coordinates departments, workers, approvals, memory, and reporting.

Initial focus: **Resume Department only**. Scale quality first, then volume.

---

## 2. VPS responsibilities (Hetzner)

The Hetzner VPS is the **AIOS control plane only**. It must:

- Run the orchestrator, scheduler, resume workers, QA, render, supervisor, Telegram bridge, and founder dashboard surfaces
- Persist queue, memory, logs, proposals, and cost ledger under `SOS/07_LOGS/saios/`
- Host process management (PM2) and optional reverse proxy for dashboard/health/Telegram webhook
- Never serve the public StudiosisLab website to end users

It must **not**:

- Host `studiosislab.com` production traffic
- Replace Vercel
- Auto-publish templates to the live catalog without founder approval

---

## 3. Vercel responsibilities

Vercel continues to host the public Next.js application (`studiosislab.com`).

- Production deploys remain Vercel’s concern
- AIOS may open GitHub PRs or prepare catalog packages; humans (or founder-approved release steps) merge/publish
- Website PM2 processes are **out of scope** for the AIOS VPS operating plan

---

## 4. Model architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Master Orchestrator                   │
│         (schedule · dispatch · approve · report)         │
└───────────────┬─────────────────────┬───────────────────┘
                │                     │
     ┌──────────▼──────────┐   ┌──────▼──────────────┐
     │ Provider-neutral    │   │ Deterministic       │
     │ Model Adapter       │   │ Internal Workers    │
     │ (OpenAI | Local |…) │   │ (TS pipelines)      │
     └──────────┬──────────┘   └──────┬──────────────┘
                │                     │
     ┌──────────▼─────────────────────▼──────────────┐
     │           Resume Department (enabled)          │
     │  plan → produce → render → QA → critic → propose│
     └──────────────────────┬─────────────────────────┘
                            │
                   Approval Queue (hard gate)
                            │
              Telegram + Founder Dashboard
                            │
                   Founder APPROVE / REJECT / REVISE
                            │
                   Publication / Release (manual gate)
```

**Website Department** remains installed but **disabled** in configuration. Do not delete it.

---

## 5. OpenAI API role

OpenAI API is the **primary initial intelligence provider** for:

- Design planning and difficult critique
- Interpreting structured founder feedback
- Failure diagnosis and complex reasoning
- Summaries, classification, and structured JSON (via economical routing)

OpenAI is **not** required for:

- Scheduling, IDs, checksums, dimensions, publication gates
- Deterministic Fabric template construction already implemented in TypeScript workers
- QA rule evaluation that is already code-based

**No API calls are permitted until:**

1. Provider-neutral adapter exists
2. Credentials are configured securely (git-ignored env)
3. Founder sets monthly/daily cost ceilings
4. A single structured DRY_RUN request has been verified

---

## 6. Cursor role

Cursor remains a **development and complex-code execution tool**.

- Use for hard implementation jobs, repo surgery, and complex agentic coding
- AIOS must **not** depend exclusively on Cursor for Resume Department production
- On the VPS, resume production must run via internal TypeScript workers (+ optional model adapter)
- Cursor runners may remain available as an optional capability in the registry

---

## 7. Internal worker role

Internal TypeScript workers perform **routine deterministic production**:

| Worker area | Role |
|---|---|
| `workers/resume-production` | Template build pipelines (v2/v3) |
| `workers/resume-qa` | ATS / Fabric / layout checks |
| `visual-render` | Headless Fabric/jsdom previews |
| `design-brain` / `adaptive-composer` | Deterministic design composition |
| `founder-critic` | Rule-based pre-founder scoring (never auto-approves) |
| `unified-production` | Stage orchestration for one production cycle |
| `scheduler` | Cadence, workload, recovery |

These workers are the default path for continuous VPS production.

---

## 8. Provider-neutral model adapter

All LLM calls must go through a single **Model Provider Interface**:

```
ModelRequest → ModelAdapter.complete(request) → ModelResponse
```

Required properties:

- Provider id: `openai` | `local` | `anthropic` | `mock` | future
- Capability class: `strong_reasoning` | `economical` | `embedding` (optional)
- No core AIOS module imports a vendor SDK directly
- Switching providers = config + adapter implementation, not orchestrator rewrites
- `mock` provider mandatory for DRY_RUN / verify without network

A future local AI machine connects through the **same** interface. External API remains fallback when local is offline (see §17).

**Model names are not hardcoded in this strategy.** Exact model IDs and pricing are selected during implementation after verifying current availability.

---

## 9. Resume Department production flow

```
Scheduler tick
  → create/select Resume task (1 template per cycle initially)
  → plan (model optional / deterministic brief)
  → produce (internal TS worker)
  → render preview
  → QA
  → founder-critic (advisory)
  → submit PROPOSAL to Approval Queue
  → STOP (no publish)
```

Department enablement:

| Department | State |
|---|---|
| Resume Department | **enabled** |
| Website Department | **disabled** (installed, not scheduled, not run) |

No formal `resume-department/` plugin folder exists yet; logical department today = `resume-factory` → `unified-production` + workers. Agent #116+ must promote this to a first-class department wrapper without changing production intelligence.

---

## 10. Approval workflow

**Hard rule:** No resume may publish automatically.

```
PENDING_APPROVAL
  → APPROVED → APPLYING (publication/release with founder_final_publish_approval)
  → REJECTED → logged; patterns stored for learning
  → CHANGES_REQUESTED → child revision task
```

Channels of record:

1. **Telegram** — approve / reject / revise commands
2. **Founder Dashboard** — review queue and reports

Both channels write the same immutable decision record.

---

## 11. Telegram workflow

- Founder receives proposal digests (when notify LIVE allowed)
- Founder replies with approve / reject / revise + structured feedback
- Allowed user IDs enforced via `SOS_TELEGRAM_ALLOWED_USER_IDS`
- Quiet hours respected (`SOS_QUIET_HOURS_*`)
- Default: dry-run / no live sends until explicitly enabled

Uses existing `SOS/runtime` Commander Telegram stack as the bridge.

---

## 12. Dashboard workflow

- Founder Dashboard / Control Center aggregates review queue, runtime health, pending proposals
- Surfaces are report/JSON/MD today; hosted dashboard process is a VPS target (`aios-dashboard`)
- Dashboard decisions must write the same Approval Queue records as Telegram

---

## 13. Memory and retrieval strategy

| Tier | Purpose |
|---|---|
| Session | Founder conversation context |
| Project | Operational state (mirrors `SOS/project-state.json`) |
| Department | Resume patterns, competitor notes, trend history |
| Long-term | Ratified preferences and decisions |

**Learning method (locked):**

- Structured founder feedback on each proposal
- Project + department memory updates
- Retrieval of relevant **approved / rejected / revised** patterns into subsequent task context
- **No fine-tuning initially**

Shared `memory/` module is currently interface-only; component memories (CriticMemory, ComposerMemory, etc.) exist. Implementation must consolidate behind the provider-neutral retrieval contract without breaking existing workers.

---

## 14. Structured learning format

Every founder decision should capture:

```json
{
  "proposal_id": "…",
  "template_id": "…",
  "decision": "APPROVED | REJECTED | CHANGES_REQUESTED",
  "feedback": {
    "layout": "…",
    "typography": "…",
    "spacing": "…",
    "ats": "…",
    "brand": "…",
    "other": "…"
  },
  "severity": ["…"],
  "actor": "founder",
  "at": "ISO-8601"
}
```

These records form the retrieval corpus and the future fine-tuning eligibility dataset.

---

## 15. Fine-tuning eligibility criteria

Fine-tuning may be **evaluated only after** all of the following exist:

1. Clean dataset of approved, rejected, and revised outputs
2. Stable structured feedback schema in production use
3. Measurable quality plateau under retrieval-only learning
4. Explicit founder decision to evaluate fine-tuning
5. Cost/benefit analysis vs continued API + retrieval

Until then: retrieval + structured feedback only.

---

## 16. Future local-model architecture

```
ModelAdapter
  ├─ openai (cloud primary today)
  ├─ local  (future on-prem / local GPU machine)
  └─ mock   (verify / dry-run)
```

Local machine:

- Implements the same Model Provider Interface
- Registers health/heartbeat with AIOS
- Receives `strong_reasoning` / `economical` routed requests when healthy

---

## 17. API fallback strategy

When local provider is configured:

1. Prefer `local` if healthy within SLA
2. Else fall back to external API (`openai`)
3. Else fail the model step gracefully; deterministic workers may still complete non-LLM stages
4. Record fallback events in cost ledger and logs
5. Alert founder if fallback rate exceeds threshold

---

## 18. Cost controls

Configuration keys (exact monetary ceilings are **founder-required before API activation** — do not invent numbers):

| Control | Purpose |
|---|---|
| `monthly_budget_ceiling_usd` | Hard monthly cap |
| `daily_cost_limit_usd` | Daily cap |
| `per_task_token_limit` | Max tokens per task |
| `automatic_pause_threshold_pct` | Pause AIOS model calls at % of monthly ceiling |
| `founder_alert_threshold_pct` | Notify founder earlier |
| `cost_ledger_path` | Append-only spend log |
| `model_fallback_rules` | Strong → economical → skip-LLM |

On breach: pause model-backed stages, continue deterministic-only where safe, alert founder, leave LIVE publication gates closed.

---

## 19. Production scaling gates

| Gate | Target | Unlock condition |
|---|---|---|
| G0 | 1 template / cycle | DRY_RUN proven + adapter + credentials |
| G1 | 1 template / cycle LIVE produce (still no auto-publish) | Founder quality OK |
| G2 | 3 templates / cycle | Founder-confirmed quality + stability |
| G3 | 5 templates / cycle | Same |
| G4 | 10 templates / 12 hours | Same + cost within ceiling |

Scaling **requires founder-confirmed quality and stability**. Never auto-scale.

---

## 20. Security and secret-handling rules

- Secrets only in git-ignored env (`SOS/runtime/.env`, VPS env, secret manager)
- Never commit API keys, Telegram tokens, Firebase admin keys
- Never log secrets; redact known patterns
- `SOS_AIOS_LIVE=0` and notify dry-run by default
- Departments cannot publish; only Orchestrator apply-step after approval
- No push to `main` from AIOS without founder-approved release path
- Rotate any secrets that were ever exposed in local env files before VPS go-live

---

## 21. Failure and recovery behaviour

| Failure | Behaviour |
|---|---|
| Worker crash | Supervisor restarts; task returns to QUEUED or FAILED with event |
| Model API down | Fallback rules; or skip LLM stage; alert |
| Local model offline | Fall back to API (§17) |
| Cost ceiling hit | Pause model calls; alert; no publish |
| Disk pressure | Rotate logs; alert; block LIVE if Security ORANGE persists |
| Approval timeout | Proposal remains PENDING; no auto-approve |
| Publication failure | APPLY_FAILED; retryable; never silent |

Recovery scripts: reuse `deployment-package` backup/restore/update; keep `SOS_AIOS_LIVE=0` during recovery.

---

## 22. Daily founder workflow

1. Review overnight proposals (Telegram digest + Dashboard)
2. Approve / reject / request revision with structured feedback
3. Optionally trigger one release for approved packages
4. Check cost ledger and health heartbeat
5. Confirm scaling gate status (stay at current gate unless quality proven)

---

## 23. Long-term migration roadmap

| Phase | Focus |
|---|---|
| **Now (Agent #115)** | Strategy lock + gap audit (this document) |
| **#116** | Promote AIOS PM2 process plan; remove website-from-VPS assumptions; department enable flags |
| **Next** | Provider-neutral model adapter + mock provider + OpenAI adapter |
| **Next** | Secure credentials + cost ceiling config + one structured DRY_RUN call |
| **Next** | One Resume Department DRY_RUN task → one resume template → Telegram/Dashboard review |
| **Later** | One approve+publish; then G0→G1 scheduled cycles |
| **v2** | Shared memory implementation + retrieval |
| **v2+** | Local model machine via same adapter; API fallback |
| **v3** | Evaluate fine-tuning only if §15 criteria met |
| **Later** | Enable Website Department under same approval architecture |

---

## Locked decisions (do not change without founder amendment)

1. Website stays on Vercel  
2. Hetzner VPS = AIOS control plane only  
3. Initial department: Resume only  
4. Website Department installed but disabled  
5. OpenAI API = primary initial intelligence provider  
6. Provider-neutral model adapter required  
7. Internal TS workers = routine deterministic production  
8. Cursor = development / complex-code tool; not exclusive dependency  
9. Approval channels: Telegram + Founder Dashboard  
10. No automatic resume publish  
11. Scale 1 → 3 → 5 → 10/12h only with founder-confirmed quality  
12. Learning = structured feedback + memory + retrieval; no fine-tune initially  
13. Fine-tune only after clean approved/rejected/revised dataset  
14. Future local AI via same interface  
15. External API remains fallback if local offline  

---

## Related artifacts

- Gap audit: `SOS/07_LOGS/saios/model-strategy/`
- Report: `SOS/09_REPORTS/AIOS_MODEL_AND_EXECUTION_STRATEGY_V1_REPORT.md`
- Architecture (v1 foundation): `SOS/SAIOS/ARCHITECTURE.md`
- Project state: `SOS/project-state.json`
