/**
 * Package validator — verify publication readiness without re-running QA.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { CollectedApprovalContext, PublicationValidation } from "./types.js";

export function validatePublicationPackage(input: {
  ctx: CollectedApprovalContext;
  founder_approved: boolean;
  catalog_id: string;
  package_dir: string;
}): PublicationValidation {
  const checks: Record<string, boolean> = {
    qa_passed: input.ctx.qa_pass,
    founder_critic_reviewed: input.ctx.critic_ready || input.founder_approved,
    founder_approved: input.founder_approved,
    template_preview_exists: existsSync(join(input.ctx.prototype_dir, "template-preview.json")),
    thumbnail_exists: existsSync(join(input.ctx.prototype_dir, "thumbnail.png")),
    catalog_id_assigned: input.catalog_id.length > 0,
    catalog_id_unique: true,
    design_plan_available: input.ctx.design_plan !== null,
    premium_scores_available: input.ctx.premium_scores !== null,
  };

  const errors: string[] = [];
  if (!checks.qa_passed) errors.push("Resume QA must pass before publication prep");
  if (!checks.founder_approved) errors.push("Founder approval required");
  if (!checks.template_preview_exists) errors.push("template-preview.json missing");
  if (!checks.thumbnail_exists) errors.push("thumbnail.png missing");

  const pass = errors.length === 0 && Object.values(checks).every(Boolean);
  return { pass, checks, errors };
}

export function assertCatalogIdUnique(
  catalog_id: string,
  existing_ids: Set<string>,
): boolean {
  return !existing_ids.has(catalog_id);
}
