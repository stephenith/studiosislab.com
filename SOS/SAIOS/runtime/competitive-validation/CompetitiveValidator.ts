/**
 * Competitive validator — compare generated resume against premium market expectations.
 */
import { buildDesignSystemBundle } from "../design-system/DesignSystemDirector.js";
import { DESIGN_DNA_VERSION } from "../design-system/DesignDNAVersion.js";
import { consumeKnowledge } from "../founder-critic/KnowledgeConsumer.js";
import { runComparisonEngine } from "../founder-critic/ComparisonEngine.js";
import { gatherRenderResearchPrinciples } from "../visual-render/ResearchIntegration.js";
import {
  benchmarkAlignmentScore,
  externalPrincipleBoost,
  loadBenchmarkPrinciplesForRender,
} from "../visual-render/BenchmarkComparator.js";
import { evaluateAllDimensions } from "../visual-render/DimensionEvaluator.js";
import { computeRenderScores } from "../visual-render/RenderScorer.js";
import { detectVisualIssues } from "../visual-render/IssueDetector.js";
import { renderTemplateForEvaluation } from "../visual-render/TemplateRenderer.js";
import { predictFounderOutcome } from "../founder-critic/FounderPredictor.js";
import type { CompetitiveLoadedContext } from "./ArtifactCollector.js";
import { COMPETITIVE_SOURCES } from "./CompetitiveBenchmarks.js";
import type {
  CompetitiveAnalysis,
  CompetitiveAxis,
  CompetitiveAxisScore,
  CompetitiveScore,
  DesignDNADelta,
  RecommendedImprovement,
} from "./types.js";

const AXES: CompetitiveAxis[] = [
  "first_impression",
  "premium_feel",
  "executive_appearance",
  "trust",
  "readability",
  "recruiter_scan_speed",
  "information_density",
  "visual_rhythm",
  "typography",
  "spacing",
  "section_distinction",
  "visual_weight",
  "editorial_composition",
  "professional_confidence",
  "brand_recognition",
  "ats_safety",
  "print_quality",
  "memorability",
  "perceived_download_value",
];

export async function evaluateCompetitiveness(
  ctx: CompetitiveLoadedContext,
  mcp_available: boolean,
): Promise<{
  analysis: CompetitiveAnalysis;
  score: CompetitiveScore;
  strengths: string[];
  weaknesses: string[];
  improvements: RecommendedImprovement[];
  delta: DesignDNADelta;
}> {
  const system = buildDesignSystemBundle(true);
  const knowledge = consumeKnowledge(ctx.critic_ctx);
  const comparison = runComparisonEngine(ctx.critic_ctx, knowledge);
  const benchmark = loadBenchmarkPrinciplesForRender();
  const research = await gatherRenderResearchPrinciples(mcp_available);
  const snapshot = await renderTemplateForEvaluation(ctx.loaded.json);
  const renderBoost =
    benchmarkAlignmentScore(snapshot.metrics, benchmark) +
    externalPrincipleBoost(research.combined);
  const renderDimensions = evaluateAllDimensions(snapshot.metrics, renderBoost);
  const renderScores = computeRenderScores(renderDimensions);
  const renderIssues = detectVisualIssues(snapshot.metrics);

  const premium = (ctx.premium_score ?? {}) as Record<string, number>;
  const founderPredictions = predictFounderOutcome({
    ctx: ctx.critic_ctx,
    dimensions: [],
    comparison,
    overall_score: Math.round(
      (((premium.overall_confidence ?? 90) as number) + renderScores.overall_render_score) / 2,
    ),
  });

  const axis_scores = AXES.map((axis) =>
    scoreAxis(axis, {
      premium,
      renderScores,
      renderIssues,
      snapshot: snapshot.metrics,
      comparison,
      system,
      founderPredictions,
    }),
  );

  const overall = Math.round(
    axis_scores.reduce((sum, axis) => sum + axis.score, 0) / axis_scores.length,
  );
  const likely_user_choice = overall >= 93 ? "YES" : overall >= 88 ? "MAYBE" : "NO";
  const confidence = Math.min(
    98,
    Math.round(
      (comparison.benchmark_alignment_score +
        comparison.learning_alignment_score +
        renderScores.recruiter_score +
        (premium.recognizability_score ?? 88)) /
        4,
    ),
  );

  const score: CompetitiveScore = {
    overall_competitive_score: overall,
    likely_user_choice,
    confidence,
    gate_pass: overall >= 90,
    computed_at: new Date().toISOString(),
    axis_scores,
  };

  const strengths = axis_scores
    .filter((a) => a.score >= 93)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((a) => `${humanizeAxis(a.axis)}: ${a.reasoning[0] ?? "strong objective signal"}`);

  const weaknesses = axis_scores
    .filter((a) => a.score < 90)
    .sort((a, b) => a.score - b.score)
    .slice(0, 6)
    .map((a) => `${humanizeAxis(a.axis)}: ${a.reasoning[0] ?? "needs stronger objective support"}`);

  const improvements = buildImprovements(axis_scores, system, renderIssues);
  const delta = buildDelta(axis_scores, system, improvements);

  const evidence = [
    `QA passed ${ctx.critic_ctx.qa_stages_passed}/${ctx.critic_ctx.qa_stages_total} stages.`,
    `Premium overall confidence is ${(premium.overall_confidence ?? 0) as number}/100.`,
    `Visual render score is ${renderScores.overall_render_score}/100 with recruiter score ${renderScores.recruiter_score}/100.`,
    `Benchmark alignment is ${comparison.benchmark_alignment_score}/100 across ${COMPETITIVE_SOURCES.length} competitive sources.`,
    `Design DNA recognizability floor is ${system.design_dna.resolved.recognizability_floor}, current premium recognizability is ${(premium.recognizability_score ?? 0) as number}/100.`,
    `Render issues detected: ${renderIssues.length ? renderIssues.join(", ") : "none"}.`,
  ];

  const analysis: CompetitiveAnalysis = {
    evaluated_at: new Date().toISOString(),
    template_name: ctx.loaded.templateName,
    candidate_name: ctx.metadata.candidate_name,
    job_title: ctx.metadata.job_title,
    question:
      "If this resume appeared beside Canva, Resume.io, Enhancv and Novorésumé, would a user choose the StudiosisLab version?",
    benchmark_set: COMPETITIVE_SOURCES,
    design_dna_version: DESIGN_DNA_VERSION,
    benchmark_alignment_score: comparison.benchmark_alignment_score,
    visual_render_score: renderScores.overall_render_score,
    founder_premium_perception: founderPredictions.premium_perception,
    overall_summary:
      likely_user_choice === "YES"
        ? "StudiosisLab is objectively competitive on scan speed, ATS safety, and premium confidence."
        : likely_user_choice === "MAYBE"
          ? "StudiosisLab is credible, but objective evidence still shows room to strengthen differentiation."
          : "StudiosisLab is not yet objectively differentiated enough to win against the top builders.",
    evidence,
  };

  return { analysis, score, strengths, weaknesses, improvements, delta };
}

function scoreAxis(
  axis: CompetitiveAxis,
  input: {
    premium: Record<string, number>;
    renderScores: ReturnType<typeof computeRenderScores>;
    renderIssues: string[];
    snapshot: {
      left_margin_px: number;
      right_margin_px: number;
      content_bottom_px: number;
      canvas_height: number;
      font_sizes_pt: number[];
      accent_count: number;
      vertical_bands: number[];
    };
    comparison: ReturnType<typeof runComparisonEngine>;
    system: ReturnType<typeof buildDesignSystemBundle>;
    founderPredictions: ReturnType<typeof predictFounderOutcome>;
  },
): CompetitiveAxisScore {
  const p = input.premium;
  const utilization = input.snapshot.content_bottom_px / input.snapshot.canvas_height;
  const scoreMap: Record<CompetitiveAxis, number> = {
    first_impression: Math.round(((p.first_impression_score ?? 88) + input.renderScores.premium_score) / 2),
    premium_feel: Math.round(((p.premium_score ?? 88) + input.founderPredictions.premium_perception) / 2),
    executive_appearance: (p.executive_score ?? 88) as number,
    trust: Math.round((((p.ats_score ?? 90) as number) + ((p.accessibility_score ?? 90) as number) + 92) / 3),
    readability: Math.round((((p.accessibility_score ?? 90) as number) + 95 + ((p.modern_score ?? 90) as number)) / 3),
    recruiter_scan_speed: input.renderScores.recruiter_score,
    information_density: utilization >= 0.8 && utilization <= 0.93 ? 94 : utilization >= 0.75 ? 88 : 80,
    visual_rhythm: (p.visual_rhythm_score ?? 88) as number,
    typography: (p.modern_score ?? 88) as number,
    spacing: Math.abs(input.snapshot.left_margin_px - input.snapshot.right_margin_px) <= 4 ? 95 : 84,
    section_distinction:
      input.system.design_dna.resolved.focal_weights.experience >= 0.9 &&
      input.snapshot.vertical_bands.filter((b) => b > 0).length >= 4
        ? 94
        : 86,
    visual_weight: (p.visual_confidence_score ?? 88) as number,
    editorial_composition: Math.round((((p.composition_score ?? 88) as number) + ((p.density_score ?? 88) as number)) / 2),
    professional_confidence: (p.professional_score ?? 88) as number,
    brand_recognition: (p.recognizability_score ?? 84) as number,
    ats_safety: (p.ats_score ?? 90) as number,
    print_quality: Math.round((((p.accessibility_score ?? 90) as number) + ((p.ats_score ?? 90) as number)) / 2),
    memorability:
      input.renderIssues.includes("looks_memorable") && !input.renderIssues.includes("looks_like_resume_builder")
        ? 94
        : (p.recognizability_score ?? 84) as number,
    perceived_download_value: Math.round((((p.download_prediction ?? 88) as number) + ((p.user_appeal_prediction ?? 88) as number)) / 2),
  };

  const score = Math.min(100, Math.max(0, Math.round(scoreMap[axis])));
  return {
    axis,
    score,
    pass: score >= 88,
    reasoning: reasoningForAxis(axis, score, input),
  };
}

function reasoningForAxis(
  axis: CompetitiveAxis,
  score: number,
  input: {
    renderIssues: string[];
    snapshot: { left_margin_px: number; right_margin_px: number; accent_count: number; vertical_bands: number[] };
    system: ReturnType<typeof buildDesignSystemBundle>;
    comparison: ReturnType<typeof runComparisonEngine>;
  },
): string[] {
  const reasons: string[] = [];
  if (axis === "first_impression") {
    reasons.push(`Header and premium signals score at ${score}/100 against commercial thumbnail expectations.`);
  }
  if (axis === "brand_recognition") {
    reasons.push(
      `Recognition is measured against Design DNA signature ${input.system.design_dna.resolved.signature_id} and benchmark alignment ${input.comparison.benchmark_alignment_score}/100.`,
    );
  }
  if (axis === "spacing") {
    reasons.push(
      `Margins are ${input.snapshot.left_margin_px}px/${input.snapshot.right_margin_px}px, supporting premium balance without ATS risk.`,
    );
  }
  if (axis === "memorability") {
    reasons.push(
      input.renderIssues.includes("looks_like_resume_builder")
        ? "Render still triggers resume-builder sameness risk."
        : "Render avoids generic builder sameness and retains a visible signature.",
    );
  }
  if (reasons.length === 0) {
    reasons.push(`${humanizeAxis(axis)} is supported by current render, QA, and premium-scoring evidence.`);
  }
  return reasons;
}

function buildImprovements(
  axis_scores: CompetitiveAxisScore[],
  system: ReturnType<typeof buildDesignSystemBundle>,
  renderIssues: string[],
): RecommendedImprovement[] {
  const low = axis_scores.filter((a) => a.score < 90).sort((a, b) => a.score - b.score);
  const improvements: RecommendedImprovement[] = [];
  for (const axis of low.slice(0, 5)) {
    improvements.push({
      id: `competitive-${axis.axis}`,
      priority: axis.score < 85 ? "high" : "medium",
      target: "design_dna",
      evidence: axis.reasoning,
      recommendation: recommendationForAxis(axis.axis, renderIssues, system),
      measurable_goal: `${humanizeAxis(axis.axis)} to reach >= 90/100 on next approved evaluation`,
      founder_approval_required: true,
    });
  }
  if (improvements.length === 0) {
    improvements.push({
      id: "competitive-maintain",
      priority: "low",
      target: "competitive_validation",
      evidence: ["All competitive axes met the current evidence threshold."],
      recommendation: "Preserve current Design DNA and continue validating against new founder approvals.",
      measurable_goal: "Maintain overall competitive score >= 90/100",
      founder_approval_required: true,
    });
  }
  return improvements;
}

function recommendationForAxis(
  axis: CompetitiveAxis,
  renderIssues: string[],
  system: ReturnType<typeof buildDesignSystemBundle>,
): string {
  const map: Record<CompetitiveAxis, string> = {
    first_impression: "Strengthen Design DNA first-impression principles around header dominance and instant clarity.",
    premium_feel: "Tighten premium-behaviour rules so premium is expressed structurally, not generically.",
    executive_appearance: "Increase executive behaviour calibration around name confidence and calm authority.",
    trust: "Raise visual-trust thresholds for restraint, alignment, and perceived reliability.",
    readability: "Improve Design DNA reading-speed and effortless-flow principles without changing ATS structure.",
    recruiter_scan_speed: "Refine attention-flow scan path so experience and summary resolve faster.",
    information_density: "Adjust premium-density guidance to keep pages full but never crowded.",
    visual_rhythm: "Refine editorial rhythm transitions to create stronger inhale/exhale between sections.",
    typography: "Strengthen typography-psychology guidance on emphasis rather than adding size.",
    spacing: "Refine white-space psychology thresholds, especially if rhythm feels flat despite passing QA.",
    section_distinction: "Increase section distinction through DNA shape language and focal contrast, not decoration.",
    visual_weight: "Rebalance focal hierarchy so experience and header carry more of the page’s visual mass.",
    editorial_composition: "Improve editorial-composition guidance for hero/body/supporting-zone contrast.",
    professional_confidence: "Raise professional-confidence rules to avoid visual hesitation or over-design.",
    brand_recognition: `Strengthen brand-language principles tied to ${system.design_dna.resolved.signature_id}.`,
    ats_safety: "Preserve ATS-safe premium behaviour while validating any future DNA changes against ATS gates.",
    print_quality: "Reinforce print-behaviour rules so contrast and rhythm stay premium in PDF and grayscale.",
    memorability: renderIssues.includes("looks_like_resume_builder")
      ? "Reduce commodity builder feel by sharpening signature markers and visual tension."
      : "Increase memorability through clearer structural signature, not new decorative elements.",
    perceived_download_value: "Raise perceived-value guidance so the template earns a click before ATS is considered.",
  };
  return map[axis];
}

function buildDelta(
  axis_scores: CompetitiveAxisScore[],
  system: ReturnType<typeof buildDesignSystemBundle>,
  improvements: RecommendedImprovement[],
): DesignDNADelta {
  const lowAxes = axis_scores.filter((a) => a.score < 90);
  return {
    generated_at: new Date().toISOString(),
    design_dna_version: DESIGN_DNA_VERSION,
    should_update: lowAxes.length >= 2,
    rationale:
      lowAxes.length >= 2
        ? [
            `${lowAxes.length} competitive axes scored below 90/100.`,
            "Objective evidence supports considering a future Design DNA update after founder approval.",
          ]
        : ["Current evidence does not justify changing Design DNA yet."],
    proposed_principle_additions: lowAxes.map(
      (a) => `Reinforce ${humanizeAxis(a.axis)} using measurable Design DNA guidance.`,
    ),
    proposed_threshold_adjustments: lowAxes.slice(0, 3).map((a) => ({
      key: `${a.axis}_floor`,
      current: 88,
      recommended: 90,
      reason: `Competitive axis ${humanizeAxis(a.axis)} currently scores ${a.score}/100.`,
    })),
  };
}

function humanizeAxis(axis: CompetitiveAxis): string {
  return axis.replace(/_/g, " ");
}
