# Provider Cost Policy

**Documentation only. No billing.**

---

## Ownership

**Cost Ledger** remains the sole budget authority.  
**Provider Registry** owns cost *metadata* (unit rates, quota labels) attached to providers/models.

---

## Documented concepts

| Concept | Meaning |
|---------|---------|
| Token accounting | Count estimated/actual tokens (future actuals) |
| Budget ownership | Cost Ledger budgets (mission / department / daily / monthly / reserve) |
| Provider quotas | Per-provider caps declared in Registry, enforced by Cost Ledger |
| Mission budgeting | Mission-scoped reservation |
| Department budgeting | Department-scoped reservation |
| Daily limits | Rolling day caps |
| Monthly limits | Calendar month caps |
| Emergency reserve | Founder-controlled reserve budget |

---

## Flow (future)

```
Selection candidate
  ↓
Cost metadata from Registry
  ↓
Cost Ledger reservation
  ↓
(Adapter invoke — future)
  ↓
Consumption record
  ↓
Settlement / audit
```

Today: Pre-Dispatch Simulation and Cost Ledger scaffolds estimate only — `billing=false`, `spend=false`.

---

## Hard rules

- No billing implementation in this charter.  
- No provider may self-bill outside Cost Ledger.  
- Exhausted budget → selection failure (see Failure Model).
