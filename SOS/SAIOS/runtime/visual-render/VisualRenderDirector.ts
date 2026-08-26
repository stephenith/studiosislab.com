/**
 * Visual Render Evaluation Engine — evaluates the RENDERED resume, not JSON metadata.
 */
import { randomUUID } from "node:crypto";
import { loadGeneratedTemplate } from "../tools/local-review/template-loader.js";
import { renderTemplateForEvaluation } from "./TemplateRenderer.js";
import {
  benchmarkAlignmentScore,
  externalPrincipleBoost,
  loadBenchmarkPrinciplesForRender,
} from "./BenchmarkComparator.js";
import { gatherRenderResearchPrinciples } from "./ResearchIntegration.js";
import { evaluateAllDimensions } from "./DimensionEvaluator.js";
import { detectVisualIssues } from "./IssueDetector.js";
import { computeRenderScores, qualityGatePass } from "./RenderScorer.js";
import { buildImprovementPlan, buildFounderReviewPreview } from "./ImprovementPlanner.js";
import { persistRenderArtifacts, resolveOutputDir } from "./RenderReporter.js";
import { appendRenderMemory } from "./VisualRenderMemory.js";
import type { VisualRenderOptions, VisualRenderResult } from "./types.js";
import { RENDER_SCORE_GATE } from "./types.js";

export const VISUAL_RENDER_ENGINE = {
  module: "visual-render-evaluation-engine",
  version: "1.0.0",
  role: "founder_vision_render_judge",
  description:
    "Judges the final rendered resume — not JSON, QA artifacts, or design plans. Founder approves what is visually rendered.",
  evaluates: "fabric_rendered_canvas",
  quality_gate: RENDER_SCORE_GATE,
} as const;

export async function runVisualRenderEvaluation(
  options: VisualRenderOptions = {},
): Promise<VisualRenderResult> {
  const argv = options.template_path ? [`--path=${options.template_path}`] : [];
  const loaded = loadGeneratedTemplate(argv);
  const mcp = options.mcp_firecrawl_available ?? false;

  const snapshot = await renderTemplateForEvaluation(loaded.json);
  const benchmarkPrinciples = loadBenchmarkPrinciplesForRender();
  const research = await gatherRenderResearchPrinciples(mcp);
  const benchmarkBoost =
    benchmarkAlignmentScore(snapshot.metrics, benchmarkPrinciples) +
    externalPrincipleBoost(research.combined);

  const dimensions = evaluateAllDimensions(snapshot.metrics, benchmarkBoost);
  const issues = detectVisualIssues(snapshot.metrics);
  const scores = computeRenderScores(dimensions);
  const gatePass = qualityGatePass(scores);

  const improvement_plan = buildImprovementPlan({ scores, dimensions, issues });
  const founder_preview = buildFounderReviewPreview({
    template_name: loaded.templateName,
    scores,
    issues,
  });

  const eye_flow = {
    scan_path: ["name_header", "title", "summary", "experience", "education", "skills"],
    header_zone_objects: Math.round(snapshot.metrics.header_zone_density * snapshot.metrics.object_count),
    estimated_scan_seconds: scores.recruiter_score >= 95 ? 5 : 7,
    recruiter_score: scores.recruiter_score,
  };

  const output_dir = resolveOutputDir(loaded.templateName);
  const artifacts = persistRenderArtifacts({
    output_dir,
    template_name: loaded.templateName,
    metrics: snapshot.metrics,
    dimensions,
    scores,
    issues,
    improvement_plan,
    founder_preview,
    eye_flow,
    persist: options.persist,
  });

  appendRenderMemory(
    {
      recorded_at: new Date().toISOString(),
      template_name: loaded.templateName,
      overall_render_score: scores.overall_render_score,
      layout_improvements: issues.includes("unbalanced_layout")
        ? ["Rebalance left/right margins in render"]
        : [],
      spacing_improvements: issues.includes("too_dense")
        ? ["Increase vertical section gaps"]
        : ["Maintain premium margin rhythm"],
      hierarchy_improvements: issues.includes("poor_hierarchy")
        ? ["Strengthen name prominence in render"]
        : [],
      visual_principles: research.combined.slice(0, 5),
    },
    options.persist !== false,
  );

  return {
    pass: gatePass && dimensions.length >= 26,
    evaluation_id: `render-eval-${randomUUID().slice(0, 8)}`,
    template_name: loaded.templateName,
    template_path: loaded.path,
    output_dir,
    scores,
    dimensions,
    issues,
    quality_gate_pass: gatePass,
    publication_blocked: !gatePass,
    artifacts,
  };
}
