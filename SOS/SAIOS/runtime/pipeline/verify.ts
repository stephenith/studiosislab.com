#!/usr/bin/env tsx
/**
 * Self-test — one founder request through full autonomous production pipeline.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createMockCursorExecutor } from "../directors/resume-production/CursorResearchCoordinator.js";
import {
  ensureVerifyDirs,
  RESUME_AUTONOMOUS_PIPELINE,
  runPipeline,
} from "./PipelineOrchestrator.js";
import { allocateRunId, RUNS_ROOT } from "./RunManager.js";
import { loadPipelineState } from "./PipelineState.js";
import { loadRunForRecovery } from "./RunRecovery.js";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function main(): Promise<void> {
  assert(
    RESUME_AUTONOMOUS_PIPELINE.pipeline_type === "resume-autonomous-production",
    "pipeline type",
  );
  assert(RESUME_AUTONOMOUS_PIPELINE.integration_only === true, "integration only");

  const run_id = allocateRunId();
  const verifyRoot = join(RUNS_ROOT, "verify-runs", run_id);
  const { jobsDir, registryDir } = ensureVerifyDirs(verifyRoot);

  const mockCursor = createMockCursorExecutor({
    failure_rate: 0,
    base_research_ms: 10,
    mcp_available: true,
  });

  const result = await runPipeline({
    objective: "Generate one modern ATS professional resume template for founder review.",
    priority: "ats",
    run_id,
    cursor_executor: mockCursor,
    mcp_firecrawl_available: true,
    mock_founder_decision: "APPROVE",
    learning_persist: false,
    queue_jobs_dir: jobsDir,
    registry_dir: registryDir,
  });

  const runDir = result.run_dir;

  assert(result.pass, "pipeline pass");
  assert(result.state.final_status === "completed", "completed status");
  assert(result.state.founder_decision === "APPROVE", "founder approved");
  assert(result.state.completed_stages.length >= 10, "stages completed");
  assert(result.state.prototype_id !== null, "prototype generated");

  assert(existsSync(join(runDir, "objective.md")), "objective.md");
  assert(existsSync(join(runDir, "batch-plan.json")), "batch-plan.json");
  assert(existsSync(join(runDir, "research.md")), "research.md");
  assert(existsSync(join(runDir, "cursor-output.md")), "cursor-output.md");
  assert(existsSync(join(runDir, "generated", "template-preview.json")), "template-preview.json");
  assert(existsSync(join(runDir, "generated", "thumbnail.png")), "thumbnail.png");
  assert(existsSync(join(runDir, "qa", "validation.json")), "qa validation.json");
  assert(existsSync(join(runDir, "qa", "report.md")), "qa report.md");
  assert(existsSync(join(runDir, "localhost", "review.json")), "localhost review.json");
  assert(existsSync(join(runDir, "learning", "feedback.json")), "learning feedback.json");
  assert(existsSync(join(runDir, "learning", "updated-rules.json")), "learning rules");
  assert(existsSync(join(runDir, "summary.md")), "summary.md");
  assert(existsSync(join(runDir, "pipeline-report.md")), "pipeline-report.md");
  assert(existsSync(join(runDir, "pipeline-state.json")), "pipeline-state.json");

  const review = JSON.parse(
    readFileSync(join(runDir, "localhost", "review.json"), "utf8"),
  ) as { review_command: string; no_publish: boolean };
  assert(review.review_command.includes("review:template"), "review command");
  assert(review.no_publish === true, "no publish flag");

  assert(result.report.cursor_invocations >= 1, "cursor invoked");
  assert(result.report.total_duration_ms > 0, "duration tracked");

  const recovery = loadRunForRecovery(run_id);
  assert(recovery !== null, "recovery plan loadable");
  assert(recovery!.can_resume === false, "completed run not resumable");

  const stateReload = loadPipelineState(runDir);
  assert(stateReload?.completed_stages.includes("production"), "production stage persisted");
  assert(stateReload?.completed_stages.includes("qa"), "qa stage persisted");
  assert(stateReload?.completed_stages.includes("learning"), "learning stage persisted");

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "resume-autonomous-production-pipeline",
        run_id: result.run_id,
        run_dir: result.run_dir,
        prototype_id: result.state.prototype_id,
        founder_decision: result.state.founder_decision,
        stages_completed: result.state.completed_stages.length,
        cursor_invocations: result.report.cursor_invocations,
        total_duration_ms: result.report.total_duration_ms,
        checks: {
          planning: stateReload?.completed_stages.includes("batch_plan"),
          queue: stateReload?.completed_stages.includes("queue_enqueue"),
          runtime: stateReload?.completed_stages.includes("runtime_dispatch"),
          cursor_research: stateReload?.completed_stages.includes("cursor_research"),
          production: stateReload?.completed_stages.includes("production"),
          qa: stateReload?.completed_stages.includes("qa"),
          local_review: stateReload?.completed_stages.includes("local_review"),
          founder_approval: stateReload?.completed_stages.includes("founder_approval"),
          learning: stateReload?.completed_stages.includes("learning"),
          batch_completion: stateReload?.completed_stages.includes("batch_completion"),
        },
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
