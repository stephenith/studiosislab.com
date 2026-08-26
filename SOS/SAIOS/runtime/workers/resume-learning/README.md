# Resume Learning Engine

Permanent knowledge layer that converts founder review feedback into persistent design memory and learned rule overlays for future Resume Workers.

## Does NOT

- Generate resume templates
- Modify `src/`, editor, runtime, templates, registry, or manifest
- Overwrite base design standards (creates learned layers only)

## Knowledge flow

```
Base Standards
       ↓
Resume Intelligence
       ↓
Founder Learning  ← this engine
       ↓
Generation
```

## Usage

```bash
cd SOS/SAIOS/runtime/workers/resume-learning
npm install
npm run verify              # simulate 10 founder reviews

# Ingest single feedback
npm run learn -- --feedback="Spacing is too tight." --template=modern-ats-professional-v1 --decision=revision
```

From repo root:

```bash
npm run learning:verify
```

## Output (`SOS/07_LOGS/saios/learning/`)

| File | Purpose |
|------|---------|
| `design-memory.json` | Persistent founder preferences |
| `learned-rules.json` | Overlay rules for workers (base standards preserved) |
| `feedback.json` | Latest parsed feedback batch |
| `learned-patterns.json` | Extracted recurring patterns |
| `confidence.json` | Template confidence scores |
| `quality-history.json` | Approvals, rejections, correction trends |
| `report.md` | Human-readable learning summary |

## Learning categories

spacing, alignment, typography, ATS, color, layout, hierarchy, section_ordering, readability, whitespace, branding, visual_balance
