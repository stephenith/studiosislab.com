# AIOS AI Brain Architecture

**Status:** LOCKED — Agent #117  
**Scope:** Provider-neutral intelligence contracts for StudiosisLab AIOS  
**Related:** `SOS/SAIOS/AIOS_MODEL_AND_EXECUTION_STRATEGY.md`

---

## Permanent architectural rule

AIOS core and departments must **never** depend directly on OpenAI, a specific model name, Cursor, a future local model, or any single provider SDK.

```
Department or Orchestrator
        ↓
Reasoning Request (capability + tier)
        ↓
AI Brain Router
        ↓
Provider Adapter Interface
        ↓
Mock / OpenAI / Local / Future Provider
        ↓
Structured Reasoning Response
```

Departments request **capabilities**, not model names.

---

## Contracts

| Contract | Path |
|---|---|
| Types | `SOS/SAIOS/core/ai-brain/types.ts` |
| Request | `ReasoningRequest.ts` |
| Response | `ReasoningResponse.ts` |
| Adapter | `ProviderAdapter.ts` |
| Router | `BrainRouter.ts` |
| Schemas | `SOS/SAIOS/schemas/*.schema.json` |

No request may contain a provider-specific model name.

---

## Capability classes

### Strong reasoning
`design_planning`, `founder_feedback_interpretation`, `complex_visual_critique`, `failure_diagnosis`, `production_strategy`, `revision_planning`

### Economical intelligence
`task_classification`, `structured_json_generation`, `report_summarization`, `log_interpretation`, `duplicate_explanation`, `status_reporting`

### Deterministic-only (must not hit AI providers)
`scheduling`, `time_tracking`, `catalog_id_assignment`, `checksum`, `dimension_validation`, `ats_rule_validation`, `publication_gate`, `server_monitoring`, `cost_arithmetic`

The Brain Router **rejects** deterministic-only capabilities unless a founder-approved override policy is explicitly enabled (default: off).

---

## Quality tiers

`strong` · `economical` · `deterministic` · `local_preferred` · `provider_fallback`

Routing selects capability + tier. Provider adapters later map tiers to verified models. **Model names are not hardcoded here.**

---

## Provider registry (default)

| Provider | Enabled | Mode |
|---|---|---|
| mock | **true** | dry_run |
| openai | false | disabled |
| local | false | disabled |
| future_provider | false | disabled |

Only Mock may be active until later agents + founder budgets.

---

## Routing order

1. Validate capability  
2. Reject deterministic-only from model routing  
3. Check privacy classification  
4. Check task and daily budgets  
5. Check provider health  
6. Prefer provider for tier (local → API → mock as configured)  
7. Validate structured output  
8. Retry only under policy  
9. Fallback only when permitted  
10. Record usage and event  
11. Return normalized response  

---

## Privacy

| Class | External API |
|---|---|
| PUBLIC | allowed |
| INTERNAL | allowed |
| CONFIDENTIAL | blocked (local/mock only) |
| HIGHLY_RESTRICTED | blocked |

Resume Template Factory production uses **fictional sample data only** — no real personal user data required.

---

## Budget

Founder-required env (values **null** until set — not invented):

- `SOS_AI_MONTHLY_BUDGET_USD`
- `SOS_AI_DAILY_LIMIT_USD`
- `SOS_AI_PER_TASK_TOKEN_LIMIT`
- `SOS_AI_AUTO_PAUSE_THRESHOLD_PCT`
- `SOS_AI_FOUNDER_ALERT_THRESHOLD_PCT`

No real provider activates while any required limit is unset.

---

## Fallback safety

Fallback must **not** bypass: budgets · privacy · founder gates · LIVE gates.

---

## Cursor vs AI Brain

| Role | Classification |
|---|---|
| AI Brain | Provider-neutral reasoning via adapters |
| Cursor | Development tool / complex repo-modification executor |
| Execution Engine | Future separate contract — not implemented in #117 |

Cursor is **optional** to production AIOS and **not** an AI Brain provider.

---

## Resume Department integration (contract only)

| Use case | Capability | Tier |
|---|---|---|
| Research / design planning | `design_planning` | `strong` |
| Founder revision feedback | `founder_feedback_interpretation` | `strong` |
| Report generation | `report_summarization` | `economical` |
| QA calculations | — | deterministic code only |
| Template IDs / publication gates | — | deterministic code only |

No Resume Department production logic changed in Agent #117.

---

## Events (contract only — not wired live)

`BRAIN_REQUEST_CREATED` · `ROUTED` · `STARTED` · `RETRIED` · `FALLBACK_USED` · `COMPLETED` · `FAILED` · `BUDGET_WARNING` · `BUDGET_PAUSED` · `PROVIDER_UNHEALTHY`

---

## Agent #118

Implement **Mock Provider** adapter against these contracts. Still no live OpenAI until budgets + credentials.
