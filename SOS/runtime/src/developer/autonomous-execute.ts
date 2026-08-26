import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import type { RuntimeConfig } from "../config.js";
import type { DeveloperPaths } from "./paths.js";
import type {
  DeveloperRuntimeState,
  ExecutionReport,
  ParsedBrief,
  WorkPlan,
  ImplementationPlan,
} from "./types.js";
import { parseBriefMarkdown } from "./queue.js";
import { runImplementationStrategy } from "./strategies/index.js";
import { runFounderFileValidation, runProjectValidation } from "./validate.js";
import { matchesFounderFileTask } from "./strategies/founder-file.js";
import { filterAllowedEdits } from "./safety.js";
import { writeExecutionReport, notifyPmDeveloperHandoff } from "./reports.js";
import { emitProgress } from "./progress.js";
import { saveDeveloperState } from "./state.js";
import { releaseLock } from "./queue.js";

export type AutonomousExecuteResult = {
  task_id: string;
  execution_report_path: string;
  pm_report_path: string | null;
  ready_for_qa: boolean;
  files_changed: string[];
};

async function loadWorkPlan(paths: DeveloperPaths, taskId: string): Promise<WorkPlan> {
  const path = join(paths.workPlans, `${taskId}.json`);
  return JSON.parse(await readFile(path, "utf8")) as WorkPlan;
}

async function loadImplementationPlan(
  paths: DeveloperPaths,
  taskId: string,
): Promise<ImplementationPlan | null> {
  const path = join(paths.implementationPlans, `${taskId}.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(await readFile(path, "utf8")) as ImplementationPlan;
}

async function loadBriefFromState(
  paths: DeveloperPaths,
  state: DeveloperRuntimeState,
): Promise<ParsedBrief> {
  if (!state.claimed_brief_path || !existsSync(state.claimed_brief_path)) {
    throw new Error(`Brief not found for task ${state.current_task_id}`);
  }
  const content = await readFile(state.claimed_brief_path, "utf8");
  return parseBriefMarkdown(content, state.claimed_brief_path);
}

function isBlockedByHardGates(brief: ParsedBrief): string | null {
  const blocked = ["H3", "H4", "H1", "H2"];
  for (const g of brief.hard_gate_ids) {
    if (blocked.includes(g)) {
      return `Hard gate ${g} — cannot modify restricted resources without Commander approval`;
    }
  }
  return null;
}

export async function executePreparedTask(
  config: RuntimeConfig,
  paths: DeveloperPaths,
  state: DeveloperRuntimeState,
): Promise<AutonomousExecuteResult | null> {
  const taskId = state.current_task_id;
  if (!taskId || !state.work_plan_path) return null;
  if (state.execution_submitted) return null;
  if (state.state !== "working" && state.state !== "prepared") return null;

  const startedAt = Date.now();
  state.state = "executing";
  await saveDeveloperState(paths, state);

  const brief = await loadBriefFromState(paths, state);
  const workPlan = await loadWorkPlan(paths, taskId);
  await loadImplementationPlan(paths, taskId);

  await emitProgress(paths, taskId, brief.correlation_id, "execution_started", "Autonomous execution started", 30);

  const gateBlock = isBlockedByHardGates(brief);
  if (gateBlock) {
    const report = await writeExecutionReport(paths, {
      task_id: taskId,
      correlation_id: brief.correlation_id,
      status: "blocked",
      created_at: new Date(startedAt).toISOString(),
      completed_at: new Date().toISOString(),
      implementation_summary: gateBlock,
      diff_summary: "",
      files_changed: [],
      validation: emptyValidation(Date.now() - startedAt, ["hard gate blocked"]),
      blockers: [gateBlock],
      recommendations: ["Request Commander approval for hard-gated changes"],
      ready_for_qa: false,
      confidence: 20,
    });
    state.blocked_task_ids.push(taskId);
    state.state = "blocked";
    state.execution_submitted = true;
    await saveDeveloperState(paths, state);
    return {
      task_id: taskId,
      execution_report_path: report,
      pm_report_path: null,
      ready_for_qa: false,
      files_changed: [],
    };
  }

  let strategyOutput;
  let blockers: string[] = [];
  let recommendations: string[] = [];

  try {
    strategyOutput = await runImplementationStrategy(config, brief, workPlan);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    blockers.push(msg);
    const report = await writeExecutionReport(paths, {
      task_id: taskId,
      correlation_id: brief.correlation_id,
      status: "failed",
      created_at: new Date(startedAt).toISOString(),
      completed_at: new Date().toISOString(),
      implementation_summary: `Execution failed: ${msg}`,
      diff_summary: "",
      files_changed: [],
      validation: emptyValidation(Date.now() - startedAt, [msg]),
      blockers,
      recommendations: ["PM review required for manual implementation path"],
      ready_for_qa: false,
      confidence: 30,
    });
    state.blocked_task_ids.push(taskId);
    state.state = "blocked";
    state.execution_submitted = true;
    await saveDeveloperState(paths, state);
    return {
      task_id: taskId,
      execution_report_path: report,
      pm_report_path: null,
      ready_for_qa: false,
      files_changed: [],
    };
  }

  const { allowed, rejected } = filterAllowedEdits(strategyOutput.files_changed, brief.evidence);
  if (rejected.length > 0) {
    blockers.push(...rejected.map((r) => r.reason));
  }

  const lintTargets =
    allowed.length > 0 ? allowed : brief.evidence.filter((e) => /\.(tsx?|jsx?)$/.test(e));
  const validation = matchesFounderFileTask(brief)
    ? await runFounderFileValidation(config.repoRoot, allowed)
    : await runProjectValidation(config.repoRoot, lintTargets);
  if (!validation.all_passed) {
    blockers.push(...validation.failures);
  }

  recommendations = [
    ...brief.qa_checklist,
    "QA should verify changes against PM brief acceptance criteria",
  ];

  const ready_for_qa = blockers.length === 0 && validation.all_passed;
  const confidence = ready_for_qa ? (strategyOutput.files_changed.length ? 88 : 92) : 45;

  const report = await writeExecutionReport(paths, {
    task_id: taskId,
    correlation_id: brief.correlation_id,
    status: ready_for_qa ? "completed" : "failed",
    created_at: new Date(startedAt).toISOString(),
    completed_at: new Date().toISOString(),
    implementation_summary: strategyOutput.implementation_summary,
    diff_summary: strategyOutput.diff_summary,
    files_changed: allowed,
    validation: {
      build: validation.build,
      lint: validation.lint,
      test: validation.test,
      execution_duration_ms: validation.execution_duration_ms,
      warnings: validation.warnings,
      failures: validation.failures,
    },
    blockers,
    recommendations,
    ready_for_qa,
    confidence,
  });

  let pmReportPath: string | null = null;
  if (ready_for_qa) {
    pmReportPath = await notifyPmDeveloperHandoff(paths, brief, {
      summary: strategyOutput.implementation_summary,
      files_changed: allowed,
      build_passed: validation.all_passed,
      confidence,
      evidence: brief.evidence,
      diff_summary: strategyOutput.diff_summary,
      qa_checklist: brief.qa_checklist,
      needs_qa: true,
      estimated_regression_risk: validation.all_passed ? "low" : "medium",
      acceptance_criteria: brief.acceptance_criteria,
    });
    state.handed_off_task_ids.push(taskId);
    state.state = "awaiting_qa";
  } else {
    state.blocked_task_ids.push(taskId);
    state.state = "blocked";
  }

  state.execution_submitted = true;
  state.execution_report_path = report;
  await releaseLock(paths, taskId);
  await saveDeveloperState(paths, state);

  await emitProgress(
    paths,
    taskId,
    brief.correlation_id,
    ready_for_qa ? "execution_complete" : "blocked",
    ready_for_qa ? "Handed off to PM for QA routing" : blockers.join("; "),
    ready_for_qa ? 100 : 50,
    { pm_report: pmReportPath, ready_for_qa },
  );

  return {
    task_id: taskId,
    execution_report_path: report,
    pm_report_path: pmReportPath,
    ready_for_qa,
    files_changed: allowed,
  };
}

function emptyValidation(
  durationMs: number,
  failures: string[],
): ExecutionReport["validation"] {
  return {
    build: { passed: false, duration_ms: 0, output: "" },
    lint: { passed: false, duration_ms: 0, output: "" },
    test: { passed: false, duration_ms: 0, output: "", skipped: true, reason: "not run" },
    execution_duration_ms: durationMs,
    warnings: [],
    failures,
  };
}
