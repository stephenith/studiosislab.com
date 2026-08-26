# SAIOS Directory Layout — Version 1

## Top-level tree

```
SOS/
├── SAIOS/                          # AI Operating System (this tree)
│   ├── README.md
│   ├── ARCHITECTURE.md
│   ├── LAYOUT.md                   # this file
│   ├── LIFECYCLE.md
│   ├── INTERACTIONS.md
│   ├── EXPANSION.md
│   ├── modules/                    # Per-module architecture specs
│   │   ├── chief-ai.md
│   │   ├── agent-registry.md
│   │   ├── job-queue.md
│   │   ├── cursor-runner.md
│   │   ├── qa-runner.md
│   │   ├── memory.md
│   │   └── knowledge-base.md
│   ├── interfaces/                 # TypeScript contracts (skeleton)
│   │   ├── README.md
│   │   └── types.ts
│   └── runtime/                    # FUTURE — implementation (empty in v1)
│       └── README.md
│
├── 01_KNOWLEDGE/                   # Knowledge Base (existing + SAIOS index)
│   └── SAIOS_KNOWLEDGE_INDEX.md    # v1 pointer map (created by #037)
│
├── 07_LOGS/
│   └── saios/                      # FUTURE — SAIOS operational logs
│       ├── jobs/                   # Job records (JSON)
│       │   ├── pending/
│       │   ├── running/
│       │   ├── blocked/
│       │   ├── completed/
│       │   └── cancelled/
│       ├── registry/               # Worker type + instance records
│       ├── prompts/                # PRM-{job_id}.md
│       ├── reports/                # RPT-{job_id}.json
│       ├── memory/
│       │   ├── session/
│       │   ├── project/
│       │   └── long-term/
│       └── chief/                  # Chief AI decision log
│
├── 09_REPORTS/                       # Human-readable outcomes
│   └── SAIOS_V1_FOUNDATION_REPORT.md
│
└── runtime/                        # LEGACY — unchanged in v1
    └── ...
```

## Placement rules

| Content | Location | Writer |
|---------|----------|--------|
| Architecture docs | `SOS/SAIOS/` | Humans / Chief AI (docs only) |
| Type contracts | `SOS/SAIOS/interfaces/` | Humans |
| Job JSON | `SOS/07_LOGS/saios/jobs/{state}/` | Job Queue service (future) |
| Cursor prompts | `SOS/07_LOGS/saios/prompts/` | Chief AI |
| Execution reports | `SOS/07_LOGS/saios/reports/` | Cursor Runner / QA Runner |
| Worker registry | `SOS/07_LOGS/saios/registry/` | Agent Registry |
| Session memory | `SOS/07_LOGS/saios/memory/session/` | Chief AI |
| Project memory | `SOS/07_LOGS/saios/memory/project/` | Chief AI + runners (append) |
| Long-term memory | `SOS/07_LOGS/saios/memory/long-term/` | Chief AI (curated) |
| Vision / standards | `SOS/01_KNOWLEDGE/` | Founder + Chief AI curation |
| Product code | `src/` | Cursor Runner only (via agent) |
| Legacy PM state | `SOS/07_LOGS/pm/` | Legacy runtime (frozen) |

## v1 skeleton vs future runtime

In v1 foundation, only `SOS/SAIOS/` documentation and `interfaces/types.ts` exist on disk. The `07_LOGS/saios/` tree is **specified** but not populated by automation until a future agent implements the runtime under `SOS/SAIOS/runtime/`.

## Coexistence with legacy paths

| Legacy path | SAIOS equivalent |
|-------------|------------------|
| `07_LOGS/work-orders/inbox/` | `07_LOGS/saios/jobs/pending/` |
| `07_LOGS/work-orders/prompts/` | `07_LOGS/saios/prompts/` |
| `07_LOGS/work-orders/reports/` | `07_LOGS/saios/reports/` |
| `07_LOGS/pm/briefs/developer/` | `07_LOGS/saios/prompts/` (unified) |
| `07_LOGS/developer/reports/` | `07_LOGS/saios/reports/` |
| Commander supervisor workers | Agent Registry + runners |

Migration scripts (future) will map work-order IDs to job IDs without deleting legacy logs.
