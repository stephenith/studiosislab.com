# AIOS Founder Dashboard V2 — Master Specification

**Document type:** Design specification only  
**Agent:** #126  
**Status:** AUTHORITATIVE for V2 UI planning  
**Supersedes for UI scope:** V1 shell layout gaps; does **not** unlock LIVE, OpenAI, Telegram, publish, or Website ops  
**Companion (locked tokens):** `SOS/SAIOS/AIOS_DASHBOARD_DESIGN_SYSTEM.md` (V1 colour / type / motion baseline)  
**Implementation:** Forbidden in this document’s delivery. No React. No CSS. No backend changes. No runtime changes. No AI logic changes.

---

## 0. Non-negotiable constraints

| Rule | V2 stance |
|------|-----------|
| Backend architecture | **Reuse** existing snapshot APIs, founder-decision APIs, knowledge logs, event history |
| Runtime / LIVE | **Unchanged** — UI always shows LIVE OFF until a future explicit unlock agent |
| AI / provider logic | **Unchanged** — Mock remains the displayed active provider while OpenAI is disabled |
| Publication | **No publish controls** in V2 UI |
| Public website | **Not** the AIOS dashboard; no StudiosisLab marketing redesign |
| Bind / exposure | Spec assumes local founder surface (`127.0.0.1`); no public exposure design |
| Telegram | Unchanged / disabled for now — no Telegram control surface |
| Website Department | Visible as **disabled / future** only; no operational controls |
| Secrets | Never rendered; redaction rules from V1 remain |
| Cards | Default **no cards**; panels and rows only when interaction requires a container |
| Redesign of Brain/Knowledge/Skills **data contracts** | Out of scope — visualize existing artifacts only |

V2 expands **founder observability and review UX clarity**. It does not invent new factories, providers, or departments.

---

## 1. Full screen map

### 1.1 Shell regions (desktop ≥1280px)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ TOP STATUS BAR (48px) — identity · LIVE OFF · dry_run · provider · pulse │
├────┬───────────────────────────────────────────────────────┬─────────────┤
│ N  │ MAIN STAGE                                            │ INSPECTOR   │
│ A  │ (route-dependent composition)                         │ (0 or 360)  │
│ V  │                                                       │             │
│    │                                                       │             │
│ R  │                                                       │             │
│ A  │                                                       │             │
│ I  │                                                       │             │
│ L  │                                                       │             │
│56/ │                                                       │             │
│200 │                                                       │             │
├────┴───────────────────────────────────────────────────────┴─────────────┤
│ OPTIONAL: COMMAND PALETTE OVERLAY · MODAL CONFIRM · TOAST STRIP          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Named screens (routes)

| Screen ID | Route key | Primary job | First viewport contents |
|-----------|-----------|-------------|-------------------------|
| `SCR_HOME` | `home` | Mission Control | System Pulse + Exception strip + Founder Action Queue + Department strip |
| `SCR_RESUME` | `resume` | Resume Department ops view | Mode banner + last cycle + knowledge loaded + waiting review CTA |
| `SCR_REVIEW` | `review` | Founder Review decision surface | Review header + evidence stack + decision actions |
| `SCR_KNOWLEDGE` | `knowledge` | Knowledge domains | Domain list + snapshot meta + learning merge indicator |
| `SCR_BRAIN` | `brain` | Brain Studio visualization | Graph canvas + selected node summary |
| `SCR_SKILLS` | `skills` | Skill registry | Skill table + active skill highlight |
| `SCR_ACTIVITY` | `activity` | Timeline / events | Chronological event stream + filters |
| `SCR_RUNTIME` | `runtime` | Runtime Monitor | Heartbeat, cycles, queue depth, mode flags |
| `SCR_COST` | `cost` | Cost Monitor | Today / cycle / provider cost (Mock = $0.00) |
| `SCR_HEALTH` | `health` | Health Monitor | Subsystem health rows + degraded reasons |
| `SCR_SETTINGS` | `settings` | Local preferences only | Theme density, reduced motion, refresh interval — **no LIVE/OpenAI/Telegram toggles** |

### 1.3 Overlay screens (non-routed)

| Overlay ID | Trigger | Purpose |
|------------|---------|---------|
| `OVL_CMDK` | ⌘K / Ctrl+K | Command palette (navigation + open review + focus entities) |
| `OVL_CONFIRM` | Decision submit | Confirm Approve / Reject / Request Changes |
| `OVL_INSPECTOR_DRAWER` | Tablet selection | Inspector as right drawer |
| `OVL_SHUTDOWN` | Explicit quit flow | Local session end checklist (does not stop AIOS factory) |

### 1.4 Screen adjacency (founder mental model)

```
Login/Session → SCR_HOME
                 ├→ SCR_REVIEW (from queue / waiting_founder)
                 ├→ SCR_RESUME ↔ SCR_REVIEW
                 ├→ SCR_KNOWLEDGE → Knowledge Inspector
                 ├→ SCR_BRAIN → Brain node → Inspector
                 ├→ SCR_SKILLS → Skill Inspector
                 ├→ SCR_ACTIVITY → event → Inspector
                 ├→ SCR_RUNTIME / SCR_COST / SCR_HEALTH
                 └→ SCR_SETTINGS → Shutdown overlay
```

---

## 2. Navigation hierarchy

### 2.1 Primary (nav rail — always present)

1. **Home** (`SCR_HOME`)
2. **Resume** (`SCR_RESUME`)
3. **Review** (`SCR_REVIEW`) — badge when `waiting_founder` count > 0
4. **Knowledge** (`SCR_KNOWLEDGE`)
5. **Brain** (`SCR_BRAIN`)
6. **Skills** (`SCR_SKILLS`)
7. **Activity** (`SCR_ACTIVITY`)
8. **Monitors** (group header, not a screen)
   - Runtime
   - Cost
   - Health
9. **Settings** (`SCR_SETTINGS`)

### 2.2 Secondary (in-screen sections — not rail items)

- Mission Control: Pulse · Exceptions · Action Queue · Departments · Latest cycle
- Review: Summary · Evidence · Decision forms · Confirmation
- Knowledge: Domains · Snapshot · Learning entries (read)
- Brain: Graph · Legend · Path highlight
- Activity: Filters · Stream · Jump-to-cycle

### 2.3 Tertiary (inspector tabs when selection is rich)

- Overview
- Artifacts
- Events
- Learning (when decision/learning related)
- Raw IDs (monospace)

### 2.4 Disabled / future rail entries (visible, non-navigable)

- **Website** — status `disabled`; tooltip: “Website Department disabled”
- **Agents** — status `future`; tooltip: “Multi-agent ops — planned”
- **Telegram** — not shown as operational control; if listed in Settings info, marked unchanged/disabled

### 2.5 Nav rules

- One active primary destination at a time
- Review badge uses count text, not colour alone
- Website never becomes an operational destination until a future enablement agent + founder unlock
- Deep links from Action Queue set route + selection atomically

---

## 3. Component hierarchy

```
AiosShell
├── TopStatusBar
│   ├── BrandMark
│   ├── SafetyFlags (LIVE OFF · dry_run · provider)
│   ├── HeartbeatAge
│   ├── CostTodayChip
│   ├── HealthDotSummary
│   └── CommandPaletteTrigger
├── NavRail
│   ├── NavPrimaryList
│   ├── NavMonitorGroup
│   └── NavFutureList (disabled rows)
├── MainStage
│   └── [RouteView]  (one of screens in §1.2)
├── InspectorPanel
│   ├── InspectorHeader
│   ├── InspectorTabs
│   └── InspectorBody (Knowledge | Skill | Runtime | Decision | Generic)
├── CommandPalette (portal)
├── ConfirmModal (portal)
└── ToastStrip (portal)
```

Route views compose **panels**, not nested apps. Shared primitives live under shell; domain visuals live under feature folders (see §26).

---

## 4. Every panel

| Panel ID | Host screen(s) | Purpose | Interaction |
|----------|----------------|---------|-------------|
| `PNL_SYSTEM_PULSE` | Home | Calm OS presence; idle/active path | Select → Inspector cycle |
| `PNL_EXCEPTION_STRIP` | Home | Failures / blocked / waiting_founder | Row open → entity |
| `PNL_FOUNDER_ACTION_QUEUE` | Home, Review entry | Ordered founder work | Open Review / focus entity |
| `PNL_DEPARTMENT_STRIP` | Home | Resume / Website / … status | Select department |
| `PNL_LATEST_CYCLE` | Home, Resume | Last dry-run cycle summary | Open Review if waiting |
| `PNL_MODE_BANNER` | Resume, Review, Runtime | Permanent safety banner | None (display only) |
| `PNL_REVIEW_SUMMARY` | Review | Review/task/cycle IDs, objective | Copy IDs |
| `PNL_EVIDENCE_PROVIDER` | Review | Structured Mock response | Expand sections |
| `PNL_EVIDENCE_QA` | Review | Deterministic QA result | Expand |
| `PNL_EVIDENCE_TIMELINE` | Review | Execution timeline | Jump to Activity |
| `PNL_DECISION_ACTIONS` | Review | Approve / Reject / Request Changes | Opens forms + confirm |
| `PNL_DECISION_RESULT` | Review | Immutable confirmation after submit | Read-only |
| `PNL_KNOWLEDGE_DOMAINS` | Knowledge | Domain ownership list | Select → Knowledge Inspector |
| `PNL_KNOWLEDGE_SNAPSHOT` | Knowledge | Snapshot id, loaded domains, learning_merged | Select |
| `PNL_LEARNING_INDEX` | Knowledge | Append-only learning categories (read) | Select entry |
| `PNL_BRAIN_CANVAS` | Brain | Node/edge visualization | Select node |
| `PNL_BRAIN_LEGEND` | Brain | Status / edge meaning | None |
| `PNL_SKILL_TABLE` | Skills | Registry rows | Select → Skill Inspector |
| `PNL_ACTIVITY_FILTERS` | Activity | Type / department / status filters | Apply |
| `PNL_ACTIVITY_STREAM` | Activity | Event list | Select event |
| `PNL_QUEUE_VIS` | Runtime, Home (compact) | Task queue depth & states | Select task |
| `PNL_RUNTIME_FLAGS` | Runtime | LIVE, dry_run, providers, departments | Display only |
| `PNL_COST_TODAY` | Cost | Aggregates | Display only |
| `PNL_COST_BREAKDOWN` | Cost | By department / provider (Mock zeros) | Select row |
| `PNL_HEALTH_MATRIX` | Health | Subsystem health | Select subsystem |
| `PNL_SETTINGS_LOCAL` | Settings | Density, motion, refresh | Persist local prefs only |
| `PNL_SESSION_SHUTDOWN` | Settings / overlay | Founder end-of-session checklist | Confirm local close |

**Panel chrome rule:** hairline border or separator; radius 0–2px; no elevated card stack; no multi-shadow.

---

## 5. Every animation

Motion is presence and hierarchy — not decoration. All durations ≤ 200ms unless noted. Respect `prefers-reduced-motion: reduce` → essential opacity fades only (≤ 100ms) or none.

| Motion ID | Where | Trigger | Behaviour | Reduced-motion |
|-----------|-------|---------|-----------|----------------|
| `MOT_IDLE_PULSE` | System Pulse | Idle | Opacity breathe ≤ 4%, ~3s cycle | Off |
| `MOT_ACTIVE_TOKEN` | Brain / Pulse paths | `running` \| `planning` | Token travels along path | Static highlight on active edge |
| `MOT_ROUTE_CROSSFADE` | MainStage | Route change | Opacity 0→1, 150ms | Instant swap |
| `MOT_INSPECTOR_SLIDE` | Inspector | Open/close | Width + opacity, 180ms | Instant width |
| `MOT_DRAWER_IN` | Tablet inspector | Open | TranslateX 160ms | Instant |
| `MOT_CMDK_IN` | Command palette | Open | Opacity + 4px Y, 120ms | Opacity only |
| `MOT_MODAL_IN` | Confirm | Open | Opacity 120ms | Opacity only |
| `MOT_TOAST_IN` | Toast | Push | Opacity + Y 8px, 150ms | Opacity only |
| `MOT_TOAST_OUT` | Toast | Dismiss | Opacity 120ms | Opacity only |
| `MOT_ROW_FOCUS` | Tables/queues | Keyboard focus | Background surface-2, 80ms | Instant |
| `MOT_BADGE_TICK` | Review nav badge | Count change | Soft scale 1→1.04→1, 160ms | Instant text update |
| `MOT_DECISION_LOCK` | Decision result | After submit | Brief opacity settle; then static | Static |
| `MOT_GRAPH_SELECT` | Brain | Node select | Node stroke emphasize 120ms | Instant stroke |
| `MOT_TIMELINE_SCRUB` | Activity/Review timeline | Hover/focus step | Step marker emphasize | Instant |
| `MOT_QUEUE_SHIFT` | Queue vis | Item resolve | Row collapse height 180ms | Instant remove |
| `MOT_SKELETON_SHIMMER` | Loading | Fetch | Optional 1.2s linear opacity shimmer ≤ 6% | Static skeleton |
| `MOT_HEALTH_FLICKER` | **Forbidden** | — | Never pulse fail state | — |
| `MOT_GLOW_BLOOM` | **Forbidden** | — | Never | — |

**Status must never be conveyed by animation alone** — always text label + optional status dot.

---

## 6. Every card

V2 default remains **no cards**. The following are the only **interaction containers** allowed to look card-like (still radius ≤ 2px, no shadow stack):

| Card-like ID | Used when | Contains | Why container required |
|--------------|-----------|----------|------------------------|
| `CRD_ACTION_QUEUE_ITEM` | Queue row expanded or focused | Title, priority, status, CTA | Primary founder interaction unit |
| `CRD_DECISION_FORM` | Approve / Reject / Changes forms | Fields + confirm | Form boundary |
| `CRD_DECISION_RECEIPT` | Post-submit | Immutable decision summary | Confirmation artifact |
| `CRD_EXCEPTION_ITEM` | Exception strip focus | Status, path, jump | Actionable exception |
| `CRD_MONITOR_METRIC` | Cost/Health dense metric | Label + mono value | Scanability for monitors only |

**Forbidden card patterns:** hero media cards, glassmorphism, gradient borders, floating badges on graphs, KPI stat-card grids on Home first viewport, pill clusters.

Home first viewport composition (hero budget for OS, not marketing):

1. Brand/OS identity (in top bar — already)
2. System Pulse (one visual)
3. One sentence system state
4. Exception strip **or** Action Queue (prefer Queue when `waiting_founder`)
5. No stats collage in first viewport

---

## 7. Brain visualization

### 7.1 Purpose

Show how a Resume (or future department) cycle moves through **Knowledge → Skill → Provider → QA → Founder** without implying LIVE execution.

### 7.2 Graph model (visual only)

**Nodes (fixed vocabulary):**

| Node | Meaning |
|------|---------|
| Scheduler | Cycle admission |
| Queue | Task waiting |
| Department | Resume (Website disabled ghost node) |
| Knowledge | Domains loaded |
| Skill | Active skill |
| Provider | Mock (OpenAI ghost/disabled) |
| QA | Deterministic checks |
| Founder | Review gate |
| Learning | Write-back (post-decision) |

**Edges:** directed; active edge only when cycle status is `planning` | `running`; waiting_founder emphasizes Founder node.

### 7.3 Visual rules

- 2D SVG (or equivalent vector) — **no WebGL / 3D**
- Black nodes on white / inverse on rail contrast only for chrome
- Disabled departments/providers drawn muted + dashed stroke + `disabled` label
- Selection opens Inspector with node id, last event, artifact paths
- Missing artifact → node shows `unavailable` — never fake success path

### 7.4 States

| Cycle status | Graph treatment |
|--------------|-----------------|
| `idle` | All calm; Idle Pulse only |
| `queued` | Queue node emphasize |
| `planning` | Knowledge→Skill token travel |
| `running` | Skill→Provider→QA token travel |
| `waiting_founder` | Founder node emphasize; path dim after QA |
| `completed` | Static success label on terminal |
| `failed` / `blocked` | Fail node + monospace reason in Inspector |

---

## 8. Timeline visualization

### 8.1 Two timeline modes

| Mode | Screen | Density |
|------|--------|---------|
| **Execution Timeline** | Review evidence | Steps for one dry-run only |
| **Activity Stream** | Activity | Cross-system event history |

### 8.2 Execution Timeline (Review)

Vertical step list:

1. Timestamp (mono)
2. Step name
3. Status chip (text)
4. Artifact reference (path, mono, truncated with expand)

Interactions: focus step → Inspector; “Open in Activity” filters to `cycle_id`.

### 8.3 Activity Stream

- Reverse chronological
- Sticky day separators
- Filters: event_type, department, status, cycle_id
- Founder decision events (`FOUNDER_*`, `LEARNING_*`) visually same weight as system events — authority via label, not colour drama
- Virtualize when > 200 rows (spec requirement; implementation later)

---

## 9. Queue visualization

### 9.1 Founder Action Queue (primary)

Ordered list:

| Field | Display |
|-------|---------|
| priority | P0 / P1 / … mono |
| title | Primary text |
| status | `waiting_founder` / `proposed` / `resolved` / … |
| source | mono |
| task_id | mono, optional |

Behaviours:

- Click waiting founder-approval → `SCR_REVIEW` with that review loaded
- Resolved items collapse to “Resolved” section (collapsed by default)
- Proposed next-safe-actions are **visible but not auto-started**; CTA is “Inspect” only in V2 unless a later agent defines execution

### 9.2 Runtime task queue (secondary)

Compact lane view on Runtime / optional Home footer:

`queued → planning → running → waiting_founder → completed|failed`

Counts per lane; click lane filters Activity.

### 9.3 Update policy (display)

Queue reflects `founder-action-queue.json` and runtime snapshots. UI must not invent queue items. After founder decision, show resolved + newly proposed actions per existing backend rules.

---

## 10. Founder Review UI

### 10.1 Entry points

- Mission Control Action Queue
- Resume Department “waiting review” CTA
- Latest `waiting_founder` cycle
- Nav Review badge
- Inspector “Open Review”
- Command palette: “Open Founder Review”

### 10.2 Mandatory evidence stack (in order)

1. Review summary (status, priority)
2. Task ID + Cycle ID (mono)
3. Objective
4. Knowledge domains loaded
5. Skill used
6. Provider used (Mock)
7. Structured Mock response
8. Deterministic QA result
9. Execution timeline
10. Dry-run warning (permanent)
11. No-publication warning (permanent)

### 10.3 Actions

| Action | Required input | Confirmation copy (essence) |
|--------|----------------|-----------------------------|
| **Approve** | Optional observation | Approval does **not** publish; `publication_allowed` remains false |
| **Request Changes** | Required feedback; optional change list; optional quality scores | Creates revision proposal learning; does not execute revision; does not publish |
| **Reject** | Required reason | Records rejection + rejected-pattern learning; does not auto-create replacement work; does not publish |

### 10.4 Safety UX

- Duplicate submit prevented (disable actions while in-flight; lock after success)
- Post-submit: `CRD_DECISION_RECEIPT` with decision_id (immutable)
- Real pending Marketing Manager dry-run remains founder-driven — V2 UI must not auto-decide
- No Publish / Enable LIVE / Start OpenAI / Delete history / Modify provider / Restart server / Telegram controls

### 10.5 Layout

```
[ Mode banner: LIVE OFF · dry_run · Mock · No automatic publication ]
[ Review summary + IDs ]
[ Evidence panels (scroll) ]
[ Decision action bar — sticky footer in main ]
[ Receipt region — appears after submit ]
```

Inspector may mirror decision_id + learning_ids after submit.

---

## 11. Knowledge Inspector

Opened when selection kind is knowledge domain, snapshot, or learning entry.

### 11.1 Sections

| Section | Content |
|---------|---------|
| Identity | domain / snapshot_id / learning_id |
| Ownership | Which department may read/write (display rules only) |
| Loaded for cycle | Domains present in last Resume knowledge load |
| Learning merge | Whether founder learning snapshot was merged (`learning_merged`) |
| Categories present | approved_pattern, rejected_pattern, revision_instruction, quality_observation, recurring_issue, founder_preference_signal |
| Evidence refs | Paths only (mono) |
| Confidence / applicability | From learning entry when selected |
| Warnings | Secrets never shown; fictional resume sample ≠ personal data |

### 11.2 Actions allowed

- Copy id / path
- Jump to source decision (if `source_decision_id`)
- Jump to Review (if pending review related)

### 11.3 Actions forbidden

- Edit learning
- Delete learning
- Promote Mock output to founder-approved without a decision
- Migrate legacy memory

---

## 12. Skill Inspector

Opened from Skills table or Brain Skill node.

| Section | Content |
|---------|---------|
| Name / id | Mono id |
| Domain | e.g. resume |
| Active | boolean text |
| Last used cycle | id + timestamp |
| Inputs expected | From registry metadata if present |
| Safety | dry_run only note when LIVE OFF |
| Related knowledge domains | Links into Knowledge Inspector |

No skill enable/disable toggles in V2 (would change runtime policy). Display-only unless a future agent defines safe local fixtures.

---

## 13. Runtime Monitor

### 13.1 Purpose

Answer: “Is the control plane alive, and in what mode?”

### 13.2 Rows / modules

| Module | Shows |
|--------|-------|
| Heartbeat | Age, last snapshot fetch |
| LIVE flag | Always OFF (emphasized) |
| dry_run | On |
| Provider | Mock active; OpenAI disabled |
| Departments | Resume dry_run; Website disabled |
| Scheduler | Last tick / idle |
| Queue depth | Counts by state |
| Dashboard bind | `127.0.0.1:4310` (informational) |
| SOS_AIOS_LIVE | `0` |

### 13.3 Forbidden controls

Start/stop factory, flip LIVE, swap provider, PM2 restart, Caddy/DNS.

---

## 14. Cost Monitor

| Block | Rule |
|-------|------|
| Cost today | Monospace currency; Mock era expects `$0.00` |
| By provider | Mock line; OpenAI line shows disabled / zero / n/a — never invent spend |
| By department | Resume vs others |
| By cycle | Optional drill-in from selected cycle |
| Alerts | Only if artifact reports budget signals; no fake thresholds |

Copy: “Costs reflect recorded artifacts only. Mock provider does not bill.”

---

## 15. Health Monitor

| Subsystem | Sources (conceptual) | Display |
|-----------|----------------------|---------|
| Dashboard shell | Snapshot fetch | healthy / degraded |
| Knowledge system | Snapshot readiness | healthy / unavailable |
| Resume department | Enablement + last cycle | dry_run / blocked / … |
| Founder decisions | Module readiness | ready / unavailable |
| Learning write-back | Learning store | ready / unavailable |
| Website department | Enablement | disabled |
| Provider Mock | Config | active |
| Provider OpenAI | Config | disabled |
| Telegram | Interface mode | unchanged_disabled |

Degraded rows must show **reason text** + artifact path when missing. No green-spam: OK uses contrast black, fail uses semantic red text per V1 tokens.

---

## 16. Responsive layout

| Breakpoint | Shell behaviour |
|------------|-----------------|
| `≥1280px` | Full: rail expandable, main, inspector 360px |
| `768–1279px` | Rail icons-only (56px); inspector as drawer; monitors under overflow menu |
| `<768px` | **Founder phone mode:** Top flags + Action Queue + Exceptions + Review CTA only; **no Brain graph**; Knowledge/Skills as simple lists; Inspector full-screen push |

### 16.1 Collapsing priority (narrow)

1. Keep: LIVE OFF, dry_run, provider, Review CTA, Action Queue  
2. Keep: Exceptions  
3. Defer: Brain canvas, Cost breakdown charts, dense Health matrix  
4. Never hide: safety flags

### 16.2 Touch

- Minimum hit target 40px for decision actions
- Confirm modals full-width on small screens
- No hover-only critical actions

---

## 17. Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘K` / `Ctrl+K` | Toggle command palette |
| `Esc` | Close palette / modal / clear selection (layered) |
| `g h` | Go Home |
| `g r` | Go Resume |
| `g v` | Go Review (v = verify/verdict) |
| `g k` | Go Knowledge |
| `g b` | Go Brain |
| `g s` | Go Skills |
| `g a` | Go Activity |
| `g m` | Go Runtime Monitor |
| `g c` | Go Cost |
| `g e` | Go Health (e = integrity) |
| `,` | Settings |
| `[` / `]` | Collapse / expand inspector |
| `j` / `k` | Next / previous row in focused list |
| `Enter` | Open selection |
| `⌘Enter` / `Ctrl+Enter` | Submit focused decision form (still requires confirm modal) |
| `?` | Shortcut help overlay |

Chord sequences (`g h`) wait ≤ 800ms for second key. Ignore when typing in inputs.

---

## 18. Color system

Inherit V1 tokens; V2 adds semantic roles **without new brand hues**.

| Token | Value | Usage |
|-------|-------|-------|
| `bg` | `#ffffff` | App background |
| `fg` | `#0a0a0a` | Primary text |
| `muted` | `#6b6b6b` | Secondary text |
| `border` | `#e5e5e5` | Hairlines |
| `surface` | `#f7f7f7` | Panels / zebra |
| `surface-2` | `#f0f0f0` | Focused row |
| `rail` | `#0a0a0a` | Nav rail |
| `rail-fg` | `#f5f5f5` | Rail text |
| `fail` | `#c62828` | Errors / failed only |
| `ok` | `#0a0a0a` | Healthy = contrast, not green |
| `disabled` | `#a3a3a3` | Disabled departments/controls |
| `focus` | `#0a0a0a` | Focus ring |
| `warning-ink` | `#0a0a0a` on `surface-2` | Dry-run / no-publish banners (not orange chrome) |

**Forbidden:** purple, indigo gradients, glow, neon green health, terracotta/cream marketing palette, dark-mode default.

Status dots: filled `fg` for nominal; `fail` for failed; hollow `disabled` for disabled.

---

## 19. Typography

| Role | Family | Size | Weight | Notes |
|------|--------|------|--------|-------|
| UI body | Geist Sans / system-ui | 13–14px | 400–500 | Default |
| Title | Geist Sans | 18–24px | 560–600 | Screen titles |
| Section | Geist Sans | 16px | 560 | Panel titles |
| Label | Geist Sans | 11–12px | 500 | Uppercase sparingly; prefer sentence case |
| Mono | Geist Mono / ui-monospace | 11–13px | 400 | IDs, times, costs, paths, events |
| Banner | Geist Sans | 12–13px | 500 | Safety banners |

Scale: `11 / 12 / 13 / 14 / 16 / 18 / 24`.  
No Inter/Roboto/Arial as intentional brand choice; system fallbacks allowed.

---

## 20. Motion system

### 20.1 Principles

1. Motion explains **state change**, not personality  
2. Idle ≈ still  
3. Active work = path token only  
4. Decisions settle to static receipt  
5. Reduced motion is first-class  

### 20.2 Easing

- Standard: ease-out for entrances  
- Exit: ease-in  
- No bounce, no spring overshoot  

### 20.3 Choreography caps

- Max concurrent decorative motions: 1  
- Max path tokens: 1 per graph  
- Toasts: stack max 3  

Full motion inventory: §5.

---

## 21. Empty states

| Surface | Empty copy |
|---------|------------|
| Exceptions | “No exceptions. AIOS is calm.” |
| Action Queue (no pending) | “No founder actions waiting.” |
| Activity | “No events in this filter.” |
| Knowledge domains | “No knowledge snapshot loaded.” |
| Learning index | “No founder learning entries yet.” |
| Skills | “No skills registered in snapshot.” |
| Brain (no cycle) | “No active cycle to visualize.” |
| Cost breakdown | “No cost artifacts recorded.” |
| Review (no pending) | “No review waiting. Select a cycle from Activity.” |
| Search/cmdk | “No matching commands.” |

Empty states never invent successful runs.

---

## 22. Error states

| Condition | UI |
|-----------|-----|
| Snapshot fetch fail | Main error banner + mono reason; keep last good snapshot if any with “stale” label |
| Missing artifact | “Unavailable — artifact missing” + path |
| Decision API fail | Inline fail on form; actions re-enabled; no fake receipt |
| Duplicate decision | Clear message: review already decided; show existing decision_id |
| LIVE unexpectedly on | Hard safety banner; block decision APIs client-side messaging; do not offer enable controls |
| Redaction failure | Omit field; show “redacted” |

Fail colour = `fail` token + text; never colour-only.

---

## 23. Loading states

| Region | Pattern |
|--------|---------|
| Initial app | Quiet skeleton for Pulse + Queue (lines, not spinners) |
| Route change | Prefer cached snapshot; soft skeleton only if null |
| Review evidence | Section skeletons per evidence panel |
| Decision submit | Button pending label “Recording…”; block double submit |
| Inspector | Lightweight skeleton 2–3 lines |

No decorative full-page spinners. No skeleton that looks like success metrics.

---

## 24. Accessibility

- Landmarks: `nav` (rail), `main`, `complementary` (inspector), `status` (top flags live region for heartbeat age sparingly)
- Focus visible: 2px outline offset on all interactive elements
- Keyboard: full path for Review decisions including confirm
- Contrast: WCAG AA on black/white
- Status: text label + optional dot
- `prefers-reduced-motion` respected (§5)
- Hit targets ≥ 40px on touch breakpoints
- Modals: focus trap; restore focus on close
- CmdK: aria listbox pattern
- Do not auto-focus destructive actions

---

## 25. Component naming rules

| Pattern | Example | Use |
|---------|---------|-----|
| `Aios` prefix for shell | `AiosShell`, `AiosTopStatusBar` | Cross-route chrome |
| `*View` for routes | `MissionControlView`, `FounderReviewView` | Screens |
| `*Panel` for panels | `FounderActionQueuePanel` | §4 panels |
| `*Inspector` | `KnowledgeInspector`, `SkillInspector` | Inspector bodies |
| `*Vis` for visualizations | `BrainGraphVis`, `TimelineVis`, `QueueVis` | Complex visuals |
| `*Form` / `*Receipt` | `ApproveDecisionForm`, `DecisionReceipt` | Review write UX |
| `*Chip` / `*Flag` | `SafetyFlags`, `StatusChip` | Compact status |
| Avoid `Card` in names unless §6 container | Prefer `Row`, `Panel`, `Item` | Anti-SaaS-card drift |
| No `Beautiful`, `Magic`, `Smart` in names | — | Clarity |

File names match primary export. One primary component per file for views/panels.

---

## 26. Folder architecture

Target structure under existing dashboard root (specification only — do not create in this agent):

```
SOS/SAIOS/dashboard/
  README.md
  server.ts                 # existing local API — unchanged by this spec
  src/
    main.tsx
    App.tsx
    shell/
      AiosShell.tsx
      TopStatusBar.tsx
      NavRail.tsx
      InspectorPanel.tsx
      CommandPalette.tsx
      ConfirmModal.tsx
      ToastStrip.tsx
    views/
      MissionControlView.tsx
      ResumeView.tsx
      FounderReviewView.tsx
      KnowledgeView.tsx
      BrainStudioView.tsx
      SkillsView.tsx
      ActivityView.tsx
      RuntimeMonitorView.tsx
      CostMonitorView.tsx
      HealthMonitorView.tsx
      SettingsView.tsx
    panels/
      SystemPulsePanel.tsx
      ExceptionStripPanel.tsx
      FounderActionQueuePanel.tsx
      DepartmentStripPanel.tsx
      ModeBannerPanel.tsx
      ReviewSummaryPanel.tsx
      Evidence*.tsx
      DecisionActionsPanel.tsx
      …
    inspectors/
      KnowledgeInspector.tsx
      SkillInspector.tsx
      RuntimeInspector.tsx
      DecisionInspector.tsx
      GenericEntityInspector.tsx
    vis/
      BrainGraphVis.tsx
      TimelineVis.tsx
      QueueVis.tsx
    forms/
      ApproveDecisionForm.tsx
      RejectDecisionForm.tsx
      ChangesRequestedForm.tsx
      DecisionReceipt.tsx
    data/
      types.ts
      loadSnapshot.ts
      redact.ts
    styles/                 # future tokens only; not authored here
  verify.ts
```

Backend modules remain in `SOS/SAIOS/core/*` — dashboard consumes APIs/artifacts only.

---

## 27. React component map

Logical tree for implementation agents (names only — no code):

| Component | Children / notes |
|-----------|------------------|
| `AiosShell` | TopStatusBar, NavRail, MainStage, InspectorPanel, portals |
| `TopStatusBar` | BrandMark, SafetyFlags, HeartbeatAge, CostTodayChip, HealthDotSummary, CommandPaletteTrigger |
| `NavRail` | NavItem*, NavMonitorGroup, NavFutureItem |
| `MainStage` | switch(route) → *View |
| `MissionControlView` | SystemPulsePanel, ExceptionStripPanel, FounderActionQueuePanel, DepartmentStripPanel, LatestCyclePanel |
| `ResumeView` | ModeBannerPanel, LatestCyclePanel, Knowledge hint, Review CTA |
| `FounderReviewView` | ModeBannerPanel, ReviewSummaryPanel, EvidenceProviderPanel, EvidenceQaPanel, EvidenceTimelinePanel, DecisionActionsPanel, DecisionReceipt |
| `KnowledgeView` | KnowledgeDomainsPanel, KnowledgeSnapshotPanel, LearningIndexPanel |
| `BrainStudioView` | BrainGraphVis, BrainLegendPanel |
| `SkillsView` | SkillTablePanel |
| `ActivityView` | ActivityFiltersPanel, ActivityStreamPanel / TimelineVis |
| `RuntimeMonitorView` | RuntimeFlagsPanel, QueueVis, Heartbeat |
| `CostMonitorView` | CostTodayPanel, CostBreakdownPanel |
| `HealthMonitorView` | HealthMatrixPanel |
| `SettingsView` | Local prefs, SessionShutdownPanel |
| `InspectorPanel` | tabbed inspectors by selection.kind |
| `CommandPalette` | commands for routes + open review + focus entities |
| `ConfirmModal` | decision confirmations |
| `ToastStrip` | non-blocking notices |

Data hooks (conceptual): `useDashboardSnapshot`, `useFounderReview`, `useRecordDecision` — wrappers around existing endpoints only.

---

## 28. Future extensibility for Website Department

### 28.1 Reserved UI slots

- Department strip row: `website` (already disabled pattern)
- Brain ghost node: Website
- Nav future item: Website
- Health row: Website department
- Activity filter: department=website

### 28.2 Enablement gate (future agent — not V2)

Website becomes operational in UI only when **all** are true:

1. `department-enablement` marks website enabled  
2. Founder unlock recorded  
3. Dedicated Website Review surface defined  
4. Still no accidental publish from AIOS without founder path  

### 28.3 What V2 must not do

- No Website builder canvas  
- No DNS/Caddy panels  
- No content publishing CTAs  
- No pretend “coming soon” feature marketing inside Mission Control first viewport  

When disabled: muted row + `disabled` + one-line reason.

---

## 29. Future multi-agent support

### 29.1 Reserved concepts

| Concept | V2 treatment |
|---------|--------------|
| Agent roster | Settings/info or future Agents screen — read-only placeholder list from project-state history if present |
| Agent run attribution | Activity events may show `agent` / `source` fields when artifacts include them |
| Parallel department runs | QueueVis lanes remain department-scoped; multi-agent = multiple actors later |
| Conflict / lock | Spec reserves Inspector section “Locks” — hidden until artifacts exist |

### 29.2 UI rules for later

- Multi-agent switcher must not appear until roster artifacts exist  
- Never imply Cursor chat agents are controllable from this OS shell  
- Founder remains single decision authority for Review  

### 29.3 Naming reserved

`AgentsView`, `AgentRosterPanel`, `AgentRunInspector` — do not implement in V2 UI build unless a later spec unlocks them.

---

## 30. Founder workflow from login to shutdown

### 30.1 Login / session start (local V2)

1. Founder opens local dashboard URL (`127.0.0.1`)  
2. Future: auth gate before VPS — **out of V2 UI build unless separate security agent**; spec reserves `SessionGate` placeholder  
3. Shell loads snapshot; safety flags render immediately (even before data): LIVE OFF · dry_run · Mock  
4. Land on `SCR_HOME`

### 30.2 Morning scan (Mission Control)

1. Read System Pulse — calm vs active  
2. Scan Exception strip  
3. Open Founder Action Queue  
4. If `waiting_founder` → enter Review  

### 30.3 Founder Review loop

1. Open pending review  
2. Read evidence stack top to bottom  
3. Choose Approve / Request Changes / Reject  
4. Complete form + confirm modal  
5. Read immutable receipt  
6. Note proposed next-safe-action appears in queue (**not** auto-started)  
7. Optionally inspect Learning entry via Knowledge Inspector  

### 30.4 Observation loops (optional)

- Knowledge: verify domains + learning merge  
- Brain: understand path for the cycle just reviewed  
- Skills: confirm which skill ran  
- Activity: audit events (`FOUNDER_*`, `LEARNING_*`)  
- Runtime / Cost / Health: confirm still dry-run, $0 Mock, subsystems healthy/disabled as expected  

### 30.5 Explicit non-actions

Founder does **not** in V2:

- Publish templates  
- Enable LIVE  
- Enable OpenAI  
- Enable Website  
- Configure Telegram  
- Change DNS/Caddy  

### 30.6 Shutdown / end of session

1. Settings → Session shutdown checklist:  
   - Pending reviews acknowledged or deliberately deferred  
   - No in-flight decision submit  
   - Note LIVE still OFF  
2. Confirm “Close local dashboard session”  
3. Overlay closes browser tab guidance only — **does not** shut down factory workers, PM2, or Vercel  
4. Toast: “Local UI session ended. AIOS factory state unchanged.”

---

## Appendix A — Safety banner copy (canonical)

> **LIVE OFF** · **dry_run** · **Provider: Mock** · **No automatic publication**

Must appear on Home (compact), Review (full), Runtime (full). Must not be dismissible.

---

## Appendix B — Mapping to existing backend (read-only consumption)

| UI need | Existing source (do not redesign) |
|---------|-----------------------------------|
| Snapshot | `/api/snapshot` + log artifacts |
| Founder review payload | `/api/founder-review` + `first-dry-run/founder-review.json` |
| Decisions | `/api/founder-decision` + `core/founder-decisions` |
| Learning | `SOS/07_LOGS/saios/knowledge/learning/*` via knowledge merge |
| Action queue | `founder-action-queue.json` |
| Enablement | `department-enablement.json` |
| Design tokens baseline | `AIOS_DASHBOARD_DESIGN_SYSTEM.md` |

---

## Appendix C — V2 delivery phases (for later agents — not this document)

| Phase | Scope | Still forbidden |
|-------|-------|-----------------|
| V2a | Shell IA: Runtime/Cost/Health routes, nav hierarchy, inspector tabs | Backend redesign |
| V2b | Review UX polish per §10 | Auto-decide pending review |
| V2c | Brain/Timeline/Queue vis fidelity | WebGL, LIVE controls |
| V2d | a11y + shortcuts + responsive pass | Public exposure |

This master spec is the gate: **no UI implementation agent should invent screens outside §1–§30 without amending this document.**

---

## Appendix D — Document control

| Field | Value |
|-------|-------|
| Filename | `AIOS_FOUNDER_DASHBOARD_V2_MASTER_SPEC.md` |
| Path | `SOS/SAIOS/AIOS_FOUNDER_DASHBOARD_V2_MASTER_SPEC.md` |
| Agent | #126 |
| Output class | Specification only |
| Implementation in this agent | None |

**End of specification.**
