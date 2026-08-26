# Department SDK V1

Canonical contract surface for every AIOS department.

**Agent #180 · Architecture scaffold only · LIVE OFF · execution impossible**

## Hierarchy

```
Department
  └── Director
        └── Manager(s)
              └── Worker(s)
                    └── Capability(ies)
```

Future (sealed): Workers → Skills → Brain Router → Providers.

## Rules

- Every department implements this SDK. No bypass.
- Director never executes, spawns workers, calls providers, or publishes.
- Manager never executes work.
- Worker never reasons directly, calls providers, or publishes.
- Capabilities are provider-independent.
- Resume is the **reference** (metadata only — existing code not migrated).
- Website, SEO, Marketing, Publisher, Finance, Support, HR, Legal are placeholders.

## Lifecycle

`REGISTERED → VALIDATED → READY → ACTIVE → PAUSED → DISABLED`

Active is metadata readiness — **not** runtime execution.

## API (read-only)

- `GET /api/platform/departments`
- `GET /api/platform/departments/:department`
- `GET /api/platform/departments/registry`

## Verify

```bash
npm run department-sdk:verify
```
