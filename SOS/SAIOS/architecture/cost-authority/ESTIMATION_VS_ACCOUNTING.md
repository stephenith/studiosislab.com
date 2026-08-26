# Estimation vs Accounting

**Agent #193 · Required architectural invariant**  
**Estimation ≠ Accounting**

---

## Statement

**Provider estimation is intentionally separate from Cost Ledger accounting.**

This is a required architectural invariant. It must not be collapsed.

---

## Two layers

| Layer | Owner | What it produces | Reality today |
|-------|-------|------------------|---------------|
| **Estimation** | Provider adapters (`estimateCost`, `MockResponseFactory.estimateTokensAndCost`) | Per-request token/cost estimates from request shape | Deterministic mock estimates; `actual_cost_usd: 0` |
| **Accounting** | Cost Ledger (`budgets`, sessions, repository, reporter, snapshots) | Budget records, sessions, history, reporting | Scaffold; `billing_allowed: false`; placeholders `calculated: false` |

---

## Why the split is correct

1. **Only the adapter knows the request.** Moving estimation into Cost Ledger would force the ledger to import provider internals.  
2. **Cost Ledger stays provider-agnostic.** `ProviderEstimatePlaceholder` / `WorkerEstimatePlaceholder` with `calculated: false` model “estimates arrive from elsewhere.”  
3. **CostEstimator in the ledger is a stub receiver**, not a second live estimator — no double-counting today.  
4. **Activation gating** (`ai-brain/BudgetPolicy`) is a third concern: “may real providers activate,” not estimation or accounting.

---

## Forbidden collapses

- Do not move `estimateTokensAndCost` into Cost Ledger.  
- Do not make Cost Ledger import `MockProvider` / adapters.  
- Do not make adapters import Cost Ledger to “self-bill.”  
- Do not treat Cost Ledger `estimateProvider()` placeholders as the real provider estimate path.

---

## Pipe (future — not implemented)

```
Adapter estimateCost
        ↓  (future handoff — not wired)
Cost Ledger session / budget record
        ↓
Reporting / history
```

Today the pipe ends are certified separately; connecting them is a later agent and still must not enable billing or LIVE.
