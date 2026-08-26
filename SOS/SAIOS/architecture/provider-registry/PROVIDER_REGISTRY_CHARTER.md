# Provider Registry Architecture Charter V1

**Agent #190 · Chief AI Platform Architect**  
**Reconciled:** Agent #192 — distributed Provider Platform (docs only)  
**Status:** DOCUMENTATION · **Providers:** NOT IMPLEMENTED · LIVE OFF  

---

## Purpose

This charter defines how providers will be registered and selected in AIOS. After Agent #191/#192 reconciliation, it describes the **AI Brain Provider Platform** as a **distributed** architecture — not a single god module named ProviderRegistry.

Canonical ownership: `SOS/SAIOS/architecture/provider-authority/PROVIDER_AUTHORITIES.md`.

It does **not** implement providers, adapters, API keys, inference, or LIVE.

---

## AI Brain Provider Platform (distributed)

```
AI Brain Provider Platform
        │
        ├── ProviderRegistry          — provider registration / enablement only
        ├── CapabilityRegistry        — Capability catalog (canonical)
        ├── ModelRoutingPolicy        — routing decisions
        ├── RetryPolicy
        ├── FallbackPolicy
        ├── BudgetPolicy
        ├── ProviderValidation        — readiness / schema validation paths
        └── BrainRouter               — sole reasoning orchestrator
```

Cost Ledger (`platform/cost-ledger`) remains the **One Cost authority** for budget accounting.

---

## Registry Responsibilities (enablement slice)

The runtime module `ProviderRegistry.ts` owns **provider registration / enablement**:

| Responsibility | Owner |
|----------------|-------|
| Provider registration | ProviderRegistry (enablement, mode) |
| Capability catalog | **CapabilityRegistry** (not ProviderRegistry) |
| Model catalog | Deferred (not implemented) |
| Versioning | Deferred / coarse policy versions |
| Routing metadata | **ModelRoutingPolicy** |
| Cost metadata | Adapter estimates + Cost Ledger accounting |
| Validation state | ProviderValidation / validators (lifecycle states deferred) |
| Health state | Per-adapter `healthCheck` |
| Provider lifecycle | Deferred 6-state machine; enablement is binary today |

No department, worker, or skill may own a parallel provider catalogue or call providers directly.

---

## Selection flow

```
Skills
  ↓
Brain Router
  ↓
Provider Registry (enablement) + ModelRoutingPolicy + BudgetPolicy + FallbackPolicy
  ↓
Validation (adapter / ProviderValidation)
  ↓
Cost Policy (Cost Ledger accounting; adapter estimate)
  ↓
Provider Adapter
  ↓
Provider (Mock only today)
```

See `PROVIDER_SELECTION_POLICY.md` and `../provider-authority/PROVIDER_PLATFORM.md`.

---

## Architecture principles

1. **One Provider Registry** (enablement — lightweight)  
2. **One Provider Validation authority** (validation paths — not merged into enablement)  
3. **One Brain Router**  
4. **One Cost authority** (Cost Ledger)  
5. **One Provider lifecycle** (future; enablement ≠ full lifecycle)  
6. **No direct model access**  
7. **No worker-to-provider communication**  

ProviderRegistry does **not** own routing, capabilities, retry, fallback, or budgeting.

---

## Document index

| Document | Role |
|----------|------|
| `PROVIDER_REGISTRY_CHARTER.md` | This charter (reconciled) |
| `PROVIDER_REGISTRY_ARCHITECTURE.md` | Structure & boundaries |
| `PROVIDER_CAPABILITY_MODEL.md` | Capabilities (descriptive; see crosswalk) |
| `PROVIDER_SELECTION_POLICY.md` | Routing policy |
| `PROVIDER_VALIDATION_FLOW.md` | Validation lifecycle (future) |
| `PROVIDER_COST_POLICY.md` | Cost / budgets |
| `PROVIDER_SECURITY_MODEL.md` | Secrets & audit |
| `PROVIDER_FAILURE_MODEL.md` | Failure modes |
| `PROVIDER_LIFECYCLE.md` | Lifecycle states (future) |
| `PROVIDER_REGISTRY_MANIFEST.json` | Machine-readable manifest |
| `README.md` | Entry |
| `verify-provider-registry-charter.ts` | Docs verify |

Authority certification: `../provider-authority/`

---

## Out of scope

**NOT IMPLEMENTED**

- No providers · No adapters · No API keys · No requests/responses  
- No billing · No inference · No execution · No dispatch · No LIVE  

Must not modify Pipeline A, Runtime Guard, or governance semantics.

---

## Related

- Provider Authority Certification — `SOS/SAIOS/architecture/provider-authority/`  
- Phase 4 Execution Charter — `SOS/SAIOS/architecture/phase4-execution/`  
- Reconciliation Audit — Agent #191  

## Next

Agent #193+ may extend enforcement or deferred lifecycle/model catalog — still without enabling LIVE or real providers unless separately authorized.
