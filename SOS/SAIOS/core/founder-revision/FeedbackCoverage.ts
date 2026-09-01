/**
 * Map every Founder requested change to addressed / partial / not addressed.
 */
import type {
  CanvasInventoryObject,
  FeedbackCoverageItem,
  FeedbackCoverageReport,
  FeedbackCoverageStatus,
  FeedbackOperationEvidence,
  FeedbackRelationEvidence,
  OperationLogEntry,
  RevisionPlan,
} from "./revision-task-types.js";
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import { buildCanvasInventory } from "./CanvasInventory.js";
import {
  findAcceptanceChecksForChange,
  findTextOverlapFindings,
  type RevisionAcceptanceReport,
} from "./RevisionAcceptanceChecks.js";
import {
  classifyRequestedChange,
  verificationCheckTypes,
} from "./RequestedChangeClassification.js";
import {
  detectLayoutLanesFromCanvas,
  MIN_HEADING_BODY_GAP_PX,
  MIN_SECTION_GAP_PX,
} from "./RevisionLayoutNormalizer.js";
import {
  normalizeFounderFeedbackItem,
  operationFounderAttributions,
} from "./RevisionPromptBuilder.js";
import {
  effectiveTextHeightScaled,
  isFabricTextObject,
} from "./TextEffectiveHeight.js";
import {
  HEADER_IDENTITY_PAD_PX,
  HEADER_TO_SUMMARY_CLEARANCE_PX,
  headerIdentityMemberId,
  resolveHeaderIdentityMembersFromCanvas,
} from "./HeaderIdentityLayout.js";

function normalize(s: string): string {
  return normalizeFounderFeedbackItem(s);
}

/** Plan operation indices whose exact attributions cover this Founder item. */
function planIndicesCoveringItem(change: string, plan: RevisionPlan): number[] {
  const n = normalizeFounderFeedbackItem(change);
  if (!n) return [];
  const indices: number[] = [];
  for (let i = 0; i < plan.operations.length; i++) {
    const attrs = operationFounderAttributions(plan.operations[i]!);
    if (attrs.some((a) => normalizeFounderFeedbackItem(a) === n)) {
      indices.push(i);
    }
  }
  return indices;
}

/**
 * Map Founder item → execution log entries by plan operation index identity.
 * One real executed op can evidence multiple Founder items via multi-attribution.
 */
function findOpsForItem(
  item: string,
  plan: RevisionPlan,
  log: OperationLogEntry[],
): OperationLogEntry[] {
  const indices = new Set(planIndicesCoveringItem(item, plan));
  return log.filter((e) => indices.has(e.index));
}

function planCoversItem(change: string, plan: RevisionPlan): boolean {
  return planIndicesCoveringItem(change, plan).length > 0;
}

/**
 * True only when Founder text explicitly asks for measurable multi-object
 * alignment of peer objects/sections (common axis, listed targets,
 * section-heading alignment, align-across-columns).
 *
 * Must NOT trigger for:
 * - page-edge geometry ("left edge of the page")
 * - column membership ("aligned … right column")
 * - generic "alignment" / past-participle-only "aligned" in hierarchy/QA prose
 */
export function isExplicitMultiObjectAlignmentRequest(
  normalizedItem: string,
): boolean {
  const n = normalizedItem;

  // Active align + left edges of peers (not bare "left edge of the page").
  if (/align(ing|ed)?\s+(the\s+)?left\s+edges?/.test(n)) return true;
  if (
    /left\s+edges?\s+of\s+(the\s+)?(name|summary|experience|education|skills|projects|certifications|languages|headings?|sections?|objects?)\b/.test(
      n,
    )
  ) {
    return true;
  }
  if (/same\s+left\s+edge/.test(n) && /\b(align|share|common)\b/.test(n)) {
    return true;
  }
  if (/left\s+starting/.test(n)) return true;
  if (/unified\s+layout/.test(n)) return true;
  // NOTE: "consistent vertical …" is vertical spacing, NOT horizontal left-spread.
  if (/common\s+(axis|left|edge)/.test(n)) return true;
  if (/share\s+a\s+common\s+(axis|left|edge)/.test(n)) return true;

  // Active align + columns / across columns.
  // Past-participle-only "aligned … right column" must NOT match (no \baligned\b).
  if (/\balign(ing)?\b[\s\S]{0,80}\b(across\s+)?columns?\b/.test(n)) {
    return true;
  }
  if (/\bcolumns?\b[\s\S]{0,40}\balign(ing)?\b/.test(n)) {
    return true;
  }
  if (/distribute\b[\s\S]{0,40}\bevenly\b|\bevenly\b[\s\S]{0,40}\bdistribute\b/.test(n)) {
    return true;
  }
  // Active align + section headings (exclude past-participle-only "aligned").
  if (/\balign(ing)?\b[\s\S]{0,40}\bsection\s+headings?\b/.test(n)) {
    return true;
  }
  if (/\balign(ing)?\s+(multiple|several|all)\b/.test(n)) return true;
  if (
    /\bunify\b[\s\S]{0,40}\b(spacing|alignment)\b|\b(spacing|alignment)\b[\s\S]{0,40}\bacross\s+(several|multiple|all)\b/.test(
      n,
    )
  ) {
    return true;
  }

  // Align verb + enumerated targets (commas / and) or multiple "heading" mentions.
  // Intentionally requires \balign\b / \baligning\b — not the noun "alignment"
  // and not past-participle-only "aligned" in QA prose.
  if (
    /\balign(ing)?\b/.test(n) &&
    (/,.*,|\band\b.*,|,.*\band\b/.test(n) ||
      /\bheading\b[\s\S]+\bheading\b/.test(n))
  ) {
    return true;
  }

  return false;
}

/** Extend sidebar/panel to page edge while preserving existing right boundary. */
export function isSidebarEdgeExtensionRequest(normalizedItem: string): boolean {
  const n = normalizedItem;
  const sidebar =
    /\b(sidebar|side\s*bar)\b/.test(n) ||
    (/light[- ]blue/.test(n) && /\bleft\b/.test(n) && /\bbackground\b/.test(n));
  if (!sidebar) return false;
  const toPageEdge =
    (/left\s+edge/.test(n) && /\bpage\b/.test(n)) ||
    /fully\s+to\s+the\s+left/.test(n) ||
    (/extend/.test(n) && /\bleft\s+edge\b/.test(n));
  if (!toPageEdge) return false;
  return (
    /preserv(e|ing).{0,40}right\s+bound/.test(n) ||
    /existing\s+right\s+bound/.test(n) ||
    /same\s+right\s+bound/.test(n) ||
    /right\s+boundary/.test(n)
  );
}

/**
 * Broad page-level composition / column balance — ops alone never prove this.
 */
export function isBroadVisualBalanceRequest(normalizedItem: string): boolean {
  const n = normalizedItem;
  if (/overall\s+visual\s+balance/.test(n)) return true;
  if (/visual\s+balance\s+between/.test(n)) return true;
  if (
    /\b(left|right)\b[\s\S]{0,40}\bcolumns?\b/.test(n) &&
    /\bbalance\b/.test(n)
  ) {
    return true;
  }
  if (
    (/empty\s+(lower[- ]left|left)/.test(n) ||
      /visually\s+empty\b/.test(n)) &&
    /\b(balance|composed|populated|intentionally)\b/.test(n)
  ) {
    return true;
  }
  return false;
}

/**
 * Section hierarchy/spacing refinement (e.g. Education entries) — requires
 * meaningful geometry evidence, not micro-nudges or op success alone.
 */
export function isSectionHierarchySpacingRequest(
  normalizedItem: string,
): boolean {
  const n = normalizedItem;
  if (!/\b(education|skills|experience|projects|certifications|languages)\b/.test(n)) {
    return false;
  }
  return (
    /\bhierarchy\b/.test(n) ||
    (/\bspacing\b/.test(n) &&
      /\b(entries|distinguishable|section)\b/.test(n)) ||
    (/\bdistinguishable\b/.test(n) && /\b(entries|entry)\b/.test(n))
  );
}

/**
 * Section-unit grouping: heading + accent marker + associated content must read
 * as ONE coherent unit (e.g. "keep each section's heading, blue accent marker,
 * and associated content visually grouped as one unit").
 *
 * Deliberately narrow: requires explicit grouping intent AND a heading mention
 * AND a marker/content mention, so header-banner grouping requests
 * ("group the contact details inside the header banner") never match.
 */
export function isSectionUnitGroupingRequest(normalizedItem: string): boolean {
  const n = normalizedItem;
  const groupingIntent =
    /\bgroup(ed|ing|s)?\b/.test(n) ||
    /\bas\s+(one|a\s+single)\s+unit\b/.test(n) ||
    /\bone\s+unit\b/.test(n) ||
    /\bvisual\s+unit\b/.test(n);
  if (!groupingIntent) return false;
  if (!/\bheadings?\b/.test(n)) return false;
  const mentionsMarker = /\bmarkers?\b/.test(n);
  const mentionsContent = /\b(content|body|text)\b/.test(n);
  return mentionsMarker || mentionsContent;
}

/**
 * Reference/preservation requirement: one section's heading↔marker relationship
 * is the visual reference for the others, while separate lane anchors stay
 * separate (e.g. "use the Summary heading and its blue accent marker as a
 * visual reference … while preserving the separate horizontal anchors").
 *
 * Requires reference wording AND relationship wording, so active alignment
 * commands ("align their blue accent markers …") never match.
 */
export function isHeadingMarkerReferenceRequest(
  normalizedItem: string,
): boolean {
  const n = normalizedItem;
  if (!/\bheadings?\b/.test(n)) return false;
  if (!/\bmarkers?\b/.test(n)) return false;
  const referenceIntent =
    /\b(visual\s+)?reference\b/.test(n) ||
    /\bas\s+a\s+(visual\s+)?(model|template|benchmark)\b/.test(n);
  if (!referenceIntent) return false;
  return (
    /headings?[-\s]?markers?\s+relationship/.test(n) ||
    /markers?[-\s]?headings?\s+relationship/.test(n) ||
    /\brelationship\b/.test(n)
  );
}

/**
 * Active align of markers relative to headings (X and attached Y).
 * Distinct from heading↔marker *reference* wording.
 */
export function isMarkerHeadingRelativeAlignmentRequest(
  normalizedItem: string,
): boolean {
  const n = normalizedItem;
  if (!isExplicitMultiObjectAlignmentRequest(n)) return false;
  if (!/\bmarkers?\b/.test(n)) return false;
  if (!/\bheadings?\b/.test(n)) return false;
  return /\brelative\b/.test(n) || /\bconsistently\b/.test(n);
}

/**
 * Founder asks to increase vertical gap between Summary content and Experience
 * heading (section-relationship spacing, not intra-section hierarchy).
 */
export function isSummaryToExperienceGapRequest(
  normalizedItem: string,
): boolean {
  const n = normalizedItem;
  if (!/\bexperience\b/.test(n)) return false;
  if (!/\bsummary\b/.test(n)) return false;
  return (
    /\b(gap|spacing|vertical gap|space)\b/.test(n) ||
    /above\s+the\s+experience/.test(n) ||
    /preceding\s+summary/.test(n)
  );
}

/**
 * Passive preservation/consistency alignment wording — not active "align …" commands.
 * Examples: "Keep section headings … aligned consistently across the layout."
 */
export function isPassiveConsistentAlignmentRequest(
  normalizedItem: string,
): boolean {
  const n = normalizedItem;
  if (isExplicitMultiObjectAlignmentRequest(n)) return false;

  const mentionsHeadingsOrMarkers =
    /\b(section\s+)?headings?\b/.test(n) ||
    /\baccent\s+markers?\b/.test(n);
  if (!mentionsHeadingsOrMarkers) return false;

  const passiveKeep =
    /\b(keep|maintain|preserv)\b/.test(n) &&
    (/\baligned\b/.test(n) || /\balignment\b/.test(n));
  const passiveConsistent =
    /\bconsistent(ly)?\b/.test(n) &&
    (/\baligned\b/.test(n) || /\balignment\b/.test(n));
  const acrossLayout =
    /consistently\s+across/.test(n) &&
    (/\bheadings?\b/.test(n) || /\bmarkers?\b/.test(n));

  return passiveKeep || passiveConsistent || acrossLayout;
}

/**
 * True only for Founder text that clearly asks to put contact inside / extend
 * a header banner/band. Bare "header group" must NOT match.
 */
export function isContactBandExtensionRequest(normalizedItem: string): boolean {
  const n = normalizedItem;
  if (!/contact/.test(n)) return false;
  const bandSemantics =
    /\binside\b/.test(n) ||
    /\bextend(ing|ed)?\b/.test(n) ||
    /\bbanner\b/.test(n) ||
    /header\s+band/.test(n) ||
    /blue\s+header/.test(n) ||
    /blue\s+background/.test(n) ||
    /into\s+the\s+(blue\s+)?header/.test(n) ||
    /within\s+the\s+(blue\s+)?header/.test(n);
  if (!bandSemantics) return false;
  return /\b(extend|move|group|unify|inside|into)\b/.test(n);
}

/**
 * Contact/header compact group PLUS explicit gap/spacing before Summary.
 */
export function isContactToSummaryGapRequest(normalizedItem: string): boolean {
  const n = normalizedItem;
  if (!/contact/.test(n)) return false;
  const gapBeforeSummary =
    (/\b(gap|spacing|space)\b/.test(n) && /\bsummary\b/.test(n)) ||
    /before\s+the\s+summary/.test(n) ||
    (/vertical\s+gap/.test(n) && /\bsummary\b/.test(n));
  if (!gapBeforeSummary) return false;
  return (
    /contact\s+block|header\s+group|compact\s+header|contact\s+details/.test(
      n,
    ) ||
    (/\bgroup\b/.test(n) && /\b(header|name|contact)\b/.test(n)) ||
    /\bbelow\s+the\s+name\b/.test(n)
  );
}

/**
 * Structural heuristics are required only for explicitly multi-object /
 * unify-style requests — not for simple single-object edits that mention
 * "header", and not for broad QA language that merely contains alignment words.
 */
export function requiresStructuralProof(normalizedItem: string): boolean {
  const n = normalizedItem;
  if (
    /unify|unified|consistently across|across sections|apply .*style|restructur/.test(
      n,
    )
  ) {
    return true;
  }
  if (isContactBandExtensionRequest(n)) {
    return true;
  }
  if (isContactToSummaryGapRequest(n)) {
    return true;
  }
  if (isExplicitMultiObjectAlignmentRequest(n)) {
    return true;
  }
  if (isPassiveConsistentAlignmentRequest(n)) {
    return true;
  }
  if (isSidebarEdgeExtensionRequest(n)) {
    return true;
  }
  if (isBroadVisualBalanceRequest(n)) {
    return true;
  }
  if (isSectionHierarchySpacingRequest(n)) {
    return true;
  }
  // Section-unit grouping and heading↔marker reference requirements are
  // geometry claims: operation success alone must never certify them.
  if (isSectionUnitGroupingRequest(n)) {
    return true;
  }
  if (isHeadingMarkerReferenceRequest(n)) {
    return true;
  }
  // Overlap / readability / no-intrusion claims need final geometry proof —
  // successful attributed ops alone must never fully address them.
  if (requiresOverlapReadabilityGeometricProof(n)) {
    return true;
  }
  return false;
}

/**
 * Founder language demanding final zero-overlap / readability proof.
 * Operation attribution is insufficient without post-mutation geometric proof.
 *
 * Intentionally narrow: section-system containment / line-spacing rhythm items
 * that merely mention "overlap" or "intrusion" are covered by existing
 * structural proofs — not this gate.
 */
export function requiresOverlapReadabilityGeometricProof(
  normalizedItem: string,
): boolean {
  const n = normalizedItem;
  if (/\b(fully|completely)\s+readable\b/.test(n)) return true;
  if (/\bevery line is (?:fully )?readable\b/.test(n)) return true;
  if (
    /\bzero\b[\s\S]{0,48}\b(?:text[- ]?(?:to[- ]?text[- ]?)?)?(?:overlap|collision|clipping)\b/.test(
      n,
    )
  ) {
    return true;
  }
  // "Remove … overlap … readable" class (mutation opener).
  if (
    /\b(remove|eliminate)\b[\s\S]{0,64}\b(overlap|collision)\b/.test(n) &&
    /\b(readable|readability)\b/.test(n)
  ) {
    return true;
  }
  // Readable + collision, but not line-spacing / section-rhythm requests.
  if (
    /\b(readable|readability)\b/.test(n) &&
    /\b(overlap|collision|clipping)\b/.test(n) &&
    !/\bconsistent (?:line )?spacing\b/.test(n) &&
    !/\bsection(?:-|\s+to\s+|-to-)section\b/.test(n) &&
    !/\bheading(?:-|\s+to\s+|-to-)content\b/.test(n)
  ) {
    return true;
  }
  return false;
}

function invBottom(o: CanvasInventoryObject): number | null {
  if (o.top == null || o.height == null) return null;
  return o.top + o.height;
}

/** Resolve raw canvas object by inventory id (full text, not truncated). */
function rawCanvasObjectById(
  canvas: FabricCanvasDoc,
  id: string,
): Record<string, unknown> | null {
  const objects = canvas.objects ?? [];
  for (let i = 0; i < objects.length; i++) {
    const o = objects[i]!;
    if (typeof o.id === "string" && o.id === id) return o;
    const data = o.data;
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const did = (data as { id?: unknown }).id;
      if (typeof did === "string" && did === id) return o;
    }
  }
  return null;
}

/**
 * Inventory bottoms use stored height; for text, prefer wrap-aware effective
 * height from the raw canvas object (full text, not the 160-char summary).
 */
function inventoryObjectEffectiveBottom(
  canvas: FabricCanvasDoc,
  o: CanvasInventoryObject,
): number | null {
  const raw = rawCanvasObjectById(canvas, o.id);
  if (raw && isFabricTextObject(raw)) {
    const top =
      typeof raw.top === "number" && Number.isFinite(raw.top)
        ? raw.top
        : o.top;
    if (top == null) return null;
    return top + effectiveTextHeightScaled(raw);
  }
  if (raw) {
    const top =
      typeof raw.top === "number" && Number.isFinite(raw.top)
        ? raw.top
        : o.top;
    const height =
      Number(raw.height ?? 0) * Number(raw.scaleY ?? 1);
    if (top == null) return null;
    if (height > 0) return top + height;
  }
  return invBottom(o);
}

function findHeaderContact(
  inv: CanvasInventoryObject[],
): CanvasInventoryObject | null {
  const contacts = inv.filter(
    (o) =>
      o.section === "header" &&
      o.text != null &&
      String(o.type ?? "")
        .toLowerCase()
        .includes("text") &&
      (/@/.test(o.text) ||
        /linkedin/i.test(o.text) ||
        /\+?\d[\d\s().-]{6,}\d/.test(o.text)),
  );
  if (contacts.length === 0) return null;
  // Prefer the densest contact/title line (often includes location).
  return contacts.sort(
    (a, b) => String(b.text ?? "").length - String(a.text ?? "").length,
  )[0]!;
}

function findSummaryHeading(
  inv: CanvasInventoryObject[],
): CanvasInventoryObject | null {
  const rect = inv.find(
    (o) =>
      o.section === "summary" &&
      !o.text &&
      String(o.type ?? "")
        .toLowerCase()
        .includes("rect") &&
      (o.role === "filled-label" ||
        o.role === "section-heading" ||
        o.role == null),
  );
  if (rect) return rect;
  return (
    inv.find(
      (o) =>
        o.section === "summary" &&
        o.text != null &&
        /^\s*SUMMARY\b/i.test(o.text.trim()),
    ) ?? null
  );
}

function findHeaderName(
  inv: CanvasInventoryObject[],
): CanvasInventoryObject | null {
  return (
    inv.find(
      (o) =>
        o.section === "header" &&
        o.text != null &&
        String(o.type ?? "")
          .toLowerCase()
          .includes("text") &&
        !/@/.test(o.text) &&
        (o.fontSize ?? 0) >= 20,
    ) ?? null
  );
}

export type StructuralHintResult = {
  status: FeedbackCoverageStatus | null;
  notes: string;
  ids: string[];
  relation?: FeedbackRelationEvidence;
};

const PAGE_EDGE_EPS_PX = 1;
const RIGHT_BOUNDARY_EPS_PX = 2;
/**
 * Gap-vector comparison noise only (measurement / snap), aligned with
 * CONTENT_GRID_LEFT_TOLERANCE_PX and visual padding tolerance (2px).
 * Not a visual-judgment threshold — absolute object translation is ignored.
 */
const GAP_RELATION_NOISE_PX = 2;
/** Per-lane left-spread tolerance for heading/marker alignment proofs. */
const ALIGNMENT_SPREAD_TOLERANCE_PX = 2;

function invGeom(
  o: CanvasInventoryObject | null | undefined,
): { left: number; top: number; width: number; height: number; right: number } | null {
  if (!o || o.left == null || o.width == null) return null;
  const left = o.left;
  const width = o.width;
  const top = o.top ?? 0;
  const height = o.height ?? 0;
  return { left, top, width, height, right: left + width };
}

function findInvById(
  inv: CanvasInventoryObject[],
  id: string | null | undefined,
): CanvasInventoryObject | null {
  if (!id) return null;
  return inv.find((o) => o.id === id) ?? null;
}

/**
 * Resolve sidebar/panel target from attributed ops, then inventory heuristics.
 * Does not hardcode production template IDs.
 */
function resolveSidebarTargetId(
  beforeInv: CanvasInventoryObject[],
  afterInv: CanvasInventoryObject[],
  okOps: OperationLogEntry[],
): string | null {
  for (const op of okOps) {
    const tid = op.target_id;
    if (!tid) continue;
    const after = findInvById(afterInv, tid);
    if (
      after &&
      String(after.type ?? "")
        .toLowerCase()
        .includes("rect") &&
      !after.system
    ) {
      return tid;
    }
  }
  const candidates = afterInv.filter(
    (o) =>
      !o.system &&
      String(o.type ?? "")
        .toLowerCase()
        .includes("rect") &&
      o.left != null &&
      o.width != null &&
      o.height != null &&
      o.height > 200 &&
      o.width >= 80 &&
      o.width <= 360 &&
      o.left <= 80,
  );
  const byId = candidates.find((o) => /sidebar|side[-_]?bar/i.test(o.id));
  if (byId) return byId.id;
  if (candidates.length === 1) return candidates[0]!.id;
  // Prefer widest left-column tall rect present in both inventories.
  const ranked = candidates
    .filter((o) => findInvById(beforeInv, o.id))
    .sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  return ranked[0]?.id ?? null;
}

function evaluateSidebarEdgeExtension(
  beforeInv: CanvasInventoryObject[],
  afterInv: CanvasInventoryObject[],
  okOps: OperationLogEntry[],
): StructuralHintResult {
  const targetId = resolveSidebarTargetId(beforeInv, afterInv, okOps);
  const ids = targetId ? [targetId] : [];
  if (!targetId) {
    return {
      status: "partially_addressed",
      notes:
        "sidebar edge-extension proof unevaluable: no attributed sidebar/panel target",
      ids,
    };
  }
  const beforeG = invGeom(findInvById(beforeInv, targetId));
  const afterG = invGeom(findInvById(afterInv, targetId));
  if (!beforeG || !afterG) {
    return {
      status: "partially_addressed",
      notes: `sidebar edge-extension proof unevaluable: missing geometry for ${targetId}`,
      ids,
    };
  }
  const leftAtEdge = afterG.left <= PAGE_EDGE_EPS_PX;
  const rightPreserved =
    Math.abs(afterG.right - beforeG.right) <= RIGHT_BOUNDARY_EPS_PX;
  const notes = `sidebar geometry before L=${beforeG.left} W=${beforeG.width} R=${beforeG.right}; after L=${afterG.left} W=${afterG.width} R=${afterG.right}; leftAtEdge=${leftAtEdge}; rightPreserved=${rightPreserved}`;
  if (leftAtEdge && rightPreserved) {
    return { status: "addressed", notes, ids };
  }
  return {
    status: "partially_addressed",
    notes: `${notes}; final geometry does not preserve right boundary at page edge`,
    ids,
  };
}

function educationSectionObjects(
  inv: CanvasInventoryObject[],
): CanvasInventoryObject[] {
  return inv
    .filter(
      (o) =>
        o.section === "education" &&
        !o.system &&
        o.top != null &&
        String(o.type ?? "")
          .toLowerCase()
          .includes("text"),
    )
    .sort((a, b) => (a.top ?? 0) - (b.top ?? 0));
}

/** Consecutive top gaps for an ordered object list (relational, translation-invariant). */
function topGapVector(objs: CanvasInventoryObject[]): number[] {
  const gaps: number[] = [];
  for (let i = 1; i < objs.length; i++) {
    gaps.push(objs[i]!.top! - objs[i - 1]!.top!);
  }
  return gaps;
}

function isSummaryBodyObject(o: CanvasInventoryObject): boolean {
  if (o.section !== "summary" || o.system) return false;
  if (
    o.role === "section-heading" ||
    o.role === "filled-label" ||
    o.role === "section-heading-accent"
  ) {
    return false;
  }
  if (o.text && /^(0?\d\s+)?SUMMARY\s*$/i.test(String(o.text).trim())) {
    return false;
  }
  if (!o.text) return false;
  if (
    !String(o.type ?? "")
      .toLowerCase()
      .includes("text")
  ) {
    return false;
  }
  return o.top != null;
}

function findSummarySectionContentBottom(
  inv: CanvasInventoryObject[],
): { bottom: number; id: string } | null {
  let best: { bottom: number; id: string } | null = null;
  for (const o of inv.filter(isSummaryBodyObject)) {
    const bottom = invBottom(o);
    if (bottom == null) continue;
    if (!best || bottom > best.bottom) {
      best = { bottom, id: o.id };
    }
  }
  return best;
}

function findExperienceSectionHeadingTop(
  inv: CanvasInventoryObject[],
): { top: number; id: string } | null {
  const inSection = inv.filter(
    (o) => o.section === "experience" && !o.system && o.top != null,
  );
  const headingText = inSection.find(
    (o) =>
      (o.text != null &&
        /^\s*EXPERIENCE\b/i.test(String(o.text).trim())) ||
      (o.role === "section-heading" && o.text != null),
  );
  if (headingText?.top != null) {
    return { top: headingText.top, id: headingText.id };
  }
  const headingLike = inSection.filter(
    (o) =>
      o.role === "section-heading" ||
      o.role === "section-heading-accent" ||
      o.role === "filled-label" ||
      (o.text == null &&
        String(o.type ?? "")
          .toLowerCase()
          .includes("rect")),
  );
  if (headingLike.length === 0) return null;
  const min = headingLike.reduce((a, b) =>
    (a.top ?? Infinity) < (b.top ?? Infinity) ? a : b,
  );
  if (min.top == null) return null;
  return { top: min.top, id: min.id };
}

function evaluateSummaryToExperienceGap(
  beforeInv: CanvasInventoryObject[],
  afterInv: CanvasInventoryObject[],
): StructuralHintResult {
  const beforeSummary = findSummarySectionContentBottom(beforeInv);
  const afterSummary = findSummarySectionContentBottom(afterInv);
  const beforeExp = findExperienceSectionHeadingTop(beforeInv);
  const afterExp = findExperienceSectionHeadingTop(afterInv);
  const ids = [
    beforeSummary?.id,
    afterSummary?.id,
    beforeExp?.id,
    afterExp?.id,
  ].filter((x): x is string => Boolean(x));

  if (!beforeSummary || !afterSummary || !beforeExp || !afterExp) {
    return {
      status: "partially_addressed",
      notes:
        "SUMMARY→EXPERIENCE gap proof unevaluable: missing Summary body or Experience heading geometry",
      ids,
    };
  }

  const priorGap = Number(
    (beforeExp.top - beforeSummary.bottom).toFixed(2),
  );
  const finalGap = Number((afterExp.top - afterSummary.bottom).toFixed(2));
  const relation: FeedbackRelationEvidence = {
    type: "SUMMARY_TO_EXPERIENCE_GAP",
    summary_id: afterSummary.id,
    gap_px: finalGap,
    minimum_gap_px: MIN_SECTION_GAP_PX,
    pass: false,
    notes: `prior_gap=${priorGap} final_gap=${finalGap}`,
  };

  if (finalGap < 0) {
    return {
      status: "partially_addressed",
      notes: `SUMMARY→EXPERIENCE overlap: summary_bottom=${afterSummary.bottom} experience_top=${afterExp.top} final_gap=${finalGap}`,
      ids,
      relation: { ...relation, pass: false },
    };
  }
  if (finalGap <= priorGap + GAP_RELATION_NOISE_PX) {
    return {
      status: "partially_addressed",
      notes: `SUMMARY→EXPERIENCE gap not improved: prior_gap=${priorGap} final_gap=${finalGap} (noise=${GAP_RELATION_NOISE_PX}px)`,
      ids,
      relation: { ...relation, pass: false },
    };
  }
  if (finalGap + 1e-9 < MIN_SECTION_GAP_PX) {
    return {
      status: "partially_addressed",
      notes: `SUMMARY→EXPERIENCE final_gap=${finalGap}px < minimum section gap ${MIN_SECTION_GAP_PX}px`,
      ids,
      relation: { ...relation, pass: false },
    };
  }

  return {
    status: "addressed",
    notes: `SUMMARY→EXPERIENCE gap improved: prior_gap=${priorGap} final_gap=${finalGap} >= minimum_gap_px=${MIN_SECTION_GAP_PX}`,
    ids,
    relation: { ...relation, pass: true },
  };
}

function sectionHeadingTexts(
  inv: CanvasInventoryObject[],
): CanvasInventoryObject[] {
  return inv.filter(
    (o) =>
      o.left != null &&
      o.text &&
      o.section !== "header" &&
      !o.system &&
      (/^(0?\d\s+)?(SUMMARY|EXPERIENCE|EDUCATION|SKILLS|CERTIFICATIONS|LANGUAGES|PROJECTS)\b/i.test(
        String(o.text).trim(),
      ) ||
        o.role === "section-heading" ||
        /\bheading\b/i.test(String(o.text))),
  );
}

function isAccentMarkerObject(o: CanvasInventoryObject): boolean {
  if (o.section === "header" || o.system || o.left == null) return false;
  if (
    !String(o.type ?? "")
      .toLowerCase()
      .includes("rect")
  ) {
    return false;
  }
  if (o.role === "section-marker" || o.role === "section-heading-accent") {
    return true;
  }
  return (o.width ?? 99) <= 12 && (o.height ?? 0) >= 8;
}

function markerHeadingVerticallyOverlap(
  marker: CanvasInventoryObject,
  heading: CanvasInventoryObject,
): boolean {
  if (marker.top == null || heading.top == null) return false;
  const mBot = marker.top + (marker.height ?? 0);
  const hBot = heading.top + (heading.height ?? 0);
  return Math.min(mBot, hBot) - Math.max(marker.top, heading.top) >= 0.5;
}

function leftSpread(objs: CanvasInventoryObject[]): number | null {
  const lefts = objs
    .map((o) => o.left)
    .filter((x): x is number => x != null);
  if (lefts.length === 0) return null;
  if (lefts.length === 1) return 0;
  return Math.max(...lefts) - Math.min(...lefts);
}

/**
 * Number of distinct lanes spanned by the sections the Founder explicitly named.
 *
 * Lets one deterministic rule separate a lane-scoped request ("align the sidebar
 * section headings Skills, Projects, Certifications and Languages") from a
 * genuinely page-wide one ("align the left edges of the name, summary heading,
 * experience heading, and skills heading"). Anti-global wording names no
 * sections and therefore stays lane-scoped.
 */
function founderNamedLaneSpan(n: string, afterCanvas: FabricCanvasDoc): number {
  const lanes = detectLayoutLanesFromCanvas(afterCanvas);
  const spanned = new Set<string>();
  for (const [section, laneId] of Object.entries(lanes.section_to_lane)) {
    if (new RegExp(`\\b${escapeRegExp(section)}\\b`).test(n)) {
      spanned.add(laneId);
    }
  }
  return spanned.size;
}

/**
 * Left-spread proof for an explicit multi-object alignment cohort.
 *
 * Lane-aware: in a multi-lane layout each lane is measured independently, so a
 * sidebar anchor is never compared against a main-column anchor. Different
 * anchors BETWEEN lanes are expected and valid; only within-lane deviation
 * fails. Single-lane layouts keep the original global behavior.
 *
 * `crossLane` is for cohorts the Founder explicitly asked to compare across the
 * whole page (e.g. header name + section headings), where lane partitioning
 * would contradict the request.
 */
function evaluateCohortLeftSpread(
  cohort: CanvasInventoryObject[],
  cohortLabel: string,
  afterCanvas: FabricCanvasDoc,
  opts: { crossLane: boolean },
): StructuralHintResult {
  if (cohort.length < 2) {
    return {
      status: "partially_addressed",
      notes: "explicit multi-object alignment requested; structural proof unavailable",
      ids: cohort.map((o) => o.id),
    };
  }
  const ids = cohort.slice(0, 8).map((o) => o.id);

  const gradeGlobal = (): StructuralHintResult => {
    const lefts = cohort
      .map((o) => o.left)
      .filter((x): x is number => x != null);
    const minLeft = Math.min(...lefts);
    const maxSpread = Number((Math.max(...lefts) - minLeft).toFixed(2));
    if (maxSpread <= ALIGNMENT_SPREAD_TOLERANCE_PX) {
      return {
        status: "addressed",
        notes: `${cohortLabel} left-aligned minLeft=${minLeft}; maxSpread=${maxSpread}`,
        ids,
      };
    }
    if (maxSpread <= 12) {
      return {
        status: "partially_addressed",
        notes: `improved alignment maxSpread=${maxSpread} cohort=${cohortLabel}`,
        ids,
      };
    }
    return {
      status: "partially_addressed",
      notes: `alignment spread exceeds tolerance maxSpread=${maxSpread} cohort=${cohortLabel}`,
      ids,
    };
  };

  if (opts.crossLane) return gradeGlobal();

  const lanes = detectLayoutLanesFromCanvas(afterCanvas);
  if (lanes.lane_count < 2) return gradeGlobal();

  const byLane = new Map<string, CanvasInventoryObject[]>();
  const unassigned: CanvasInventoryObject[] = [];
  for (const o of cohort) {
    const lane =
      lanes.object_id_to_lane[o.id] ??
      (o.section != null ? lanes.section_to_lane[o.section] : undefined);
    if (lane == null) {
      unassigned.push(o);
      continue;
    }
    const list = byLane.get(lane) ?? [];
    list.push(o);
    byLane.set(lane, list);
  }

  // Fail closed when lane assignment is genuinely unavailable.
  if (unassigned.length > 0) {
    return {
      status: "partially_addressed",
      notes: `lane assignment unavailable for ${unassigned.length} cohort object(s) [${unassigned
        .slice(0, 4)
        .map((o) => o.id)
        .join(",")}]; cohort=${cohortLabel}`,
      ids,
    };
  }

  const laneNotes: string[] = [];
  const measuredSpreads: number[] = [];
  for (const [laneId, objs] of [...byLane.entries()].sort()) {
    if (objs.length < 2) {
      laneNotes.push(`${laneId}: 1 object (no within-lane comparison)`);
      continue;
    }
    const spread = leftSpread(objs);
    if (spread == null) {
      return {
        status: "partially_addressed",
        notes: `${laneId}: left spread unevaluable; cohort=${cohortLabel}`,
        ids,
      };
    }
    measuredSpreads.push(spread);
    laneNotes.push(
      `${laneId}: n=${objs.length} minLeft=${Math.min(
        ...objs.map((o) => o.left!),
      )} maxSpread=${spread}`,
    );
  }

  const detail = `per-lane cohort=${cohortLabel} ${laneNotes.join("; ")}`;
  if (measuredSpreads.length === 0) {
    return {
      status: "partially_addressed",
      notes: `${detail}; no lane has ≥2 comparable objects`,
      ids,
    };
  }
  const worst = Math.max(...measuredSpreads);
  if (worst <= ALIGNMENT_SPREAD_TOLERANCE_PX) {
    return { status: "addressed", notes: `${detail} — every lane aligned`, ids };
  }
  if (worst <= 12) {
    return {
      status: "partially_addressed",
      notes: `improved alignment maxSpread=${worst} ${detail}`,
      ids,
    };
  }
  return {
    status: "partially_addressed",
    notes: `alignment spread exceeds tolerance maxSpread=${worst} ${detail}`,
    ids,
  };
}

function evaluatePassiveConsistentAlignment(
  n: string,
  afterCanvas: FabricCanvasDoc,
  afterInv: CanvasInventoryObject[],
): StructuralHintResult {
  const mentionMarkers = /\baccent\s+markers?\b/.test(n);
  const headings = sectionHeadingTexts(afterInv);
  const markers = afterInv.filter(isAccentMarkerObject);

  if (headings.length === 0) {
    return {
      status: "partially_addressed",
      notes:
        "passive alignment proof unevaluable: no resolvable section heading geometry",
      ids: [],
    };
  }
  if (mentionMarkers && markers.length === 0) {
    return {
      status: "partially_addressed",
      notes:
        "passive alignment proof unevaluable: accent markers requested but not found",
      ids: headings.slice(0, 8).map((o) => o.id),
    };
  }

  const laneDetection = detectLayoutLanesFromCanvas(afterCanvas);
  const ids: string[] = [];
  const laneNotes: string[] = [];
  let allPass = true;

  for (const lane of laneDetection.lanes) {
    const sections = new Set(lane.section_order);
    const laneHeadings = headings.filter(
      (o) => o.section != null && sections.has(o.section),
    );
    const laneMarkers = markers.filter(
      (o) => o.section != null && sections.has(o.section),
    );

    if (laneHeadings.length === 0) {
      laneNotes.push(`${lane.lane_id}: no headings (skipped)`);
      continue;
    }

    const headingSpread = leftSpread(laneHeadings);
    if (headingSpread == null) {
      allPass = false;
      laneNotes.push(`${lane.lane_id}: heading spread unevaluable`);
      continue;
    }

    ids.push(...laneHeadings.slice(0, 6).map((o) => o.id));
    const headingsPass = headingSpread <= ALIGNMENT_SPREAD_TOLERANCE_PX;
    if (!headingsPass) allPass = false;

    let markersPass = true;
    let markerSpread: number | null = null;
    if (mentionMarkers) {
      if (laneMarkers.length === 0) {
        allPass = false;
        markersPass = false;
        laneNotes.push(`${lane.lane_id}: markers missing`);
        continue;
      }
      markerSpread = leftSpread(laneMarkers);
      if (markerSpread == null) {
        allPass = false;
        markersPass = false;
        laneNotes.push(`${lane.lane_id}: marker spread unevaluable`);
        continue;
      }
      ids.push(...laneMarkers.slice(0, 6).map((o) => o.id));
      markersPass = markerSpread <= ALIGNMENT_SPREAD_TOLERANCE_PX;
      if (!markersPass) allPass = false;
    }

    laneNotes.push(
      `${lane.lane_id}: headingSpread=${headingSpread}${mentionMarkers ? ` markerSpread=${markerSpread}` : ""} headingsPass=${headingsPass}${mentionMarkers ? ` markersPass=${markersPass}` : ""}`,
    );
  }

  const notes = `passive per-lane alignment ${laneNotes.join("; ")}`;
  if (allPass) {
    return { status: "addressed", notes, ids: [...new Set(ids)] };
  }
  return {
    status: "partially_addressed",
    notes: `${notes}; exceeds tolerance ${ALIGNMENT_SPREAD_TOLERANCE_PX}px`,
    ids: [...new Set(ids)],
  };
}

/**
 * One measurable section unit: accent marker + heading + associated content,
 * resolved from final canvas geometry and the authoritative lane detection.
 * Never inferred from operations.
 */
type SectionUnit = {
  section: string;
  lane_id: string | null;
  marker: CanvasInventoryObject | null;
  heading: CanvasInventoryObject | null;
  content: CanvasInventoryObject[];
  band_top: number | null;
  heading_bottom: number | null;
  first_content_top: number | null;
  last_content_bottom: number | null;
  section_bottom: number | null;
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function unitHeadingContentGap(u: SectionUnit): number | null {
  if (u.heading_bottom == null || u.first_content_top == null) return null;
  return Number((u.first_content_top - u.heading_bottom).toFixed(2));
}

/**
 * Build section units for every non-header section with resolvable geometry.
 * Lane identity comes from detectLayoutLanesFromCanvas (authoritative).
 */
function buildSectionUnits(
  afterCanvas: FabricCanvasDoc,
  afterInv: CanvasInventoryObject[],
): { units: SectionUnit[]; lane_count: number } {
  const lanes = detectLayoutLanesFromCanvas(afterCanvas);
  const headings = sectionHeadingTexts(afterInv);
  const bySection = new Map<string, CanvasInventoryObject[]>();
  for (const o of afterInv) {
    if (o.system) continue;
    if (o.section == null || o.section === "header") continue;
    const list = bySection.get(o.section) ?? [];
    list.push(o);
    bySection.set(o.section, list);
  }

  const units: SectionUnit[] = [];
  for (const [section, objs] of bySection) {
    const heading = headings.find((h) => h.section === section) ?? null;
    const marker = objs.find((o) => isAccentMarkerObject(o)) ?? null;
    const content = objs
      .filter(
        (o) =>
          o.text != null &&
          o.top != null &&
          o.id !== heading?.id &&
          o.role !== "section-heading",
      )
      .sort((a, b) => (a.top ?? 0) - (b.top ?? 0));

    const headingBottom =
      heading != null
        ? inventoryObjectEffectiveBottom(afterCanvas, heading)
        : null;
    const bandTops = [heading?.top, marker?.top].filter(
      (x): x is number => x != null,
    );
    const contentBottoms = content
      .map((o) => inventoryObjectEffectiveBottom(afterCanvas, o))
      .filter((x): x is number => x != null);
    const lastContentBottom =
      contentBottoms.length > 0 ? Math.max(...contentBottoms) : null;
    const sectionBottomCandidates = [lastContentBottom, headingBottom].filter(
      (x): x is number => x != null,
    );

    units.push({
      section,
      lane_id: lanes.section_to_lane[section] ?? null,
      marker,
      heading,
      content,
      band_top: bandTops.length > 0 ? Math.min(...bandTops) : null,
      heading_bottom: headingBottom,
      first_content_top: content[0]?.top ?? null,
      last_content_bottom: lastContentBottom,
      section_bottom:
        sectionBottomCandidates.length > 0
          ? Math.max(...sectionBottomCandidates)
          : null,
    });
  }

  units.sort((a, b) => (a.band_top ?? 0) - (b.band_top ?? 0));
  return { units, lane_count: lanes.lane_count };
}

/**
 * Sections the Founder actually named; falls back to every measurable section
 * for "each/all/every section" phrasing. Never hardcodes template ids.
 */
function requestedSectionNames(n: string, units: SectionUnit[]): string[] {
  const named = units
    .map((u) => u.section)
    .filter((s) => new RegExp(`\\b${escapeRegExp(s)}\\b`).test(n));
  if (named.length > 0) return named;
  if (/\b(each|all|every|both|four)\b[\s\S]{0,24}\bsections?\b/.test(n)) {
    return units.map((u) => u.section);
  }
  if (/\bsections?\b/.test(n)) return units.map((u) => u.section);
  return [];
}

/** Consecutive same-lane section transitions, ordered top→bottom. */
function laneTransitions(
  units: SectionUnit[],
): { prev: SectionUnit; next: SectionUnit; gap: number | null }[] {
  const byLane = new Map<string, SectionUnit[]>();
  for (const u of units) {
    const key = u.lane_id ?? "lane-unassigned";
    const list = byLane.get(key) ?? [];
    list.push(u);
    byLane.set(key, list);
  }
  const out: { prev: SectionUnit; next: SectionUnit; gap: number | null }[] = [];
  for (const list of byLane.values()) {
    const ordered = [...list].sort((a, b) => (a.band_top ?? 0) - (b.band_top ?? 0));
    for (let i = 1; i < ordered.length; i++) {
      const prev = ordered[i - 1]!;
      const next = ordered[i]!;
      const gap =
        prev.section_bottom != null && next.band_top != null
          ? Number((next.band_top - prev.section_bottom).toFixed(2))
          : null;
      out.push({ prev, next, gap });
    }
  }
  return out;
}

/**
 * Generalized section-system rhythm proof (architecture-general successor to the
 * Education-only metric). Evaluates FINAL geometry only:
 * containment, no intrusion, minimum section gap, and — only when the Founder
 * explicitly demands sameness — equality of the compared relationships.
 */
function evaluateSectionSystemRhythm(
  n: string,
  afterCanvas: FabricCanvasDoc,
  afterInv: CanvasInventoryObject[],
): StructuralHintResult {
  const { units } = buildSectionUnits(afterCanvas, afterInv);
  const requested = new Set(requestedSectionNames(n, units));
  const scoped = units.filter((u) => requested.has(u.section));

  if (scoped.length === 0) {
    return {
      status: "partially_addressed",
      notes:
        "section system proof unevaluable: no requested section resolved in final geometry",
      ids: [],
    };
  }

  const ids: string[] = [];
  for (const u of scoped) {
    if (u.heading) ids.push(u.heading.id);
    if (u.marker) ids.push(u.marker.id);
    ids.push(...u.content.slice(0, 4).map((o) => o.id));
  }

  const failures: string[] = [];
  const metrics: string[] = [];

  // 1. Every requested section must be measurable (fail closed otherwise).
  for (const u of scoped) {
    if (!u.heading || u.heading.top == null || u.heading_bottom == null) {
      failures.push(`${u.section}: heading geometry unevaluable`);
      continue;
    }
    if (u.content.length === 0 || u.first_content_top == null) {
      failures.push(`${u.section}: no measurable content`);
      continue;
    }
    // 2. Content must sit below its own heading.
    const gap = unitHeadingContentGap(u);
    if (gap == null) {
      failures.push(`${u.section}: heading→content gap unevaluable`);
      continue;
    }
    if (gap < 0) {
      failures.push(
        `${u.section}: content above/overlapping own heading (gap=${gap})`,
      );
      continue;
    }
    if (gap + 1e-9 < MIN_HEADING_BODY_GAP_PX) {
      failures.push(
        `${u.section}: heading→content gap ${gap} < minimum ${MIN_HEADING_BODY_GAP_PX}`,
      );
    }
    metrics.push(`${u.section}: heading→content=${gap}`);
  }

  // 3. Section→next-section containment and minimum rhythm gap, per lane.
  const transitions = laneTransitions(units).filter(
    (t) => requested.has(t.prev.section) && requested.has(t.next.section),
  );
  const scopedGaps: number[] = [];
  for (const t of transitions) {
    if (t.gap == null) {
      failures.push(`${t.prev.section}→${t.next.section}: gap unevaluable`);
      continue;
    }
    if (t.gap < 0) {
      failures.push(
        `${t.prev.section}→${t.next.section}: section intrusion/overlap (gap=${t.gap})`,
      );
      continue;
    }
    if (t.gap + 1e-9 < MIN_SECTION_GAP_PX) {
      failures.push(
        `${t.prev.section}→${t.next.section}: gap ${t.gap} < minimum ${MIN_SECTION_GAP_PX}`,
      );
    }
    scopedGaps.push(t.gap);
    metrics.push(`${t.prev.section}→${t.next.section}=${t.gap}`);
  }

  // 4. "consistent … gap/rhythm between sections" → inter-section gaps equal.
  const wantsConsistentRhythm =
    /\b(consistent|same|uniform|equal)\b/.test(n) &&
    /\b(gap|rhythm|spacing)\b/.test(n);
  if (wantsConsistentRhythm && scopedGaps.length >= 2) {
    const spread = Number(
      (Math.max(...scopedGaps) - Math.min(...scopedGaps)).toFixed(2),
    );
    metrics.push(`section_gap_spread=${spread}`);
    if (spread > GAP_RELATION_NOISE_PX) {
      failures.push(
        `inconsistent section-to-section rhythm: gap spread ${spread} > ${GAP_RELATION_NOISE_PX}`,
      );
    }
  }

  // 5. Explicit sameness of the heading→content relationship across sections.
  //    Only when Founder demands the SAME relationship (not merely "consistent
  //    line spacing" inside one section).
  const wantsSameHeadingContent =
    /\b(same|identical|consistent)\b/.test(n) &&
    /heading[-\s]?to[-\s]?content|heading\s*→\s*content|heading\s+to\s+content/.test(
      n,
    );
  if (wantsSameHeadingContent && scoped.length >= 2) {
    const gaps = scoped
      .map((u) => unitHeadingContentGap(u))
      .filter((x): x is number => x != null);
    if (gaps.length >= 2) {
      const spread = Number(
        (Math.max(...gaps) - Math.min(...gaps)).toFixed(2),
      );
      metrics.push(`heading_content_gap_spread=${spread}`);
      if (spread > GAP_RELATION_NOISE_PX) {
        failures.push(
          `heading→content relationship not the same across requested sections: spread ${spread} > ${GAP_RELATION_NOISE_PX}`,
        );
      }
    }
  }

  // 6. "consistent line spacing" INSIDE a section → equal content whitespace
  //    (next.top − current.bottom), not raw top-to-top pitch.
  const wantsConsistentLineSpacing =
    /\bline\s+spacing\b/.test(n) && /\b(consistent|same|uniform|equal)\b/.test(n);
  if (wantsConsistentLineSpacing) {
    for (const u of scoped) {
      const lines = u.content
        .filter((o) => o.top != null)
        .sort((a, b) => (a.top ?? 0) - (b.top ?? 0));
      if (lines.length < 3) continue;
      const whitespaces: number[] = [];
      for (let i = 1; i < lines.length; i++) {
        const prev = lines[i - 1]!;
        const next = lines[i]!;
        const prevBottom = (prev.top ?? 0) + (prev.height ?? 0);
        whitespaces.push(Number(((next.top ?? 0) - prevBottom).toFixed(2)));
      }
      const spread = Number(
        (Math.max(...whitespaces) - Math.min(...whitespaces)).toFixed(2),
      );
      metrics.push(
        `${u.section}: line_whitespace=${whitespaces.join("/")} spread=${spread}`,
      );
      if (spread > GAP_RELATION_NOISE_PX) {
        failures.push(
          `${u.section}: inconsistent line spacing whitespace spread ${spread} > ${GAP_RELATION_NOISE_PX}`,
        );
      }
    }
  }

  const scopeNote = `sections=[${scoped.map((u) => u.section).join(",")}] ${metrics.join("; ")}`;
  if (failures.length === 0) {
    return {
      status: "addressed",
      notes: `section system rhythm proof pass: ${scopeNote}`,
      ids: [...new Set(ids)],
    };
  }
  return {
    status: "partially_addressed",
    notes: `section system rhythm proof incomplete: ${failures.join("; ")} | ${scopeNote}`,
    ids: [...new Set(ids)],
  };
}

/**
 * Section-unit grouping proof for "heading + accent marker + associated content
 * grouped as one unit with consistent internal spacing".
 *
 * Evaluated for EVERY requested section from final geometry. Successful (or
 * no-op) attributed operations are irrelevant here by construction.
 *
 * Scope decision: this item's wording asks each unit to be internally coherent.
 * Cross-section equality of the heading→content value is NOT asserted here —
 * that demand lives in the separate "same … heading-to-content relationship"
 * Founder item and is enforced by evaluateSectionSystemRhythm.
 */
function evaluateSectionUnitGrouping(
  n: string,
  afterCanvas: FabricCanvasDoc,
  afterInv: CanvasInventoryObject[],
): StructuralHintResult {
  const { units } = buildSectionUnits(afterCanvas, afterInv);
  const requested = new Set(requestedSectionNames(n, units));
  const scoped = units.filter((u) => requested.has(u.section));

  if (scoped.length === 0) {
    return {
      status: "partially_addressed",
      notes:
        "section-unit grouping proof unevaluable: no requested section resolved in final geometry",
      ids: [],
    };
  }

  const mentionsMarker = /\bmarkers?\b/.test(n);
  const ids: string[] = [];
  const failures: string[] = [];
  const metrics: string[] = [];

  for (const u of scoped) {
    if (u.heading) ids.push(u.heading.id);
    if (u.marker) ids.push(u.marker.id);
    ids.push(...u.content.slice(0, 4).map((o) => o.id));

    if (!u.heading || u.heading.top == null || u.heading_bottom == null) {
      failures.push(`${u.section}: heading geometry unevaluable`);
      continue;
    }
    // Marker must exist and belong to the same section when Founder names it.
    if (mentionsMarker) {
      if (!u.marker || u.marker.top == null) {
        failures.push(`${u.section}: accent marker missing or unevaluable`);
        continue;
      }
      if (u.marker.section !== u.heading.section) {
        failures.push(`${u.section}: marker/heading section mismatch`);
        continue;
      }
      // Marker must band with its own heading (vertical overlap). Sitting at
      // headingBottom+minGap as if it were first body is NOT grouped.
      if (!markerHeadingVerticallyOverlap(u.marker, u.heading)) {
        failures.push(
          `${u.section}: marker detached from heading band (marker=${u.marker.top}-${u.marker.top + (u.marker.height ?? 0)} heading=${u.heading.top}-${u.heading_bottom})`,
        );
        continue;
      }
      metrics.push(
        `${u.section}: marker_heading_offset=${Number((u.heading.top - u.marker.top).toFixed(2))}`,
      );
    }

    if (u.content.length === 0 || u.first_content_top == null) {
      failures.push(`${u.section}: no measurable associated content`);
      continue;
    }
    const gap = unitHeadingContentGap(u);
    if (gap == null) {
      failures.push(`${u.section}: heading→content gap unevaluable`);
      continue;
    }
    if (gap < 0) {
      failures.push(
        `${u.section}: content is not below its own heading (gap=${gap})`,
      );
      continue;
    }
    if (gap + 1e-9 < MIN_HEADING_BODY_GAP_PX) {
      failures.push(
        `${u.section}: heading→content gap ${gap} < minimum ${MIN_HEADING_BODY_GAP_PX}`,
      );
    }
    metrics.push(`${u.section}: heading→content=${gap}`);
  }

  // Unit must not spill into the next section of the same lane.
  for (const t of laneTransitions(units)) {
    if (!requested.has(t.prev.section)) continue;
    if (t.gap == null) {
      failures.push(`${t.prev.section}→${t.next.section}: gap unevaluable`);
      continue;
    }
    if (t.gap < 0) {
      failures.push(
        `${t.prev.section}→${t.next.section}: section intrusion (gap=${t.gap})`,
      );
      continue;
    }
    if (t.gap + 1e-9 < MIN_SECTION_GAP_PX) {
      failures.push(
        `${t.prev.section}→${t.next.section}: gap ${t.gap} < minimum ${MIN_SECTION_GAP_PX}`,
      );
    }
  }

  const scopeNote = `sections=[${scoped.map((u) => u.section).join(",")}] ${metrics.join("; ")}`;
  if (failures.length === 0) {
    return {
      status: "addressed",
      notes: `section-unit grouping proof pass: ${scopeNote}`,
      ids: [...new Set(ids)],
    };
  }
  return {
    status: "partially_addressed",
    notes: `section-unit grouping proof incomplete: ${failures.join("; ")} | ${scopeNote}`,
    ids: [...new Set(ids)],
  };
}

/**
 * Heading↔marker reference relationship proof.
 *
 * Derives the reference section's horizontal marker→heading offset and requires
 * the same relationship within each lane. Absolute anchors are NOT compared
 * across lanes — separate lane anchors are the Founder's explicit intent — and
 * when the item asks to preserve separate anchors, collapsed lane anchors fail.
 *
 * This is partly a preservation requirement: geometry that already satisfies the
 * relationship legitimately passes without any movement.
 */
function evaluateHeadingMarkerReferenceRelationship(
  n: string,
  beforeCanvas: FabricCanvasDoc,
  afterCanvas: FabricCanvasDoc,
  afterInv: CanvasInventoryObject[],
): StructuralHintResult {
  const { units, lane_count } = buildSectionUnits(afterCanvas, afterInv);
  const measurable = units.filter(
    (u) =>
      u.heading != null &&
      u.heading.left != null &&
      u.marker != null &&
      u.marker.left != null,
  );

  if (measurable.length < 2) {
    return {
      status: "partially_addressed",
      notes:
        "heading↔marker reference proof unevaluable: need ≥2 sections with resolvable heading and marker geometry",
      ids: measurable.map((u) => u.heading!.id),
    };
  }

  // Reference = section the Founder named, else topmost measurable section.
  const namedRef = measurable.find((u) =>
    new RegExp(`\\b${escapeRegExp(u.section)}\\b`).test(n),
  );
  const reference = namedRef ?? measurable[0]!;
  const refOffset = Number(
    (reference.heading!.left! - reference.marker!.left!).toFixed(2),
  );

  const ids: string[] = [];
  const failures: string[] = [];
  const metrics: string[] = [`reference=${reference.section} offset=${refOffset}`];

  for (const u of measurable) {
    ids.push(u.heading!.id, u.marker!.id);
    const offset = Number((u.heading!.left! - u.marker!.left!).toFixed(2));
    metrics.push(
      `${u.section}[${u.lane_id ?? "lane-unassigned"}]: offset=${offset}`,
    );
    if (Math.abs(offset - refOffset) > GAP_RELATION_NOISE_PX) {
      failures.push(
        `${u.section}: marker→heading offset ${offset} differs from reference ${refOffset}`,
      );
    }
    if (u.heading.top == null || u.marker.top == null || !markerHeadingVerticallyOverlap(u.marker, u.heading)) {
      failures.push(
        `${u.section}: marker Y relationship does not attach to heading (marker.top=${u.marker.top} heading.top=${u.heading.top})`,
      );
    }
  }

  // "preserving the separate horizontal anchors" — lanes must stay distinct.
  // This is a preservation claim, so it is measured against the prior canvas:
  // collapsing one lane onto another MERGES the lanes, which is only visible
  // by comparing lane structure before vs after.
  const wantsSeparateAnchors =
    /\b(separate|distinct|independent|own)\b/.test(n) &&
    /\banchors?\b/.test(n);
  if (wantsSeparateAnchors) {
    const priorLaneCount = detectLayoutLanesFromCanvas(beforeCanvas).lane_count;
    metrics.push(`lane_count=${priorLaneCount}→${lane_count}`);
    if (priorLaneCount >= 2 && lane_count < priorLaneCount) {
      failures.push(
        `separate lane anchors were not preserved: lane count ${priorLaneCount}→${lane_count}`,
      );
    } else if (lane_count >= 2) {
      const laneAnchors = new Map<string, number>();
      for (const u of measurable) {
        const lane = u.lane_id;
        if (lane == null) continue;
        if (!laneAnchors.has(lane)) laneAnchors.set(lane, u.heading!.left!);
      }
      const anchors = [...laneAnchors.values()];
      metrics.push(`lane_anchors=[${anchors.join(",")}]`);
      if (anchors.length >= 2) {
        const collapsed =
          Math.max(...anchors) - Math.min(...anchors) <= GAP_RELATION_NOISE_PX;
        if (collapsed) {
          failures.push(
            "separate lane anchors were collapsed into one global anchor",
          );
        }
      }
    }
  }

  if (failures.length === 0) {
    return {
      status: "addressed",
      notes: `heading↔marker reference relationship preserved: ${metrics.join("; ")}`,
      ids: [...new Set(ids)],
    };
  }
  return {
    status: "partially_addressed",
    notes: `heading↔marker reference relationship not proven: ${failures.join("; ")} | ${metrics.join("; ")}`,
    ids: [...new Set(ids)],
  };
}

function evaluateMarkerHeadingVerticalAttachment(
  n: string,
  afterCanvas: FabricCanvasDoc,
  afterInv: CanvasInventoryObject[],
): StructuralHintResult {
  const { units } = buildSectionUnits(afterCanvas, afterInv);
  const requested = new Set(requestedSectionNames(n, units));
  const scoped =
    requested.size > 0 ? units.filter((u) => requested.has(u.section)) : units;
  const ids: string[] = [];
  const failures: string[] = [];
  const metrics: string[] = [];
  for (const u of scoped) {
    if (!u.heading || !u.marker) {
      failures.push(`${u.section}: heading or marker unevaluable`);
      continue;
    }
    ids.push(u.heading.id, u.marker.id);
    const attached = markerHeadingVerticallyOverlap(u.marker, u.heading);
    metrics.push(
      `${u.section}: marker.top=${u.marker.top} heading.top=${u.heading.top} overlap=${attached}`,
    );
    if (!attached) {
      failures.push(
        `${u.section}: marker not vertically attached to heading (marker.top=${u.marker.top} heading.top=${u.heading.top})`,
      );
    }
  }
  if (failures.length === 0) {
    return {
      status: "addressed",
      notes: `marker↔heading vertical attachment pass: ${metrics.join("; ")}`,
      ids: [...new Set(ids)],
    };
  }
  return {
    status: "partially_addressed",
    notes: `marker↔heading vertical attachment incomplete: ${failures.join("; ")} | ${metrics.join("; ")}`,
    ids: [...new Set(ids)],
  };
}

function evaluateSectionHierarchySpacing(
  n: string,
  beforeInv: CanvasInventoryObject[],
  afterInv: CanvasInventoryObject[],
  afterCanvas: FabricCanvasDoc,
): StructuralHintResult {
  // Education keeps its dedicated relational metric; every other section system
  // is proven by the architecture-general final-geometry rhythm evaluator.
  if (!/\beducation\b/.test(n)) {
    return evaluateSectionSystemRhythm(n, afterCanvas, afterInv);
  }
  const before = educationSectionObjects(beforeInv);
  const after = educationSectionObjects(afterInv);
  const ids = after.map((o) => o.id);
  if (after.length < 2) {
    return {
      status: "partially_addressed",
      notes: "education hierarchy proof unevaluable: need ≥2 education text objects",
      ids,
    };
  }
  if (before.length !== after.length) {
    return {
      status: "partially_addressed",
      notes: `education hierarchy proof unevaluable: object count ${before.length}→${after.length}`,
      ids,
    };
  }

  // Compare relationships along stable before-id order (not re-sort-by-top),
  // so identity inversion fails and uniform translation keeps gap vectors equal.
  const orderIds = before.map((o) => o.id);
  const afterById = new Map(after.map((o) => [o.id, o]));
  if (!orderIds.every((id) => afterById.has(id))) {
    return {
      status: "partially_addressed",
      notes: "education hierarchy proof unevaluable: object identity mismatch",
      ids,
    };
  }

  let ordered = true;
  for (let i = 1; i < orderIds.length; i++) {
    const prev = afterById.get(orderIds[i - 1]!)!;
    const next = afterById.get(orderIds[i]!)!;
    if ((next.top ?? 0) < (prev.top ?? 0) - 0.5) {
      ordered = false;
      break;
    }
  }
  if (!ordered) {
    return {
      status: "partially_addressed",
      notes: "education hierarchy proof failed: vertical ordering not preserved",
      ids,
    };
  }

  const afterInOrder = orderIds.map((id) => afterById.get(id)!);
  const bodyAfter = afterInOrder.filter(
    (o) =>
      !/^(0?\d\s+)?EDUCATION\b/i.test(String(o.text ?? "").trim()) &&
      o.role !== "section-heading",
  );
  const lefts = bodyAfter
    .map((o) => o.left)
    .filter((x): x is number => x != null);
  const leftSpread =
    lefts.length >= 2 ? Math.max(...lefts) - Math.min(...lefts) : 0;
  const aligned = leftSpread <= GAP_RELATION_NOISE_PX;

  const gapsBefore = topGapVector(before);
  const gapsAfter = topGapVector(afterInOrder);
  let maxGapDelta = 0;
  for (let i = 0; i < gapsAfter.length; i++) {
    maxGapDelta = Math.max(
      maxGapDelta,
      Math.abs(gapsAfter[i]! - (gapsBefore[i] ?? gapsAfter[i]!)),
    );
  }
  const viableGaps = gapsAfter.every((g) => g >= MIN_HEADING_BODY_GAP_PX);

  // Absolute translation of the whole section is NEVER sufficient — only gap
  // / relationship changes beyond measurement noise prove hierarchy/spacing work.
  if (maxGapDelta <= GAP_RELATION_NOISE_PX) {
    return {
      status: "partially_addressed",
      notes: `education hierarchy gaps unchanged (maxGapDelta=${maxGapDelta} ≤ noise ${GAP_RELATION_NOISE_PX}px); uniform translation alone is insufficient`,
      ids,
    };
  }

  if (ordered && aligned && viableGaps && maxGapDelta > GAP_RELATION_NOISE_PX) {
    return {
      status: "addressed",
      notes: `education hierarchy relational spacing improved maxGapDelta=${maxGapDelta} gapsAfter=[${gapsAfter.map((g) => Number(g.toFixed(2))).join(",")}] leftSpread=${leftSpread}`,
      ids,
    };
  }
  return {
    status: "partially_addressed",
    notes: `education hierarchy incomplete maxGapDelta=${maxGapDelta} ordered=${ordered} aligned=${aligned} viableGaps=${viableGaps} leftSpread=${leftSpread}`,
    ids,
  };
}

/**
 * CONTACT_IN_HEADER_BAND — final containment proof using HeaderIdentityLayout
 * member detection (pale-strip / margin tops / wrap-aware effective bottoms).
 * "Extend band OR rebalance content" succeeds when final containment holds.
 */
function evaluateContactInHeaderBandProof(
  beforeInv: CanvasInventoryObject[],
  afterInv: CanvasInventoryObject[],
  beforeCanvas: FabricCanvasDoc,
  afterCanvas: FabricCanvasDoc,
  ids: string[],
): StructuralHintResult {
  const members = resolveHeaderIdentityMembersFromCanvas(afterCanvas);
  if (!members) {
    return {
      status: "partially_addressed",
      notes:
        "CONTACT_IN_HEADER_BAND proof unevaluable: header identity members not detected",
      ids,
      relation: {
        type: "CONTACT_IN_HEADER_BAND",
        pass: false,
        notes: "members not detected",
      },
    };
  }

  const bandId = headerIdentityMemberId(
    members.background,
    members.background_index,
  );
  const contactId = headerIdentityMemberId(
    members.contact,
    members.contact_index,
  );
  const nameId = headerIdentityMemberId(members.name, members.name_index);

  const headerBand =
    afterInv.find((o) => o.id === bandId) ??
    ({
      id: bandId,
      type: String(members.background.type ?? "Rect"),
      top:
        typeof members.background.top === "number"
          ? members.background.top
          : null,
      height:
        typeof members.background.height === "number"
          ? members.background.height
          : null,
      width:
        typeof members.background.width === "number"
          ? members.background.width
          : null,
      role: String(
        (members.background.data as { role?: string } | undefined)?.role ??
          members.background.role ??
          "",
      ),
      section: "header",
      text: null,
      system: false,
    } as CanvasInventoryObject);

  const contact =
    afterInv.find((o) => o.id === contactId) ??
    findHeaderContact(afterInv) ??
    null;
  const name = afterInv.find((o) => o.id === nameId) ?? findHeaderName(afterInv);

  if (!contact || headerBand.top == null) {
    return {
      status: "partially_addressed",
      notes:
        "CONTACT_IN_HEADER_BAND proof unevaluable: contact or header band geometry missing",
      ids: [bandId, contactId, nameId].filter(Boolean),
      relation: {
        type: "CONTACT_IN_HEADER_BAND",
        contact_id: contactId,
        summary_id: null,
        pass: false,
        notes: "unevaluable geometry",
      },
    };
  }

  const bandTop = headerBand.top;
  const bandBottomRaw =
    inventoryObjectEffectiveBottom(afterCanvas, headerBand) ??
    (headerBand.height != null ? bandTop + headerBand.height : null);
  const contactBottom = inventoryObjectEffectiveBottom(afterCanvas, contact);
  const contactTop = contact.top;

  ids.push(bandId, contactId);
  if (name) ids.push(nameId);

  if (bandBottomRaw == null || contactBottom == null || contactTop == null) {
    return {
      status: "partially_addressed",
      notes: "CONTACT_IN_HEADER_BAND proof unevaluable: missing bottoms",
      ids,
      relation: {
        type: "CONTACT_IN_HEADER_BAND",
        contact_id: contactId,
        summary_id: null,
        pass: false,
        notes: "unevaluable bottoms",
      },
    };
  }

  const bandBottom = Number(bandBottomRaw.toFixed(2));
  const bottomPad = Number((bandBottom - contactBottom).toFixed(2));
  let nameContactGap: number | null = null;
  let nameGapOk = true;
  if (name) {
    const nameBottom = inventoryObjectEffectiveBottom(afterCanvas, name);
    if (nameBottom != null) {
      nameContactGap = Number((contactTop - nameBottom).toFixed(2));
      nameGapOk = nameContactGap + 1e-9 >= HEADER_IDENTITY_PAD_PX - 0.5;
    }
  }

  // Optional Summary clearance when a Summary heading/label exists below the band.
  const summaryHeading = findSummaryHeading(afterInv);
  let summaryClearance: number | null = null;
  let summaryClearanceOk = true;
  if (summaryHeading?.top != null) {
    summaryClearance = Number((summaryHeading.top - bandBottom).toFixed(2));
    summaryClearanceOk =
      summaryClearance + 1e-9 >= HEADER_TO_SUMMARY_CLEARANCE_PX - 0.5;
  }

  const bandContained =
    contactTop + 1e-9 >= bandTop - 0.5 &&
    contactBottom <= bandBottom - HEADER_IDENTITY_PAD_PX + 0.5;
  const contained = bandContained && nameGapOk && summaryClearanceOk;

  const beforeBand = beforeInv.find((o) => o.id === bandId);
  const beforeContact = beforeInv.find((o) => o.id === contactId);
  const beforeMembers = resolveHeaderIdentityMembersFromCanvas(beforeCanvas);
  const beforeBandBottom =
    beforeBand && beforeBand.top != null && beforeBand.height != null
      ? beforeBand.top + beforeBand.height
      : beforeMembers
        ? (Number(beforeMembers.background.top ?? 0) || 0) +
          (Number(beforeMembers.background.height ?? 0) || 0)
        : null;
  const beforeContactBottom = beforeContact
    ? inventoryObjectEffectiveBottom(beforeCanvas, beforeContact)
    : null;
  const grew =
    beforeBand?.height != null &&
    headerBand.height != null &&
    headerBand.height > beforeBand.height + 0.5;
  const rebalanced =
    beforeContact?.top != null &&
    contactTop != null &&
    Math.abs(contactTop - beforeContact.top) > 0.5;

  const relation: FeedbackRelationEvidence = {
    type: "CONTACT_IN_HEADER_BAND",
    contact_id: contactId,
    summary_id: summaryHeading?.id ?? null,
    pass: contained,
    notes: `contained=${contained} bottom_pad=${bottomPad} required_pad=${HEADER_IDENTITY_PAD_PX} name_gap=${nameContactGap} summary_clearance=${summaryClearance} grew=${Boolean(grew)} rebalanced=${Boolean(rebalanced)} band=${bandTop}→${bandBottom} contact_bottom=${contactBottom}`,
  };

  if (contained) {
    return {
      status: "addressed",
      notes: `CONTACT_IN_HEADER_BAND pass: contact effective_bottom=${contactBottom} within band bottom=${bandBottom} (pad=${bottomPad}≥${HEADER_IDENTITY_PAD_PX}); name_gap=${nameContactGap}; summary_clearance=${summaryClearance}; band height ${beforeBand?.height ?? "?"}→${headerBand.height}; branch=${grew ? "extend" : rebalanced ? "rebalance" : "contained"}`,
      ids,
      relation,
    };
  }

  const beforeOutside =
    beforeContactBottom != null &&
    beforeBandBottom != null &&
    beforeContactBottom > beforeBandBottom - HEADER_IDENTITY_PAD_PX + 0.5;

  return {
    status: "partially_addressed",
    notes: `CONTACT_IN_HEADER_BAND unmet: bottom_pad=${bottomPad} (need ≥${HEADER_IDENTITY_PAD_PX}); name_gap=${nameContactGap}; summary_clearance=${summaryClearance}; before_outside=${Boolean(beforeOutside)} grew=${Boolean(grew)} rebalanced=${Boolean(rebalanced)}`,
    ids,
    relation: { ...relation, pass: false },
  };
}

function structuralHints(
  item: string,
  before: FabricCanvasDoc,
  after: FabricCanvasDoc,
  okOps: OperationLogEntry[] = [],
): StructuralHintResult {
  const n = normalize(item);
  const beforeInv = buildCanvasInventory(before);
  const afterInv = buildCanvasInventory(after);
  const ids: string[] = [];

  // Sidebar page-edge + preserve right boundary — final canvas geometry.
  if (isSidebarEdgeExtensionRequest(n)) {
    return evaluateSidebarEdgeExtension(beforeInv, afterInv, okOps);
  }

  // Broad composition / column balance — never certify from ops alone.
  if (isBroadVisualBalanceRequest(n)) {
    return {
      status: "partially_addressed",
      notes:
        "broad visual-balance / column composition requires stronger structural evidence than attributed micro-operations",
      ids: okOps.map((o) => o.target_id).filter((x): x is string => Boolean(x)),
    };
  }

  // Summary→Experience section gap — deterministic prior vs final geometry.
  if (isSummaryToExperienceGapRequest(n)) {
    return evaluateSummaryToExperienceGap(beforeInv, afterInv);
  }

  // Section hierarchy/spacing (Education + general section systems).
  if (isSectionHierarchySpacingRequest(n)) {
    return evaluateSectionHierarchySpacing(n, beforeInv, afterInv, after);
  }

  // Section-unit grouping (heading + marker + content as one unit) —
  // deterministic final geometry for every requested section.
  if (isSectionUnitGroupingRequest(n)) {
    return evaluateSectionUnitGrouping(n, after, afterInv);
  }

  // Heading↔marker reference relationship, preserved per lane.
  if (isHeadingMarkerReferenceRequest(n)) {
    return evaluateHeadingMarkerReferenceRelationship(
      n,
      before,
      after,
      afterInv,
    );
  }

  // Passive preservation/consistency alignment — per-lane final geometry.
  if (isPassiveConsistentAlignmentRequest(n)) {
    return evaluatePassiveConsistentAlignment(n, after, afterInv);
  }

  // CONTACT_TO_SUMMARY_GAP — compact contact group + gap before Summary
  if (isContactToSummaryGapRequest(n)) {
    const contact = findHeaderContact(afterInv);
    const summaryHeading = findSummaryHeading(afterInv);
    const name = findHeaderName(afterInv);
    if (!contact || !summaryHeading) {
      return {
        status: "partially_addressed",
        notes:
          "CONTACT_TO_SUMMARY_GAP proof unevaluable: contact or Summary heading not found",
        ids,
        relation: {
          type: "CONTACT_TO_SUMMARY_GAP",
          contact_id: contact?.id ?? null,
          summary_id: summaryHeading?.id ?? null,
          gap_px: null,
          minimum_gap_px: MIN_SECTION_GAP_PX,
          pass: false,
          notes: "unevaluable",
        },
      };
    }
    const contactBottom = invBottom(contact);
    const summaryTop = summaryHeading.top;
    if (contactBottom == null || summaryTop == null) {
      return {
        status: "partially_addressed",
        notes: "CONTACT_TO_SUMMARY_GAP proof unevaluable: missing geometry",
        ids: [contact.id, summaryHeading.id],
        relation: {
          type: "CONTACT_TO_SUMMARY_GAP",
          contact_id: contact.id,
          summary_id: summaryHeading.id,
          gap_px: null,
          minimum_gap_px: MIN_SECTION_GAP_PX,
          pass: false,
          notes: "unevaluable geometry",
        },
      };
    }
    const gap = summaryTop - contactBottom;
    ids.push(contact.id, summaryHeading.id);
    let nameContactGap: number | null = null;
    if (name && name.top != null && name.height != null && contact.top != null) {
      nameContactGap = Number(
        (contact.top - (name.top + name.height)).toFixed(2),
      );
      ids.push(name.id);
    }
    const relation: FeedbackRelationEvidence = {
      type: "CONTACT_TO_SUMMARY_GAP",
      contact_id: contact.id,
      summary_id: summaryHeading.id,
      gap_px: Number(gap.toFixed(2)),
      minimum_gap_px: MIN_SECTION_GAP_PX,
      name_contact_gap_px: nameContactGap,
      pass: gap + 1e-9 >= MIN_SECTION_GAP_PX && gap >= 0,
    };
    if (gap < 0) {
      return {
        status: "partially_addressed",
        notes: `CONTACT_TO_SUMMARY_GAP overlap: contact_bottom=${contactBottom} summary_top=${summaryTop}`,
        ids,
        relation: { ...relation, pass: false },
      };
    }
    if (gap + 1e-9 >= MIN_SECTION_GAP_PX) {
      return {
        status: "addressed",
        notes: `CONTACT_TO_SUMMARY_GAP pass: gap_px=${gap.toFixed(2)} >= minimum_gap_px=${MIN_SECTION_GAP_PX}`,
        ids,
        relation,
      };
    }
    return {
      status: "partially_addressed",
      notes: `contact→Summary gap ${gap.toFixed(2)}px < required ${MIN_SECTION_GAP_PX}px`,
      ids,
      relation: { ...relation, pass: false },
    };
  }

  // Header band extension / contact inside banner.
  // Reuse HeaderIdentityLayout member detection (pale-strip, margin tops, etc.).
  // Final containment state is authoritative — extend OR rebalance both OK.
  if (isContactBandExtensionRequest(n)) {
    return evaluateContactInHeaderBandProof(
      beforeInv,
      afterInv,
      before,
      after,
      ids,
    );
  }

  // Horizontal alignment spread — ONLY for explicit multi-object LEFT alignment.
  // Never use header/name left as the reference for body/content-grid requests.
  if (isExplicitMultiObjectAlignmentRequest(n)) {
    // Include header/name only when Founder explicitly names them as alignment targets.
    const mentionsHeaderOrName =
      (/\bname\b/.test(n) && /\bheading\b/.test(n)) ||
      (/\b(name|contact)\b/.test(n) && /left/.test(n) && !/content\s+grid/.test(n));

    const wantsHeadingGrid =
      /section\s+heading/.test(n) ||
      /heading\s+rectangles?/.test(n) ||
      (/\bheading\b/.test(n) && /left/.test(n));
    const wantsBodyGrid =
      /content\s+grid/.test(n) ||
      (/body\b/.test(n) && /align|left|grid/.test(n)) ||
      /body content/.test(n);

    // Shared detector: keeps PROJECTS (and every other section heading) in the
    // cohort instead of silently dropping it.
    const headingTexts = sectionHeadingTexts(afterInv);
    const headingRects = afterInv.filter(
      (o) =>
        o.left != null &&
        o.section !== "header" &&
        !o.system &&
        !o.text &&
        String(o.type ?? "")
          .toLowerCase()
          .includes("rect") &&
        (o.role === "section-heading" ||
          headingTexts.some((h) => h.section === o.section)),
    );
    const bodyTexts = afterInv.filter(
      (o) =>
        o.left != null &&
        o.text &&
        o.section !== "header" &&
        !o.system &&
        (o.role == null || o.role === "content") &&
        !/^(0?\d\s+)?(SUMMARY|EXPERIENCE|EDUCATION|SKILLS|CERTIFICATIONS|LANGUAGES)\b/i.test(
          String(o.text).trim(),
        ) &&
        o.role !== "section-heading" &&
        !/\bheading\b/i.test(String(o.text)),
    );
    const headerNameTexts = afterInv.filter(
      (o) => o.section === "header" && o.left != null && o.text,
    );

    // Choose comparison cohort by Founder intent.
    // Never default to comparing header/name left against body content grid.
    let cohort = headingTexts;
    let cohortLabel = "section_heading_text";
    if (wantsHeadingGrid && headingRects.length >= 2 && /rectangle/.test(n)) {
      cohort = headingRects;
      cohortLabel = "section_heading_rect";
    } else if (wantsBodyGrid && bodyTexts.length >= 2 && !/\bheading\b/.test(n)) {
      cohort = bodyTexts;
      cohortLabel = "body_content";
    } else if (
      mentionsHeaderOrName &&
      headerNameTexts.length >= 1 &&
      headingTexts.length >= 1
    ) {
      cohort = [...headerNameTexts, ...headingTexts];
      cohortLabel = "name_and_section_headings";
    } else if (headingTexts.length >= 2) {
      cohort = headingTexts;
      cohortLabel = "section_heading_text";
    } else if (bodyTexts.length >= 2) {
      cohort = bodyTexts;
      cohortLabel = "body_content";
    } else {
      return {
        status: "partially_addressed",
        notes: "explicit multi-object alignment requested; structural proof unavailable",
        ids,
      };
    }

    // Grade globally only when the Founder genuinely asked across lanes:
    // header/name cohort, or explicitly named sections spanning ≥2 lanes.
    const crossLane =
      cohortLabel === "name_and_section_headings" ||
      founderNamedLaneSpan(n, after) >= 2;
    const leftResult = evaluateCohortLeftSpread(cohort, cohortLabel, after, {
      crossLane,
    });
    if (
      leftResult.status === "addressed" &&
      isMarkerHeadingRelativeAlignmentRequest(n)
    ) {
      const yResult = evaluateMarkerHeadingVerticalAttachment(n, after, afterInv);
      if (yResult.status !== "addressed") {
        return {
          status: "partially_addressed",
          notes: `${leftResult.notes}; ${yResult.notes}`,
          ids: [...new Set([...(leftResult.ids ?? []), ...(yResult.ids ?? [])])],
        };
      }
      return {
        status: "addressed",
        notes: `${leftResult.notes}; ${yResult.notes}`,
        ids: [...new Set([...(leftResult.ids ?? []), ...(yResult.ids ?? [])])],
      };
    }
    return leftResult;
  }

  // Accent line extension / lower content
  if (/accent|green|vertical line|extend/.test(n) && /down|bottom|lower|line/.test(n)) {
    const accents = afterInv.filter(
      (o) =>
        o.type.toLowerCase().includes("rect") &&
        (o.width ?? 99) <= 12 &&
        (o.height ?? 0) > 40 &&
        !o.system,
    );
    if (accents.length) {
      const a = accents.sort((x, y) => (y.height ?? 0) - (x.height ?? 0))[0]!;
      const beforeA = beforeInv.find((o) => o.id === a.id);
      ids.push(a.id);
      if (
        beforeA &&
        a.height != null &&
        beforeA.height != null &&
        a.height > beforeA.height + 20
      ) {
        return {
          status: "addressed",
          notes: `accent height ${beforeA.height}→${a.height}`,
          ids,
        };
      }
    }
  }

  if (/education|lower portion|meaningful content|balanced/.test(n)) {
    const eduAfter = afterInv.filter(
      (o) =>
        (o.section === "education" ||
          (o.text && /bachelor|master|university|b\.s\.|education/i.test(o.text))) &&
        o.text,
    );
    const eduBefore = beforeInv.filter(
      (o) =>
        (o.section === "education" ||
          (o.text && /bachelor|master|university|b\.s\.|education/i.test(o.text))) &&
        o.text,
    );
    ids.push(...eduAfter.map((o) => o.id));
    if (eduAfter.length > eduBefore.length) {
      return {
        status: "addressed",
        notes: `education objects ${eduBefore.length}→${eduAfter.length}`,
        ids,
      };
    }
    const afterLen = eduAfter.reduce((n, o) => n + (o.text?.length ?? 0), 0);
    const beforeLen = eduBefore.reduce((n, o) => n + (o.text?.length ?? 0), 0);
    if (afterLen > beforeLen + 40) {
      return {
        status: "addressed",
        notes: `education text length ${beforeLen}→${afterLen}`,
        ids,
      };
    }
  }

  return { status: null, notes: "", ids: [] };
}

function promoteSuccessfulOps(opts: {
  change: string;
  ops: OperationLogEntry[];
  okOps: OperationLogEntry[];
  hasFailedMatchingOp: boolean;
  plan: RevisionPlan;
}): { status: FeedbackCoverageStatus; notes: string } | null {
  const { change, ops, okOps, hasFailedMatchingOp, plan } = opts;
  if (
    ops.length === 0 ||
    okOps.length !== ops.length ||
    hasFailedMatchingOp ||
    !planCoversItem(change, plan)
  ) {
    return null;
  }
  const n = normalize(change);
  if (requiresStructuralProof(n)) {
    return {
      status: "partially_addressed",
      notes: `${okOps.length} operation(s) applied; structural proof required`,
    };
  }
  if (isBroadVisualBalanceRequest(n)) {
    return {
      status: "partially_addressed",
      notes: `${okOps.length} operation(s) applied; broad composition cannot be certified from operation success alone`,
    };
  }
  return {
    status: "addressed",
    notes: `${okOps.length} successful planned operation(s)`,
  };
}

/**
 * Final-canvas geometric proof for overlap / readability Founder items.
 * Prefers COLLISION_BOUNDS acceptance when present; otherwise runs the same
 * wrap-aware text-overlap detector used by acceptance.
 */
function evaluateOverlapReadabilityGeometricProof(
  afterCanvas: FabricCanvasDoc,
  acceptanceReport?: RevisionAcceptanceReport | null,
): { pass: boolean; notes: string } {
  const collisionChecks =
    acceptanceReport?.checks.filter((c) => c.check_type === "COLLISION_BOUNDS") ??
    [];
  if (collisionChecks.length > 0) {
    const pass = collisionChecks.every((c) => c.pass && c.evaluable);
    return {
      pass,
      notes: pass
        ? "COLLISION_BOUNDS acceptance geometric proof"
        : "COLLISION_BOUNDS acceptance failed — overlap/readability not proven",
    };
  }
  const findings = findTextOverlapFindings(afterCanvas);
  if (findings.length === 0) {
    return {
      pass: true,
      notes: "final canvas zero text-overlap geometric proof",
    };
  }
  return {
    pass: false,
    notes: `final canvas still has ${findings.length} text overlap finding(s)`,
  };
}

/**
 * Build Founder feedback coverage.
 *
 * Geometry-sensitive MUTATION items (sidebar edge extension, section hierarchy,
 * etc.) MUST be evaluated against `afterCanvas` — the final post-normalization
 * canvas — not operation-log snapshots alone. Pipeline already passes
 * normalized.canvas here; callers must not substitute pre-normalization canvas
 * when proving explicit geometry requirements.
 */
export function buildFeedbackCoverage(input: {
  requested_changes: string[];
  plan: RevisionPlan;
  log: OperationLogEntry[];
  beforeCanvas: FabricCanvasDoc;
  /** Final post-normalization canvas (authoritative for geometry proofs). */
  afterCanvas: FabricCanvasDoc;
  /** Deterministic post-mutation acceptance evidence for VERIFICATION_ACCEPTANCE items. */
  acceptanceReport?: RevisionAcceptanceReport | null;
}): FeedbackCoverageReport {
  const items: FeedbackCoverageItem[] = [];

  for (const change of input.requested_changes) {
    const classified = classifyRequestedChange(change);

    // Verification items: addressed ONLY by deterministic acceptance evidence.
    // Never infer success from mutation operations alone.
    if (classified.classification === "VERIFICATION_ACCEPTANCE") {
      const requiredTypes = verificationCheckTypes(classified);
      const checks = findAcceptanceChecksForChange(
        input.acceptanceReport,
        change,
      );
      const affected = new Set<string>();
      for (const check of checks) {
        for (const id of check.object_ids) affected.add(id);
        for (const f of check.findings) {
          for (const id of f.object_ids) affected.add(id);
        }
      }
      let pass = false;
      let notes: string;
      if (!input.acceptanceReport) {
        notes = "verification acceptance evidence missing (fail closed)";
      } else if (requiredTypes.length === 0) {
        notes = "verification acceptance check types missing for requested change";
      } else {
        const results = requiredTypes.map((ct) => {
          const match = checks.find((c) => c.check_type === ct);
          return { ct, check: match ?? null };
        });
        const missing = results.filter((r) => !r.check);
        const failed = results.filter(
          (r) => r.check && (!r.check.evaluable || !r.check.pass),
        );
        if (missing.length > 0) {
          notes = `verification acceptance check missing: ${missing.map((m) => m.ct).join(", ")}`;
        } else if (failed.length > 0) {
          notes = failed
            .map(
              (f) =>
                `${f.ct}: ${f.check!.evaluable ? f.check!.reason : "unevaluable"}`,
            )
            .join("; ");
        } else {
          notes = results.map((r) => `${r.ct}: ${r.check!.reason}`).join("; ");
          pass = true;
        }
      }
      items.push({
        founder_feedback_item: change,
        status: pass ? "addressed" : "not_addressed",
        evidence: {
          affected_object_ids: [...affected],
          notes,
        },
      });
      continue;
    }

    const ops = findOpsForItem(change, input.plan, input.log);
    const okOps = ops.filter((o) => o.ok);
    // afterCanvas is final normalized geometry for structural proofs.
    const structural = structuralHints(
      change,
      input.beforeCanvas,
      input.afterCanvas,
      okOps,
    );

    let status: FeedbackCoverageStatus = "not_addressed";
    let notes = "";
    const affected = new Set<string>();

    if (okOps.length > 0) {
      status = "partially_addressed";
      notes = `${okOps.length} operation(s) applied`;
      for (const o of okOps) {
        if (o.target_id) affected.add(o.target_id);
      }
    }
    // Any failed matching op keeps the item from full address unless structural proves it.
    const hasFailedMatchingOp = ops.some((o) => !o.ok);

    if (structural.status === "addressed") {
      status = "addressed";
      notes = structural.notes || notes;
      structural.ids.forEach((id) => affected.add(id));
    } else if (structural.status === "partially_addressed") {
      structural.ids.forEach((id) => affected.add(id));
      if (requiresStructuralProof(normalize(change))) {
        // Explicit structural request: keep fail-closed partial when proof is incomplete.
        if (status === "not_addressed") status = "partially_addressed";
        notes = [notes, structural.notes].filter(Boolean).join("; ");
      } else {
        // Defensive: incidental structural partial must not block op-based address.
        const promoted = promoteSuccessfulOps({
          change,
          ops,
          okOps,
          hasFailedMatchingOp,
          plan: input.plan,
        });
        if (promoted) {
          status = promoted.status;
          notes = promoted.notes;
        } else {
          if (status === "not_addressed") status = "partially_addressed";
          notes = [notes, structural.notes].filter(Boolean).join("; ");
        }
      }
    } else {
      // Structural heuristic N/A (null): successful planned ops → addressed
      // when multi-object structural proof is not required.
      const promoted = promoteSuccessfulOps({
        change,
        ops,
        okOps,
        hasFailedMatchingOp,
        plan: input.plan,
      });
      if (promoted) {
        status = promoted.status;
        notes = promoted.notes;
      }
    }

    // Overlap / readability / no-intrusion: never fully address from ops alone.
    // Elevate to addressed only when wrap-aware final geometry proves clean.
    if (requiresOverlapReadabilityGeometricProof(normalize(change))) {
      const geo = evaluateOverlapReadabilityGeometricProof(
        input.afterCanvas,
        input.acceptanceReport,
      );
      if (
        geo.pass &&
        okOps.length > 0 &&
        !hasFailedMatchingOp &&
        planCoversItem(change, input.plan)
      ) {
        status = "addressed";
        notes = [notes, geo.notes].filter(Boolean).join("; ");
      } else {
        if (status === "addressed") status = "partially_addressed";
        else if (status === "not_addressed" && okOps.length > 0) {
          status = "partially_addressed";
        }
        notes = [notes, geo.notes].filter(Boolean).join("; ");
      }
    }

    const operation_evidence: FeedbackOperationEvidence[] = okOps.map((o) => ({
      target_id: o.target_id ?? null,
      before: o.before ?? null,
      after: o.after ?? null,
    }));

    // Singular before/after only when every paired snapshot shares one object ID.
    let beforeSnap: Record<string, unknown> | undefined;
    let afterSnap: Record<string, unknown> | undefined;
    if (okOps.length === 1) {
      beforeSnap = okOps[0]?.before ?? undefined;
      afterSnap = okOps[0]?.after ?? undefined;
    } else if (okOps.length > 1) {
      const ids = okOps.map((o) => {
        const bid =
          o.before && typeof o.before.id === "string" ? o.before.id : null;
        const aid =
          o.after && typeof o.after.id === "string" ? o.after.id : null;
        return bid && aid && bid === aid ? bid : null;
      });
      const unique = new Set(ids.filter((id): id is string => !!id));
      if (unique.size === 1 && ids.every((id) => id != null)) {
        beforeSnap = okOps[0]?.before ?? undefined;
        afterSnap = okOps[okOps.length - 1]?.after ?? undefined;
      }
      // If IDs differ across ops, omit singular before/after (use operation_evidence).
    }

    items.push({
      founder_feedback_item: change,
      status,
      evidence: {
        affected_object_ids: [...affected],
        before: beforeSnap,
        after: afterSnap,
        operation_evidence:
          operation_evidence.length > 0 ? operation_evidence : undefined,
        relation: structural.relation,
        notes: notes || undefined,
      },
    });
  }

  // Strict gate: every Founder item must be fully addressed before re-queue.
  const strictPass =
    items.length > 0 && items.every((i) => i.status === "addressed");

  return {
    schema_version: "founder-feedback-coverage-1.0.0",
    all_addressed: strictPass,
    items,
    gate_pass: strictPass,
  };
}
