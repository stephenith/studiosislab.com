/**
 * Knowledge System entry + request contracts — Agent #120.
 * Replaces the generic Shared Memory idea with scoped, owned knowledge domains.
 */

export type KnowledgeDomain =
  | "founder"
  | "company"
  | "project"
  | "department"
  | "learning"
  | "runtime";

export type KnowledgePriority = "critical" | "high" | "normal" | "low";

export type KnowledgeScope =
  | "global"
  | "department"
  | "task"
  | "cycle"
  | "session";

export type KnowledgeSource =
  | "founder"
  | "executive_brain"
  | "architecture_change"
  | "department"
  | "approval_event"
  | "rejection_event"
  | "runtime_sensor"
  | "seed";

export type KnowledgeConfidence = "confirmed" | "probable" | "observed" | "draft";

export type KnowledgeVersion = string;

export type KnowledgeWriterRole =
  | "founder"
  | "executive_brain"
  | "architecture"
  | "department_owner"
  | "learning_pipeline"
  | "runtime";

export interface KnowledgeReference {
  entry_id: string;
  domain: KnowledgeDomain;
  version: KnowledgeVersion;
  title: string;
  uri?: string;
}

export interface KnowledgeEntry {
  entry_id: string;
  domain: KnowledgeDomain;
  title: string;
  summary: string;
  content: Record<string, unknown>;
  tags: string[];
  scope: KnowledgeScope;
  priority: KnowledgePriority;
  version: KnowledgeVersion;
  source: KnowledgeSource;
  confidence: KnowledgeConfidence;
  owner: string;
  department_id?: string;
  read_roles: string[];
  write_roles: KnowledgeWriterRole[];
  created_at: string;
  updated_at: string;
  active: boolean;
}

export interface KnowledgeRequest {
  request_id: string;
  requester: string;
  department_id: string;
  purpose: string;
  domains: KnowledgeDomain[];
  tags?: string[];
  max_entries?: number;
  priority_floor?: KnowledgePriority;
  include_references_only?: boolean;
  task_id?: string;
  dry_run?: boolean;
}

export function createKnowledgeRequest(input: {
  requester: string;
  department_id: string;
  purpose: string;
  domains: KnowledgeDomain[];
  tags?: string[];
  max_entries?: number;
  priority_floor?: KnowledgePriority;
  include_references_only?: boolean;
  task_id?: string;
  dry_run?: boolean;
}): KnowledgeRequest {
  const stamp = Date.now().toString(36);
  return {
    request_id: `knreq-${input.department_id}-${stamp}`,
    requester: input.requester,
    department_id: input.department_id,
    purpose: input.purpose,
    domains: [...input.domains],
    tags: input.tags ? [...input.tags] : undefined,
    max_entries: input.max_entries ?? 12,
    priority_floor: input.priority_floor ?? "low",
    include_references_only: input.include_references_only ?? false,
    task_id: input.task_id,
    dry_run: input.dry_run ?? true,
  };
}
