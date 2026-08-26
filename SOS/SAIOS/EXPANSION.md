# SAIOS Expansion Plan — Version 1 → Future

## Version roadmap

| Version | Focus | Execution |
|---------|-------|-----------|
| **v1.0** (this foundation) | Architecture, interfaces, docs | None |
| **v1.1** | File-based job queue + Cursor Runner MVP | `SOS/SAIOS/runtime/` |
| **v1.2** | Chief AI wire-up to Telegram (replace inbox execution) | Orchestration only |
| **v2.0** | Postgres job store + Redis locks | Horizontal runners |
| **v2.1** | GitHub branch/PR per job | `gh` integration |
| **v3.0** | `@cursor/sdk` option alongside CLI | Streaming, cancel |
| **v3.1** | `cursor agent worker` pool on VPS | Cloud assignment |

---

## Parallel agents

v1 is **serial** (one job per runner instance). Expansion:

1. Register N `cursor-dev` instances in Agent Registry
2. Job Queue claims with instance-level lock files
3. `cursor agent --worktree` per job (isolated git worktrees)
4. Chief AI caps concurrency via policy (e.g. max 2 `src/` jobs)

---

## Worker type expansion

| Worker type | Purpose | Phase |
|-------------|---------|-------|
| `cursor-dev` | Implementation | v1.1 |
| `cursor-qa` | Verification via agent | v1.1 |
| `script-qa` | Build/lint/playwright only | v1.2 |
| `cursor-research` | Ask/plan mode, reports only | v2.0 |
| `cursor-seo-audit` | Read-only site analysis | v2.1 |
| `human-founder` | Manual approval placeholder | v1.2 |

Register new types in Agent Registry without changing Chief AI core.

---

## Storage evolution

| Phase | Job store | Registry | Memory |
|-------|-----------|----------|--------|
| v1.1 | `07_LOGS/saios/jobs/**/*.json` | JSON files | JSON/markdown files |
| v2.0 | PostgreSQL `saios.jobs` | PostgreSQL `saios.workers` | PG + file export |
| v2.5 | Event sourcing optional | Same | Vector index for long-term (optional) |

Legacy `07_LOGS/` remains audit trail; dual-write during migration.

---

## Chief AI intelligence evolution

| Phase | Capability |
|-------|------------|
| v1.1 | Rule-based intent (reuse inbox-ai patterns) |
| v1.2 | LLM planning via Cursor Agent `plan` mode job |
| v2.0 | Dedicated planner model; workers stay execution-only |
| v3.0 | Multi-founder roles (read-only auditor) |

Chief AI never regains code-write capability.

---

## Infrastructure (from architecture audit)

Minimum production VPS:

- Docker: `chief-ai`, `cursor-runner`×N, `qa-runner`, `telegram-poller`
- Secrets: env + not in logs
- Backups: daily `07_LOGS/saios` + DB dump
- Monitoring: heartbeat files → Telegram alert (reuse Commander health pattern)

---

## Legacy deprecation schedule (suggested, not implemented)

| Legacy component | Deprecate when |
|------------------|----------------|
| Developer `strategies/*` | v1.2 stable Cursor impl jobs |
| QA `verifier.ts` heuristics | v1.2 QA runner pass rate acceptable |
| Work order runner (runtime) | v1.1 job queue replaces inbox |
| PM Developer assignment | v2.0 PM becomes planner-only |
| Commander 6-worker supervisor | v2.0 SAIOS process supervisor |

Rollback always possible while JSON mirrors exist.

---

## Revenue alignment (60-day goal)

Job types and knowledge priorities should tag:

- `revenue_impact: ad-readiness | traffic | conversion | none`
- Chief AI prioritization weights programmatic ad enablement

No product implementation in SAIOS v1 — metadata hooks only in `Job.metadata`.

---

## Open decisions (for founder)

1. Postgres vs SQLite for v2 job store
2. PR-required vs direct-to-main for agent commits
3. Max parallel Cursor agents on first VPS
4. Whether QA is always Cursor or hybrid script-first

Document decisions in `SOS/07_LOGS/decisions/` when ratified.
