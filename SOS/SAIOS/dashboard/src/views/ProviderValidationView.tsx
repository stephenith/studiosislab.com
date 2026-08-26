import { useMemo, useState } from "react";
import type { DashboardRoute, DashboardSnapshot } from "../data/types";
import {
  AlertBanner,
  Badge,
  EmptyIllustration,
  FounderActionCard,
  InfoBanner,
  KPIStatCard,
  MetricGrid,
  PageHeader,
  PageSection,
  PipelineStrip,
  PrimaryButton,
  RuntimeStatusCard,
  SearchBar,
  SecondaryButton,
  SectionCard,
  TimelineCard,
  ToolbarActions,
  type BadgeTone,
  type PipelineStage,
  type PipelineStageStatus,
} from "../design-system";
import { NA, display, yesNo } from "../lib/display";

const COMPARISON_ROWS = [
  "Latency",
  "Cost",
  "Quality",
  "ATS",
  "Critic",
  "Tokens",
  "Differences",
] as const;

function checklistTone(ok: boolean): BadgeTone {
  return ok ? "approved" : "blocked";
}

function checklistLabel(ok: boolean): string {
  return ok ? "ready" : "blocked";
}

type Props = {
  snapshot: DashboardSnapshot;
  onOpenReview?: () => void;
  onNavigate?: (route: DashboardRoute) => void;
  onRefresh?: () => void;
};

export function ProviderValidationView({
  snapshot,
  onOpenReview,
  onNavigate,
  onRefresh,
}: Props) {
  const [query, setQuery] = useState("");
  const [actionNote, setActionNote] = useState<string | null>(null);
  const q = query.trim().toLowerCase();

  const pv = snapshot.provider_validation;
  const top = snapshot.top_bar;

  const pvActions = useMemo(
    () =>
      (snapshot.founder_actions ?? []).filter(
        (a) =>
          a.category === "provider_validation" ||
          a.id.includes("provider-validation") ||
          a.source.toLowerCase().includes("provider-validation"),
      ),
    [snapshot.founder_actions],
  );

  const pvExceptions = useMemo(
    () =>
      (snapshot.exceptions ?? []).filter(
        (e) =>
          e.source.toLowerCase().includes("provider-validation") ||
          e.title.toLowerCase().includes("provider") ||
          e.detail.toLowerCase().includes("provider validation"),
      ),
    [snapshot.exceptions],
  );

  const pvActivity = useMemo(
    () =>
      (snapshot.activity ?? []).filter(
        (e) =>
          e.department.toLowerCase().includes("provider") ||
          e.summary.toLowerCase().includes("provider validation") ||
          e.event_type.toLowerCase().includes("provider"),
      ),
    [snapshot.activity],
  );

  const matchesQuery = (text: string) =>
    !q || text.toLowerCase().includes(q);

  const blockingItems = useMemo(() => {
    const items: Array<{
      id: string;
      priority: string;
      tone: BadgeTone;
      title: string;
      detail: string;
    }> = [];

    if (pv?.blocking_reasons?.length) {
      pv.blocking_reasons.forEach((reason, i) => {
        if (!matchesQuery(reason)) return;
        items.push({
          id: `block-${i}`,
          priority: `P${i + 1}`,
          tone: i === 0 ? "blocked" : "waiting",
          title: reason.replace(/_/g, " "),
          detail: "From provider_validation.blocking_reasons",
        });
      });
    }

    for (const ex of pvExceptions) {
      if (!matchesQuery(`${ex.title} ${ex.detail}`)) continue;
      items.push({
        id: ex.id,
        priority: ex.severity,
        tone:
          ex.severity === "fail" || ex.severity === "blocked"
            ? "blocked"
            : ex.severity === "founder"
              ? "waiting"
              : "processing",
        title: ex.title,
        detail: ex.detail,
      });
    }

    for (const action of pvActions) {
      if (!matchesQuery(`${action.title} ${action.detail}`)) continue;
      if (items.some((x) => x.title === action.title)) continue;
      items.push({
        id: action.id,
        priority: action.priority || "P?",
        tone: "waiting",
        title: action.title,
        detail: action.detail,
      });
    }

    return items;
  }, [pv, pvExceptions, pvActions, q]);

  const configChecks = useMemo(() => {
    if (!pv) return [];
    const missing = new Set(
      (pv.missing_configuration ?? []).map((m) => m.toLowerCase()),
    );
    const hasMissing = (needle: string) =>
      [...missing].some((m) => m.includes(needle));

    return [
      {
        id: "credentials",
        label: "Credentials",
        ok: pv.credentials_configured,
        detail: pv.credentials_configured
          ? "credentials_configured=true"
          : "credentials_configured=false",
      },
      {
        id: "budget",
        label: "Budget",
        ok: pv.budgets_ok,
        detail: pv.budgets_ok ? "budgets_ok=true" : "budgets_ok=false",
      },
      {
        id: "authorization",
        label: "Authorization",
        ok: (pv.authorization_status ?? "").toUpperCase() === "APPROVED",
        detail: display(pv.authorization_status),
      },
      {
        id: "registry",
        label: "Provider Registry",
        ok: !hasMissing("registry"),
        detail: hasMissing("registry")
          ? "Listed in missing_configuration"
          : "Not listed as missing",
      },
      {
        id: "adapters",
        label: "Adapters",
        ok: !hasMissing("adapter"),
        detail: hasMissing("adapter")
          ? "Listed in missing_configuration"
          : "Not listed as missing",
      },
      {
        id: "thresholds",
        label: "Thresholds",
        ok:
          pv.budgets_ok &&
          !hasMissing("budget") &&
          !hasMissing("limit") &&
          !hasMissing("threshold"),
        detail:
          pv.missing_configuration.filter((m) =>
            /budget|limit|threshold|cost/i.test(m),
          ).join(", ") || (pv.budgets_ok ? "Budget gates ok" : NA),
      },
    ].filter((row) => matchesQuery(`${row.label} ${row.detail}`));
  }, [pv, q]);

  const pipelineStages: PipelineStage[] = useMemo(() => {
    if (!pv) return [];

    const selection = (pv.selection_status ?? "").toUpperCase();
    const auth = (pv.authorization_status ?? "").toUpperCase();
    const mock = (pv.mock_baseline_status ?? "").toUpperCase();
    const ready = (pv.readiness_state ?? "").toUpperCase();
    const blockedSelection =
      selection.includes("BLOCK") || pv.blocking_reasons.length > 0;
    const hasCandidate = Boolean(pv.candidate_id);

    const stage = (
      id: string,
      label: string,
      status: PipelineStageStatus,
    ): PipelineStage => ({ id, label, status });

    const candidateStatus: PipelineStageStatus = !hasCandidate
      ? "waiting"
      : blockedSelection
        ? "blocked"
        : "completed";

    const founderStatus: PipelineStageStatus = pv.eligible
      ? "completed"
      : blockedSelection || auth === "PENDING"
        ? auth === "PENDING" && !blockedSelection
          ? "waiting"
          : "blocked"
        : "waiting";

    const mockStatus: PipelineStageStatus = mock.includes("COMPLETE")
      ? "completed"
      : mock.includes("FAIL") || mock.includes("ERROR")
        ? "blocked"
        : mock.includes("RUN") || mock === "RUNNING"
          ? "running"
          : "waiting";

    const realStatus: PipelineStageStatus = pv.real_provider_request_executed
      ? "completed"
      : ready.includes("BLOCK") ||
          ready.includes("NOT_IMPLEMENTED") ||
          !pv.credentials_configured ||
          !pv.budgets_ok
        ? "blocked"
        : "waiting";

    const comparisonStatus: PipelineStageStatus =
      pv.real_provider_request_executed
        ? "completed"
        : realStatus === "blocked"
          ? "blocked"
          : "waiting";

    const reportStatus: PipelineStageStatus = pv.validation_id
      ? "completed"
      : comparisonStatus === "blocked"
        ? "blocked"
        : "waiting";

    const prodStatus: PipelineStageStatus = pv.publication_allowed
      ? "completed"
      : "blocked";

    return [
      stage("candidate", "Resume Template", candidateStatus),
      stage("founder", "Founder Approval", founderStatus),
      stage("mock", "Mock Baseline", mockStatus),
      stage("real", "Real Provider", realStatus),
      stage("comparison", "Comparison", comparisonStatus),
      stage("report", "Validation Report", reportStatus),
      stage("prod", "Production Ready", prodStatus),
    ];
  }, [pv]);

  const queueDepth = pv
    ? pv.blocking_reasons.length + pv.missing_configuration.length
    : null;

  const filteredMissing = useMemo(() => {
    if (!pv?.missing_configuration?.length) return [];
    return pv.missing_configuration.filter((m) => matchesQuery(m));
  }, [pv, q]);

  const showPackageNote = (kind: "mock" | "package") => {
    if (!pv) {
      setActionNote(NA);
      return;
    }
    if (kind === "mock") {
      setActionNote(
        pv.mock_baseline_id
          ? `Mock baseline id: ${pv.mock_baseline_id} · status: ${pv.mock_baseline_status} · source: ${pv.source ?? NA}`
          : `Mock baseline status: ${pv.mock_baseline_status} · ${NA} for baseline id (no executed report artifact in snapshot).`,
      );
      return;
    }
    setActionNote(
      pv.validation_id
        ? `Validation package: ${pv.validation_id} · checksum: ${pv.frozen_input_checksum ?? NA} · source: ${pv.source ?? NA}`
        : `Validation package id missing · ${NA}`,
    );
  };

  if (!pv) {
    return (
      <div className="ds-command">
        <PageHeader
          title="Provider Validation"
          subtitle="Validate AI providers before production activation."
          actions={
            <ToolbarActions>
              <SearchBar
                value={query}
                placeholder="Search validation…"
                aria-label="Search"
                onChange={setQuery}
              />
              <SecondaryButton size="sm" onClick={() => onRefresh?.()}>
                Refresh
              </SecondaryButton>
            </ToolbarActions>
          }
        />
        <EmptyIllustration
          title={NA}
          copy="provider_validation is absent from the current snapshot."
        />
      </div>
    );
  }

  return (
    <div className="ds-command">
      <PageHeader
        title="Provider Validation"
        subtitle="Validate AI providers before production activation."
        actions={
          <ToolbarActions>
            <SearchBar
              value={query}
              placeholder="Search blockers & config…"
              aria-label="Search"
              onChange={setQuery}
            />
            <SecondaryButton size="sm" onClick={() => onRefresh?.()}>
              Refresh
            </SecondaryButton>
            <Badge
              tone={
                pv.eligible
                  ? "approved"
                  : pv.selection_status.toUpperCase().includes("BLOCK")
                    ? "blocked"
                    : "waiting"
              }
            >
              {pv.selection_status}
            </Badge>
            <Badge tone="neutral">{top.mode}</Badge>
            <PrimaryButton size="sm" onClick={() => onOpenReview?.()}>
              Quick Actions
            </PrimaryButton>
          </ToolbarActions>
        }
      />

      {pv.blocking_reasons.length > 0 ? (
        <AlertBanner tone="warn" title="Validation blocked">
          {pv.blocking_reasons[0].replace(/_/g, " ")}
          {pv.founder_action ? ` · ${pv.founder_action}` : ""}
        </AlertBanner>
      ) : (
        <InfoBanner title="Read-only validation gate">
          LIVE OFF · dry_run · real_provider_request_executed=
          {String(pv.real_provider_request_executed)} · publication_allowed=
          {String(pv.publication_allowed)}
        </InfoBanner>
      )}

      {actionNote ? (
        <InfoBanner title="Quick Action">{actionNote}</InfoBanner>
      ) : null}

      <div className="ds-command-split">
        <div className="ds-command-main">
          {/* ROW 1 */}
          <PageSection title="Live Status" subtitle="Provider validation runtime">
            <RuntimeStatusCard
              liveLabel={top.live_label}
              provider={top.provider}
              cost={`$${top.cost_today_usd}`}
              heartbeat={top.heartbeat_age}
              queue={queueDepth ?? NA}
            />
            <MetricGrid>
              <KPIStatCard
                value={display(pv.readiness_state)}
                label="Validation Status"
                tone={
                  pv.readiness_state.toUpperCase().includes("READY")
                    ? "approved"
                    : "blocked"
                }
                icon="▣"
              />
              <KPIStatCard
                value={display(top.provider)}
                label="Current Provider"
                tone="processing"
                icon="◇"
              />
              <KPIStatCard
                value={display(pv.candidate_title ?? pv.candidate_id)}
                label="Selected Resume Template"
                tone="waiting"
                icon="◎"
              />
              <KPIStatCard
                value={display(top.mode)}
                label="Current Mode"
                tone="neutral"
                icon="◌"
              />
              <KPIStatCard
                value={display(top.heartbeat_age)}
                label="Heartbeat"
                tone="neutral"
                icon="♥"
              />
              <KPIStatCard
                value={queueDepth == null ? NA : queueDepth}
                label="Queue"
                tone="waiting"
                icon="☰"
              />
            </MetricGrid>
          </PageSection>

          {/* ROW 2 */}
          <PageSection title="KPI Grid" subtitle="Gate signals">
            <MetricGrid>
              <KPIStatCard
                value={yesNo(pv.eligible)}
                label="Eligible Resume Template"
                tone={pv.eligible ? "approved" : "blocked"}
              />
              <KPIStatCard
                value={display(pv.founder_action ?? pv.selection_status)}
                label="Founder Approval"
                tone="waiting"
              />
              <KPIStatCard
                value={display(pv.authorization_status)}
                label="Authorization"
                tone={
                  (pv.authorization_status ?? "").toUpperCase() === "APPROVED"
                    ? "approved"
                    : "waiting"
                }
              />
              <KPIStatCard
                value={pv.budgets_ok ? "ok" : "blocked"}
                label="Budget Status"
                tone={pv.budgets_ok ? "approved" : "blocked"}
              />
              <KPIStatCard
                value={pv.credentials_configured ? "configured" : "missing"}
                label="Credentials"
                tone={pv.credentials_configured ? "approved" : "blocked"}
              />
              <KPIStatCard
                value={display(pv.readiness_state)}
                label="Readiness"
                tone="processing"
              />
            </MetricGrid>
          </PageSection>

          {/* ROW 3 */}
          <PageSection title="Validation Readiness">
            <SectionCard title="Deployment-style readiness detail">
              <MetricGrid columns={3}>
                <KPIStatCard
                  value={display(pv.candidate_title ?? pv.candidate_id)}
                  label="Selected Resume Template"
                />
                <KPIStatCard
                  value={display(pv.validation_id)}
                  label="Validation ID"
                />
                <KPIStatCard
                  value={display(pv.readiness_state)}
                  label="Readiness"
                  tone="processing"
                />
                <KPIStatCard
                  value={display(pv.authorization_status)}
                  label="Authorization"
                  tone="waiting"
                />
                <KPIStatCard
                  value={pv.budgets_ok ? "ok" : "missing / invalid"}
                  label="Budget"
                  tone={pv.budgets_ok ? "approved" : "blocked"}
                />
                <KPIStatCard
                  value={pv.credentials_configured ? "configured" : "missing"}
                  label="Credentials"
                  tone={pv.credentials_configured ? "approved" : "blocked"}
                />
                <KPIStatCard
                  value={
                    pv.blocking_reasons.length
                      ? String(pv.blocking_reasons.length)
                      : "0"
                  }
                  label="Blocking Reasons"
                  tone={pv.blocking_reasons.length ? "blocked" : "approved"}
                  delta={
                    pv.blocking_reasons[0]?.replace(/_/g, " ") ?? "None listed"
                  }
                />
                <KPIStatCard
                  value={display(pv.comparison_dimensions_count)}
                  label="Comparison Dimensions"
                />
                <KPIStatCard
                  value={String(pv.publication_allowed)}
                  label="Publication Allowed"
                  tone="rejected"
                />
              </MetricGrid>
            </SectionCard>
          </PageSection>

          {/* ROW 4 */}
          <PageSection
            title="Validation Flow"
            subtitle="Gate path before production activation"
          >
            <SectionCard>
              <PipelineStrip stages={pipelineStages} emptyLabel={NA} />
            </SectionCard>
          </PageSection>

          {/* ROW 5 */}
          <div className="ds-command-split ds-split-2">
            <PageSection title="Blocking Reasons" subtitle="Priority order">
              {blockingItems.length === 0 ? (
                <EmptyIllustration
                  title={NA}
                  copy="No blocking_reasons, provider exceptions, or founder_actions matched."
                />
              ) : (
                <div className="ds-stack-sm">
                  {blockingItems.map((item) => (
                    <FounderActionCard
                      key={item.id}
                      priority={item.priority}
                      priorityTone={item.tone}
                      title={item.title}
                      description={item.detail}
                      cta={
                        <span className="muted ds-meta-mono">
                          Snapshot signal only
                        </span>
                      }
                    />
                  ))}
                </div>
              )}
            </PageSection>

            <PageSection title="Configuration Checklist">
              {configChecks.length === 0 ? (
                <EmptyIllustration title={NA} copy="No checklist fields available." />
              ) : (
                <SectionCard>
                  <div className="ds-stack-sm">
                    {configChecks.map((row) => (
                      <div key={row.id} className="ds-row-between">
                        <div>
                          <div className="ds-flag-label">{row.label}</div>
                          <div className="muted mono ds-meta-mono">
                            {row.detail}
                          </div>
                        </div>
                        <Badge tone={checklistTone(row.ok)}>
                          {checklistLabel(row.ok)}
                        </Badge>
                      </div>
                    ))}
                    {filteredMissing.length > 0 ? (
                      <div>
                        <div className="ds-meta">missing_configuration</div>
                        <ul className="ds-path-list">
                          {filteredMissing.map((m) => (
                            <li key={m}>{m}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </SectionCard>
              )}
            </PageSection>
          </div>

          {/* ROW 6 */}
          <PageSection
            title="Mock vs Real Comparison"
            subtitle="Requires executed real-provider validation evidence"
          >
            <SectionCard title="Comparison table">
              <p className="ds-meta">
                Dimensions contracted: {display(pv.comparison_dimensions_count)}{" "}
                · real_provider_request_executed=
                {String(pv.real_provider_request_executed)} · mock=
                {display(pv.mock_baseline_status)}
              </p>
              {!pv.real_provider_request_executed ? (
                <p className="ds-meta">
                  {NA} for Latency / Cost / Quality / ATS / Critic / Tokens —
                  no comparison scores in snapshot.
                </p>
              ) : null}
              <div className="ds-table-wrap">
                <table className="ds-table">
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th>Mock</th>
                      <th>Real</th>
                      <th>Diff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARISON_ROWS.map((row) => (
                      <tr key={row}>
                        <td>{row}</td>
                        <td>{NA}</td>
                        <td>{NA}</td>
                        <td>{NA}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </PageSection>

          {pvActivity.length > 0 ? (
            <PageSection title="Related Activity">
              <TimelineCard
                title="Provider validation events"
                items={pvActivity.slice(0, 8).map((e) => ({
                  id: e.id,
                  title: e.summary,
                  timestamp: e.timestamp || NA,
                  body: `${e.event_type} · ${e.status}`,
                  icon: "◇",
                  severity:
                    e.status === "fail" || e.status === "blocked"
                      ? ("error" as const)
                      : e.status === "degraded" || e.status === "waiting"
                        ? ("warn" as const)
                        : ("info" as const),
                }))}
              />
            </PageSection>
          ) : null}
        </div>

        {/* RIGHT SIDEBAR */}
        <aside
          className="ds-command-aside"
          aria-label="Provider validation quick actions"
        >
          <PageSection title="Quick Actions" subtitle="Buttons only · no backend">
            <div className="ds-command-actions ds-command-actions-col">
              <PrimaryButton
                onClick={() => {
                  if (pv.candidate_id) onOpenReview?.();
                  else setActionNote(NA);
                }}
              >
                Review Resume Template
              </PrimaryButton>
              <SecondaryButton onClick={() => onOpenReview?.()}>
                Open Founder Review
              </SecondaryButton>
              <SecondaryButton onClick={() => showPackageNote("mock")}>
                View Mock Report
              </SecondaryButton>
              <SecondaryButton onClick={() => showPackageNote("package")}>
                View Validation Package
              </SecondaryButton>
              <SecondaryButton onClick={() => onNavigate?.("activity")}>
                Open Runtime Logs
              </SecondaryButton>
            </div>
          </PageSection>

          <SectionCard title="Provider Status">
            <p className="mono ds-meta">{display(pv.selection_status)}</p>
            <p className="ds-meta">
              Eligible {yesNo(pv.eligible)} · Auth{" "}
              {display(pv.authorization_status)}
            </p>
          </SectionCard>

          <SectionCard title="Frozen input">
            <p className="mono ds-meta-mono">
              {display(pv.frozen_input_checksum)}
            </p>
            <p className="muted mono ds-meta-mono">
              source: {display(pv.source)}
            </p>
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}
