# SAIOS Runtime v1.0

**Status:** Job Queue v1 implemented. Other modules remain interface skeletons.

| Module | Status |
|--------|--------|
| `queue/` | **Production** — `QueueManager`, JSON persistence, verify |
| `registry/` | **Production** — `RegistryManager`, worker JSON, verify |
| Other modules | Interface skeleton only |

This tree is the **only future orchestration layer** for StudiosisLab AI operations.

## Modules

| Folder | Interface | Role |
|--------|-----------|------|
| `chief/` | `ChiefService` | Founder intake, planning, monitoring |
| `registry/` | `RegistryService` | Worker registration |
| `queue/` | `QueueService` | Job lifecycle |
| `cursor/` | `CursorRunnerService` | Cursor execution boundary |
| `qa/` | `QARunnerService` | Verification |
| `memory/` | `MemoryService` | Session / project / long-term |
| `knowledge/` | `KnowledgeService` | Knowledge snapshots |
| `reporter/` | `ReporterService` | Progress / completion / failure reports |
| `notifications/` | `NotificationService` | Telegram, email, Slack (placeholder) |
| `shared/` | — | Common types and IDs |
| `config/` | `SaiosConfigLoader` | Central configuration |
| `logs/` | `LogService` | Structured logging paths |

## Entry point

```typescript
import { SAIOS_RUNTIME_VERSION } from "./index.js";
import type { ChiefService, QueueService } from "./index.js";
```

## Constraints

- No Cursor spawning
- No PM / Developer / QA legacy imports
- No product (`src/`) changes
- Implementation begins in v1.1 per `../EXPANSION.md`

## Architecture reference

- [../ARCHITECTURE.md](../ARCHITECTURE.md)
- [../interfaces/types.ts](../interfaces/types.ts) — design-time contracts (parallel to runtime types)
