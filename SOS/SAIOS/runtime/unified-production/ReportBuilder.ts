/**
 * Report builder — master report, dashboard, timeline, quality summary.
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type {
  MasterProductionReport,
  ProductionDashboard,
  QualitySummary,
  UnifiedRunState,
} from "./types.js";
import { UNIFIED_STAGES } from "./types.js";
import { buildArtifactIndex } from "./ArtifactTracker.js";

const SOS_ROOT = resolve(import.meta.dirname, "../../..");
export const UNIFIED_OUTPUT_ROOT = join(SOS_ROOT, "07_LOGS/saios/unified-production");

export function buildTimeline(state: UnifiedRunState): object {
  return {
    run_id: state.run_id,
    objective: state.objective,
    events: state.stage_timings.map((t) => ({
      stage: t.stage,
      started_at: t.started_at,
      completed_at: t.completed_at,
      duration_ms: t.duration_ms,
      pass: t.pass,
    })),
    total_duration_ms: state.stage_timings.reduce((a, t) => a + t.duration_ms, 0),
  };
}

export function buildQualitySummary(state: UnifiedRunState): QualitySummary | null {
  return state.quality;
}

export function buildMasterReport(state: UnifiedRunState): MasterProductionReport {
  const artifacts_by_stage = buildArtifactIndex(state);
  const allExecuted = UNIFIED_STAGES.every(
    (s) => state.completed_stages.includes(s) || s === "waiting_founder",
  );
  const requiredStages = UNIFIED_STAGES.filter((s) => s !== "waiting_founder");
  const allStagesDone = requiredStages.every((s) => state.completed_stages.includes(s));

  return {
    run_id: state.run_id,
    objective: state.objective,
    generated_at: new Date().toISOString(),
    status: state.status,
    stage_timings: state.stage_timings,
    quality: state.quality,
    founder_prediction: state.quality?.founder_prediction ?? "PENDING",
    publication_readiness: state.quality?.publication_ready
      ? "ready_to_publish_draft"
      : "not_ready",
    learning_updates: state.completed_stages.includes("waiting_founder")
      ? ["Production cycle learning recorded"]
      : [],
    artifacts_by_stage,
    gates: {
      all_stages_executed: allStagesDone,
      all_artifacts_present: state.artifacts.length >= 8,
      quality_gates_passed: state.quality
        ? state.quality.premium_score >= 97 &&
          state.quality.ats_score >= 95 &&
          !state.quality.publication_blocked
        : false,
      founder_gate_enforced: state.status === "waiting_founder" || state.status === "completed",
      publication_never_automatic: true,
    },
  };
}

export function buildDashboard(states: UnifiedRunState[]): ProductionDashboard {
  const latest = states[0];
  const failed = states.filter((s) => s.status === "failed");
  const waiting = states.filter((s) => s.status === "waiting_founder");
  const avgDuration =
    states.length > 0
      ? Math.round(
          states.reduce(
            (a, s) => a + s.stage_timings.reduce((b, t) => b + t.duration_ms, 0),
            0,
          ) / states.length,
        )
      : 0;

  const completedCount = latest?.completed_stages.length ?? 0;
  const pct = Math.round((completedCount / UNIFIED_STAGES.length) * 100);

  let health: ProductionDashboard["overall_health"] = "healthy";
  if (failed.length > 0) health = "failed";
  else if (waiting.length > 0 || (latest?.failed_stage ?? null)) health = "degraded";

  return {
    updated_at: new Date().toISOString(),
    current_run_id: latest?.run_id ?? null,
    current_stage: latest?.current_stage ?? "none",
    completed_stages: latest?.completed_stages ?? [],
    failed_stages: failed.map((s) => s.failed_stage).filter(Boolean) as string[],
    retry_count: latest?.retry_count ?? 0,
    estimated_completion_pct: pct,
    average_stage_duration_ms: avgDuration,
    overall_health: health,
    active_runs: states.filter((s) => s.status === "running").length,
    waiting_founder: waiting.length,
  };
}

export function persistRunReports(state: UnifiedRunState): {
  master_report_path: string;
  timeline_path: string;
  quality_path: string;
  artifact_index_path: string;
} {
  mkdirSync(state.run_dir, { recursive: true });

  const master = buildMasterReport(state);
  const master_report_path = join(state.run_dir, "master-production-report.json");
  writeFileSync(master_report_path, JSON.stringify(master, null, 2));

  const timeline_path = join(state.run_dir, "timeline.json");
  writeFileSync(timeline_path, JSON.stringify(buildTimeline(state), null, 2));

  const quality_path = join(state.run_dir, "quality-summary.json");
  writeFileSync(quality_path, JSON.stringify(state.quality ?? {}, null, 2));

  const artifact_index_path = join(state.run_dir, "artifact-index.json");
  writeFileSync(
    artifact_index_path,
    JSON.stringify({ run_id: state.run_id, artifacts: master.artifacts_by_stage }, null, 2),
  );

  return { master_report_path, timeline_path, quality_path, artifact_index_path };
}

export function persistGlobalDashboard(states: UnifiedRunState[]): string {
  const dashboard = buildDashboard(states);
  mkdirSync(UNIFIED_OUTPUT_ROOT, { recursive: true });
  const path = join(UNIFIED_OUTPUT_ROOT, "dashboard.json");
  writeFileSync(path, JSON.stringify(dashboard, null, 2));
  const prodPath = join(UNIFIED_OUTPUT_ROOT, "production-dashboard.json");
  writeFileSync(prodPath, JSON.stringify(dashboard, null, 2));
  return path;
}

export function loadAllRunStates(): UnifiedRunState[] {
  const runsDir = join(UNIFIED_OUTPUT_ROOT, "runs");
  if (!existsSync(runsDir)) return [];
  return readdirSync(runsDir)
    .map((id) => loadRunStateFromId(id))
    .filter((s): s is UnifiedRunState => s !== null)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

function loadRunStateFromId(run_id: string): UnifiedRunState | null {
  const path = join(UNIFIED_OUTPUT_ROOT, "runs", run_id, "run.json");
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as UnifiedRunState;
}
