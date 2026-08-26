# Knowledge Module

Read-mostly knowledge corpus access for prompt assembly.

Canonical index: `SOS/01_KNOWLEDGE/SAIOS_KNOWLEDGE_INDEX.md`

## Interface: `KnowledgeService`

| Method | Purpose |
|--------|---------|
| `listDomains()` | Available domain tags |
| `resolveRefs()` | Paths for domains |
| `buildSnapshot()` | Job-scoped knowledge appendix |
| `getIndexPaths()` | All indexed paths |

## Status

Skeleton v1.0 — interface only.
