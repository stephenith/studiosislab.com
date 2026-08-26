# AIOS Dashboard Component Library V1

**Agent:** #148  
**Foundation:** Agent #147 design tokens + shell primitives  
**Scope:** Reusable UI only — no backend, API, routing, state, or Review workflow changes

Import:

```ts
import {
  KPIStatCard,
  DepartmentHealthCard,
  // …
} from "../design-system";
```

Styles load via `main.tsx`: `tokens.css` → `components.css` → `library.css` → `global.css`.

---

## Shell & chrome (Agent #147)

| Component | Purpose | Key props | Usage |
|---|---|---|---|
| `DashboardShell` | Page grid: sidebar + toolbar + main (+ inspector) | `sidebar`, `toolbar`, `children`, `inspector`, `inspectorOpen` | Wrap every dashboard route |
| `Sidebar` | Near-black nav rail | `items`, `activeId`, `onSelect`, `brand` | Department navigation |
| `TopToolbar` | Top search / meta / actions row | `search`, `meta`, `actions` | Global chrome |
| `SearchBar` | Pill search field | `value`, `onChange`, `placeholder` | Toolbar or page filters |
| `NotificationButton` | Bell + optional dot | `hasNotification`, `onClick` | Toolbar |
| `ProfileMenu` | Avatar + label | `initials`, `label`, `onClick` | Toolbar |
| `PageHeader` | Page title + subtitle + actions | `title`, `subtitle`, `actions` | Top of each page |
| `SectionHeader` | In-card / in-section heading | `title`, `as`, `actions` | Section titles |
| `StatCard` / `MetricCard` | Simple numeric tiles | `value`, `label`, `hint` | Lightweight stats |
| `SectionCard` | Generic white card | `title`, `children` | Content grouping |
| `ReviewCard` | Compact review queue row | `title`, `thumb`, `meta`, `selected`, `onClick` | Review list items |
| `Badge` | Status / meta pill | `tone`, `children` | Status chips |
| `PrimaryButton` / `SecondaryButton` / `DangerButton` | Standard CTAs | `size`, button HTML attrs | Actions |
| `EmptyState` | Empty panel with art | `title`, `copy`, `action` | No-data states |
| `Skeleton` | Single skeleton block/line | `variant`, `width`, `height` | Loading placeholders |
| `ChartCard` | Chart section card | `title`, `actions`, `children` | Analytics panels |
| `StickyFooter` | Sticky bottom action bar | `children`, `busy` | Persistent page actions |

---

## High-level library (Agent #148)

### `KPIStatCard`
**Purpose:** KPI tile with value, label, optional delta + icon + status tone.  
**Props:** `value`, `label`, `delta?`, `deltaDirection?: "up"|"down"|"flat"`, `icon?`, `tone?: BadgeTone`, `className?`  
**Usage:**
```tsx
<KPIStatCard value={12} label="Waiting reviews" delta="+2" deltaDirection="up" tone="waiting" icon="◎" />
```

### `DepartmentHealthCard`
**Purpose:** Department health summary.  
**Props:** `department`, `status`, `statusTone?`, `queue?`, `provider?`, `heartbeat?`, `lastActivity?`, `onClick?`, `disabled?`  
**Usage:**
```tsx
<DepartmentHealthCard
  department="Resume"
  status="healthy"
  statusTone="approved"
  queue={3}
  provider="Mock"
  heartbeat="12s"
  lastActivity="Jul 11, 10:02"
  onClick={() => open("resume")}
/>
```

### `TimelineCard`
**Purpose:** Recent activity list with severity icons.  
**Props:** `title?`, `items: TimelineEntry[]`, `emptyLabel?`  
**`TimelineEntry`:** `id`, `title`, `timestamp`, `body?`, `icon?`, `severity?: "info"|"warn"|"error"|"ok"`  
**Usage:**
```tsx
<TimelineCard items={[{ id: "1", title: "Decision recorded", timestamp: "10:02", severity: "ok" }]} />
```

### `FounderActionCard`
**Purpose:** Priority action with CTA.  
**Props:** `priority`, `priorityTone?`, `title`, `description`, `ctaLabel?`, `onCta?`, `cta?`  
**Usage:**
```tsx
<FounderActionCard priority="P0" title="Approve FR#005" description="Awaiting founder" onCta={() => {}} />
```

### `RuntimeStatusCard`
**Purpose:** LIVE / provider / cost / heartbeat / queue snapshot.  
**Props:** `liveLabel?`, `provider?`, `cost?`, `heartbeat?`, `queue?`  
**Usage:**
```tsx
<RuntimeStatusCard liveLabel="LIVE OFF" provider="Mock" cost="$0.00" heartbeat="8s" queue={4} />
```

### `ChartContainer`
**Purpose:** Reusable chart wrapper (title + body).  
**Props:** `title?`, `actions?`, `children?`, `minHeight?`  
**Usage:**
```tsx
<ChartContainer title="Learning hours">{/* chart */}</ChartContainer>
```

### `EmptyIllustration`
**Purpose:** Reference-style empty illustration.  
**Props:** `title`, `copy?`, `action?`  
**Usage:**
```tsx
<EmptyIllustration title="No reviews" copy="Waiting cycles appear here." />
```

### `LoadingSkeletons`
**Purpose:** Packaged loading skeletons.  
**Props:** `variant?: "cards"|"list"|"page"`, `count?`  
**Usage:**
```tsx
<LoadingSkeletons variant="page" />
```

### `InfoBanner`
**Purpose:** Informational banner.  
**Props:** `title?`, `children`, `icon?`  
**Usage:**
```tsx
<InfoBanner title="Dry run">Publication is disabled.</InfoBanner>
```

### `AlertBanner`
**Purpose:** Alert / warn / ok banner.  
**Props:** `title?`, `children`, `tone?: "alert"|"warn"|"ok"`, `icon?`  
**Usage:**
```tsx
<AlertBanner tone="warn" title="Blocked">Critic gate not ready.</AlertBanner>
```

### `MetricGrid`
**Purpose:** Responsive grid for KPI / metric children.  
**Props:** `children`, `columns?`  
**Usage:**
```tsx
<MetricGrid>{/* KPIStatCard… */}</MetricGrid>
```

### `PageSection`
**Purpose:** Titled page section with optional actions.  
**Props:** `title`, `subtitle?`, `actions?`, `children`  
**Usage:**
```tsx
<PageSection title="Departments" subtitle="Health overview">…</PageSection>
```

### `ToolbarActions`
**Purpose:** Horizontal action cluster.  
**Props:** `children`  
**Usage:**
```tsx
<ToolbarActions><PrimaryButton>Refresh</PrimaryButton></ToolbarActions>
```

### `SearchAndFilters`
**Purpose:** Search + filter chips row.  
**Props:** `searchValue?`, `onSearchChange?`, `filters?`, `activeFilterId?`, `onFilterChange?`, `searchPlaceholder?`  
**Usage:**
```tsx
<SearchAndFilters
  searchValue={q}
  onSearchChange={setQ}
  filters={[{ id: "all", label: "All" }]}
  activeFilterId="all"
  onFilterChange={setFilter}
/>
```

### `AIOSModal`
**Purpose:** Modal dialog shell (Escape + overlay click closes).  
**Props:** `open`, `title`, `children`, `onClose`, `size?`, `footer?`  
**Usage:**
```tsx
<AIOSModal open={open} title="Details" onClose={() => setOpen(false)}>…</AIOSModal>
```

### `ConfirmationDialog`
**Purpose:** Confirm / cancel dialog.  
**Props:** `open`, `title`, `message`, `onConfirm`, `onCancel`, `confirmLabel?`, `cancelLabel?`, `danger?`, `busy?`  
**Usage:**
```tsx
<ConfirmationDialog open={open} title="Reject?" message="This cannot be undone." onConfirm={…} onCancel={…} danger />
```

### `Toast`
**Purpose:** Fixed toast stack.  
**Props:** `toasts: ToastItem[]`, `onDismiss?`  
**`ToastItem`:** `id`, `message`, `tone?: "default"|"ok"|"error"|"warn"`  
**Usage:**
```tsx
<Toast toasts={[{ id: "1", message: "Saved", tone: "ok" }]} onDismiss={dismiss} />
```

### `ProgressIndicator`
**Purpose:** Progress bar with label / percent.  
**Props:** `value`, `max?`, `label?`, `showPercent?`, `tone?`  
**Usage:**
```tsx
<ProgressIndicator value={83} label="Cycle progress" tone="processing" />
```

---

## Interaction standards

| Concern | Standard |
|---|---|
| Hover | Cards lift 1px + stronger shadow; chips darken border |
| Transitions | `--ds-duration-fast` / `--ds-duration` + `--ds-ease` |
| Focus rings | 2px solid `--ds-focus`, 2px offset on buttons, chips, cards |
| Spacing | `--ds-space-*` + `--ds-gutter` |
| Button height | sm 32 / md 40 / lg 48 (`--ds-btn-h-*`) |
| Card padding | `--ds-space-5` (20px) |
| Typography | Geist / DM Sans via `--ds-font`; sizes `--ds-text-xs`…`3xl` |
| Status color | waiting orange · approved green · rejected red · processing blue |

---

## Pages ready for migration (Agent #149+)

These pages already sit in `DashboardShell` and can adopt library cards without logic changes:

1. Home / Mission Control → `KPIStatCard`, `DepartmentHealthCard`, `RuntimeStatusCard`, `TimelineCard`, `FounderActionCard`, `ChartContainer`
2. Resume → `PageSection`, `MetricGrid`, `ProgressIndicator`
3. Knowledge / Brain / Skills / Activity → `TimelineCard`, `SearchAndFilters`, `EmptyIllustration`
4. Provider Validation → `AlertBanner`, `InfoBanner`, `RuntimeStatusCard`
5. Review → already uses shell + some DS primitives; optional further swap to `SearchAndFilters` / `KPIStatCard` (keep `fr-v3-*` verify hooks)

---

## Constraints

- LIVE OFF · dry_run · Mock provider unchanged
- No API / routing / Review decision changes
- Library is presentational; parents own data fetching and state
