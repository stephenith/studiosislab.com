/**
 * Approval collector — consume QA, Founder Critic, Premium Generator outputs.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadTemplateContext, GENERATED_ROOT } from "../workers/resume-qa/template-input.js";
import type { CollectedApprovalContext } from "./types.js";

const SOS_ROOT = resolve(import.meta.dirname, "../../..");
const QA_ROOT = join(SOS_ROOT, "07_LOGS/saios/qa");
const CRITIC_ROOT = join(SOS_ROOT, "07_LOGS/saios/founder-critic/reviews");

export function findFounderApprovedPrototype(): string {
  if (!existsSync(GENERATED_ROOT)) {
    throw new Error("No generated resumes found");
  }
  const preferred = join(GENERATED_ROOT, "modern-ats-professional-v1-v3");
  if (existsSync(join(preferred, "template-preview.json"))) return preferred;

  const dirs = readdirSync(GENERATED_ROOT).filter((d) =>
    existsSync(join(GENERATED_ROOT, d, "template-preview.json")),
  );
  if (dirs.length === 0) throw new Error("No prototype with template-preview.json");
  return join(GENERATED_ROOT, dirs[dirs.length - 1]!);
}

export function collectApprovalContext(prototype_dir: string): CollectedApprovalContext {
  const qaCtx = loadTemplateContext(prototype_dir);
  const prototype_id = qaCtx.prototype_id;

  const qa_validation_path = join(QA_ROOT, prototype_id, "validation.json");
  if (!existsSync(qa_validation_path)) {
    throw new Error(`QA validation required: ${qa_validation_path}`);
  }
  const qa = JSON.parse(readFileSync(qa_validation_path, "utf8")) as { pass: boolean };

  const critic_path = join(CRITIC_ROOT, prototype_id, "approval-recommendation.json");
  let critic_ready = false;
  let critic_score = 0;
  if (existsSync(critic_path)) {
    const critic = JSON.parse(readFileSync(critic_path, "utf8")) as {
      ready_for_founder_review?: boolean;
      overall_score?: number;
    };
    critic_ready = critic.ready_for_founder_review === true;
    critic_score = critic.overall_score ?? 0;
  }

  const design_plan_path = join(prototype_dir, "design-plan.json");
  const design_plan = existsSync(design_plan_path)
    ? (JSON.parse(readFileSync(design_plan_path, "utf8")) as Record<string, unknown>)
    : null;

  const premium_path = join(prototype_dir, "premium-score.json");
  const premium_scores = existsSync(premium_path)
    ? (JSON.parse(readFileSync(premium_path, "utf8")) as Record<string, number>)
    : null;

  const seo_qa_path = join(QA_ROOT, prototype_id, "seo.json");
  const seo_qa = existsSync(seo_qa_path)
    ? (JSON.parse(readFileSync(seo_qa_path, "utf8")) as Record<string, unknown>)
    : null;

  const objective = (design_plan?.objective as string) ?? qaCtx.title;
  const family_id = (design_plan?.family_id as string) ?? qaCtx.family_id;
  const tier: CollectedApprovalContext["tier"] =
    (design_plan?.ats_tier as CollectedApprovalContext["tier"]) ?? qaCtx.tier;

  return {
    prototype_id,
    prototype_dir,
    qa_pass: qa.pass,
    qa_validation_path,
    critic_ready,
    critic_score,
    design_plan,
    premium_scores,
    seo_qa,
    objective,
    family_id,
    tier,
  };
}
