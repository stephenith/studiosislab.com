import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import type { RuntimeConfig } from "../config.js";
import type { DeveloperPaths } from "./paths.js";
import type {
  DeveloperRuntimeState,
  ExecutionReportPlaceholder,
  ImplementationPlan,
  ParsedBrief,
  WorkPlan,
} from "./types.js";
import { claimTask } from "./queue.js";
import { saveDeveloperState } from "./state.js";
import { emitProgress } from "./progress.js";

function inferRisks(brief: ParsedBrief): string[] {
  const risks: string[] = [];
  if (brief.hard_gate_ids.length > 0) {
    risks.push(`Hard gates: ${brief.hard_gate_ids.join(", ")}`);
  }
  if (brief.evidence.some((e) => e.startsWith("src/"))) {
    risks.push("Touches application source — regression risk on launch paths");
  }
  if (brief.description.toLowerCase().includes("needs verification")) {
    risks.push("Backlog item has unresolved verification gaps");
  }
  return risks;
}

function inferUnknowns(brief: ParsedBrief, repoRoot: string): string[] {
  const unknowns: string[] = [];
  for (const path of brief.evidence) {
    const full = join(repoRoot, path);
    if (!existsSync(full) && !path.startsWith("SOS/")) {
      unknowns.push(`Evidence path not found: ${path}`);
    }
  }
  return unknowns;
}

function buildImplementationPhases(brief: ParsedBrief): ImplementationPlan["phases"] {
  const srcFiles = brief.evidence.filter((e) => e.startsWith("src/"));
  const sosFiles = brief.evidence.filter((e) => e.startsWith("SOS/"));

  const phases: ImplementationPlan["phases"] = [
    {
      phase: 1,
      name: "Analysis",
      steps: [
        `Read objective: ${brief.objective}`,
        "Review acceptance criteria and files in scope",
        "Confirm hard gates and out-of-scope boundaries",
        ...brief.evidence.map((e) => `Inspect evidence: ${e}`),
      ],
      files: brief.evidence,
    },
    {
      phase: 2,
      name: "Implementation",
      steps: [
        "Apply minimal change set aligned to objective",
        ...(srcFiles.length ? srcFiles.map((f) => `Modify ${f} per plan`) : ["Document SOS-scoped changes"]),
        ...(sosFiles.length ? sosFiles.map((f) => `Update ${f}`) : []),
      ],
      files: srcFiles.length ? srcFiles : sosFiles,
    },
    {
      phase: 3,
      name: "Validation",
      steps: [
        "Run npm run build",
        "Run npm run lint",
        "Verify acceptance criteria",
        `Write completion report to ${brief.report_path}`,
      ],
      files: brief.evidence,
    },
  ];

  return phases;
}

export async function createWorkPlan(
  config: RuntimeConfig,
  paths: DeveloperPaths,
  brief: ParsedBrief,
): Promise<WorkPlan> {
  await mkdir(paths.workPlans, { recursive: true });

  const plan: WorkPlan = {
    work_plan_id: randomUUID(),
    task_id: brief.task_id,
    correlation_id: brief.correlation_id,
    created_at: new Date().toISOString(),
    objective: brief.objective,
    title: brief.title,
    acceptance_criteria: brief.acceptance_criteria.length
      ? brief.acceptance_criteria
      : [
          "Objective met per PM brief",
          "npm run build passes",
          "npm run lint passes",
          "Completion report written for PM",
        ],
    files_in_scope: brief.evidence,
    hard_gates: brief.hard_gate_ids,
    pm_recommendation: brief.pm_recommendation || "Proceed per brief scope.",
    risks: inferRisks(brief),
    unknowns: inferUnknowns(brief, config.repoRoot),
  };

  const out = join(paths.workPlans, `${brief.task_id}.json`);
  await writeFile(out, JSON.stringify(plan, null, 2), "utf8");
  return plan;
}

export async function createImplementationPlan(
  paths: DeveloperPaths,
  brief: ParsedBrief,
): Promise<ImplementationPlan> {
  await mkdir(paths.implementationPlans, { recursive: true });

  const plan: ImplementationPlan = {
    implementation_plan_id: randomUUID(),
    task_id: brief.task_id,
    correlation_id: brief.correlation_id,
    created_at: new Date().toISOString(),
    status: "pending_execution",
    objective: brief.objective,
    phases: buildImplementationPhases(brief),
    validation: ["npm run build", "npm run lint"],
    out_of_scope: [
      "Unrelated refactors",
      "package.json dependency changes without approval",
      "firestore.rules / storage.rules without approval",
      "Merge to main",
    ],
  };

  const out = join(paths.implementationPlans, `${brief.task_id}.json`);
  await writeFile(out, JSON.stringify(plan, null, 2), "utf8");
  return plan;
}

export async function createExecutionReportPlaceholder(
  paths: DeveloperPaths,
  brief: ParsedBrief,
): Promise<ExecutionReportPlaceholder> {
  await mkdir(paths.reports, { recursive: true });

  const placeholder: ExecutionReportPlaceholder = {
    task_id: brief.task_id,
    correlation_id: brief.correlation_id,
    status: "pending",
    created_at: new Date().toISOString(),
    summary: null,
    files_changed: [],
    build_passed: null,
    confidence: null,
    blocker: false,
    blocker_reason: null,
    evidence: brief.evidence,
    needs_qa: null,
    note: "Awaiting developer execution phase — placeholder created by autonomous prepare pipeline",
  };

  const out = join(paths.reports, `${brief.task_id}-execution.json`);
  await writeFile(out, JSON.stringify(placeholder, null, 2), "utf8");
  return placeholder;
}

export type PrepareResult = {
  task_id: string;
  brief_path: string;
  work_plan_path: string;
  implementation_plan_path: string;
  execution_report_path: string;
};

export async function prepareTaskFromBrief(
  config: RuntimeConfig,
  paths: DeveloperPaths,
  state: DeveloperRuntimeState,
  brief: ParsedBrief,
): Promise<PrepareResult> {
  state.state = "working";
  state.current_task_id = brief.task_id;
  state.current_correlation_id = brief.correlation_id;
  state.claimed_brief_path = brief.brief_path;
  await saveDeveloperState(paths, state);

  await claimTask(paths, brief);

  await emitProgress(
    paths,
    brief.task_id,
    brief.correlation_id,
    "execution_started",
    "Brief detected — preparing work plan",
    5,
    { brief_path: brief.brief_path },
  );

  const workPlan = await createWorkPlan(config, paths, brief);
  const implPlan = await createImplementationPlan(paths, brief);
  const placeholder = await createExecutionReportPlaceholder(paths, brief);

  const workPlanPath = join(paths.workPlans, `${brief.task_id}.json`);
  const implPlanPath = join(paths.implementationPlans, `${brief.task_id}.json`);
  const execReportPath = join(paths.reports, `${brief.task_id}-execution.json`);

  state.work_plan_path = workPlanPath;
  state.implementation_plan_path = implPlanPath;
  state.execution_report_path = execReportPath;
  state.processed_brief_ids.push(brief.task_id);
  state.state = "working";

  await emitProgress(
    paths,
    brief.task_id,
    brief.correlation_id,
    "planning_complete",
    `Prepared: work plan, implementation plan, execution placeholder`,
    20,
    {
      work_plan_id: workPlan.work_plan_id,
      implementation_plan_id: implPlan.implementation_plan_id,
    },
  );

  await saveDeveloperState(paths, state);

  return {
    task_id: brief.task_id,
    brief_path: brief.brief_path,
    work_plan_path: workPlanPath,
    implementation_plan_path: implPlanPath,
    execution_report_path: execReportPath,
  };
}
