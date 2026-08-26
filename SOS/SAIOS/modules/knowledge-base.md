# Knowledge Base Module

**Role:** Canonical, human-readable corpus for StudiosisLab context. Workers receive **snapshots**; Chief AI maintains index and curation.

---

## Design principle

**Knowledge is documentary. Memory is operational.**

Knowledge Base files change slowly (vision, standards). Memory changes every job (status, outcomes).

---

## Canonical locations

### StudiosisLab vision and strategy

| Topic | Path | Owner |
|-------|------|-------|
| Founder vision | `SOS/01_KNOWLEDGE/Founder_Vision.md` | Founder |
| Product priorities | `SOS/01_KNOWLEDGE/Product_Priorities.md` | Founder + Chief AI |
| Launch strategy | `SOS/01_KNOWLEDGE/Launch_Strategy.md` | Founder |
| Revenue model | `SOS/01_KNOWLEDGE/Revenue_Model.md` | Founder (TODO) |
| Mobile editor | `SOS/01_KNOWLEDGE/Mobile_Editor.md` | Product |

### PM and decision engines (planning input for Chief AI)

| Topic | Path |
|-------|------|
| PM playbook | `SOS/01_KNOWLEDGE/StudiosisLab_PM_Playbook.md` |
| PM decision engine | `SOS/01_KNOWLEDGE/PM_DECISION_ENGINE.md` |
| Roadmap engine spec | `SOS/01_KNOWLEDGE/ROADMAP_ENGINE.md` |

### Roadmap (executable backlog source)

| Topic | Path |
|-------|------|
| Master backlog | `SOS/08_ROADMAP/MASTER_BACKLOG.md` |
| Roadmap reports | `SOS/09_REPORTS/` (epic status) |

### Architecture and operations

| Topic | Path |
|-------|------|
| SAIOS architecture | `SOS/SAIOS/` (this tree) |
| Event schema | `SOS/02_RULES/EVENT_SCHEMA.md` |
| Secrets handling | `SOS/docs/SECRETS.md` |
| Legacy runtime README | `SOS/runtime/README.md` (reference only) |
| Architecture audits | `SOS/09_REPORTS/*_REPORT.md` |

### Coding standards (v1 — to expand)

| Topic | Path (v1) |
|-------|-------------|
| SAIOS knowledge index | `SOS/01_KNOWLEDGE/SAIOS_KNOWLEDGE_INDEX.md` |
| Product conventions | `src/` — inferred by agents; formal doc TBD in `SOS/01_KNOWLEDGE/CODING_STANDARDS.md` (placeholder) |
| SOS runtime conventions | `SOS/SAIOS/interfaces/README.md` |

Chief AI should create `CODING_STANDARDS.md` in a future curation job — not in AGENT #037.

### Product knowledge

| Topic | Path |
|-------|------|
| Templates manifest | `templates.manifest.json` (repo root) |
| Template JSON | `src/data/template-json/` |
| App routes/components | `src/` (read-only reference for agents) |

Product knowledge is **referenced by path**, not duplicated in SAIOS.

---

## SAIOS knowledge index

Master pointer file: **`SOS/01_KNOWLEDGE/SAIOS_KNOWLEDGE_INDEX.md`**

Chief AI loads index first, then selective files based on job `metadata.knowledge_domains[]`.

---

## Knowledge domains (tags)

| Domain tag | Typical files |
|------------|---------------|
| `vision` | Founder_Vision, Launch_Strategy |
| `roadmap` | MASTER_BACKLOG, ROADMAP_ENGINE |
| `architecture` | SAIOS/, audit reports |
| `standards` | CODING_STANDARDS (future), EVENT_SCHEMA |
| `product-mobile` | Mobile_Editor, hub components |
| `product-templates` | templates.manifest.json |
| `ops` | SECRETS, runtime README |
| `revenue` | Revenue_Model |

---

## Snapshot assembly (Chief AI)

For each implement job, Chief AI builds `PRM-{job_id}.md` appendix:

```markdown
## Knowledge snapshot
- [vision] SOS/01_KNOWLEDGE/Founder_Vision.md (excerpt)
- [roadmap] SOS/08_ROADMAP/MASTER_BACKLOG.md §3.1 (excerpt)
- [architecture] SOS/SAIOS/ARCHITECTURE.md §Layer model
```

Rules:

1. Max token budget per domain (configurable)
2. Always include safety-relevant standards
3. Never include secrets or `.env`
4. Cite paths for agent to read full file if needed

---

## Curation workflow

1. Founder or agent proposes knowledge update → **research job** (read-only Cursor)
2. Output markdown in `SOS/09_REPORTS/` or PR
3. Chief AI reviews → founder approves via Telegram
4. Chief AI merges into `01_KNOWLEDGE/` (future: via implement job)

Chief AI does not silently rewrite vision docs.

---

## Relation to legacy PM readers

`SOS/runtime/src/pm/readers.ts` already reads knowledge paths. SAIOS Chief AI **reuses same paths** — no forked knowledge tree.

---

## Interfaces

See `KnowledgeDomain`, `KnowledgeSnapshot`, `KnowledgeBase` in `interfaces/types.ts`.

---

## Expansion

- Versioned knowledge packs (`knowledge/v2026-07-06/`)
- Diff-aware snapshot (only changed sections since last job)
- Link to external docs (Cursor docs, Firebase) as references not copies
