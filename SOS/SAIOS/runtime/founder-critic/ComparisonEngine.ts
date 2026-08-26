/**
 * Comparison engine — corpus, benchmark, learning, approved, production batch.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { analyzeExistingTemplates } from "../research/ExistingTemplateAnalyzer.js";
import { loadResumeIntelligenceEngine } from "../../domain/studiosislab/resume/intelligence/ResumeIntelligenceEngine.js";
import type { CriticKnowledgeContext } from "./KnowledgeConsumer.js";
import type { ComparisonReport, LoadedTemplateContext } from "./types.js";

const SOS_ROOT = resolve(import.meta.dirname, "../../..");
const V2_APPEND = join(SOS_ROOT, "07_LOGS/saios/learning/worker-v2-append.json");
const V3_APPEND = join(SOS_ROOT, "07_LOGS/saios/learning/worker-v3-append.json");

export function runComparisonEngine(
  ctx: LoadedTemplateContext,
  knowledge: CriticKnowledgeContext,
): ComparisonReport {
  const corpus = analyzeExistingTemplates({
    objective: ctx.objective,
    industry: knowledge.industry.industry,
    preferred_family: ctx.family_id,
  });

  const intelligence = loadResumeIntelligenceEngine();
  const approved = intelligence.database.template_dna.filter((t) => t.ats_score >= 90);
  const approved_distance = computeApprovedDistance(ctx.family_id, approved.map((t) => t.family));

  const benchmark_alignment = computeBenchmarkAlignment(
    ctx,
    knowledge.benchmark_patterns,
  );
  const learning_alignment = computeLearningAlignment(ctx, knowledge);
  const batch_uniqueness = computeBatchUniqueness(ctx.family_id);

  return {
    compared_at: new Date().toISOString(),
    prototype_id: ctx.prototype_id,
    corpus_comparisons: corpus.most_similar_templates.slice(0, 5).map((t) => ({
      template_id: t.template_id,
      similarity: t.similarity_score,
      family: t.family,
    })),
    benchmark_alignment_score: benchmark_alignment,
    learning_alignment_score: learning_alignment,
    approved_template_distance: approved_distance,
    batch_uniqueness_score: batch_uniqueness,
    never_self_only: true,
  };
}

function computeBenchmarkAlignment(
  ctx: LoadedTemplateContext,
  patterns: string[],
): number {
  if (patterns.length === 0) return 75;
  let hits = 0;
  const plan = JSON.stringify(ctx.design_plan ?? {}).toLowerCase();
  for (const p of patterns.slice(0, 8)) {
    const tokens = p.toLowerCase().split(" ").filter((w) => w.length > 5);
    if (tokens.some((t) => plan.includes(t.slice(0, 8)))) hits += 1;
  }
  return Math.min(100, 78 + hits * 3);
}

function computeLearningAlignment(
  ctx: LoadedTemplateContext,
  knowledge: CriticKnowledgeContext,
): number {
  const mem = knowledge.learning_memory;
  let score = 80;
  const margin = (ctx.design_plan?.spacing as { margin_px?: number })?.margin_px;
  if (margin && margin >= mem.preferred_spacing.margin_px) score += 5;
  const accent = (ctx.design_plan?.color_palette as { accent?: string })?.accent;
  if (accent && mem.preferred_colors.accent.includes(accent)) score += 5;
  if (mem.accepted_layouts.some((l) => l.includes(ctx.family_id))) score += 8;
  if (mem.rejected_layouts.some((l) => l.includes(ctx.family_id))) score -= 15;
  return clamp(score);
}

function computeApprovedDistance(family_id: string, approvedFamilies: string[]): number {
  if (approvedFamilies.length === 0) return 100;
  const matches = approvedFamilies.filter((f) => f === family_id).length;
  const ratio = matches / approvedFamilies.length;
  return clamp(Math.round((1 - ratio) * 100));
}

function computeBatchUniqueness(family_id: string): number {
  const families: string[] = [];
  for (const path of [V2_APPEND, V3_APPEND]) {
    if (!existsSync(path)) continue;
    try {
      const entries = JSON.parse(readFileSync(path, "utf8")) as Array<{ family_id?: string }>;
      for (const e of entries.slice(-8)) {
        if (e.family_id) families.push(e.family_id);
      }
    } catch {
      /* ignore */
    }
  }
  if (families.length === 0) return 95;
  const same = families.filter((f) => f === family_id).length;
  return clamp(Math.round((1 - same / families.length) * 100));
}

function clamp(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}
