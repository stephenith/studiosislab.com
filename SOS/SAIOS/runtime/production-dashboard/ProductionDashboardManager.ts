/**
 * Production Dashboard Manager — orchestration entry point.
 * AGENT #096 — visibility only; no generation or publication.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildProductionDashboard } from "./DashboardBuilder.js";
import { persistDashboardArtifacts } from "./DashboardReporter.js";
import { discoverTemplateLifecycles } from "./TemplateLifecycleDiscoverer.js";
import type { ProductionDashboard } from "./types.js";

export const PRODUCTION_DASHBOARD = {
  module: "production-dashboard",
  version: "1.0.0",
  agent: "096",
  role: "orchestration_only",
  prohibitions: [
    "no_resume_generation",
    "no_publication_execution",
    "no_ai_system_mutation",
    "no_design_dna_mutation",
    "no_release_manager_mutation",
  ],
} as const;

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
const SOS_ROOT = join(REPO_ROOT, "SOS");
const STATE_PATH = join(SOS_ROOT, "project-state.json");

type ProjectState = {
  factory_version: string;
  generated_at: string;
  latest_agent: string;
  next_agent: string;
  latest_founder_review: string;
  next_founder_review: string;
  latest_release: string;
  latest_catalog: string;
  latest_calibration: string;
  latest_design_dna: string;
  latest_batch: string;
  latest_generation: string;
  latest_template: string;
  history?: Array<{ at: string; type: string; summary: string; ref: string }>;
  operations?: Record<string, unknown>;
};

function loadProjectState(): ProjectState {
  if (!existsSync(STATE_PATH)) {
    throw new Error("SOS/project-state.json missing — run factory-state:verify first");
  }
  return JSON.parse(readFileSync(STATE_PATH, "utf8")) as ProjectState;
}

function updateOperationalFields(
  state: ProjectState,
  dashboard: ProductionDashboard,
): ProjectState {
  const now = new Date().toISOString();
  const history = [...(state.history ?? [])];
  history.push({
    at: now,
    type: "production_dashboard",
    summary: `Agent #096 dashboard: ${dashboard.factory_health.templates_generated} tracked, ${dashboard.factory_health.issues_detected} issues`,
    ref: "SOS/07_LOGS/saios/production-dashboard/dashboard.json",
  });

  return {
    ...state,
    latest_agent: "096",
    next_agent: "097",
    generated_at: now,
    operations: {
      ...(state.operations ?? {}),
      production_dashboard: {
        last_run: now,
        status: dashboard.factory_health.status,
        templates_tracked: dashboard.queue.length,
        issues_detected: dashboard.factory_health.issues_detected,
        stale_templates: dashboard.factory_health.stale_templates,
        dashboard_path: "SOS/07_LOGS/saios/production-dashboard/dashboard.json",
      },
    },
    history,
  };
}

export function runProductionDashboard(): {
  dashboard: ProductionDashboard;
  artifacts: ReturnType<typeof persistDashboardArtifacts>;
  state_path: string;
} {
  const state = loadProjectState();

  if (state.next_agent !== "096") {
    throw new Error(
      `Factory state expects agent ${state.next_agent}, not #096 — resolve numbering before running dashboard`,
    );
  }

  const records = discoverTemplateLifecycles({
    factoryVersion: state.factory_version,
    designDnaVersion: state.latest_design_dna,
    latestCalibration: state.latest_calibration,
    latestFounderReview: state.latest_founder_review,
  });

  const dashboard = buildProductionDashboard({
    records,
    factoryVersion: state.factory_version,
    currentBatch: state.latest_batch,
    currentRelease: state.latest_release,
  });

  const artifacts = persistDashboardArtifacts(dashboard);
  const updated = updateOperationalFields(state, dashboard);
  writeFileSync(STATE_PATH, JSON.stringify(updated, null, 2));

  return { dashboard, artifacts, state_path: STATE_PATH };
}

export { STATE_PATH };
