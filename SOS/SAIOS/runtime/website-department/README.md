# Website Department V1

**Agent:** #100  
**Role:** AI OS website health monitoring (first non-resume department)

## Mission

Continuously verify StudiosisLab’s user-facing frontend experience:

- Routes and APIs
- Resume gallery / SEO / editor / catalog
- Sitemap coverage
- Mobile layout basics
- Download/export reachability

Does **not** generate resumes, publish templates, or send live notifications.

## Usage

```bash
npm run website-department:verify
```

Optional live checks against a running Next.js server:

```bash
WEBSITE_DEPARTMENT_BASE_URL=http://localhost:3000 npm run website-department:verify
```

## Outputs

`SOS/07_LOGS/saios/website-department/`

- `website-health.json`
- `route-health.json`
- `scenario-results.json`
- `seo-health.json`
- `sitemap-health.json`
- `mobile-health.json`
- `download-flow.json`
- `runtime-errors.json`
- `website-alerts.json`
- `website-report.md`

## Status values

`HEALTHY` · `DEGRADED` · `DOWN` · `BLOCKED`

## Alerts

Alert payloads are generated for downstream Notification Department delivery.  
This module never sends Telegram/email/Slack itself.
