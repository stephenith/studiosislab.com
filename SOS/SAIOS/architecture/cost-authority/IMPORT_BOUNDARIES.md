# Cost Authority Import Boundaries

**Agent #193 · Static verification only**  
**Mechanism:** import string scan in `cost-authority:verify`  
**No AST framework · No runtime overhead · Not Runtime Guard**

---

## Forbidden edges

| Consumer root | Must NOT import |
|---------------|-----------------|
| `SOS/SAIOS/runtime/execution-controller/` | `platform/cost-ledger` |
| `SOS/SAIOS/runtime/worker-runtime/` | `platform/cost-ledger` |
| `SOS/SAIOS/platform/department-sdk/` | `platform/cost-ledger` |
| `SOS/SAIOS/core/company-brain/` | `platform/cost-ledger` |
| `SOS/SAIOS/platform/cost-ledger/` | `core/providers`, `ProviderAdapter`, `BrainRouter`, `MockProvider` |
| `SOS/SAIOS/core/providers/` | `platform/cost-ledger` |

---

## Allowed (examples)

| From | To | Why |
|------|----|-----|
| BrainRouter | `ai-brain/BudgetPolicy` | Activation gate only |
| MockProvider | `MockResponseFactory` | Estimation |
| Dashboard plugin | Cost Ledger (read) | Founder visibility |
| Cost Ledger verify | Cost Ledger | Self-verify |

---

## Reference vs import

Worker Runtime / Execution Controller may hold **string references** (`cost_session_reference`, etc.). Those are **not** imports and do **not** violate this boundary.
