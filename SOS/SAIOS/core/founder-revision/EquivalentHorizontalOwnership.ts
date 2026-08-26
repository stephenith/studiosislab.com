/**
 * Narrow deterministic collapse of redundant equivalent horizontal ownership:
 * set_position.left === align_objects.align_left on a shared target.
 * Does NOT live in PlanMutationConflicts (that gate stays fail-closed).
 * No geometry inference. No unequal-value rewrite. No delta_left rewrite.
 */
import type { CanvasOperation, RevisionPlan } from "./revision-task-types.js";
import {
  geomAxesPresent,
  targetIdsOf,
} from "./PlanMutationConflicts.js";

function normalizeFounderFeedbackItem(s: string): string {
  return s
    .replace(/^\*+\s*/, "")
    .replace(/^\d+\.\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function finiteNum(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/** Match CanvasOperationExecutor.snap — 2 decimal places. */
export function snapCoord(n: number): number {
  return Number(n.toFixed(2));
}

function cloneOp(op: CanvasOperation): CanvasOperation {
  return {
    ...op,
    values: op.values ? { ...op.values } : {},
    target_ids: op.target_ids ? [...op.target_ids] : undefined,
    founder_feedback_items: op.founder_feedback_items
      ? [...op.founder_feedback_items]
      : undefined,
  };
}

function allAttributions(op: CanvasOperation): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    const n = normalizeFounderFeedbackItem(t);
    if (!n || seen.has(n)) return;
    seen.add(n);
    out.push(t);
  };
  push(String(op.founder_feedback_item ?? ""));
  for (const extra of op.founder_feedback_items ?? []) push(String(extra ?? ""));
  return out;
}

function setAttributions(op: CanvasOperation, lines: string[]): void {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const raw of lines) {
    const t = raw.trim();
    if (!t) continue;
    const n = normalizeFounderFeedbackItem(t);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    unique.push(t);
  }
  op.founder_feedback_item = unique[0] ?? op.founder_feedback_item;
  op.founder_feedback_items = unique.length > 1 ? unique.slice(1) : undefined;
}

function appendAttributions(op: CanvasOperation, lines: string[]): void {
  setAttributions(op, [...allAttributions(op), ...lines]);
}

/**
 * Horizontal-alignment Founder wording (left anchors, align headings/markers).
 * Not a completeness matcher — used only when splitting mixed-axis ops.
 */
export function isHorizontalAlignmentFounderLine(text: string): boolean {
  const n = normalizeFounderFeedbackItem(text);
  if (!n) return false;
  if (/\blane ownership\b/.test(n)) return true;
  if (/\bleft\s+anchor/.test(n)) return true;
  if (/\bleft\s+edge/.test(n)) return true;
  if (/\bhorizontal\b/.test(n) && /\b(align|anchor)\b/.test(n)) return true;
  if (
    /\balign(ing|ed)?\b/.test(n) &&
    /\b(heading|marker|headings|markers)\b/.test(n)
  ) {
    return true;
  }
  return false;
}

/** Vertical / grouping / spacing intent that a remaining `top` mutation can support. */
export function isVerticalOrGroupingFounderLine(text: string): boolean {
  const n = normalizeFounderFeedbackItem(text);
  if (!n) return false;
  return (
    /\b(vertical|gap|spacing|reflow|overlap|collision|stack|rhythm|grouped|grouping|internal spacing)\b/.test(
      n,
    ) ||
    /\bheading-to-content\b/.test(n) ||
    /\bbelow\b/.test(n)
  );
}

export function isSectionGroupingFounderLine(text: string): boolean {
  const n = normalizeFounderFeedbackItem(text);
  if (!n) return false;
  return (
    /\bgrouped as one unit\b/.test(n) ||
    (/\bheading\b/.test(n) &&
      /\bmarker\b/.test(n) &&
      /\b(content|associated)\b/.test(n) &&
      /\b(group|grouped|unit|spacing)\b/.test(n))
  );
}

function targetLooksLikeEducationBody(op: CanvasOperation): boolean {
  const id = (op.target_id ?? "").toLowerCase();
  const blob = `${id} ${op.before_summary ?? ""} ${op.intended_change ?? ""}`.toLowerCase();
  const isEducation = /\beducation\b/.test(blob) || /block-education/.test(id);
  const isHeadingOrMarker =
    /\b(heading|marker|section-marker)\b/.test(blob) ||
    /-(r0|t1)$/.test(id);
  const isBody =
    /\b(content|body|textbox)\b/.test(blob) || /t[2-9]$/.test(id) || /t1[0-9]$/.test(id);
  return isEducation && isBody && !isHeadingOrMarker;
}

/**
 * Architecture-general: a section-grouping Founder line is not genuinely
 * supported by an Education-body-only mutation (or any op that does not
 * target a section unit member). Plan completeness remains text-exact via
 * feedbackItemCovered(); this helper is for prompt/verifier semantic checks.
 */
export function operationGenuinelySupportsSectionGrouping(
  op: CanvasOperation,
  groupingItem: string,
): boolean {
  if (!isSectionGroupingFounderLine(groupingItem)) return false;
  if (targetLooksLikeEducationBody(op)) return false;
  const ids = targetIdsOf(op).map((s) => s.toLowerCase());
  const blob = `${ids.join(" ")} ${op.before_summary ?? ""} ${op.intended_change ?? ""} ${op.op}`.toLowerCase();
  const unitMember =
    /\b(heading|marker|accent|content|section)\b/.test(blob) ||
    /-(r0|t1|t[2-9])$/.test(ids[0] ?? "");
  if (!unitMember) return false;
  const contributes =
    isVerticalOrGroupingFounderLine(op.intended_change) ||
    isHorizontalAlignmentFounderLine(op.intended_change) ||
    /\b(group|gap|spacing|reflow|align|move)\b/.test(blob);
  return contributes;
}

/** Heading/marker visual-reference Founder wording (item [9]-style). */
export function isHeadingMarkerReferenceFounderLine(text: string): boolean {
  const n = normalizeFounderFeedbackItem(text);
  if (!n) return false;
  return (
    /\bheading\b/.test(n) &&
    /\bmarker\b/.test(n) &&
    /\b(reference|relationship|heading-marker)\b/.test(n)
  );
}

/** Heading/marker relationship (item [9]-style) may sit on genuine align ops. */
export function operationGenuinelySupportsHeadingMarkerReference(
  op: CanvasOperation,
): boolean {
  const ids = targetIdsOf(op);
  const blob = `${ids.join(" ")} ${op.before_summary ?? ""} ${op.intended_change ?? ""}`.toLowerCase();
  const headingOrMarker =
    /\b(heading|marker|accent)\b/.test(blob) ||
    ids.some((id) => /-(r0|t1)$/.test(id.toLowerCase()));
  if (!headingOrMarker) return false;
  if (op.op === "align_objects") return finiteNum(op.values?.align_left);
  if (op.op === "set_position" || op.op === "move_object") {
    return finiteNum(op.values?.left) || finiteNum(op.values?.align_left);
  }
  return false;
}

function remainingExecutableValues(
  values: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...values };
  delete next.left;
  return next;
}

function hasRemainingGeometry(values: Record<string, unknown>): boolean {
  return geomAxesPresent(values).size > 0;
}

function isPurelyHorizontalAttribution(text: string): boolean {
  if (isVerticalOrGroupingFounderLine(text)) return false;
  return (
    isHorizontalAlignmentFounderLine(text) ||
    isHeadingMarkerReferenceFounderLine(text)
  );
}

function attributionsForRemainingTop(op: CanvasOperation): string[] {
  return allAttributions(op).filter((line) => !isPurelyHorizontalAttribution(line));
}

function attributionsForAlignCohort(op: CanvasOperation): string[] {
  return allAttributions(op).filter(
    (line) =>
      isHorizontalAlignmentFounderLine(line) ||
      isHeadingMarkerReferenceFounderLine(line),
  );
}

function targetHasDeltaLeft(ops: CanvasOperation[], tid: string): boolean {
  return ops.some(
    (op) => targetIdsOf(op).includes(tid) && finiteNum(op.values?.delta_left),
  );
}

function isGenuineAlignmentCohort(op: CanvasOperation): boolean {
  const unique = new Set(targetIdsOf(op));
  return (
    op.op === "align_objects" &&
    unique.size >= 2 &&
    finiteNum(op.values?.align_left) &&
    !finiteNum(op.values?.delta_left)
  );
}

export type CanonicalizeHorizontalOwnershipResult = {
  operations: CanvasOperation[];
  stripped_left_indices: number[];
  removed_indices: number[];
};

/**
 * Collapse equivalent set_position.left + align_objects.align_left on a
 * shared target. Prefer align_objects as the left owner.
 */
export function canonicalizeEquivalentHorizontalOwnership(
  operations: CanvasOperation[],
): CanonicalizeHorizontalOwnershipResult {
  const ops = operations.map(cloneOp);
  const stripped_left_indices: number[] = [];
  const removed_indices: number[] = [];

  const alignOps = ops
    .map((op, i) => ({ op, i }))
    .filter(({ op }) => isGenuineAlignmentCohort(op));

  for (let si = 0; si < ops.length; si++) {
    const pos = ops[si];
    if (!pos || pos.op !== "set_position") continue;
    const vals = pos.values ?? {};
    if (!finiteNum(vals.left)) continue;
    if (finiteNum(vals.delta_left)) continue;
    const posTargets = targetIdsOf(pos);
    if (posTargets.length !== 1) continue;
    const tid = posTargets[0]!;
    if (targetHasDeltaLeft(ops, tid)) continue;
    const leftSnap = snapCoord(vals.left);

    const match = alignOps.find(({ op, i }) => {
      if (i === si) return false;
      if (!targetIdsOf(op).includes(tid)) return false;
      const al = op.values?.align_left;
      return finiteNum(al) && snapCoord(al) === leftSnap;
    });
    if (!match) continue;

    const remaining = remainingExecutableValues(vals);
    const horizontalLines = attributionsForAlignCohort(pos);
    appendAttributions(match.op, horizontalLines);

    if (!hasRemainingGeometry(remaining)) {
      removed_indices.push(si);
      continue;
    }

    pos.values = remaining;
    const kept = attributionsForRemainingTop(pos);
    if (kept.length > 0) {
      setAttributions(pos, kept);
    } else {
      pos.founder_feedback_items = undefined;
      if (isPurelyHorizontalAttribution(pos.founder_feedback_item)) {
        pos.founder_feedback_item = "";
      }
    }
    stripped_left_indices.push(si);
  }

  const remove = new Set(removed_indices);
  const nextOps = ops.filter((_, i) => !remove.has(i));

  return { operations: nextOps, stripped_left_indices, removed_indices };
}

export function canonicalizeRevisionPlanHorizontalOwnership(
  plan: RevisionPlan,
): RevisionPlan {
  const { operations } = canonicalizeEquivalentHorizontalOwnership(
    plan.operations,
  );
  return { ...plan, operations };
}
