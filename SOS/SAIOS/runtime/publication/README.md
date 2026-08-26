# Resume Catalog & Publication Manager

Prepares **founder-approved** templates for publication. Draft artifacts only — never publishes automatically.

## Pipeline position

```
Premium Generator → Resume QA → Founder Critic → Local Review → Founder Approval
  → Publication Manager → WAIT → Founder Final Publish Approval
```

## Prohibitions

- No resume design generation
- No research
- No QA execution
- No automatic publish
- No `src/` modification
- No manifest or registry updates

## Publication package

Per template under `SOS/07_LOGS/saios/publication/packages/{catalog_id}/`:

- `template.json`, `thumbnail.png`, `catalog-preview.png`
- `publication.json`, `manifest-entry.json`, `registry-entry.ts`
- `seo.json`, `landing-page.md`, `release-notes.md`
- `template-metadata.json`, `category-metadata.json`

Root mirror: `publication.json`, `catalog.json`, `release-package.json`, `publication-report.md`

## Publication states

`draft` → `founder_approved` → `ready_to_publish` → `published` | `archived` | `deprecated`

## Verification

```bash
npm run publication:verify
```

## Entry point

```typescript
import { runPublicationPrep } from "./PublicationDirector.js";

const result = await runPublicationPrep({
  founder_approved: true,
  founder_name: "Stephen",
});
```
