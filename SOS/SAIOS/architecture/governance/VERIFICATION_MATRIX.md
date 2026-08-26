# Verification Matrix

**Agent #198 · Architecture Governance Framework V1**  
Lists verify scripts and classifies them. Cross-references the authority they protect.

---

## A. Architecture / Governance verifies (primary)

| npm script | Class | Protects |
|------------|-------|----------|
| `architecture-governance:verify` | Architecture / Governance | This framework (master index) |
| `phase3-foundation:verify` | Foundation / Planning | Phase 3 foundation spine |
| `phase3-planning:verify` | Planning | Phase 3 planning certification |
| `phase4-charter:verify` | Execution / Architecture | Phase 4 execution charter (docs) |
| `provider-registry-charter:verify` | Provider / Architecture | Provider registry charter |
| `provider-reconciliation:verify` | Provider / Governance | Provider reconciliation audit |
| `provider-authority:verify` | Provider / Governance | Provider Authority boundaries |
| `cost-authority:verify` | Cost / Governance | Cost Authority / estimation≠accounting |
| `execution-authority-model:verify` | Execution / Governance | Distributed execution model |
| `learning-reconciliation:verify` | Learning / Knowledge / Governance | Learning & knowledge audit |
| `persistence-memory-topology:verify` | Persistence / Architecture | Persistence inventory (#196) |
| `persistence-ownership:verify` | Persistence / Governance | Ownership & taxonomy (#197) |

---

## B. Platform / control-plane verifies

| npm script | Class | Protects |
|------------|-------|----------|
| `platform:verify` | Platform / Foundation | Platform shared repos / BaseAppendOnly harness |
| `dashboard-platform:verify` | Dashboard / Platform | Dashboard plugin platform |
| `department-sdk:verify` | Department / Platform | Department capability registry |
| `cost-ledger:verify` | Cost | Cost ledger module |
| `telemetry:verify` | Telemetry | Telemetry registry |
| `execution-controller:verify` | Execution | Execution controller records |
| `worker-runtime:verify` | Execution / Department | Worker runtime contracts |
| `activation-gate:verify` | Execution / Planning | Activation gate |
| `execution-authorization:verify` | Execution | Execution authorization |
| `pre-dispatch-simulation:verify` | Planning / Execution | Pre-dispatch simulation (no execute) |
| `shadow-queue:verify` | Execution / Platform | Shadow queue |
| `runtime-plan:verify` | Planning | Runtime plan |
| `runtime-release:verify` | Execution | Runtime release snapshots |
| `system-readiness:verify` | Execution / Safety | System readiness |

---

## C. Core / Knowledge / Safety verifies

| npm script | Class | Protects |
|------------|-------|----------|
| `knowledge-system:verify` | Knowledge | Knowledge Authority |
| `founder-learning:verify` | Learning / Knowledge | Founder decisions → learning path |
| `founder-gate-runtime:verify` | Safety / Execution | Founder gate waiting cycles |
| `critic-gate:verify` | Safety / Learning | Critic gate |
| `resume-critic:verify` | Safety | Resume critic |
| `company-brain:verify` | Planning / Execution | Company Brain |
| `mission-approval:verify` | Planning | Mission approval |
| `queue-admission:verify` | Planning | Queue admission |
| `execution-package:verify` | Planning | Execution package |
| `execution-package-ack:verify` | Planning | Execution package ack |
| `queue-submission:verify` | Planning | Queue submission |
| `aios:canonical:verify` | Safety / Architecture | Canonical Pipeline A entry |
| `ai-brain-architecture:verify` | Provider / Foundation | AI brain / budget policy surface |
| `skill-library:verify` | Provider / Foundation | Skills |
| `mock-provider:verify` | Provider | Mock provider |
| `provider-validation:verify` | Provider | Provider validation package |

---

## D. Department / worker / product verifies (selected)

| npm script | Class | Protects |
|------------|-------|----------|
| `learning:verify` | Learning / Department | Resume learning worker |
| `design-brain:verify` | Learning / Department | Design brain |
| `composer:verify` | Learning / Department | Adaptive composer |
| `benchmark:verify` | Learning / Department | Benchmark |
| `publication:verify` | Department | Publication |
| `competitive-validation:verify` | Department / Learning | Competitive validation |
| `visual-render:verify` | Department / Learning | Visual render |
| `scheduler:verify` | Execution / Department | Scheduler (incl. Operational Memory exception) |
| `research:verify` | Department | Research |
| `founder-critic:verify` | Legacy / Safety | Founder critic (LEGACY) |
| `website-department:verify` | Department | Website department |
| `aios-dashboard:verify` | Dashboard | Dashboard app |
| `founder-review-ui:verify` | Dashboard | Founder review UI |

---

## Classification legend

Foundation · Governance · Platform · Execution · Planning · Persistence · Knowledge · Learning · Provider · Cost · Telemetry · Dashboard · Department · Safety · Architecture

A script may carry a primary class (first listed) and a secondary class.

---

## Governance requirement

Architecture governance verify must confirm that **all primary architecture/governance package verifies** in section A exist in `package.json` and that their package directories exist on disk. It does **not** re-run every script (documentation + reference integrity only).
