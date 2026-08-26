# Cost Ledger Authority

**Agent #193**  
**Owner:** `SOS/SAIOS/platform/cost-ledger`

---

## Owns (sole financial authority scaffold)

| Concern | Module / type |
|---------|----------------|
| Budgets | `Budget.ts`, `BudgetKind`, `BudgetRepository` |
| Cost sessions | `BudgetSession.ts`, `CostSessionContract` |
| Accounting | `CostLedger.ts` register/load/list |
| Reporting | `BudgetReporter.ts` |
| History / persistence | `BudgetRepository` |
| Snapshots | `CostSnapshot.ts` |
| Limit metadata (informational) | `cost-ledger/BudgetPolicy.ts` (`enforcement_enabled: false`) |
| Placeholder estimate receivers | `CostEstimator.ts` (`calculated: false`) |

---

## Does NOT own

- Provider / request / token estimation (adapters)  
- Routing (`ModelRoutingPolicy` / BrainRouter)  
- Activation policy (`ai-brain/BudgetPolicy`)  
- Provider validation (`core/provider-validation`)  
- Billing (`billing_allowed: false`)  
- Execution / dispatch / LIVE  

---

## Declared ownership fields (contracts only)

- `proposed_by: "company_brain"` — Company Brain proposes (future)  
- `owned_by: "execution_controller" | "department"` — session/budget ownership metadata  
- Enforcement: **off** (`isPolicyEnforced` → false)

---

## Import rule

Cost Ledger **must not** import `core/providers`, `ProviderAdapter`, or `BrainRouter`.  
Consumers that need financial data use dashboard snapshots / references — not write-side coupling from EC / Worker / Department / Company Brain.
