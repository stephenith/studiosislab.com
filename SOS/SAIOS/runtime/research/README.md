# Resume Design Research & Planning Engine

Mandatory first stage before every resume generation. **Planning only** — never generates templates, Fabric JSON, or modifies product code.

## Core principle

SAIOS **never researches directly**. Cursor Agent performs all reasoning. SAIOS coordinates.

```
Founder Objective → Research Director → Research Planner → Cursor Research → Design Brief → Resume Production Worker
```

## Workflow

1. **Research Planner** — decompose objective into research stages
2. **Cursor Research** — mandatory reads (Design Knowledge, Intelligence, Learning, Generation Spec, Editor Contract, full template corpus)
3. **Existing Template Analyzer** — compare ALL StudiosisLab templates; uniqueness target ≤35% similarity
4. **Firecrawl MCP** (when available) — external trend research (temporary knowledge only)
5. **Industry / Typography / Color / Layout / ATS Planners** — structured plans
6. **Design Brief** — single authoritative output for Resume Production Worker

## Output

Versioned sessions under `SOS/07_LOGS/saios/research/sessions/`:

- `research.json`, `design-brief.json`, `sources.json`, `comparison.json`
- `industry-analysis.json`, `ats-plan.json`, `layout-plan.json`
- `typography-plan.json`, `color-plan.json`, `report.md`

Previous sessions are never overwritten.

## Usage

```bash
cd SOS/SAIOS/runtime/research
npm install
npm run verify
```

From repo root:

```bash
npm run research:verify
```

## Constraints

- No template generation
- No Fabric JSON
- No `src/`, editor, runtime, manifest, or registry changes
- Never duplicate existing StudiosisLab layouts
- External research is temporary execution knowledge
