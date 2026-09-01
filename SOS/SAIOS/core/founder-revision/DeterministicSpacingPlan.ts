/**
 * Deterministic spacing / vertical-rhythm plan ownership.
 * When Founder feedback is spacing-heavy, prefer RevisionLayoutNormalizer
 * geometry over long AI absolute set_position chains.
 */
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import {
  isHeaderIdentityLayoutFeedback,
  isHeaderIdentityLayoutOwnedChange,
} from "./HeaderIdentityLayout.js";
import {
  isFounderHeadingToContentEqualityRequest,
  isFounderInternalContentRhythmRequest,
  isFounderSectionToSectionGapEqualityRequest,
  normalizeRevisionLayout,
} from "./RevisionLayoutNormalizer.js";
import { parseExplicitMoveDirections } from "./PositionOpCanonicalization.js";
import {
  classifyRequestedChange,
  isVerificationAcceptance,
} from "./RequestedChangeClassification.js";
import type { CanvasOperation, RevisionPlan } from "./revision-task-types.js";
import { snapCoord } from "./EquivalentHorizontalOwnership.js";

function normalizeText(s: string): string {
  return s
    .replace(/^\*+\s*/, "")
    .replace(/^\d+\.\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Final validate/verify-only lines — acceptance checks, not geometry ownership
 * requirements. Must not be attributed onto deterministic spacing ops.
 */
export function isValidationOnlyRequestedChange(
  requestedChange: string,
): boolean {
  const n = normalizeText(requestedChange);
  if (!n) return false;
  if (isVerificationAcceptance(requestedChange)) return false;
  if (
    /^(validate|verify)\b/.test(n) &&
    /\b(layout|overlap|collision|clipping|spacing|section)\b/.test(n)
  ) {
    return true;
  }
  if (
    /\bvalidate the final layout\b/.test(n) ||
    /\bverify (?:the )?final (?:layout|output|canvas)\b/.test(n)
  ) {
    return true;
  }
  return false;
}

/**
 * Lines eligible to appear on deterministic spacing ops as founder attribution.
 * Never includes VERIFICATION_ACCEPTANCE or validate-only acceptance checks.
 */
export function deterministicSpacingAttributionLines(
  requestedChanges: string[],
): string[] {
  return requestedChanges.filter((c) => {
    if (isVerificationAcceptance(c)) return false;
    if (isValidationOnlyRequestedChange(c)) return false;
    return (
      classifyRequestedChange(c).classification === "MUTATION_REQUIRED"
    );
  });
}

function objectId(o: Record<string, unknown>, index: number): string {
  if (typeof o.id === "string" && o.id.trim()) return o.id;
  const data = o.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const id = (data as { id?: unknown }).id;
    if (typeof id === "string" && id.trim()) return id;
  }
  return `obj-${index}`;
}

function asNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * True when this Founder line should be owned by deterministic layout
 * normalization (zero AI coordinate ops required for coverage).
 */
export function isDeterministicLayoutNormalizerOwnedChange(
  requestedChange: string,
): boolean {
  // Preserve / verification-only / validate-only lines are acceptance constraints,
  // not geometry ownership requirements (Phase 5I).
  if (isVerificationAcceptance(requestedChange)) return false;
  if (isValidationOnlyRequestedChange(requestedChange)) return false;

  if (isHeaderIdentityLayoutOwnedChange(requestedChange)) return true;
  if (isFounderHeadingToContentEqualityRequest(requestedChange)) return true;
  if (isFounderSectionToSectionGapEqualityRequest(requestedChange)) return true;
  if (isFounderInternalContentRhythmRequest(requestedChange)) return true;

  const n = normalizeText(requestedChange);
  if (!n) return false;

  // Content / role rewrite stays AI or acceptance — not normalizer-owned.
  if (
    /\b(mismatch|restore the correct|do not invent|fabricat|rewrite (?:the )?content|wrong role)\b/.test(
      n,
    )
  ) {
    return false;
  }

  // Sidebar / column reflow packets.
  if (
    /\breflow\b/.test(n) &&
    /\b(sidebar|column|section)\b/.test(n)
  ) {
    return true;
  }
  if (
    /\brebalance\b/.test(n) &&
    /\b(vertical\s+space|vertical\s+spacing|spacing|column|sidebar)\b/.test(n)
  ) {
    return true;
  }
  if (
    /\b(reformat|sequential)\b/.test(n) &&
    /\b(skills?|projects?|section)\b/.test(n) &&
    /\b(spacing|gap|structure|separator|bullet|overlap|collision)\b/.test(n)
  ) {
    return true;
  }
  if (
    /\bdo not allow\b/.test(n) &&
    /\boverlap\b/.test(n) &&
    /\b(section|heading|content|object|textbox|entry)\b/.test(n)
  ) {
    return true;
  }
  if (
    /\bcontained within\b/.test(n) &&
    /\bsection\b/.test(n) &&
    /\b(heading|entry|content|certification|project)\b/.test(n)
  ) {
    return true;
  }

  // Section-unit visual grouping still needs attributed ops for coverage
  // (normalizer may help geometry later, but plan completeness is not exempt).
  if (
    /\b(visually grouped|grouped as one unit)\b/.test(n) &&
    /\b(heading|marker|content)\b/.test(n)
  ) {
    return false;
  }

  if (
    /\b(vertical\s+)?(rhythm|spacing|baseline)\b/.test(n) &&
    /\b(section|heading|column|sidebar|page|gap|margin|content)\b/.test(n)
  ) {
    // Require system/equality language. Do not own "visually grouped … internal
    // spacing" unit-cohesion lines (those still need attributed mutation ops).
    if (
      /\b(normalize|standardize|equal(?:ize|ity)?|between|consecutive|system|rhythm|heading-to-content|section-to-section)\b/.test(
        n,
      ) ||
      (/\bconsistent\b/.test(n) &&
        /\b(section[- ]to[- ]section|heading[- ]to[- ]content|vertical spacing)\b/.test(
          n,
        ))
    ) {
      return true;
    }
  }
  if (
    /\bheading\b/.test(n) &&
    /\b(content|body|first\s+line)\b/.test(n) &&
    /\b(spacing|gap|distance|align)\b/.test(n)
  ) {
    return true;
  }
  if (
    /\bsections?\b/.test(n) &&
    /\b(spacing|gap|rhythm|consecutive|stack)\b/.test(n)
  ) {
    return true;
  }
  if (/\bbottom\s+margin\b/.test(n) || /\bpage ends with balanced\b/.test(n)) {
    return true;
  }
  // Require page/section/heading context — do not own entry-level "Tighten X
  // entry spacing" lines that still need explicit AI ops for coverage repair.
  if (
    /\b(compact|reduce|tighten|normalize|standardize|align)\b/.test(n) &&
    /\b(gap|spacing|whitespace|baseline)\b/.test(n) &&
    /\b(section|heading|column|sidebar|page|consecutive|between|rhythm)\b/.test(
      n,
    )
  ) {
    return true;
  }
  if (
    /\b(mov(?:e|ing)|shift|reposition|adjust)\b/.test(n) &&
    /\b(section|heading|summary|education|skills|certifications|languages|contact)\b/.test(
      n,
    ) &&
    /\b(up|down|upward|downward|crowd|overlap|margin|spacing|gap|baseline|associated|attached|bullets?)\b/.test(
      n,
    )
  ) {
    return true;
  }
  // Heading association / detach-from-previous-section (Certifications-style).
  if (
    /\breposition\b/.test(n) &&
    /\bheading\b/.test(n) &&
    /\b(associated|attached|content|bullets?|skills?)\b/.test(n)
  ) {
    return true;
  }
  // Preserve visual style while spacing/overlap corrections are owned elsewhere.
  if (
    /\bpreserv(?:e|ing)\b/.test(n) &&
    /\b(design|typography|color)\b/.test(n) &&
    /\b(spacing|overlap)\b/.test(n) &&
    /\bonly\b/.test(n)
  ) {
    return true;
  }
  return false;
}

/** Heavy vertical spacing / rhythm Founder packet → prefer normalizer geometry. */
export function isVerticalSpacingRhythmHeavyFeedback(
  requestedChanges: string[],
): boolean {
  if (isHeaderIdentityLayoutFeedback(requestedChanges)) return true;
  const owned = requestedChanges.filter((c) =>
    isDeterministicLayoutNormalizerOwnedChange(c),
  );
  if (owned.length >= 3) return true;
  if (
    requestedChanges.length > 0 &&
    owned.length / requestedChanges.length >= 0.5 &&
    owned.length >= 2
  ) {
    return true;
  }
  return false;
}

function isPreservedAiOp(op: CanvasOperation): boolean {
  switch (op.op) {
    case "update_text":
    case "set_fill":
    case "set_stroke":
    case "adjust_font_size":
    case "adjust_line_height":
    case "add_object":
    case "remove_object":
    case "group_objects":
    case "ungroup_objects":
    case "resize_object":
    case "set_dimensions":
    case "extend_shape":
      return true;
    default:
      return false;
  }
}

export type DeterministicSpacingPlanResult = {
  ok: boolean;
  plan: RevisionPlan | null;
  error: string | null;
  report_ok: boolean;
  shifted_object_count: number;
  preserved_ai_ops: number;
  replaced_ai_position_ops: number;
};

/**
 * Replace AI set_position/move_object/align_objects with geometry diffed from
 * normalizeRevisionLayout on the prior canvas. Preserves non-position AI ops.
 */
export function buildPlanWithDeterministicSpacingOwnership(input: {
  priorCanvas: FabricCanvasDoc;
  requested_changes: string[];
  aiPlan: RevisionPlan;
}): DeterministicSpacingPlanResult {
  const normalized = normalizeRevisionLayout({
    canvas: input.priorCanvas,
    requested_changes: input.requested_changes,
    prior_canvas: input.priorCanvas,
  });

  if (!normalized.report.ok) {
    return {
      ok: false,
      plan: null,
      error:
        normalized.report.error ??
        "deterministic layout normalization failed for spacing ownership",
      report_ok: false,
      shifted_object_count: 0,
      preserved_ai_ops: 0,
      replaced_ai_position_ops: 0,
    };
  }

  const beforeObjs = (input.priorCanvas.objects ?? []) as Array<
    Record<string, unknown>
  >;
  const afterObjs = (normalized.canvas.objects ?? []) as Array<
    Record<string, unknown>
  >;
  const beforeById = new Map<string, Record<string, unknown>>();
  for (let i = 0; i < beforeObjs.length; i++) {
    const o = beforeObjs[i]!;
    beforeById.set(objectId(o, i), o);
  }

  // Attribute only MUTATION_REQUIRED substantive lines — never VA / validate-only.
  const attributionLines = deterministicSpacingAttributionLines(
    input.requested_changes,
  );
  const ownedAttribution = attributionLines.filter((c) =>
    isDeterministicLayoutNormalizerOwnedChange(c),
  );
  // Prefer a non-directional owned line so every spacing op is not constrained
  // by an unrelated section's "move X down/up" attribution.
  const nonDirectionalOwned = ownedAttribution.find(
    (c) => parseExplicitMoveDirections(c).size === 0,
  );
  const primaryFb =
    nonDirectionalOwned ??
    ownedAttribution[0] ??
    attributionLines[0] ??
    "Normalize vertical spacing with deterministic layout ownership.";
  const extraFb = attributionLines.filter((c) => c !== primaryFb);

  const spacingOps: CanvasOperation[] = [];
  for (let i = 0; i < afterObjs.length; i++) {
    const after = afterObjs[i]!;
    const id = objectId(after, i);
    const before = beforeById.get(id);
    if (!before) continue;
    const topBefore = asNum(before.top);
    const leftBefore = asNum(before.left);
    const topAfter = asNum(after.top);
    const leftAfter = asNum(after.left);
    const heightBefore = asNum(before.height);
    const widthBefore = asNum(before.width);
    const heightAfter = asNum(after.height);
    const widthAfter = asNum(after.width);

    const posValues: Record<string, unknown> = {};
    if (
      topAfter != null &&
      (topBefore == null || snapCoord(topAfter) !== snapCoord(topBefore))
    ) {
      posValues.top = snapCoord(topAfter);
    }
    if (
      leftAfter != null &&
      (leftBefore == null || snapCoord(leftAfter) !== snapCoord(leftBefore))
    ) {
      posValues.left = snapCoord(leftAfter);
    }
    if (Object.keys(posValues).length > 0) {
      spacingOps.push({
        op: "set_position",
        target_id: id,
        before_summary: `Inventory object ${id} at left=${leftBefore ?? "n/a"} top=${topBefore ?? "n/a"} before deterministic spacing ownership`,
        intended_change: `Apply deterministic layout-normalized position for ${id}`,
        values: posValues,
        founder_feedback_item: primaryFb,
        founder_feedback_items: extraFb.length > 0 ? extraFb : undefined,
        confidence: 1,
      });
    }

    const dimValues: Record<string, unknown> = {};
    if (
      heightAfter != null &&
      (heightBefore == null || snapCoord(heightAfter) !== snapCoord(heightBefore))
    ) {
      dimValues.height = snapCoord(heightAfter);
    }
    if (
      widthAfter != null &&
      (widthBefore == null || snapCoord(widthAfter) !== snapCoord(widthBefore))
    ) {
      dimValues.width = snapCoord(widthAfter);
    }
    if (Object.keys(dimValues).length > 0) {
      spacingOps.push({
        op: "set_dimensions",
        target_id: id,
        before_summary: `Inventory object ${id} size width=${widthBefore ?? "n/a"} height=${heightBefore ?? "n/a"} before deterministic spacing ownership`,
        intended_change: `Apply deterministic layout-normalized dimensions for ${id}`,
        values: dimValues,
        founder_feedback_item: primaryFb,
        founder_feedback_items: extraFb.length > 0 ? extraFb : undefined,
        confidence: 1,
      });
    }
  }

  const spacingTargetIds = new Set(
    spacingOps
      .map((o) => ("target_id" in o ? String(o.target_id ?? "") : ""))
      .filter(Boolean),
  );
  const preserved = input.aiPlan.operations.filter((op) => {
    if (!isPreservedAiOp(op)) return false;
    // Deterministic geometry owns position+size for objects it moved/resized.
    if (
      (op.op === "set_dimensions" ||
        op.op === "resize_object" ||
        op.op === "extend_shape") &&
      "target_id" in op &&
      spacingTargetIds.has(String(op.target_id ?? ""))
    ) {
      return false;
    }
    return true;
  });
  const replaced_ai_position_ops = input.aiPlan.operations.filter(
    (o) => !preserved.includes(o),
  ).length;

  const operations = [...preserved, ...spacingOps];
  if (operations.length === 0) {
    // All spacing owned by normalizer with no geometry change and no AI content ops.
    return {
      ok: true,
      plan: {
        schema_version: "founder-canvas-revision-plan-1.0.0",
        summary:
          "Deterministic spacing ownership: prior geometry already satisfied layout normalizer (no position mutations).",
        operations: [],
        notes: [
          "normalizer_owned_spacing",
          "zero_position_ops_preferred_over_identity",
        ],
      },
      error: null,
      report_ok: true,
      shifted_object_count: 0,
      preserved_ai_ops: preserved.length,
      replaced_ai_position_ops,
    };
  }

  return {
    ok: true,
    plan: {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary:
        input.aiPlan.summary ||
        "Deterministic spacing ownership via RevisionLayoutNormalizer",
      operations,
      notes: [
        ...(input.aiPlan.notes ?? []),
        "deterministic_spacing_ownership",
        `shifted_objects=${spacingOps.length}`,
      ],
    },
    error: null,
    report_ok: true,
    shifted_object_count: spacingOps.length,
    preserved_ai_ops: preserved.length,
    replaced_ai_position_ops,
  };
}
