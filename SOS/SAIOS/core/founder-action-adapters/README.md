# Canonical Founder Action Adapters V1

**Agent #225** · Safe Founder Control Layer

## Role

Adapters bridge Mission Control → canonical AIOS owners.

They only: **Validate · Authorize · Delegate · Audit**.

They do **not** own production, scheduling, portfolio, strategy, engineering, or dashboard logic.

## Flow

```
Mission Control → Founder Action Adapter → Canonical Owner → Audit Log → Result
```

## Production entry

Production-mutating actions always enter via `ProductionController.runProduction`
(directly or through `AutonomousProductionService`).

## Safety

- LIVE OFF
- publication_allowed false
- Never bypass Runtime Guard / Health Gate / Budget Governor
- Never modify code, cleanup, or call OpenAI
