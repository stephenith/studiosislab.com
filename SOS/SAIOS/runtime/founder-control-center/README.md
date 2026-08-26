# Founder Control Center (AI OS)

> **Legacy (Non-Canonical)** — Agent #222A  
> Not the Founder Command Center for the #205–#221 production spine.  
> Canonical Founder UI host: `SOS/SAIOS/dashboard` (Command Center + Founder Review).  
> Canonical production entry: `ProductionController`.

**Agent #108** — Single operational headquarters for the founder.

This is **not** another dashboard and **not** business logic.

It only aggregates existing department reports into one morning/evening interface.

## Sections

1. AI OS Status  
2. Today's Work  
3. Resume Factory  
4. Website  
5. Security  
6. Timeline  
7. Notifications  
8. Releases  
9. Performance  
10. Founder Action Queue  
11. Recommended Next Action (exactly one)

## Outputs

`SOS/07_LOGS/saios/founder-control-center/`

- `founder-control-center.json`
- `founder-dashboard.json`
- `founder-action-queue.json`
- `founder-summary.md`
- `morning-dashboard.md`
- `evening-dashboard.md`
- `founder-control-report.md`

## Verify

```bash
npm run founder-control-center:verify
```
