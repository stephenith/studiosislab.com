# Studiosis AI Operating System (SAIOS) — Version 1

**Codename:** SAIOS  
**Version:** 1.0.0 (foundation)  
**Status:** Architecture only — no execution runtime shipped in v1  
**Owner:** Commander (Chief AI layer)

---

## What SAIOS is

SAIOS is the **orchestration operating system** for StudiosisLab. The Founder communicates only with **Chief AI** (the evolution of Commander). Chief AI never writes production code. All implementation is delegated to **Cursor Agent workers** supervised through registered runners.

```
Founder → Chief AI → Job Queue → Agent Registry → Runners (Cursor / QA) → Verification → Founder
```

## What SAIOS is not (v1)

- Not a replacement for `SOS/runtime/` PM/Developer workers (legacy; frozen for migration)
- Not product code under `src/`
- Not an execution engine in v1 — interfaces and docs only

## Documentation map

| Document | Purpose |
|----------|---------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System overview, principles, component diagram |
| [LAYOUT.md](./LAYOUT.md) | Directory layout (docs, logs, knowledge, future runtime) |
| [LIFECYCLE.md](./LIFECYCLE.md) | Job and worker state machines |
| [INTERACTIONS.md](./INTERACTIONS.md) | End-to-end interaction flows |
| [EXPANSION.md](./EXPANSION.md) | v2+ roadmap (Postgres, SDK, parallel workers) |
| [interfaces/](./interfaces/) | TypeScript contracts (skeleton, no implementation) |
| [modules/](./modules/) | Per-module responsibilities and boundaries |

## Core modules (v1)

1. [Chief AI](./modules/chief-ai.md) — intent, planning, delegation, progress, notify
2. [Agent Registry](./modules/agent-registry.md) — worker types, instances, capabilities
3. [Job Queue](./modules/job-queue.md) — durable work units and dependencies
4. [Cursor Runner](./modules/cursor-runner.md) — Cursor Agent CLI execution boundary
5. [QA Runner](./modules/qa-runner.md) — verification-only workers
6. [Memory](./modules/memory.md) — long-term, project, session memory
7. [Knowledge Base](./modules/knowledge-base.md) — canonical knowledge locations

## Design principles

1. **Chief AI orchestrates; workers execute.** No code edits in the orchestration layer.
2. **Jobs are the unit of work.** Every founder command becomes one or more jobs.
3. **Runners are thin.** Cursor Runner spawns `cursor agent`; it does not implement features.
4. **Registry is authoritative** for what workers exist and what they can do.
5. **Memory is layered.** Session → project → long-term; never conflate.
6. **Knowledge is read-mostly.** Workers receive snapshots; Chief AI curates updates.
7. **Reversible migration.** Legacy `SOS/runtime/` continues until SAIOS runners are proven.

## Relation to legacy Commander

| Legacy (`SOS/runtime/`) | SAIOS v1 |
|-------------------------|----------|
| Commander supervisor + PM/Developer/QA loops | Chief AI + Job Queue + Runners |
| Developer `strategies/*` (Node code execution) | Cursor Runner (`cursor agent --print`) |
| QA `verifier.ts` heuristics | QA Runner (Cursor or scripted verifiers) |
| Work orders (`07_LOGS/work-orders/`) | Precursor pattern → unified Job Queue |
| Telegram inbox AI | Chief AI intake channel (future wire-up) |

Legacy runtime is **not modified** in AGENT #037. SAIOS defines the target architecture beside it.
