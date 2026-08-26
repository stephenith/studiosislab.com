/**
 * Mission Control Founder Action Adapters panel — Agent #225.
 * Safe action buttons. Validates → delegates via adapters. No business logic here.
 */
import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  EmptyIllustration,
  PrimaryButton,
  SecondaryButton,
} from "../../design-system";
import { McSectionHeader, StatusCard } from "./components";

type ActionOutcome = "Success" | "Failure" | "Warning" | "Rejected";
type ExecutionStatus =
  | "Idle"
  | "Running"
  | "Completed"
  | "Failed"
  | "Busy"
  | "Disabled";

type FounderActionAudit = {
  action_id: string;
  timestamp: string;
  action_type: string;
  result: ActionOutcome;
  reason: string;
  delegated_to: string | null;
  duration_ms: number;
  target_subsystem: string;
};

type ActionSurface = {
  execution_status: ExecutionStatus;
  recent_actions: FounderActionAudit[];
  in_flight: string | null;
  scheduling_preference: { adaptive_enabled: boolean };
  live: boolean;
  publication_allowed: boolean;
  founder_approval_required: boolean;
  production_entry: string;
};

type ActionResult = {
  outcome: ActionOutcome;
  reason: string;
  execution_status: ExecutionStatus;
  action: FounderActionAudit;
};

const ACTION_GROUPS: Array<{
  title: string;
  actions: Array<{ type: string; label: string; danger?: boolean }>;
}> = [
  {
    title: "Production",
    actions: [
      { type: "production.start", label: "Start" },
      { type: "production.pause", label: "Pause" },
      { type: "production.resume", label: "Resume" },
      { type: "production.stop", label: "Stop", danger: true },
      { type: "production.run_single_cycle", label: "Run Single Cycle" },
      { type: "production.retry_failed_cycle", label: "Retry Failed Cycle" },
    ],
  },
  {
    title: "Scheduling",
    actions: [
      { type: "scheduling.enable", label: "Enable Adaptive" },
      { type: "scheduling.disable", label: "Disable Adaptive" },
      { type: "scheduling.trigger_run", label: "Trigger Scheduled Run" },
    ],
  },
  {
    title: "Intelligence",
    actions: [
      { type: "portfolio.refresh", label: "Refresh Portfolio" },
      { type: "strategy.refresh", label: "Refresh Strategy" },
      { type: "engineering.refresh", label: "Refresh Engineering" },
    ],
  },
  {
    title: "Operations",
    actions: [
      { type: "operations.refresh_dashboard", label: "Refresh Dashboard" },
      {
        type: "operations.refresh_fcc_snapshot",
        label: "Refresh Command Center",
      },
    ],
  },
];

function toneForStatus(
  s: ExecutionStatus,
): "neutral" | "approved" | "waiting" | "rejected" | "processing" {
  if (s === "Running" || s === "Busy") return "processing";
  if (s === "Completed") return "approved";
  if (s === "Failed") return "rejected";
  if (s === "Disabled") return "waiting";
  return "neutral";
}

function outcomeTone(
  o: ActionOutcome,
): "neutral" | "approved" | "waiting" | "rejected" | "processing" {
  if (o === "Success") return "approved";
  if (o === "Warning") return "waiting";
  if (o === "Failure" || o === "Rejected") return "rejected";
  return "neutral";
}

export function FounderActionsPanel({
  onActionComplete,
}: {
  onActionComplete?: () => void;
}) {
  const [surface, setSurface] = useState<ActionSurface | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [latest, setLatest] = useState<ActionResult | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/founder-actions", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ActionSurface;
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

  const runAction = async (action_type: string) => {
    if (pending) return;
    setPending(action_type);
    try {
      const res = await fetch("/api/founder-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action_type,
          requested_by: "founder",
        }),
      });
      const data = (await res.json()) as ActionResult & { error?: string };
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
      } else {
        setLatest(data);
        setError(null);
      }
      await load();
      onActionComplete?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(null);
    }
  };

  const status = surface?.execution_status ?? "Idle";
  const busy = Boolean(pending || surface?.in_flight);

  return (
    <section className="mc-row-block" aria-label="Founder actions">
      <McSectionHeader
        title="Founder Actions"
        subtitle="Safe adapters — validate, authorize, delegate, audit"
      />

      <div className="mc-row mc-row-4" style={{ marginBottom: 16 }}>
        <StatusCard
          label="Execution Status"
          value={status}
          freshness="current"
          detail={
            surface?.in_flight
              ? `in flight ${surface.in_flight}`
              : surface?.production_entry ?? "—"
          }
          tone={toneForStatus(status)}
        />
        <StatusCard
          label="Running Task"
          value={pending ?? surface?.in_flight ?? "None"}
          freshness="current"
          detail="adapter lock"
          tone={busy ? "processing" : "neutral"}
        />
        <StatusCard
          label="Adaptive Scheduling"
          value={
            surface?.scheduling_preference.adaptive_enabled ? "Enabled" : "Disabled"
          }
          freshness="current"
          detail="preference only"
          tone="neutral"
        />
        <StatusCard
          label="Latest Result"
          value={latest?.outcome ?? surface?.recent_actions[0]?.result ?? "—"}
          freshness="current"
          detail={
            latest?.action.action_type ??
            surface?.recent_actions[0]?.action_type ??
            "no actions yet"
          }
          tone={
            latest
              ? outcomeTone(latest.outcome)
              : surface?.recent_actions[0]
                ? outcomeTone(surface.recent_actions[0].result)
                : "neutral"
          }
        />
      </div>

      {error ? (
        <p className="mc-card-detail muted" style={{ marginBottom: 12 }}>
          Action surface error: {error}
        </p>
      ) : null}

      <div className="mc-faa-groups">
        {ACTION_GROUPS.map((group) => (
          <article key={group.title} className="mc-card mc-faa-group">
            <div className="mc-card-top">
              <span className="mc-card-label">{group.title}</span>
              <Badge tone="waiting">Founder Approval</Badge>
            </div>
            <div className="mc-faa-buttons">
              {group.actions.map((a) => {
                const isPending = pending === a.type;
                const disabled = busy && !isPending;
                return a.danger ? (
                  <SecondaryButton
                    key={a.type}
                    size="sm"
                    disabled={disabled || Boolean(pending)}
                    onClick={() => void runAction(a.type)}
                  >
                    {isPending ? "Running…" : a.label}
                  </SecondaryButton>
                ) : (
                  <PrimaryButton
                    key={a.type}
                    size="sm"
                    disabled={disabled || Boolean(pending)}
                    onClick={() => void runAction(a.type)}
                  >
                    {isPending ? "Running…" : a.label}
                  </PrimaryButton>
                );
              })}
            </div>
          </article>
        ))}
      </div>

      <article className="mc-card" style={{ marginTop: 16 }}>
        <div className="mc-card-top" style={{ marginBottom: 12 }}>
          <span className="mc-card-label">Recent Actions / Action History</span>
          <SecondaryButton size="sm" onClick={() => void load()}>
            Refresh History
          </SecondaryButton>
        </div>
        {!surface?.recent_actions?.length ? (
          <EmptyIllustration
            title="No actions yet"
            copy="Founder actions will appear here after the first adapter call."
          />
        ) : (
          <ul className="mc-faa-history">
            {surface.recent_actions.slice(0, 12).map((a) => (
              <li key={a.action_id} className="mc-faa-history-item">
                <div className="mc-faa-history-row">
                  <Badge tone={outcomeTone(a.result)}>{a.result}</Badge>
                  <span className="mono mc-faa-type">{a.action_type}</span>
                  <span className="muted mono">{a.duration_ms}ms</span>
                </div>
                <p className="mc-card-detail muted">
                  {a.timestamp} · {a.delegated_to ?? "not delegated"} · {a.reason}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="mc-card-detail muted" style={{ marginTop: 12 }}>
          Adapters never own production · Entry:{" "}
          {surface?.production_entry ?? "ProductionController"} · LIVE{" "}
          {surface?.live ? "ON" : "OFF"} · publication_allowed{" "}
          {String(surface?.publication_allowed ?? false)}
        </p>
      </article>
    </section>
  );
}
