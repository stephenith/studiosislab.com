/**
 * Resume Brain Gateway — KnowledgeSnapshot → SkillRequest → Skill Library → Brain Router → ProviderAdapter.
 * Agent #119/#121/#201/#203 — Mock by default; OpenAI on Founder one-test gates only.
 */
import type { ReasoningRequest } from "../ai-brain/ReasoningRequest.js";
import type { ReasoningResponse } from "../ai-brain/ReasoningResponse.js";
import {
  executeViaProvider,
  type BrainExecuteResult,
  type ExecuteViaProviderOptions,
} from "../ai-brain/BrainRouter.js";
import { getSkill } from "../skills/SkillComposition.js";
import { buildSkillExecutionPlan } from "../skills/SkillExecutionPlan.js";
import { skillToReasoningRequestSkeleton } from "../skills/SkillRouterContract.js";
import type { SkillRequest } from "../skills/Skill.js";
import { validateSkillRequest } from "../skills/SkillValidator.js";
import type { KnowledgeSnapshot } from "../knowledge/KnowledgeSnapshot.js";
import { consumeResumeResponse } from "./ResumeResponseConsumer.js";
import type { ResumeConsumedResult } from "./ResumeResponseConsumer.js";
import { assertSkillRequestHasKnowledge } from "./ResumeKnowledgeAttach.js";
import {
  canUseFounderOpenAIOneTest,
  resumeProviderExecuteOptions,
} from "./FounderOpenAIOneTest.js";
import { applyFounderDesignMemoryInstructions } from "../founder-memory/FounderPreferencePrompt.js";
import type { FounderMemorySelectionResult } from "../founder-memory/FounderMemoryConsumption.js";

export type ResumeGatewayStepResult = {
  skill_id: string;
  deterministic: boolean;
  brain?: BrainExecuteResult;
  skipped_reason?: string;
};

export type ResumeGatewayResult = {
  skill_request: SkillRequest;
  knowledge_snapshot: KnowledgeSnapshot;
  execution_plan_steps: string[];
  steps: ResumeGatewayStepResult[];
  /** Primary (root) brain response when available. */
  primary_response: ReasoningResponse | null;
  consumed: ResumeConsumedResult | null;
  flow: string[];
  /** Provider actually used for the primary response (mock | openai | …). */
  selected_provider: string | null;
  /** Phase 6B — Founder Memory selection evidence (design_planning only). */
  founder_memory_selection: FounderMemorySelectionResult | null;
};

/**
 * Build ReasoningRequest for Resume skills.
 * Fail-open Founder design memory injection applies only to design_planning.
 * Exported for deterministic verification.
 */
export function toFullReasoningRequest(
  skeleton: NonNullable<ReturnType<typeof skillToReasoningRequestSkeleton>>,
  skillRequest: SkillRequest,
  snapshot: KnowledgeSnapshot,
  opts?: { timeout_ms?: number; repoRoot?: string },
): {
  request: ReasoningRequest;
  founder_memory_selection: FounderMemorySelectionResult | null;
} {
  const knowledgeRefs = snapshot.references.map((r) => r.entry_id);
  const researchBriefing =
    typeof skillRequest.input.research_briefing === "string"
      ? skillRequest.input.research_briefing
      : null;
  const hasResearch = Boolean(
    researchBriefing || skillRequest.input.research_context,
  );
  const baseInstructions = `Skill:${skeleton.capability}; skill_id=${skillRequest.skill_id}; knowledge_snapshot=${snapshot.meta.snapshot_id}`;
  const withResearch = researchBriefing
    ? `${baseInstructions}; ${researchBriefing}`
    : baseInstructions;
  const memoryApplied = applyFounderDesignMemoryInstructions({
    baseInstructions: withResearch,
    skillRequest,
    capability: skeleton.capability,
    repoRoot: opts?.repoRoot,
  });
  return {
    founder_memory_selection: memoryApplied.selection,
    request: {
      ...skeleton,
      context_references: [
        ...new Set([
          ...(skillRequest.context_references ?? []),
          ...knowledgeRefs,
        ]),
      ],
      memory_references: memoryApplied.memory_references,
      expected_response_schema: {},
      priority: "normal",
      maximum_input_tokens: hasResearch ? 1600 : 800,
      maximum_output_tokens: 800,
      estimated_cost_ceiling_usd: null,
      timeout_ms: opts?.timeout_ms ?? 10_000,
      retry_policy: { max_retries: 0, backoff_ms: 0, retry_on: [] },
      fallback_policy: {
        enabled: false,
        allow_provider_fallback: false,
        allow_local_to_api: false,
        respect_privacy: true,
        respect_budget: true,
        respect_founder_gates: true,
        respect_live_gates: true,
      },
      created_at: skillRequest.created_at,
      deadline: null,
      founder_approval_requirement: true,
      instructions: memoryApplied.instructions,
      objective:
        typeof skillRequest.input.objective === "string"
          ? skillRequest.input.objective
          : skeleton.objective,
    },
  };
}

export class ResumeBrainGateway {
  constructor(private readonly executeOptions: ExecuteViaProviderOptions = {}) {}

  /**
   * Execute Skills only after a Minimal Knowledge Snapshot is provided.
   * Callers should use ResumeKnowledgeGateway.executeWithKnowledge().
   */
  async executeSkillRequest(
    skillRequest: SkillRequest,
    knowledgeSnapshot: KnowledgeSnapshot,
  ): Promise<ResumeGatewayResult> {
    const flow = [
      "Resume Department",
      "KnowledgeManager",
      "KnowledgeRetriever",
      "KnowledgeSnapshot",
      "ResumeBrainGateway",
      "SkillRequest",
      "BrainRouter",
      "Provider Registry",
      "ProviderAdapter",
      "Structured Response",
      "ResumeResponseConsumer",
      "Resume Department",
    ];

    if (!knowledgeSnapshot) {
      throw new Error("ResumeBrainGateway requires a KnowledgeSnapshot");
    }
    if (knowledgeSnapshot.meta.unrestricted !== false) {
      throw new Error("Unrestricted knowledge retrieval is forbidden");
    }
    if (knowledgeSnapshot.meta.live !== false) {
      throw new Error("LIVE knowledge is forbidden in dry-run gateway");
    }
    if (!knowledgeSnapshot.references.length) {
      throw new Error("KnowledgeSnapshot must include references");
    }

    const knowledgeCheck = assertSkillRequestHasKnowledge(skillRequest);
    if (!knowledgeCheck.ok) {
      throw new Error(
        `SkillRequest missing knowledge: ${knowledgeCheck.errors.join("; ")}`,
      );
    }

    const validation = validateSkillRequest(skillRequest);
    if (!validation.ok) {
      throw new Error(`Invalid SkillRequest: ${validation.errors.join("; ")}`);
    }
    if (skillRequest.department !== "resume") {
      throw new Error("ResumeBrainGateway only accepts department=resume");
    }
    if (!skillRequest.dry_run) {
      throw new Error("ResumeBrainGateway requires dry_run=true");
    }

    const plan = buildSkillExecutionPlan(skillRequest);
    const steps: ResumeGatewayStepResult[] = [];
    let primary: ReasoningResponse | null = null;
    let selectedProvider: string | null = null;
    let founderMemorySelection: FounderMemorySelectionResult | null = null;

    for (const step of plan.steps) {
      if (step.deterministic || !step.capability) {
        steps.push({
          skill_id: step.skill_id,
          deterministic: true,
          skipped_reason: "deterministic skill — code path only, no provider",
        });
        continue;
      }

      const skill = getSkill(step.skill_id);
      if (!skill) {
        steps.push({
          skill_id: step.skill_id,
          deterministic: false,
          skipped_reason: "unknown skill",
        });
        continue;
      }

      const skeleton = skillToReasoningRequestSkeleton(skill, {
        request_id: `${skillRequest.request_id}__${step.skill_id.replace(/\./g, "_")}`,
        task_id: skillRequest.task_id,
        department: skillRequest.department,
        dry_run: true,
      });
      if (!skeleton) {
        steps.push({
          skill_id: step.skill_id,
          deterministic: true,
          skipped_reason: "no reasoning skeleton",
        });
        continue;
      }

      const useOpenAI = canUseFounderOpenAIOneTest(
        skeleton.privacy_classification,
      );
      const built = toFullReasoningRequest(
        skeleton,
        skillRequest,
        knowledgeSnapshot,
        { timeout_ms: useOpenAI ? 90_000 : 10_000 },
      );
      if (built.founder_memory_selection?.FOUNDER_MEMORY_CONSUMED) {
        founderMemorySelection = built.founder_memory_selection;
      } else if (!founderMemorySelection && built.founder_memory_selection) {
        founderMemorySelection = built.founder_memory_selection;
      }
      const reasoning = {
        ...built.request,
        // SkillRequest stays dry_run (no publication). OpenAI only when all gates pass.
        dry_run: useOpenAI ? false : true,
        ...(useOpenAI
          ? {
              maximum_input_tokens: 2200,
              maximum_output_tokens: 3200,
            }
          : {}),
      };
      const brain = await executeViaProvider(
        reasoning,
        resumeProviderExecuteOptions(
          skeleton.privacy_classification,
          this.executeOptions,
        ),
      );
      steps.push({
        skill_id: step.skill_id,
        deterministic: false,
        brain,
      });

      if (step.skill_id === skillRequest.skill_id && brain.response) {
        primary = brain.response;
        selectedProvider =
          brain.plan.selected_provider ?? brain.response.provider;
      } else if (!primary && brain.response) {
        primary = brain.response;
        selectedProvider =
          brain.plan.selected_provider ?? brain.response.provider;
      }
    }

    const rootStep = steps.find((s) => s.skill_id === skillRequest.skill_id);
    if (rootStep?.brain?.response) {
      primary = rootStep.brain.response;
      selectedProvider =
        rootStep.brain.plan.selected_provider ?? primary.provider;
    }

    const consumed = primary
      ? consumeResumeResponse(skillRequest, primary)
      : null;

    return {
      skill_request: skillRequest,
      knowledge_snapshot: knowledgeSnapshot,
      execution_plan_steps: plan.steps.map((s) => s.skill_id),
      steps,
      primary_response: primary,
      consumed,
      flow,
      selected_provider: selectedProvider,
      founder_memory_selection: founderMemorySelection,
    };
  }
}
