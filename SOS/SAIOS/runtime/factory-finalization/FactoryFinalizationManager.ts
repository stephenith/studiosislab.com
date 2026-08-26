/**
 * Factory V1 Finalization Manager — orchestration entry point.
 * AGENT #099 — documentation and operational freeze only.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildRuntimeDependencyGraph } from "./DependencyGraphBuilder.js";
import { generateAllDocumentation } from "./DocumentationGenerator.js";
import { evaluateProductionReadiness } from "./ReadinessEvaluator.js";
import { verifyAllSubsystems } from "./SubsystemVerifier.js";
import type { ProductionReadiness } from "./types.js";

export const FACTORY_FINALIZATION = {
  module: "factory-finalization",
  version: "1.0.0",
  agent: "099",
  role: "documentation_and_operational_freeze",
  prohibitions: [
    "no_resume_generation",
    "no_publication_execution",
    "no_ai_system_mutation",
    "no_design_dna_mutation",
    "no_release_manager_mutation",
    "no_runtime_catalog_mutation",
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
  history?: Array<{ at: string; type: string; summary: string; ref: string }>;
  operations?: Record<string, unknown>;
  factory_v1?: Record<string, unknown>;
};

function loadProjectState(): ProjectState {
  if (!existsSync(STATE_PATH)) throw new Error("SOS/project-state.json missing");
  return JSON.parse(readFileSync(STATE_PATH, "utf8")) as ProjectState;
}

export function runFactoryFinalization(): {
  readiness: ProductionReadiness;
  artifacts: ReturnType<typeof generateAllDocumentation>;
  state_path: string;
} {
  const state = loadProjectState();
  if (state.next_agent !== "099" && state.latest_agent !== "099") {
    throw new Error(`Expected agent #099, found latest=${state.latest_agent} next=${state.next_agent}`);
  }

  const subsystems = verifyAllSubsystems();
  const graph = buildRuntimeDependencyGraph();
  const readiness = evaluateProductionReadiness({
    subsystems,
    factoryVersion: state.factory_version,
  });

  const artifacts = generateAllDocumentation({ readiness, graph });

  const now = new Date().toISOString();
  const updated: ProjectState = {
    ...state,
    latest_agent: "099",
    next_agent: "100",
    generated_at: now,
    factory_v1: {
      status: readiness.factory_v1_status,
      feature_complete: readiness.feature_complete,
      production_ready: readiness.production_ready,
      foundation_locked: readiness.foundation_locked,
      readiness_score: readiness.readiness_score,
      frozen_at: now,
      version: "1.0.0",
      label: "STABLE · FEATURE COMPLETE · READY FOR PRODUCTION",
    },
    operations: {
      ...(state.operations ?? {}),
      factory_finalization: {
        last_run: now,
        readiness_score: readiness.readiness_score,
        subsystems_passed: subsystems.filter(
          (s) => s.status === "pass" || s.status === "read_only_pass",
        ).length,
        subsystems_total: subsystems.length,
        report_dir: "SOS/09_REPORTS/factory-v1",
      },
    },
    history: [
      ...(state.history ?? []),
      {
        at: now,
        type: "factory_finalization",
        summary: `Agent #099: V1 ${readiness.factory_v1_status} — readiness ${readiness.readiness_score}/100`,
        ref: "SOS/09_REPORTS/factory-v1/factory-final-report.md",
      },
    ],
  };
  writeFileSync(STATE_PATH, JSON.stringify(updated, null, 2));

  return { readiness, artifacts, state_path: STATE_PATH };
}

export { STATE_PATH };
