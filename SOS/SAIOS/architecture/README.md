# AIOS Architecture Metadata (Agent #159)

**Purpose:** Architectural clarity only. These files do **not** change runtime behaviour.

## Canonical decisions (frozen)

1. **Pipeline A (`SOS/SAIOS/core/*`) is the ONLY execution engine.**
2. **Pipeline B (`SOS/SAIOS/runtime/*`) is orchestration + workers + services.**
3. There must never again be two execution engines.
4. Reasoning flows only through Skills → Brain Router → Provider.
5. Cursor is an Engineering Tool. Firecrawl is a Research Tool.

## Files in this directory

| File | Contents |
|------|----------|
| `runtime-guard.ts` | **Agent #160** — runtime freeze enforcement (banners + legacy blocks) |
| `entrypoints.json` | Executable entrypoint inventory + classification |
| `module-roles.json` | Every module: role, allowed/forbidden deps, owner layer |
| `execution-engines.json` | Full execution-engine inventory + classification |
| `contracts.json` | Artifact contract inventory (producer/consumer/version) |
| `duplicates.json` | Duplicate systems + KEEP/MERGE/ARCHIVE/REFERENCE/DELETE_LATER |
| `dependency-graph.json` | Consumes / Produces / Depends On / Observed By / Called By / Feeds |
| `router-violations.json` | Modules that bypass Skills → Brain Router → Provider |
| `canonical-runtime-tree.json` | One placement per module in the org tree |
| `responsibility-map.json` | Who schedules / allocates / executes / evaluates |

## Runtime freeze (Agent #160)

- Official CLI: `npm run aios:canonical:run`
- Legacy CLIs throw unless `SOS_AIOS_ALLOW_LEGACY_ENGINE=1`
- Verify suites auto-allow legacy engines

## Per-module declaration

Every module directory contains `ARCHITECTURE.json` pointing at its entry in `module-roles.json`.

## Persistence ownership declaration (Agent #197)

Documentation-only registration of the Agent #196 persistence inventory:

| Path | Role |
|------|------|
| `persistence-memory-topology/` | Agent #196 — definitive inventory (42 surfaces) |
| `persistence-ownership/` | Agent #197 — official taxonomy + ownership declaration |

Does **not** change runtime behaviour. Does **not** modify `module-roles.json`, `dependency-graph.json`, or `runtime-guard.ts`.

## Architecture governance (Agent #198)

Master governance index consolidating all certified/declared packages:

| Path | Role |
|------|------|
| `governance/` | Agent #198 — Architecture Governance Framework V1 |

Documentation + verification only. Does **not** introduce new architecture or runtime behaviour.

## System integrity (Agent #199)

Repository-wide consistency certification across Agents #191–198:

| Path | Role |
|------|------|
| `system-integrity/` | Agent #199 — System Integrity Certification V1 |

## Architecture final freeze (Agent #200)

| Path | Role |
|------|------|
| `final-freeze/` | Agent #200 — Final consistency resolution & freeze |

Architecture declarations only. Runtime behaviour unchanged. LIVE OFF.

## Rules for future agents

- Do **not** create a new full execution engine.
- Do **not** delete LEGACY/REFERENCE modules without a dedicated cleanup agent.
- Do **not** change Dashboard / Founder Review / verify behaviour under the guise of architecture.
- Update these metadata files when modules change role.
- Consult `governance/GOVERNANCE_MANIFEST.md` before adding authorities.
- Respect `final-freeze/FREEZE_DECLARATION.md` before implementation.
