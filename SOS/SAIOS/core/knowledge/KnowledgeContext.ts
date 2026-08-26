/**
 * Knowledge Context — scoped request envelope for departments — Agent #120.
 */
import {
  createKnowledgeRequest,
  type KnowledgeDomain,
  type KnowledgePriority,
  type KnowledgeRequest,
} from "./KnowledgeEntry.js";

export interface KnowledgeContextSpec {
  department_id: string;
  requester: string;
  purpose: string;
  domains: KnowledgeDomain[];
  tags?: string[];
  max_entries?: number;
  priority_floor?: KnowledgePriority;
  task_id?: string;
  dry_run?: boolean;
}

/**
 * Resume Department standard pre-Skill knowledge load order:
 * Founder → Company → Resume Department → Learning
 */
export const RESUME_PRE_SKILL_DOMAINS: KnowledgeDomain[] = [
  "founder",
  "company",
  "department",
  "learning",
];

export class KnowledgeContext {
  readonly request: KnowledgeRequest;

  constructor(spec: KnowledgeContextSpec) {
    if (!spec.domains.length) {
      throw new Error("KnowledgeContext requires at least one domain");
    }
    this.request = createKnowledgeRequest({
      requester: spec.requester,
      department_id: spec.department_id,
      purpose: spec.purpose,
      domains: spec.domains,
      tags: spec.tags,
      max_entries: spec.max_entries,
      priority_floor: spec.priority_floor,
      task_id: spec.task_id,
      dry_run: spec.dry_run ?? true,
    });
  }

  static forResumePreSkill(input: {
    purpose: string;
    task_id?: string;
    tags?: string[];
    max_entries?: number;
  }): KnowledgeContext {
    return new KnowledgeContext({
      department_id: "resume",
      requester: "resume_department",
      purpose: input.purpose,
      domains: [...RESUME_PRE_SKILL_DOMAINS],
      tags: input.tags,
      max_entries: input.max_entries ?? 12,
      priority_floor: "low",
      task_id: input.task_id,
      dry_run: true,
    });
  }
}
