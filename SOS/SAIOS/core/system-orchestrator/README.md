# Canonical System Orchestrator V1

**Agent #226** · Unified AIOS Coordination Layer

## Role

Coordinates AIOS lifecycle. Owns **coordination only**.

Does **not** own: production, scheduling, budget, health, portfolio, strategy, engineering, Mission Control, Founder Review, or Runtime Guard.

## Flow

```
Founder Action → System Orchestrator → Canonical Owners → Audit → Mission Control
```

Production always enters via `ProductionController.runProduction`.

## Events

SYSTEM_STARTED · RUN_REQUESTED · RUN_VALIDATED · RUN_BLOCKED · RUN_STARTED · RUN_COMPLETED · RUN_FAILED · RUN_CANCELLED · ENGINEERING_REFRESHED · PORTFOLIO_REFRESHED · MISSION_CONTROL_REFRESHED · SYSTEM_IDLE · RETRY_EVALUATED
