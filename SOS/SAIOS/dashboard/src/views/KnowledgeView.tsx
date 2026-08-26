import { useMemo } from "react";
import type { DashboardSnapshot } from "../data/types";
import {
  Badge,
  EmptyIllustration,
  InfoBanner,
  KPIStatCard,
  MetricGrid,
  PageHeader,
  PageSection,
  RuntimeStatusCard,
  SecondaryButton,
  SectionCard,
  TimelineCard,
  ToolbarActions,
} from "../design-system";
import { NA, display, formatWhen, healthTone } from "../lib/display";

type Props = {
  snapshot: DashboardSnapshot;
  onSelectSnapshot: () => void;
  onRefresh?: () => void;
};

export function KnowledgeView({
  snapshot,
  onSelectSnapshot,
  onRefresh,
}: Props) {
  const domains = snapshot.knowledge_domains ?? [];
  const ks = snapshot.knowledge_snapshot;
  const top = snapshot.top_bar;

  const entryTotal = useMemo(() => {
    const nums = domains
      .map((d) => d.entry_count)
      .filter((n): n is number => n != null && Number.isFinite(n));
    if (nums.length === 0) return null;
    return nums.reduce((a, b) => a + b, 0);
  }, [domains]);

  const ownershipKnown = useMemo(() => {
    if (domains.length === 0) return null;
    return domains.filter(
      (d) => d.owner && d.owner !== "unknown" && d.owner.trim() !== "",
    ).length;
  }, [domains]);

  const lastDomainUpdate = useMemo(() => {
    const times = domains
      .map((d) => d.last_update)
      .filter((x): x is string => Boolean(x));
    if (times.length === 0) return null;
    const sorted = [...times].sort(
      (a, b) => (Date.parse(b) || 0) - (Date.parse(a) || 0),
    );
    return sorted[0] ?? null;
  }, [domains]);

  const knowledgeHealth = useMemo(() => {
    if (domains.length === 0) return null;
    if (domains.every((d) => d.health === "healthy")) return "healthy";
    if (domains.some((d) => d.health === "blocked" || d.health === "fail")) {
      return "blocked";
    }
    if (domains.some((d) => d.health === "degraded")) return "degraded";
    return domains[0]?.health ?? null;
  }, [domains]);

  const knowledgeEvents = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      timestamp: string;
      body?: string;
      severity: "ok" | "warn" | "error" | "info";
    }> = [];

    for (const e of snapshot.activity ?? []) {
      const blob = `${e.event_type} ${e.summary} ${e.department}`.toLowerCase();
      const isKnowledge =
        blob.includes("knowledge") ||
        blob.includes("snapshot") ||
        blob.includes("domain") ||
        blob.includes("learning") ||
        blob.includes("write-back") ||
        blob.includes("writeback");
      if (!isKnowledge) continue;
      items.push({
        id: e.id,
        title: e.summary || e.event_type,
        timestamp: formatWhen(e.timestamp),
        body: `${e.event_type} · ${e.department} · ${e.status}`,
        severity:
          e.status === "fail" || e.status === "blocked"
            ? "error"
            : e.status === "degraded" || e.status === "waiting"
              ? "warn"
              : "ok",
      });
    }

    for (const ex of snapshot.exceptions ?? []) {
      const blob = `${ex.title} ${ex.detail} ${ex.source}`.toLowerCase();
      if (!blob.includes("knowledge") && !blob.includes("snapshot")) continue;
      items.push({
        id: `ex-${ex.id}`,
        title: ex.title,
        timestamp: NA,
        body: ex.detail,
        severity: ex.severity === "fail" || ex.severity === "blocked" ? "error" : "warn",
      });
    }

    if (ks.available && ks.snapshot_id) {
      const already = items.some((i) =>
        i.title.toLowerCase().includes("snapshot"),
      );
      if (!already) {
        items.unshift({
          id: "snap-loaded",
          title: "Snapshot loaded",
          timestamp: formatWhen(snapshot.last_refreshed),
          body: `snapshot_id=${ks.snapshot_id}`,
          severity: "ok",
        });
      }
    }

    return items.slice(0, 12);
  }, [snapshot.activity, snapshot.exceptions, snapshot.last_refreshed, ks]);

  const recentDomainUpdates = useMemo(() => {
    if (domains.length === 0) return null;
    return domains.filter((d) => Boolean(d.last_update)).length;
  }, [domains]);

  return (
    <div className="ds-command">
      <PageHeader
        title="Knowledge System"
        subtitle="Manage snapshots, domains, ownership and retrieval."
        actions={
          <ToolbarActions>
            <Badge tone={ks.available ? "approved" : "blocked"}>
              {ks.available ? "snapshot available" : "snapshot unavailable"}
            </Badge>
            <SecondaryButton size="sm" onClick={() => onRefresh?.()}>
              Refresh
            </SecondaryButton>
            <SecondaryButton size="sm" onClick={onSelectSnapshot}>
              Open Snapshot
            </SecondaryButton>
          </ToolbarActions>
        }
      />

      <InfoBanner title="Scoped retrieval">
        LIVE OFF · dry_run · Secrets never displayed · read-only dashboard
      </InfoBanner>

      <div className="ds-command-main">
        {/* ROW 1 */}
        <PageSection title="Live Status" subtitle="Knowledge runtime">
          <RuntimeStatusCard
            liveLabel={top.live_label}
            provider={top.provider}
            cost={`$${top.cost_today_usd}`}
            heartbeat={top.heartbeat_age}
            queue={domains.length}
          />
          <MetricGrid>
            <KPIStatCard
              value={display(knowledgeHealth)}
              label="Knowledge Health"
              tone={healthTone(knowledgeHealth ?? "")}
              icon="▣"
            />
            <KPIStatCard
              value={ks.available ? "available" : "unavailable"}
              label="Snapshot Status"
              tone={ks.available ? "approved" : "blocked"}
              icon="◎"
            />
            <KPIStatCard
              value={domains.length > 0 ? domains.length : NA}
              label="Domains"
              tone="processing"
              icon="▦"
            />
            <KPIStatCard
              value={
                ks.references.length > 0 ? ks.references.length : NA
              }
              label="References"
              tone="neutral"
              icon="◇"
            />
            <KPIStatCard
              value={formatWhen(snapshot.last_refreshed)}
              label="Last Refresh"
              tone="neutral"
              icon="◷"
            />
          </MetricGrid>
        </PageSection>

        {/* ROW 2 */}
        <PageSection title="KPI Grid" subtitle="Knowledge inventory">
          <MetricGrid>
            <KPIStatCard
              value={domains.length > 0 ? domains.length : NA}
              label="Knowledge Domains"
            />
            <KPIStatCard
              value={entryTotal == null ? NA : entryTotal}
              label="Entries"
            />
            <KPIStatCard
              value={ks.available ? 1 : 0}
              label="Snapshots"
              tone={ks.available ? "approved" : "waiting"}
              delta={display(ks.snapshot_id)}
            />
            <KPIStatCard
              value={
                ks.references.length > 0 ? ks.references.length : NA
              }
              label="References"
            />
            <KPIStatCard
              value={
                ownershipKnown == null
                  ? NA
                  : `${ownershipKnown}/${domains.length}`
              }
              label="Ownership"
            />
            <KPIStatCard
              value={
                recentDomainUpdates == null ? NA : recentDomainUpdates
              }
              label="Recent Updates"
            />
          </MetricGrid>
        </PageSection>

        {/* ROW 3 */}
        <PageSection title="Knowledge Snapshot">
          <SectionCard title="Current snapshot">
            <MetricGrid columns={3}>
              <KPIStatCard
                value={display(ks.snapshot_id)}
                label="Snapshot ID"
              />
              <KPIStatCard
                value={String(ks.available)}
                label="Available"
                tone={ks.available ? "approved" : "blocked"}
              />
              <KPIStatCard
                value={
                  ks.domains.length
                    ? ks.domains.join(", ")
                    : NA
                }
                label="Domains"
              />
              <KPIStatCard
                value={
                  ks.references.length > 0
                    ? ks.references.length
                    : NA
                }
                label="References"
                delta={
                  ks.references.length
                    ? ks.references.slice(0, 2).join(" · ")
                    : undefined
                }
              />
              <KPIStatCard
                value={entryTotal == null ? NA : entryTotal}
                label="Entry Count"
              />
              <KPIStatCard
                value={formatWhen(snapshot.generated_at)}
                label="Created"
              />
              <KPIStatCard
                value={
                  formatWhen(lastDomainUpdate) !== NA
                    ? formatWhen(lastDomainUpdate)
                    : formatWhen(snapshot.last_refreshed)
                }
                label="Last Updated"
              />
            </MetricGrid>
          </SectionCard>
        </PageSection>

        {/* ROW 4 */}
        <PageSection title="Knowledge Domains" subtitle="Ownership and access">
          {domains.length === 0 ? (
            <EmptyIllustration
              title={NA}
              copy="knowledge_domains is empty in the current snapshot."
            />
          ) : (
            <MetricGrid columns={3}>
              {domains.map((d) => (
                <SectionCard key={d.id} title={d.id}>
                  <div className="ds-stack-xs">
                    <div className="ds-row-between">
                      <Badge tone={healthTone(d.health)}>{d.health}</Badge>
                      <span className="muted mono ds-meta-mono">
                        entries {display(d.entry_count)}
                      </span>
                    </div>
                    <p className="mono ds-meta">Owner: {display(d.owner)}</p>
                    <p className="mono muted ds-meta-mono">
                      Read: {display(d.read)}
                    </p>
                    <p className="mono muted ds-meta-mono">
                      Write: {display(d.write)}
                    </p>
                    <p className="muted ds-meta-mono">
                      Last update: {formatWhen(d.last_update)}
                    </p>
                  </div>
                </SectionCard>
              ))}
            </MetricGrid>
          )}
        </PageSection>

        {/* ROW 5 */}
        <PageSection
          title="Recent Knowledge Events"
          subtitle="Snapshots, domains, learning write-backs"
        >
          {knowledgeEvents.length === 0 ? (
            <EmptyIllustration
              title={NA}
              copy="No knowledge-related activity or exceptions in the snapshot."
            />
          ) : (
            <TimelineCard
              title="Knowledge timeline"
              items={knowledgeEvents.map((e) => ({
                id: e.id,
                title: e.title,
                timestamp: e.timestamp,
                body: e.body,
                icon: "✧",
                severity: e.severity,
              }))}
            />
          )}
        </PageSection>
      </div>
    </div>
  );
}
