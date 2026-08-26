/**
 * Resume Factory → AIOS entry bridge — Agent #122.
 * Thin shim: factory Cursor executors enter ResumeKnowledgeGateway.
 * No factory rewrite · no templates · no OpenAI · no publish · dry-run.
 */
import { ResumeKnowledgeGateway } from "./ResumeKnowledgeGateway.js";
import type { ResumeKnowledgeGatewayResult } from "./ResumeKnowledgeGateway.js";
import {
  mapResumeOperationToSkill,
  type ResumeOperation,
} from "./ResumeSkillMapper.js";
import type { CursorResearchExecutor } from "../../runtime/research/ResearchCoordinator.js";
import type { CursorResearchTask } from "../../runtime/research/types.js";
import type { CursorExecutor } from "../../runtime/directors/resume-production/CursorResearchCoordinator.js";
import type { CursorResearchRequest } from "../../runtime/directors/resume-production/types.js";

export type ResumeFactoryAiInvokeInput = {
  entry_point_id: string;
  operation: ResumeOperation;
  task_id: string;
  objective: string;
  input?: Record<string, unknown>;
  dry_run?: boolean;
};

export type ResumeFactoryAiInvokeResult = ResumeKnowledgeGatewayResult & {
  entry_point_id: string;
  aios_path: string[];
  template_generated: false;
  published: false;
};

const AIOS_PATH_BASE = [
  "Resume Factory",
  "ResumeKnowledgeGateway",
  "Knowledge Snapshot",
  "ResumeBrainGateway",
  "Skill Request",
  "Brain Router",
] as const;

function aiosPathForProvider(provider: string | null | undefined): string[] {
  const adapter =
    provider === "openai" ? "OpenAI Provider" : "Mock Provider";
  return [
    ...AIOS_PATH_BASE,
    adapter,
    "Structured Response",
    "ResumeResponseConsumer",
    "Resume Factory",
  ];
}

/**
 * Canonical AI entry for Resume Factory operations.
 * Deterministic ops (qa, publication_gate) are rejected here.
 */
export async function invokeResumeFactoryAiOperation(
  input: ResumeFactoryAiInvokeInput,
): Promise<ResumeFactoryAiInvokeResult> {
  const mapping = mapResumeOperationToSkill(input.operation);
  if (mapping.kind === "deterministic") {
    throw new Error(
      `Deterministic operation "${input.operation}" must not enter AIOS Brain path (${mapping.reason})`,
    );
  }

  if (input.dry_run === false) {
    throw new Error("Agent #122 migration requires dry_run=true (LIVE OFF)");
  }

  const gateway = new ResumeKnowledgeGateway();
  const result = await gateway.executeWithKnowledge({
    operation: input.operation,
    task_id: input.task_id,
    objective: input.objective,
    input: {
      ...(input.input ?? {}),
      factory_entry_point_id: input.entry_point_id,
    },
    dry_run: true,
  });

  return {
    ...result,
    entry_point_id: input.entry_point_id,
    aios_path: aiosPathForProvider(
      result.selected_provider ?? result.primary_response?.provider,
    ),
    template_generated: false,
    published: false,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Gateway-backed replacement for createMockCursorResearchExecutor.
 * Preserves CursorResearchResult shape for factory callers.
 */
export function createGatewayBackedCursorResearchExecutor(options?: {
  failure_rate?: number;
  base_ms?: number;
}): CursorResearchExecutor {
  const failureRate = options?.failure_rate ?? 0;
  const baseMs = options?.base_ms ?? 50;

  return async (task: CursorResearchTask) => {
    await sleep(Math.min(baseMs, 10));

    if (Math.random() < failureRate) {
      return {
        session_id: task.session_id,
        success: false,
        duration_ms: baseMs,
        sources_consulted: task.mandatory_reads.slice(0, 3),
        intelligence_applied: [],
        external_findings: null,
        error: "Mock Cursor research timeout",
      };
    }

    const started = Date.now();
    try {
      const aios = await invokeResumeFactoryAiOperation({
        entry_point_id: "research.cursor_research_executor",
        operation: "planning",
        task_id: task.session_id,
        objective: task.objective,
        input: {
          mandatory_reads: task.mandatory_reads,
          firecrawl_topics: task.firecrawl_topics,
          temporary_only: true,
        },
        dry_run: true,
      });

      const ok = aios.primary_response?.status === "COMPLETED";
      return {
        session_id: task.session_id,
        success: ok,
        duration_ms: Math.max(baseMs, Date.now() - started),
        sources_consulted: [
          ...task.mandatory_reads,
          ...aios.knowledge_references.slice(0, 8),
        ],
        intelligence_applied: [
          "AIOS ResumeKnowledgeGateway",
          `Skill:${aios.skill_request.skill_id}`,
          `KnowledgeSnapshot:${aios.knowledge_snapshot.meta.snapshot_id}`,
          `Provider:${aios.primary_response?.provider ?? "none"}`,
          `Domains:${aios.domains_loaded.join(",")}`,
        ],
        external_findings: null,
        error: ok ? undefined : "AIOS planning response incomplete",
      };
    } catch (err) {
      return {
        session_id: task.session_id,
        success: false,
        duration_ms: Date.now() - started,
        sources_consulted: task.mandatory_reads.slice(0, 3),
        intelligence_applied: [],
        external_findings: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  };
}

/**
 * Gateway-backed replacement for createMockCursorExecutor (batch director).
 */
export function createGatewayBackedCursorExecutor(options: {
  failure_rate?: number;
  base_research_ms?: number;
  mcp_available?: boolean;
}): CursorExecutor {
  const failureRate = options.failure_rate ?? 0.04;
  const baseMs = options.base_research_ms ?? 120;

  return async (request: CursorResearchRequest) => {
    const durationBudget = baseMs + Math.floor(Math.random() * 80);
    await sleep(Math.min(durationBudget, 5));

    if (Math.random() < failureRate) {
      return {
        job_id: request.job_id,
        success: false,
        duration_ms: durationBudget,
        sources_consulted: request.knowledge_sources.slice(0, 3),
        external_research: [],
        intelligence_applied: [],
        error: "Mock Cursor agent timeout",
      };
    }

    const started = Date.now();
    try {
      const aios = await invokeResumeFactoryAiOperation({
        entry_point_id: "director.cursor_research_executor",
        operation: "planning",
        task_id: request.job_id,
        objective: `Resume production planning for priority=${request.priority}`,
        input: {
          priority: request.priority,
          knowledge_sources: request.knowledge_sources,
          research_topics: request.research_topics,
          temporary_only: true,
        },
        dry_run: true,
      });

      const external =
        request.mcp_firecrawl_available && request.research_topics.length > 0
          ? request.research_topics.slice(0, 3).map((t) => `firecrawl:${t}`)
          : [];

      const ok = aios.primary_response?.status === "COMPLETED";
      return {
        job_id: request.job_id,
        success: ok,
        duration_ms: Math.max(baseMs, Date.now() - started),
        sources_consulted: [
          ...request.knowledge_sources,
          ...aios.knowledge_references.slice(0, 6),
          ...(external.length ? ["firecrawl-mcp"] : []),
        ],
        external_research: external,
        intelligence_applied: [
          "AIOS ResumeKnowledgeGateway",
          `Skill:${aios.skill_request.skill_id}`,
          `KnowledgeSnapshot:${aios.knowledge_snapshot.meta.snapshot_id}`,
          `Provider:${aios.primary_response?.provider ?? "none"}`,
        ],
        error: ok ? undefined : "AIOS planning response incomplete",
      };
    } catch (err) {
      return {
        job_id: request.job_id,
        success: false,
        duration_ms: Date.now() - started,
        sources_consulted: request.knowledge_sources.slice(0, 3),
        external_research: [],
        intelligence_applied: [],
        error: err instanceof Error ? err.message : String(err),
      };
    }
  };
}

export function aiosMigrationPath(): string[] {
  return aiosPathForProvider("mock");
}
