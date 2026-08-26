# Dependencies

**Agent #198 · Architecture Governance Framework V1**  
Architectural dependencies and contracts — consolidated references only.

---

## Dependency matrix (authorities)

| From | To | Nature |
|------|----|--------|
| Founder Decisions (History) | Founder Learning | feeds |
| Founder Learning | Knowledge | mergeFounderLearningFromDisk |
| Company Brain | Activation Gate | plan / eligibility input |
| Activation Gate | Execution Authorization | eligibility → intent |
| Execution Authorization | Pre-Dispatch Simulation | auth → simulate |
| Pre-Dispatch Simulation | Execution Controller | simulate → authorization record |
| Execution Controller | — | **STOP** (no dispatch) |
| Skills | Brain Router | reasoning |
| Brain Router | Provider | reasoning |
| BudgetPolicy / Provider estimate | Cost Ledger | **forbidden write edge** (estimation ≠ accounting) |
| Department Learning | Knowledge / Founder Learning | **no feed** (declared) |
| Telemetry | Knowledge | none |
| Dashboard Platform | Control-plane `latest-*` | read snapshots |
| Persistence Ownership (#197) | Inventory (#196) | documentation depends on census |
| Governance (#198) | All certified packages | index depends on references |

---

## Contracts (where defined)

| Contract | Location |
|----------|----------|
| Module roles / forbidden deps | `architecture/module-roles.json` |
| Feeds / depends graph | `architecture/dependency-graph.json` |
| Artifact producer/consumer | `architecture/contracts.json` |
| Entrypoints | `architecture/entrypoints.json` |
| Execution engines inventory | `architecture/execution-engines.json` |
| Persistence taxonomy | `persistence-ownership/PERSISTENCE_TAXONOMY.md` |
| Persistence surfaces registry | `persistence-ownership/SURFACES.json` |
| Phase 3 spine | `phase3-foundation/PHASE3_SPINE_MANIFEST.json` |
| Phase 4 charter manifest | `phase4-execution/PHASE4_EXECUTION_MANIFEST.json` |
| Provider boundaries | `provider-authority/*` |
| Cost boundaries | `cost-authority/*` |
| Execution boundaries | `execution-authority-model/*` |

---

## Explicit non-dependencies (safety)

- Execution Controller ↛ Cost Ledger (write)  
- Worker Runtime ↛ Cost Ledger  
- Department SDK ↛ Cost Ledger  
- Company Brain ↛ Cost Ledger  
- Cost Ledger ↛ Providers / Brain Router  
- Runtime learning stores ↛ Knowledge Authority (direct write)  
- Governance package ↛ runtime modules (no code edges)
