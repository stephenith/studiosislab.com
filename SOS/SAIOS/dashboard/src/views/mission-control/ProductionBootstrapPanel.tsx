/**
 * Mission Control Production Bootstrap panel — Agent #229.
 * Preparation surface only. No redesign of Mission Control.
 */
import { useCallback, useEffect, useState } from "react";
import { Badge, EmptyIllustration, SecondaryButton } from "../../design-system";
import { McSectionHeader, StatusCard } from "./components";

type BootstrapReport = {
  bootstrap_id: string;
  timestamp: string;
  duration_ms: number;
  overall_status: string;
  readiness: string;
  passed: number;
  failed: number;
  warnings: number;
  pending_prerequisites: string[];
  readiness_evidence: string[];
  report_path: string;
};

type BootstrapSurface = {
  last_bootstrap: BootstrapReport | null;
  bootstrap_status: string;
  bootstrap_time: string | null;
  bootstrap_duration_ms: number | null;
  readiness_result: string;
  pending_prerequisites: string[];
  recent_bootstraps: Array<{
    bootstrap_id: string;
    timestamp: string;
    readiness: string;
    overall_status: string;
  }>;
  live: boolean;
  publication_allowed: boolean;
  founder_approval_required: boolean;
};

function readinessTone(
  s: string,
): "neutral" | "approved" | "waiting" | "rejected" | "processing" {
  if (s === "READY") return "approved";
  if (s === "NOT_READY") return "rejected";
  return "neutral";
}

export function ProductionBootstrapPanel() {
  const [surface, setSurface] = useState<BootstrapSurface | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/production-bootstrap", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as BootstrapSurface;
      setSurface(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [load]);

  const runBootstrap = async () => {
    if (running) return;
    setRunning(true);
    try {
      const res = await fetch("/api/production-bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bootstrap: true }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  const last = surface?.last_bootstrap;
  const readiness = surface?.readiness_result ?? "NONE";
  const pending = surface?.pending_prerequisites ?? [];

  return (
    <section className="mc-row-block" aria-label="Production bootstrap">
      <McSectionHeader
        title="Production Bootstrap"
        subtitle="First production initialization — prepares only, never executes"
      />

      <div className="mc-row mc-row-5" style={{ marginBottom: 16 }}>
        <StatusCard
          label="Bootstrap Status"
          value={surface?.bootstrap_status ?? "NONE"}
          freshness="current"
          detail={last?.bootstrap_id ?? "no run"}
          tone={
            surface?.bootstrap_status === "PASS" ||
            surface?.bootstrap_status === "PASS_WITH_WARNINGS"
              ? "approved"
              : surface?.bootstrap_status === "FAIL"
                ? "rejected"
                : "neutral"
          }
        />
        <StatusCard
          label="Bootstrap Time"
          value={
            surface?.bootstrap_time
              ? new Date(surface.bootstrap_time).toLocaleString()
              : "—"
          }
          freshness="current"
          detail="last run"
          tone="neutral"
        />
        <StatusCard
          label="Bootstrap Duration"
          value={
            surface?.bootstrap_duration_ms != null
              ? `${surface.bootstrap_duration_ms}ms`
              : "—"
          }
          freshness="current"
          detail={
            last ? `${last.passed} passed / ${last.failed} failed` : "—"
          }
          tone="neutral"
        />
        <StatusCard
          label="Readiness Result"
          value={readiness}
          freshness="current"
          detail={
            surface?.founder_approval_required
              ? "Founder approval required"
              : "—"
          }
          tone={readinessTone(readiness)}
        />
        <StatusCard
          label="Pending Prerequisites"
          value={String(pending.length)}
          freshness="current"
          detail={pending.slice(0, 2).join(", ") || "none"}
          tone={pending.length > 0 ? "waiting" : "approved"}
        />
      </div>

      {error ? (
        <p className="mc-card-detail muted" style={{ marginBottom: 12 }}>
          Bootstrap surface error: {error}
        </p>
      ) : null}

      <article className="mc-card">
        <div className="mc-card-top" style={{ marginBottom: 12 }}>
          <span className="mc-card-label">Latest Bootstrap Report</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Badge tone="waiting">Prepare Only</Badge>
            <SecondaryButton size="sm" onClick={() => void load()}>
              Refresh
            </SecondaryButton>
            <SecondaryButton
              size="sm"
              disabled={running}
              onClick={() => void runBootstrap()}
            >
              {running ? "Bootstrapping…" : "Run Bootstrap"}
            </SecondaryButton>
          </div>
        </div>

        {!last ? (
          <EmptyIllustration
            title="No bootstrap yet"
            copy="Run Production Bootstrap to validate prerequisites for the first supervised cycle."
          />
        ) : (
          <div>
            <p className="mc-card-detail">
              <span className="mono">{last.report_path}</span>
            </p>
            <p className="mc-card-detail muted" style={{ marginTop: 8 }}>
              {last.readiness} · {last.overall_status} · {last.passed} passed ·{" "}
              {last.failed} failed · {last.warnings} warnings
            </p>
            {last.readiness_evidence?.length ? (
              <ul className="mc-faa-history" style={{ marginTop: 12 }}>
                {last.readiness_evidence.slice(0, 6).map((e) => (
                  <li key={e} className="mc-faa-history-item">
                    <span className="mc-card-detail muted">{e}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {pending.length > 0 ? (
              <div style={{ marginTop: 12 }}>
                <p className="mc-card-label">Pending prerequisites</p>
                <ul className="mc-faa-history">
                  {pending.map((p) => (
                    <li key={p} className="mc-faa-history-item">
                      <Badge tone="waiting">PENDING</Badge>{" "}
                      <span className="mono mc-faa-type">{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
        <p className="mc-card-detail muted" style={{ marginTop: 12 }}>
          LIVE {surface?.live ? "ON" : "OFF"} · publication_allowed{" "}
          {String(surface?.publication_allowed ?? false)} · never executes
          production · Founder approval required before first cycle
        </p>
      </article>
    </section>
  );
}
