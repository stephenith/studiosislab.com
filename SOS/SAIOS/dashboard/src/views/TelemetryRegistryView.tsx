/**
 * Telemetry Registry — Agent #183.
 * Contracts only. No collection. No emission.
 */
import { useCallback, useEffect, useState } from "react";
import type { DashboardSnapshot } from "../data/types";
import {
  AlertBanner,
  Badge,
  EmptyIllustration,
  KPIStatCard,
  MetricGrid,
  PageHeader,
  PageSection,
  SecondaryButton,
  SectionCard,
} from "../design-system";

type Props = {
  snapshot: DashboardSnapshot;
  onBack: () => void;
  onRefresh: () => void | Promise<void>;
};

type SessionRow = {
  telemetry_session_id: string;
  mission_id: string;
  status: string;
  correlation_id: string | null;
  timeline_id: string | null;
  worker_runtime_id: string | null;
  cost_session_id: string | null;
};

type EventRow = {
  event_kind: string;
  description: string;
  emitted: boolean;
};

type Payload = {
  sessions: SessionRow[];
  timelines: Array<{ timeline_id: string; ordered_event_kinds: string[] }>;
  correlations: Array<{
    correlation_id: string;
    mission_id: string | null;
    execution_controller_id: string | null;
    linked_at_runtime: boolean;
  }>;
  snapshots: Array<{
    snapshot_id: string;
    session_id: string;
    collected: boolean;
    warnings: string[];
  }>;
};

export function TelemetryRegistryView({
  snapshot,
  onBack,
  onRefresh,
}: Props) {
  const [data, setData] = useState<Payload | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [res, ev] = await Promise.all([
        fetch("/api/platform/telemetry", { cache: "no-store" }),
        fetch("/api/platform/telemetry/events", { cache: "no-store" }),
      ]);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (!ev.ok) throw new Error(`events HTTP ${ev.status}`);
      setData((await res.json()) as Payload);
      const body = (await ev.json()) as { events: EventRow[] };
      setEvents(body.events ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const tr = snapshot.company_brain?.telemetry_registry;
  const sessions = data?.sessions ?? [];

  return (
    <div className="ds-stack">
      <PageHeader
        title="Telemetry Registry"
        subtitle="Observability contracts only · no collection · no emission · LIVE OFF"
        actions={
          <SecondaryButton
            size="sm"
            onClick={() => {
              void onRefresh();
              void load();
            }}
          >
            Refresh
          </SecondaryButton>
        }
      />

      <AlertBanner tone="warn" title="NO EVENTS">
        emission_allowed=false · catalogue metadata only
      </AlertBanner>
      <AlertBanner tone="warn" title="NO COLLECTION">
        collection_allowed=false · no metrics gathered
      </AlertBanner>
      <AlertBanner tone="warn" title="EXECUTION DISABLED">
        execution_allowed=false
      </AlertBanner>
      <AlertBanner tone="warn" title="LIVE OFF">
        live_enabled=false
      </AlertBanner>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <SecondaryButton size="sm" onClick={onBack}>
          Back to Mission Control
        </SecondaryButton>
      </div>

      {error && !data ? (
        <EmptyIllustration title="Failed to load telemetry" copy={error} />
      ) : (
        <>
          <MetricGrid columns={4}>
            <KPIStatCard
              value={String(sessions.length || tr?.session_count || 0)}
              label="Sessions"
              tone="neutral"
            />
            <KPIStatCard
              value={String(
                data?.timelines?.length || tr?.timeline_count || 0,
              )}
              label="Timelines"
              tone="neutral"
            />
            <KPIStatCard
              value={String(
                data?.correlations?.length || tr?.correlation_count || 0,
              )}
              label="Correlations"
              tone="neutral"
            />
            <KPIStatCard
              value={String(events.length || tr?.event_catalogue_count || 0)}
              label="Event Catalogue"
              tone="neutral"
            />
          </MetricGrid>

          <PageSection title="Sessions">
            <SectionCard>
              <div className="ds-stack" style={{ gap: 8 }}>
                {sessions.map((s) => (
                  <div key={s.telemetry_session_id} className="ds-row-between">
                    <span>
                      <strong>{s.telemetry_session_id}</strong>{" "}
                      <Badge>{s.status}</Badge>
                    </span>
                    <span className="ds-meta">
                      mission={s.mission_id} · corr={s.correlation_id ?? "—"} ·
                      wr={s.worker_runtime_id ?? "—"} · cost=
                      {s.cost_session_id ?? "—"}
                    </span>
                  </div>
                ))}
                {!sessions.length ? (
                  <p className="ds-meta">No sessions.</p>
                ) : null}
              </div>
            </SectionCard>
          </PageSection>

          <PageSection title="Correlations">
            <SectionCard>
              {(data?.correlations ?? []).map((c) => (
                <p key={c.correlation_id} className="ds-meta">
                  {c.correlation_id} · mission={c.mission_id ?? "—"} · XC=
                  {c.execution_controller_id ?? "—"} · linked_at_runtime=
                  {String(c.linked_at_runtime)}
                </p>
              ))}
            </SectionCard>
          </PageSection>

          <PageSection title="Timelines">
            <SectionCard>
              {(data?.timelines ?? []).map((t) => (
                <p key={t.timeline_id} className="ds-meta">
                  {t.timeline_id} · {t.ordered_event_kinds?.join(" → ")}
                </p>
              ))}
            </SectionCard>
          </PageSection>

          <PageSection title="Snapshots">
            <SectionCard>
              {(data?.snapshots ?? []).map((s) => (
                <p key={s.snapshot_id} className="ds-meta">
                  {s.snapshot_id} · session={s.session_id} · collected=
                  {String(s.collected)} · warnings=
                  {(s.warnings ?? []).join("; ")}
                </p>
              ))}
            </SectionCard>
          </PageSection>

          <PageSection title="Event Catalogue">
            <SectionCard>
              {events.map((e) => (
                <p key={e.event_kind} className="ds-meta">
                  {e.event_kind} — {e.description} · emitted=
                  {String(e.emitted)}
                </p>
              ))}
            </SectionCard>
          </PageSection>
        </>
      )}
    </div>
  );
}
