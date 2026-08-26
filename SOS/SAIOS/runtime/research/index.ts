/**
 * Resume Design Research & Planning Engine — public exports.
 */
export { RESEARCH_DIRECTOR, runResearchSession, type RunResearchOptions, type ResearchRunResult } from "./ResearchDirector.js";
export { createResearchPlan, type ResearchPlan } from "./ResearchPlanner.js";
export {
  buildCursorResearchTask,
  delegateResearchToCursor,
  createMockCursorResearchExecutor,
  MANDATORY_CURSOR_READS,
  type CursorResearchExecutor,
} from "./ResearchCoordinator.js";
export { buildFirecrawlScope, FIRECRAWL_RESEARCH_TOPICS, createMockFirecrawlSummary } from "./FirecrawlCoordinator.js";
export { analyzeExistingTemplates, getCorpusStats } from "./ExistingTemplateAnalyzer.js";
export { analyzeIndustry } from "./IndustryAnalyzer.js";
export { buildDesignBrief } from "./DesignPlanner.js";
export { planTypography } from "./TypographyPlanner.js";
export { planColors } from "./ColorPlanner.js";
export { planLayout } from "./LayoutPlanner.js";
export { planATS } from "./ATSPlanner.js";
export { validateResearchSession } from "./ResearchValidator.js";
export { renderResearchReportMd, writeResearchReport } from "./ResearchReport.js";
export { allocateSessionId, createSessionDir, persistResearchSession, RESEARCH_ROOT, SESSIONS_ROOT } from "./ResearchMemory.js";
export * from "./types.js";
