# Governance Matrix

**Agent #198 · Architecture Governance Framework V1**  
For every architectural authority: owner, purpose, allowed/forbidden responsibilities, verify scripts, dependencies, status, lifecycle, maturity.

| Authority | Owner | Purpose | Allowed | Forbidden | Verify script(s) | Dependencies | Status | Lifecycle | Maturity |
|-----------|-------|---------|---------|-----------|------------------|--------------|--------|-----------|----------|
| Knowledge Authority | `core/knowledge` | Six-domain authoritative knowledge | Domain upsert; merge founder learning | Absorbing department learning; runtime ad-hoc writes into knowledge | `knowledge-system:verify` | Founder Learning (read merge) | Certified / Declared | Active | High |
| Founder Learning Authority | `core/knowledge-learning` | Decision-derived learning entries | Write from FounderDecision; provisional critic flags | Becoming Knowledge Authority; owning department stores | `founder-learning:verify`; inventory via `persistence-ownership:verify` | founder-decisions; feeds knowledge | Declared | Active | High |
| Department Learning Authorities | Per-module (resume-learning, design-brain, …) | Local preference/rule/score stores | Own `*-learning.json` / design-memory hub | Writing Knowledge / Founder Learning | Module verifies + `persistence-ownership:verify` | Local workers only | Declared (+ exceptions) | Active | Medium |
| Provider Authority | Provider Platform / registry model | Provider capability & routing governance | Registry/capability boundaries | Absorbing cost accounting; direct bypass of Skills→Router→Provider where forbidden | `provider-authority:verify`, `provider-registry-charter:verify`, `provider-reconciliation:verify` | ai-brain / skills / mock provider | Certified | Active | High |
| Cost Authority (accounting) | `platform/cost-ledger` | Financial accounting of cost | Ledger/budgets persistence | Estimation; provider routing | `cost-authority:verify`, `cost-ledger:verify` | Isolated from providers/execution writers per #193 | Certified | Active | High |
| Budget / estimation policy | `core/ai-brain` BudgetPolicy | Estimation & activation budget policy | Estimate; policy checks | Ledger accounting | `cost-authority:verify`, `ai-brain-architecture:verify` | providers (estimate) | Certified | Active | High |
| Execution Authority Model | Distributed stage owners | Stage ownership without central executor | Own one stage | Claiming sole execution authority; dispatch after controller | `execution-authority-model:verify` | Phase 3/4, cost, provider | Certified | Active | High |
| Company Brain (planning) | `core/company-brain` | Mission/plan/queue admission packages | Plan & package | Dispatch/spawn workers; cost ledger write | `company-brain:verify`, mission/queue verifies | Shadow queue, planner | Certified spine | Active | High |
| Activation Gate | `runtime/activation-gate` | Eligibility | Gate decisions | Provider activation; learning writes | `activation-gate:verify` | Upstream plan | Certified | Active | High |
| Execution Authorization | `runtime/execution-authorization` | Founder intent / auth records | Authorization snapshots | Dispatch; cost ledger | `execution-authorization:verify` | Activation | Certified | Active | High |
| Pre-Dispatch Simulation | `runtime/pre-dispatch-simulation` | Simulation only | Simulate | Execute/dispatch | `pre-dispatch-simulation:verify` | Authorization | Certified | Active | High |
| Execution Controller | `runtime/execution-controller` | Authorization **record** owner (one stage) | Record auth; terminate chain | Sole executor; post-controller dispatch | `execution-controller:verify`, `execution-authority-model:verify` | Simulation | Certified | Active | High |
| Worker Runtime | `runtime/worker-runtime` | Worker contracts/registry | Contract persistence | Becoming Learning Authority | `worker-runtime:verify` | Department SDK | Certified | Active | High |
| Department SDK | `platform/department-sdk` | Department capability registry | Registry snapshots | Cost ledger; provider ownership | `department-sdk:verify` | Platform | Certified | Active | High |
| Telemetry Authority | `platform/telemetry` | Observability registry | Telemetry sessions | Knowledge/Learning authority | `telemetry:verify` | Platform | Certified | Active | High |
| Queue (shadow) | `runtime/queue` | Queue infrastructure | Shadow queue snapshots | Decision ownership of plan | `shadow-queue:verify` | Company brain packages | Certified | Active | High |
| Scheduler (infra) | `runtime/scheduler` | Scheduling infrastructure | Schedule state/config | Learning Authority (Operational Memory exception declared) | `scheduler:verify` | Queue | Active + Exception | Active | Medium |
| Runtime Guard | `architecture/runtime-guard.ts` | Freeze legacy engines / entrypoints | Block legacy primary entry | Owning business domains | `aios:canonical:verify` / guard usage | Architecture metadata | Frozen | Frozen | High |
| Persistence Ownership | `architecture/persistence-ownership` | Taxonomy + ownership declaration | Docs + verify | Migrations; MemoryService impl | `persistence-ownership:verify` | #196 inventory | Declared | Active | High |
| Persistence Inventory | `architecture/persistence-memory-topology` | 42-surface census | Docs + verify | Runtime changes | `persistence-memory-topology:verify` | — | Complete | Active | High |
| Learning Reconciliation | `architecture/learning-reconciliation` | Learning/knowledge audit | Docs + verify | Crowning single Learning Authority | `learning-reconciliation:verify` | knowledge modules | Complete | Active | Medium |
| Phase 3 Foundation | `architecture/phase3-foundation` | Phase 3 spine | Docs + verify | Execution enablement | `phase3-foundation:verify` | Control-plane modules | Certified | Active | High |
| Phase 3 Planning | `architecture/phase3-planning` | Planning certification | Docs + verify | Execution | `phase3-planning:verify` | Phase 3 foundation | Certified | Active | High |
| Phase 4 Charter | `architecture/phase4-execution` | Execution architecture charter (docs) | Charter docs | Enabling LIVE/dispatch | `phase4-charter:verify` | Phase 3 | Charter | Documented | High |
| Platform Foundation | `platform/` | Shared fs/repos/verify harness | Platform helpers | Domain ownership takeover | `platform:verify` | — | Certified | Active | High |
| Dashboard Platform | `platform/dashboard` | Dashboard plugin platform | Read snapshots | Enabling LIVE execution | `dashboard-platform:verify` | Control-plane latest-* | Certified | Active | High |
| Architecture Governance | `architecture/governance` | Master index | Reference + verify | New runtime rules; new architecture | `architecture-governance:verify` | All above | Declared | Active | High |

**Maturity legend:** High = certified/declared with verify; Medium = declared with known exceptions; Low = not used.
