# Authorities

**Agent #198 · Architecture Governance Framework V1**  
**Consolidation only — references prior certifications · LIVE OFF**

---

## Architecture Layers

| Layer | Scope | Primary homes |
|-------|-------|---------------|
| **Architecture metadata** | Roles, graphs, Runtime Guard, governance docs | `SOS/SAIOS/architecture/` |
| **Core / Pipeline A** | Only execution engine; knowledge; founder gates; company-brain planning | `SOS/SAIOS/core/*` |
| **Runtime / Pipeline B** | Orchestration, workers, services, control-plane stages | `SOS/SAIOS/runtime/*` |
| **Platform** | Shared repos, department SDK, cost ledger, telemetry, dashboard plugins | `SOS/SAIOS/platform/*` |
| **Dashboard** | Founder UI (read + local founder actions as already certified) | `SOS/SAIOS/dashboard/` |
| **Persistence taxonomy** | Declared store categories (#197) | `persistence-ownership/` |

Canonical engine rule (Agent #159): **Pipeline A is the only execution engine**; Pipeline B is orchestration + workers + services.

---

## Architecture Authorities (canonical roster)

| Authority | Sole owner (reference) | Declared by |
|-----------|------------------------|-------------|
| Knowledge Authority | `core/knowledge` | #195/#196/#197 |
| Founder Learning Authority | `core/knowledge-learning` | #195/#197 |
| Department Learning Authorities | One module per store | #197 |
| Provider Authority (platform) | Provider Platform / registry model | #190–#192 |
| Cost Authority (accounting) | `platform/cost-ledger` | #193 |
| Budget / estimation policy | `core/ai-brain` BudgetPolicy (estimation ≠ accounting) | #193 |
| Execution Authority Model | **Distributed** — no single execution authority | #194 |
| Planning (Company Brain) | `core/company-brain` | #194 / Phase 3 |
| Activation / eligibility | `runtime/activation-gate` | #194 |
| Founder intent / authorization | `runtime/execution-authorization` | #194 |
| Simulation | `runtime/pre-dispatch-simulation` | #187/#194 |
| Authorization record | `runtime/execution-controller` (one stage, not sole executor) | #194 |
| Worker contracts | `runtime/worker-runtime` | Phase 2/3 |
| Department capabilities | `platform/department-sdk` | Phase 2/3 |
| Telemetry Authority | `platform/telemetry` | Platform + #196/#197 |
| Persistence taxonomy declaration | `architecture/persistence-ownership` | #197 |
| Architecture Governance | `architecture/governance` (this package, docs only) | #198 |
| Engine enforcement | `architecture/runtime-guard.ts` | #160 |

---

## Architectural Responsibilities (consolidated)

| Concern | Responsible authority | Must not absorb |
|---------|----------------------|-----------------|
| Authoritative knowledge | Knowledge Authority | Learning stores, telemetry, artifacts |
| Founder-decision learning | Founder Learning Authority | Department learning, Knowledge Authority itself |
| Department preference/rules | Department Learning Authorities | Knowledge Authority |
| Provider routing / capability | Provider Authority | Cost ledger accounting |
| Cost accounting | Cost Authority | Provider estimation |
| Stage decisions (plan→auth record) | Distributed Execution Authority Model | Central “god executor” |
| Observability | Telemetry Authority | Learning / Knowledge |
| Persistence classification | Persistence Ownership Declaration | Runtime writes |
| Freeze / legacy engine blocks | Runtime Guard | Business logic ownership |

---

## Architectural Ownership

Ownership is **exclusive** per authority as declared in:

- `persistence-ownership/OWNERSHIP_MODEL.md`  
- `execution-authority-model/` decision owners  
- `cost-authority/`  
- `provider-authority/`  

**No ownership overlaps** are introduced by this framework. Conflicts discovered in prior audits remain recorded as **exceptions** (see Persistence Ownership EXCEPTIONS.md; Execution Authority Model docs).

---

## Architectural Dependencies

See [DEPENDENCIES.md](./DEPENDENCIES.md). High-level:

```
Founder Decisions → Founder Learning → Knowledge
Company Brain (plan) → Activation → Authorization → Simulation → Execution Controller (STOP)
Skills → Brain Router → Provider   (reasoning)
Estimation (BudgetPolicy / adapters)  ≠  Accounting (Cost Ledger)
```

---

## Architectural Contracts

| Contract family | Where declared |
|-----------------|----------------|
| Module roles / forbidden deps | `module-roles.json` |
| Dependency graph feeds | `dependency-graph.json` |
| Artifact contracts | `contracts.json` |
| Persistence taxonomy | `persistence-ownership/PERSISTENCE_TAXONOMY.md` |
| Execution chain termination | `execution-authority-model` (chain ends at controller; no dispatch) |
| Estimation ≠ accounting | `cost-authority` |
| Provider platform boundaries | `provider-authority` |

---

## Architectural Exceptions

Referenced, not rewritten:

- Persistence EXCEPTIONS E1–E10 (`persistence-ownership/EXCEPTIONS.md`)  
- Execution Controller is **not** sole execution authority (#194)  
- Founder Critic LEGACY (#195/#197)  
- MemoryService orphaned (#196/#197)  
- Scheduler Operational Memory under SERVICE role (#196/#197)  
- design-memory cross-cutting reads (#196/#197)  

---

## Architectural Freeze Areas / Extension Areas

See [FREEZE_POLICY.md](./FREEZE_POLICY.md) and [EXTENSION_POLICY.md](./EXTENSION_POLICY.md).

---

## Architectural Verification Requirements

Every authority listed in [GOVERNANCE_MATRIX.md](./GOVERNANCE_MATRIX.md) must retain its verify script(s).  
Master index verify: `npm run architecture-governance:verify`.
