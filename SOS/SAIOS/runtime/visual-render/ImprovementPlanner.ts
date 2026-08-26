/**
 * Improvement planner — recommendations when render score < gate.
 */
import type { DimensionScore, RenderScores, VisualIssueFlag } from "./types.js";
import { RENDER_SCORE_GATE } from "./types.js";

export function buildImprovementPlan(input: {
  scores: RenderScores;
  dimensions: DimensionScore[];
  issues: VisualIssueFlag[];
}): string {
  const lines: string[] = [
    "# Visual Render Improvement Plan",
    "",
    `**Overall Render Score:** ${input.scores.overall_render_score}/100`,
    `**Gate:** ${RENDER_SCORE_GATE}`,
    `**Founder Prediction:** ${input.scores.founder_approval_prediction}`,
    "",
  ];

  if (input.scores.overall_render_score >= RENDER_SCORE_GATE) {
    lines.push("Render quality meets founder vision gate. Minor polish optional.");
    return lines.join("\n");
  }

  lines.push("## Priority fixes", "");
  const weak = input.dimensions.filter((d) => d.score < 90).slice(0, 8);
  for (const d of weak) {
    lines.push(`- **${formatDim(d.dimension)}** (${d.score}/100): ${actionFor(d.dimension)}`);
  }

  lines.push("", "## Detected issues", "");
  for (const issue of input.issues) {
    if (issue.startsWith("looks_")) continue;
    lines.push(`- ${formatIssue(issue)}`);
  }

  lines.push("", "_Recommendations based on rendered canvas analysis — not JSON metadata._");
  return lines.join("\n");
}

function formatDim(d: string): string {
  return d.replace(/_/g, " ");
}

function formatIssue(i: string): string {
  return i.replace(/_/g, " ");
}

function actionFor(d: string): string {
  const actions: Record<string, string> = {
    whitespace_distribution: "Increase section breathing room and page margins",
    typography_hierarchy: "Strengthen name size and section heading contrast",
    margins: "Align to 48–56px premium margin standard",
    visual_noise: "Reduce accent elements — restrict color to headers",
    section_hierarchy: "Clarify section headings and experience grouping",
    recruiter_eye_flow: "Improve scan path from name to experience bullets",
    poor_hierarchy: "Increase name-to-body size ratio",
  };
  return actions[d] ?? "Refine rendered visual balance";
}

export function buildFounderReviewPreview(input: {
  template_name: string;
  scores: RenderScores;
  issues: VisualIssueFlag[];
}): string {
  const premium = input.issues.includes("looks_premium");
  const memorable = input.issues.includes("looks_memorable");
  return [
    "# Founder Review Preview — Rendered Resume",
    "",
    `**Template:** ${input.template_name}`,
    "",
    "## Founder Vision Scores",
    "",
    `| Score | Value |`,
    `|-------|-------|`,
    `| Overall Render | ${input.scores.overall_render_score} |`,
    `| Premium | ${input.scores.premium_score} |`,
    `| Recruiter | ${input.scores.recruiter_score} |`,
  `| Prediction | ${input.scores.founder_approval_prediction} |`,
    "",
    "## First Impression",
    "",
    premium
      ? "Rendered output signals premium calm hierarchy and professional whitespace."
      : "Rendered output needs visual polish before founder approval.",
    memorable ? "Layout has memorable name prominence." : "",
    "",
    "_This preview reflects the Fabric-rendered page — what the founder sees in the editor._",
  ]
    .filter(Boolean)
    .join("\n");
}
