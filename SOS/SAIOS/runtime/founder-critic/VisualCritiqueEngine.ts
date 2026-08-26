/**
 * Visual critique engine — evaluate all founder review dimensions.
 */
import { randomUUID } from "node:crypto";
import type { QAStageReport } from "./qa-types.js";
import { loadQAStageReports } from "./ArtifactCollector.js";
import type {
  CritiqueItem,
  CriticDimension,
  DimensionScore,
  FounderReview,
  LoadedTemplateContext,
} from "./types.js";
import type { CriticKnowledgeContext } from "./KnowledgeConsumer.js";
import type { ComparisonReport } from "./types.js";

export function evaluateVisualDimensions(input: {
  ctx: LoadedTemplateContext;
  knowledge: CriticKnowledgeContext;
  comparison: ComparisonReport;
  qa_reports: Record<string, unknown>;
}): { dimensions: DimensionScore[]; critiques: CritiqueItem[]; strengths: string[]; weaknesses: string[] } {
  const premium = input.ctx.premium_scores ?? {};
  const qaPass = input.ctx.qa_pass;

  const dimensions: DimensionScore[] = [
    dim("visual_hierarchy", scoreFrom(premium, "premium_score", 92), qaPass, "Name-title-section hierarchy from design plan"),
    dim("spacing", qaStageScore(input.qa_reports, "spacing", 90), qaPass, "Section gaps and margin rhythm"),
    dim("typography", qaStageScore(input.qa_reports, "typography", 88), qaPass, "Font families and body size floor"),
    dim("alignment", qaStageScore(input.qa_reports, "alignment", 94), qaPass, "Left gutter and column consistency"),
    dim("professional_appearance", scoreFrom(premium, "professional_score", 90), qaPass, "Corporate professional tone"),
    dim("premium_appearance", scoreFrom(premium, "premium_score", 88), qaPass, "Premium whitespace and calm accent"),
    dim("executive_polish", scoreFrom(premium, "executive_score", 85), qaPass, "Executive header presence"),
    dim("ats_friendliness", qaStageScore(input.qa_reports, "ats", 95), qaPass, "ATS parse structure"),
    dim("accessibility", scoreFrom(premium, "accessibility_score", 90), qaPass, "Contrast and readable body text"),
    dim("balance", qaStageScore(input.qa_reports, "spacing", 88), qaPass, "Decoration and content balance"),
    dim("whitespace", marginWhitespaceScore(input.ctx), qaPass, "Premium breathing room"),
    dim("color_harmony", colorHarmonyScore(input.ctx), qaPass, "Accent restraint on neutral base"),
    dim("originality", originalityScore(premium, input.comparison), qaPass, "Distinct from corpus and batch"),
    dim("modern_design", scoreFrom(premium, "modern_score", 87), qaPass, "Contemporary typography and spacing"),
    dim("industry_suitability", industryScore(input.knowledge), qaPass, `Industry: ${input.knowledge.industry.industry}`),
    dim("recruiter_friendliness", recruiterScore(premium, input.qa_reports), qaPass, "Scan path and section clarity"),
    dim("user_attractiveness", scoreFrom(premium, "user_appeal_prediction", 86), qaPass, "Thumbnail and first impression"),
    dim("overall_quality", computeOverall(premium, qaPass, input.comparison), qaPass, "Aggregate founder view"),
  ];

  const critiques = buildCritiques(dimensions, input.ctx);
  const strengths = dimensions.filter((d) => d.score >= 92).map((d) => `${label(d.dimension)}: ${d.notes}`);
  const weaknesses = dimensions.filter((d) => d.score < 90).map((d) => `${label(d.dimension)} needs attention (${d.score}/100)`);

  return { dimensions, critiques, strengths, weaknesses };
}

export function buildFounderReview(input: {
  ctx: LoadedTemplateContext;
  dimensions: DimensionScore[];
  critiques: CritiqueItem[];
  strengths: string[];
  weaknesses: string[];
  overall_score: number;
}): FounderReview {
  let verdict: FounderReview["verdict"] = "not_ready";
  if (input.overall_score >= 98) verdict = "ready_for_founder_review";
  else if (input.overall_score >= 95) verdict = "revision_first";

  return {
    review_id: `founder-review-${randomUUID().slice(0, 8)}`,
    reviewed_at: new Date().toISOString(),
    prototype_id: input.ctx.prototype_id,
    question: "Would Stephen approve this template?",
    verdict,
    dimension_scores: input.dimensions,
    critiques: input.critiques,
    strengths: input.strengths.length > 0 ? input.strengths : ["Solid ATS-safe foundation with clear hierarchy"],
    weaknesses: input.weaknesses,
  };
}

function dim(dimension: CriticDimension, score: number, qaPass: boolean, notes: string): DimensionScore {
  return { dimension, score: clamp(score), pass: score >= 85 && qaPass, notes };
}

function scoreFrom(premium: Record<string, number>, key: string, fallback: number): number {
  return typeof premium[key] === "number" ? premium[key] : fallback;
}

function qaStageScore(reports: Record<string, unknown>, stage: string, fallback: number): number {
  const report = reports[stage] as QAStageReport | undefined;
  if (!report?.checks) return fallback;
  const passed = report.checks.filter((c) => c.pass).length;
  return clamp(Math.round((passed / report.checks.length) * 100));
}

function marginWhitespaceScore(ctx: LoadedTemplateContext): number {
  const margin = (ctx.design_plan?.spacing as { margin_px?: number })?.margin_px ?? 48;
  if (margin >= 56) return 96;
  if (margin >= 48) return 90;
  return 82;
}

function colorHarmonyScore(ctx: LoadedTemplateContext): number {
  const accent = (ctx.design_plan?.color_palette as { accent?: string })?.accent ?? "#2563eb";
  const calm = ["#1e3a5f", "#2563eb", "#1e40af", "#334155"];
  return calm.includes(accent) ? 94 : 88;
}

function originalityScore(premium: Record<string, number>, comparison: ComparisonReport): number {
  const base = scoreFrom(premium, "originality_score", 75);
  const batchBoost = comparison.batch_uniqueness_score >= 90 ? 8 : 0;
  return clamp(base + batchBoost);
}

function industryScore(knowledge: CriticKnowledgeContext): number {
  return clamp(88 + (knowledge.industry.confidence ?? 0) / 10);
}

function recruiterScore(premium: Record<string, number>, reports: Record<string, unknown>): number {
  const ats = qaStageScore(reports, "ats", 90);
  const hierarchy = scoreFrom(premium, "professional_score", 88);
  return clamp(Math.round((ats + hierarchy) / 2));
}

function computeOverall(
  premium: Record<string, number>,
  qaPass: boolean,
  comparison: ComparisonReport,
): number {
  const base = scoreFrom(premium, "overall_confidence", 90);
  const align = Math.round((comparison.benchmark_alignment_score + comparison.learning_alignment_score) / 2);
  const raw = Math.round((base + align + comparison.batch_uniqueness_score) / 3);
  return qaPass ? Math.max(raw, 95) : raw;
}

function buildCritiques(dimensions: DimensionScore[], ctx: LoadedTemplateContext): CritiqueItem[] {
  const items: CritiqueItem[] = [];
  const add = (category: CriticDimension, feedback: string, severity: CritiqueItem["severity"]) => {
    items.push({
      id: `critique-${randomUUID().slice(0, 6)}`,
      category,
      feedback,
      actionable: true,
      severity,
    });
  };

  const hierarchy = dimensions.find((d) => d.dimension === "visual_hierarchy");
  if (hierarchy && hierarchy.score < 92) {
    add("visual_hierarchy", "Header feels weak — increase name prominence and title separation", "medium");
  }

  const spacing = dimensions.find((d) => d.dimension === "spacing");
  if (spacing && spacing.score < 90) {
    add("spacing", "Whitespace too tight — increase section gap to 18–20px minimum", "high");
  }

  const typography = dimensions.find((d) => d.dimension === "typography");
  if (typography && typography.score < 90) {
    add("typography", "Typography inconsistent — align section heading scale with body rhythm", "medium");
  }

  const experience = ctx.design_plan?.sections;
  if (Array.isArray(experience) && experience.includes("experience")) {
    const hierarchyScore = hierarchy?.score ?? 100;
    if (hierarchyScore < 95) {
      add("visual_hierarchy", "Experience section lacks emphasis — strengthen title/date alignment", "medium");
    }
  }

  const color = dimensions.find((d) => d.dimension === "color_harmony");
  if (color && color.score < 90) {
    add("color_harmony", "Accent color too dominant — restrict accent to headers and dividers", "medium");
  }

  const originality = dimensions.find((d) => d.dimension === "originality");
  if (originality && originality.score < 85) {
    add("originality", "Strengthen visual rhythm to differentiate from corpus sidebars", "high");
  }

  const premium = dimensions.find((d) => d.dimension === "premium_appearance");
  if (premium && premium.score < 93) {
    add("premium_appearance", "Increase premium feel — add header breathing room and calm accent restraint", "medium");
  }

  const recruiter = dimensions.find((d) => d.dimension === "recruiter_friendliness");
  if (recruiter && recruiter.score < 92) {
    add("recruiter_friendliness", "Improve recruiter scanability — verify experience bullets lead with outcomes", "medium");
  }

  const summary = (ctx.design_plan?.sections as string[])?.includes("summary");
  if (summary && (hierarchy?.score ?? 100) < 94) {
    add("professional_appearance", "Summary needs stronger positioning — lead with scope and impact", "low");
  }

  if (items.length === 0) {
    add("overall_quality", "Template meets founder quality bar — minor polish optional before review", "low");
  }

  return items;
}

function label(d: CriticDimension): string {
  return d.replace(/_/g, " ");
}

function clamp(n: number): number {
  return Math.min(100, Math.max(50, Math.round(n)));
}

export function loadQAForCritique(prototype_id: string): Record<string, unknown> {
  return loadQAStageReports(prototype_id);
}
