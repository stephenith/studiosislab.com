/**
 * Resume Knowledge Gateway — always loads scoped knowledge before Skills.
 * Agent #121 — dry-run; no persistence; no OpenAI; no templates; no publish.
 */
import { KnowledgeManager } from "../knowledge/KnowledgeManager.js";
import type { ResumeKnowledgeLoadResult } from "../knowledge/KnowledgeManager.js";
import type { KnowledgeSnapshot } from "../knowledge/KnowledgeSnapshot.js";
import { RESUME_PRE_SKILL_DOMAINS } from "../knowledge/KnowledgeContext.js";
import {
  createResumeSkillRequest,
  type ResumeSkillRequestInput,
} from "./ResumeSkillRequest.js";
import {
  ResumeBrainGateway,
  type ResumeGatewayResult,
} from "./ResumeBrainGateway.js";
import {
  attachKnowledgeToSkillRequest,
  assertSkillRequestHasKnowledge,
} from "./ResumeKnowledgeAttach.js";

export type ResumeKnowledgeGatewayResult = ResumeGatewayResult & {
  knowledge: ResumeKnowledgeLoadResult;
  knowledge_snapshot: KnowledgeSnapshot;
  knowledge_references: string[];
  domains_loaded: typeof RESUME_PRE_SKILL_DOMAINS;
};

export {
  attachKnowledgeToSkillRequest,
  assertSkillRequestHasKnowledge,
} from "./ResumeKnowledgeAttach.js";

/**
 * Resume Department entry: Knowledge → Snapshot → BrainGateway → Skills.
 */
export class ResumeKnowledgeGateway {
  constructor(
    private readonly knowledge: KnowledgeManager = new KnowledgeManager(),
    private readonly brain: ResumeBrainGateway = new ResumeBrainGateway(),
  ) {}

  async executeWithKnowledge(
    input: ResumeSkillRequestInput,
  ): Promise<ResumeKnowledgeGatewayResult> {
    const purpose =
      typeof input.objective === "string"
        ? input.objective
        : "Resume Department pre-Skill knowledge load";

    const loaded = this.knowledge.loadResumePreSkillKnowledge({
      purpose,
      task_id: input.task_id,
    });

    const base = createResumeSkillRequest({
      ...input,
      dry_run: input.dry_run ?? true,
    });

    const skillRequest = attachKnowledgeToSkillRequest(
      base,
      loaded.snapshot,
    );

    const attached = assertSkillRequestHasKnowledge(skillRequest);
    if (!attached.ok) {
      throw new Error(
        `Knowledge attach failed: ${attached.errors.join("; ")}`,
      );
    }

    const result = await this.brain.executeSkillRequest(
      skillRequest,
      loaded.snapshot,
    );

    return {
      ...result,
      knowledge: loaded,
      knowledge_snapshot: loaded.snapshot,
      knowledge_references: loaded.snapshot.references.map((r) => r.entry_id),
      domains_loaded: [...RESUME_PRE_SKILL_DOMAINS],
    };
  }
}
