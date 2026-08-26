# DesignBrief Engine V1

Converts structured Brain / Mock planning responses into **deterministic resume construction instructions**.

```
Knowledge → Skills → Brain → Mock → DesignBrief → Resume JSON → Renderer
```

## Scope

- Dry-run only (`dry_run: true`)
- Mock provider only
- `publication_allowed: false`
- `template_generated: false`
- Does **not** enable LIVE or OpenAI
- Does **not** write Fabric templates to the public catalog
- Website Department remains disabled (out of scope)

## Run

```bash
npm run designbrief:verify
```

## Artifacts

`SOS/07_LOGS/saios/designbrief/`

- `design-brief.json`
- `resume-json-instructions.json`
- `layout-blueprint.json`
- `brief-index.json`
- `designbrief-report.md`
