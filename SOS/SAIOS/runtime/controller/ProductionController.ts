/**
 * Production Controller — the ONLY founder entry point for StudiosisLab production.
 * Orchestrates only — never executes work, researches, or edits code.
 */
import { createMockCursorExecutor } from "../directors/resume-production/CursorResearchCoordinator.js";
import { ensureVerifyDirs, runPipeline } from "../pipeline/PipelineOrchestrator.js";
import { createMockCursorResearchExecutor } from "../research/ResearchCoordinator.js";
import { runResearchSession } from "../research/ResearchDirector.js";
import { interpretFounderObjective } from "./CommandInterpreter.js";
import { planObjective } from "./ObjectivePlanner.js";
import {
  allocateProductionSessionId,
  createProductionSession,
  persistSession,
  updateSessionPhase,
  writeSessionReport,
} from "./ProductionSession.js";
import { appendToHistory } from "./ProductionHistory.js";
import { buildDashboard, persistDashboard } from "./ProductionDashboard.js";
import type { ControllerRunResult, ProductionSessionRecord } from "./types.js";
import type { CursorExecutor } from "../directors/resume-production/CursorResearchCoordinator.js";
import type { CursorResearchExecutor } from "../research/ResearchCoordinator.js";
import {
  ENGINES,
  acquireExecutionLock,
  enforceEngineAccess,
} from "../../architecture/runtime-guard.js";

export const PRODUCTION_CONTROLLER = {
  controller_type: "studiosislab-production-controller",
  version: "1.0.0",
  display_name: "StudiosisLab Production Controller",
  description:
    "The only founder entry point for StudiosisLab production. Accepts objectives and delegates to research, pipeline, QA, review, and learning.",
  role: "orchestration_only",
  forbidden: ["execute_work", "research_directly", "edit_code", "generate_templates"],
  architecture_status: "LEGACY",
  architecture_note:
    "Agent #160 runtime freeze — intake valuable; session engine is not the canonical spine.",
} as const;

export type SubmitObjectiveOptions = {
  objective: string;
  session_id?: string;
  cursor_executor?: CursorExecutor;
  research_executor?: CursorResearchExecutor;
  mcp_firecrawl_available?: boolean;
  mock_founder_decision?: "APPROVE" | "REJECT" | "REVISE";
  learning_persist?: boolean;
  isolated_dirs?: string;
};

export async function submitFounderObjective(
  options: SubmitObjectiveOptions,
): Promise<ControllerRunResult> {
  enforceEngineAccess(ENGINES.LEGACY_CONTROLLER);
  const releaseLock = acquireExecutionLock(ENGINES.LEGACY_CONTROLLER.id);
  try {
    return await submitFounderObjectiveInner(options);
  } finally {
    releaseLock();
  }
}

async function submitFounderObjectiveInner(
  options: SubmitObjectiveOptions,
): Promise<ControllerRunResult> {
  const start = Date.now();
  const session_id = options.session_id ?? allocateProductionSessionId();

  const command = interpretFounderObjective(options.objective);
  const plan = planObjective(command);

  let session = createProductionSession({
    session_id,
    objective: options.objective,
    command,
    plan,
  });
  session = updateSessionPhase(session, "planned");
  persistSession(session);

  if (!command.supported) {
    return finalizeSession(session, start, {
      pass: false,
      error: command.unsupported_reason ?? "Unsupported objective",
    });
  }

  if (command.intent === "analyze") {
    return runAnalysisOnly(session, options, start);
  }

  const researchExecutor =
    options.research_executor ?? createMockCursorResearchExecutor({ failure_rate: 0 });
  const pipelineExecutor = options.cursor_executor ?? createMockCursorExecutor({ failure_rate: 0 });

  if (plan.needs_research) {
    session = updateSessionPhase(session, "researching");
    persistSession(session);

    const research = await runResearchSession({
      objective: options.objective,
      cursor_executor: researchExecutor,
      mcp_firecrawl_available: options.mcp_firecrawl_available ?? false,
      persist: true,
    });

    session = {
      ...session,
      research_session_id: research.session_id,
      research_dir: research.session_dir,
      confidence: research.design_brief.confidence,
    };
    persistSession(session);

    if (!research.pass) {
      return finalizeSession(session, start, {
        pass: false,
        error: "Research validation failed",
      });
    }
  }

  if (plan.job_count > 0) {
    session = updateSessionPhase(session, "pipeline");
    persistSession(session);

    const verifyRoot = options.isolated_dirs ?? session.session_dir;
    const { jobsDir, registryDir } = ensureVerifyDirs(verifyRoot);

    const pipeline = await runPipeline({
      objective: options.objective,
      priority: plan.priority,
      cursor_executor: pipelineExecutor,
      mcp_firecrawl_available: options.mcp_firecrawl_available ?? false,
      mock_founder_decision: options.mock_founder_decision ?? "APPROVE",
      learning_persist: options.learning_persist ?? false,
      queue_jobs_dir: jobsDir,
      registry_dir: registryDir,
    });

    session = {
      ...session,
      pipeline_run_id: pipeline.run_id,
      pipeline_dir: pipeline.run_dir,
      phase: pipeline.awaiting_founder ? "approval" : "learning",
      jobs_completed: 1,
      qa_pass: pipeline.state.completed_stages.includes("qa"),
      founder_decision: pipeline.state.founder_decision,
      learning_applied: pipeline.state.completed_stages.includes("learning"),
      templates_generated: pipeline.pass ? 1 : 0,
      confidence: session.confidence ?? 88,
    };
    persistSession(session);

    if (!pipeline.pass && !pipeline.awaiting_founder) {
      return finalizeSession(session, start, {
        pass: false,
        error: pipeline.state.error ?? "Pipeline failed",
      });
    }
  }

  return finalizeSession(session, start, { pass: true });
}

async function runAnalysisOnly(
  session: ProductionSessionRecord,
  options: SubmitObjectiveOptions,
  start: number,
): Promise<ControllerRunResult> {
  const researchExecutor =
    options.research_executor ?? createMockCursorResearchExecutor({ failure_rate: 0 });

  session = updateSessionPhase(session, "researching");
  persistSession(session);

  const research = await runResearchSession({
    objective: options.objective,
    cursor_executor: researchExecutor,
    mcp_firecrawl_available: options.mcp_firecrawl_available ?? false,
    persist: true,
  });

  session = {
    ...session,
    research_session_id: research.session_id,
    research_dir: research.session_dir,
    confidence: research.design_brief.confidence,
    phase: "completed",
  };

  return finalizeSession(session, start, { pass: research.pass });
}

function finalizeSession(
  session: ProductionSessionRecord,
  start: number,
  outcome: { pass: boolean; error?: string },
): ControllerRunResult {
  const completed_at = new Date().toISOString();
  const duration_ms = Date.now() - start;

  const final: ProductionSessionRecord = {
    ...session,
    phase: outcome.pass ? "completed" : "failed",
    completed_at,
    duration_ms,
    pass: outcome.pass,
    error: outcome.error ?? null,
    final_report_path: writeSessionReport(
      session,
      renderFinalReport({ ...session, completed_at, duration_ms, pass: outcome.pass }),
    ),
  };

  persistSession(final);
  appendToHistory(final);
  const dashboard = buildDashboard(null);
  persistDashboard(dashboard);

  return { pass: outcome.pass, session: final, dashboard };
}

function renderFinalReport(session: ProductionSessionRecord): string {
  return [
    "# Production Session Report",
    "",
    `**Session:** \`${session.session_id}\``,
    `**Objective:** ${session.objective}`,
    `**Status:** ${session.pass ? "PASS" : "FAIL"}`,
    `**Duration:** ${session.duration_ms}ms`,
    "",
    "## Plan",
    "",
    `- Jobs: ${session.plan.job_count}`,
    `- Batch size: ${session.plan.batch_size}`,
    `- Priority: ${session.plan.priority}`,
    `- Research: ${session.plan.needs_research ? "yes" : "no"}`,
    `- Workers: ${session.plan.workers.map((w) => w.worker_type).join(", ")}`,
    "",
    "## Delegation",
    "",
    `| Stage | Result |`,
    `|-------|--------|`,
    `| Research | ${session.research_session_id ?? "—"} |`,
    `| Pipeline | ${session.pipeline_run_id ?? "—"} |`,
    `| QA | ${session.qa_pass === null ? "—" : session.qa_pass ? "PASS" : "FAIL"} |`,
    `| Approval | ${session.founder_decision ?? "pending"} |`,
    `| Learning | ${session.learning_applied ? "applied" : "—"} |`,
    `| Templates | ${session.templates_generated} |`,
  ].join("\n");
}

export { interpretFounderObjective, planObjective, buildDashboard };
