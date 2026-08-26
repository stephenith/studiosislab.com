import { useMemo, useState } from "react";
import type {
  AiosStatus,
  DashboardRoute,
  DashboardSnapshot,
  DepartmentRow,
} from "../data/types";
import type { BadgeTone } from "../design-system";
import {
  AlertBanner,
  DepartmentHealthCard,
  EmptyIllustration,
  FounderActionCard,
  InfoBanner,
  KPIStatCard,
  MetricGrid,
  NotificationButton,
  PageHeader,
  PageSection,
  PrimaryButton,
  ProfileMenu,
  ProgressIndicator,
  RuntimeStatusCard,
  SearchBar,
  SecondaryButton,
  SectionCard,
  TimelineCard,
  type TimelineEntry,
} from "../design-system";

function statusTone(status: AiosStatus | string): BadgeTone {
  const s = String(status).toLowerCase();
  if (s === "healthy" || s === "completed" || s === "ready") return "approved";
  if (s === "waiting_founder" || s === "queued" || s === "planning") return "waiting";
  if (s === "failed" || s === "blocked" || s === "disabled") return "rejected";
  if (s === "running" || s === "degraded") return "processing";
  return "neutral";
}

function priorityTone(priority: string): BadgeTone {
  const p = priority.toUpperCase();
  if (p.includes("P0") || p.includes("SECURITY")) return "rejected";
  if (p.includes("P1") || p.includes("BLOCK")) return "waiting";
  if (p.includes("P2") || p.includes("RELEASE")) return "processing";
  return "neutral";
}

function formatActivity(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return new Date(t).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function deptIcon(id: string): string {
  const map: Record<string, string> = {
    resume: "▦",
    knowledge: "▣",
    brain: "◈",
    skills: "✧",
    mock: "◇",
    website: "⌂",
    "provider-validation": "⚙",
    activity: "▤",
    review: "◎",
  };
  return map[id] ?? "•";
}

export function MissionControl({
  snapshot,
  onOpenDepartment,
  onSelectCycle,
  onSelectKnowledge,
  onOpenReview,
  onOpenMissionApproval,
  onOpenQueueAdmission,
  onOpenExecutionPackage,
  onOpenQueueSubmission,
  onOpenShadowQueue,
  onOpenRuntimePlan,
  onOpenRuntimeRelease,
  onOpenSystemReadiness,
  onOpenExecutionController,
  onOpenDepartmentRegistry,
  onOpenCostLedger,
  onOpenWorkerRuntime,
  onOpenTelemetryRegistry,
  onOpenActivationGate,
  onOpenExecutionAuthorization,
  onOpenPreDispatchSimulation,
}: {
  snapshot: DashboardSnapshot;
  onOpenDepartment: (id: string, route: DashboardRoute | null) => void;
  onSelectCycle: (id: string) => void;
  onSelectKnowledge: () => void;
  onOpenReview?: () => void;
  onOpenMissionApproval?: () => void;
  onOpenQueueAdmission?: () => void;
  onOpenExecutionPackage?: () => void;
  onOpenQueueSubmission?: () => void;
  onOpenShadowQueue?: () => void;
  onOpenRuntimePlan?: () => void;
  onOpenRuntimeRelease?: () => void;
  onOpenSystemReadiness?: () => void;
  onOpenExecutionController?: () => void;
  onOpenDepartmentRegistry?: () => void;
  onOpenCostLedger?: () => void;
  onOpenWorkerRuntime?: () => void;
  onOpenTelemetryRegistry?: () => void;
  onOpenActivationGate?: () => void;
  onOpenExecutionAuthorization?: () => void;
  onOpenPreDispatchSimulation?: () => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const waitingReviews = useMemo(
    () =>
      (snapshot.review_queue ?? []).filter((r) => r.status === "waiting_founder")
        .length,
    [snapshot.review_queue],
  );

  const healthyDepartments = useMemo(
    () =>
      snapshot.departments.filter(
        (d) => d.health === "healthy" || d.status === "healthy",
      ).length,
    [snapshot.departments],
  );

  const providerLabel =
    snapshot.provider_validation?.selection_status ??
    snapshot.top_bar.provider;

  const departmentCards = useMemo(() => {
    const byId = new Map(snapshot.departments.map((d) => [d.id, d]));
    const coreIds = [
      "resume",
      "knowledge",
      "brain",
      "skills",
      "provider-validation",
      "website",
    ] as const;

    const ordered: Array<DepartmentRow & { providerHint?: string }> = [];

    for (const id of coreIds) {
      if (id === "provider-validation") {
        const pv = snapshot.provider_validation;
        ordered.push({
          id: "provider-validation",
          label: "Provider Validation",
          status: (pv?.eligible ? "healthy" : "degraded") as AiosStatus,
          mode: pv?.readiness_state ?? "idle",
          queue_depth: null,
          last_activity: null,
          health: (pv?.eligible ? "healthy" : "degraded") as AiosStatus,
          open_route: "provider-validation",
          notes: pv?.founder_action ?? undefined,
          providerHint: snapshot.top_bar.provider,
        });
        continue;
      }
      const d = byId.get(id);
      if (d) ordered.push(d);
    }

    const mock = byId.get("mock");
    if (mock) ordered.splice(4, 0, mock);

    return ordered.filter((d) => {
      if (!q) return true;
      return (
        d.label.toLowerCase().includes(q) ||
        d.id.toLowerCase().includes(q) ||
        d.status.toLowerCase().includes(q)
      );
    });
  }, [snapshot.departments, snapshot.provider_validation, snapshot.top_bar.provider, q]);

  const founderActions = useMemo(() => {
    const actions = [...snapshot.founder_actions];
    const waiting = (snapshot.review_queue ?? []).filter(
      (r) => r.status === "waiting_founder",
    );
    for (const r of waiting.slice(0, 3)) {
      if (!actions.some((a) => a.id === `rq-${r.review_id}`)) {
        actions.push({
          id: `rq-${r.review_id}`,
          priority: "P0",
          title: r.title,
          detail: `Waiting founder · ${r.template}`,
          source: r.source,
          category: "waiting_approvals",
        });
      }
    }
    for (const e of snapshot.exceptions) {
      if (e.severity === "fail" || e.severity === "blocked") {
        const id = `ex-${e.id}`;
        if (!actions.some((a) => a.id === id)) {
          actions.push({
            id,
            priority: e.severity === "fail" ? "P0-SECURITY" : "P1-BLOCKED",
            title: e.title,
            detail: e.detail,
            source: e.source,
            category: e.severity === "fail" ? "security" : "blocked",
          });
        }
      }
    }
    const rank = (p: string) => {
      const u = p.toUpperCase();
      if (u.includes("P0") || u.includes("SECURITY")) return 0;
      if (u.includes("P1") || u.includes("BLOCK")) return 1;
      if (u.includes("P2") || u.includes("RELEASE")) return 2;
      return 3;
    };
    return actions
      .filter((a) => {
        if (!q) return true;
        return (
          a.title.toLowerCase().includes(q) ||
          a.detail.toLowerCase().includes(q) ||
          a.priority.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => rank(a.priority) - rank(b.priority));
  }, [snapshot.founder_actions, snapshot.review_queue, snapshot.exceptions, q]);

  const timelineItems: TimelineEntry[] = useMemo(() => {
    const fromActivity: TimelineEntry[] = snapshot.activity.slice(0, 12).map((e) => ({
      id: e.id,
      title: e.summary || e.event_type,
      timestamp: formatActivity(e.timestamp),
      body: `${e.department} · ${e.status}`,
      icon: deptIcon(e.department),
      severity:
        e.status === "failed" || e.status === "blocked"
          ? "error"
          : e.status === "waiting_founder"
            ? "warn"
            : e.status === "completed" || e.status === "healthy"
              ? "ok"
              : "info",
    }));

    const fromCycles: TimelineEntry[] = snapshot.cycles.slice(0, 6).map((c) => ({
      id: `cycle-${c.id}`,
      title: c.title,
      timestamp: formatActivity(c.updated_at) || c.status,
      body: `${c.department} · ${c.status}`,
      icon: deptIcon(c.department),
      severity:
        c.status === "failed" || c.status === "blocked"
          ? "error"
          : c.status === "waiting_founder"
            ? "warn"
            : c.status === "completed"
              ? "ok"
              : "info",
    }));

    const merged = [...fromActivity, ...fromCycles];
    return merged
      .filter((item) => {
        if (!q) return true;
        return (
          item.title.toLowerCase().includes(q) ||
          String(item.body ?? "")
            .toLowerCase()
            .includes(q)
        );
      })
      .slice(0, 10);
  }, [snapshot.activity, snapshot.cycles, q]);

  const learningPct = Math.min(
    100,
    Math.round(Number(snapshot.production_cycle?.recent_learning ?? 0) * 10) ||
      (snapshot.system_pulse_active ? 64 : 28),
  );

  const storageAvailable = snapshot.sources.filter((s) => s.available).length;
  const storageTotal = Math.max(1, snapshot.sources.length);
  const storagePct = Math.round((storageAvailable / storageTotal) * 100);

  const openDept = (d: DepartmentRow) => {
    if (d.open_route) onOpenDepartment(d.id, d.open_route);
    else onOpenDepartment(d.id, null);
  };

  return (
    <div className="ds-command">
      <PageHeader
        title="Founder Dashboard"
        subtitle="Real-time overview of AIOS"
        actions={
          <>
            <SearchBar
              value={query}
              placeholder="Search departments, actions…"
              aria-label="Global Search"
              onChange={setQuery}
            />
            <NotificationButton
              hasNotification={snapshot.exceptions.length > 0}
              onClick={() => onOpenDepartment("activity", "activity")}
            />
            <ProfileMenu
              initials="F"
              label="Founder"
              onClick={() => onOpenDepartment("settings", "settings")}
            />
          </>
        }
      />

      {snapshot.production_cycle?.founder_waiting ? (
        <AlertBanner tone="warn" title="WAITING FOR FOUNDER">
          Execution paused · no automatic decision · no automatic publication ·{" "}
          {snapshot.top_bar.live_label} · {snapshot.top_bar.mode} ·{" "}
          {snapshot.top_bar.provider}
        </AlertBanner>
      ) : snapshot.company_brain?.pending_approval ? (
        <InfoBanner title="Company Brain — mission / plan pending approval">
          Planning only ·{" "}
          {snapshot.company_brain.current_mission_status ??
            snapshot.company_brain.planning_state}{" "}
          · {snapshot.company_brain.current_mission_id ??
            snapshot.company_brain.latest_plan_id ??
            "no mission"}{" "}
          · never executes · founder approval required
        </InfoBanner>
      ) : (
        <InfoBanner title={snapshot.top_bar.live_label}>
          Mode {snapshot.top_bar.mode} · Provider {snapshot.top_bar.provider} ·
          read-only control plane
        </InfoBanner>
      )}

      {/* ROW 1 */}
      <div className="ds-command-row">
        <RuntimeStatusCard
          liveLabel={snapshot.top_bar.live_label}
          provider={snapshot.top_bar.provider}
          cost={`$${snapshot.top_bar.cost_today_usd}`}
          heartbeat={snapshot.top_bar.heartbeat_age}
          queue={waitingReviews}
        />
        <MetricGrid>
          <KPIStatCard
            value={healthyDepartments}
            label="Departments Healthy"
            delta={`${snapshot.departments.length} total`}
            deltaDirection="flat"
            tone="approved"
            icon="▣"
          />
          <KPIStatCard
            value={waitingReviews}
            label="Waiting Founder Reviews"
            delta={waitingReviews > 0 ? "Action needed" : "Clear"}
            deltaDirection={waitingReviews > 0 ? "up" : "flat"}
            tone="waiting"
            icon="◎"
          />
          <KPIStatCard
            value={snapshot.top_bar.provider}
            label="Provider Status"
            delta={providerLabel}
            deltaDirection="flat"
            tone="processing"
            icon="◇"
          />
          <KPIStatCard
            value={`$${snapshot.top_bar.cost_today_usd}`}
            label="Today's AI Cost"
            delta="dry_run · no spend"
            deltaDirection="flat"
            tone="neutral"
            icon="$"
          />
        </MetricGrid>
      </div>

      {snapshot.company_brain?.current_mission_id ? (
        <PageSection
          title="Mission Contract"
          subtitle="Canonical business object · planning only · read-only"
          actions={
            <>
              {onOpenMissionApproval ? (
                <SecondaryButton size="sm" onClick={onOpenMissionApproval}>
                  Review Mission
                </SecondaryButton>
              ) : null}
              {onOpenQueueAdmission ? (
                <SecondaryButton size="sm" onClick={onOpenQueueAdmission}>
                  Review Readiness
                </SecondaryButton>
              ) : null}
              {onOpenExecutionPackage ? (
                <SecondaryButton size="sm" onClick={onOpenExecutionPackage}>
                  Execution Package
                </SecondaryButton>
              ) : null}
              {onOpenQueueSubmission ? (
                <SecondaryButton size="sm" onClick={onOpenQueueSubmission}>
                  Queue Submission
                </SecondaryButton>
              ) : null}
              {onOpenShadowQueue ? (
                <SecondaryButton size="sm" onClick={onOpenShadowQueue}>
                  Shadow Queue
                </SecondaryButton>
              ) : null}
              {onOpenRuntimePlan ? (
                <SecondaryButton size="sm" onClick={onOpenRuntimePlan}>
                  Runtime Plan
                </SecondaryButton>
              ) : null}
              {onOpenRuntimeRelease ? (
                <SecondaryButton size="sm" onClick={onOpenRuntimeRelease}>
                  Runtime Release
                </SecondaryButton>
              ) : null}
              {onOpenSystemReadiness ? (
                <SecondaryButton size="sm" onClick={onOpenSystemReadiness}>
                  System Readiness
                </SecondaryButton>
              ) : null}
              {onOpenExecutionController ? (
                <SecondaryButton size="sm" onClick={onOpenExecutionController}>
                  Execution Controller
                </SecondaryButton>
              ) : null}
              {onOpenDepartmentRegistry ? (
                <SecondaryButton size="sm" onClick={onOpenDepartmentRegistry}>
                  Department Registry
                </SecondaryButton>
              ) : null}
              {onOpenCostLedger ? (
                <SecondaryButton size="sm" onClick={onOpenCostLedger}>
                  Cost Ledger
                </SecondaryButton>
              ) : null}
              {onOpenWorkerRuntime ? (
                <SecondaryButton size="sm" onClick={onOpenWorkerRuntime}>
                  Worker Runtime
                </SecondaryButton>
              ) : null}
              {onOpenTelemetryRegistry ? (
                <SecondaryButton size="sm" onClick={onOpenTelemetryRegistry}>
                  Telemetry Registry
                </SecondaryButton>
              ) : null}
              {onOpenActivationGate ? (
                <SecondaryButton size="sm" onClick={onOpenActivationGate}>
                  Activation Gate
                </SecondaryButton>
              ) : null}
              {onOpenExecutionAuthorization ? (
                <SecondaryButton
                  size="sm"
                  onClick={onOpenExecutionAuthorization}
                >
                  Execution Authorization
                </SecondaryButton>
              ) : null}
              {onOpenPreDispatchSimulation ? (
                <SecondaryButton
                  size="sm"
                  onClick={onOpenPreDispatchSimulation}
                >
                  Pre-Dispatch Simulation
                </SecondaryButton>
              ) : null}
            </>
          }
        >
          <MetricGrid columns={4}>
            <KPIStatCard
              value={snapshot.company_brain.current_mission_name ?? "—"}
              label="Current Mission"
              delta={snapshot.company_brain.current_mission_id}
              deltaDirection="flat"
              tone="neutral"
            />
            <KPIStatCard
              value={snapshot.company_brain.current_mission_status ?? "—"}
              label="Mission Status"
              delta={
                snapshot.company_brain.founder_approval_required
                  ? `Founder: ${
                      snapshot.company_brain.founder_approval_status ??
                      "REQUIRED"
                    }`
                  : "Founder approval required"
              }
              deltaDirection="flat"
              tone={
                snapshot.company_brain.current_mission_status ===
                "WAITING_FOUNDER"
                  ? "waiting"
                  : snapshot.company_brain.current_mission_status === "APPROVED"
                    ? "approved"
                    : "processing"
              }
            />
            <KPIStatCard
              value={
                snapshot.company_brain.current_mission_priority ??
                snapshot.company_brain.priority ??
                "—"
              }
              label="Mission Priority"
              delta={`Risk: ${
                snapshot.company_brain.current_mission_risk ??
                snapshot.company_brain.risk_level ??
                "—"
              }`}
              deltaDirection="flat"
              tone="neutral"
            />
            <KPIStatCard
              value={`${
                snapshot.company_brain.current_mission_progress_pct ?? 0
              }%`}
              label="Mission Progress"
              delta={
                snapshot.company_brain.current_mission_departments.length
                  ? snapshot.company_brain.current_mission_departments.join(
                      " → ",
                    )
                  : "No departments"
              }
              deltaDirection="flat"
              tone="processing"
            />
          </MetricGrid>
          <div style={{ marginTop: "0.75rem" }}>
            <SectionCard title="Mission detail">
              <p className="mono muted ds-meta-mono">
                Departments:{" "}
                {snapshot.company_brain.current_mission_departments.join(
                  " → ",
                ) || "—"}{" "}
                · Blockers: {snapshot.company_brain.blocker_count} · Pending
                approval:{" "}
                {snapshot.company_brain.pending_mission_approval ? "YES" : "NO"}
              </p>
              <p className="mono muted ds-meta-mono">
                Latest decision:{" "}
                {snapshot.company_brain.latest_mission_decision?.decision ??
                  "—"}{" "}
                · Health:{" "}
                {snapshot.company_brain.mission_approval_health?.status ??
                  "idle"}{" "}
                · Mode: approval_only
              </p>
            <p className="muted ds-meta-mono">
              Execution / queue / publish remain disabled · LIVE OFF
            </p>
            {snapshot.company_brain.queue_admission ? (
              <p className="mono muted ds-meta-mono">
                Queue readiness:{" "}
                {snapshot.company_brain.queue_admission.overall_score ?? "—"}/
                100 ·{" "}
                {snapshot.company_brain.queue_admission.queue_status ??
                  "NOT_STARTED"}{" "}
                · {snapshot.company_brain.queue_admission.verdict ?? "—"}
              </p>
            ) : null}
          </SectionCard>
          </div>
        </PageSection>
      ) : null}

      <div className="ds-command-split">
        <div className="ds-command-main">
          {/* ROW 2 */}
          <PageSection
            title="Departments"
            subtitle="Status · queue · heartbeat · last activity"
          >
            {departmentCards.length === 0 ? (
              <EmptyIllustration
                title="No departments match"
                copy="Clear search to see the full department grid."
              />
            ) : (
              <MetricGrid>
                {departmentCards.map((d) => (
                  <DepartmentHealthCard
                    key={d.id}
                    department={d.label}
                    status={d.status}
                    statusTone={statusTone(d.health || d.status)}
                    queue={d.queue_depth === null ? "—" : d.queue_depth}
                    provider={d.providerHint ?? snapshot.top_bar.provider}
                    heartbeat={snapshot.top_bar.heartbeat_age}
                    lastActivity={formatActivity(d.last_activity)}
                    disabled={!d.open_route}
                    onClick={() => openDept(d)}
                  />
                ))}
              </MetricGrid>
            )}
          </PageSection>

          {/* ROW 3 */}
          <PageSection
            title="Founder Actions"
            subtitle="Priority sorted · waiting · releases · blocked · security"
            actions={
              onOpenReview ? (
                <SecondaryButton size="sm" onClick={onOpenReview}>
                  Open Templates Ready for Review
                </SecondaryButton>
              ) : null
            }
          >
            {founderActions.length === 0 ? (
              <EmptyIllustration
                title="No founder actions"
                copy="Waiting approvals and control-center items appear here."
              />
            ) : (
              <MetricGrid columns={2}>
                {founderActions.slice(0, 8).map((a) => (
                  <FounderActionCard
                    key={a.id}
                    priority={a.priority}
                    priorityTone={priorityTone(a.priority)}
                    title={a.title}
                    description={a.detail}
                    ctaLabel={
                      a.category === "waiting_approvals" || a.id.startsWith("rq-")
                        ? "Review"
                        : "Inspect"
                    }
                    onCta={() => {
                      if (
                        a.category === "waiting_approvals" ||
                        a.id.startsWith("rq-")
                      ) {
                        onOpenReview?.();
                        return;
                      }
                      if (a.source.toLowerCase().includes("knowledge")) {
                        onSelectKnowledge();
                        return;
                      }
                      const cycle = snapshot.cycles.find((c) =>
                        a.detail.includes(c.id) || a.title.includes(c.title),
                      );
                      if (cycle) onSelectCycle(cycle.id);
                      else onOpenReview?.();
                    }}
                  />
                ))}
              </MetricGrid>
            )}
          </PageSection>

          {/* ROW 4 */}
          <PageSection title="Timeline" subtitle="Latest activity across departments">
            <TimelineCard
              title="Recent activity"
              items={timelineItems}
              emptyLabel="No recent activity artifacts."
            />
          </PageSection>

          {/* BOTTOM */}
          <PageSection title="Quick Actions" subtitle="Jump to key AIOS surfaces">
            <div className="ds-command-actions">
              <PrimaryButton onClick={() => onOpenReview?.()}>
                Open Templates Ready for Review
              </PrimaryButton>
              <SecondaryButton
                onClick={() => onOpenDepartment("resume", "resume")}
              >
                Resume Department
              </SecondaryButton>
              <SecondaryButton
                onClick={() => {
                  onSelectKnowledge();
                  onOpenDepartment("knowledge", "knowledge");
                }}
              >
                Knowledge
              </SecondaryButton>
              <SecondaryButton
                onClick={() =>
                  onOpenDepartment("provider-validation", "provider-validation")
                }
              >
                Provider Validation
              </SecondaryButton>
              <SecondaryButton
                onClick={() => onOpenDepartment("activity", "activity")}
              >
                Activity
              </SecondaryButton>
            </div>
          </PageSection>
        </div>

        {/* RIGHT COLUMN */}
        <aside className="ds-command-aside" aria-label="System health">
          <PageSection title="System Health" subtitle="Runtime · learning · storage">
            <SectionCard title="Provider">
              <p className="mono ds-meta">{snapshot.top_bar.provider}</p>
              <p className="ds-meta">
                {snapshot.provider_validation?.readiness_state ?? "mock baseline"}
              </p>
              <ProgressIndicator
                value={snapshot.provider_validation?.eligible ? 100 : 45}
                label="Validation readiness"
                tone="processing"
              />
            </SectionCard>
            <SectionCard title="Runtime">
              <p className="mono ds-meta">
                {snapshot.top_bar.live_label} · {snapshot.top_bar.mode}
              </p>
              <p className="ds-meta">
                Heartbeat {snapshot.top_bar.heartbeat_age}
              </p>
              <ProgressIndicator
                value={snapshot.system_pulse_active ? 78 : 32}
                label="Pulse"
                tone={snapshot.system_pulse_active ? "approved" : "waiting"}
              />
            </SectionCard>
            <SectionCard title="Learning">
              <p className="ds-meta">
                Recent learning{" "}
                {snapshot.production_cycle?.recent_learning ?? "—"}
              </p>
              <ProgressIndicator
                value={learningPct}
                label="Write-back readiness"
                tone="approved"
              />
            </SectionCard>
            <SectionCard title="Storage">
              <p className="ds-meta">
                {storageAvailable}/{storageTotal} sources available
              </p>
              <ProgressIndicator
                value={storagePct}
                label="Artifact availability"
                tone={storagePct === 100 ? "approved" : "waiting"}
              />
            </SectionCard>
          </PageSection>

          <PageSection title="Recent releases" subtitle="Cycles & critic gate">
            {snapshot.cycles.length === 0 && !snapshot.critic ? (
              <EmptyIllustration
                title="No releases yet"
                copy="Completed cycles and critic summaries show here."
              />
            ) : (
              <TimelineCard
                title="Release stream"
                items={[
                  ...(snapshot.critic
                    ? [
                        {
                          id: "critic",
                          title: `Critic Overall ${snapshot.critic.overall}`,
                          timestamp: snapshot.critic.ready
                            ? "Founder review permitted"
                            : "Founder review blocked",
                          body: `ATS ${snapshot.critic.ats} · publication_allowed=false`,
                          icon: "◈",
                          severity: snapshot.critic.ready
                            ? ("ok" as const)
                            : ("warn" as const),
                        },
                      ]
                    : []),
                  ...snapshot.cycles.slice(0, 5).map((c) => ({
                    id: c.id,
                    title: c.title,
                    timestamp: c.status,
                    body: c.id,
                    icon: deptIcon(c.department),
                    severity:
                      c.status === "completed"
                        ? ("ok" as const)
                        : c.status === "failed"
                          ? ("error" as const)
                          : ("info" as const),
                  })),
                ]}
              />
            )}
            {snapshot.cycles[0] ? (
              <SecondaryButton
                size="sm"
                onClick={() => onSelectCycle(snapshot.cycles[0]!.id)}
              >
                Inspect latest cycle
              </SecondaryButton>
            ) : null}
          </PageSection>
        </aside>
      </div>
    </div>
  );
}
