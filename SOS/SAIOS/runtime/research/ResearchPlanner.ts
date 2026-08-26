/**
 * Research planner — decompose founder objective into research plan stages.
 */
import type { IndustryId } from "./types.js";
import { analyzeIndustry } from "./IndustryAnalyzer.js";
import { getCorpusStats } from "./ExistingTemplateAnalyzer.js";
import { buildFirecrawlScope } from "./FirecrawlCoordinator.js";
import { MANDATORY_CURSOR_READS } from "./ResearchCoordinator.js";

export type ResearchPlan = {
  plan_id: string;
  objective: string;
  created_at: string;
  industry_hint: IndustryId;
  stages: ResearchPlanStage[];
  corpus_stats: ReturnType<typeof getCorpusStats>;
  firecrawl_scope: ReturnType<typeof buildFirecrawlScope>;
};

export type ResearchPlanStage = {
  id: string;
  name: string;
  description: string;
  delegated_to: "cursor_agent" | "saios_analyzer" | "saios_planner";
};

export function createResearchPlan(objective: string, mcp_available = false): ResearchPlan {
  const industry = analyzeIndustry(objective);
  const plan_id = `plan-${Date.now()}`;

  const stages: ResearchPlanStage[] = [
    {
      id: "cursor_mandatory_reads",
      name: "Cursor Mandatory Reads",
      description: MANDATORY_CURSOR_READS.join("; "),
      delegated_to: "cursor_agent",
    },
    {
      id: "existing_template_analysis",
      name: "Existing Template Analysis",
      description: "Compare against ALL StudiosisLab templates — uniqueness target ≤35% similarity",
      delegated_to: "saios_analyzer",
    },
    {
      id: "firecrawl_research",
      name: "Firecrawl External Research",
      description: mcp_available
        ? "Cursor researches trusted external sources (temporary knowledge)"
        : "Skipped — Firecrawl MCP unavailable",
      delegated_to: "cursor_agent",
    },
    {
      id: "industry_analysis",
      name: "Industry Analysis",
      description: `Target industry: ${industry.industry}`,
      delegated_to: "saios_analyzer",
    },
    {
      id: "typography_planning",
      name: "Typography Planning",
      description: "Font, hierarchy, spacing, readability",
      delegated_to: "saios_planner",
    },
    {
      id: "color_planning",
      name: "Color Planning",
      description: "Professional palette, contrast, accessibility",
      delegated_to: "saios_planner",
    },
    {
      id: "layout_planning",
      name: "Layout Planning",
      description: "Structure, margins, section order, reading flow",
      delegated_to: "saios_planner",
    },
    {
      id: "ats_planning",
      name: "ATS Planning",
      description: "Parse reliability, forbidden elements, keyword strategy",
      delegated_to: "saios_planner",
    },
    {
      id: "design_brief",
      name: "Design Brief Assembly",
      description: "Single authoritative brief for Resume Production Worker",
      delegated_to: "saios_planner",
    },
  ];

  return {
    plan_id,
    objective,
    created_at: new Date().toISOString(),
    industry_hint: industry.industry,
    stages,
    corpus_stats: getCorpusStats(),
    firecrawl_scope: buildFirecrawlScope(mcp_available),
  };
}
