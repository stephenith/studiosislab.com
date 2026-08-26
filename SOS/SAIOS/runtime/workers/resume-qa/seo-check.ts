/**
 * SEO metadata validation for publication readiness
 */
import type { QAModuleReport, QATemplateContext, SEOProposal } from "./types.js";

export function buildSEOProposal(ctx: QATemplateContext): SEOProposal {
  const slug = ctx.prototype_id.replace(/-v\d+$/, "");
  const keywords = [
    "resume template",
    "ats resume",
    ctx.title.toLowerCase(),
    ctx.family_id.replace(/-/g, " "),
    "professional resume",
    "modern resume",
  ];
  return {
    title: `${ctx.title} Resume Template`,
    slug,
    category: ctx.category_id,
    keywords: [...new Set(keywords)],
    description: `Professional ${ctx.title} resume template optimized for ATS parsing. Clean single-column layout with ${ctx.tier === "ats_safe" ? "ATS-safe" : "visual"} typography.`,
    ats_tag: ctx.tier === "ats_safe" ? "ats-safe" : "visual-premium",
    visual_tag: ctx.family_id,
  };
}

export function runSEOCheck(ctx: QATemplateContext): QAModuleReport {
  const seo = buildSEOProposal(ctx);
  const checks = [];

  checks.push({
    id: "seo-title",
    pass: seo.title.length >= 10 && seo.title.length <= 80,
    detail: seo.title,
    severity: "required" as const,
  });

  checks.push({
    id: "seo-slug",
    pass: /^[a-z0-9-]+$/.test(seo.slug),
    detail: seo.slug,
    severity: "required" as const,
  });

  checks.push({
    id: "seo-category",
    pass: seo.category.length > 0,
    detail: seo.category,
    severity: "required" as const,
  });

  checks.push({
    id: "seo-keywords",
    pass: seo.keywords.length >= 4,
    detail: `${seo.keywords.length} keywords`,
    severity: "required" as const,
  });

  checks.push({
    id: "seo-description",
    pass: seo.description.length >= 50 && seo.description.length <= 320,
    detail: `${seo.description.length} chars`,
    severity: "required" as const,
  });

  checks.push({
    id: "seo-ats-tag",
    pass: seo.ats_tag.length > 0,
    detail: seo.ats_tag,
    severity: "required" as const,
  });

  checks.push({
    id: "seo-visual-tag",
    pass: seo.visual_tag.length > 0,
    detail: seo.visual_tag,
    severity: "required" as const,
  });

  const pass = checks.every((c) => c.pass);
  return {
    module: "seo",
    pass,
    checked_at: new Date().toISOString(),
    checks,
  };
}
