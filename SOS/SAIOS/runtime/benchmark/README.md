# Visual Benchmark Intelligence Engine

Permanent source of visual design truth for StudiosisLab. This engine **never** generates resumes, Fabric JSON, or edits templates.

## Role

```
Research → Benchmark Engine → Design Brain → Production Worker → QA → Founder → Learning
```

The Design Brain always prefers Benchmark Engine knowledge over temporary internet observations.

## Responsibilities

- Discover world-class resume design trends via Cursor (primary) and Firecrawl MCP
- Extract **principles only** — never store template copies
- Score principles across popularity, professionalism, ATS compatibility, accessibility, and more
- Persist validated knowledge to `SOS/07_LOGS/saios/benchmark/`
- Append-only learning via `benchmark/memory/`

## Prohibitions

- No resume generation
- No Fabric JSON
- No template or manifest edits
- No copying copyrighted commercial templates

## Modules

| Module | Purpose |
|--------|---------|
| `BenchmarkDirector.ts` | Orchestrates full benchmark cycle |
| `BenchmarkCollector.ts` | Cursor + Firecrawl collection |
| `DesignPatternExtractor.ts` | Converts observations into principles |
| `TrendScorer.ts` / `PopularityScorer.ts` / `QualityRanker.ts` | Scoring and ranking |
| `BenchmarkDatabase.ts` | JSON artifact persistence |
| `BenchmarkMemory.ts` | Append-only learning store |
| `BenchmarkValidator.ts` | Pipeline integrity checks |
| `BenchmarkReporter.ts` | Human-readable report |

## Output Artifacts

Under `SOS/07_LOGS/saios/benchmark/`:

- `benchmark-database.json`
- `layout-patterns.json`
- `typography-patterns.json`
- `spacing-patterns.json`
- `color-patterns.json`
- `industry-patterns.json`
- `ats-patterns.json`
- `trend-analysis.json`
- `quality-rankings.json`
- `benchmark-report.md`

## Verification

```bash
npm run benchmark:verify
```

## Entry Point

```typescript
import { runBenchmarkCycle } from "./BenchmarkDirector.js";

const result = await runBenchmarkCycle({
  mcp_firecrawl_available: true,
  focus_industry: "finance",
});
```
