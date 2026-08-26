/**
 * Research coordinator — delegates all reasoning to AIOS ResumeKnowledgeGateway
 * (via gateway-backed Cursor executor). SAIOS coordinates; Cursor is no longer
 * the intelligence backend for dry-run factory entry.
 */
import { randomUUID } from "node:crypto";
import { buildFirecrawlScope } from "./FirecrawlCoordinator.js";
import type { CursorResearchResult, CursorResearchTask } from "./types.js";
import { createGatewayBackedCursorResearchExecutor } from "../../core/resume-integration/ResumeFactoryEntryBridge.js";

export type CursorResearchExecutor = (task: CursorResearchTask) => Promise<CursorResearchResult>;

export const MANDATORY_CURSOR_READS = [
  "Resume Design Knowledge",
  "Resume Intelligence Engine",
  "Resume Learning Engine",
  "Resume Generation Specification",
  "Editor Technical Contract",
  "ALL existing StudiosisLab templates (layout families, typography, spacing, ATS/visual scores)",
] as const;

export const CURSOR_ANALYSIS_REQUIREMENTS = [
  "Detect layout families across corpus",
  "Analyze typography patterns",
  "Analyze spacing profiles",
  "Score ATS and visual characteristics",
  "Identify weaknesses in existing templates",
  "Extract reusable ideas without duplicating layouts",
  "Never duplicate an existing layout",
] as const;

export function buildCursorResearchTask(input: {
  objective: string;
  mcp_firecrawl_available?: boolean;
  session_id?: string;
}): CursorResearchTask {
  const scope = buildFirecrawlScope(input.mcp_firecrawl_available ?? false);
  return {
    session_id: input.session_id ?? `cursor-${randomUUID().slice(0, 8)}`,
    objective: input.objective,
    mandatory_reads: [...MANDATORY_CURSOR_READS],
    firecrawl_topics: scope.topics,
    mcp_firecrawl_available: scope.mcp_available,
    temporary_only: true,
  };
}

export async function delegateResearchToCursor(
  task: CursorResearchTask,
  executor: CursorResearchExecutor,
): Promise<CursorResearchResult> {
  return executor(task);
}

/**
 * Default factory research executor — routes through ResumeKnowledgeGateway (Agent #122).
 * Name retained for call-site compatibility; backend is AIOS, not local mock knowledge only.
 */
export function createMockCursorResearchExecutor(options?: {
  failure_rate?: number;
  base_ms?: number;
}): CursorResearchExecutor {
  return createGatewayBackedCursorResearchExecutor(options);
}
