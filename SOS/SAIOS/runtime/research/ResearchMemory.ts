/**
 * Research memory — versioned persistence under SOS/07_LOGS/saios/research/.
 * Never overwrites previous sessions.
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type {
  ATSPlan,
  ColorPlan,
  CursorResearchResult,
  DesignBrief,
  FirecrawlResearchSummary,
  IndustryAnalysis,
  LayoutPlan,
  ResearchSession,
  TemplateComparison,
  TypographyPlan,
} from "./types.js";

const SOS_ROOT = resolve(import.meta.dirname, "../../..");
export const RESEARCH_ROOT = join(SOS_ROOT, "07_LOGS/saios/research");
export const SESSIONS_ROOT = join(RESEARCH_ROOT, "sessions");

export type SessionPaths = {
  session_id: string;
  session_dir: string;
  research: string;
  design_brief: string;
  sources: string;
  comparison: string;
  industry_analysis: string;
  ats_plan: string;
  layout_plan: string;
  typography_plan: string;
  color_plan: string;
  report: string;
};

export function allocateSessionId(date = new Date()): string {
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, "");
  mkdirSync(SESSIONS_ROOT, { recursive: true });
  const prefix = `research-${ymd}-`;
  const existing = readdirSync(SESSIONS_ROOT).filter((n) => n.startsWith(prefix));
  const seq = existing.length + 1;
  return `${prefix}${String(seq).padStart(3, "0")}`;
}

export function createSessionDir(session_id: string): SessionPaths {
  const session_dir = join(SESSIONS_ROOT, session_id);
  if (existsSync(session_dir)) {
    throw new Error(`Research session already exists — will not overwrite: ${session_dir}`);
  }
  mkdirSync(session_dir, { recursive: true });
  return {
    session_id,
    session_dir,
    research: join(session_dir, "research.json"),
    design_brief: join(session_dir, "design-brief.json"),
    sources: join(session_dir, "sources.json"),
    comparison: join(session_dir, "comparison.json"),
    industry_analysis: join(session_dir, "industry-analysis.json"),
    ats_plan: join(session_dir, "ats-plan.json"),
    layout_plan: join(session_dir, "layout-plan.json"),
    typography_plan: join(session_dir, "typography-plan.json"),
    color_plan: join(session_dir, "color-plan.json"),
    report: join(session_dir, "report.md"),
  };
}

export function persistResearchSession(
  paths: SessionPaths,
  session: ResearchSession,
): string {
  const sources = {
    session_id: session.session_id,
    cursor: session.cursor_result,
    mandatory_reads: session.cursor_result.sources_consulted,
    intelligence_applied: session.cursor_result.intelligence_applied,
    firecrawl_temporary: session.firecrawl,
    persisted_at: new Date().toISOString(),
  };

  writeFileSync(paths.research, JSON.stringify(session, null, 2));
  writeFileSync(paths.design_brief, JSON.stringify(session.design_brief, null, 2));
  writeFileSync(paths.sources, JSON.stringify(sources, null, 2));
  writeFileSync(paths.comparison, JSON.stringify(session.template_comparison, null, 2));
  writeFileSync(
    paths.industry_analysis,
    JSON.stringify(session.industry_analysis, null, 2),
  );
  writeFileSync(paths.ats_plan, JSON.stringify(session.ats_plan, null, 2));
  writeFileSync(paths.layout_plan, JSON.stringify(session.layout_plan, null, 2));
  writeFileSync(paths.typography_plan, JSON.stringify(session.typography_plan, null, 2));
  writeFileSync(paths.color_plan, JSON.stringify(session.color_plan, null, 2));

  return paths.session_dir;
}

export function listResearchSessions(): string[] {
  if (!existsSync(SESSIONS_ROOT)) return [];
  return readdirSync(SESSIONS_ROOT).filter((n) => n.startsWith("research-"));
}
