/**
 * Founder Preference Memory V1 — schema contracts.
 * Schema: founder-preference-memory-1.0.0
 */

export const FOUNDER_PREFERENCE_MEMORY_SCHEMA =
  "founder-preference-memory-1.0.0" as const;

export type MemoryScope =
  | "GLOBAL"
  | "CATEGORY"
  | "ROLE"
  | "ROLE_FAMILY"
  | "DESIGN_FAMILY"
  | "ARCHITECTURE"
  | "SECTION"
  | "COMPONENT";

export type MemoryStatus =
  | "PROVISIONAL"
  | "CONFIRMED"
  | "REJECTED"
  | "SUPERSEDED";

export type SignalType =
  | "POSITIVE_EXEMPLAR"
  | "NEGATIVE_EXEMPLAR"
  | "CONSTRAINT"
  | "PREFERENCE";

export type MemoryConfidence = "low" | "medium" | "high";

export type FounderPreferenceMemoryRecord = {
  memory_id: string;
  schema_version: typeof FOUNDER_PREFERENCE_MEMORY_SCHEMA;
  scope: MemoryScope;
  issue_type: string;
  normalized_rule: string;
  raw_founder_feedback: string;
  signal_type: SignalType;
  confidence: MemoryConfidence;
  status: MemoryStatus;
  candidate_id: string | null;
  review_id: string;
  decision_id: string;
  revision_task_id: string | null;
  role: string | null;
  category: string | null;
  role_family: string | null;
  design_family: string | null;
  architecture: string | null;
  section: string | null;
  component: string | null;
  positive_or_negative: "positive" | "negative";
  source_decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
  acceptance_result: "pending" | "accepted" | "rejected" | "n/a";
  created_at: string;
  updated_at: string;
  superseded_by: string | null;
  content_hash: string;
  active: boolean;
};

export type FounderMemoryEvent = {
  event_id: string;
  at: string;
  type:
    | "MEMORY_CREATED"
    | "MEMORY_PROMOTED"
    | "MEMORY_SUPERSEDED"
    | "MEMORY_SKIPPED"
    | "MEMORY_WRITE_FAILED";
  decision_id?: string;
  review_id?: string;
  memory_id?: string;
  detail: string;
};

export type GenerationTargetContext = {
  category?: string | null;
  role?: string | null;
  role_family?: string | null;
  design_family?: string | null;
  architecture?: string | null;
  section?: string | null;
  component?: string | null;
};

export type CandidateEnrichment = {
  candidate_id: string | null;
  role: string | null;
  category: string | null;
  role_family: string | null;
  design_family: string | null;
  architecture: string | null;
  parent_candidate_id: string | null;
  is_revised: boolean;
};

export type ActiveIndex = {
  schema_version: typeof FOUNDER_PREFERENCE_MEMORY_SCHEMA;
  generated_at: string;
  count: number;
  by_identity: Record<string, string>;
  records: FounderPreferenceMemoryRecord[];
};

export const SCOPE_SPECIFICITY: Record<MemoryScope, number> = {
  GLOBAL: 1,
  CATEGORY: 2,
  ROLE_FAMILY: 3,
  ROLE: 4,
  DESIGN_FAMILY: 5,
  ARCHITECTURE: 6,
  SECTION: 7,
  COMPONENT: 8,
};

export const CONFIDENCE_RANK: Record<MemoryConfidence, number> = {
  low: 1,
  medium: 2,
  high: 3,
};
