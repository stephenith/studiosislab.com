# Local Template Review

One-click workflow to load Resume Worker prototypes into the dev editor — no manual JSON copy/paste.

## What it does

1. Finds the latest `template-preview.json` under `SOS/07_LOGS/saios/generated-resumes/`
2. Starts `npm run dev` on port 3000 if needed
3. Opens `http://localhost:3000/editor/new` in Chromium (persistent profile)
4. Waits for `__slbImportTemplate` (dev-only editor API)
5. Injects the generated Fabric JSON
6. Prints PASS/FAIL and leaves the browser open for visual review

## Setup

```bash
cd SOS/SAIOS/runtime/tools/local-review
npm install
npx playwright install chromium
```

## Usage

From **repository root**:

```bash
npm run review:template
```

From this directory:

```bash
npm run review:template
```

### Options

| Flag / env | Description |
|------------|-------------|
| `--template=modern-ats-professional-v1` | Pick a specific generated folder |
| `--path=/abs/path/template-preview.json` | Load an explicit JSON file |
| `REVIEW_TEMPLATE=name` | Same as `--template` |
| `REVIEW_PORT=3000` | Dev server port (default 3000) |

## Auth (first run)

The editor requires sign-in. If you are redirected to `/login`, the tool prints **Waiting for user login...** once and pauses until you complete sign-in — it does **not** refresh the login page. After login, it continues automatically. Sessions persist in `.playwright-user-data/` for later runs (editor opens directly, no login wait).

## Verify

```bash
npm run verify
```

## Constraints

- **Read-only** toward `src/data/template-json/`, `templates.manifest.json`, registry
- Uses existing `__slbImportTemplate` — no new import API
- Dev mode only (`NODE_ENV=development`)
- Does not modify production editor code

## Output example

```
✓ Template loaded successfully

── Review summary ──────────────────────────
Editor URL:       http://localhost:3000/editor/new
Template path:    …/modern-ats-professional-v1/template-preview.json
Import duration:  842ms
Fabric objects:   30
Canvas size:      794×1123
Result:           PASS
────────────────────────────────────────────
```
