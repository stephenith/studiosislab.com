/**
 * Deterministic spacing / vertical-rhythm plan ownership.
 * When Founder feedback is spacing-heavy, prefer RevisionLayoutNormalizer
 * geometry over long AI absolute set_position chains.
 */
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import { executeCanvasOperations } from "./CanvasOperationExecutor.js";
import {
  buildOversizedTextboxShrinkOps,
  evaluateFounderSpacingIntents,
  findVisualContentTextOverlaps,
  isFounderMeasurableSpacingIntent,
  spacingIntentSatisfied,
  type SpacingIntentRelation,
} from "./FounderSpacingIntent.js";
import {
  buildSafeNamedSpacingRelationOps,
  measureResolvedPairGap,
  resolveAllFounderSpacingRelations,
  type ResolvedSpacingRelation,
} from "./FounderSpacingRelation.js";
import {
  isHeaderIdentityLayoutFeedback,
  isHeaderIdentityLayoutOwnedChange,
} from "./HeaderIdentityLayout.js";
import { findTextOverlapFindings } from "./RevisionAcceptanceChecks.js";
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
import {
  isFabricTextObject,
  visualTextContentBottom,
} from "./TextEffectiveHeight.js";

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
  // Phase 5Z: any measurable Founder spacing intent must enter ownership so
  // weak deterministic cascades cannot silently replace satisfying AI ops.
  if (requestedChanges.some((c) => isFounderMeasurableSpacingIntent(c))) {
    return true;
  }
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
  /** Phase 5Z: neither AI nor deterministic plan satisfies measured spacing intents. */
  fail_closed?: boolean;
  ownership_mode?:
    | "DETERMINISTIC"
    | "AI_SPACING_PRESERVED"
    | "HYBRID"
    | "FAIL_CLOSED"
    | "UNCHANGED";
  spacing_intents_det?: SpacingIntentRelation[];
  spacing_intents_ai?: SpacingIntentRelation[];
  /** Canonical Founder spacing relations resolved once for this ownership pass. */
  resolved_relations?: ResolvedSpacingRelation[];
  named_pair_only?: boolean;
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
  const preservedNonPosition = input.aiPlan.operations.filter((op) => {
    if (!isPreservedAiOp(op)) return false;
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

  const hasMeasurableSpacing = input.requested_changes.some((c) =>
    isFounderMeasurableSpacingIntent(c),
  );

  // Resolve Founder spacing relations ONCE for this canvas — shared by named
  // repair ops and intent evaluation (no independent re-parse of raw text).
  const resolvedRelations = hasMeasurableSpacing
    ? resolveAllFounderSpacingRelations({
        requested_changes: input.requested_changes,
        canvas: input.priorCanvas,
      })
    : [];
  const namedPairOnly =
    resolvedRelations.length > 0 &&
    resolvedRelations.every((r) => r.kind === "NAMED_PAIR");

  const namedRelationOps = buildSafeNamedSpacingRelationOps({
    canvas: input.priorCanvas,
    requested_changes: input.requested_changes,
    resolved_relations: resolvedRelations,
  });
  const namedTargetIds = new Set(
    namedRelationOps
      .map((o) => ("target_id" in o ? String(o.target_id ?? "") : ""))
      .filter(Boolean),
  );
  // Named-pair-only packets: prefer the smallest safe mutation (named ops),
  // not a whole-section normalizer rewrite.
  const spacingOpsWithNamed = namedPairOnly
    ? [...namedRelationOps]
    : [
        ...spacingOps.filter((o) => {
          const id = "target_id" in o ? String(o.target_id ?? "") : "";
          return !id || !namedTargetIds.has(id);
        }),
        ...namedRelationOps,
      ];

  const detPlanBase: RevisionPlan = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary:
      input.aiPlan.summary ||
      (namedPairOnly
        ? "Deterministic named-pair spacing ownership"
        : "Deterministic spacing ownership via RevisionLayoutNormalizer"),
    operations: [...preservedNonPosition, ...spacingOpsWithNamed],
    notes: [
      ...(input.aiPlan.notes ?? []),
      "deterministic_spacing_ownership",
      namedPairOnly ? "named_pair_only" : "normalizer_or_named",
      `shifted_objects=${spacingOpsWithNamed.length}`,
      `named_relation_ops=${namedRelationOps.length}`,
    ],
  };

  if (!hasMeasurableSpacing) {
    if (detPlanBase.operations.length === 0) {
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
        preserved_ai_ops: preservedNonPosition.length,
        replaced_ai_position_ops: input.aiPlan.operations.filter(
          (o) => !preservedNonPosition.includes(o),
        ).length,
        ownership_mode: "UNCHANGED",
      };
    }
    return {
      ok: true,
      plan: detPlanBase,
      error: null,
      report_ok: true,
      shifted_object_count: spacingOpsWithNamed.length,
      preserved_ai_ops: preservedNonPosition.length,
      replaced_ai_position_ops: input.aiPlan.operations.filter(
        (o) => !preservedNonPosition.includes(o),
      ).length,
      ownership_mode: "DETERMINISTIC",
    };
  }

  // Phase 5Z — choose plan that satisfies measured Founder spacing intents.
  const aiPositionOps = input.aiPlan.operations.filter(
    (o) =>
      o.op === "set_position" ||
      o.op === "move_object" ||
      o.op === "align_objects",
  );

  // No competing AI position ops → deterministic ownership as before; coverage
  // still requires measured spacing proof when applicable.
  if (aiPositionOps.length === 0) {
    if (detPlanBase.operations.length === 0) {
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
        preserved_ai_ops: preservedNonPosition.length,
        replaced_ai_position_ops: 0,
        ownership_mode: "UNCHANGED",
        resolved_relations: resolvedRelations,
        named_pair_only: namedPairOnly,
      };
    }
    // Named-pair measurable with no AI ops: only accept if named det satisfies.
    if (namedPairOnly && namedRelationOps.length === 0) {
      return {
        ok: false,
        plan: null,
        error:
          "spacing intent unsatisfied: deterministic ownership and AI plan both fail measured Founder spacing relations (or produce unsafe overlaps)",
        report_ok: normalized.report.ok,
        shifted_object_count: 0,
        preserved_ai_ops: 0,
        replaced_ai_position_ops: 0,
        fail_closed: true,
        ownership_mode: "FAIL_CLOSED",
        resolved_relations: resolvedRelations,
        named_pair_only: namedPairOnly,
      };
    }
    return {
      ok: true,
      plan: detPlanBase,
      error: null,
      report_ok: true,
      shifted_object_count: spacingOpsWithNamed.length,
      preserved_ai_ops: preservedNonPosition.length,
      replaced_ai_position_ops: 0,
      ownership_mode: "DETERMINISTIC",
      resolved_relations: resolvedRelations,
      named_pair_only: namedPairOnly,
    };
  }

  const shrinkOps = buildOversizedTextboxShrinkOps({
    canvas: input.priorCanvas,
    founder_feedback_item: primaryFb,
    founder_feedback_items: extraFb.length > 0 ? extraFb : undefined,
  });
  const namedShrinkOps = namedPairOnly
    ? shrinkOps.filter((o) => {
        const id = "target_id" in o ? String(o.target_id ?? "") : "";
        return (
          !id ||
          namedTargetIds.has(id) ||
          resolvedRelations.some(
            (r) => r.upper_id === id || r.lower_id === id,
          )
        );
      })
    : shrinkOps;
  const aiAugmentedOps = [
    ...preservedNonPosition,
    ...namedShrinkOps,
    ...aiPositionOps,
  ];
  const detExec = executeCanvasOperations({
    canvas: input.priorCanvas,
    operations: detPlanBase.operations,
  });
  const aiOnlyPlan: RevisionPlan = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: input.aiPlan.summary,
    operations: aiAugmentedOps,
    notes: [
      ...(input.aiPlan.notes ?? []),
      "ai_spacing_ops_preserved_5z",
      `oversized_shrink_ops=${namedShrinkOps.length}`,
    ],
  };
  const aiExec = executeCanvasOperations({
    canvas: input.priorCanvas,
    operations: aiOnlyPlan.operations,
  });

  const detIntents = evaluateFounderSpacingIntents({
    requested_changes: input.requested_changes,
    beforeCanvas: input.priorCanvas,
    afterCanvas: detExec.ok ? detExec.canvas : input.priorCanvas,
    resolved_relations: resolvedRelations,
  });
  const aiIntents = evaluateFounderSpacingIntents({
    requested_changes: input.requested_changes,
    beforeCanvas: input.priorCanvas,
    afterCanvas: aiExec.ok ? aiExec.canvas : input.priorCanvas,
    resolved_relations: resolvedRelations,
  });

  const detOverlapPolicy = detExec.ok
    ? findTextOverlapFindings(detExec.canvas).length
    : 99;
  const detOverlapVisual = detExec.ok
    ? findVisualContentTextOverlaps(detExec.canvas).length
    : 99;
  const aiOverlapPolicy = aiExec.ok
    ? findTextOverlapFindings(aiExec.canvas).length
    : 99;
  const aiOverlapVisual = aiExec.ok
    ? findVisualContentTextOverlaps(aiExec.canvas).length
    : 99;
  const pageH = Number(input.priorCanvas.height ?? 1123);
  const pageW = Number(input.priorCanvas.width ?? 794);
  const aiPageOob = aiExec.ok
    ? countPageOob(aiExec.canvas, pageW, pageH)
    : 99;
  const detPageOob = detExec.ok
    ? countPageOob(detExec.canvas, pageW, pageH)
    : 99;

  const detSafe =
    detExec.ok &&
    detOverlapPolicy === 0 &&
    detOverlapVisual === 0 &&
    detPageOob === 0 &&
    detIntents.all_satisfied;
  const aiSafe =
    aiExec.ok &&
    aiOverlapPolicy === 0 &&
    aiOverlapVisual === 0 &&
    aiPageOob === 0 &&
    aiIntents.all_satisfied;

  // Named-pair-only: prefer the smallest safe AI mutation when it satisfies
  // the canonical relation (do not let whole-section det rewrite win first).
  if (namedPairOnly && aiSafe) {
    return {
      ok: true,
      plan: aiOnlyPlan,
      error: null,
      report_ok: true,
      shifted_object_count: aiOnlyPlan.operations.length,
      preserved_ai_ops: preservedNonPosition.length + aiPositionOps.length,
      replaced_ai_position_ops: 0,
      ownership_mode: "AI_SPACING_PRESERVED",
      spacing_intents_det: detIntents.intents,
      spacing_intents_ai: aiIntents.intents,
      resolved_relations: resolvedRelations,
      named_pair_only: true,
    };
  }

  if (detSafe) {
    return {
      ok: true,
      plan: detPlanBase,
      error: null,
      report_ok: true,
      shifted_object_count: spacingOpsWithNamed.length,
      preserved_ai_ops: preservedNonPosition.length,
      replaced_ai_position_ops: aiPositionOps.length,
      ownership_mode: "DETERMINISTIC",
      spacing_intents_det: detIntents.intents,
      spacing_intents_ai: aiIntents.intents,
      resolved_relations: resolvedRelations,
      named_pair_only: namedPairOnly,
    };
  }

  if (aiSafe) {
    // Prefer AI spacing ops when deterministic replacement does not satisfy intent.
    // Hybrid: AI position targets win; keep det ops for other objects; keep shrinks.
    const aiPosTargets = new Set(
      aiPositionOps
        .map((o) => ("target_id" in o ? String(o.target_id ?? "") : ""))
        .filter(Boolean),
    );
    const shrinkIds = new Set(
      namedShrinkOps
        .map((o) => ("target_id" in o ? String(o.target_id ?? "") : ""))
        .filter(Boolean),
    );
    const detKept = namedPairOnly
      ? []
      : spacingOpsWithNamed.filter((o) => {
          const id = "target_id" in o ? String(o.target_id ?? "") : "";
          return !id || (!aiPosTargets.has(id) && !shrinkIds.has(id));
        });
    const hybridOps = [
      ...preservedNonPosition,
      ...namedShrinkOps,
      ...aiPositionOps,
      ...detKept,
    ];
    const hybridPlan: RevisionPlan = {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary:
        input.aiPlan.summary ||
        "Hybrid spacing ownership: AI compaction preserved where deterministic failed intent",
      operations: hybridOps,
      notes: [
        ...(input.aiPlan.notes ?? []),
        "deterministic_spacing_ownership",
        "ai_spacing_intent_preserved_5z",
        `ai_position_ops=${aiPositionOps.length}`,
        `det_ops_kept=${detKept.length}`,
        `oversized_shrink_ops=${namedShrinkOps.length}`,
      ],
    };
    const hybridExec = executeCanvasOperations({
      canvas: input.priorCanvas,
      operations: hybridOps,
    });
    const hybridIntents = evaluateFounderSpacingIntents({
      requested_changes: input.requested_changes,
      beforeCanvas: input.priorCanvas,
      afterCanvas: hybridExec.ok ? hybridExec.canvas : input.priorCanvas,
      resolved_relations: resolvedRelations,
    });
    const hybridSafe =
      hybridExec.ok &&
      findTextOverlapFindings(hybridExec.canvas).length === 0 &&
      findVisualContentTextOverlaps(hybridExec.canvas).length === 0 &&
      countPageOob(hybridExec.canvas, pageW, pageH) === 0 &&
      hybridIntents.all_satisfied;
    if (hybridSafe || aiSafe) {
      const usePlan = hybridSafe ? hybridPlan : aiOnlyPlan;
      const useMode = hybridSafe ? "HYBRID" : "AI_SPACING_PRESERVED";
      return {
        ok: true,
        plan: usePlan,
        error: null,
        report_ok: true,
        shifted_object_count: usePlan.operations.length,
        preserved_ai_ops: preservedNonPosition.length + aiPositionOps.length,
        replaced_ai_position_ops: 0,
        ownership_mode: useMode,
        spacing_intents_det: detIntents.intents,
        spacing_intents_ai: aiIntents.intents,
        resolved_relations: resolvedRelations,
        named_pair_only: namedPairOnly,
      };
    }
  }

  // Reflow-heavy packets with no satisfying AI compaction: keep overlap-safe
  // deterministic ownership and let FeedbackCoverage prove spacing relations.
  // Never use this escape hatch for named-pair-only (would ship false relation).
  const ownedCount = input.requested_changes.filter((c) =>
    isDeterministicLayoutNormalizerOwnedChange(c),
  ).length;
  const detGeomSafe =
    detExec.ok &&
    detOverlapPolicy === 0 &&
    detOverlapVisual === 0 &&
    detPageOob === 0;
  if (!namedPairOnly && detGeomSafe && ownedCount >= 3) {
    return {
      ok: true,
      plan: detPlanBase,
      error: null,
      report_ok: true,
      shifted_object_count: spacingOpsWithNamed.length,
      preserved_ai_ops: preservedNonPosition.length,
      replaced_ai_position_ops: aiPositionOps.length,
      ownership_mode: "DETERMINISTIC",
      spacing_intents_det: detIntents.intents,
      spacing_intents_ai: aiIntents.intents,
      resolved_relations: resolvedRelations,
      named_pair_only: namedPairOnly,
    };
  }

  // Semantic uncertainty alone must not fail a geometrically safe AI move that
  // improves the Founder-named pair when measured from final sandbox geometry.
  if (
    aiExec.ok &&
    aiOverlapPolicy === 0 &&
    aiOverlapVisual === 0 &&
    aiPageOob === 0 &&
    aiSandboxImprovesCanonicalOrInferredPair({
      priorCanvas: input.priorCanvas,
      afterCanvas: aiExec.canvas,
      resolvedRelations,
      aiPositionOps,
    })
  ) {
    return {
      ok: true,
      plan: aiOnlyPlan,
      error: null,
      report_ok: true,
      shifted_object_count: aiOnlyPlan.operations.length,
      preserved_ai_ops: preservedNonPosition.length + aiPositionOps.length,
      replaced_ai_position_ops: 0,
      ownership_mode: "AI_SPACING_PRESERVED",
      spacing_intents_det: detIntents.intents,
      spacing_intents_ai: aiIntents.intents,
      resolved_relations: resolvedRelations,
      named_pair_only: namedPairOnly,
    };
  }

  // Neither safe+satisfactory → fail closed (do not ship false Founder Review).
  return {
    ok: false,
    plan: null,
    error:
      "spacing intent unsatisfied: deterministic ownership and AI plan both fail measured Founder spacing relations (or produce unsafe overlaps)",
    report_ok: normalized.report.ok,
    shifted_object_count: 0,
    preserved_ai_ops: 0,
    replaced_ai_position_ops: aiPositionOps.length,
    fail_closed: true,
    ownership_mode: "FAIL_CLOSED",
    spacing_intents_det: detIntents.intents,
    spacing_intents_ai: aiIntents.intents,
    resolved_relations: resolvedRelations,
    named_pair_only: namedPairOnly,
  };
}

function countPageOob(
  canvas: FabricCanvasDoc,
  pageW: number,
  pageH: number,
): number {
  let n = 0;
  const objs = (canvas.objects ?? []) as Array<Record<string, unknown>>;
  for (let i = 0; i < objs.length; i++) {
    const o = objs[i]!;
    const left = asNum(o.left) ?? 0;
    const top = asNum(o.top) ?? 0;
    const w = (asNum(o.width) ?? 0) * (asNum(o.scaleX) ?? 1);
    const h = (asNum(o.height) ?? 0) * (asNum(o.scaleY) ?? 1);
    if (left < -1 || top < -1 || left + w > pageW + 1 || top + h > pageH + 1) {
      n += 1;
    }
  }
  return n;
}

/**
 * Final-geometry acceptance for spacing: if AI moved a valid endpoint and the
 * measured named (or inferred prior-sibling) gap improved safely, accept even
 * when an earlier semantic parser marked the relation AMBIGUOUS/UNEVALUABLE.
 */
function aiSandboxImprovesCanonicalOrInferredPair(input: {
  priorCanvas: FabricCanvasDoc;
  afterCanvas: FabricCanvasDoc;
  resolvedRelations: ResolvedSpacingRelation[];
  aiPositionOps: CanvasOperation[];
}): boolean {
  const pairs: Array<{ upper_id: string; lower_id: string; direction: string }> =
    [];
  for (const rel of input.resolvedRelations) {
    if (
      rel.kind === "NAMED_PAIR" &&
      rel.upper_id &&
      rel.lower_id &&
      (rel.direction === "REDUCE_GAP" || rel.direction === "TIGHTEN_RHYTHM")
    ) {
      pairs.push({
        upper_id: rel.upper_id,
        lower_id: rel.lower_id,
        direction: rel.direction,
      });
    }
  }
  if (pairs.length === 0) {
    // Infer from single AI set_position target + prior same-entry visual sibling.
    const tops = input.aiPositionOps.filter(
      (o) =>
        o.op === "set_position" &&
        typeof o.target_id === "string" &&
        o.target_id &&
        typeof o.values?.top === "number",
    );
    if (tops.length === 1) {
      const lowerId = String(tops[0]!.target_id);
      const inferred = inferPriorSiblingPair(input.priorCanvas, lowerId);
      if (inferred) {
        pairs.push({
          upper_id: inferred.upper_id,
          lower_id: inferred.lower_id,
          direction: "REDUCE_GAP",
        });
      }
    }
  }
  if (pairs.length === 0) return false;
  for (const pair of pairs) {
    const before =
      measureResolvedPairGap(
        input.priorCanvas,
        pair.upper_id,
        pair.lower_id,
      ) ?? null;
    const after =
      measureResolvedPairGap(
        input.afterCanvas,
        pair.upper_id,
        pair.lower_id,
      ) ?? null;
    if (before == null || after == null) return false;
    const sat = spacingIntentSatisfied({
      direction: pair.direction as "REDUCE_GAP" | "TIGHTEN_RHYTHM",
      before_gap: before,
      after_gap: after,
    });
    if (!sat.satisfied) return false;
  }
  return true;
}

function inferPriorSiblingPair(
  canvas: FabricCanvasDoc,
  lowerId: string,
): { upper_id: string; lower_id: string } | null {
  const objs = (canvas.objects ?? []) as Array<Record<string, unknown>>;
  const texts: Array<{
    id: string;
    top: number;
    contentBottom: number;
    bullet: boolean;
    section: string;
  }> = [];
  for (let i = 0; i < objs.length; i++) {
    const o = objs[i]!;
    if (!isFabricTextObject(o)) continue;
    const id = objectId(o, i);
    const text = String(o.text ?? "");
    const data =
      o.data && typeof o.data === "object" && !Array.isArray(o.data)
        ? (o.data as { section?: unknown })
        : {};
    texts.push({
      id,
      top: asNum(o.top) ?? 0,
      contentBottom: visualTextContentBottom(o),
      bullet: /^\s*[•\-–]/.test(text),
      section: String(data.section ?? ""),
    });
  }
  texts.sort((a, b) => a.top - b.top || a.id.localeCompare(b.id));
  const lower = texts.find((t) => t.id === lowerId);
  if (!lower) return null;
  const priors = texts.filter(
    (t) =>
      t.id !== lower.id &&
      t.section === lower.section &&
      t.bullet &&
      t.top < lower.top - 1e-9,
  );
  const upper = priors[priors.length - 1];
  if (!upper) return null;
  return { upper_id: upper.id, lower_id: lower.id };
}
