# AIOS Founder Dashboard Design System

**Version:** 1.0.0  
**Agent:** #123  
**Status:** LOCKED for V1

---

## Purpose

Internal operating-system interface for the founder.  
Read-only in V1. Black / white / neutral. Calm. Premium. Not an admin template.

---

## Layout grid

| Region | Width | Behaviour |
|--------|-------|-----------|
| Nav rail | 56px collapsed / 180px expanded | Desktop always; tablet collapsible |
| Main | `1fr` | Mission Control / department views |
| Inspector | 320px | Collapses to 0 when nothing selected |
| Top bar | 48px height | Full width |

Desktop breakpoints:

- `≥1280px` — full shell
- `768–1279px` — rail icons-only; inspector as drawer
- `<768px` — status summary + exceptions + actions only; no Brain graph

---

## Navigation rail

- Home, Resume, Knowledge, Brain, Skills, Activity, Settings (placeholder)
- Website appears only as a **disabled** service row on Mission Control — not an operational nav destination in V1
- Active item: white text on black rail with left 2px white indicator
- Focus: visible 2px outline offset

---

## Top status bar

Always visible:

- **AIOS** identity
- **LIVE OFF** (permanent until founder unlock — never hide)
- **dry_run**
- **provider: Mock**
- heartbeat age (monospace)
- cost today: `$0.00` (monospace)
- command palette trigger (`⌘K` / `Ctrl+K`)

---

## Right inspector

Shows selection of: run · department · event · skill · knowledge snapshot.  
Empty → collapsed.  
No write actions in V1.

---

## Colour tokens

```css
--aios-bg: #ffffff;
--aios-fg: #0a0a0a;
--aios-muted: #6b6b6b;
--aios-border: #e5e5e5;
--aios-surface: #f7f7f7;
--aios-surface-2: #f0f0f0;
--aios-rail: #0a0a0a;
--aios-rail-fg: #f5f5f5;
--aios-fail: #c62828;        /* only semantic red */
--aios-ok: #0a0a0a;          /* health = contrast, not green spam */
--aios-disabled: #a3a3a3;
--aios-focus: #0a0a0a;
```

No purple. No gradients as brand. No glow.

---

## Typography

| Role | Spec |
|------|------|
| UI | Geist Sans / system-ui, 13–14px body |
| Titles | 18–24px, weight 560–600 |
| Mono | Geist Mono / ui-monospace — IDs, timestamps, events, costs |
| Scale | 11 / 12 / 13 / 14 / 16 / 18 / 24 |

---

## Spacing scale

`4 · 8 · 12 · 16 · 24 · 32 · 48`  
Base unit: 4px.

---

## Borders & shadows

- Borders: `1px solid var(--aios-border)`
- Radius: `0` or `2px` max (OS, not soft SaaS cards)
- Shadows: none by default; inspector may use `0 0 0 1px` hairline only

---

## Motion rules

- Prefer opacity / transform ≤ 200ms
- Idle System Pulse: near-still (opacity breathe ≤ 4%)
- Active path: token travel along SVG path only when `running|planning`
- `prefers-reduced-motion: reduce` → disable all non-essential motion
- Never convey status by animation alone

---

## Status vocabulary

| Status | Meaning |
|--------|---------|
| `idle` | No active work |
| `queued` | Waiting to start |
| `planning` | Knowledge / skill planning |
| `running` | Provider / pipeline executing |
| `waiting_founder` | Needs founder decision |
| `blocked` | Gate or config block |
| `failed` | Terminal failure |
| `completed` | Terminal success |
| `disabled` | Intentionally off |
| `degraded` | Partial health |
| `healthy` | Nominal |

Every status shows **text label + optional status dot**.

---

## Accessibility

- Full keyboard nav; visible focus rings
- Reduced motion support
- Semantic landmarks (`nav`, `main`, `complementary`)
- Contrast ≥ WCAG AA on black/white
- Status not colour-only

---

## Empty / loading / error

- Empty exceptions: “No exceptions. AIOS is calm.”
- Missing artifact: “Unavailable — artifact missing” (never invent success)
- Loading: quiet skeleton lines, no spinners as decoration
- Error: red text + monospace path of missing file

---

## Cards

Default: **no cards**.  
Use rows, hairline separators, and panels only when interaction requires a container.
