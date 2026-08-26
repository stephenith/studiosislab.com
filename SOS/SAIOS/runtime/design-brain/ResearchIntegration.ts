/**
 * Research integration — delegates external research to Cursor; stores validated principles only.
 */
import {
  buildCursorResearchTask,
  delegateResearchToCursor,
  type CursorResearchExecutor,
} from "../research/ResearchCoordinator.js";
import { FIRECRAWL_RESEARCH_TOPICS } from "../research/FirecrawlCoordinator.js";
import { loadResumeDesignKnowledge } from "../../domain/studiosislab/resume/ResumeDesignKnowledge.js";
import { loadResumeIntelligenceEngine } from "../../domain/studiosislab/resume/intelligence/ResumeIntelligenceEngine.js";
import { buildDesignSystemBundle } from "../design-system/DesignSystemDirector.js";

export type ValidatedResearch = {
  session_id: string;
  researched_at: string;
  mcp_available: boolean;
  principles: string[];
  heuristics: string[];
  patterns: string[];
  sources_consulted: string[];
  temporary_only: true;
  copyright_safe: true;
};

const CURSOR_RESEARCH_SCOPE = [
  "Modern resume trends",
  "Premium resume products",
  "Canva",
  "Resume.io",
  "Novoresume",
  "Enhancv",
  "Kickresume",
  "FlowCV",
  "Reactive Resume",
  "Typography trends",
  "Modern spacing systems",
  "Grid systems",
  "Professional color systems",
  "ATS recommendations",
  "Accessibility",
  "Industry expectations",
  "Current hiring preferences",
] as const;

export async function integrateResearch(input: {
  objective: string;
  executor: CursorResearchExecutor;
  mcp_available: boolean;
}): Promise<ValidatedResearch> {
  const task = buildCursorResearchTask({
    objective: input.objective,
    mcp_firecrawl_available: input.mcp_available,
  });

  const result = await delegateResearchToCursor(task, input.executor);
  if (!result.success) {
    throw new Error(result.error ?? "Cursor research delegation failed");
  }

  const knowledge = loadResumeDesignKnowledge();
  const intelligence = loadResumeIntelligenceEngine();

  const principles = [
    ...knowledge.design_standards.slice(0, 4).map((s) => s.description),
    ...knowledge.ats_standards.slice(0, 3).map((s) => s.description),
    ...buildDesignSystemBundle(true).design_dna.principles.slice(0, 4),
    "Single-column ATS layouts improve parse reliability",
    "Generous whitespace improves recruiter scan time",
    "Limit to 2 font families maximum",
    "Section headings must be plain text Textboxes",
    `Corpus analyzed: ${intelligence.database.published_template_count} templates`,
  ];

  const heuristics = [
    "Never copy layouts — extract spacing and hierarchy principles only",
    "Accent color used sparingly — one primary accent maximum",
    "Experience section receives highest visual weight after name block",
    "Premium quality depends on visual identity, recognizability, and emotional first impression — not only ATS",
    "StudiosisLab signature: spacing, dividers, typography rhythm — no graphics or icons",
    "Design DNA: ask where the eye moves — not what font size",
    "Design DNA: experience is the hiring decision zone — focal mass and dwell time",
    "Design DNA: trust through restraint, alignment, and predictable structure",
    "Decoration density below 0.15 for ATS-first designs",
    "Margins 48–56px for professional corporate feel",
    ...result.intelligence_applied.slice(0, 4),
  ];

  const patterns = input.mcp_available
    ? FIRECRAWL_RESEARCH_TOPICS.slice(0, 8).map(
        (t) => `${t}: summarize patterns only — no layout cloning`,
      )
    : CURSOR_RESEARCH_SCOPE.slice(0, 6).map((t) => `${t}: deferred — use domain knowledge`);

  return {
    session_id: result.session_id,
    researched_at: new Date().toISOString(),
    mcp_available: input.mcp_available,
    principles,
    heuristics,
    patterns,
    sources_consulted: result.sources_consulted,
    temporary_only: true,
    copyright_safe: true,
  };
}

export function renderResearchSummaryMd(research: ValidatedResearch, objective: string): string {
  return [
    "# Research Summary — Design Brain",
    "",
    `**Objective:** ${objective}`,
    `**Cursor session:** ${research.session_id}`,
    `**MCP available:** ${research.mcp_available}`,
    "",
    "## Validated principles (stored)",
    "",
    ...research.principles.map((p) => `- ${p}`),
    "",
    "## Design heuristics",
    "",
    ...research.heuristics.map((h) => `- ${h}`),
    "",
    "## Patterns (temporary — not layout copies)",
    "",
    ...research.patterns.map((p) => `- ${p}`),
    "",
    "*Internet knowledge temporary. Only validated principles persisted.*",
  ].join("\n");
}
