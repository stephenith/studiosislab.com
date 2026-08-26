# Founder Operations Dashboard

> **Legacy (Non-Canonical)** — Agent #222A  
> Not the Founder Command Center for the #205–#221 production spine.  
> Do not use `executeFactoryControl` as the autonomous production control path.  
> Canonical Founder UI host: `SOS/SAIOS/dashboard`.  
> Canonical autonomous loop: `AutonomousProductionService` → `ProductionController`.

Single command center for the entire StudiosisLab Resume Factory.

## Purpose

The Founder never needs to browse folders or JSON files manually. Everything is visible from one dashboard.

## Usage

```typescript
import { refreshFounderDashboard, executeFactoryControl } from "./SOS/SAIOS/runtime/founder-dashboard";

const dashboard = await refreshFounderDashboard();
await executeFactoryControl("pause");
```

## Verify

```bash
npm run founder-dashboard:verify
```

## Security

- Read-only for production artifacts
- Never modifies generated resumes or publication packages
- Founder gate always enforced — no auto-publish
