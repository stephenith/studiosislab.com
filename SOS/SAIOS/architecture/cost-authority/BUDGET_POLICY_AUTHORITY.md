# Activation Budget Policy Authority

**Agent #193**  
**Owner:** `SOS/SAIOS/core/ai-brain/BudgetPolicy.ts`

---

## Owns

- Provider **activation** gating (`canActivateRealProvider`)  
- Environment budget validation (`readBudgetFromEnv`, `SOS_AI_*` keys)  
- Activation ceilings (monthly / daily / per-task / pause / alert — values null until founder sets)  
- Activation safety (`real_provider_activation_allowed` defaults false)

---

## Does NOT own

- Accounting · billing · reporting · cost sessions  
- Per-request token estimation  
- Cost Ledger budget kinds / lifecycle  

---

## Relationship to Cost Ledger

`DEFAULT_BUDGET_POLICY.cost_ledger_path` names a log path for future usage writes. That is a **declared path**, not an import of `platform/cost-ledger`. BrainRouter consumes BudgetPolicy as a gate; it does not import Cost Ledger.

---

## Name collision (documented, not merged)

A second file `platform/cost-ledger/BudgetPolicy.ts` defines **limit metadata** (`BudgetPolicyLimits`, `enforcement_enabled: false`). Different responsibility, same filename. Agent #193 does **not** rename or merge them.

---

## Supporting overlap (known debt, not fixed here)

`core/provider-validation/RealProviderReadinessGate.ts` re-parses overlapping `SOS_AI_*` env keys. Certification notes the duplication; this agent does not consolidate code.
