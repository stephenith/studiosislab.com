/**
 * Research Director — mandatory first stage before every resume generation.
 * Coordinates planning only; Cursor Agent performs all reasoning.
 */
import { analyzeExistingTemplates } from "./ExistingTemplateAnalyzer.js";
import { analyzeIndustry } from "./IndustryAnalyzer.js";
import { buildDesignBrief } from "./DesignPlanner.js";
import { createMockFirecrawlSummary } from "./FirecrawlCoordinator.js";
import { planATS } from "./ATSPlanner.js";
import { planColors } from "./ColorPlanner.js";
import { planLayout } from "./LayoutPlanner.js";
import { planTypography } from "./TypographyPlanner.js";
import { createResearchPlan } from "./ResearchPlanner.js";
import {
  buildCursorResearchTask,
  delegateResearchToCursor,
  type CursorResearchExecutor,
} from "./ResearchCoordinator.js";
import {
  allocateSessionId,
  createSessionDir,
  persistResearchSession,
  type SessionPaths,
} from "./ResearchMemory.js";
import { renderResearchReportMd, writeResearchReport } from "./ResearchReport.js";
import { validateResearchSession } from "./ResearchValidator.js";
import type { DesignBrief, ResearchSession, ValidationResult } from "./types.js";

export const RESEARCH_DIRECTOR = {
  director_type: "resume-design-research-director",
  version: "1.0.0",
  display_name: "Resume Design Research & Planning Engine",
  description:
    "Mandatory pre-generation stage. Builds the Design Brief that every Resume Worker follows. Planning only — never generates templates.",
  role: "coordination_only",
  primary_intelligence: "cursor_agent",
} as const;

export type RunResearchOptions = {
  objective: string;
  cursor_executor: CursorResearchExecutor;
  mcp_firecrawl_available?: boolean;
  session_id?: string;
  persist?: boolean;
};

export type ResearchRunResult = {
  pass: boolean;
  session_id: string;
  session_dir: string;
  design_brief: DesignBrief;
  validation: ValidationResult;
  session: ResearchSession;
};

export async function runResearchSession(
  options: RunResearchOptions,
): Promise<ResearchRunResult> {
  const session_id = options.session_id ?? allocateSessionId();
  const paths = createSessionDir(session_id);
  const mcp = options.mcp_firecrawl_available ?? false;

  const plan = createResearchPlan(options.objective, mcp);

  const cursorTask = buildCursorResearchTask({
    objective: options.objective,
    mcp_firecrawl_available: mcp,
    session_id,
  });

  const cursor_result = await delegateResearchToCursor(
    cursorTask,
    options.cursor_executor,
  );

  if (!cursor_result.success) {
    throw new Error(cursor_result.error ?? "Cursor research failed");
  }

  const industry = analyzeIndustry(options.objective);
  const comparison = analyzeExistingTemplates({
    objective: options.objective,
    industry: industry.industry,
  });

  const firecrawl = createMockFirecrawlSummary(mcp);

  const typography = planTypography({
    industry,
    comparison,
    objective: options.objective,
  });

  const color = planColors({ industry });
  const layout = planLayout({ industry, comparison, objective: options.objective });
  const ats = planATS({ industry, layout, objective: options.objective });

  const cursor_summary = [
    `Cursor consulted ${cursor_result.sources_consulted.length} mandatory sources.`,
    `Intelligence applied: ${cursor_result.intelligence_applied.join("; ")}.`,
    `Plan stages: ${plan.stages.length}.`,
  ].join(" ");

  const design_brief = buildDesignBrief({
    session_id,
    objective: options.objective,
    industry,
    comparison,
    firecrawl,
    typography,
    color,
    layout,
    ats,
    cursor_summary,
  });

  const session: ResearchSession = {
    session_id,
    session_dir: paths.session_dir,
    objective: options.objective,
    created_at: new Date().toISOString(),
    industry_analysis: industry,
    template_comparison: comparison,
    firecrawl,
    typography_plan: typography,
    color_plan: color,
    layout_plan: layout,
    ats_plan: ats,
    design_brief,
    cursor_result: {
      ...cursor_result,
      external_findings: firecrawl,
    },
  };

  const validation = validateResearchSession(session);

  if (options.persist !== false) {
    persistArtifacts(paths, session, validation);
  }

  return {
    pass: validation.pass,
    session_id,
    session_dir: paths.session_dir,
    design_brief,
    validation,
    session,
  };
}

function persistArtifacts(
  paths: SessionPaths,
  session: ResearchSession,
  validation: ValidationResult,
): void {
  persistResearchSession(paths, session);
  writeResearchReport(paths, renderResearchReportMd(session, validation));
}
