# AI Brain Provider Platform

**Agent #192 · Distributed architecture (certified)**  
**Runtime behavior:** unchanged · **LIVE:** OFF

---

## What this is

The **AI Brain Provider Platform** is the umbrella for provider-neutral intelligence in AIOS. It is a **distributed** architecture of small, certified modules — not a single `ProviderRegistry` god object.

```
AI Brain Provider Platform
        │
        ├── ProviderRegistry          (enablement only)
        ├── CapabilityRegistry        (capability vocabulary)
        ├── ModelRoutingPolicy        (route decisions)
        ├── RetryPolicy
        ├── FallbackPolicy
        ├── BudgetPolicy              (activation ceilings)
        ├── ProviderValidation        (core/provider-validation — readiness)
        ├── BrainRouter               (orchestrator / sole entrypoint)
        └── Provider adapters         (core/providers/mock — Mock only)
```

Financial settlement lives **outside** the platform in **Cost Ledger** (`platform/cost-ledger`).

---

## Relationships

| From | To | Relationship |
|------|----|--------------|
| Skills / ResumeBrainGateway | BrainRouter | Build `ReasoningRequest`; plan or dry-run execute |
| BrainRouter | ProviderRegistry | Read enablement; force mock when only-mock / dry-run / budget-blocked |
| BrainRouter | ModelRoutingPolicy | `decideRoute` |
| BrainRouter | BudgetPolicy | `canActivateRealProvider` |
| BrainRouter | FallbackPolicy | Safety assertions |
| BrainRouter | CapabilityRegistry | Deterministic-only rejection path |
| BrainRouter | MockProvider (via adapter) | Sole dry-run execute path today |
| MockCapabilities | CapabilityRegistry | Imports lists; does not fork |
| RealProviderReadinessGate | config/provider-registry.json | Reads enablement/credentials flags |
| Cost Ledger | (independent) | Budget kinds / sessions; not imported by BrainRouter |

---

## Call flow (actual)

```
Skills / gateway
  ↓
Brain Router
  ├─ ProviderRegistry (enablement)
  ├─ BudgetPolicy
  ├─ ModelRoutingPolicy
  └─ FallbackPolicy
  ↓
Provider Adapter (MockProvider)
  ├─ MockValidator
  └─ MockResponseFactory (estimate)
  ↓
ReasoningResponse
```

Cost Ledger is **not** an inline hop; it remains the separate financial authority.

---

## Principles (certified)

1. One Brain Router entrypoint for provider reasoning  
2. One lightweight ProviderRegistry (enablement)  
3. One CapabilityRegistry (vocabulary)  
4. One Cost Ledger (financial authority)  
5. Policy modules stay separate (routing / retry / fallback / budget)  
6. No worker / department / company-brain / scheduler / queue / execution-controller → provider imports  
7. No responsibility mergers · No LIVE · No real providers  

---

## Drift correction (Agent #190 charter)

Agent #190 documented an aspirational “sole owner” Provider Registry. Agent #191 audited drift. **This document is authoritative for ownership.** The #190 charter pack is reconciled to describe the platform as distributed — see updated `architecture/provider-registry/` docs.
