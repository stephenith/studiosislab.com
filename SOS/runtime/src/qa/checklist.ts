import { writeFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { QaPaths } from "./paths.js";
import type {
  ChecklistItem,
  DeveloperReportInput,
  ParsedQaBrief,
} from "./types.js";
import type { WorkPlan, ImplementationPlan } from "../developer/types.js";
import { existsSync } from "node:fs";

export async function loadDeveloperReport(
  paths: QaPaths,
  taskId: string,
): Promise<DeveloperReportInput | null> {
  const file = join(paths.pmDevReports, `${taskId}.json`);
  if (!existsSync(file)) return null;
  return JSON.parse(await readFile(file, "utf8")) as DeveloperReportInput;
}

export async function loadDeveloperPlan(
  paths: QaPaths,
  taskId: string,
): Promise<WorkPlan | null> {
  const file = join(paths.devWorkPlans, `${taskId}.json`);
  if (!existsSync(file)) return null;
  return JSON.parse(await readFile(file, "utf8")) as WorkPlan;
}

export async function loadImplementationPlan(
  paths: QaPaths,
  taskId: string,
): Promise<ImplementationPlan | null> {
  const file = join(paths.devImplPlans, `${taskId}.json`);
  if (!existsSync(file)) return null;
  return JSON.parse(await readFile(file, "utf8")) as ImplementationPlan;
}

export async function loadDeveloperExecutionReport(
  paths: QaPaths,
  taskId: string,
): Promise<Record<string, unknown> | null> {
  const file = join(paths.devExecutionReports, `${taskId}-execution.json`);
  if (!existsSync(file)) return null;
  return JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>;
}

export function buildChecklist(
  brief: ParsedQaBrief,
  devReport: DeveloperReportInput | null,
  plan: WorkPlan | null,
  implPlan: ImplementationPlan | null,
): ChecklistItem[] {
  const items: ChecklistItem[] = [
    {
      id: "CHK-001",
      description: "Developer completion report exists",
      source: "acceptance",
      required: true,
    },
    {
      id: "CHK-002",
      description: "Developer did not report blocker",
      source: "acceptance",
      required: true,
    },
    {
      id: "CHK-003",
      description: "Developer build_passed flag is true",
      source: "acceptance",
      required: true,
    },
    {
      id: "CHK-004",
      description: "Developer confidence >= 50%",
      source: "acceptance",
      required: true,
    },
    {
      id: "CHK-005",
      description: "correlation_id matches between brief and developer report",
      source: "brief",
      required: true,
    },
  ];

  const acceptance =
    brief.acceptance_criteria.length > 0
      ? brief.acceptance_criteria
      : devReport?.acceptance_criteria ?? [];

  for (const [i, criterion] of acceptance.entries()) {
    items.push({
      id: `CHK-ACCEPT-${i + 1}`,
      description: criterion,
      source: "acceptance",
      required: true,
    });
  }

  if (implPlan?.phases?.length) {
    let stepNum = 0;
    for (const phase of implPlan.phases) {
      for (const step of phase.steps) {
        stepNum += 1;
        items.push({
          id: `CHK-PLAN-${stepNum}`,
          description: `Plan step documented: ${step}`,
          source: "acceptance",
          required: false,
        });
      }
    }
  } else if (plan) {
    items.push({
      id: "CHK-PLAN-1",
      description: `Work plan objective: ${plan.objective}`,
      source: "acceptance",
      required: false,
    });
  }

  const devChecklist =
    devReport?.qa_checklist?.length ? devReport.qa_checklist : brief.qa_checklist;

  if (devChecklist?.length) {
    for (const [i, line] of devChecklist.entries()) {
      items.push({
        id: `CHK-DEV-${i + 1}`,
        description: line,
        source: "developer",
        required: true,
      });
    }
  }

  items.push({
    id: "CHK-RISK",
    description: "Regression risk documented in developer report",
    source: "risk",
    required: false,
  });

  items.push({
    id: "CHK-FOCUS",
    description: `QA focus: ${brief.objective}`,
    source: "brief",
    required: false,
  });

  return items;
}

export async function saveChecklist(
  paths: QaPaths,
  taskId: string,
  items: ChecklistItem[],
): Promise<string> {
  const out = join(paths.checklists, `${taskId}.json`);
  await mkdir(paths.checklists, { recursive: true });
  await writeFile(
    out,
    JSON.stringify({ task_id: taskId, created_at: new Date().toISOString(), items }, null, 2),
    "utf8",
  );
  return out;
}

export function fileExistsAtRepo(repoRoot: string, relPath: string): boolean {
  return existsSync(join(repoRoot, relPath));
}

export function verificationKey(taskId: string, devReport: DeveloperReportInput | null): string {
  return `${taskId}:${devReport?.completed_at ?? "no-dev-report"}`;
}
