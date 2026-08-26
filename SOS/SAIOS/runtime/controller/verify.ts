#!/usr/bin/env tsx
/**
 * Self-test — founder objective through controller → research → pipeline → QA → learning.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { interpretFounderObjective } from "./CommandInterpreter.js";
import { planObjective } from "./ObjectivePlanner.js";
import { PRODUCTION_CONTROLLER, submitFounderObjective } from "./ProductionController.js";
import { loadHistoryIndex } from "./ProductionHistory.js";
import { CONTROLLER_ROOT } from "./ProductionSession.js";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function main(): Promise<void> {
  assert(
    PRODUCTION_CONTROLLER.controller_type === "studiosislab-production-controller",
    "controller type",
  );
  assert(PRODUCTION_CONTROLLER.role === "orchestration_only", "orchestration only");

  const cmd = interpretFounderObjective(
    "Generate one modern ATS professional resume for software engineer founder review.",
  );
  assert(cmd.intent === "generate", "intent generate");
  assert(cmd.product_type === "resume", "product resume");
  assert(cmd.priority === "ats", "ats priority");

  const plan = planObjective(cmd);
  assert(plan.needs_research, "research planned");
  assert(plan.workers.some((w) => w.worker_type === "resume-production-worker"), "production worker");
  assert(plan.pipeline_stages.includes("qa"), "qa stage");
  assert(plan.pipeline_stages.includes("learning"), "learning stage");

  const result = await submitFounderObjective({
    objective:
      "Generate one modern ATS professional resume for software engineer founder review.",
    mcp_firecrawl_available: true,
    mock_founder_decision: "APPROVE",
    learning_persist: false,
  });

  assert(result.pass, "controller pass");
  assert(result.session.pass, "session pass");
  assert(result.session.research_session_id, "research delegated");
  assert(result.session.pipeline_run_id, "pipeline delegated");
  assert(result.session.qa_pass === true, "qa pass");
  assert(result.session.learning_applied, "learning applied");
  assert(result.session.templates_generated === 1, "one template");
  assert(result.session.founder_decision === "APPROVE", "founder approved");

  const sessionDir = result.session.session_dir;
  assert(existsSync(join(sessionDir, "session.json")), "session.json");
  assert(existsSync(result.session.final_report_path!), "final report");

  const dashboardPath = join(CONTROLLER_ROOT, "dashboard.json");
  assert(existsSync(dashboardPath), "dashboard.json");
  assert(result.dashboard.completed_sessions >= 1, "dashboard sessions");

  const history = loadHistoryIndex();
  assert(history.sessions.some((s) => s.session_id === result.session.session_id), "history entry");

  const invoice = interpretFounderObjective("Create Invoice templates");
  assert(invoice.product_type === "invoice", "invoice parsed");
  assert(invoice.supported === false, "invoice not yet supported");

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "studiosislab-production-controller",
        session_id: result.session.session_id,
        duration_ms: result.session.duration_ms,
        research_session_id: result.session.research_session_id,
        pipeline_run_id: result.session.pipeline_run_id,
        templates_generated: result.session.templates_generated,
        confidence: result.session.confidence,
        approval_rate: result.dashboard.approval_rate,
        checks: {
          interpret: true,
          plan: true,
          research: Boolean(result.session.research_session_id),
          pipeline: Boolean(result.session.pipeline_run_id),
          qa: result.session.qa_pass === true,
          learning: result.session.learning_applied,
          history: true,
          dashboard: true,
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
