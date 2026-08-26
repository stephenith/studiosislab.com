/**
 * Artifact collector — load QA reports and premium generator artifacts.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { LoadedTemplateContext } from "./types.js";

const SOS_ROOT = resolve(import.meta.dirname, "../../..");
export const GENERATED_ROOT = join(SOS_ROOT, "07_LOGS/saios/generated-resumes");
export const QA_ROOT = join(SOS_ROOT, "07_LOGS/saios/qa");

export function findLatestPremiumPrototype(): string {
  if (!existsSync(GENERATED_ROOT)) {
    throw new Error("No generated resumes found");
  }
  const dirs = readdirSync(GENERATED_ROOT)
    .filter((d) => d.endsWith("-v3") && existsSync(join(GENERATED_ROOT, d, "template-preview.json")))
    .sort();
  const latest = dirs[dirs.length - 1];
  if (!latest) throw new Error("No v3 premium prototype found for critic review");
  return join(GENERATED_ROOT, latest);
}

export function loadTemplateArtifacts(prototype_dir: string): LoadedTemplateContext {
  const prototype_id = prototype_dir.split("/").pop() ?? "unknown";
  const qa_dir = join(QA_ROOT, prototype_id);
  const qa_validation_path = join(qa_dir, "validation.json");

  if (!existsSync(qa_validation_path)) {
    throw new Error(`QA validation not found: ${qa_validation_path}`);
  }

  const qa = JSON.parse(readFileSync(qa_validation_path, "utf8")) as {
    pass: boolean;
    stages_passed: number;
    stages_total: number;
  };

  const premium_path = join(prototype_dir, "premium-score.json");
  const premium_scores = existsSync(premium_path)
    ? (JSON.parse(readFileSync(premium_path, "utf8")) as Record<string, number>)
    : null;

  const design_plan_path = join(prototype_dir, "design-plan.json");
  const design_plan = existsSync(design_plan_path)
    ? (JSON.parse(readFileSync(design_plan_path, "utf8")) as Record<string, unknown>)
    : null;

  const validation_path = join(prototype_dir, "validation.json");
  const validation = existsSync(validation_path)
    ? (JSON.parse(readFileSync(validation_path, "utf8")) as Record<string, unknown>)
    : null;

  const objective =
    (design_plan?.objective as string) ??
    "Premium resume template for founder review";

  const family_id = (design_plan?.family_id as string) ?? "corporate-modern";

  return {
    prototype_id,
    prototype_dir,
    qa_pass: qa.pass,
    qa_overall_pass: qa.pass,
    qa_stages_passed: qa.stages_passed,
    qa_stages_total: qa.stages_total,
    premium_scores,
    design_plan,
    validation,
    objective,
    family_id,
  };
}

export function loadQAStageReports(prototype_id: string): Record<string, unknown> {
  const qa_dir = join(QA_ROOT, prototype_id);
  const stages = ["alignment", "spacing", "typography", "ats", "editor", "fabric", "thumbnail", "seo"];
  const reports: Record<string, unknown> = {};
  for (const stage of stages) {
    const path = join(qa_dir, `${stage}.json`);
    if (existsSync(path)) {
      reports[stage] = JSON.parse(readFileSync(path, "utf8"));
    }
  }
  return reports;
}
