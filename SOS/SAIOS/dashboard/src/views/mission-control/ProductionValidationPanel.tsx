/**
 * Mission Control Production Validation panel — Agent #227.
 * Read-only validation surface. No redesign of Mission Control.
 */
import { useCallback, useEffect, useState } from "react";
import { Badge, EmptyIllustration, SecondaryButton } from "../../design-system";
import { McSectionHeader, StatusCard } from "./components";

type ValidationReport = {
  validation_id: string;
  timestamp: string;
  duration_ms: number;
  pass_percent: number;
  overall_status: string;
  checks_executed: number;
  checks_passed: number;
  checks_failed: number;
  failed_checks: string[];
  warnings: string[];
  report_path: string;
};

type ValidationSurface = {
  last_validation: ValidationReport | null;
  validation_status: string;
  validation_duration_ms: number | null;
  pass_percent: number | null;
  failed_checks: string[];
  latest_report_path: string | null;
  recent_validations: Array<{
    validation_id: string;
    timestamp: string;
    overall_status: string;
    pass_percent: number;
  }>;
  live: boolean;
  publication_allowed: boolean;
};

function statusTone(
  s: string,
): "neutral" | "approved" | "waiting" | "rejected" | "processing" {
  if (s === "PASS") return "approved";
  if (s === "PASS_WITH_WARNINGS") return "waiting";
  if (s === "FAIL") return "rejected";
  return "neutral";
}

export function ProductionValidationPanel() {
  const [surface, setSurface] = useState<ValidationSurface | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/production-validation", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ValidationSurface;
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

  const runValidation = async () => {
    if (running) return;
    setRunning(true);
    try {
      const res = await fetch("/api/production-validation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run: true }),
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

  const last = surface?.last_validation;
  const status = surface?.validation_status ?? "NONE";

  return (
    <section className="mc-row-block" aria-label="Production validation">
      <McSectionHeader
        title="Production Validation"
        subtitle="End-to-end readiness — validation only, never modifies production"
      />

      <div className="mc-row mc-row-5" style={{ marginBottom: 16 }}>
        <StatusCard
          label="Validation Status"
          value={status}
          freshness="current"
          detail={last?.validation_id ?? "no run yet"}
          tone={statusTone(status)}
        />
        <StatusCard
          label="Last Validation"
          value={
            last?.timestamp
              ? new Date(last.timestamp).toLocaleString()
              : "—"
          }
          freshness="current"
          detail={last ? `${last.checks_executed} checks` : "none"}
          tone="neutral"
        />
        <StatusCard
          label="Validation Duration"
          value={
            surface?.validation_duration_ms != null
              ? `${surface.validation_duration_ms}ms`
              : "—"
          }
          freshness="current"
          detail="last run"
          tone="neutral"
        />
        <StatusCard
          label="Pass %"
          value={
            surface?.pass_percent != null ? `${surface.pass_percent}%` : "—"
          }
          freshness="current"
          detail={
            last
              ? `${last.checks_passed}/${last.checks_executed} passed`
              : "—"
          }
          tone={statusTone(status)}
        />
        <StatusCard
          label="Failed Checks"
          value={String(surface?.failed_checks?.length ?? 0)}
          freshness="current"
          detail={
            surface?.failed_checks?.slice(0, 2).join(", ") || "none"
          }
          tone={
            (surface?.failed_checks?.length ?? 0) > 0 ? "rejected" : "approved"
          }
        />
      </div>

      {error ? (
        <p className="mc-card-detail muted" style={{ marginBottom: 12 }}>
          Validation surface error: {error}
        </p>
      ) : null}

      <article className="mc-card">
        <div className="mc-card-top" style={{ marginBottom: 12 }}>
          <span className="mc-card-label">Latest Validation Report</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Badge tone="waiting">Validation Only</Badge>
            <SecondaryButton size="sm" onClick={() => void load()}>
              Refresh
            </SecondaryButton>
            <SecondaryButton
              size="sm"
              disabled={running}
              onClick={() => void runValidation()}
            >
              {running ? "Validating…" : "Run Validation"}
            </SecondaryButton>
          </div>
        </div>

        {!last ? (
          <EmptyIllustration
            title="No validation yet"
            copy="Run Production Validation to generate the readiness report."
          />
        ) : (
          <div>
            <p className="mc-card-detail">
              <span className="mono">{last.report_path}</span>
            </p>
            <p className="mc-card-detail muted" style={{ marginTop: 8 }}>
              {last.overall_status} · {last.pass_percent}% ·{" "}
              {last.checks_failed} failed · {last.warnings.length} warnings
            </p>
            {last.failed_checks.length > 0 ? (
              <ul className="mc-faa-history" style={{ marginTop: 12 }}>
                {last.failed_checks.map((id) => (
                  <li key={id} className="mc-faa-history-item">
                    <Badge tone="rejected">FAIL</Badge>{" "}
                    <span className="mono mc-faa-type">{id}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {surface?.recent_validations?.length ? (
              <div style={{ marginTop: 16 }}>
                <p className="mc-card-label">Recent validations</p>
                <ul className="mc-faa-history">
                  {surface.recent_validations.slice(0, 5).map((r) => (
                    <li key={r.validation_id} className="mc-faa-history-item">
                      <div className="mc-faa-history-row">
                        <Badge tone={statusTone(r.overall_status)}>
                          {r.overall_status}
                        </Badge>
                        <span className="mono mc-faa-type">
                          {r.pass_percent}%
                        </span>
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
          {String(surface?.publication_allowed ?? false)} · never modifies
          production
        </p>
      </article>
    </section>
  );
}
