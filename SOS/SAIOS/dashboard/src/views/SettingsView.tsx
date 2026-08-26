import { useMemo, useState } from "react";
import type { DashboardRoute, DashboardSnapshot } from "../data/types";
import {
  Badge,
  EmptyIllustration,
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
  ToolbarActions,
  type BadgeTone,
} from "../design-system";
import { NA, display, formatWhen, healthTone } from "../lib/display";

function flagTone(on: boolean | null): BadgeTone {
  if (on == null) return "neutral";
  return on ? "approved" : "blocked";
}

function flagLabel(on: boolean | null): string {
  if (on == null) return NA;
  return on ? "enabled" : "disabled";
}

type DeptCard = {
  id: string;
  label: string;
  enabled: string;
  health: string;
  mode: string;
  queue: string;
  lastActivity: string;
};

type Props = {
  snapshot: DashboardSnapshot;
  onNavigate?: (route: DashboardRoute) => void;
  onOpenReview?: () => void;
  onRefresh?: () => void;
};

export function SettingsView({
  snapshot,
  onNavigate,
  onOpenReview,
  onRefresh,
}: Props) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const top = snapshot.top_bar;
  const security = snapshot.security;
  const resume = snapshot.resume;
  const critic = snapshot.critic;
  const pv = snapshot.provider_validation;
  const ks = snapshot.knowledge_snapshot;
  const departments = snapshot.departments ?? [];

  const matches = (text: string) => !q || text.toLowerCase().includes(q);

  const skillsRegistered = useMemo(() => {
    const skillsDept = departments.find((d) => d.id === "skills");
    if (!skillsDept) return null;
    const fromNotes = skillsDept.notes?.match(/(\d+)\s+registered/i);
    if (fromNotes) return Number(fromNotes[1]);
    const fromMode = skillsDept.mode?.match(/(\d+)\s+skills/i);
    if (fromMode) return Number(fromMode[1]);
    return null;
  }, [departments]);

  const departmentsEnabled = useMemo(() => {
    if (departments.length === 0) return null;
    return departments.filter(
      (d) =>
        d.health !== "disabled" &&
        d.status !== "disabled" &&
        d.mode !== "disabled",
    ).length;
  }, [departments]);

  const runtimeHealth = useMemo(() => {
    if (departments.length === 0) return null;
    if (departments.some((d) => d.health === "blocked" || d.health === "fail")) {
      return "blocked";
    }
    if (departments.some((d) => d.health === "degraded")) return "degraded";
    if (departments.every((d) => d.health === "healthy" || d.health === "disabled")) {
      return "healthy";
    }
    return departments[0]?.health ?? null;
  }, [departments]);

  const deptCards: DeptCard[] = useMemo(() => {
    const wanted: Array<{ id: string; label: string; match: string[] }> = [
      { id: "resume", label: "Resume", match: ["resume"] },
      { id: "knowledge", label: "Knowledge", match: ["knowledge"] },
      { id: "brain", label: "Brain", match: ["brain"] },
      { id: "skills", label: "Skills", match: ["skills"] },
      {
        id: "provider-validation",
        label: "Provider Validation",
        match: ["provider", "validation", "mock"],
      },
      { id: "website", label: "Website", match: ["website"] },
    ];

    return wanted.map((w) => {
      if (w.id === "provider-validation") {
        if (!pv) {
          const mock = departments.find((d) => d.id === "mock");
          if (mock) {
            return {
              id: w.id,
              label: w.label,
              enabled: mock.health !== "disabled" ? "YES" : "NO",
              health: display(mock.health),
              mode: display(mock.mode),
              queue: display(mock.queue_depth),
              lastActivity: formatWhen(mock.last_activity),
            };
          }
          return {
            id: w.id,
            label: w.label,
            enabled: NA,
            health: NA,
            mode: NA,
            queue: NA,
            lastActivity: NA,
          };
        }
        return {
          id: w.id,
          label: w.label,
          enabled: pv.eligible ? "YES" : "NO",
          health: display(pv.readiness_state),
          mode: display(pv.selection_status),
          queue: String(
            pv.blocking_reasons.length + pv.missing_configuration.length,
          ),
          lastActivity: display(pv.source),
        };
      }

      const row = departments.find((d) =>
        w.match.some((m) => d.id.toLowerCase().includes(m)),
      );

      if (!row) {
        if (w.id === "resume" && resume) {
          return {
            id: w.id,
            label: w.label,
            enabled: resume.enabled ? "YES" : "NO",
            health: resume.enabled ? "healthy" : "disabled",
            mode: display(resume.mode),
            queue: display(resume.queue_depth),
            lastActivity: formatWhen(resume.latest_run?.updated_at),
          };
        }
        return {
          id: w.id,
          label: w.label,
          enabled: NA,
          health: NA,
          mode: NA,
          queue: NA,
          lastActivity: NA,
        };
      }

      return {
        id: w.id,
        label: w.label,
        enabled:
          row.health !== "disabled" && row.status !== "disabled" ? "YES" : "NO",
        health: display(row.health),
        mode: display(row.mode),
        queue: display(row.queue_depth),
        lastActivity: formatWhen(row.last_activity),
      };
    });
  }, [departments, pv, resume]);

  const filteredDeptCards = useMemo(
    () =>
      deptCards.filter((c) =>
        matches(`${c.label} ${c.health} ${c.mode} ${c.enabled}`),
      ),
    [deptCards, q],
  );

  const featureFlags = useMemo(() => {
    const openaiConfigured = pv?.credentials_configured ?? null;
    const openaiActive =
      pv == null
        ? null
        : pv.real_provider_request_executed === true
          ? true
          : false;
    const website = departments.find((d) => d.id === "website");
    const websiteOn =
      website == null
        ? null
        : website.health !== "disabled" && website.status !== "disabled";

    return [
      {
        id: "mock",
        label: "Mock Provider",
        on:
          top.provider === "Mock" || resume?.provider === "Mock" ? true : null,
      },
      {
        id: "openai",
        label: "OpenAI",
        on: openaiActive === false ? false : openaiConfigured,
      },
      { id: "website", label: "Website", on: websiteOn },
      {
        id: "publication",
        label: "Publication",
        on:
          critic?.publication_allowed ??
          (pv ? pv.publication_allowed : null),
      },
      {
        id: "learning",
        label: "Learning",
        on: ks?.available ?? null,
      },
      {
        id: "critic",
        label: "Critic",
        on: critic == null ? null : true,
      },
      {
        id: "founder-gate",
        label: "Founder Gate",
        on: critic?.founder_review_allowed ?? null,
      },
    ].filter((f) => matches(f.label));
  }, [top.provider, resume, pv, departments, critic, ks, q]);

  const providerStatusLabel = useMemo(() => {
    if (!pv) return NA;
    return display(pv.readiness_state);
  }, [pv]);

  const securityStatusLabel = useMemo(() => {
    if (!security) return NA;
    if (security.read_only && security.live_controls_disabled) {
      return "locked read-only";
    }
    return "configured";
  }, [security]);

  const systemPaths = useMemo(() => {
    const paths: string[] = [];
    if (pv?.source) paths.push(pv.source);
    if (critic?.source) paths.push(critic.source);
    if (critic?.critic_report_reference) {
      paths.push(critic.critic_report_reference);
    }
    return paths;
  }, [pv, critic]);

  const showSection = (title: string, body: string) =>
    matches(`${title} ${body}`);

  return (
    <div className="ds-command">
      <PageHeader
        title="Settings & System"
        subtitle="Inspect AIOS configuration, runtime health and operational readiness."
        actions={
          <ToolbarActions>
            <SearchBar
              value={query}
              placeholder="Search settings…"
              aria-label="Search"
              onChange={setQuery}
            />
            <SecondaryButton size="sm" onClick={() => onRefresh?.()}>
              Refresh
            </SecondaryButton>
            <Badge tone="blocked">{top.live_label}</Badge>
            <Badge tone="neutral">{top.mode}</Badge>
          </ToolbarActions>
        }
      />

      <InfoBanner title="Read-only configuration">
        No environment mutations · no configuration writes · secrets redacted
      </InfoBanner>

      <div className="ds-command-split">
        <div className="ds-command-main">
          {/* ROW 1 */}
          {showSection("System Status", `${top.live_label} ${top.mode}`) ? (
            <PageSection title="System Status" subtitle="Runtime pulse">
              <RuntimeStatusCard
                liveLabel={top.live_label}
                provider={top.provider}
                cost={`$${top.cost_today_usd}`}
                heartbeat={top.heartbeat_age}
                queue={departmentsEnabled ?? 0}
              />
              <MetricGrid>
                <KPIStatCard
                  value={display(top.live_label)}
                  label="LIVE Status"
                  tone="blocked"
                  icon="●"
                />
                <KPIStatCard
                  value={display(top.mode)}
                  label="Mode"
                  tone="neutral"
                  icon="◌"
                />
                <KPIStatCard
                  value={display(top.provider)}
                  label="Current Provider"
                  tone="processing"
                  icon="◇"
                />
                <KPIStatCard
                  value={display(runtimeHealth)}
                  label="Runtime Health"
                  tone={healthTone(runtimeHealth ?? "")}
                  icon="▣"
                />
                <KPIStatCard
                  value={display(top.heartbeat_age)}
                  label="Heartbeat"
                  tone="neutral"
                  icon="♥"
                />
                <KPIStatCard
                  value={display(top.latest_agent)}
                  label="Version"
                  delta={`next ${display(top.next_agent)}`}
                  tone="neutral"
                  icon="v"
                />
              </MetricGrid>
            </PageSection>
          ) : null}

          {/* ROW 2 */}
          {showSection("KPI", "departments skills knowledge") ? (
            <PageSection title="KPI Grid" subtitle="Operational inventory">
              <MetricGrid>
                <KPIStatCard
                  value={
                    departmentsEnabled == null ? NA : departmentsEnabled
                  }
                  label="Departments Enabled"
                />
                <KPIStatCard
                  value={
                    skillsRegistered == null ? NA : skillsRegistered
                  }
                  label="Skills Registered"
                />
                <KPIStatCard
                  value={
                    ks?.domains?.length
                      ? ks.domains.length
                      : ks
                        ? 0
                        : NA
                  }
                  label="Knowledge Domains"
                />
                <KPIStatCard
                  value={NA}
                  label="Pending Founder Reviews"
                  delta="review_queue not in settings data contract"
                />
                <KPIStatCard
                  value={providerStatusLabel}
                  label="Provider Status"
                  tone="processing"
                />
                <KPIStatCard
                  value={securityStatusLabel}
                  label="Security Status"
                  tone="approved"
                />
              </MetricGrid>
            </PageSection>
          ) : null}

          {/* ROW 3 */}
          <PageSection
            title="Department Configuration"
            subtitle="Enabled · health · mode · queue · activity"
          >
            {filteredDeptCards.length === 0 ? (
              <EmptyIllustration
                title={NA}
                copy="No department rows matched the current search."
              />
            ) : (
              <MetricGrid columns={3}>
                {filteredDeptCards.map((d) => (
                  <SectionCard key={d.id} title={d.label}>
                    <div className="ds-stack-xs">
                      <div className="ds-row-wrap">
                        <Badge
                          tone={
                            d.enabled === "YES"
                              ? "approved"
                              : d.enabled === "NO"
                                ? "blocked"
                                : "neutral"
                          }
                        >
                          enabled {d.enabled}
                        </Badge>
                        <Badge tone={healthTone(d.health)}>{d.health}</Badge>
                      </div>
                      <p className="mono ds-meta">Mode: {d.mode}</p>
                      <p className="mono muted ds-meta-mono">
                        Queue: {d.queue}
                      </p>
                      <p className="muted ds-meta-mono">
                        Last Activity: {d.lastActivity}
                      </p>
                    </div>
                  </SectionCard>
                ))}
              </MetricGrid>
            )}
          </PageSection>

          {/* Company Brain — read-only (Agent #161) */}
          <PageSection
            title="Company Brain"
            subtitle="Planning only · never executes · founder approval required"
          >
            {(() => {
              const cb = snapshot.company_brain;
              if (!cb) {
                return (
                  <EmptyIllustration
                    title={NA}
                    copy="company_brain is absent from the current snapshot."
                  />
                );
              }
              return (
                <SectionCard title="Planning Engine V1">
                  <MetricGrid columns={3}>
                    <KPIStatCard
                      value={display(cb.planning_state)}
                      label="Planning State"
                      tone={
                        cb.planning_state === "blocked"
                          ? "blocked"
                          : cb.pending_approval
                            ? "waiting"
                            : "approved"
                      }
                    />
                    <KPIStatCard
                      value={cb.pending_approval ? "YES" : "NO"}
                      label="Pending Approval"
                      tone={cb.pending_approval ? "waiting" : "neutral"}
                    />
                    <KPIStatCard
                      value={cb.can_execute ? "YES" : "NO"}
                      label="Can Execute"
                      tone="blocked"
                    />
                  </MetricGrid>
                  <div className="ds-stack-xs" style={{ marginTop: "0.75rem" }}>
                    <p className="mono ds-meta">
                      Mode: {cb.mode} · Autonomous: {String(cb.autonomous)}
                    </p>
                    <p className="mono ds-meta">
                      Mission: {display(cb.current_mission_name)} · Status:{" "}
                      {display(cb.current_mission_status)} · Progress:{" "}
                      {cb.current_mission_progress_pct != null
                        ? `${cb.current_mission_progress_pct}%`
                        : NA}
                    </p>
                    <p className="mono muted ds-meta-mono">
                      Mission ID: {display(cb.current_mission_id)} · Founder:{" "}
                      {display(cb.founder_approval_status)} · Risk:{" "}
                      {display(cb.current_mission_risk)}
                    </p>
                    <p className="mono ds-meta">
                      Objective: {display(cb.current_objective)}
                    </p>
                    <p className="mono muted ds-meta-mono">
                      Plan: {display(cb.latest_plan_id)} · Status:{" "}
                      {display(cb.execution_status)} · Priority:{" "}
                      {display(cb.current_mission_priority ?? cb.priority)} ·
                      Risk: {display(cb.risk_level)}
                    </p>
                    <p className="mono muted ds-meta-mono">
                      Departments:{" "}
                      {(cb.current_mission_departments.length
                        ? cb.current_mission_departments
                        : cb.departments
                      ).length
                        ? (cb.current_mission_departments.length
                            ? cb.current_mission_departments
                            : cb.departments
                          ).join(" → ")
                        : NA}{" "}
                      · Blockers: {cb.blocker_count}
                    </p>
                    <p className="muted ds-meta-mono">
                      Canonical engine: {cb.canonical_engine} · Enqueue:{" "}
                      {cb.can_enqueue ? "allowed" : "forbidden"}
                    </p>
                    <div className="ds-row-wrap">
                      <Badge tone="approved">founder approval required</Badge>
                      <Badge tone="blocked">no autonomous execution</Badge>
                      <Badge tone="neutral">mission-contract-v1</Badge>
                      <Badge tone="neutral">planning_only</Badge>
                    </div>
                  </div>
                </SectionCard>
              );
            })()}
          </PageSection>

          {/* ROW 4 */}
          {showSection("Provider Configuration", providerStatusLabel) ? (
            <PageSection title="Provider Configuration">
              {!pv ? (
                <EmptyIllustration
                  title={NA}
                  copy="provider_validation is absent from the current snapshot."
                />
              ) : (
                <SectionCard title="Provider gate">
                  <MetricGrid columns={3}>
                    <KPIStatCard
                      value={display(top.provider)}
                      label="Current Provider"
                    />
                    <KPIStatCard
                      value={
                        pv.missing_configuration.some((m) =>
                          m.toLowerCase().includes("registry"),
                        )
                          ? "missing"
                          : "present"
                      }
                      label="Provider Registry"
                      tone={
                        pv.missing_configuration.some((m) =>
                          m.toLowerCase().includes("registry"),
                        )
                          ? "blocked"
                          : "approved"
                      }
                    />
                    <KPIStatCard
                      value={
                        pv.credentials_configured ? "configured" : "missing"
                      }
                      label="Credential Status"
                      tone={
                        pv.credentials_configured ? "approved" : "blocked"
                      }
                    />
                    <KPIStatCard
                      value={pv.budgets_ok ? "ok" : "blocked"}
                      label="Budget Status"
                      tone={pv.budgets_ok ? "approved" : "blocked"}
                    />
                    <KPIStatCard
                      value={display(pv.authorization_status)}
                      label="Authorization Status"
                      tone="waiting"
                    />
                    <KPIStatCard
                      value={display(pv.readiness_state)}
                      label="Validation Status"
                      tone="processing"
                    />
                  </MetricGrid>
                </SectionCard>
              )}
            </PageSection>
          ) : null}

          {/* ROW 5 */}
          {showSection("Security", "read-only live publication") ? (
            <PageSection title="Security & Runtime">
              {!security ? (
                <EmptyIllustration
                  title={NA}
                  copy="security block missing from snapshot."
                />
              ) : (
                <SectionCard title="Hard gates">
                  <MetricGrid columns={3}>
                    <KPIStatCard
                      value={String(security.read_only)}
                      label="Read-only Mode"
                      tone="approved"
                    />
                    <KPIStatCard
                      value={display(top.live_label)}
                      label="LIVE OFF"
                      tone="blocked"
                    />
                    <KPIStatCard
                      value={String(
                        critic?.publication_allowed ??
                          pv?.publication_allowed ??
                          false,
                      )}
                      label="Publication Disabled"
                      tone="blocked"
                      delta="publication_allowed must remain false"
                    />
                    <KPIStatCard
                      value={String(security.secrets_redacted)}
                      label="Secrets Redacted"
                      tone="approved"
                    />
                    <KPIStatCard
                      value={String(security.auth_required_before_vps)}
                      label="Auth Required"
                      tone="waiting"
                    />
                    <KPIStatCard
                      value={NA}
                      label="Storage Health"
                      delta="Not present in security snapshot"
                    />
                  </MetricGrid>
                </SectionCard>
              )}
            </PageSection>
          ) : null}

          {/* ROW 6 */}
          {showSection("Feature Flags", "mock openai website") ? (
            <PageSection
              title="Feature Flags"
              subtitle="Read-only status badges"
            >
              {featureFlags.length === 0 ? (
                <EmptyIllustration title={NA} copy="No flags matched search." />
              ) : (
                <SectionCard>
                  <div className="ds-flag-grid">
                    {featureFlags.map((f) => (
                      <div key={f.id} className="ds-flag-item">
                        <span className="ds-flag-label">{f.label}</span>
                        <Badge tone={flagTone(f.on)}>{flagLabel(f.on)}</Badge>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}
            </PageSection>
          ) : null}

          {/* ROW 7 */}
          {showSection("Environment", "agent refresh paths") ? (
            <PageSection
              title="Environment Summary"
              subtitle="No secrets displayed"
            >
              <SectionCard title="Project / agents">
                <div className="ds-stack-md">
                <MetricGrid columns={3}>
                  <KPIStatCard
                    value={NA}
                    label="Project Version"
                    delta="Not in settings data contract"
                  />
                  <KPIStatCard
                    value={display(top.latest_agent)}
                    label="Latest Agent"
                  />
                  <KPIStatCard
                    value={display(top.next_agent)}
                    label="Next Agent"
                  />
                  <KPIStatCard
                    value={formatWhen(snapshot.last_refreshed)}
                    label="Last Refresh"
                  />
                </MetricGrid>
                <div className="ds-stack-xs">
                  <p className="ds-meta">System Paths</p>
                  {systemPaths.length === 0 ? (
                    <p className="muted mono ds-meta">{NA}</p>
                  ) : (
                    <ul className="ds-path-list">
                      {systemPaths.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <p className="muted ds-meta-mono">
                  live_controls_disabled=
                  {display(security?.live_controls_disabled)} · telegram_unchanged=
                  {display(security?.telegram_unchanged)}
                </p>
                </div>
              </SectionCard>
            </PageSection>
          ) : null}
        </div>

        {/* RIGHT SIDEBAR */}
        <aside className="ds-command-aside" aria-label="Settings quick actions">
          <PageSection title="Quick Actions" subtitle="Navigate · no writes">
            <div className="ds-command-actions ds-command-actions-col">
              <PrimaryButton onClick={() => onNavigate?.("resume")}>
                Resume
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
              <SecondaryButton onClick={() => onNavigate?.("activity")}>
                Activity
              </SecondaryButton>
              <SecondaryButton onClick={() => onOpenReview?.()}>
                Founder Review
              </SecondaryButton>
            </div>
          </PageSection>

          <SectionCard title="System Status">
            <p className="mono ds-meta">
              {display(top.live_label)} · {display(top.mode)}
            </p>
            <p className="ds-meta">
              Provider {display(top.provider)} · Agent{" "}
              {display(top.latest_agent)}
            </p>
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}
