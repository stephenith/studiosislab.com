import { useMemo, useState } from "react";
import type { DashboardSnapshot, DashboardRoute } from "../data/types";
import {
  AlertBanner,
  Badge,
  EmptyIllustration,
  InfoBanner,
  KPIStatCard,
  MetricGrid,
  PageHeader,
  PageSection,
  PipelineStrip,
  PrimaryButton,
  ReviewCard,
  RuntimeStatusCard,
  SearchBar,
  SecondaryButton,
  SectionCard,
  TimelineCard,
  ToolbarActions,
  type PipelineStage,
  type PipelineStageStatus,
} from "../design-system";
import { NA, display, formatWhen, isToday, scoreOrNa } from "../lib/display";

type Props = {
  snapshot: DashboardSnapshot;
  onOpenReview?: () => void;
  onNavigate?: (route: DashboardRoute) => void;
  onRefresh?: () => void;
  onInspectCycle?: (id: string) => void;
};

export function ResumeView({
  snapshot,
  onOpenReview,
  onNavigate,
  onRefresh,
  onInspectCycle,
}: Props) {
  const [query, setQuery] = useState("");
  const [genNote, setGenNote] = useState<string | null>(null);
  const q = query.trim().toLowerCase();

  const r = snapshot.resume;
  const pc = snapshot.production_cycle;
  const critic = snapshot.critic;
  const resumeDept = snapshot.departments.find((d) => d.id === "resume");

  const waitingReviews = useMemo(
    () =>
      (snapshot.review_queue ?? []).filter((x) => x.status === "waiting_founder"),
    [snapshot.review_queue],
  );

  const completedToday = useMemo(() => {
    const fromQueue = (snapshot.review_queue ?? []).filter(
      (x) =>
        (x.status === "approved" || x.status === "rejected") &&
        isToday(x.created_at),
    );
    const fromCycles = snapshot.cycles.filter(
      (c) => c.status === "completed" && isToday(c.updated_at),
    );
    if (fromQueue.length === 0 && fromCycles.length === 0) {
      const anyDates =
        (snapshot.review_queue ?? []).some((x) => x.created_at) ||
        snapshot.cycles.some((c) => c.updated_at);
      return anyDates ? 0 : null;
    }
    return fromQueue.length + fromCycles.length;
  }, [snapshot.review_queue, snapshot.cycles]);

  const failedRuns = useMemo(() => {
    const failed = snapshot.cycles.filter((c) => c.status === "failed");
    if (snapshot.cycles.length === 0) return null;
    return failed.length;
  }, [snapshot.cycles]);

  const successfulCycles = useMemo(() => {
    if (snapshot.cycles.length === 0) return null;
    return snapshot.cycles.filter((c) => c.status === "completed").length;
  }, [snapshot.cycles]);

  const avgRuntime = useMemo(() => {
    if (pc?.current_duration_ms != null) {
      return `${Math.round(pc.current_duration_ms / 1000)}s`;
    }
    return null;
  }, [pc]);

  const pipelineStages: PipelineStage[] = useMemo(() => {
    const labels =
      r.ai_path.length > 0
        ? r.ai_path
        : r.stages.length > 0
          ? r.stages
          : [];
    if (!labels.length) return [];

    const current = (pc?.current_stage ?? "").toLowerCase();
    const waiting = Boolean(pc?.founder_waiting);
    const blocked = snapshot.exceptions.some(
      (e) => e.severity === "blocked" || e.severity === "fail",
    );

    return labels.map((label, index) => {
      const id = `stage-${index}`;
      const key = label.toLowerCase();
      let status: PipelineStageStatus = "idle";

      if (blocked && key.includes("critic")) status = "blocked";
      else if (waiting && (key.includes("founder") || key.includes("review"))) {
        status = "waiting";
      } else if (current && (key.includes(current) || current.includes(key.slice(0, 8)))) {
        status = "running";
      } else if (pc?.completed_cycle) {
        status = "completed";
      } else if (current) {
        // Stages before a known running index → completed heuristic via path order
        const currentIdx = labels.findIndex(
          (l) =>
            l.toLowerCase().includes(current) ||
            current.includes(l.toLowerCase().slice(0, 8)),
        );
        if (currentIdx >= 0) {
          status = index < currentIdx ? "completed" : index === currentIdx ? "running" : "idle";
        } else if (index < labels.length - 2 && !waiting) {
          status = "idle";
        }
      }

      if (waiting && index === labels.length - 1) status = "waiting";
      if (pc?.completed_cycle && index === labels.length - 1 && !waiting) {
        status = "completed";
      }

      return { id, label, status };
    });
  }, [r.ai_path, r.stages, pc, snapshot.exceptions]);

  const filteredWaiting = useMemo(() => {
    return waitingReviews.filter((item) => {
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.template.toLowerCase().includes(q) ||
        item.review_id.toLowerCase().includes(q)
      );
    });
  }, [waitingReviews, q]);

  const recentCandidates = useMemo(() => {
    const items = [...(snapshot.review_queue ?? [])].sort((a, b) => {
      const ta = Date.parse(a.created_at) || 0;
      const tb = Date.parse(b.created_at) || 0;
      return tb - ta;
    });
    return items.filter((item) => {
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.template.toLowerCase().includes(q) ||
        item.candidate_id.toLowerCase().includes(q)
      );
    });
  }, [snapshot.review_queue, q]);

  const learningItems = useMemo(() => {
    const items: Array<{ id: string; title: string; timestamp: string; body?: string }> = [];
    if (pc?.recent_learning != null) {
      items.push({
        id: "learning-count",
        title: `Recent learning write-backs: ${pc.recent_learning}`,
        timestamp: display(pc.source),
        body: "From production cycle snapshot",
      });
    }
    for (const item of (snapshot.review_queue ?? []).slice(0, 5)) {
      if (item.learning_impact) {
        items.push({
          id: `li-${item.review_id}`,
          title: item.title,
          timestamp: formatWhen(item.created_at),
          body: item.learning_impact,
        });
      }
    }
    if (snapshot.knowledge_snapshot.available) {
      items.push({
        id: "knowledge-snap",
        title: "Knowledge snapshot available",
        timestamp: display(snapshot.knowledge_snapshot.snapshot_id),
        body: `Domains: ${snapshot.knowledge_snapshot.domains.join(", ") || NA}`,
      });
    }
    return items;
  }, [pc, snapshot.review_queue, snapshot.knowledge_snapshot]);

  const deptHealth = resumeDept?.health ?? (r.enabled ? "healthy" : "disabled");
  const lastActivity =
    formatWhen(resumeDept?.last_activity) !== NA
      ? formatWhen(resumeDept?.last_activity)
      : formatWhen(r.latest_run?.updated_at);

  return (
    <div className="ds-command">
      <PageHeader
        title="Resume Department"
        subtitle="Monitor resume production, pipeline execution and founder approvals."
        actions={
          <ToolbarActions>
            <SearchBar
              value={query}
              placeholder="Search reviews & resume templates…"
              aria-label="Search"
              onChange={setQuery}
            />
            <SecondaryButton size="sm" onClick={() => onRefresh?.()}>
              Refresh
            </SecondaryButton>
            <Badge tone={r.enabled ? "approved" : "rejected"}>
              {r.enabled ? "enabled" : "disabled"}
            </Badge>
            <Badge tone="neutral">{r.mode}</Badge>
            <PrimaryButton size="sm" onClick={() => onOpenReview?.()}>
              Open Review
            </PrimaryButton>
          </ToolbarActions>
        }
      />

      {pc?.founder_waiting ? (
        <AlertBanner tone="warn" title="Founder waiting">
          Production cycle paused at WAITING_FOUNDER · publication_allowed=false
        </AlertBanner>
      ) : (
        <InfoBanner title="Read-only operations">
          LIVE OFF · dry_run · Mock Provider · no production controls in this
          dashboard
        </InfoBanner>
      )}

      {genNote ? (
        <InfoBanner title="Generate Resume Template">{genNote}</InfoBanner>
      ) : null}

      <div className="ds-command-split">
        <div className="ds-command-main">
          {/* ROW 1 */}
          <PageSection title="Live Status" subtitle="Department runtime">
            <RuntimeStatusCard
              liveLabel={snapshot.top_bar.live_label}
              provider={r.provider}
              cost={`$${snapshot.top_bar.cost_today_usd}`}
              heartbeat={snapshot.top_bar.heartbeat_age}
              queue={r.queue_depth}
            />
            <MetricGrid>
              <KPIStatCard
                value={display(deptHealth)}
                label="Department Health"
                tone={r.enabled ? "approved" : "rejected"}
                icon="▣"
              />
              <KPIStatCard
                value={display(r.queue_depth)}
                label="Queue Depth"
                tone="waiting"
                icon="◎"
              />
              <KPIStatCard
                value={display(pc?.current_stage)}
                label="Current Stage"
                tone="processing"
                icon="→"
              />
              <KPIStatCard
                value={display(r.provider)}
                label="Current Provider"
                tone="processing"
                icon="◇"
              />
              <KPIStatCard
                value={display(r.mode)}
                label="Current Mode"
                tone="neutral"
                icon="◌"
              />
              <KPIStatCard
                value={display(snapshot.top_bar.heartbeat_age)}
                label="Heartbeat"
                tone="neutral"
                icon="♥"
              />
              <KPIStatCard
                value={lastActivity}
                label="Last Activity"
                tone="neutral"
                icon="◷"
              />
            </MetricGrid>
          </PageSection>

          {/* ROW 2 */}
          <PageSection title="KPI Grid" subtitle="Resume production signals">
            <MetricGrid>
              <KPIStatCard
                value={waitingReviews.length}
                label="Waiting Founder Reviews"
                tone="waiting"
                delta={waitingReviews.length > 0 ? "Action needed" : "Clear"}
                deltaDirection={waitingReviews.length > 0 ? "up" : "flat"}
              />
              <KPIStatCard
                value={completedToday == null ? NA : completedToday}
                label="Completed Today"
                tone="approved"
              />
              <KPIStatCard
                value={
                  pc?.current_candidate
                    ? 1
                    : pc
                      ? 1
                      : NA
                }
                label="Current Production Cycle"
                delta={display(pc?.current_candidate)}
                tone="processing"
              />
              <KPIStatCard
                value={scoreOrNa(critic?.overall ?? pc?.critic_score?.overall)}
                label="Average Critic Score"
                tone="processing"
              />
              <KPIStatCard
                value={
                  pc?.recent_learning == null ? NA : pc.recent_learning
                }
                label="Learning Updates"
                tone="approved"
              />
              <KPIStatCard
                value={failedRuns == null ? NA : failedRuns}
                label="Failed Runs"
                tone="rejected"
              />
            </MetricGrid>
          </PageSection>

          {/* ROW 3 */}
          <PageSection title="Active Production Cycle">
            {!pc ? (
              <EmptyIllustration
                title={NA}
                copy="No production_cycle fields in the current snapshot."
              />
            ) : (
              <SectionCard title="Deployment-style cycle detail">
                <MetricGrid columns={3}>
                  <KPIStatCard
                    value={display(pc.current_candidate)}
                    label="Current Resume Template"
                  />
                  <KPIStatCard
                    value={display(
                      waitingReviews[0]?.template ?? r.latest_run?.title,
                    )}
                    label="Current Template"
                  />
                  <KPIStatCard value={display(pc.task_id)} label="Task ID" />
                  <KPIStatCard
                    value={display(pc.current_stage)}
                    label="Current Stage"
                    tone="processing"
                  />
                  <KPIStatCard
                    value={
                      pc.current_duration_ms != null
                        ? `${Math.round(pc.current_duration_ms / 1000)}s`
                        : pc.waiting_duration_ms != null
                          ? `${Math.round(pc.waiting_duration_ms / 1000)}s waiting`
                          : NA
                    }
                    label="Duration"
                  />
                  <KPIStatCard
                    value={
                      pc.founder_waiting
                        ? "waiting_founder"
                        : pc.completed_cycle
                          ? "completed"
                          : display(pc.current_stage)
                    }
                    label="Current Status"
                    tone={pc.founder_waiting ? "waiting" : "processing"}
                  />
                  <KPIStatCard
                    value={scoreOrNa(
                      pc.critic_score?.overall ?? critic?.overall,
                    )}
                    label="Critic Overall"
                  />
                  <KPIStatCard
                    value={scoreOrNa(pc.critic_score?.ats ?? critic?.ats)}
                    label="ATS Score"
                  />
                  <KPIStatCard
                    value={
                      pc.critic_score?.ready == null && critic?.ready == null
                        ? NA
                        : String(Boolean(pc.critic_score?.ready ?? critic?.ready))
                    }
                    label="Ready"
                    tone={
                      (pc.critic_score?.ready ?? critic?.ready)
                        ? "approved"
                        : "waiting"
                    }
                  />
                  <KPIStatCard
                    value={String(critic?.publication_allowed ?? false)}
                    label="Publication Allowed"
                    tone="rejected"
                  />
                  <KPIStatCard
                    value={String(pc.founder_waiting)}
                    label="Founder Waiting"
                    tone={pc.founder_waiting ? "waiting" : "approved"}
                  />
                  <KPIStatCard
                    value={display(pc.current_queue)}
                    label="Current Queue"
                  />
                </MetricGrid>
              </SectionCard>
            )}
          </PageSection>

          {/* ROW 4 */}
          <PageSection
            title="Pipeline Visualization"
            subtitle="AI-assisted path from department artifacts"
          >
            <SectionCard>
              <PipelineStrip stages={pipelineStages} emptyLabel={NA} />
              {r.deterministic_safeguards.length > 0 ? (
                <p className="ds-meta">
                  Safeguards: {r.deterministic_safeguards.join(" · ")}
                </p>
              ) : null}
            </SectionCard>
          </PageSection>

          {/* ROW 5 */}
          <div className="ds-split-2">
            <PageSection
              title="Waiting Founder Reviews"
              actions={
                onOpenReview ? (
                  <SecondaryButton size="sm" onClick={onOpenReview}>
                    Open Templates Ready for Review
                  </SecondaryButton>
                ) : null
              }
            >
              {filteredWaiting.length === 0 ? (
                <EmptyIllustration title={NA} copy="No waiting_founder items in review_queue." />
              ) : (
                <div className="ds-stack-md">
                  {filteredWaiting.map((item) => (
                    <ReviewCard
                      key={item.review_id}
                      title={item.title}
                      selected={false}
                      onClick={() => onOpenReview?.()}
                      meta={
                        <>
                          <Badge
                            tone={
                              item.badge === "waiting"
                                ? "waiting"
                                : item.badge === "blocked"
                                  ? "blocked"
                                  : "ready"
                            }
                          >
                            {item.status}
                          </Badge>
                          <span className="ds-meta-mono">
                            Critic {scoreOrNa(item.critic?.overall ?? critic?.overall)}
                          </span>
                          <span className="ds-meta-mono">
                            {formatWhen(item.created_at)}
                          </span>
                          <span className="ds-meta-mono">
                            Open Review →
                          </span>
                        </>
                      }
                    />
                  ))}
                </div>
              )}
            </PageSection>

            <PageSection title="Recent Generated Resume Templates">
              {recentCandidates.length === 0 ? (
                <EmptyIllustration title={NA} copy="No resume templates in review queue snapshot." />
              ) : (
                <TimelineCard
                  title="Resume Templates"
                  items={recentCandidates.slice(0, 8).map((item) => ({
                    id: item.review_id,
                    title: item.title,
                    timestamp: formatWhen(item.created_at),
                    body: `Template ${item.template} · ${item.status} · Critic ${scoreOrNa(item.critic?.overall ?? critic?.overall)} · ATS ${scoreOrNa(item.critic?.ats ?? critic?.ats)}`,
                    icon: "▦",
                    severity:
                      item.status === "waiting_founder"
                        ? "warn"
                        : item.status === "approved"
                          ? "ok"
                          : item.status === "rejected"
                            ? "error"
                            : "info",
                  }))}
                />
              )}
            </PageSection>
          </div>

          {/* ROW 6 */}
          <PageSection title="Department Metrics">
            <MetricGrid>
              <KPIStatCard
                value={scoreOrNa(critic?.ats ?? pc?.critic_score?.ats)}
                label="Average ATS"
              />
              <KPIStatCard
                value={scoreOrNa(critic?.overall ?? pc?.critic_score?.overall)}
                label="Average Critic"
              />
              <KPIStatCard
                value={
                  snapshot.cycles.length > 0
                    ? snapshot.cycles.length
                    : pc
                      ? 1
                      : NA
                }
                label="Total Cycles"
              />
              <KPIStatCard
                value={
                  successfulCycles == null
                    ? pc?.completed_cycle
                      ? 1
                      : NA
                    : successfulCycles
                }
                label="Successful Cycles"
                tone="approved"
              />
              <KPIStatCard
                value={failedRuns == null ? NA : failedRuns}
                label="Failed Cycles"
                tone="rejected"
              />
              <KPIStatCard
                value={avgRuntime ?? NA}
                label="Average Runtime"
              />
            </MetricGrid>
          </PageSection>

          {/* ROW 7 */}
          <PageSection title="Learning" subtitle="Write-backs and knowledge updates">
            {learningItems.length === 0 ? (
              <EmptyIllustration title={NA} copy="No learning or knowledge fields present." />
            ) : (
              <TimelineCard
                title="Recent learning"
                items={learningItems.map((x) => ({
                  id: x.id,
                  title: x.title,
                  timestamp: x.timestamp,
                  body: x.body,
                  icon: "✧",
                  severity: "ok" as const,
                }))}
              />
            )}
          </PageSection>
        </div>

        {/* RIGHT SIDEBAR */}
        <aside className="ds-command-aside" aria-label="Resume quick actions">
          <PageSection title="Quick Actions" subtitle="Navigate · no new backend">
            <div className="ds-command-actions ds-command-actions-col">
              <PrimaryButton onClick={() => onOpenReview?.()}>
                Open Templates Ready for Review
              </PrimaryButton>
              <SecondaryButton
                onClick={() => {
                  const id = r.latest_run?.id ?? pc?.task_id;
                  if (id && onInspectCycle) onInspectCycle(id);
                  else setGenNote("No runtime data available for production cycle.");
                }}
              >
                View Production Cycle
              </SecondaryButton>
              <SecondaryButton onClick={() => onNavigate?.("knowledge")}>
                Open Knowledge
              </SecondaryButton>
              <SecondaryButton onClick={() => onNavigate?.("brain")}>
                Open Brain
              </SecondaryButton>
              <SecondaryButton onClick={() => onNavigate?.("activity")}>
                Open Activity
              </SecondaryButton>
              <SecondaryButton
                onClick={() =>
                  setGenNote(
                    "Generate Resume Template is unavailable in this read-only dashboard. No backend action is wired.",
                  )
                }
              >
                Generate Resume Template
              </SecondaryButton>
            </div>
          </PageSection>

          <SectionCard title="Approval state">
            <p className="mono ds-meta">{display(r.approval_state)}</p>
            <p className="ds-meta">
              Batch size {display(r.batch_size)} · Queue {display(r.queue_depth)}
            </p>
          </SectionCard>

          {r.latest_run ? (
            <SectionCard title="Latest run">
              <p className="ds-flag-label">{r.latest_run.title}</p>
              <p className="mono muted ds-meta-mono">{r.latest_run.status}</p>
              <p className="mono muted ds-meta-mono">{r.latest_run.source}</p>
            </SectionCard>
          ) : (
            <SectionCard title="Latest run">
              <p className="ds-meta">{NA}</p>
            </SectionCard>
          )}
        </aside>
      </div>
    </div>
  );
}
