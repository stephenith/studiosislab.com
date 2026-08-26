# Provider Validation Flow

**Architectural states only. NOT IMPLEMENTED.**

---

## Lifecycle

```
REGISTERED
  ↓
VALIDATED
  ↓
CERTIFIED
  ↓
ACTIVE
  ↓
DEPRECATED
  ↓
ARCHIVED
```

---

## State meanings

| State | Meaning |
|-------|---------|
| `REGISTERED` | Provider/model identity recorded; not usable |
| `VALIDATED` | Static checks passed (schema, capabilities, cost metadata) |
| `CERTIFIED` | Policy + security review passed; eligible for selection in non-LIVE modes when allowed |
| `ACTIVE` | Permitted for production selection **only if** LIVE and execution policies allow (future) |
| `DEPRECATED` | Must not be newly selected; drain existing |
| `ARCHIVED` | Immutable historical record |

---

## Validation checks (future)

- Schema / checksum integrity  
- Capability catalogue completeness  
- Cost metadata present  
- No secrets inline  
- Adapter binding declared (future)  
- Security posture recorded  

---

## Authority

**One Provider Validation authority** — owned by Provider Registry validation subsystem (future). No parallel validation ledgers in departments.
