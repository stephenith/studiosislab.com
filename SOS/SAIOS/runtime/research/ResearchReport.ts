/**
 * Research report — founder-facing markdown summary.
 */
import { writeFileSync } from "node:fs";
import type { ResearchSession, ValidationResult } from "./types.js";
import type { SessionPaths } from "./ResearchMemory.js";

export function renderResearchReportMd(
  session: ResearchSession,
  validation: ValidationResult,
): string {
  const b = session.design_brief;
  return [
    "# Resume Design Research Report",
    "",
    `**Session:** \`${session.session_id}\``,
    `**Generated:** ${b.generated_at}`,
    `**Confidence:** ${b.confidence}/100`,
    `**Validation:** ${validation.pass ? "PASS" : "FAIL"}`,
    "",
    "## Founder Objective",
    "",
    session.objective,
    "",
    "## Design Brief Summary",
    "",
    "| Field | Value |",
    "|-------|-------|",
    `| Industry | ${b.industry} |`,
    `| Target User | ${b.target_user} |`,
    `| ATS Strategy | ${b.ats_strategy} |`,
    `| Layout Strategy | ${b.layout_strategy} |`,
    `| Font | ${b.typography_plan.font_family} |`,
    `| Primary Accent | ${b.color_plan.primary_accent} |`,
    `| Uniqueness Score | ${b.studiosislab_comparison.uniqueness_score}% |`,
    "",
    "## Industry Analysis",
    "",
    `- **Hiring style:** ${session.industry_analysis.hiring_style}`,
    `- **ATS sensitivity:** ${session.industry_analysis.ats_sensitivity}`,
    `- **Visual preference:** ${session.industry_analysis.visual_preference}`,
    `- **Resume length:** ${session.industry_analysis.expected_resume_length}`,
    "",
    "## StudiosisLab Template Comparison",
    "",
    "### Most Similar Templates",
    "",
    ...b.studiosislab_comparison.most_similar_templates.map(
      (t) =>
        `- \`${t.template_id}\` (${t.family}) — similarity ${Math.round(t.similarity_score * 100)}%, ATS ${t.ats_score}, Visual ${t.visual_score}`,
    ),
    "",
    "### Reusable Ideas",
    "",
    ...b.studiosislab_comparison.reusable_ideas.map((i) => `- ${i}`),
    "",
    "### Weaknesses to Avoid",
    "",
    ...b.studiosislab_comparison.weaknesses_to_avoid.map((w) => `- ${w}`),
    "",
    "## External Research (Temporary)",
    "",
    session.firecrawl.mcp_available
      ? session.firecrawl.findings
          .slice(0, 5)
          .map((f) => `- **${f.topic}:** ${f.summary}`)
          .join("\n")
      : "_Firecrawl MCP unavailable — external research skipped._",
    "",
    "## Risk Assessment",
    "",
    ...b.risk_assessment.map((r) => `- ${r}`),
    "",
    "## Validation Checks",
    "",
    ...Object.entries(validation.checks).map(([k, v]) => `- [${v ? "x" : " "}] ${k}`),
    "",
    "## Next Step",
    "",
    "This Design Brief is the **only** input for Resume Production Worker.",
    "",
    "*Planning only — no templates generated, no src/ or manifest changes.*",
  ].join("\n");
}

export function writeResearchReport(paths: SessionPaths, content: string): void {
  writeFileSync(paths.report, content, "utf8");
}
