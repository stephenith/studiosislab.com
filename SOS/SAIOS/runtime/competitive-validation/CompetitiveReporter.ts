/**
 * Competitive validation reporter — persist evaluation artifacts.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { COMPETITIVE_OUTPUT_ROOT } from "./CompetitiveMemory.js";
import type {
  CompetitiveAnalysis,
  CompetitiveScore,
  DesignDNADelta,
  RecommendedImprovement,
} from "./types.js";

export function resolveCompetitiveOutputDir(template_name: string): string {
  return join(COMPETITIVE_OUTPUT_ROOT, "evaluations", template_name);
}

export function persistCompetitiveArtifacts(input: {
  output_dir: string;
  analysis: CompetitiveAnalysis;
  score: CompetitiveScore;
  strengths: string[];
  weaknesses: string[];
  improvements: RecommendedImprovement[];
  delta: DesignDNADelta;
  persist?: boolean;
}): string[] {
  const files: string[] = [];
  const write = (name: string, content: object | string) => {
    if (input.persist !== false) {
      mkdirSync(input.output_dir, { recursive: true });
      writeFileSync(
        join(input.output_dir, name),
        typeof content === "string" ? content : JSON.stringify(content, null, 2),
      );
    }
    files.push(name);
  };

  write("competitive-analysis.json", input.analysis);
  write("competitive-score.json", input.score);
  write("strengths.json", { strengths: input.strengths });
  write("weaknesses.json", { weaknesses: input.weaknesses });
  write("recommended-improvements.json", { recommendations: input.improvements });
  write("design-dna-delta.json", input.delta);
  write(
    "competitive-report.md",
    renderCompetitiveReport({
      analysis: input.analysis,
      score: input.score,
      strengths: input.strengths,
      weaknesses: input.weaknesses,
      improvements: input.improvements,
      delta: input.delta,
    }),
  );

  return files;
}

function renderCompetitiveReport(input: {
  analysis: CompetitiveAnalysis;
  score: CompetitiveScore;
  strengths: string[];
  weaknesses: string[];
  improvements: RecommendedImprovement[];
  delta: DesignDNADelta;
}): string {
  const answer =
    input.score.likely_user_choice === "YES"
      ? "Yes — the StudiosisLab version is likely competitive enough to be chosen beside major builders."
      : input.score.likely_user_choice === "MAYBE"
        ? "Maybe — it competes credibly, but clearer brand differentiation or memorability is still needed."
        : "No — it is not yet objectively strong enough to win beside the strongest commercial builders.";

  return [
    "# Competitive Design Validation Report",
    "",
    `**Template:** ${input.analysis.template_name}`,
    `**Question:** ${input.analysis.question}`,
    `**Answer:** ${answer}`,
    `**Overall competitive score:** ${input.score.overall_competitive_score}/100`,
    `**Confidence:** ${input.score.confidence}/100`,
    `**Status:** AWAITING_FOUNDER_APPROVAL`,
    "",
    "## Evidence",
    "",
    ...input.analysis.evidence.map((e) => `- ${e}`),
    "",
    "## Strongest reasons to choose StudiosisLab",
    "",
    ...input.strengths.slice(0, 6).map((s) => `- ${s}`),
    "",
    "## Reasons a user may still choose a competitor",
    "",
    ...input.weaknesses.slice(0, 6).map((w) => `- ${w}`),
    "",
    "## Recommended Design DNA Evolution",
    "",
    ...input.improvements.slice(0, 6).map(
      (r) => `- **[${r.priority}]** ${r.recommendation} (${r.measurable_goal})`,
    ),
    "",
    "## Design DNA Delta",
    "",
    `- Should update DNA: ${input.delta.should_update ? "yes" : "no"}`,
    ...input.delta.rationale.map((r) => `- ${r}`),
  ].join("\n");
}
