#!/usr/bin/env tsx
/**
 * Unified Resume Production Engine verification.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  UNIFIED_RESUME_PRODUCTION_ENGINE,
  runUnifiedProduction,
} from "./UnifiedProductionDirector.js";
import { UNIFIED_OUTPUT_ROOT } from "./ReportBuilder.js";
import { UNIFIED_STAGES } from "./types.js";

const OBJECTIVE = "Unified production verify — premium software engineer resume";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function main(): Promise<void> {
  assert(UNIFIED_RESUME_PRODUCTION_ENGINE.module === "unified-resume-production-engine", "module id");
  assert(UNIFIED_RESUME_PRODUCTION_ENGINE.role === "production_orchestration_only", "role");

  const result = await runUnifiedProduction({
    objective: OBJECTIVE,
    mcp_firecrawl_available: true,
    learning_persist: true,
    seed: Date.now() % 10000,
  });

  assert(result.pass, "unified production pass");
  assert(result.awaiting_founder, "awaiting founder approval");
  assert(result.status === "waiting_founder", "status waiting_founder");

  const requiredStages = [
    "researching",
    "benchmarking",
    "designing",
    "composing",
    "generating",
    "qa",
    "render_review",
    "founder_critic",
    "publication_ready",
    "waiting_founder",
  ];

  for (const stage of requiredStages) {
    assert(result.state.completed_stages.includes(stage as typeof UNIFIED_STAGES[number]), `stage: ${stage}`);
  }

  const rootFiles = [
    "run.json",
    "master-production-report.json",
    "artifact-index.json",
    "timeline.json",
    "quality-summary.json",
  ];

  for (const file of rootFiles) {
    assert(existsSync(join(result.run_dir, file)), `artifact: ${file}`);
  }

  assert(existsSync(join(UNIFIED_OUTPUT_ROOT, "dashboard.json")), "dashboard.json");
  assert(existsSync(join(UNIFIED_OUTPUT_ROOT, "production-dashboard.json")), "production-dashboard.json");

  const master = JSON.parse(readFileSync(result.master_report_path, "utf8")) as {
    gates: Record<string, boolean>;
  };

  assert(master.gates.founder_gate_enforced, "founder gate enforced");
  assert(master.gates.publication_never_automatic, "publication never automatic");
  assert(master.gates.all_stages_executed, "all stages executed");

  const stageArtifacts = result.state.artifacts;
  assert(stageArtifacts.some((a) => a.component === "research-engine"), "research artifacts");
  assert(stageArtifacts.some((a) => a.component === "benchmark-engine"), "benchmark artifacts");
  assert(stageArtifacts.some((a) => a.component === "design-brain"), "design brain artifacts");
  assert(stageArtifacts.some((a) => a.component === "adaptive-composer"), "composer artifacts");
  assert(stageArtifacts.some((a) => a.component === "premium-generator-v3"), "generator artifacts");
  assert(stageArtifacts.some((a) => a.component === "resume-qa"), "qa artifacts");
  assert(stageArtifacts.some((a) => a.component === "visual-render-engine"), "render artifacts");
  assert(stageArtifacts.some((a) => a.component === "founder-ai-critic"), "critic artifacts");
  assert(stageArtifacts.some((a) => a.component === "publication-manager"), "publication artifacts");

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "unified-resume-production-engine",
        run_id: result.run_id,
        status: result.status,
        stages_completed: result.state.completed_stages.length,
        catalog_id: result.state.catalog_id,
        prototype_id: result.state.prototype_id,
        checks: {
          research: true,
          benchmark: true,
          design_brain: true,
          adaptive_composer: true,
          premium_generator: true,
          qa: true,
          render_evaluation: true,
          founder_critic: true,
          publication_manager: true,
          learning: true,
          master_report: existsSync(result.master_report_path),
          dashboard: existsSync(result.dashboard_path),
        },
        quality: result.state.quality,
        overall: "PASS",
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(JSON.stringify({ pass: false, error: String(err) }, null, 2));
  process.exit(1);
});
