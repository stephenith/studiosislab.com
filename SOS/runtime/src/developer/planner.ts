import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { RuntimeConfig } from "../config.js";
import type { ParsedBrief, ExecutionPlan } from "./types.js";
import type { DeveloperPaths } from "./paths.js";

function inferComplexity(brief: ParsedBrief): ExecutionPlan["estimated_complexity"] {
  const srcFiles = brief.evidence.filter((e) => e.startsWith("src/")).length;
  if (brief.hard_gate_ids.length > 0 || srcFiles > 3) return "high";
  if (srcFiles > 0) return "medium";
  return "low";
}

function inferUnknowns(brief: ParsedBrief): string[] {
  const unknowns: string[] = [];
  if (brief.description.toLowerCase().includes("needs verification")) {
    unknowns.push("Backlog item marked Needs Verification");
  }
  for (const path of brief.evidence) {
    if (!existsSync(join(process.cwd(), path)) && !path.startsWith("SOS/")) {
      unknowns.push(`Evidence path not found at repo root: ${path}`);
    }
  }
  if (brief.hard_gate_ids.includes("H3")) {
    unknowns.push("Firestore rules change requires Commander approval before merge");
  }
  return unknowns;
}

function buildSteps(brief: ParsedBrief): string[] {
  const steps: string[] = [
    "Read and validate all evidence files in scope",
    "Identify minimal change set for objective",
  ];

  const text = `${brief.title} ${brief.description}`.toLowerCase();
  if (text.includes("mobile") && text.includes("hub")) {
    steps.push("Add viewport-aware routing in ResumeHubClient.tsx");
    steps.push("Verify mobile editor route /editor/mobile/template/{id}");
  }
  if (brief.evidence.some((e) => e.includes("templateSeoContent"))) {
    steps.push("Add SEO entries following existing templateSeoContent.ts pattern");
  }
  if (brief.evidence.every((e) => e.startsWith("SOS/"))) {
    steps.push("Update SOS documentation from repository evidence");
  }

  steps.push("Run npm run build and npm run lint");
  steps.push("Write PM completion report");
  return steps;
}

export async function createExecutionPlan(
  config: RuntimeConfig,
  paths: DeveloperPaths,
  brief: ParsedBrief,
): Promise<ExecutionPlan> {
  const repoRoot = config.repoRoot;
  const filesInvolved = brief.evidence.filter((e) => {
    const full = join(repoRoot, e);
    return existsSync(full) || e.startsWith("src/") || e.startsWith("SOS/");
  });

  const plan: ExecutionPlan = {
    plan_id: randomUUID(),
    task_id: brief.task_id,
    correlation_id: brief.correlation_id,
    created_at: new Date().toISOString(),
    objective: brief.title,
    files_involved: filesInvolved.length ? filesInvolved : brief.evidence,
    risk:
      brief.hard_gate_ids.length ?
        `Hard gates present: ${brief.hard_gate_ids.join(", ")}. Changes may require Commander approval.`
      : "Standard implementation risk within brief scope.",
    estimated_complexity: inferComplexity(brief),
    acceptance_criteria: [
      "Objective met per PM brief",
      "npm run build passes",
      "npm run lint passes",
      "Completion report written for PM",
      "No out-of-scope changes",
    ],
    unknowns: inferUnknowns(brief),
    steps: buildSteps(brief),
  };

  const planPath = join(paths.plans, `${brief.task_id}.json`);
  const { writeFile, mkdir } = await import("node:fs/promises");
  await mkdir(paths.plans, { recursive: true });
  await writeFile(planPath, JSON.stringify(plan, null, 2), "utf8");

  return plan;
}

export async function loadPlan(
  paths: DeveloperPaths,
  taskId: string,
): Promise<ExecutionPlan | null> {
  const planPath = join(paths.plans, `${taskId}.json`);
  if (!existsSync(planPath)) return null;
  return JSON.parse(await readFile(planPath, "utf8")) as ExecutionPlan;
}
