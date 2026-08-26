# Cost Authority — Canonical Ownership

**Agent #193 · Cost Authority Certification V1**  
**Status:** CERTIFIED · Documentation + static enforcement only  
**LIVE:** OFF · **No responsibility mergers · No billing · No execution**

---

## Purpose

This is the single Cost Authority reference for AIOS. It certifies **existing** ownership. It does **not** merge modules, redesign budgeting, or implement billing.

**Invariant:** Estimation ≠ Accounting. Provider estimation is intentionally separate from Cost Ledger accounting.

---

## Permanent authority table

| Authority | Canonical owner | Owns | Does NOT own |
|-----------|-----------------|------|--------------|
| **Activation Budget Policy** | `core/ai-brain/BudgetPolicy.ts` | Provider activation gating; env budget validation; activation ceilings; activation safety | Accounting; billing; reporting; cost sessions |
| **Provider / request estimation** | `ProviderAdapter` implementations (e.g. `MockProvider` → `MockResponseFactory`) | Request estimation; token estimation; provider-specific estimate | Accounting; budgeting; reporting |
| **Financial accounting** | `platform/cost-ledger` | Budgets; cost sessions; accounting; reporting; history; snapshots; sole financial authority | Provider estimation; routing; activation policy; provider validation |
| **Execution lifecycle records** | Execution Controller | Authorization / lifecycle records; may **reference** cost sessions (one stage in distributed model) | Financial ownership; ledger imports; dispatch |
| **Department budgets (consumer)** | Department SDK | Consume department budget allocations (future) | Accounting ownership |
| **Worker cost fields** | Worker Runtime | Passive `estimated_cost` / `cost_session_reference` fields | Estimator; accountant; ledger imports |
| **Mission planning** | Company Brain | Planning / proposing budgets (declared future) | Budgeting runtime; accounting; ledger imports |

---

## Explicit non-mergers

- Do **not** fold `core/ai-brain/BudgetPolicy.ts` into Cost Ledger.  
- Do **not** fold adapter `estimateCost` into Cost Ledger.  
- Do **not** merge the two files both named `BudgetPolicy.ts` (ai-brain activation vs cost-ledger limit metadata) in this agent.  
- Cost Ledger `CostEstimator` remains a **placeholder receiver** (`calculated:false`), not a competing real estimator.

---

## Related

- Boundaries: `FINANCIAL_BOUNDARIES.md`, `IMPORT_BOUNDARIES.md`  
- Estimation vs accounting: `ESTIMATION_VS_ACCOUNTING.md`  
- Detail: `BUDGET_POLICY_AUTHORITY.md`, `COST_LEDGER_AUTHORITY.md`  
- Provider Authority: `../provider-authority/`
