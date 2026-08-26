# Resume Design Brain v1

Primary **design authority** for StudiosisLab resume production. Makes high-quality design decisions before any template is generated.

**Not** a template generator, Fabric worker, or production worker.

## Position in pipeline

```
Research Engine → Design Brain → Resume Production Worker V2 → QA → Local Review → Founder
```

Workers request design decisions from the Design Brain — they never decide layout, typography, or color directly.

## Core principle

- **Cursor** performs external research (Firecrawl MCP when available)
- Internet knowledge is **temporary**
- Only **validated principles** are stored
- Never copy layouts or reproduce copyrighted designs

## Outputs

Versioned sessions: `SOS/07_LOGS/saios/design-brain/sessions/brain-YYYYMMDD-NNN/`

Latest mirror: `SOS/07_LOGS/saios/design-brain/`

- `design-brain.json`
- `design-decisions.json`
- `design-quality.json`
- `design-confidence.json`
- `research-summary.md`
- `visual-analysis.md`
- `brain-report.md`

## Usage

```bash
cd SOS/SAIOS/runtime/design-brain
npm install
npm run verify
```

From repo root:

```bash
npm run design-brain:verify
```

## Engines

| Engine | Decides |
|--------|---------|
| IndustryStyleEngine | Premium, conservative, ATS-first posture |
| TypographyEngine | Font hierarchy, sizes, line height |
| SpacingEngine | Margins, gaps, density |
| GridEngine | Columns, alignment grid |
| ColorHarmonyEngine | Accent, neutrals, contrast |
| VisualHierarchyEngine | Zone weights, reading order |
| WhitespaceEngine | Breathing room, scan path |
| CompositionEngine | Layout family, structure |
| BalanceEngine | Weight distribution |
| OriginalityEngine | Corpus similarity |
| TrendEngine | Validated trend principles |
| VisualQualityScorer | 12-dimension quality (target 95+) |
| DesignConfidence | Aggregate confidence |

## Constraints

- Does not modify `src/`, editor, workers, registry, manifest, or templates
- Does not generate Fabric JSON
- Founder memory append-only
