# AIOS Mission Contract V1 Report

**Agent #162 · Chief AI Systems Architect · Planning layer only**  
**Date:** 2026-07-12  
**Status:** COMPLETE — Mission Contracts are the canonical business object; nothing executes.

---

## Summary

Mission Contract V1 converts Founder Objectives into permanent, versioned **Mission** objects under `SOS/SAIOS/core/company-brain/`. Execution Plans remain temporary artifacts **derived from** Missions. Runtime behaviour is unchanged: no queue admission, no workers, no providers, no publishing, no autonomy.

| Gate | Result |
|------|--------|
| Mission schema + registry | PASS |
| Lifecycle V1 (PLANNED / WAITING_FOUNDER) | PASS |
| Dependency graph (planning only) | PASS |
| Dashboard Mission Control (read-only) | PASS |
| Founder Review unchanged | PASS |
| No execution / queue / providers | PASS |
| Verification suites preserved | PASS (`company-brain:verify`) |

**Readiness: 90%** (planning + mission object complete; execution admission still future)

---

## Mission schema

`schema_version`: `mission-contract-1.0.0`

| Field | Notes |
|-------|--------|
| Mission ID / Name / Type | Stable identity + inferred type |
| Founder Objective | Source intent |
| Mission Description / Business Goal | Narrative + outcome |
| Priority / Risk Level | From planning engine |
| Status / Current Stage | Lifecycle (V1: PLANNED \| WAITING_FOUNDER) |
| Created / Updated Time | ISO timestamps |
| Schema Version / Owner | Versioned business object |
| Founder Approval Required | Always `true` |
| Execution / Queue / Publishing Allowed | Always `false` in V1 |
| Learning Enabled | `true` (records only; no auto-apply) |
| Estimated Duration / Departments | Planning estimates |
| Mission Tags / Success KPIs | Search + success criteria |
| Dependency Graph | Sequential / parallel / prerequisites / critical path |
| Linked Plan ID | Derived temporary ExecutionPlan |

Types: `mission-types.ts` · Validator: `MissionValidator.ts`

---

## Lifecycle

```
DRAFT → PLANNED → WAITING_FOUNDER → APPROVED → READY_FOR_QUEUE
  → IN_PROGRESS → COMPLETED → ARCHIVED
```

**V1 active statuses only:** `PLANNED`, `WAITING_FOUNDER`  
Later stages are placeholders. Invalid V1 statuses fail validation (`INVALID_LIFECYCLE_V1`). Transition map documents future moves; only `PLANNED ↔ WAITING_FOUNDER` (and archive paths) are meaningful today.

---

## Dependency model

`MissionDependencyGraph` describes:

- Department nodes
- Sequential edges (recommended order)
- Parallel groups (e.g. website ∥ seo) — recorded without cyclic directed edges
- Prerequisites (e.g. resume → publisher)
- Blocking departments
- Critical path

**No scheduling. No execution.** Graph is informational for future Managers / Queue admission.

---

## Registry structure

`SOS/07_LOGS/saios/company-brain/missions/`

| Artifact | Purpose |
|----------|---------|
| `current-mission.json` | Active mission (dashboard source) |
| `index.json` | Registry index |
| `{mission_id}.json` | Latest version of a mission |
| `versions/{id}.v{n}.json` | Immutable version snapshots |
| `missions.jsonl` | Append-only history |

API: `get` / `getCurrent` / `getVersion` / `listAll` / `history` / `search` / `save`

---

## Dashboard integration

Read-only exposure on Mission Control + Settings:

- Current Mission (name + id)
- Mission Status
- Mission Priority + Risk
- Mission Progress (% by lifecycle stage)
- Mission Departments
- Founder Approval Status

Snapshot field: `company_brain` (`CompanyBrainViewData`) loads `missions/current-mission.json` when present. No workflow mutations. Founder Review unchanged.

---

## Validation rules

| Code | Severity | Rule |
|------|----------|------|
| `MISSING_MISSION_ID` / `DUPLICATE_MISSION_ID` | error | Identity |
| `MISSING_KPIS` | error | ≥1 success KPI |
| `MISSING_DEPARTMENTS` | error | ≥1 primary/supporting dept |
| `INVALID_LIFECYCLE_V1` | error | Only PLANNED / WAITING_FOUNDER |
| `DEPENDENCY_LOOP` | error | Graph cycles |
| `EXECUTION_MUST_BE_FALSE` / `QUEUE_MUST_BE_FALSE` / `PUBLISH_MUST_BE_FALSE` | error | V1 safety |
| `FOUNDER_APPROVAL_REQUIRED` | error | Must be true |
| `NO_ENABLED_DEPARTMENTS` | warning | Disabled depts informational |

Reports errors only — never mutates runtime.

---

## Department planning

Supported (planning catalogue): Resume, Website, SEO, Marketing, Publisher Operations, Finance, Support.

Disabled departments remain **informational** / blocked in the mission. Nothing executes.

---

## Future extensions

1. Promote `WAITING_FOUNDER` → `APPROVED` via Founder Review linkage (no auto-approve).
2. `READY_FOR_QUEUE` admission policy (still gated; Agent #163+).
3. Manager consumption of Mission as shared context across departments.
4. Learning feedback attached to Mission versions.
5. Critical-path scheduling (planning only until explicitly unlocked).

---

## Readiness

| Area | Score |
|------|-------|
| Schema + registry | 95% |
| Planner → Mission + Plan | 92% |
| Validation | 90% |
| Dashboard read-only | 88% |
| Execution safety | 100% (refused) |
| **Overall** | **90%** |

---

## Recommendations for Agent #163

1. **Do not** implement queue admission or worker dispatch yet — keep Mission PLANNED / WAITING_FOUNDER.
2. Wire Founder Review artifacts to Mission `WAITING_FOUNDER` (approval status sync only).
3. Define Mission → Department brief contract (read-only shared context).
4. Add mission history UI (versions / search) without mutating workflows.
5. Preserve all verification suites; extend with Founder-gate fixture linkage if needed.
6. Keep `execution_allowed` / `queue_admission_allowed` / `publishing_allowed` false until an explicit unlock agent.

---

## Commands

```bash
npm run company-brain:verify
npm run company-brain:plan -- --objective="..."
```

## Agent counters

- `latest_agent` = **162**
- `next_agent` = **163**
