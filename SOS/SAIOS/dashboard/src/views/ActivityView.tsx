import { useMemo, useState } from "react";
import type { DashboardRoute, DashboardSnapshot } from "../data/types";
import {
  Badge,
  EmptyIllustration,
  FilterChipButton,
  FilterChipGroup,
  InfoBanner,
  KPIStatCard,
  MetricGrid,
  PageHeader,
  PageSection,
  PrimaryButton,
  RuntimeStatusCard,
  SearchBar,
  SecondaryButton,
  SectionCard,
  TimelineCard,
  ToolbarActions,
  type BadgeTone,
} from "../design-system";
import { NA, display, isToday } from "../lib/display";

type SeverityFilter = "all" | "ok" | "warn" | "error" | "founder";
type DeptFilter = "all" | string;

function eventSeverity(
  status: string,
): "ok" | "warn" | "error" | "info" {
  const s = status.toLowerCase();
  if (s === "fail" || s === "failed" || s === "blocked") return "error";
  if (s === "degraded" || s === "waiting" || s === "waiting_founder") return "warn";
  if (s === "completed" || s === "healthy" || s === "ok") return "ok";
  return "info";
}

function severityTone(sev: string): BadgeTone {
  if (sev === "error" || sev === "fail" || sev === "blocked") return "blocked";
  if (sev === "warn" || sev === "degraded" || sev === "founder") return "waiting";
  if (sev === "ok" || sev === "completed") return "approved";
  return "neutral";
}

function recommendedAction(
  severity: string,
  title: string,
): string {
  const s = severity.toLowerCase();
  if (s === "founder") return "Open Founder Review / resolve founder gate";
  if (s === "fail" || s === "blocked") return "Inspect source artifact and unblock";
  if (s === "degraded") return "Monitor and review degraded path";
  return `Review exception: ${title}`;
}

function priorityRank(priority: string): number {
  const m = priority.match(/(\d+)/);
  if (m) return Number(m[1]);
  const p = priority.toUpperCase();
  if (p.includes("P0") || p.includes("CRITICAL")) return 0;
  if (p.includes("P1") || p.includes("HIGH")) return 1;
  if (p.includes("P2") || p.includes("MED")) return 2;
  if (p.includes("P3") || p.includes("LOW")) return 3;
  return 50;
}

function routeForAction(category?: string, source?: string): DashboardRoute | null {
  const blob = `${category ?? ""} ${source ?? ""}`.toLowerCase();
  if (blob.includes("provider")) return "provider-validation";
  if (blob.includes("knowledge")) return "knowledge";
  if (blob.includes("brain")) return "brain";
  if (blob.includes("resume") || blob.includes("review") || blob.includes("founder")) {
    return "review";
  }
  return "review";
}

type Props = {
  snapshot: DashboardSnapshot;
  onSelectEvent: (id: string) => void;
  onNavigate?: (route: DashboardRoute) => void;
  onOpenReview?: () => void;
  onRefresh?: () => void;
};

export function ActivityView({
  snapshot,
  onSelectEvent,
  onNavigate,
  onOpenReview,
  onRefresh,
}: Props) {
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState<SeverityFilter>("all");
  const [department, setDepartment] = useState<DeptFilter>("all");
  const [note, setNote] = useState<string | null>(null);
  const q = query.trim().toLowerCase();
  const top = snapshot.top_bar;
  const activity = snapshot.activity ?? [];
  const exceptions = snapshot.exceptions ?? [];
  const founderActions = snapshot.founder_actions ?? [];

  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const e of activity) {
      if (e.department) set.add(e.department);
    }
    return ["all", ...[...set].sort()];
  }, [activity]);

  const stats = useMemo(() => {
    const eventsToday = activity.filter((e) => isToday(e.timestamp)).length;
    const warnings =
      activity.filter((e) => eventSeverity(e.status) === "warn").length +
      exceptions.filter((e) => e.severity === "degraded" || e.severity === "founder")
        .length;
    const errors =
      activity.filter((e) => eventSeverity(e.status) === "error").length +
      exceptions.filter((e) => e.severity === "fail" || e.severity === "blocked")
        .length;
    const completed = activity.filter(
      (e) => e.status === "completed" || e.status === "healthy",
    ).length;
    const pendingReviews = activity.filter(
      (e) =>
        e.status === "waiting_founder" ||
        e.event_type.toLowerCase().includes("review") ||
        e.summary.toLowerCase().includes("founder"),
    ).length;
    const learning = activity.filter((e) => {
      const blob = `${e.event_type} ${e.summary}`.toLowerCase();
      return blob.includes("learning") || blob.includes("write-back") || blob.includes("writeback");
    }).length;
    const hasAnyDates = activity.some((e) => e.timestamp && Date.parse(e.timestamp));

    return {
      eventsToday: activity.length === 0 ? null : hasAnyDates ? eventsToday : null,
      warnings: activity.length === 0 && exceptions.length === 0 ? null : warnings,
      errors: activity.length === 0 && exceptions.length === 0 ? null : errors,
      events: activity.length === 0 ? null : activity.length,
      completed: activity.length === 0 ? null : completed,
      pendingReviews: activity.length === 0 ? null : pendingReviews,
      learning: activity.length === 0 ? null : learning,
      founderActionCount: founderActions.length === 0 ? null : founderActions.length,
    };
  }, [activity, exceptions, founderActions]);

  const filteredActivity = useMemo(() => {
    return activity.filter((e) => {
      if (department !== "all" && e.department !== department) return false;
      const sev = eventSeverity(e.status);
      if (severity === "ok" && sev !== "ok") return false;
      if (severity === "warn" && sev !== "warn") return false;
      if (severity === "error" && sev !== "error") return false;
      if (severity === "founder") {
        const blob = `${e.event_type} ${e.summary} ${e.status}`.toLowerCase();
        if (!blob.includes("founder") && e.status !== "waiting_founder") return false;
      }
      if (!q) return true;
      return (
        e.summary.toLowerCase().includes(q) ||
        e.event_type.toLowerCase().includes(q) ||
        e.department.toLowerCase().includes(q) ||
        e.status.toLowerCase().includes(q) ||
        (e.run_id ?? "").toLowerCase().includes(q)
      );
    });
  }, [activity, department, severity, q]);

  const sortedActions = useMemo(() => {
    return [...founderActions].sort(
      (a, b) => priorityRank(a.priority) - priorityRank(b.priority),
    );
  }, [founderActions]);

  const severityChips: Array<{ id: SeverityFilter; label: string }> = [
    { id: "all", label: "All" },
    { id: "ok", label: "OK" },
    { id: "warn", label: "Warn" },
    { id: "error", label: "Error" },
    { id: "founder", label: "Founder" },
  ];

  return (
    <div className="ds-command">
      <PageHeader
        title="Activity Center"
        subtitle="Unified operational timeline across AIOS."
        actions={
          <ToolbarActions>
            <SearchBar
              value={query}
              placeholder="Search activity…"
              aria-label="Search"
              onChange={setQuery}
            />
            <SecondaryButton size="sm" onClick={() => onRefresh?.()}>
              Refresh
            </SecondaryButton>
            <FilterChipGroup aria-label="Severity filters">
              {severityChips.map((chip) => (
                <FilterChipButton
                  key={chip.id}
                  id={chip.id}
                  label={chip.label}
                  active={severity === chip.id}
                  onClick={() => setSeverity(chip.id)}
                />
              ))}
            </FilterChipGroup>
            <FilterChipGroup aria-label="Department filters">
              {departments.map((d) => (
                <FilterChipButton
                  key={d}
                  id={d}
                  label={d === "all" ? "All Depts" : d}
                  active={department === d}
                  onClick={() => setDepartment(d)}
                />
              ))}
            </FilterChipGroup>
          </ToolbarActions>
        }
      />

      <InfoBanner title="Append-only timeline">
        LIVE OFF · dry_run · Activity is read from existing snapshot artifacts
      </InfoBanner>

      {note ? <InfoBanner title="Quick Action">{note}</InfoBanner> : null}

      <div className="ds-command-split">
        <div className="ds-command-main">
          {/* ROW 1 */}
          <PageSection title="Live Status" subtitle="Activity runtime">
            <RuntimeStatusCard
              liveLabel={top.live_label}
              provider={top.provider}
              cost={`$${top.cost_today_usd}`}
              heartbeat={top.heartbeat_age}
              queue={stats.events ?? 0}
            />
            <MetricGrid>
              <KPIStatCard
                value={stats.eventsToday == null ? NA : stats.eventsToday}
                label="Events Today"
                tone="processing"
                icon="◎"
              />
              <KPIStatCard
                value={stats.warnings == null ? NA : stats.warnings}
                label="Warnings"
                tone="waiting"
                icon="⚠"
              />
              <KPIStatCard
                value={stats.errors == null ? NA : stats.errors}
                label="Errors"
                tone="blocked"
                icon="✕"
              />
              <KPIStatCard
                value={
                  stats.founderActionCount == null
                    ? NA
                    : stats.founderActionCount
                }
                label="Founder Actions"
                tone="waiting"
                icon="⚑"
              />
              <KPIStatCard
                value={display(top.heartbeat_age)}
                label="Heartbeat"
                tone="neutral"
                icon="♥"
              />
            </MetricGrid>
          </PageSection>

          {/* ROW 2 */}
          <PageSection title="KPI Grid" subtitle="Operational counts">
            <MetricGrid>
              <KPIStatCard
                value={stats.events == null ? NA : stats.events}
                label="Events"
              />
              <KPIStatCard
                value={stats.warnings == null ? NA : stats.warnings}
                label="Warnings"
                tone="waiting"
              />
              <KPIStatCard
                value={stats.errors == null ? NA : stats.errors}
                label="Errors"
                tone="blocked"
              />
              <KPIStatCard
                value={stats.completed == null ? NA : stats.completed}
                label="Completed Runs"
                tone="approved"
              />
              <KPIStatCard
                value={
                  stats.pendingReviews == null ? NA : stats.pendingReviews
                }
                label="Pending Reviews"
                tone="waiting"
              />
              <KPIStatCard
                value={stats.learning == null ? NA : stats.learning}
                label="Learning Updates"
              />
            </MetricGrid>
          </PageSection>

          {/* ROW 3 */}
          <PageSection title="Activity Timeline" subtitle="Unified event stream">
            {filteredActivity.length === 0 ? (
              <EmptyIllustration
                title={NA}
                copy={
                  activity.length === 0
                    ? "activity is empty in the current snapshot."
                    : "No events match the current search/filters."
                }
              />
            ) : (
              <TimelineCard
                title="Operational timeline"
                items={filteredActivity.slice(0, 40).map((e) => ({
                  id: e.id,
                  title: e.summary || e.event_type,
                  timestamp: e.timestamp || NA,
                  body: `${e.department} · ${e.event_type} · ${e.status}${e.run_id ? ` · ${e.run_id}` : ""}`,
                  icon: "◦",
                  severity: eventSeverity(e.status),
                  onClick: () => onSelectEvent(e.id),
                }))}
              />
            )}
          </PageSection>

          {/* ROW 4 */}
          <PageSection title="Exception Center" subtitle="Current exceptions">
            {exceptions.length === 0 ? (
              <EmptyIllustration
                title={NA}
                copy="No exceptions in the current snapshot."
              />
            ) : (
              <MetricGrid columns={2}>
                {exceptions.map((ex) => (
                  <SectionCard key={ex.id} title={ex.title}>
                    <div className="ds-stack-xs">
                      <Badge tone={severityTone(ex.severity)}>
                        {ex.severity}
                      </Badge>
                      <p className="mono muted ds-meta-mono">
                        Source: {display(ex.source)}
                      </p>
                      <p className="mono muted ds-meta-mono">
                        Status: {display(ex.severity)}
                      </p>
                      <p className="ds-body-sm">{ex.detail}</p>
                      <p className="ds-meta">
                        Recommended Action:{" "}
                        {recommendedAction(ex.severity, ex.title)}
                      </p>
                    </div>
                  </SectionCard>
                ))}
              </MetricGrid>
            )}
          </PageSection>

          {/* ROW 5 */}
          <PageSection
            title="Founder Actions"
            subtitle="Priority sorted"
          >
            {sortedActions.length === 0 ? (
              <EmptyIllustration
                title={NA}
                copy="No founder_actions in the current snapshot."
              />
            ) : (
              <div className="ds-stack-sm">
                {sortedActions.map((action) => {
                  const route = routeForAction(action.category, action.source);
                  return (
                    <SectionCard key={action.id} title={action.title}>
                      <div className="ds-stack-xs">
                        <div className="ds-row-wrap">
                          <Badge tone="waiting">
                            {display(action.priority)}
                          </Badge>
                          <Badge tone="neutral">
                            {display(action.category ?? "uncategorized")}
                          </Badge>
                          <Badge tone="processing">open</Badge>
                        </div>
                        <p className="ds-body-sm">{action.detail}</p>
                        <p className="mono muted ds-meta-mono">
                          {display(action.source)}
                        </p>
                        <SecondaryButton
                          size="sm"
                          onClick={() => {
                            if (route === "review") onOpenReview?.();
                            else if (route) onNavigate?.(route);
                          }}
                        >
                          Open
                        </SecondaryButton>
                      </div>
                    </SectionCard>
                  );
                })}
              </div>
            )}
          </PageSection>
        </div>

        {/* RIGHT SIDEBAR */}
        <aside className="ds-command-aside" aria-label="Activity quick actions">
          <PageSection title="Quick Actions" subtitle="Buttons only · no backend">
            <div className="ds-command-actions ds-command-actions-col">
              <PrimaryButton onClick={() => onNavigate?.("resume")}>
                Resume Department
              </PrimaryButton>
              <SecondaryButton onClick={() => onNavigate?.("knowledge")}>
                Knowledge
              </SecondaryButton>
              <SecondaryButton onClick={() => onNavigate?.("brain")}>
                Brain
              </SecondaryButton>
              <SecondaryButton
                onClick={() => onNavigate?.("provider-validation")}
              >
                Provider Validation
              </SecondaryButton>
              <SecondaryButton onClick={() => onOpenReview?.()}>
                Founder Review
              </SecondaryButton>
              <SecondaryButton
                onClick={() => {
                  onRefresh?.();
                  setNote("Activity refresh requested via existing dashboard loader.");
                }}
              >
                Refresh Activity
              </SecondaryButton>
            </div>
          </PageSection>

          <SectionCard title="Pulse">
            <p className="mono ds-meta">Events {display(stats.events)}</p>
            <p className="ds-meta">
              Heartbeat {display(top.heartbeat_age)} · {top.live_label}
            </p>
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}
