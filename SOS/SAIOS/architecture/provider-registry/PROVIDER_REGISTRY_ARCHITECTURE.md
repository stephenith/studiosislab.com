# Provider Registry — Architecture

**Documentation only. No implementation. Reconciled Agent #192.**

---

## Position in AIOS

```
Company Brain / Skills
        ↓
   Brain Router          ← sole provider reasoning entrypoint
        ↓
 ┌─────────────────────────────────────┐
 │ AI Brain Provider Platform          │
 │  ProviderRegistry (enablement)      │
 │  CapabilityRegistry                 │
 │  ModelRoutingPolicy                 │
 │  Budget / Retry / Fallback policies │
 │  ProviderValidation                 │
 └─────────────────────────────────────┘
        ↓
 Cost Ledger (budget accounting — separate)
        ↓
 Provider Adapter (Mock today)
        ↓
 External / Local Model (future)
```

Workers and departments **never** call providers directly. Enforced by `provider-authority:verify`.

Execution Controller may authorize *that* a skill may run; it does **not** own the provider catalogue.

---

## Logical components (runtime — certified)

| Component | Role |
|-----------|------|
| ProviderRegistry | Enablement / registration flags only |
| CapabilityRegistry | Capability catalog |
| ModelRoutingPolicy | Routing |
| BrainRouter | Orchestration |
| BudgetPolicy / RetryPolicy / FallbackPolicy | Policies |
| ProviderValidation | Readiness / comparison harness |
| Health | Adapter `healthCheck` |
| Cost Ledger | Financial authority |

Agent #190 did not create modules; Agent #192 certifies existing ones without merging.

---

## Allowed dependencies (future / current)

| From | To |
|------|----|
| Brain Router | Provider Registry (read enablement) |
| Brain Router | ModelRoutingPolicy / BudgetPolicy / FallbackPolicy |
| Provider Adapter | CapabilityRegistry (via supported capabilities) |
| Cost Ledger | Independent (budget accounting) |
| Dashboard | Snapshots (read) |

## Forbidden dependencies

| From | Must not |
|------|----------|
| Worker Runtime | Call providers / OpenAI / Anthropic / Gemini SDKs |
| Department SDK | Hold API keys or provider clients |
| Skills | Bypass Brain Router for external providers |
| Company Brain / Scheduler / Queue / Execution Controller | Import `core/providers` or vendor SDKs |
| Provider Registry | Execute inference |
| Pipeline A | Grow a second provider catalogue |

---

## Data domains (contracts only)

- `provider_id`, enablement, `mode`  
- Capabilities via CapabilityRegistry (`BrainCapability`)  
- Routing via ModelRoutingPolicy  
- No secrets in registry documents or logs  

---

## Relationship to Phase 4 / Authority Certification

Phase 4 activation prerequisites require a certified provider platform before LIVE providers. Agent #192 certifies distributed ownership and boundary enforcement. Full lifecycle/model catalog remains deferred.
