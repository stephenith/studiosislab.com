/**
 * Experience block design tokens — role, company, dates, achievement flow.
 * Founder Review #004.
 */
import type { DesignMemoryContext } from "./DesignMemoryBridge.js";
import { DESIGN_SYSTEM_VERSION } from "./types.js";

export const EXPERIENCE_BLOCK_RULES = {
  role_pt: 12.5,
  company_pt: 11,
  company_weight: 500,
  date_pt: 10.5,
  date_weight: 400,
  bullet_pt: 11.5,
  bullet_weight: 400,
  bullet_metric_weight: 500,
  role_weight: 700,
  entry_gap_px: 20,
  role_to_company_gap_px: 6,
  company_to_date_gap_px: 6,
  date_to_bullet_gap_px: 8,
  bullet_gap_px: 10,
  achievement_lead_chars: 48,
} as const;

export type ExperienceBlockSpec = typeof EXPERIENCE_BLOCK_RULES;

export function buildExperienceBlockSystem(ctx: DesignMemoryContext) {
  const exp = ctx.effective_experience_block;
  const h = ctx.effective_hierarchy;
  const density = ctx.effective_content_density;

  return {
    version: DESIGN_SYSTEM_VERSION,
    spec: exp,
    resolved: {
      role_pt: exp.role_pt,
      company_pt: exp.company_pt,
      date_pt: exp.date_pt,
      bullet_pt: h.job_title_pt > 0 ? ctx.effective_typography.body_size_pt : exp.bullet_pt,
      role_weight: exp.role_weight,
      company_weight: exp.company_weight,
      entry_gap_px: Math.max(exp.entry_gap_px, density.experience_entry_gap_px),
    },
    reading_flow: ["role", "company", "date", "achievement_bullets"],
    rules: [
      "Role bold — primary scan anchor per entry",
      "Company on separate line, muted weight for hierarchy",
      "Dates subdued below company",
      "Bullets readable with optional metric emphasis",
      "Experience section receives strongest section marker",
    ],
    generated_at: new Date().toISOString(),
  };
}
