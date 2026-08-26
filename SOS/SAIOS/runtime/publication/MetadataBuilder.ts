/**
 * Metadata builder — template and category metadata.
 */
import { randomUUID } from "node:crypto";
import type { CollectedApprovalContext, TemplateMetadata, CategoryMetadata, PublicationState } from "./types.js";
import { loadCatalog } from "./CatalogManager.js";

export function buildTemplateMetadata(input: {
  ctx: CollectedApprovalContext;
  catalog_id: string;
  state: PublicationState;
  founder_name: string;
  version?: string;
}): TemplateMetadata {
  const plan = input.ctx.design_plan ?? {};
  const industry = inferIndustry(input.ctx.objective);
  const color_palette = plan.color_palette as { accent?: string } | undefined;

  return {
    template_id: input.catalog_id,
    catalog_id: input.catalog_id,
    prototype_id: input.ctx.prototype_id,
    title: slugToTitle(input.ctx.prototype_id),
    version: input.version ?? "1.0.0",
    publication_state: input.state,
    approval_date: input.state === "founder_approved" || input.state === "ready_to_publish"
      ? new Date().toISOString()
      : null,
    founder: input.founder_name,
    industry,
    ats_tier: input.ctx.tier,
    visual_tier: (plan.visual_tier as TemplateMetadata["visual_tier"]) ?? input.ctx.tier,
    difficulty: "intermediate",
    experience_level: inferExperience(input.ctx.objective),
    layout_family: (plan.layout as string)?.split("—")[0]?.trim() ?? input.ctx.family_id,
    color_family: color_palette?.accent ?? "#2563eb",
    design_family: input.ctx.family_id,
    category_id: "professional",
  };
}

export function buildCategoryMetadata(category_id: string): CategoryMetadata {
  const catalog = loadCatalog();
  const existing = catalog.categories.find((c) => c.category_id === category_id);
  if (existing) return existing;
  return {
    category_id,
    label: category_id.charAt(0).toUpperCase() + category_id.slice(1),
    description: `${category_id} resume templates`,
    template_count: 0,
    industries: [],
    ats_tiers: ["ats_safe"],
  };
}

export function newPublicationId(): string {
  return `pub-${randomUUID().slice(0, 8)}`;
}

function slugToTitle(slug: string): string {
  return slug
    .replace(/-v\d+$/, "")
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function inferIndustry(objective: string): string {
  const lower = objective.toLowerCase();
  if (lower.includes("finance")) return "finance";
  if (lower.includes("executive")) return "executive";
  if (lower.includes("software") || lower.includes("engineer")) return "software";
  return "professional";
}

function inferExperience(objective: string): string {
  const lower = objective.toLowerCase();
  if (lower.includes("senior") || lower.includes("executive")) return "senior";
  if (lower.includes("entry") || lower.includes("student")) return "entry";
  return "mid";
}
