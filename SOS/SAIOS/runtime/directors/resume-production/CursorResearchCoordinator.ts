/**
 * Cursor Research Coordinator — delegates research to AIOS ResumeKnowledgeGateway
 * via gateway-backed executor (Agent #122). Never runs research itself.
 */
import { randomUUID } from "node:crypto";
import type { CursorResearchRequest, CursorResearchResult, ProductionPriority } from "./types.js";
import { DIRECTOR_POLICIES } from "./ProductionPolicies.js";
import { createGatewayBackedCursorExecutor } from "../../../core/resume-integration/ResumeFactoryEntryBridge.js";

export type CursorExecutor = (request: CursorResearchRequest) => Promise<CursorResearchResult>;

export function buildResearchRequest(job: {
  job_id: string;
  priority: ProductionPriority;
  mcp_firecrawl_available?: boolean;
}): CursorResearchRequest {
  return {
    job_id: job.job_id,
    priority: job.priority,
    knowledge_sources: [...DIRECTOR_POLICIES.knowledge_sources_readonly],
    mcp_firecrawl_available: job.mcp_firecrawl_available ?? false,
    research_topics: job.mcp_firecrawl_available
      ? [...DIRECTOR_POLICIES.external_research_when_mcp_available]
      : [],
    temporary_only: true,
  };
}

/**
 * Default batch Cursor executor — routes through ResumeKnowledgeGateway (Agent #122).
 */
export function createMockCursorExecutor(options: {
  failure_rate?: number;
  base_research_ms?: number;
  mcp_available?: boolean;
}): CursorExecutor {
  return createGatewayBackedCursorExecutor(options);
}

export async function delegateToCursor(
  request: CursorResearchRequest,
  executor: CursorExecutor,
): Promise<CursorResearchResult & { cursor_session_id: string }> {
  const result = await executor(request);
  return { ...result, cursor_session_id: `cursor-${randomUUID().slice(0, 8)}` };
}
