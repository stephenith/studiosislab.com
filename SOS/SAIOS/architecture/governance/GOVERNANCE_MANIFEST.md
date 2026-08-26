# Architecture Governance Manifest

**Agent #198 · AIOS Architecture Governance Framework V1**  
**DOCUMENTATION + VERIFICATION ONLY · LIVE OFF · No runtime behaviour**

This is the **single architectural index** for AIOS. It **references** prior declarations and certifications; it does **not** duplicate their content.

---

## Index of certified / declared packages

| ID | Package | Agent | Status | Path |
|----|---------|-------|--------|------|
| G01 | Architecture metadata (frozen registry) | #159–#160 | Frozen | `SOS/SAIOS/architecture/` (`module-roles.json`, `dependency-graph.json`, `runtime-guard.ts`, …) |
| G02 | Phase 3 Foundation | — | Certified | `SOS/SAIOS/architecture/phase3-foundation/` |
| G03 | Phase 3 Planning | #188 | Certified | `SOS/SAIOS/architecture/phase3-planning/` |
| G04 | Phase 4 Execution Charter | #189 | Charter | `SOS/SAIOS/architecture/phase4-execution/` |
| G05 | Provider Registry Charter | #190 | Charter | `SOS/SAIOS/architecture/provider-registry/` |
| G06 | Provider Reconciliation | #191 | Audit complete | `SOS/SAIOS/architecture/provider-reconciliation/` |
| G07 | Provider Authority | #192 | Certified | `SOS/SAIOS/architecture/provider-authority/` |
| G08 | Cost Authority | #193 | Certified | `SOS/SAIOS/architecture/cost-authority/` |
| G09 | Execution Authority Model | #194 | Certified | `SOS/SAIOS/architecture/execution-authority-model/` |
| G10 | Learning & Knowledge Reconciliation | #195 | Audit complete | `SOS/SAIOS/architecture/learning-reconciliation/` |
| G11 | Persistence & Memory Topology | #196 | Inventory complete | `SOS/SAIOS/architecture/persistence-memory-topology/` |
| G12 | Persistence Ownership & Taxonomy | #197 | Declared | `SOS/SAIOS/architecture/persistence-ownership/` |
| G13 | Architecture Governance Framework | #198 | Declared | `SOS/SAIOS/architecture/governance/` |
| G14 | System Integrity Certification | #199 | Certified with findings → resolved | `SOS/SAIOS/architecture/system-integrity/` |
| G15 | Architecture Final Freeze | #200 | **ARCHITECTURE_FROZEN** | `SOS/SAIOS/architecture/final-freeze/` |

---

## Platform / control-plane module references

| Component | Path | Verify |
|-----------|------|--------|
| Platform foundation | `SOS/SAIOS/platform/` | `platform:verify` |
| Dashboard platform | `SOS/SAIOS/platform/dashboard/` | `dashboard-platform:verify` |
| Department SDK | `SOS/SAIOS/platform/department-sdk/` | `department-sdk:verify` |
| Cost Ledger | `SOS/SAIOS/platform/cost-ledger/` | `cost-ledger:verify` |
| Telemetry | `SOS/SAIOS/platform/telemetry/` | `telemetry:verify` |
| Execution Controller | `SOS/SAIOS/runtime/execution-controller/` | `execution-controller:verify` |
| Worker Runtime | `SOS/SAIOS/runtime/worker-runtime/` | `worker-runtime:verify` |
| Activation Gate | `SOS/SAIOS/runtime/activation-gate/` | `activation-gate:verify` |
| Execution Authorization | `SOS/SAIOS/runtime/execution-authorization/` | `execution-authorization:verify` |
| Pre-Dispatch Simulation | `SOS/SAIOS/runtime/pre-dispatch-simulation/` | `pre-dispatch-simulation:verify` |
| Company Brain | `SOS/SAIOS/core/company-brain/` | `company-brain:verify` (+ mission/queue verifies) |
| Knowledge | `SOS/SAIOS/core/knowledge/` | `knowledge-system:verify` |
| Founder Learning | `SOS/SAIOS/core/knowledge-learning/` | via `founder-learning:verify` / knowledge-learning surfaces |
| Runtime Guard | `SOS/SAIOS/architecture/runtime-guard.ts` | enforced via canonical entrypoints |

---

## Governance documents in this package

| Document | Role |
|----------|------|
| [AUTHORITIES.md](./AUTHORITIES.md) | Layers, authorities, responsibilities, ownership |
| [GOVERNANCE_MATRIX.md](./GOVERNANCE_MATRIX.md) | Per-authority matrix |
| [VERIFICATION_MATRIX.md](./VERIFICATION_MATRIX.md) | All verify scripts ↔ authorities |
| [DEPENDENCIES.md](./DEPENDENCIES.md) | Architectural dependencies & contracts |
| [FREEZE_POLICY.md](./FREEZE_POLICY.md) | Freeze / evolve / Founder approval |
| [EXTENSION_POLICY.md](./EXTENSION_POLICY.md) | How future agents extend AIOS |
| [ARCHITECTURE.json](./ARCHITECTURE.json) | Machine index |
| [verify-architecture-governance.ts](./verify-architecture-governance.ts) | Governance verify |

---

## Non-goals (explicit)

This framework does **not**: introduce new architecture; introduce new governance rules beyond consolidation; migrate persistence; adopt MemoryService or BaseAppendOnlyRepository; enable LIVE; enable execution.
