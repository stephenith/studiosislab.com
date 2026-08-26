# Provider Authorities — Canonical Ownership Table

**Agent #192 · Provider Authority Certification V1**  
**Status:** CERTIFIED · Documentation + enforcement only  
**LIVE:** OFF · **No responsibility mergers**

---

## Purpose

This is the single Provider Authority reference for AIOS. It certifies **existing** ownership. It does **not** merge modules or invent a god registry.

Umbrella: **AI Brain Provider Platform** (`SOS/SAIOS/core/ai-brain/` + `SOS/SAIOS/core/providers/`).

---

## Permanent authority table

| Authority | Canonical owner | Supporting modules | Reason for ownership | Public contract | Future extensibility |
|-----------|-----------------|--------------------|----------------------|-----------------|----------------------|
| **Provider Enablement** | `ProviderRegistry.ts` + `config/provider-registry.json` | `RealProviderReadinessGate.ts` (reads enablement) | Answers only “which providers are enabled and in what mode”; keeps safety primitive `assertOnlyMockActive` small | `ProviderRegistryState`, `loadProviderRegistry`, `assertOnlyMockActive`, `isProviderEnabled` | Add provider records without absorbing routing/capabilities |
| **Capabilities** | `CapabilityRegistry.ts` | `MockCapabilities.ts` (subset advertiser; imports CapabilityRegistry) | Single vocabulary for what may reach a provider; skills request capabilities, not models | `BrainCapability`, `classifyCapability`, `isDeterministicOnly`, `listAllCapabilities` | New capability ids added only here; charter names map via crosswalk |
| **Routing** | `ModelRoutingPolicy.ts` | `BrainRouter.ts` (orchestrates) | Capability + tier + privacy → preferred providers; never model names | `decideRoute`, `DEFAULT_ROUTING_POLICY`, `RoutingDecision` | Tier preferences / privacy maps extend without touching enablement |
| **Retry** | `RetryPolicy.ts` | `MockProvider.retry` (applies policy) | Bounded retry vs non-retryable failure codes | `DEFAULT_RETRY_POLICY`, `isRetryableFailure` | Add codes without changing registry |
| **Fallback** | `FallbackPolicy.ts` | `BrainRouter` (checks safety) | Explicit fallback that never bypasses budgets/privacy/founder/LIVE | `DEFAULT_FALLBACK_POLICY`, `canFallbackToExternal`, `assertFallbackRespectsSafety` | Chain rules extend independently |
| **Budget Policy** | `BudgetPolicy.ts` | `RealProviderReadinessGate.validateBudgetEnv` (overlapping env parse — known debt) | Founder ceilings required before real-provider activation | `readBudgetFromEnv`, `canActivateRealProvider`, `DEFAULT_BUDGET_POLICY` | Env keys remain founder-configured; no invented ceilings |
| **Budget Accounting** | `platform/cost-ledger/CostLedger.ts` | Adapter `estimateCost` (per-request estimate only) | Sole financial authority for budgets/sessions/settlement metadata | `CostLedger`, budget kinds, `estimateProvider` | Actuals settle here; estimates may stay near adapters |
| **Validation** | Split: `MockValidator` / `ResponseValidator` (schema); `core/provider-validation/*` (real-provider readiness) | Adapters call request/response validators | Schema validation ≠ readiness gate ≠ lifecycle states | `validateMockRequest`, `RealProviderReadinessGate.evaluate` | Future lifecycle states (REGISTERED→…) remain deferred; not owned by enablement registry |
| **Provider Health** | Per-adapter `ProviderAdapter.healthCheck()` | `BrainRouter` filters `healthyProviders` | Health is adapter-local until a projection is needed for multi-provider | `ProviderHealth` | Registry may later project health read-only; adapters remain source |
| **Reasoning** | `BrainRouter.ts` (+ Skills / ResumeBrainGateway callers) | `ProviderAdapter.execute`, MockProvider | Only orchestrated path for provider reasoning; capability-based requests | `planBrainRoute`, `executeViaMockProvider`, `ReasoningRequest` / `ReasoningResponse` | Second adapter plugs in behind same interface |
| **Safety** | Distributed invariants | `assertOnlyMockActive`, Fallback `never_bypass`, Mock `safety_flags`, LIVE env, boundary verify | Safety is not one module; it is composable policy + flags + static import guard | `safety_flags`, `SOS_AIOS_LIVE≠1`, `provider-authority:verify` | Enforcement expands via verify, not Runtime Guard |

---

## Explicit non-ownership (anti-god-module)

`ProviderRegistry.ts` does **not** own: capabilities, routing, retry, fallback, budget policy, budget accounting, schema validation, health projection, reasoning orchestration.

`CostLedger` does **not** own: routing or enablement.

`CapabilityRegistry` does **not** own: enablement or cost settlement.

---

## Related

- Platform map: `PROVIDER_PLATFORM.md`
- Capability name map: `CAPABILITY_CROSSWALK.md`
- Import boundaries: `BOUNDARY_RULES.md`
- Prior audit: `SOS/09_REPORTS/AIOS_PROVIDER_RECONCILIATION_AUDIT_V1_REPORT.md`
