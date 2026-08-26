# Freeze Policy

**Agent #198 · Architecture Governance Framework V1**  
Documentation of freeze vs evolve — **no new freeze enforcement code** in this agent.

---

## Frozen modules / mechanisms

| Item | Freeze meaning | Reference |
|------|----------------|-----------|
| Pipeline A as sole execution engine | Must not create a second engine | Architecture README / #159 |
| Runtime Guard | Legacy engine primary entry blocked unless allow flag | `runtime-guard.ts` |
| Architecture metadata intent | Roles/graph are governance truth; change only with architecture review | `architecture/ARCHITECTURE.json` note `frozen: true` |
| LIVE default OFF | Execution remains impossible without explicit future Founder enablement | All Phase 3/4 / authority certs |
| Execution chain STOP at controller | No post-controller dispatch in certified model | #194 |
| Estimation ≠ accounting | Must not merge Cost Ledger into providers | #193 |

---

## Frozen contracts / schemas / APIs (governance sense)

| Area | Policy |
|------|--------|
| Certified authority boundaries | Do not quietly reverse Provider / Cost / Execution / Persistence declarations |
| Persistence taxonomy categories (#197) | Do not rename categories without architecture review |
| Knowledge six-domain ownership policies | Treat as frozen contract unless Founder-approved knowledge agent |
| BaseAppendOnlyRepository public helpers | Platform foundation — evolve only via platform agents with review |
| MemoryService types | Orphaned; **do not implement** under guise of governance |

**This agent does not freeze new schemas in code.** It records policy only.

---

## Frozen persistence (policy)

| Policy | Meaning |
|--------|---------|
| No persistence migrations by governance agents | Stores stay where #196 inventoried them |
| No MemoryService adoption by governance | E1 remains orphan until a dedicated, approved agent |
| No BaseAppendOnly adoption by governance | Learning layer stays as declared (#197) |

---

## Modules allowed to evolve (with normal engineering process)

- Individual department workers **within** their declared ownership  
- Dashboard UI presentation (not authority ownership)  
- Report/markdown regenerators  
- Mission scripts under missions/  
- Verify harnesses that strengthen **existing** boundaries (docs+static), without expanding authority  

---

## Modules requiring Founder approval

- Enabling `SOS_AIOS_LIVE=1` / any LIVE execution path  
- Allowing legacy engine as primary (`SOS_AIOS_ALLOW_LEGACY_ENGINE`) for production use  
- Publishing / going live with publication packages  
- Creating a new execution engine  
- Crowning a single Learning Authority or merging all department learning into Knowledge  

---

## Modules requiring architecture review (before change)

- `module-roles.json` / `dependency-graph.json` role or feed changes  
- Runtime Guard behaviour  
- Company Brain planning contracts  
- Execution Controller role description vs #194 model  
- Cost Ledger ↔ provider edges  
- Adding a new persistence surface category  
- Implementing MemoryService or mass BaseAppendOnly migration  
- Scheduler learning store ownership changes  

---

## Explicit non-action of Agent #198

Does **not** modify Runtime Guard, module-roles, dependency-graph, or any frozen module code.
