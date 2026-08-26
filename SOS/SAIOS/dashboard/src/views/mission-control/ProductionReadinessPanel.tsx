/**
 * Mission Control Production Readiness panel — Agent #228.
 * Read-only audit surface. No redesign of Mission Control.
 */
import { useCallback, useEffect, useState } from "react";
import { Badge, EmptyIllustration, SecondaryButton } from "../../design-system";
import { McSectionHeader, StatusCard } from "./components";

type ReadinessScores = {
  overall: number;
  architecture: number;
  governance: number;
  production: number;
  engineering: number;
  verification: number;
};

type ReadinessBlocker = {
  blocker_id: string;
  severity: string;
  description: string;
  launch_blocking: boolean;
};

type ReadinessReport = {
  audit_id: string;
  timestamp: string;
  scores: ReadinessScores;
  launch_recommendation: string;
  highest_blocker_level: string;
  blockers: ReadinessBlocker[];
  blocker_counts: { critical: number; high: number; medium: number; low: number };
  report_path: string;
  launch_rationale: string;
};

type ReadinessSurface = {
  last_audit: ReadinessReport | null;
  overall_readiness: number | null;
  launch_recommendation: string;
  critical_blockers: number;
  high_blockers: number;
  latest_audit_id: string | null;
  audit_age_minutes: number | null;
  recent_audits: Array<{
    audit_id: string;
    timestamp: string;
    overall: number;
    launch_recommendation: string;
  }>;
  live: boolean;
  publication_allowed: boolean;
};

function launchTone(
  s: string,
): "neutral" | "approved" | "waiting" | "rejected" | "processing" {
  if (s === "READY_FOR_STAGING") return "approved";
  if (s === "READY_WITH_MINOR_ACTIONS") return "waiting";
  if (s === "NOT_READY") return "rejected";
  return "neutral";
}

export function ProductionReadinessPanel() {
  const [surface, setSurface] = useState<ReadinessSurface | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/production-readiness", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ReadinessSurface;
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

  const runAudit = async () => {
    if (running) return;
    setRunning(true);
    try {
      const res = await fetch("/api/production-readiness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audit: true }),
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

  const last = surface?.last_audit;
  const launch = surface?.launch_recommendation ?? "NONE";
  const critical = last?.blockers.filter((b) => b.severity === "CRITICAL") ?? [];
  const high = last?.blockers.filter((b) => b.severity === "HIGH") ?? [];

  return (
    <section className="mc-row-block" aria-label="Production readiness">
      <McSectionHeader
        title="Production Readiness"
        subtitle="Independent release certification — audit only, never executes production"
      />

      <div className="mc-row mc-row-5" style={{ marginBottom: 16 }}>
        <StatusCard
          label="Overall Readiness"
          value={
            surface?.overall_readiness != null
              ? `${surface.overall_readiness}`
              : "—"
          }
          freshness="current"
          detail={last ? `audit ${last.audit_id}` : "no audit"}
          tone={
            (surface?.overall_readiness ?? 0) >= 90
              ? "approved"
              : (surface?.overall_readiness ?? 0) >= 70
                ? "waiting"
                : "rejected"
          }
        />
        <StatusCard
          label="Launch Recommendation"
          value={launch}
          freshness="current"
          detail={last?.highest_blocker_level ?? "—"}
          tone={launchTone(launch)}
        />
        <StatusCard
          label="Critical Blockers"
          value={String(surface?.critical_blockers ?? 0)}
          freshness="current"
          detail={critical[0]?.blocker_id ?? "none"}
          tone={(surface?.critical_blockers ?? 0) > 0 ? "rejected" : "approved"}
        />
        <StatusCard
          label="High Blockers"
          value={String(surface?.high_blockers ?? 0)}
          freshness="current"
          detail={high[0]?.blocker_id ?? "none"}
          tone={(surface?.high_blockers ?? 0) > 0 ? "rejected" : "approved"}
        />
        <StatusCard
          label="Audit Age"
          value={
            surface?.audit_age_minutes != null
              ? `${surface.audit_age_minutes}m`
              : "—"
          }
          freshness="current"
          detail={last?.timestamp ?? "Latest Audit none"}
          tone="neutral"
        />
      </div>

      {error ? (
        <p className="mc-card-detail muted" style={{ marginBottom: 12 }}>
          Readiness surface error: {error}
        </p>
      ) : null}

      <article className="mc-card">
        <div className="mc-card-top" style={{ marginBottom: 12 }}>
          <span className="mc-card-label">Latest Audit</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Badge tone="waiting">Audit Only</Badge>
            <SecondaryButton size="sm" onClick={() => void load()}>
              Refresh
            </SecondaryButton>
            <SecondaryButton
              size="sm"
              disabled={running}
              onClick={() => void runAudit()}
            >
              {running ? "Auditing…" : "Run Audit"}
            </SecondaryButton>
          </div>
        </div>

        {!last ? (
          <EmptyIllustration
            title="No readiness audit yet"
            copy="Run Production Readiness to certify staging readiness from existing evidence."
          />
        ) : (
          <div>
            <p className="mc-card-detail">
              <span className="mono">{last.report_path}</span>
            </p>
            <p className="mc-card-detail muted" style={{ marginTop: 8 }}>
              {last.launch_recommendation} · overall {last.scores.overall} ·{" "}
              {last.launch_rationale}
            </p>
            {(critical.length > 0 || high.length > 0) && (
              <ul className="mc-faa-history" style={{ marginTop: 12 }}>
                {[...critical, ...high].map((b) => (
                  <li key={b.blocker_id} className="mc-faa-history-item">
                    <Badge
                      tone={b.severity === "CRITICAL" ? "rejected" : "waiting"}
                    >
                      {b.severity}
                    </Badge>{" "}
                    <span className="mono mc-faa-type">{b.blocker_id}</span>
                    <p className="mc-card-detail muted">{b.description}</p>
                  </li>
                ))}
              </ul>
            )}
            {surface?.recent_audits?.length ? (
              <div style={{ marginTop: 16 }}>
                <p className="mc-card-label">Recent audits</p>
                <ul className="mc-faa-history">
                  {surface.recent_audits.slice(0, 5).map((r) => (
                    <li key={r.audit_id} className="mc-faa-history-item">
                      <div className="mc-faa-history-row">
                        <Badge tone={launchTone(r.launch_recommendation)}>
                          {r.launch_recommendation}
                        </Badge>
                        <span className="mono mc-faa-type">{r.overall}</span>
                        <span className="muted mono">{r.timestamp}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
        <p className="mc-card-detail muted" style={{ marginTop: 12 }}>
          LIVE {surface?.live ? "ON" : "OFF"} · publication_allowed{" "}
          {String(surface?.publication_allowed ?? false)} · reuses existing
          reports only
        </p>
      </article>
    </section>
  );
}
