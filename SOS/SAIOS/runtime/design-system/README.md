# StudiosisLab Resume Design System v1

Foundational design system consumed by all future StudiosisLab resume generators.

## Role

Single source of truth for:

- Spacing tokens (4–64px scale)
- Typography roles (Display → Label)
- Grid and layout libraries
- Header and section variants
- ATS-safe color palettes
- Component library with ATS flags
- Accessibility and validation rules

## Usage

```bash
npm run design-system:verify
```

## Module Structure

| File | Purpose |
|------|---------|
| `DesignSystemDirector.ts` | Assembles and runs the full system |
| `DesignTokens.ts` | Core token definitions |
| `TypographySystem.ts` | Font hierarchy and rhythm |
| `SpacingSystem.ts` | Scale and section gaps |
| `GridSystem.ts` | Column layouts |
| `MarginSystem.ts` | A4/Letter safe margins |
| `LayoutSystem.ts` | Layout library |
| `HeaderSystem.ts` | 10 header variants |
| `SectionSystem.ts` | 12 section variants |
| `ColorTokenSystem.ts` | 9 ATS-safe palettes |
| `ComponentLibrary.ts` | 16 compositional components |
| `ATSDesignRules.ts` | ATS compliance rules |
| `DesignValidator.ts` | Conflict and completeness checks |
| `DesignMemoryBridge.ts` | Founder calibration + domain bridge |
| `Reports.ts` | Artifact persistence |

## Output

Artifacts written to `SOS/07_LOGS/saios/design-system/`:

- `design-system.json`
- `design-tokens.json`
- `spacing-rules.json`
- `typography-rules.json`
- `grid-library.json`
- `layout-library.json`
- `component-library.json`
- `ats-rules.json`
- `accessibility.json`
- `validation.json`
- `design-system-report.md`

## Integration

Future engines import from this module instead of defining spacing, typography, or layouts independently:

```typescript
import { runDesignSystem, buildDesignSystemBundle } from "@saios/resume-design-system";
```

## Backward Compatibility

This module is additive only. No existing production pipelines, editors, or generators are modified.
