# Financial Boundaries

**Agent #193 · Certified seams**  
**LIVE OFF · No billing · No execution**

---

## Layer map

```
Activation gate          →  core/ai-brain/BudgetPolicy.ts
Request / token estimate →  ProviderAdapter (MockProvider / MockResponseFactory)
Financial authority      →  platform/cost-ledger
Execution lifecycle      →  Execution Controller (reference Cost Sessions only)
Department               →  Department SDK (consumer only)
Worker                   →  Worker Runtime (reference fields only)
Planning                 →  Company Brain (planning only)
```

---

## Hard boundaries

| From | Must not |
|------|----------|
| Execution Controller | Import `platform/cost-ledger`; become financial owner |
| Worker Runtime | Import Cost Ledger; own estimation; own accounting |
| Department SDK | Import Cost Ledger; own accounting |
| Company Brain | Import Cost Ledger; run budgeting or accounting |
| Cost Ledger | Import providers, ProviderAdapter, BrainRouter |
| Provider adapters | Import Cost Ledger |

---

## Soft / declared (future, not wired)

- Company Brain **proposes** budgets (metadata).  
- Execution Controller **owns** cost sessions by contract reference — not by importing the ledger.  
- Department SDK **receives** department budgets.  
- Workers **report** estimates upward; they do not compute financial authority.

---

## Runtime Guard

Runtime Guard owns **execution engines** only. Financial import boundaries are enforced by `cost-authority:verify`, not Runtime Guard.
