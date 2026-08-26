/**
 * Founder-feedback-driven revision task contracts.
 * LIVE OFF · publication_allowed=false · never auto-approve.
 */

export const FOUNDER_FEEDBACK_REVISION_VERSION = "1.0.0";
export const REVISION_TAG_FB = "revfb";

export type RevisionTaskStatus =
  | "PENDING"
  | "PLANNING"
  | "EXECUTING"
  | "VALIDATING"
  | "READY_FOR_FOUNDER_REVIEW"
  | "FAILED_PROVIDER"
  | "FAILED_COVERAGE"
  | "FAILED_EXECUTION"
  | "FAILED_CRITIC"
  | "FAILED_GATE"
  | "FAILED_ARTIFACTS"
  | "FAILED";

export type CanvasOpType =
  | "move_object"
  | "resize_object"
  | "set_position"
  | "set_dimensions"
  | "set_fill"
  | "set_stroke"
  | "update_text"
  | "align_objects"
  | "group_objects"
  | "ungroup_objects"
  | "extend_shape"
  | "adjust_spacing"
  | "adjust_font_size"
  | "adjust_line_height"
  | "add_object"
  | "remove_object";

export type CanvasOperation = {
  op: CanvasOpType;
  target_id?: string;
  selector?: {
    text_includes?: string;
    type?: string;
    role?: string;
    section?: string;
    fill?: string;
  };
  target_ids?: string[];
  before_summary?: string;
  intended_change: string;
  values?: Record<string, unknown>;
  /** Primary Founder attribution (required). Exact requested-change text. */
  founder_feedback_item: string;
  /**
   * Optional additional exact Founder attributions for the SAME physical mutation.
   * Attribution metadata only — does not cause duplicate execution.
   */
  founder_feedback_items?: string[];
  confidence: number;
};

export type RevisionPlan = {
  schema_version: "founder-canvas-revision-plan-1.0.0";
  summary: string;
  operations: CanvasOperation[];
  notes?: string[];
};

export type FeedbackCoverageStatus =
  | "addressed"
  | "partially_addressed"
  | "not_addressed";

export type FeedbackOperationEvidence = {
  target_id: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
};

export type FeedbackRelationEvidence = {
  type: "CONTACT_TO_SUMMARY_GAP" | "CONTACT_IN_HEADER_BAND" | string;
  contact_id?: string | null;
  summary_id?: string | null;
  gap_px?: number | null;
  minimum_gap_px?: number | null;
  name_contact_gap_px?: number | null;
  pass?: boolean;
  notes?: string;
};

export type FeedbackCoverageItem = {
  founder_feedback_item: string;
  status: FeedbackCoverageStatus;
  evidence: {
    affected_object_ids: string[];
    /** Only set when before/after belong to the same object ID. */
    before?: Record<string, unknown>;
    /** Only set when before/after belong to the same object ID. */
    after?: Record<string, unknown>;
    /** Per-operation identity-preserving snapshots for multi-op items. */
    operation_evidence?: FeedbackOperationEvidence[];
    /** Deterministic relation proof (e.g. contact→Summary gap). */
    relation?: FeedbackRelationEvidence;
    notes?: string;
  };
};

export type FeedbackCoverageReport = {
  schema_version: "founder-feedback-coverage-1.0.0";
  all_addressed: boolean;
  items: FeedbackCoverageItem[];
  gate_pass: boolean;
};

export type RevisionTask = {
  schema_version: "founder-revision-task-1.0.0";
  task_id: string;
  decision_id: string;
  review_id: string;
  prior_candidate_id: string;
  prior_canvas_path: string;
  founder_reason: string;
  requested_changes: string[];
  role: string;
  design_family: string | null;
  status: RevisionTaskStatus;
  created_at: string;
  updated_at: string;
  revised_candidate_id: string | null;
  revised_review_id: string | null;
  revision_number: number;
  error: string | null;
  openai_execution_path: string | null;
  publication_allowed: false;
  live: false;
};

export type OperationLogEntry = {
  index: number;
  op: CanvasOpType;
  target_id: string | null;
  founder_feedback_item: string;
  ok: boolean;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  error: string | null;
};

export type CanvasInventoryObject = {
  id: string;
  index: number;
  type: string;
  text: string | null;
  left: number | null;
  top: number | null;
  width: number | null;
  /** Serialized Fabric frame height (may under-represent wrapped text). */
  height: number | null;
  /**
   * Same as `height` — explicit alias for planner wrap-aware geometry contract.
   * Populated by buildCanvasInventory; optional on hand-built fixtures.
   */
  stored_height?: number | null;
  /**
   * Wrap-aware safety height (max of stored×scaleY and estimated wrap height).
   * Null for non-text objects. Populated by buildCanvasInventory.
   */
  effective_height?: number | null;
  /**
   * top + effective_height (canvas space). Null when top or effective_height
   * cannot be evaluated.
   */
  effective_bottom?: number | null;
  /** Full source text length (inventory `text` may still be truncated). */
  text_len?: number | null;
  fill: string | null;
  stroke: string | null;
  fontSize: number | null;
  fontFamily: string | null;
  fontWeight: string | number | null;
  lineHeight: number | null;
  role: string | null;
  section: string | null;
  locked: boolean;
  system: boolean;
  group_id: string | null;
};
