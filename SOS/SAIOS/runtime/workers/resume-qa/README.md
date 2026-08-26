# Resume QA & Publishing Pipeline

Permanent orchestration layer for validating Resume Production Worker output before publication eligibility.

## Does NOT

- Generate resume templates
- Modify `src/`, editor, runtime, or product code
- Update `templates.manifest.json` or registry
- Publish templates automatically

## Pipeline

```
Generated template (SOS/07_LOGS/saios/generated-resumes/)
  → Alignment → Spacing → Typography → ATS
  → Editor → Fabric → Thumbnail → SEO
  → QA Report → Founder Approval → Publication Package (draft)
```

## Usage

```bash
cd SOS/SAIOS/runtime/workers/resume-qa
npm install
npm run verify          # self-test on latest generated template
npm run qa              # full pipeline + reports
npm run qa -- --source=/path/to/prototype-dir
```

From repo root:

```bash
npm run resume-qa:verify
```

## Output

```
SOS/07_LOGS/saios/qa/{prototype_id}/
  validation.json
  alignment.json
  spacing.json
  typography.json
  ats.json
  editor.json
  fabric.json
  thumbnail.json
  seo.json
  thumbnail.png          # rendered if missing from production output
  report.md
  publication-package/
    READY_FOR_PUBLICATION.md
    t0XX.json
    t0XX.png
    seo-page.json
    templates.manifest.entry.json
    registry.generated.draft.ts
```

**Status:** `WAITING_FOR_FOUNDER_APPROVAL`
