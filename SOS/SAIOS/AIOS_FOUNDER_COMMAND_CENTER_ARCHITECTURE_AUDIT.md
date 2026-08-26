# AIOS Founder Command Center Architecture Audit

**Agent:** #222A (Phase 0)  
**Mode:** Architecture Audit (authoritative context for Command Center foundation)  
**LIVE:** OFF  
**publication_allowed:** false  

## 1. Executive summary

The canonical autonomous factory spine (#205–#221) already owns production, planning, health, budget, scheduling, operations aggregation, and advisory analysis. Multiple legacy “founder command” surfaces exist (`runtime/founder-control-center`, `runtime/founder-dashboard`) and must **not** become production authority. The React dashboard under `SOS/SAIOS/dashboard` is the correct Founder-facing host; Founder Review UI remains canonical for approvals.

**Founder Command Center** should be a thin read-only (foundation) then action-dispatch (later) façade over the spine — never a duplicate engine.

## 2. Current architecture

```
AutonomousProductionService
  → ProductionController.runProduction
  → HealthGate → BudgetGovernor → BatchRunner
  → … → WAITING_FOUNDER (FounderGateRuntime)
OperationsDashboard / AdaptiveScheduling / PolicyAdvisor (read-only or interval-only)
React Dashboard (Founder Review + Mission Control)
Legacy: founder-control-center (#108), founder-dashboard (scheduler controls)
```

## 3. Existing capabilities

| Area | Capability |
|------|------------|
| Production | `runProduction`, execution reports |
| Autonomous | start/stop/status CLI |
| Founder Review | Registry projection + `/api/founder-decision` |
| Portfolio / Strategy / Budget / Schedule / Ops / Advisor | Dedicated reports + `aios:*:run` CLIs |
| Dashboard | Snapshot API, Founder Review UI |

## 4. Ownership map

| Concern | Canonical owner |
|---------|-----------------|
| Production entry | ProductionController |
| Batch | BatchRunner (via Controller only) |
| Autonomous loop | AutonomousProductionService |
| Health / Budget / Schedule | HealthGate / BudgetGovernor / AdaptiveSchedulingPolicy |
| Portfolio / Strategy / Intake | PortfolioPlanner / StrategyEngine / StrategyIntake |
| Ops metrics / Advice | OperationsDashboard / OperationalPolicyAdvisor |
| WAITING_FOUNDER truth | Candidate Registry |
| Founder decisions | FounderGateRuntime + founder-decisions |
| Founder UI host | `SOS/SAIOS/dashboard` |

## 5. Reusable services

All `aios:*:run/status` CLIs and their JSON reports; `loadWaitingCandidatesFromRegistry`; FounderGateRuntime; Ops Dashboard schema; Advisor recommendations as inbox (later apply).

## 6. Missing services

Unified Command Center over the #205–#221 spine; safe Founder action adapters; advisor apply workflow; policy overlay; intentional legacy deprecation bridge.

## 7. Risks

Duplicating production ownership; wiring legacy `executeFactoryControl` (scheduler) instead of AutonomousService; silent policy mutation; inventing zeros when reports are missing.

## 8. Recommended Founder Command Center architecture

Thin façade: read aggregation + (later) dispatch to existing owners. Never import BatchRunner for execution. Preserve React dashboard UX. Mark legacy FCC/dashboard packages non-canonical for spine production.

## 9. Proposed implementation phases

1. Persist audit + foundation snapshot/API/overview (Agent #222A) — **this phase**  
2. Action adapters (produce / autonomous lifecycle) — #222B+  
3. Advisor inbox apply with explicit confirm  
4. Legacy redirect/deprecation  
5. Integrity hardening  

## 10. Final recommendation

Build Command Center on `SOS/SAIOS/dashboard`, consume spine reports only, keep Founder Review unchanged, defer all mutating actions from foundation V1.
