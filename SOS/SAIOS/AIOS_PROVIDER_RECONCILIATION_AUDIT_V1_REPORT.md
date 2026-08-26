# AIOS Provider Architecture Reconciliation Audit V1

**Agent:** #191 · Chief Software Architect
**Mode:** Analysis + Documentation only · **STRICTLY READ-ONLY**
**Runtime behavior:** UNCHANGED · **Contracts:** UNCHANGED · **LIVE:** OFF
**Date:** 2026-07-12

---

## Purpose

Reconcile the **Provider runtime** that already exists under `SOS/SAIOS/core/ai-brain/`
(and `SOS/SAIOS/core/providers/mock/`) with the **Provider Registry Architecture Charter**
authored by Agent #190 under `SOS/SAIOS/architecture/provider-registry/`.

This audit does **not** redesign, merge, or modify anything. It compares two worlds and
classifies every declared responsibility using repository evidence only.

> Scope note: The charter (#190) uses the name **"Provider Registry"** as an umbrella authority
> owning nine responsibilities. In runtime, those responsibilities are **distributed across the
> `ai-brain` module family**, and the file literally named `ProviderRegistry.ts` owns only a
> narrow slice (enablement flags). This naming asymmetry is the central finding of the audit.

---

## Evidence base (files read)

Runtime:
- `SOS/SAIOS/core/ai-brain/ProviderAdapter.ts`
- `SOS/SAIOS/core/ai-brain/ProviderRegistry.ts`
- `SOS/SAIOS/core/ai-brain/BrainRouter.ts`
- `SOS/SAIOS/core/ai-brain/CapabilityRegistry.ts`
- `SOS/SAIOS/core/ai-brain/ModelRoutingPolicy.ts`
- `SOS/SAIOS/core/ai-brain/BudgetPolicy.ts`
- `SOS/SAIOS/core/ai-brain/FallbackPolicy.ts`
- `SOS/SAIOS/core/ai-brain/RetryPolicy.ts`
- `SOS/SAIOS/core/providers/mock/MockProvider.ts` (+ `MockResponseFactory`, `MockCapabilities`, `MockValidator`)
- `SOS/SAIOS/core/provider-validation/RealProviderReadinessGate.ts`
- `SOS/SAIOS/config/provider-registry.json`
- `SOS/SAIOS/schemas/provider-adapter.schema.json`
- `SOS/SAIOS/architecture/runtime-guard.ts`
- `SOS/SAIOS/architecture/router-violations.json`

Charter (Agent #190):
- `SOS/SAIOS/architecture/provider-registry/*.md` (9 docs + README)
- `SOS/SAIOS/architecture/provider-registry/PROVIDER_REGISTRY_MANIFEST.json`

---

## 1. Current runtime ownership

Actual owner of each responsibility, with evidence.

| Responsibility | Runtime owner (file) | Evidence |
|----------------|----------------------|----------|
| Provider registration | `core/ai-brain/ProviderRegistry.ts` + `config/provider-registry.json` | `DEFAULT_REGISTRY` + config list of `mock/openai/local/future_provider` |
| Capability catalogue | `core/ai-brain/CapabilityRegistry.ts` (source of truth); `core/providers/mock/MockCapabilities.ts` (per-provider subset, imports from CapabilityRegistry) | `STRONG/ECONOMICAL/DETERMINISTIC_CAPABILITIES`; `MockCapabilities` imports those lists |
| Routing | `core/ai-brain/ModelRoutingPolicy.ts` (`decideRoute`) + `core/ai-brain/BrainRouter.ts` (`planBrainRoute`) | Router imports policy + registry directly |
| Retry | `core/ai-brain/RetryPolicy.ts` (`isRetryableFailure`); adapter applies via `MockProvider.retry` | `DEFAULT_RETRY_POLICY` |
| Fallback | `core/ai-brain/FallbackPolicy.ts` (`canFallbackToExternal`, `assertFallbackRespectsSafety`) | `never_bypass: [budgets, privacy, founder_gates, live_gates]` |
| Budget estimation | Split: `core/ai-brain/BudgetPolicy.ts` (activation gate) + `MockProvider.estimateCost` / `MockResponseFactory.estimateTokensAndCost` (per-request estimate) + `platform/cost-ledger/CostLedger.ts` (ledger authority) | `canActivateRealProvider`; `estimateTokensAndCost` |
| Provider lifecycle | Runtime has only **binary enablement** (`enabled`/`mode`), not the 6-state lifecycle | `ProviderRegistry.ts` `mode: "dry_run"｜"live"｜"disabled"` — no REGISTERED→…→ARCHIVED |
| Provider validation | `core/providers/mock/MockValidator.ts` (request/response schema) + `core/provider-validation/*` (real-provider readiness) | `validateMockRequest/Response`; `RealProviderReadinessGate.evaluate` |
| Health | `ProviderAdapter.healthCheck()` per adapter (`MockProvider.healthCheck`) | returns `ProviderHealth` |
| Cost estimation | `MockProvider.estimateCost` + `MockResponseFactory.estimateTokensAndCost` | deterministic token/cost estimate |
| Mock provider | `core/providers/mock/MockProvider.ts` (Agent #118) | full `ProviderAdapter` implementation, `no_external_api` safety flag |
| Inference | **None.** No real inference anywhere. Mock returns deterministic structured output | `safety_flags: ["dry_run","mock_provider","no_external_api"]`; `openai_sdk_installed: false` |
| Configuration | `config/provider-registry.json`; budget via env (`BudgetPolicy.readBudgetFromEnv`) | file + env keys |
| Versioning | Coarse only: `ProviderRegistryState.version` / policy `version` fields | no provider-vs-model version binding |
| Credential handling | **None active.** `credentials_configured: false` for all; readiness gate blocks | `RealProviderReadinessGate` states MISSING_CREDENTIALS/NOT_IMPLEMENTED |
| Safety flags | `MockProvider` emits `dry_run / mock_provider / no_external_api` | see `execute()` |

---

## 2. Charter ownership (Agent #190)

Responsibilities the charter declares the Provider Registry is the **sole owner** of
(`PROVIDER_REGISTRY_MANIFEST.json > sole_owner_of`, and `PROVIDER_REGISTRY_CHARTER.md`):

1. Provider registration
2. Capability catalog
3. Model catalog
4. Versioning
5. Routing metadata
6. Cost metadata
7. Validation state
8. Health state
9. Provider lifecycle

Charter principles (`principles`):
- One Provider Registry · One Provider Validation authority · One Brain Router ·
  One Cost authority · One Provider lifecycle · No direct model access · No worker-to-provider communication

Charter selection chain: `Skills → Brain Router → Provider Registry → Validation → Cost Policy → Provider Adapter → Provider`

Charter lifecycle: `REGISTERED → VALIDATED → CERTIFIED → ACTIVE → DEPRECATED → ARCHIVED`

Charter explicitly scopes **out**: providers, adapters, api_keys, requests, responses, billing, inference, execution, dispatch, live.

---

## 3. Reconciliation matrix

Status ∈ { MATCH, PARTIAL, DUPLICATED, MISSING, CONFLICT }.

| Responsibility | Runtime owner | Charter owner | Status | Recommendation (future only) |
|----------------|---------------|---------------|--------|------------------------------|
| Provider registration | `ProviderRegistry.ts` + config | Provider Registry | **MATCH** | Keep; formalize as the registry the charter names |
| Capability catalogue | `CapabilityRegistry.ts` (+ `MockCapabilities`) | Provider Registry | **CONFLICT** | Charter assigns catalogue to Registry; runtime owns it in `CapabilityRegistry`, not `ProviderRegistry.ts`. Pick one authority name |
| Model catalog | *(none — providers, no model records)* | Provider Registry | **MISSING** | No `model_id`/model-version records exist yet |
| Versioning | coarse `version` fields | Provider Registry | **PARTIAL** | Provider-vs-model version binding not implemented |
| Routing / routing metadata | `ModelRoutingPolicy.ts` + `BrainRouter.ts` | Provider Registry (metadata) → Brain Router (consume) | **CONFLICT** | Charter: registry owns routing *metadata*, router consumes a read projection. Runtime: router imports policy+registry directly (no projection layer) |
| Retry | `RetryPolicy.ts` | Failure Model (adapter/execution policy) | **MATCH** | Consistent (bounded retry, non-retryable list) |
| Fallback | `FallbackPolicy.ts` | Failure Model / Selection Policy | **MATCH** | `never_bypass` matches charter safety wording |
| Budget estimation | `BudgetPolicy.ts` + adapter estimate + Cost Ledger | Cost Ledger (sole budget authority); Registry owns cost *metadata* | **PARTIAL** | Three touch-points; charter wants single Cost authority |
| Cost metadata | `MockResponseFactory` (per-request) | Provider Registry (declared unit rates) | **PARTIAL** | Registry has no per-provider unit-cost metadata records |
| Validation state | `MockValidator` (schema) + `provider-validation` (readiness) | One Provider Validation authority (6-state) | **PARTIAL** | Schema validation exists; the REGISTERED→…→ARCHIVED state machine does not |
| Health state | `ProviderAdapter.healthCheck()` | Provider Registry health projection | **PARTIAL** | Health is per-adapter; no registry-level health projection record |
| Provider lifecycle | binary `enabled`/`mode` | 6-state lifecycle authority | **MISSING** | Lifecycle state machine not implemented |
| Provider validation authority (single) | distributed (mock + provider-validation) | one authority | **PARTIAL** | Two validation locations, not unified |
| Mock provider | `MockProvider.ts` | out of charter scope (documented as type) | **MATCH** | Implemented and conformant |
| Inference | none | out of scope | **MATCH** | Correctly absent |
| Credential handling | none active; readiness gate | Security Model (adapters hold scoped creds; workers none) | **MATCH** | No creds present; guarded by readiness gate |
| Safety flags | `MockProvider` flags | Security/Guardrails posture | **MATCH** | `no_external_api` present |
| Brain Router (single) | `BrainRouter.ts` | One Brain Router | **MATCH** | Single router exists |
| Selection chain | Skills→Router→(Registry+Policy)→Adapter→Mock | Skills→Router→Registry→Validation→Cost→Adapter→Provider | **PARTIAL** | Runtime chain lacks explicit Validation + Cost stages between router and adapter |

**Tally:** MATCH ×9 · PARTIAL ×7 · CONFLICT ×2 · MISSING ×2 · DUPLICATED ×0*

\* No *hard* duplicate authority (two modules both claiming to own the same thing) was found in code. The overlaps are **charter-vs-code naming conflicts** and **distributed ownership**, documented in §5.

---

## 4. Actual runtime provider call flow (evidence-based)

Reconstructed from imports and function bodies (`BrainRouter.ts`, `MockProvider.ts`,
`ResumeBrainGateway.ts`, `CapabilityRegistry.ts`, `ModelRoutingPolicy.ts`):

```
Skill / Resume gateway
  (core/skills/*, core/resume-integration/ResumeBrainGateway.ts)
        ↓  builds ReasoningRequest (capability + tier + privacy + dry_run)
Brain Router
  (core/ai-brain/BrainRouter.ts → planBrainRoute)
        ├─ loadProviderRegistry()            → ProviderRegistry.ts / config
        ├─ assertOnlyMockActive()            → only "mock" enabled
        ├─ readBudgetFromEnv()               → BudgetPolicy.ts (real provider blocked: values null)
        ├─ decideRoute()                     → ModelRoutingPolicy.ts (rejects deterministic-only; privacy filter)
        └─ assertFallbackRespectsSafety()    → FallbackPolicy.ts
        ↓  selected_provider forced to "mock" (onlyMock || dry_run || budgetBlocks)
Provider Adapter (ProviderAdapter interface)
        ↓
Mock Provider
  (core/providers/mock/MockProvider.ts → execute)
        ├─ validateMockRequest()             → MockValidator.ts
        ├─ estimateTokensAndCost()           → MockResponseFactory.ts
        └─ buildStructuredOutput()           → deterministic, no network
        ↓
ReasoningResponse
  (status COMPLETED; actual_cost_usd 0; safety_flags: dry_run, mock_provider, no_external_api)
```

**Differences from the charter's diagram** (`Skills → Brain Router → Provider Registry → Validation → Cost Policy → Provider Adapter → Provider`):

- Runtime has **no distinct "Validation" node** between Router and Adapter — validation happens *inside* the adapter (`MockValidator`) and, separately, in `provider-validation` for real-provider readiness.
- Runtime has **no distinct "Cost Policy" node** in the call path — cost is estimated inside the adapter; the Cost Ledger is a parallel platform module, not an inline hop.
- Runtime Router reads the registry **directly** (not through a read-only "routing projection").

---

## 5. Duplicate / distributed authority analysis (identification only)

| Concern | Locations | Nature of overlap |
|---------|-----------|-------------------|
| **CapabilityRegistry** | `core/ai-brain/CapabilityRegistry.ts` (authoritative), `core/providers/mock/MockCapabilities.ts` (imports it), charter `PROVIDER_CAPABILITY_MODEL.md` (independent prose list) | Code has ONE source of truth (`MockCapabilities` imports from `CapabilityRegistry`, no fork). The charter's capability list (Reasoning/Vision/Code/…) is a **separate vocabulary** from the code's capability names (design_planning, task_classification, …) → **documentation vocabulary mismatch**, not code duplication |
| **ProviderRegistry** | `core/ai-brain/ProviderRegistry.ts` + `config/provider-registry.json` (narrow: enablement) vs charter "Provider Registry" (broad: 9 responsibilities) | **Naming conflict**: same name, very different scope |
| **BudgetPolicy** | `core/ai-brain/BudgetPolicy.ts`, `core/provider-validation/RealProviderReadinessGate.ts` (`validateBudgetEnv`, its own `BUDGET_ENV_KEYS`), `platform/cost-ledger/*` | Budget env logic appears in **two places** (ai-brain BudgetPolicy and provider-validation) with overlapping env keys → **partial duplication of budget parsing** |
| **MockProvider** | single: `core/providers/mock/MockProvider.ts`; baseline copy path in `core/provider-validation/MockBaselineRunner.ts` (imports it) | No duplicate implementation; baseline runner **reuses** it |
| **Cost Ledger** | `platform/cost-ledger/CostLedger.ts` (authority) vs adapter `estimateCost` (per-request estimate) | Estimation vs ledgering are different layers, but charter says "One Cost authority" → **distributed cost surface** |
| **ModelRoutingPolicy** | single: `core/ai-brain/ModelRoutingPolicy.ts` | No duplicate; but tier→provider preferences (`local/openai/mock`) live here, not in the registry the charter names |
| **FallbackPolicy** | single: `core/ai-brain/FallbackPolicy.ts` | No duplicate |
| **RetryPolicy** | single: `core/ai-brain/RetryPolicy.ts` | No duplicate |

**Conclusion:** There is **no hard code-level duplicate authority** (no two modules both implementing the same owner). The real overlaps are: (a) charter vs code **naming/scope conflict** for "Provider Registry"; (b) **distributed** budget/cost logic across `ai-brain`, `provider-validation`, and `cost-ledger`; (c) **two capability vocabularies** (code vs charter docs).

---

## 6. Technical debt classification

| Severity | Finding |
|----------|---------|
| **Critical** | *(none)* — no LIVE path, no vendor SDK, no worker→provider call exists today; nothing is unsafe right now |
| **High** | **H1 — "Provider Registry" name collision.** The charter's canonical authority and the runtime file `ProviderRegistry.ts` share a name but not a scope; future implementers may build against the wrong one. |
| **High** | **H2 — No enforced worker/department→provider guard.** The rule ("Workers never call providers") is documented (`router-violations.json`, charter, security model) and *currently honored*, but there is **no automated static/CI gate** that fails a build on violation (see §9). |
| **Medium** | **M1 — Capability vocabulary mismatch.** Charter capabilities (Reasoning/Vision/Code/JSON Mode/…) do not map 1:1 to code capabilities (design_planning/task_classification/…). No crosswalk exists. |
| **Medium** | **M2 — Distributed budget/cost logic.** Budget env parsing duplicated between `ai-brain/BudgetPolicy.ts` and `provider-validation/RealProviderReadinessGate.ts`; charter wants one Cost authority. |
| **Medium** | **M3 — Missing lifecycle state machine.** Runtime has binary enablement; charter's REGISTERED→…→ARCHIVED does not exist. Needed before multi-provider certification. |
| **Medium** | **M4 — No model catalog.** Only provider records exist; no `model_id`/model-version records or capability-to-model binding. |
| **Low** | **L1 — Call-flow node mismatch.** Runtime folds Validation and Cost into the adapter/parallel modules rather than explicit chain hops. Cosmetic until real providers. |
| **Low** | **L2 — Router reads registry directly** rather than via a read-only routing projection (charter §Architecture). |
| **Low** | **L3 — Coarse versioning** (single `version` string per policy/registry). |

---

## 7. Phase 4 readiness

| Dimension | Verdict | Evidence |
|-----------|---------|----------|
| Mock providers | **READY** | `MockProvider` fully implements `ProviderAdapter`; router e2e via `executeViaMockProvider` |
| Multiple mock providers | **PARTIAL** | Interface supports it, but `ProviderId` is a fixed union (`mock/openai/local/future_provider`) and `assertOnlyMockActive` assumes a single mock; adding a *second* mock id requires a type + registry entry |
| Real providers | **NOT READY** | No adapter implemented (`adapter_implemented=false`); `credentials_configured=false`; `RealProviderReadinessGate` returns NOT_IMPLEMENTED/MISSING_* |
| Cost governance | **PARTIAL** | Budget gate + cost estimate + Cost Ledger exist, but distributed (M2) and no live actuals |
| Provider neutrality | **READY** | See §8 — no vendor SDK anywhere; capability-based requests; adapter interface |
| Activation Gate integration | **PARTIAL** | `runtime/activation-gate/*` exists and is certified, but no explicit binding to Provider Registry lifecycle states (they don't exist yet, M3) |
| Execution Controller integration | **PARTIAL** | `runtime/execution-controller/*` exists; per charter it authorizes *that* a skill may run, does not own catalogue; no direct provider coupling found (good), but no formal contract linking EC → Registry |
| Department SDK integration | **PARTIAL** | `platform/department-sdk/*` exists; does **not** import providers (good), but no capability-request contract wired to Brain Router yet |
| Worker Runtime integration | **PARTIAL** | `runtime/worker-runtime/*` exists; does **not** import providers (good); integration to Router is not yet wired |
| Brain Router integration | **READY** | Single router; consumes registry/policies; forces mock under dry-run/budget-block |

---

## 8. Provider neutrality assessment

**Verdict: SATISFIED (for the current mock-only scope).**

Evidence the abstraction is genuinely provider-neutral:

1. **No vendor SDK imported anywhere.** A repository-wide search for `from "openai" | "@anthropic..." | "@google/generative-ai"` returned **zero matches**; `router-violations.json` records `openai_sdk_installed: false`.
2. **Capability-based requests, not model names.** `ReasoningRequest` carries a `capability` + `quality_tier`; `AI_BRAIN_ARCHITECTURE.md`: "No request may contain a provider-specific model name." Routing (`ModelRoutingPolicy.ts`) selects by tier, not model.
3. **Single adapter interface.** `ProviderAdapter` (9 methods) is the only provider contract; `schemas/provider-adapter.schema.json` enforces `sdk_dependency_forbidden_in_core: const true`.
4. **Provider id is data.** `MockProvider.provider_id = "mock"`; registry lists `mock/openai/local/future_provider` as records, all but mock disabled.
5. **Neutral response shape.** `ReasoningResponse` is provider-agnostic; `normalizeResponse`/`extractUsage`/`normalizeError` exist precisely to absorb vendor differences.

**What is still missing to prove neutrality at scale** (does not contradict the verdict, but bounds it):
- Only **one** adapter exists. Neutrality is proven by contract, not yet by a *second* conforming adapter.
- `ProviderId` is a closed union; a truly open "Custom Provider" (charter type) would need an extensible id scheme.

---

## 9. Execution safety

Each guarantee, checked against imports and guards.

| Guarantee | Status | Evidence |
|-----------|--------|----------|
| No Provider can bypass Brain Router | **HOLDS (by construction)** | Only entry to `MockProvider.execute` in product path is via `executeViaMockProvider` (BrainRouter). Direct importers of `MockProvider`: only `providers/mock/*`, `resume-integration/ResumeBrainGateway.ts`, `provider-validation/MockBaselineRunner.ts` |
| No Worker directly invokes providers | **HOLDS (unenforced)** | No file under `runtime/worker-runtime/*` or `runtime/workers/*` imports `ai-brain` or `providers/mock`. **But** enforcement is by convention/audit, not a gate |
| No Department invokes providers | **HOLDS (unenforced)** | No file under `platform/department-sdk/*` imports `ai-brain`/providers |
| No Company Brain invokes providers | **HOLDS (unenforced)** | No file under `core/company-brain/*` imports `ai-brain`/providers |
| No Scheduler invokes providers | **HOLDS (unenforced)** | No file under `runtime/scheduler/*` imports `ai-brain`/providers |
| No vendor SDK anywhere | **HOLDS** | zero matches for openai/anthropic/gemini imports; `openai_sdk_installed: false` |
| LIVE off | **HOLDS** | `RealProviderReadinessGate`: `live_off = process.env.SOS_AIOS_LIVE !== "1"`; budgets null → `real_provider_activation_allowed=false` |

**Where enforcement is missing:** All five "no X invokes providers" guarantees are **currently true by observation** but are **not protected by an automated guard**. `architecture/runtime-guard.ts` enforces *engine* access (canonical vs legacy), not *provider* access. `router-violations.json` is a **static hand-authored audit** (Agent #159), not an executable import check. The single highest-value future safeguard is a static import gate: "no module under worker-runtime / workers / department-sdk / scheduler / company-brain may import `core/ai-brain` or `core/providers/*`."

(Note: `router-violations.json` records HIGH items V-001/V-002/V-006/V-007 where legacy workers **embed reasoning** outside the Router, but all are marked `calls_openai_directly: false` and the execution engines are frozen/ARCHIVED by `runtime-guard.ts`. These are router-bypass-of-reasoning issues, not provider-call issues.)

---

## 10. Certification

**Verdict: REQUIRES CONSOLIDATION.**

Rationale:
- The runtime provider architecture is **functionally sufficient and safe today**: single Brain Router, single adapter interface, working Mock, provider-neutral, LIVE off, no worker/department/scheduler/company-brain provider calls, no vendor SDK. This rules out **ARCHITECTURE CONFLICT** (there is no irreconcilable contradiction — the two worlds are compatible).
- It is **not** "READY FOR RECONCILIATION" as a no-op, because two **HIGH** items and four **MEDIUM** items must be consolidated before any provider implementation is attempted:
  - **H1** the "Provider Registry" name/scope collision,
  - **H2** the absence of an enforced worker/department→provider import guard,
  - **M1–M4** capability vocabulary crosswalk, distributed budget/cost logic, missing lifecycle state machine, missing model catalog.

None of these require redesign — they require **consolidation** of names, guards, and a small set of missing records onto the **existing** runtime. The existing `ai-brain` stack should be treated as the canonical implementation the #190 charter describes; the charter should be re-pointed at it (future agent), not re-implemented.

### Recommended sequencing (future agents — not performed here)
1. Resolve H1: declare the `ai-brain` module family the canonical "Provider Registry" the charter names; keep `ProviderRegistry.ts` as its enablement sub-component.
2. Resolve H2: add a static import guard + `verify` check (no worker/department/scheduler/company-brain → provider imports).
3. Resolve M1: publish a capability crosswalk (charter vocabulary ↔ `CapabilityRegistry` names).
4. Resolve M2/M3/M4 only when a *second* adapter or real provider is actually scheduled.

---

## Hard-rule compliance (this agent)

- NO runtime modifications · NO provider implementations · NO adapter/registry changes
- NO new providers · NO API keys · NO SDK installation
- NO OpenAI / Anthropic / Gemini / Cursor SDK / Firecrawl changes
- NO execution · NO dispatch · NO queue insertion · NO scheduler · NO worker spawn · NO publishing
- **LIVE OFF** throughout

This document is a **read-only reconciliation audit**. It changed no code, no contract, no schema, and no configuration.
