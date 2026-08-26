/**
 * Mission Control — First Supervised Production Run panel — Agent #230.
 * Reuses Mission Control; no redesign. Founder approval required to start.
 */
import { useCallback, useEffect, useState } from "react";
import { Badge, EmptyIllustration, SecondaryButton } from "../../design-system";
import { McSectionHeader, StatusCard } from "./components";

type SelectedRole = {
  category: string;
  title: string;
  industry: string;
  seniority: string;
};

type Surface = {
  run: {
    run_id: string;
    batch_status: string;
    preflight_ok: boolean;
    preflight_blocker: string | null;
    estimated_maximum_cost_usd: number;
    estimated_provider_calls: number;
    request: { simulation_mode: boolean };
  } | null;
  display: {
    run_id: string | null;
    status: string;
    start_time: string | null;
    duration_ms: number | null;
    progress: { percent: number; completed: number; failed: number; requested: number } | null;
    templates_requested: number;
    templates_completed: number;
    templates_failed: number;
    current_pipeline_stage: string | null;
    selected_roles: SelectedRole[];
    provider: string | null;
    model: string | null;
    estimated_cost_usd: number | null;
    estimated_maximum_cost_usd: number | null;
    recorded_cost_usd: number | null;
    estimated_provider_calls: number | null;
    runtime_guard_result: string | null;
    budget_result: string | null;
    health_result: string | null;
    founder_review_count: number;
    latest_audit: string | null;
    concurrency: number;
    publication_status: string;
    live_status: string;
    founder_approval_required: boolean;
    simulation_mode: boolean | null;
  };
  preflight_preview: {
    templates: number;
    selected_roles: SelectedRole[];
    estimated_provider_calls: number;
    estimated_maximum_cost_usd: number;
    concurrency: number;
    publication: string;
    live: string;
    founder_approval: string;
    simulation_available: boolean;
    real_provider_available: boolean;
  };
  links: {
    founder_review: string;
    generated_outputs: string;
    production_report: string;
    audit_history: string;
    mission_control_url: string;
  };
  cancel_supported: boolean;
  retry_supported: boolean;
};

function statusTone(
  s: string,
): "neutral" | "approved" | "waiting" | "rejected" | "processing" {
  if (s === "AWAITING_FOUNDER_REVIEW" || s === "COMPLETED") return "approved";
  if (s === "RUNNING" || s === "QUEUED" || s === "VALIDATING") return "processing";
  if (s === "PENDING_APPROVAL") return "waiting";
  if (
    s === "BLOCKED" ||
    s === "FAILED" ||
    s === "CANCELLED" ||
    s === "PARTIALLY_COMPLETED"
  )
    return "rejected";
  return "neutral";
}

export function FirstSupervisedRunPanel() {
  const [surface, setSurface] = useState<Surface | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [simulation, setSimulation] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/supervised-production-run", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Surface;
      setSurface(data);
      setError(null);
      if (data.display.simulation_mode != null) {
        setSimulation(data.display.simulation_mode);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 15_000);
    return () => clearInterval(t);
  }, [load]);

  const prepare = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/supervised-production-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prepare: true, simulation_mode: simulation }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    if (busy) return;
    const preview = surface?.preflight_preview;
    const roles = (preview?.selected_roles ?? [])
      .map((r) => r.title)
      .join(", ");
    const ok = window.confirm(
      [
        "START FIRST SUPERVISED RUN",
        "",
        `Templates: ${preview?.templates ?? 5}`,
        `Roles: ${roles}`,
        `Estimated provider calls: ${preview?.estimated_provider_calls ?? "—"}`,
        `Estimated maximum cost: $${preview?.estimated_maximum_cost_usd ?? 0}`,
        `Concurrency: ${preview?.concurrency ?? 1}`,
        `Publication: ${preview?.publication ?? "disabled"}`,
        `LIVE: ${preview?.live ?? "OFF"}`,
        `Founder approval: required`,
        `Mode: ${simulation ? "simulation (mock)" : "real provider (if eligible)"}`,
        "",
        "Proceed?",
      ].join("\n"),
    );
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch("/api/supervised-production-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approve: true,
          simulation_mode: simulation,
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string; blocker?: string };
        throw new Error(body.blocker ?? body.error ?? `HTTP ${res.status}`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (busy) return;
    if (!window.confirm("Cancel supervised run via System Orchestrator?")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/supervised-production-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancel: true }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const d = surface?.display;
  const status = d?.status ?? "NONE";
  const roles = d?.selected_roles ?? surface?.preflight_preview.selected_roles ?? [];

  return (
    <section className="mc-row-block" aria-label="First supervised production run">
      <McSectionHeader
        title="First Supervised Production Run"
        subtitle="Founder-approved 5-template resume batch — LIVE OFF · no publication"
      />

      <div className="mc-row mc-row-5" style={{ marginBottom: 16 }}>
        <StatusCard
          label="Run ID"
          value={d?.run_id ? d.run_id.slice(0, 22) + "…" : "—"}
          freshness="current"
          detail={d?.run_id ?? "not prepared"}
          tone="neutral"
        />
        <StatusCard
          label="Status"
          value={status}
          freshness="current"
          detail={d?.current_pipeline_stage ?? "—"}
          tone={statusTone(status)}
        />
        <StatusCard
          label="Progress"
          value={
            d?.progress
              ? `${d.progress.completed}/${d.progress.requested}`
              : "0/5"
          }
          freshness="current"
          detail={
            d?.progress ? `${d.progress.percent}% · failed ${d.progress.failed}` : "—"
          }
          tone="neutral"
        />
        <StatusCard
          label="Provider / Model"
          value={d?.provider ?? "—"}
          freshness="current"
          detail={d?.model ?? "—"}
          tone="neutral"
        />
        <StatusCard
          label="Cost Est / Max"
          value={`$${d?.estimated_cost_usd ?? 0}`}
          freshness="current"
          detail={`max $${d?.estimated_maximum_cost_usd ?? 0} · recorded ${d?.recorded_cost_usd ?? "—"}`}
          tone="neutral"
        />
      </div>

      <div className="mc-row mc-row-5" style={{ marginBottom: 16 }}>
        <StatusCard
          label="Runtime Guard"
          value={d?.runtime_guard_result ? "OK" : "—"}
          freshness="current"
          detail={d?.runtime_guard_result ?? "pending preflight"}
          tone={d?.runtime_guard_result ? "approved" : "neutral"}
        />
        <StatusCard
          label="Budget"
          value={d?.budget_result?.includes("ALLOW") ? "ALLOW" : d?.budget_result ? "CHECK" : "—"}
          freshness="current"
          detail={d?.budget_result ?? "pending"}
          tone={
            d?.budget_result?.includes("ALLOW")
              ? "approved"
              : d?.budget_result?.includes("DENY")
                ? "rejected"
                : "neutral"
          }
        />
        <StatusCard
          label="Health"
          value={d?.health_result?.includes("HEALTHY") ? "HEALTHY" : d?.health_result ? "CHECK" : "—"}
          freshness="current"
          detail={d?.health_result ?? "pending"}
          tone={
            d?.health_result?.includes("HEALTHY") ? "approved" : "neutral"
          }
        />
        <StatusCard
          label="Founder Reviews"
          value={String(d?.founder_review_count ?? 0)}
          freshness="current"
          detail="awaiting review"
          tone={
            (d?.founder_review_count ?? 0) > 0 ? "waiting" : "neutral"
          }
        />
        <StatusCard
          label="Safety"
          value={`${d?.live_status ?? "OFF"} / pub ${d?.publication_status ?? "disabled"}`}
          freshness="current"
          detail={`concurrency ${d?.concurrency ?? 1}`}
          tone="approved"
        />
      </div>

      {error ? (
        <p className="mc-card-detail muted" style={{ marginBottom: 12 }}>
          Supervised run error: {error}
        </p>
      ) : null}

      {surface?.run?.preflight_blocker ? (
        <p className="mc-card-detail" style={{ marginBottom: 12 }}>
          Blocker: {surface.run.preflight_blocker}
        </p>
      ) : null}

      <article className="mc-card">
        <div className="mc-card-top" style={{ marginBottom: 12 }}>
          <span className="mc-card-label">Batch Controls</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Badge tone="waiting">Founder Approval Required</Badge>
            <Badge tone="approved">LIVE OFF</Badge>
            <label className="mc-card-detail" style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={simulation}
                onChange={(e) => setSimulation(e.target.checked)}
                disabled={busy}
              />
              Simulation (mock)
            </label>
            <SecondaryButton size="sm" onClick={() => void load()} disabled={busy}>
              Refresh
            </SecondaryButton>
            <SecondaryButton size="sm" onClick={() => void prepare()} disabled={busy}>
              Prepare Batch
            </SecondaryButton>
            <SecondaryButton size="sm" onClick={() => void start()} disabled={busy}>
              {busy ? "Working…" : "START FIRST SUPERVISED RUN"}
            </SecondaryButton>
            {surface?.cancel_supported ? (
              <SecondaryButton size="sm" onClick={() => void cancel()} disabled={busy}>
                Cancel
              </SecondaryButton>
            ) : null}
          </div>
        </div>

        <p className="mc-card-detail muted" style={{ marginBottom: 12 }}>
          Before start: {surface?.preflight_preview.templates ?? 5} templates · concurrency{" "}
          {surface?.preflight_preview.concurrency ?? 1} · publication{" "}
          {surface?.preflight_preview.publication ?? "disabled"} · LIVE{" "}
          {surface?.preflight_preview.live ?? "OFF"} · est. calls{" "}
          {surface?.preflight_preview.estimated_provider_calls ?? 0} · max cost $
          {surface?.preflight_preview.estimated_maximum_cost_usd ?? 0}
          {surface?.preflight_preview.real_provider_available
            ? " · real provider credentials available"
            : " · real provider not eligible (use simulation)"}
        </p>

        {!d?.run_id ? (
          <EmptyIllustration
            title="No supervised run prepared"
            copy="Prepare the batch, review roles and cost, then approve START FIRST SUPERVISED RUN."
          />
        ) : (
          <div>
            <p className="mc-card-detail" style={{ marginBottom: 8 }}>
              Selected roles:
            </p>
            <ul className="mc-card-detail" style={{ marginBottom: 12, paddingLeft: 18 }}>
              {roles.map((r) => (
                <li key={`${r.category}-${r.title}`}>
                  {r.title} ({r.category} · {r.seniority})
                </li>
              ))}
            </ul>
            <p className="mc-card-detail muted">
              Start:{" "}
              {d.start_time ? new Date(d.start_time).toLocaleString() : "—"} · Duration:{" "}
              {d.duration_ms != null ? `${d.duration_ms}ms` : "—"} · Audit:{" "}
              <span className="mono">{d.latest_audit ?? "—"}</span>
            </p>
            <p className="mc-card-detail muted" style={{ marginTop: 8 }}>
              <a href={surface?.links.founder_review ?? "#review"}>Founder Review</a>
              {" · "}
              <span className="mono">{surface?.links.generated_outputs}</span>
              {" · "}
              <span className="mono">{surface?.links.production_report}</span>
            </p>
          </div>
        )}
      </article>
    </section>
  );
}
