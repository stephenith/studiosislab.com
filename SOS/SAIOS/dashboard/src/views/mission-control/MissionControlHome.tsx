/**
 * AIOS Mission Control Home — Agent #222B.
 * UI elevation of Founder Command Center. Reuses existing FCC snapshot only.
 */
import { useEffect, useMemo, useState } from "react";
import type {
  FccSection,
  FounderCommandCenterSnapshot,
  FreshnessStatus,
} from "../../data/founderCommandCenterTypes";
import { Badge, EmptyIllustration, SecondaryButton } from "../../design-system";
import { EngineeringReviewPanel } from "./EngineeringReviewPanel";
import { FounderActionsPanel } from "./FounderActionsPanel";
import { OrchestrationStatusPanel } from "./OrchestrationStatusPanel";
import { ProductionValidationPanel } from "./ProductionValidationPanel";
import { ProductionReadinessPanel } from "./ProductionReadinessPanel";
import { ProductionBootstrapPanel } from "./ProductionBootstrapPanel";
import { FirstSupervisedRunPanel } from "./FirstSupervisedRunPanel";
import {
  FreshnessIndicator,
  McMetricCard,
  McSectionHeader,
  McTimelineCard,
  RecommendationCard,
  StatusCard,
  formatDisplay,
} from "./components";

function statusToneFromValue(
  label: string,
  value: string,
): "neutral" | "approved" | "waiting" | "rejected" | "processing" {
  const v = value.toUpperCase();
  if (v.includes("HEALTHY") || v === "ALLOW" || v === "RUNNING") return "approved";
  if (v.includes("UNHEALTHY") || v === "DENY" || v === "FAILED") return "rejected";
  if (v === "PAUSE" || v.includes("WAITING") || v === "STALE") return "waiting";
  if (v === "BUSY" || v === "SLOW_DOWN" || v === "RUN_SOON") return "processing";
  if (label === "Factory Status" && v === "STOPPED") return "neutral";
  return "neutral";
}

function sectionOrUnavailable<T>(
  section: FccSection<T> | null | undefined,
): { freshness: FreshnessStatus; data: T | null } {
  if (!section) {
    return {
      freshness: "unavailable",
      data: null,
    };
  }
  return {
    freshness: section.freshness.status,
    data: section.data,
  };
}

function countStatus(
  by: Record<string, number> | undefined,
  keys: string[],
): number | null {
  if (!by) return null;
  let n = 0;
  let hit = false;
  for (const k of keys) {
    if (typeof by[k] === "number") {
      n += by[k];
      hit = true;
    }
  }
  return hit ? n : null;
}

export function MissionControlHome({
  snap,
  onOpenReview,
  onRefresh,
}: {
  snap: FounderCommandCenterSnapshot;
  onOpenReview: () => void;
  onRefresh?: () => void;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const factory = sectionOrUnavailable(snap.factory);
  const auto = sectionOrUnavailable(snap.autonomous);
  const health = sectionOrUnavailable(snap.health);
  const budget = sectionOrUnavailable(snap.budget);
  const schedule = sectionOrUnavailable(snap.scheduling);
  const ops = sectionOrUnavailable(snap.operations);
  const fq = sectionOrUnavailable(snap.founder_queue);
  const portfolio = sectionOrUnavailable(snap.portfolio);
  const strategy = sectionOrUnavailable(snap.strategy);
  const advisor = sectionOrUnavailable(snap.advisor);
  const eng = sectionOrUnavailable(snap.engineering);
  const lastExec = sectionOrUnavailable(snap.last_execution);
  const lastFail = sectionOrUnavailable(snap.last_failure);

  const factoryVal = formatDisplay(
    factory.freshness,
    factory.data?.autonomous_state,
  );
  const autoVal = formatDisplay(auto.freshness, auto.data?.state);
  const healthVal = formatDisplay(health.freshness, health.data?.status);
  const budgetVal = formatDisplay(budget.freshness, budget.data?.decision);
  const scheduleVal = formatDisplay(schedule.freshness, schedule.data?.decision);

  const todayProd = formatDisplay(ops.freshness, ops.data?.today_cycles, {
    missingLabel: "—",
  });
  const candidates = formatDisplay(
    fq.freshness,
    fq.data?.total_candidates ?? ops.data?.today_candidates,
  );
  const waiting = formatDisplay(fq.freshness, fq.data?.waiting_founder);

  const completedCount = countStatus(fq.data?.by_status, [
    "APPROVED",
    "COMPLETED",
    "PUBLISHED",
  ]);
  const failureCount =
    countStatus(fq.data?.by_status, ["FAILED", "REJECTED", "CRITIC_BLOCKED"]) ??
    null;
  // Never invent zeros: if status keys absent, show unavailable for that metric
  const completedDisp =
    fq.freshness === "missing" || fq.freshness === "unavailable"
      ? formatDisplay(fq.freshness, null)
      : completedCount === null
        ? { text: "—", empty: true }
        : { text: String(completedCount), empty: false };
  const failuresDisp =
    fq.freshness === "missing" || fq.freshness === "unavailable"
      ? formatDisplay(fq.freshness, null)
      : failureCount === null && !lastFail.data
        ? { text: "—", empty: true }
        : {
            text: String(
              failureCount ?? (lastFail.data ? 1 : null) ?? "—",
            ),
            empty: failureCount === null && !lastFail.data,
          };

  const queueWaiting = fq.data?.waiting_founder ?? null;
  const queueMax = health.data?.queue_max ?? null;
  const utilization =
    queueWaiting !== null && queueMax !== null && queueMax > 0
      ? `${Math.min(100, Math.round((queueWaiting / queueMax) * 100))}%`
      : null;
  const utilDisp =
    fq.freshness === "missing" || health.freshness === "missing"
      ? { text: "—", empty: true }
      : utilization === null
        ? { text: "—", empty: true }
        : { text: utilization, empty: false };

  const timelineItems = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      timestamp: string;
      body?: string;
      kind?: "ok" | "warn" | "error" | "info";
    }> = [];
    if (lastExec.data?.execution_id) {
      items.push({
        id: `exec-${lastExec.data.execution_id}`,
        title: `Execution ${lastExec.data.execution_id}`,
        timestamp: lastExec.data.finished_at ?? "—",
        body: `stop: ${lastExec.data.stop_reason ?? "—"} · templates: ${lastExec.data.candidate_count ?? "—"}`,
        kind:
          lastExec.data.stop_reason === "completed" ||
          lastExec.data.stop_reason === "waiting_founder"
            ? "ok"
            : "info",
      });
    }
    if (lastFail.data?.execution_id) {
      items.push({
        id: `fail-${lastFail.data.execution_id}`,
        title: `Failure ${lastFail.data.execution_id}`,
        timestamp: lastFail.data.finished_at ?? "—",
        body: lastFail.data.stop_detail ?? lastFail.data.stop_reason ?? undefined,
        kind: "error",
      });
    }
    if (health.data?.status) {
      items.push({
        id: "health-event",
        title: `Health ${health.data.status}`,
        timestamp: health.freshness === "current" ? snap.generated_at : "—",
        body:
          health.data.failed_checks?.length
            ? health.data.failed_checks.join(", ")
            : undefined,
        kind: health.data.status === "HEALTHY" ? "ok" : "warn",
      });
    }
    if (budget.data?.decision) {
      items.push({
        id: "budget-event",
        title: `Budget ${budget.data.decision}`,
        timestamp: budget.freshness === "current" ? snap.generated_at : "—",
        body: budget.data.violation_codes?.length
          ? budget.data.violation_codes.join(", ")
          : undefined,
        kind: budget.data.decision === "ALLOW" ? "ok" : "warn",
      });
    }
    if (auto.data?.scheduling_decision === "PAUSE") {
      items.push({
        id: "skip-cycle",
        title: "Skipped / paused cycle",
        timestamp: auto.data.next_evaluation_at ?? "—",
        body: "Scheduling decision PAUSE",
        kind: "warn",
      });
    }
    return items;
  }, [lastExec, lastFail, health, budget, auto, snap.generated_at]);

  const timelineFreshness: FreshnessStatus =
    lastExec.freshness === "missing" &&
    lastFail.freshness === "missing" &&
    health.freshness === "missing"
      ? "missing"
      : lastExec.freshness === "stale" ||
          health.freshness === "stale" ||
          budget.freshness === "stale"
        ? "stale"
        : "current";

  const advisorIds = advisor.data?.top_ids ?? [];

  return (
    <div className="mc-root ds-command" data-mc="v1" data-readonly="true">
      {/* HEADER */}
      <header className="mc-header">
        <div className="mc-header-brand">
          <p className="mc-eyebrow">AIOS</p>
          <h1 className="mc-title">AIOS Mission Control</h1>
          <p className="mc-subtitle">
            Autonomous Intelligence Operating System
          </p>
        </div>
        <div className="mc-header-meta">
          <div className="mc-meta-chip">
            <span className="mc-meta-label">Current Time</span>
            <span className="mono">{now.toLocaleString()}</span>
          </div>
          <div className="mc-meta-chip">
            <span className="mc-meta-label">Last Refresh</span>
            <span className="mono">
              {new Date(snap.generated_at).toLocaleString()}
            </span>
          </div>
          <div className="mc-header-badges">
            <Badge tone="neutral" className="badge live-off">
              {snap.safety.live_label}
            </Badge>
            <Badge tone="neutral">{snap.safety.publication_label}</Badge>
            <Badge tone="waiting">Founder Approval Required</Badge>
          </div>
          {onRefresh ? (
            <SecondaryButton size="sm" onClick={onRefresh}>
              Refresh
            </SecondaryButton>
          ) : null}
        </div>
      </header>

      {/* ROW 1 */}
      <section className="mc-row-block" aria-label="Factory status row">
        <McSectionHeader title="Factory Pulse" subtitle="What is the system doing now" />
        <div className="mc-row mc-row-5">
          <StatusCard
            label="Factory Status"
            value={factoryVal.text}
            freshness={factory.freshness}
            detail={
              factory.data?.session_id
                ? `session ${factory.data.session_id}`
                : factory.freshness
            }
            tone={statusToneFromValue("Factory Status", factoryVal.text)}
          />
          <StatusCard
            label="Autonomous Status"
            value={autoVal.text}
            freshness={auto.freshness}
            detail={
              auto.data?.busy
                ? "busy"
                : auto.data?.running
                  ? "running"
                  : auto.freshness
            }
            tone={statusToneFromValue("Autonomous Status", autoVal.text)}
          />
          <StatusCard
            label="Health"
            value={healthVal.text}
            freshness={health.freshness}
            detail={
              health.data?.failed_checks?.length
                ? `${health.data.failed_checks.length} failed`
                : health.freshness
            }
            tone={statusToneFromValue("Health", healthVal.text)}
          />
          <StatusCard
            label="Budget"
            value={budgetVal.text}
            freshness={budget.freshness}
            detail={
              budget.data?.violation_codes?.length
                ? budget.data.violation_codes.join(", ")
                : budget.freshness
            }
            tone={statusToneFromValue("Budget", budgetVal.text)}
          />
          <StatusCard
            label="Schedule"
            value={scheduleVal.text}
            freshness={schedule.freshness}
            detail={
              schedule.data?.next_interval_ms != null
                ? `next ${schedule.data.next_interval_ms}ms`
                : schedule.freshness
            }
            tone={statusToneFromValue("Schedule", scheduleVal.text)}
          />
        </div>
      </section>

      {/* ROW 2 */}
      <section className="mc-row-block" aria-label="Today production row">
        <McSectionHeader title="Today" subtitle="Production throughput" />
        <div className="mc-row mc-row-5">
          <McMetricCard
            label="Today's Production"
            value={
              ops.data == null
                ? todayProd.text
                : `${formatDisplay(ops.freshness, ops.data.today_cycles).text}`
            }
            freshness={ops.freshness}
            detail={
              ops.data
                ? `${formatDisplay(ops.freshness, ops.data.today_candidates).text} templates today`
                : "Report missing — not treated as zero"
            }
            empty={todayProd.empty}
          />
          <McMetricCard
            label="Templates"
            value={candidates.text}
            freshness={fq.freshness}
            detail="Registry total"
            empty={candidates.empty}
          />
          <McMetricCard
            label="Ready for Review"
            value={waiting.text}
            freshness={fq.freshness}
            detail="Canonical Founder Review projection"
            empty={waiting.empty}
          />
          <McMetricCard
            label="Completed"
            value={completedDisp.text}
            freshness={
              completedCount === null && fq.data
                ? "unavailable"
                : fq.freshness
            }
            detail={
              completedCount === null && fq.data
                ? "Status keys not in snapshot"
                : undefined
            }
            empty={completedDisp.empty}
          />
          <McMetricCard
            label="Failures"
            value={failuresDisp.text}
            freshness={
              failureCount === null && !lastFail.data && fq.data
                ? "unavailable"
                : fq.freshness
            }
            detail={
              lastFail.data?.stop_reason
                ? `last: ${lastFail.data.stop_reason}`
                : failureCount === null
                  ? "No failure keys in snapshot"
                  : undefined
            }
            empty={failuresDisp.empty}
          />
        </div>
      </section>

      {/* ROW 3 — Founder Queue */}
      <section className="mc-row-block" aria-label="Founder queue">
        <McSectionHeader title="Template Queue" />
        <article className="mc-card mc-queue-hero">
          <div className="mc-card-top">
            <h3 className="mc-card-heading">Ready for Review</h3>
            <FreshnessIndicator status={fq.freshness} />
          </div>
          {fq.data == null ? (
            <EmptyIllustration
              title="No templates ready for review"
              copy={
                fq.freshness === "missing"
                  ? "Template registry missing — values not treated as zero."
                  : "Queue unavailable."
              }
            />
          ) : fq.data.waiting_founder === 0 ? (
            <EmptyIllustration
              title="No templates ready for review"
              copy="Template Queue is clear."
            />
          ) : (
            <div className="mc-queue-grid">
              <div>
                <p className="mc-card-label">Ready for Review</p>
                <p className="mc-queue-value">{fq.data.waiting_founder}</p>
              </div>
              <div>
                <p className="mc-card-label">Queue utilization</p>
                <p className="mc-queue-value">{utilDisp.text}</p>
                {utilDisp.empty ? (
                  <p className="mc-card-detail muted">
                    Max capacity not available in snapshot
                  </p>
                ) : (
                  <p className="mc-card-detail muted">
                    {queueWaiting} / {queueMax}
                  </p>
                )}
              </div>
              <div>
                <p className="mc-card-label">Oldest waiting</p>
                <p className="mc-queue-value">—</p>
                <p className="mc-card-detail muted">
                  Unavailable in current snapshot
                </p>
                <FreshnessIndicator status="unavailable" compact />
              </div>
              <div>
                <p className="mc-card-label">Newest waiting</p>
                <p className="mc-queue-value">—</p>
                <p className="mc-card-detail muted">
                  Unavailable in current snapshot
                </p>
                <FreshnessIndicator status="unavailable" compact />
              </div>
            </div>
          )}
          <div className="mc-queue-cta">
            <SecondaryButton onClick={onOpenReview}>
              Open Founder Review
            </SecondaryButton>
            <span className="mono muted">Canonical review · unchanged</span>
          </div>
        </article>
      </section>

      {/* ROW 4 — Portfolio */}
      <section className="mc-row-block" aria-label="Portfolio intelligence">
        <McSectionHeader
          title="Portfolio Intelligence"
          subtitle="Coverage and recommendations"
        />
        {portfolio.data == null &&
        (portfolio.freshness === "missing" ||
          portfolio.freshness === "unavailable") ? (
          <article className="mc-card">
            <EmptyIllustration
              title="Portfolio not generated"
              copy="Values are not treated as zero."
            />
            <FreshnessIndicator status={portfolio.freshness} />
          </article>
        ) : (
          <div className="mc-row mc-row-4">
            <McMetricCard
              label="Coverage Score"
              value={
                formatDisplay(
                  portfolio.freshness,
                  portfolio.data?.coverage_score ?? ops.data?.portfolio_score,
                ).text
              }
              freshness={portfolio.freshness}
            />
            <McMetricCard
              label="Trend"
              value="—"
              freshness="unavailable"
              detail="Not in Command Center snapshot"
              empty
            />
            <McMetricCard
              label="Top Missing Categories"
              value="—"
              freshness="unavailable"
              detail="Not in Command Center snapshot"
              empty
            />
            <McMetricCard
              label="Top Recommendation"
              value={
                portfolio.data?.recommendation_count != null
                  ? `${portfolio.data.recommendation_count} recs`
                  : "—"
              }
              freshness={
                portfolio.data?.recommendation_count != null
                  ? portfolio.freshness
                  : "unavailable"
              }
              detail={
                portfolio.data?.recommendation_count == null
                  ? "No recommendations projected"
                  : undefined
              }
              empty={portfolio.data?.recommendation_count == null}
            />
          </div>
        )}
      </section>

      {/* ROW 5 — Strategy */}
      <section className="mc-row-block" aria-label="Strategy">
        <McSectionHeader title="Strategy" />
        <div className="mc-row mc-row-3">
          <McMetricCard
            label="Current Strategy Version"
            value={
              formatDisplay(
                strategy.freshness,
                strategy.data?.strategy_version,
              ).text
            }
            freshness={strategy.freshness}
            empty={strategy.data?.strategy_version == null}
          />
          <McMetricCard
            label="Top Goals"
            value="—"
            freshness="unavailable"
            detail="Not in Command Center snapshot"
            empty
          />
          <McMetricCard
            label="Recommendation Count"
            value={
              formatDisplay(
                strategy.freshness,
                strategy.data?.recommendation_count,
              ).text
            }
            freshness={strategy.freshness}
            empty={strategy.data?.recommendation_count == null}
          />
        </div>
      </section>

      {/* ROW 6 — Policy Advisor */}
      <section className="mc-row-block" aria-label="Policy advisor">
        <McSectionHeader
          title="Policy Advisor"
          actions={
            <Badge tone="waiting" className="mono">
              Advisory Only
            </Badge>
          }
        />
        <div className="mc-advisor-layout">
          <McMetricCard
            label="Recommendation Count"
            value={
              formatDisplay(
                advisor.freshness,
                advisor.data?.recommendation_count,
              ).text
            }
            freshness={advisor.freshness}
            empty={advisor.data?.recommendation_count == null}
          />
          <McMetricCard
            label="Severity Summary"
            value="—"
            freshness="unavailable"
            detail="Severity not projected in snapshot"
            empty
          />
          <div className="mc-advisor-list">
            <div className="mc-card-top" style={{ marginBottom: 12 }}>
              <span className="mc-card-label">Top 5 Recommendations</span>
              <FreshnessIndicator status={advisor.freshness} compact />
            </div>
            {advisorIds.length === 0 ? (
              <EmptyIllustration
                title="No recommendations"
                copy="Advisor report has no recommendation IDs."
              />
            ) : (
              <div className="mc-rec-stack">
                {advisorIds.slice(0, 5).map((id) => (
                  <RecommendationCard
                    key={id}
                    id={id}
                    title={id}
                    body="Advisory only — no apply on this surface"
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ROW 7 — Factory Timeline */}
      <section className="mc-row-block" aria-label="Factory timeline">
        <McSectionHeader
          title="Factory Timeline"
          subtitle="Recent executions, failures, health & budget events"
        />
        <McTimelineCard
          title="Recent activity"
          freshness={timelineFreshness}
          items={timelineItems}
          emptyLabel="No executions yet"
        />
      </section>

      {/* First Supervised Production Run — Agent #230 · Founder approval required */}
      <FirstSupervisedRunPanel />

      {/* Production Bootstrap — Agent #229 · prepare only */}
      <ProductionBootstrapPanel />

      {/* Production Readiness — Agent #228 · audit only */}
      <ProductionReadinessPanel />

      {/* Production Validation — Agent #227 · validation only */}
      <ProductionValidationPanel />

      {/* System Orchestration — Agent #226 · coordination only */}
      <OrchestrationStatusPanel />

      {/* Founder Actions — Agent #225 · adapters only */}
      <FounderActionsPanel onActionComplete={onRefresh} />

      {/* Engineering Review — Agent #224 · reuses #223 report */}
      <EngineeringReviewPanel
        scoreFreshness={eng.freshness}
        overallFromSnap={eng.data?.overall ?? null}
      />

      {/* Safety */}
      <section className="mc-row-block" aria-label="Safety">
        <McSectionHeader title="Safety" />
        <article className="mc-card mc-safety-card">
          <div className="mc-safety-grid">
            <div>
              <p className="mc-card-label">LIVE</p>
              <p className="mc-safety-value">{snap.safety.live_label}</p>
            </div>
            <div>
              <p className="mc-card-label">Publication</p>
              <p className="mc-safety-value">{snap.safety.publication_label}</p>
            </div>
            <div>
              <p className="mc-card-label">Runtime Guard</p>
              <p className="mc-safety-value">
                {snap.safety.runtime_guard_present ? "Present" : "Missing"}
              </p>
              <p className="mc-card-detail muted mono">
                {snap.safety.runtime_guard_detail}
              </p>
            </div>
            <div>
              <p className="mc-card-label">Production Entry</p>
              <p className="mc-safety-value mono">
                {snap.safety.production_entry}
              </p>
            </div>
          </div>
          <p className="mc-card-detail muted" style={{ marginTop: 16 }}>
            Observation only · Founder Approval Required · No mutations on this
            surface
          </p>
        </article>
      </section>
    </div>
  );
}
