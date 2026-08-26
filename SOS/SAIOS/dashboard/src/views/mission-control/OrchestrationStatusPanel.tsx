/**
 * Mission Control Orchestration Status — Agent #226.
 * Read-only surface for System Orchestrator. No redesign of Mission Control.
 */
import { useCallback, useEffect, useState } from "react";
import { Badge, EmptyIllustration, SecondaryButton } from "../../design-system";
import { McSectionHeader, StatusCard } from "./components";

type LifecycleStage = string;
type OrchestrationEventType = string;

type OrchestrationEvent = {
  event_id: string;
  event_type: OrchestrationEventType;
  timestamp: string;
  trigger: string;
  current_stage: LifecycleStage;
  execution_path: string;
  delegated_subsystem: string | null;
  result: string;
  detail: string;
  duration_ms: number;
};

type OrchestrationState = {
  current_lifecycle_stage: LifecycleStage;
  current_orchestration_event: OrchestrationEventType | null;
  current_execution_path: string;
  last_orchestration_event: OrchestrationEvent | null;
  last_completed_lifecycle: LifecycleStage | null;
  last_execution_id: string | null;
  last_stop_reason: string | null;
};

type OrchestrationSurface = {
  state: OrchestrationState;
  recent_events: OrchestrationEvent[];
  live: boolean;
  publication_allowed: boolean;
  production_entry: string;
  coordination_only: boolean;
};

export function OrchestrationStatusPanel() {
  const [surface, setSurface] = useState<OrchestrationSurface | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/system-orchestrator", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as OrchestrationSurface;
      setSurface(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 15_000);
    return () => clearInterval(t);
  }, [load]);

  const st = surface?.state;
  const last = st?.last_orchestration_event;

  return (
    <section className="mc-row-block" aria-label="System orchestration">
      <McSectionHeader
        title="System Orchestration"
        subtitle="Coordination lifecycle — System Orchestrator owns coordination only"
      />

      <div className="mc-row mc-row-5" style={{ marginBottom: 16 }}>
        <StatusCard
          label="Current lifecycle stage"
          value={st?.current_lifecycle_stage ?? "idle"}
          freshness="current"
          detail="coordination stage"
          tone="neutral"
        />
        <StatusCard
          label="Current orchestration event"
          value={st?.current_orchestration_event ?? "—"}
          freshness="current"
          detail="latest event type"
          tone="processing"
        />
        <StatusCard
          label="Current execution path"
          value={
            st?.current_execution_path
              ? st.current_execution_path.split("→").slice(-2).join("→")
              : "—"
          }
          freshness="current"
          detail={st?.current_execution_path ?? "no path"}
          tone="neutral"
        />
        <StatusCard
          label="Last orchestration event"
          value={last?.event_type ?? "—"}
          freshness="current"
          detail={last?.timestamp ?? "none"}
          tone="neutral"
        />
        <StatusCard
          label="Last completed lifecycle"
          value={st?.last_completed_lifecycle ?? "—"}
          freshness="current"
          detail={
            st?.last_stop_reason
              ? `stop ${st.last_stop_reason}`
              : st?.last_execution_id ?? "—"
          }
          tone="approved"
        />
      </div>

      {error ? (
        <p className="mc-card-detail muted" style={{ marginBottom: 12 }}>
          Orchestration surface error: {error}
        </p>
      ) : null}

      <article className="mc-card">
        <div className="mc-card-top" style={{ marginBottom: 12 }}>
          <span className="mc-card-label">Orchestration Event History</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Badge tone="waiting">Coordination Only</Badge>
            <SecondaryButton size="sm" onClick={() => void load()}>
              Refresh
            </SecondaryButton>
          </div>
        </div>
        {!surface?.recent_events?.length ? (
          <EmptyIllustration
            title="No orchestration events"
            copy="Lifecycle events appear after startup, founder runs, or refreshes."
          />
        ) : (
          <ul className="mc-faa-history">
            {surface.recent_events.slice(0, 10).map((e) => (
              <li key={e.event_id} className="mc-faa-history-item">
                <div className="mc-faa-history-row">
                  <Badge tone="processing">{e.event_type}</Badge>
                  <span className="mono mc-faa-type">{e.current_stage}</span>
                  <span className="muted mono">{e.duration_ms}ms</span>
                </div>
                <p className="mc-card-detail muted">
                  {e.timestamp} · {e.delegated_subsystem ?? "n/a"} · {e.detail}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="mc-card-detail muted" style={{ marginTop: 12 }}>
          Production entry: {surface?.production_entry ?? "ProductionController"}{" "}
          · LIVE {surface?.live ? "ON" : "OFF"} · publication_allowed{" "}
          {String(surface?.publication_allowed ?? false)} · coordination_only{" "}
          {String(surface?.coordination_only ?? true)}
        </p>
      </article>
    </section>
  );
}
