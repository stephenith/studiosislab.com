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
  PipelineStrip,
  PrimaryButton,
  RuntimeStatusCard,
  SecondaryButton,
  SectionCard,
  ToolbarActions,
  type PipelineStage,
  type PipelineStageStatus,
} from "../design-system";
import { NA, display } from "../lib/display";

function metaString(
  meta: Record<string, string | number | boolean | null> | undefined,
  key: string,
): string {
  if (!meta || !(key in meta)) return NA;
  const v = meta[key];
  if (v == null || v === "") return NA;
  return String(v);
}

type Props = {
  snapshot: DashboardSnapshot;
  onSelectNode: (id: string) => void;
  onNavigate?: (route: DashboardRoute) => void;
  onOpenReview?: () => void;
  onRefresh?: () => void;
};

export function BrainStudio({
  snapshot,
  onSelectNode,
  onNavigate,
  onOpenReview,
  onRefresh,
}: Props) {
  const [note, setNote] = useState<string | null>(null);
  const nodes = snapshot.brain_path ?? [];
  const top = snapshot.top_bar;

  const byKind = useMemo(() => {
    const map = new Map<string, (typeof nodes)[number]>();
    for (const n of nodes) {
      map.set(n.kind.toLowerCase(), n);
      map.set(n.id.toLowerCase(), n);
    }
    return map;
  }, [nodes]);

  const providerNode =
    byKind.get("provider") ?? nodes.find((n) => n.kind === "provider");
  const routerNode =
    byKind.get("router") ?? byKind.get("brain") ?? nodes.find((n) => n.kind === "router");
  const skillNode =
    byKind.get("skill") ?? nodes.find((n) => n.kind === "skill");
  const responseNode =
    byKind.get("response") ?? nodes.find((n) => n.kind === "response");
  const knowledgeNode =
    byKind.get("knowledge") ?? nodes.find((n) => n.kind === "knowledge");

  const routerStatus = useMemo(() => {
    if (!routerNode) return null;
    return metaString(routerNode.meta, "validation") !== NA
      ? metaString(routerNode.meta, "validation")
      : display(routerNode.label);
  }, [routerNode]);

  const currentProvider = useMemo(() => {
    const fromMeta = providerNode
      ? metaString(providerNode.meta, "provider")
      : NA;
    if (fromMeta !== NA) return fromMeta;
    if (routerNode) {
      const sel = metaString(routerNode.meta, "selected_provider");
      if (sel !== NA) return sel;
    }
    return display(top.provider);
  }, [providerNode, routerNode, top.provider]);

  const skillsUsed = useMemo(() => {
    if (!skillNode) return null;
    const sid = metaString(skillNode.meta, "skill_id");
    return sid !== NA ? 1 : null;
  }, [skillNode]);

  const successfulRoutes = useMemo(() => {
    if (!responseNode) return null;
    const status = metaString(responseNode.meta, "status").toUpperCase();
    if (status === NA) return null;
    return status.includes("COMPLETE") || status.includes("OK") ? 1 : 0;
  }, [responseNode]);

  const brainActivityCount = useMemo(() => {
    const events = (snapshot.activity ?? []).filter((e) => {
      const blob = `${e.event_type} ${e.summary} ${e.department}`.toLowerCase();
      return (
        blob.includes("brain") ||
        blob.includes("router") ||
        blob.includes("provider") ||
        blob.includes("skill") ||
        blob.includes("gateway")
      );
    });
    return events.length > 0 ? events.length : null;
  }, [snapshot.activity]);

  const fallbacks = useMemo(() => {
    const hits = (snapshot.exceptions ?? []).filter((e) => {
      const blob = `${e.title} ${e.detail}`.toLowerCase();
      return blob.includes("fallback") || blob.includes("failover");
    });
    if (hits.length > 0) return hits.length;
    return null;
  }, [snapshot.exceptions]);

  const providerHealth = useMemo(() => {
    if (routerNode) {
      const v = metaString(routerNode.meta, "validation");
      if (v !== NA) return v;
    }
    if (providerNode) {
      const dry = providerNode.meta?.dry_run;
      if (dry === true) return "mock dry_run";
    }
    return null;
  }, [routerNode, providerNode]);

  const queueDepth = useMemo(() => {
    const related = (snapshot.exceptions ?? []).filter((e) => {
      const blob = `${e.title} ${e.detail} ${e.source}`.toLowerCase();
      return (
        blob.includes("brain") ||
        blob.includes("provider") ||
        blob.includes("router") ||
        blob.includes("skill")
      );
    }).length;
    return related;
  }, [snapshot.exceptions]);

  const pipelineStages: PipelineStage[] = useMemo(() => {
    if (nodes.length === 0) return [];

    const labels = [
      "Knowledge",
      "Snapshot",
      "Skill",
      "Brain Router",
      "Provider",
      "Structured Response",
    ];

    const blocked = (snapshot.exceptions ?? []).some(
      (e) => e.severity === "blocked" || e.severity === "fail",
    );

    const responseStatus = responseNode
      ? metaString(responseNode.meta, "status").toUpperCase()
      : "";
    const completedTail =
      responseStatus.includes("COMPLETE") || responseStatus.includes("OK");

    return labels.map((label, index) => {
      const id = `brain-stage-${index}`;
      let status: PipelineStageStatus = "idle";

      if (blocked && index >= labels.length - 2) status = "blocked";
      else if (completedTail) status = "completed";
      else if (index < nodes.length) {
        // Align with existing brain_path progress: nodes present ⇒ completed up to last
        status = index < nodes.length - 1 ? "completed" : "running";
      } else {
        status = "waiting";
      }

      // Knowledge / Snapshot from knowledge node presence
      if (label === "Knowledge" || label === "Snapshot") {
        status = knowledgeNode ? "completed" : "waiting";
      }
      if (label === "Skill") {
        status = skillNode ? "completed" : "waiting";
      }
      if (label === "Brain Router") {
        status = routerNode
          ? metaString(routerNode.meta, "validation") === "ok"
            ? "completed"
            : "running"
          : "waiting";
      }
      if (label === "Provider") {
        status = providerNode
          ? providerNode.meta?.dry_run === true
            ? "completed"
            : "running"
          : "waiting";
      }
      if (label === "Structured Response") {
        if (!responseNode) status = "waiting";
        else if (completedTail) status = "completed";
        else if (blocked) status = "blocked";
        else status = "running";
      }

      return { id, label, status };
    });
  }, [
    nodes,
    snapshot.exceptions,
    knowledgeNode,
    skillNode,
    routerNode,
    providerNode,
    responseNode,
  ]);

  const orderedPath = useMemo(() => {
    const preferred = [
      "department",
      "knowledge",
      "skill",
      "router",
      "provider",
      "response",
    ];
    const sorted = [...nodes].sort((a, b) => {
      const ia = preferred.indexOf(a.kind.toLowerCase());
      const ib = preferred.indexOf(b.kind.toLowerCase());
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    return sorted;
  }, [nodes]);

  return (
    <div className="ds-command">
      <PageHeader
        title="Brain Router"
        subtitle="Monitor provider routing and execution."
        actions={
          <ToolbarActions>
            <Badge tone="neutral">{top.mode}</Badge>
            <Badge tone="processing">{currentProvider}</Badge>
            <SecondaryButton size="sm" onClick={() => onRefresh?.()}>
              Refresh
            </SecondaryButton>
          </ToolbarActions>
        }
      />

      <InfoBanner title="Read-only router surface">
        LIVE OFF · dry_run · Mock path · no provider activation from this
        dashboard
      </InfoBanner>

      {note ? <InfoBanner title="Quick Action">{note}</InfoBanner> : null}

      <div className="ds-command-split">
        <div className="ds-command-main">
          {/* ROW 1 */}
          <PageSection title="Live Status" subtitle="Router runtime">
            <RuntimeStatusCard
              liveLabel={top.live_label}
              provider={currentProvider}
              cost={`$${top.cost_today_usd}`}
              heartbeat={top.heartbeat_age}
              queue={queueDepth}
            />
            <MetricGrid>
              <KPIStatCard
                value={currentProvider}
                label="Current Provider"
                tone="processing"
                icon="◇"
              />
              <KPIStatCard
                value={display(routerStatus)}
                label="Router Status"
                tone="approved"
                icon="▣"
              />
              <KPIStatCard
                value={display(top.mode)}
                label="Mode"
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
                value={queueDepth}
                label="Queue"
                tone="waiting"
                icon="☰"
              />
            </MetricGrid>
          </PageSection>

          {/* ROW 2 */}
          <PageSection title="KPI Grid" subtitle="Routing signals">
            <MetricGrid>
              <KPIStatCard value={currentProvider} label="Current Provider" />
              <KPIStatCard
                value={brainActivityCount == null ? NA : brainActivityCount}
                label="Requests"
              />
              <KPIStatCard
                value={
                  successfulRoutes == null ? NA : successfulRoutes
                }
                label="Successful Routes"
                tone="approved"
              />
              <KPIStatCard
                value={fallbacks == null ? NA : fallbacks}
                label="Fallbacks"
                tone="waiting"
              />
              <KPIStatCard
                value={skillsUsed == null ? NA : skillsUsed}
                label="Skills Used"
              />
              <KPIStatCard
                value={display(providerHealth)}
                label="Provider Health"
                tone="processing"
              />
            </MetricGrid>
          </PageSection>

          {/* ROW 3 */}
          <PageSection
            title="Execution Pipeline"
            subtitle="Knowledge → response path"
          >
            <SectionCard>
              {pipelineStages.length === 0 ? (
                <EmptyIllustration
                  title={NA}
                  copy="brain_path is empty — cannot derive pipeline stages."
                />
              ) : (
                <PipelineStrip stages={pipelineStages} emptyLabel={NA} />
              )}
            </SectionCard>
          </PageSection>

          {/* ROW 4 */}
          <PageSection title="Brain Path" subtitle="snapshot.brain_path nodes">
            {orderedPath.length === 0 ? (
              <EmptyIllustration
                title={NA}
                copy="No brain_path nodes in the current snapshot."
              />
            ) : (
              <MetricGrid columns={3}>
                {orderedPath.map((n) => (
                  <SectionCard key={n.id} title={n.label}>
                    <div className="ds-stack-xs">
                      <div className="ds-row-between">
                        <Badge tone="neutral">{n.kind}</Badge>
                        <SecondaryButton
                          size="sm"
                          onClick={() => onSelectNode(n.id)}
                        >
                          Inspect
                        </SecondaryButton>
                      </div>
                      {Object.keys(n.meta ?? {}).length === 0 ? (
                        <p className="muted ds-meta">{NA}</p>
                      ) : (
                        Object.entries(n.meta).map(([k, v]) => (
                          <p key={k} className="mono muted ds-meta-mono">
                            {k}: {v == null || v === "" ? NA : String(v)}
                          </p>
                        ))
                      )}
                    </div>
                  </SectionCard>
                ))}
              </MetricGrid>
            )}
          </PageSection>

          {/* ROW 5 */}
          <PageSection title="Provider Details">
            {!providerNode && !routerNode ? (
              <EmptyIllustration
                title={NA}
                copy="No provider or router node in brain_path."
              />
            ) : (
              <SectionCard title="Selected provider path">
                <MetricGrid columns={3}>
                  <KPIStatCard
                    value={
                      providerNode
                        ? metaString(providerNode.meta, "provider") !== NA
                          ? metaString(providerNode.meta, "provider")
                          : display(providerNode.label)
                        : currentProvider
                    }
                    label="Provider"
                  />
                  <KPIStatCard value={display(top.mode)} label="Mode" />
                  <KPIStatCard
                    value={
                      providerNode && "dry_run" in (providerNode.meta ?? {})
                        ? String(Boolean(providerNode.meta.dry_run))
                        : skillNode && "dry_run" in (skillNode.meta ?? {})
                          ? String(Boolean(skillNode.meta.dry_run))
                          : NA
                    }
                    label="Dry Run"
                    tone="neutral"
                  />
                  <KPIStatCard
                    value={
                      providerNode && "cost" in (providerNode.meta ?? {})
                        ? display(providerNode.meta.cost)
                        : `$${top.cost_today_usd}`
                    }
                    label="Cost"
                  />
                  <KPIStatCard
                    value={
                      providerNode
                        ? metaString(providerNode.meta, "latency_ms")
                        : NA
                    }
                    label="Latency"
                  />
                  <KPIStatCard
                    value={
                      routerNode
                        ? metaString(routerNode.meta, "validation")
                        : NA
                    }
                    label="Validation"
                  />
                </MetricGrid>
              </SectionCard>
            )}
          </PageSection>
        </div>

        {/* RIGHT SIDEBAR */}
        <aside className="ds-command-aside" aria-label="Brain quick actions">
          <PageSection title="Quick Actions" subtitle="Buttons only · no backend">
            <div className="ds-command-actions ds-command-actions-col">
              <PrimaryButton onClick={() => onNavigate?.("resume")}>
                Open Resume
              </PrimaryButton>
              <SecondaryButton
                onClick={() => onNavigate?.("provider-validation")}
              >
                Open Provider Validation
              </SecondaryButton>
              <SecondaryButton onClick={() => onNavigate?.("activity")}>
                Open Activity
              </SecondaryButton>
              <SecondaryButton onClick={() => onOpenReview?.()}>
                Open Templates Ready for Review
              </SecondaryButton>
              <SecondaryButton
                onClick={() => {
                  onRefresh?.();
                  setNote("Snapshot refresh requested via existing dashboard loader.");
                }}
              >
                Refresh Snapshot
              </SecondaryButton>
            </div>
          </PageSection>

          <SectionCard title="Router">
            <p className="mono ds-meta">{display(routerStatus)}</p>
            <p className="ds-meta">
              Provider {currentProvider} · {display(top.mode)}
            </p>
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}
