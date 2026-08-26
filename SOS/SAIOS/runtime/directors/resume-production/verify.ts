#!/usr/bin/env tsx
/**
 * Self-test — simulates 50 template production jobs with mocked Cursor executions.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createBatchPlan, validateBatchPlan } from "./BatchPlanner.js";
import { createSchedulerState, assignNextJob } from "./BatchScheduler.js";
import { createMockCursorExecutor } from "./CursorResearchCoordinator.js";
import { computeBatchMetrics } from "./BatchMonitor.js";
import { getBatchOutputDir } from "./BatchReporter.js";
import { RESUME_PRODUCTION_DIRECTOR, runProductionBatch } from "./ResumeProductionDirector.js";
import { DIRECTOR_POLICIES } from "./ProductionPolicies.js";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function main(): Promise<void> {
  assert(
    RESUME_PRODUCTION_DIRECTOR.director_type === "resume-production-batch-director",
    "director type",
  );
  assert(
    RESUME_PRODUCTION_DIRECTOR.constraints.includes("design_resumes"),
    "forbids design",
  );
  assert(
    RESUME_PRODUCTION_DIRECTOR.constraints.includes("modify_src"),
    "forbids src changes",
  );

  // Planning
  const plan50 = createBatchPlan({ size: 50, primary_priority: "ats" });
  const planValidation = validateBatchPlan(plan50);
  assert(planValidation.valid, "batch plan valid");
  assert(plan50.jobs.length === 50, "50 jobs planned");
  assert(plan50.primary_priority === "ats", "ATS priority");

  const plan10 = createBatchPlan({ size: 10, primary_priority: "finance" });
  assert(plan10.size === 10, "10 resume batch supported");

  const plan100 = createBatchPlan({ size: 100, primary_priority: "executive" });
  assert(plan100.size === 100, "100 resume batch supported");

  // Scheduling
  const schedState = createSchedulerState(plan50);
  assert(schedState.queue.length === 50, "scheduler queue initialized");
  const { job } = assignNextJob(plan50, schedState);
  assert(job !== null, "first job assigned");
  assert(job!.worker_id.startsWith("resume-worker"), "worker assigned");

  // Full batch run with mocked Cursor
  const mockCursor = createMockCursorExecutor({
    failure_rate: 0.02,
    base_research_ms: 50,
    mcp_available: true,
  });

  const result = await runProductionBatch({
    plan: { size: 50, primary_priority: "ats", batch_id: "verify-batch-50" },
    cursor_executor: mockCursor,
    mcp_firecrawl_available: true,
    founder_approval_rate: 0.88,
    seed: 42,
    persist_reports: true,
  });

  assert(result.pass, "batch completion pass");
  assert(result.plan.jobs.length === 50, "50 jobs in final plan");
  assert(result.metrics.current_batch_size === 50, "monitoring batch size");
  assert(
    result.metrics.completed + result.metrics.failed >= 48,
    "nearly all jobs terminal",
  );
  assert(result.summary.completed > 0, "completed count > 0");
  assert(result.summary.passed_qa > 0, "QA passes recorded");
  assert(result.summary.average_confidence > 0, "confidence computed");
  assert(result.metrics.queue_depth === 0, "queue drained");

  const outDir = getBatchOutputDir("verify-batch-50");
  assert(existsSync(join(outDir, "batch-plan.json")), "batch-plan.json");
  assert(existsSync(join(outDir, "batch-metrics.json")), "batch-metrics.json");
  assert(existsSync(join(outDir, "batch-summary.json")), "batch-summary.json");
  assert(existsSync(join(outDir, "report.md")), "report.md");

  assert(
    DIRECTOR_POLICIES.founder_approval_required === true,
    "founder approval not bypassed",
  );

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "resume-production-batch-director",
        jobs_simulated: 50,
        completed: result.summary.completed,
        passed_qa: result.summary.passed_qa,
        founder_approved: result.summary.founder_approved,
        revision_required: result.summary.revision_required,
        failed: result.summary.failed,
        average_confidence: result.summary.average_confidence,
        learning_rules_added: result.summary.learning_rules_added,
        success_rate: result.metrics.success_rate,
        cursor_failures: result.metrics.cursor_failures,
        output_dir: result.output_dir,
        checks: {
          planning: true,
          scheduling: true,
          monitoring: true,
          reporting: true,
          batch_completion: true,
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
