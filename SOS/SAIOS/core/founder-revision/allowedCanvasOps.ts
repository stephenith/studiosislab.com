/**
 * Founder revision canvas operation allowlists.
 *
 * PLANNER_ALLOWED_OPS / ALLOWED_OPS:
 *   Operations OpenAI may emit in NEW revision plans.
 *   Shared by prompt, validateRevisionPlan, and revision_planning json_schema.
 *
 * LEGACY_EXECUTOR_SUPPORTED_OPS:
 *   Ops the CanvasOperationExecutor can still apply for historical evidence/replays.
 *   Includes deprecated planner ops (e.g. adjust_spacing).
 *
 * Do not invent synonyms (e.g. un-group_objects). Exact names only.
 * Do not auto-convert deprecated ops or pseudo value fields.
 */
import type { CanvasOpType } from "./revision-task-types.js";

/**
 * Ops allowed in NEW OpenAI revision plans.
 * `adjust_spacing` is intentionally excluded — it is a misleading alias of
 * set_position/move_object and caused invented values.spacing.
 */
export const PLANNER_ALLOWED_OPS: readonly CanvasOpType[] = [
  "move_object",
  "resize_object",
  "set_position",
  "set_dimensions",
  "set_fill",
  "set_stroke",
  "update_text",
  "align_objects",
  "group_objects",
  "ungroup_objects",
  "extend_shape",
  "adjust_font_size",
  "adjust_line_height",
  "add_object",
  "remove_object",
] as const;

/**
 * Canonical planner allowlist alias (prompt / validateRevisionPlan / schema).
 * Prefer PLANNER_ALLOWED_OPS in new code for clarity.
 */
export const ALLOWED_OPS: readonly CanvasOpType[] = PLANNER_ALLOWED_OPS;

/** JSON-schema enum array (exact planner allowlist copy). */
export const ALLOWED_OPS_ENUM: readonly string[] = [...PLANNER_ALLOWED_OPS];

/**
 * Ops the executor may still apply for historical plans/evidence.
 * Includes deprecated `adjust_spacing` (geometry alias of set_position/move_object).
 * NEW plans must NOT emit these deprecated ops — validateRevisionPlan rejects them.
 */
export const LEGACY_EXECUTOR_SUPPORTED_OPS: readonly CanvasOpType[] = [
  ...PLANNER_ALLOWED_OPS,
  "adjust_spacing",
] as const;

/** Deprecated for NEW planner output; kept for historical executor compatibility. */
export const DEPRECATED_PLANNER_OPS: readonly CanvasOpType[] = [
  "adjust_spacing",
] as const;

export function isAllowedCanvasOp(op: unknown): op is CanvasOpType {
  return (
    typeof op === "string" &&
    (PLANNER_ALLOWED_OPS as readonly string[]).includes(op)
  );
}

export function isLegacyExecutorSupportedOp(op: unknown): op is CanvasOpType {
  return (
    typeof op === "string" &&
    (LEGACY_EXECUTOR_SUPPORTED_OPS as readonly string[]).includes(op)
  );
}

export function isDeprecatedPlannerOp(op: unknown): boolean {
  return (
    typeof op === "string" &&
    (DEPRECATED_PLANNER_OPS as readonly string[]).includes(op)
  );
}
