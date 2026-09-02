/**
 * OpenAI Founder revision planner prompt + plan schema validation.
 */
import type {
  CanvasInventoryObject,
  CanvasOpType,
  CanvasOperation,
  RevisionPlan,
  RevisionTask,
} from "./revision-task-types.js";
import { inventorySummary } from "./CanvasInventory.js";
import {
  ALLOWED_OPS,
  PLANNER_ALLOWED_OPS,
  isAllowedCanvasOp,
  isDeprecatedPlannerOp,
} from "./allowedCanvasOps.js";
import { classifyRequestedChange } from "./RequestedChangeClassification.js";
import {
  isDeterministicLayoutNormalizerOwnedChange,
  isValidationOnlyRequestedChange,
} from "./DeterministicSpacingPlan.js";
import {
  detectInternalPlanMutationConflicts,
  geomAxesPresent,
  targetIdsOf,
} from "./PlanMutationConflicts.js";
import type { PrimaryConflictReport } from "./ConflictPlanRepair.js";
import {
  operationInConflictScope,
  operationPreservationFingerprint,
} from "./ConflictPlanRepair.js";
import {
  selectFounderMemory,
  type FounderMemorySelectionResult,
} from "../founder-memory/FounderMemoryConsumption.js";
import {
  deriveRevisionMemoryContext,
  toSelectionContext,
} from "../founder-memory/FounderMemoryContext.js";
import { enrichFromCandidateArtifacts } from "../founder-memory/FounderPreferenceWriter.js";

/** Re-export canonical planner allowlist (single source: allowedCanvasOps.ts). */
export {
  ALLOWED_OPS,
  ALLOWED_OPS_ENUM,
  PLANNER_ALLOWED_OPS,
  LEGACY_EXECUTOR_SUPPORTED_OPS,
  DEPRECATED_PLANNER_OPS,
  isLegacyExecutorSupportedOp,
  isDeprecatedPlannerOp,
} from "./allowedCanvasOps.js";

/** Pseudo spacing/gap keys — never executable; never auto-converted. */
export const PSEUDO_SPACING_VALUE_KEYS = [
  "spacing",
  "gap",
  "gap_px",
  "vertical_spacing",
  "horizontal_spacing",
  "spacing_standardized",
  "vertical_spacing_standardized",
  "qa_pass_boundaries",
] as const;

/** Ops that must target multiple inventory objects via target_ids (≥2). */
export const MULTI_TARGET_OPS: ReadonlySet<CanvasOpType> = new Set([
  "align_objects",
  "group_objects",
]);

/**
 * Deny-by-default: every allowlisted op requires a non-empty inventory target_id
 * unless listed here. adjust_font_size / update_text / move_object / etc. are NOT exempt.
 * align_objects / group_objects are exempt from single target_id but MUST supply
 * target_ids with ≥2 inventory IDs (validated separately).
 */
export const TARGET_ID_EXEMPT_OPS: ReadonlySet<CanvasOpType> = new Set([
  "align_objects",
  "group_objects",
  "add_object",
]);

/** Validate multi-target inventory target_ids (fail closed; no normalization). */
export function validateMultiTargetIds(
  op: CanvasOpType,
  opIndex: number,
  opItem: Record<string, unknown>,
): string | null {
  const raw = opItem.target_ids;
  if (!Array.isArray(raw)) {
    return `operations[${opIndex}] ${op}: target_ids with at least 2 inventory object IDs required`;
  }
  if (raw.length < 2) {
    return `operations[${opIndex}] ${op}: target_ids must contain at least 2 non-empty strings`;
  }
  for (let j = 0; j < raw.length; j++) {
    const id = raw[j];
    if (typeof id !== "string" || id.trim().length === 0) {
      return `operations[${opIndex}] ${op}: target_ids must contain at least 2 non-empty strings`;
    }
  }
  return null;
}

export function operationRequiresInventoryTargetId(op: CanvasOpType): boolean {
  return !TARGET_ID_EXEMPT_OPS.has(op);
}

function hasNonEmptyTargetIdsArray(opItem: Record<string, unknown>): boolean {
  return (
    Array.isArray(opItem.target_ids) &&
    opItem.target_ids.length > 0 &&
    opItem.target_ids.some(
      (id) => typeof id === "string" && id.trim().length > 0,
    )
  );
}

function finiteNum(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function firstPseudoSpacingKey(
  values: Record<string, unknown>,
): string | null {
  for (const key of PSEUDO_SPACING_VALUE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(values, key)) return key;
  }
  return null;
}

/** Dimension keys the executor does not apply on set_position / move_object. */
const POSITION_ONLY_FORBIDDEN_DIM_KEYS = [
  "width",
  "height",
  "delta_width",
  "delta_height",
  "w",
  "h",
  "delta_w",
  "delta_h",
] as const;

function firstForbiddenPositionDimKey(
  values: Record<string, unknown>,
): string | null {
  for (const key of POSITION_ONLY_FORBIDDEN_DIM_KEYS) {
    if (
      Object.prototype.hasOwnProperty.call(values, key) &&
      values[key] != null
    ) {
      return key;
    }
  }
  return null;
}

/**
 * Fail closed: mutation ops must carry executor-actionable values.
 * Pseudo spacing/gap keys are rejected and NEVER rewritten to delta_top/top.
 * Semantic placeholder booleans (e.g. spacing_standardized) are insufficient.
 *
 * Note: adjust_spacing is deprecated for NEW plans (not in PLANNER_ALLOWED_OPS).
 * The position-field case below remains only for clarity; new plans never reach it.
 */
export function validateExecutableMutationValues(
  op: CanvasOpType,
  opIndex: number,
  values: Record<string, unknown>,
): string | null {
  const prefix = `operations[${opIndex}] ${op}`;
  const pseudo = firstPseudoSpacingKey(values);
  if (pseudo) {
    return `${prefix}: values.${pseudo} is not an executable geometry field; use left/top/delta_left/delta_top (never invent spacing/gap fields; no auto-conversion)`;
  }
  switch (op) {
    case "set_position":
    case "move_object":
      // Position-only contract: dimension keys (including shorthand aliases)
      // are not applied by the executor and must not be emitted.
      {
        const forbiddenDim = firstForbiddenPositionDimKey(values);
        if (forbiddenDim) {
          return `${prefix}: values.${forbiddenDim} is not applied by ${op} (position-only); use resize_object, set_dimensions, or extend_shape with canonical width/height/delta_width/delta_height (never w/h aliases on position ops)`;
        }
      }
      if (
        finiteNum(values.left) ||
        finiteNum(values.top) ||
        finiteNum(values.delta_left) ||
        finiteNum(values.delta_top)
      ) {
        return null;
      }
      return `${prefix}: values must include an executable position field (left, top, delta_left, or delta_top); semantic placeholder booleans are invalid`;
    case "resize_object":
    case "set_dimensions":
    case "extend_shape":
      if (
        finiteNum(values.width) ||
        finiteNum(values.height) ||
        finiteNum(values.delta_width) ||
        finiteNum(values.delta_height) ||
        finiteNum(values.left) ||
        finiteNum(values.top) ||
        finiteNum(values.delta_left) ||
        finiteNum(values.delta_top)
      ) {
        return null;
      }
      return `${prefix}: values must include an executable geometry field (width/height/left/top or deltas)`;
    case "update_text":
      if (typeof values.text === "string") return null;
      return `${prefix}: values.text string is required for update_text`;
    case "adjust_font_size":
      if (finiteNum(values.fontSize) || finiteNum(values.delta_fontSize)) {
        return null;
      }
      return `${prefix}: values must include fontSize or delta_fontSize`;
    case "adjust_line_height":
      if (finiteNum(values.lineHeight)) return null;
      return `${prefix}: values.lineHeight is required`;
    case "set_fill":
      if (typeof values.fill === "string" && values.fill.trim()) return null;
      return `${prefix}: values.fill string is required`;
    case "set_stroke":
      if (
        (typeof values.stroke === "string" && values.stroke.trim()) ||
        finiteNum(values.strokeWidth)
      ) {
        return null;
      }
      return `${prefix}: values must include stroke and/or strokeWidth`;
    case "align_objects":
      if (finiteNum(values.align_left)) return null;
      return `${prefix}: values.align_left number is required`;
    case "group_objects":
    case "ungroup_objects":
    case "remove_object":
    case "add_object":
      return null;
    default:
      return null;
  }
}

/** Normalize Founder feedback text for exact plan-coverage matching. */
export function normalizeFounderFeedbackItem(s: string): string {
  return s
    .replace(/^\*+\s*/, "")
    .replace(/^\d+\.\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Exact Founder attributions for one operation (primary + optional secondary).
 * Dedupes by exact-normalized text. Primary is always included when non-empty.
 * Attribution metadata only — never implies duplicate execution.
 */
export function operationFounderAttributions(op: {
  founder_feedback_item?: string | null;
  founder_feedback_items?: string[] | null;
}): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const n = normalizeFounderFeedbackItem(trimmed);
    if (!n || seen.has(n)) return;
    seen.add(n);
    out.push(trimmed);
  };
  push(String(op.founder_feedback_item ?? ""));
  if (Array.isArray(op.founder_feedback_items)) {
    for (const item of op.founder_feedback_items) {
      push(String(item ?? ""));
    }
  }
  return out;
}

export type UncoveredRequestedChange = {
  index: number;
  text: string;
};

/**
 * Deterministic per-item coverage ledger for the planner prompt.
 * Classification is derived only from requested-change text.
 */
export function buildFounderItemCoverageLedger(
  requestedChanges: string[],
): string {
  const lines: string[] = [
    "FOUNDER ITEM COVERAGE REQUIREMENTS (mandatory — fail closed):",
    "Coverage is attribution-based, not operation-count-based. Several overlapping Founder items may be covered by one REAL operation.",
    "A MUTATION_REQUIRED item is covered when its Exact text appears on ≥1 REAL executable operation as founder_feedback_item (primary) OR in founder_feedback_items (secondary).",
    "This does NOT imply one unique operation per Founder item.",
    "Copy the Exact founder_feedback_item text VERBATIM into that operation field (primary), or into founder_feedback_items when the SAME physical mutation genuinely covers an overlapping item.",
    "",
  ];
  for (let i = 0; i < requestedChanges.length; i++) {
    const change = requestedChanges[i]!;
    const classified = classifyRequestedChange(change);
    lines.push(`Item ${i + 1} — ${classified.classification}`);
    if (classified.check_types.length > 0) {
      lines.push(`Check types: ${classified.check_types.join(" + ")}`);
    }
    lines.push(`Exact founder_feedback_item:`);
    lines.push(`"${change}"`);
    if (classified.classification === "VERIFICATION_ACCEPTANCE") {
      lines.push(
        `Requirement: emit ZERO operations for this item. Deterministic post-execution acceptance owns it.`,
      );
    } else if (isValidationOnlyRequestedChange(change)) {
      lines.push(
        `Requirement: VALIDATION_ONLY — emit ZERO operations for this final validate/verify acceptance line.`,
      );
    } else if (isDeterministicLayoutNormalizerOwnedChange(change)) {
      lines.push(
        `Requirement: DETERMINISTIC_LAYOUT_OWNED — prefer ZERO hand-placed absolute set_position chains for this spacing/rhythm item. RevisionLayoutNormalizer owns safe geometry. Do not invent identity position ops for coverage.`,
      );
    } else {
      lines.push(
        `Requirement: BEFORE returning JSON, verify that at least one REAL executable operation contains this EXACT text in founder_feedback_item or founder_feedback_items (primary or secondary attribution — not a dedicated extra operation).`,
      );
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

/** Prompt-only candidate ID hints from inventory section/text overlap. */
export function buildTargetCandidateHints(
  requestedChanges: string[],
  inventory: CanvasInventoryObject[],
): string {
  const lines: string[] = [
    "TARGET CANDIDATE HINTS (prompt aid only — still copy exact IDs into target_id or target_ids; runtime never auto-resolves omitted IDs):",
  ];
  for (let i = 0; i < requestedChanges.length; i++) {
    const change = requestedChanges[i]!;
    const classified = classifyRequestedChange(change);
    if (classified.classification === "VERIFICATION_ACCEPTANCE") {
      lines.push(
        `Item ${i + 1} [VERIFICATION_ACCEPTANCE] — emit ZERO operations for this item.`,
      );
      continue;
    }
    const n = change.toLowerCase();
    const hits = inventory.filter((o) => {
      if (o.system) return false;
      const section = (o.section ?? "").toLowerCase();
      const text = (o.text ?? "").toLowerCase();
      if (section && n.includes(section)) return true;
      if (text && text.length <= 40 && n.includes(text)) return true;
      if (
        /summary|experience|education|skills|certifications|languages|header|contact|name/.test(
          n,
        )
      ) {
        const keys = n.match(
          /summary|experience|education|skills|certifications|languages|header/g,
        );
        if (keys?.some((k) => section === k)) return true;
      }
      return false;
    });
    const ids = [...new Set(hits.map((h) => h.id))].slice(0, 24);
    if (ids.length === 0) {
      lines.push(
        `Item ${i + 1} [MUTATION_REQUIRED] — no section/text hint match; choose carefully from full inventory.`,
      );
    } else {
      lines.push(
        `Item ${i + 1} [MUTATION_REQUIRED] Candidates: ${ids.join(", ")}`,
      );
    }
  }
  return lines.join("\n");
}

function sectionUnitCoherenceGuidanceBlock(): string {
  return [
    "SECTION UNIT COHERENCE (mandatory — architecture-general):",
    "A visual section unit consists of:",
    "- accent marker / decorative section indicator (e.g. role=section-marker Rect)",
    "- section heading (label Textbox)",
    "- associated section body/content (Textboxes belonging to that section)",
    "",
    "When Founder feedback requires repositioning, reflow, spacing, or rhythm changes for a section:",
    "1. Treat marker, heading, and associated content as ONE visual unit — reason about the intended final geometry of all members together.",
    "2. Before moving one member vertically, determine how heading, marker, and content will relate AFTER the full set of operations.",
    "3. FORBID a marker-only vertical move that would orphan the marker far from its heading/content band (e.g. marker top=380 while heading remains top=507).",
    "4. FORBID placing associated section content above its own heading unless the prior design explicitly establishes that ordering.",
    "5. Preserve internal vertical order within a section: marker/heading band → associated content → (gap) → next section.",
    "6. Preserve intentional horizontal marker-to-heading offsets unless Founder explicitly requires changing them.",
    "7. When moving an entire section vertically, emit coordinated operations on marker, heading, and affected content as required — not an isolated marker or heading move that breaks the unit.",
    "8. Do not mutate objects already correctly positioned solely to obtain attribution.",
    "9. Do not create no-op operations (same geometry as inventory) merely to satisfy Founder completeness.",
    "10. VERTICAL SECTION STACK (mandatory): for vertically stacked sections, previous section content bottom MUST be strictly less than next section marker/heading band top, with the configured/minimum spacing expectation. FORBIDDEN: content-bottom >= next-section heading/marker top. Do not solve horizontal ownership while leaving vertical section units overlapping.",
  ].join("\n");
}

function sectionSpacingGroupingAttributionBlock(): string {
  return [
    "SECTION SPACING / GROUPING / RHYTHM MULTI-ATTRIBUTION (mandatory):",
    "Founder items about section spacing, section-to-section gaps, sidebar rhythm, heading-marker-content grouping, alignment, and internal spacing often overlap on the SAME section geometry.",
    "When one REAL geometry operation genuinely contributes to multiple such requirements:",
    "- founder_feedback_item = the primary exact Founder line best matched to that mutation",
    "- founder_feedback_items = every additional exact MUTATION_REQUIRED line that the SAME physical mutation genuinely satisfies",
    "Examples of legitimate overlap (conceptual — use exact Founder text from REQUESTED CHANGES):",
    "- A coordinated section-stack move may multi-attribute: consistent sidebar section system + section-to-section gaps + heading-marker-content grouping.",
    "- A marker/heading horizontal alignment op may multi-attribute: sidebar heading alignment + grouping + lane ownership.",
    "- A heading/marker visual-reference requirement may be secondary-attributed on genuine marker/heading horizontal relationship operations (for example sidebar marker alignment and sidebar heading alignment) when together they preserve the intended marker↔heading offset and column ownership.",
    "HEADING-MARKER VISUAL REFERENCE (architecture-general):",
    'When a Founder item asks to use a heading and its accent marker as a visual reference for a clean and consistent heading-marker relationship, while preserving separate horizontal anchors of columns, attach that item only to operations that genuinely establish heading/marker horizontal relationship. Do not create a new mutation solely for this attribution.',
    "If that relationship is already correct and no geometry change is required, emit ZERO new operations for that item.",
    "If genuine existing operations already preserve or establish the relationship, attach the Founder line as founder_feedback_items on those truthful operations.",
    "Zero new operations for that requirement is preferable to a fabricated or identity mutation.",
    "SECTION GROUPING ATTRIBUTION (architecture-general):",
    'A section-grouping Founder requirement (for example: "Keep each section\'s heading, blue accent marker, and associated content visually grouped as one unit with consistent internal spacing.") may only be attributed to an operation when its target belongs to the relevant section unit — marker, heading, or associated content — AND the mutation genuinely contributes to heading-marker relationship, heading-content spacing, coordinated section movement, or internal section grouping.',
    'An Education body-only operation MUST NOT serve as the sole proof for sidebar/general section grouping merely because the wording contains "each section".',
    "FORBIDDEN:",
    "- Attaching unrelated Founder items merely to pass completeness.",
    "- Attributing heading-marker-content grouping when the resulting geometry separates marker from heading or places content above its heading.",
    "- Dummy/no-op mutations solely for attribution.",
  ].join("\n");
}

function columnLaneOwnershipGuidanceBlock(): string {
  return [
    "COLUMN / LANE OWNERSHIP (mandatory — deterministic StructuralAlignmentSafety is authoritative):",
    "- Preserve established column/lane ownership unless the Founder explicitly requests an architecture change.",
    "- Do not align objects from different established columns/lanes to one shared horizontal coordinate.",
    '- Interpret requests such as "align section headings consistently" as consistency WITHIN each existing column/lane.',
    "- Sidebar headings should align with sidebar headings.",
    "- Main-column headings should align with main-column headings.",
    "- Do not move main-column content to sidebar x-coordinates or vice versa merely to satisfy alignment consistency.",
    "- When multiple established lanes/columns exist, every align_objects operation must contain targets from exactly one lane. Never emit one align_objects operation containing targets from different lanes.",
    "- If headings in two lanes both require alignment, emit separate same-lane align_objects operations for each lane.",
    "- If multiple columns exist, produce separate same-lane operations where alignment changes are required.",
    "- Preserve the existing multi-column architecture when Founder feedback explicitly asks for preservation.",
  ].join("\n");
}

function horizontalAlignmentCohortGuidanceBlock(): string {
  return [
    "HORIZONTAL ALIGNMENT COHORTS (mandatory — architecture-general):",
    "A visual section unit may contain DISTINCT horizontal alignment cohorts:",
    "- accent/marker",
    "- heading label",
    "- associated body/content",
    "Objects belonging to one section do NOT necessarily share one left coordinate.",
    "align_objects with a single values.align_left may include targets from exactly ONE of those cohorts.",
    "FORBIDDEN: mixing marker + heading, heading + body, or marker + body in one align_objects operation.",
    '"Align markers consistently relative to headings" means preserve the established marker↔heading horizontal OFFSET. It does NOT mean assign marker and heading the same align_left.',
    '"Align section headings" means heading labels only — do not include associated body/content or markers in that heading cohort.',
    "If markers themselves need left-edge consistency, emit a SEPARATE same-lane align_objects containing only markers.",
    "If body/content needs a shared left edge, emit a SEPARATE same-lane align_objects containing only body/content, and choose a left that keeps each object's full effective width inside the established lane/column band.",
    "Before emitting align_objects, inspect each target's effective width against the established lane/column band (not only page width). If proposed left + width would place the object's right edge outside that band, do not emit the op.",
    "Do not collapse an established marker↔heading or heading↔body horizontal relationship merely to obtain Founder-item attribution.",
    "align_objects ALWAYS requires at least two DISTINCT non-empty inventory target IDs. A one-element target_ids array is invalid.",
    "INVALID: using align_objects with one target merely to represent an absolute X. That is a single-object reposition — use set_position or move_object, and only if the object actually needs to move.",
    "INVALID: creating an operation whose requested geometry is already identical to the inventory for every target merely so a Founder item appears covered. That is a no-op invented for coverage.",
    "If a visual-reference / preserve-existing-relationship Founder item is already satisfied by current geometry, do not invent a dummy align_objects (including a one-target identity align_left) for that item.",
    "INVALID (schema-rejected — one-target align_objects):",
    JSON.stringify({
      op: "align_objects",
      target_ids: ["block-example-heading"],
      before_summary: "Heading textbox already at its established left",
      intended_change:
        "Represent a heading-marker visual reference with a dummy left-edge align",
      values: { align_left: 100 },
      founder_feedback_item:
        "Use a heading and its accent marker as a visual reference while preserving existing column anchors.",
      confidence: 0.9,
    }),
    "Reason: align_objects requires ≥2 distinct target IDs. A single-object absolute X is set_position only when movement is actually required. If inventory left already matches, emit nothing for that item (or secondary-attribute a genuine related multi-target op).",
  ].join("\n");
}

/**
 * Shared model-facing operation grammar for primary, CoveragePlanRepair, and
 * ConflictPlanRepair. Values keys are per-op. Do not advertise a global bag.
 * Schema/executor remain authoritative; this block must not contradict them.
 */
function operationCapabilityGrammarBlock(): string {
  return [
    "OPERATION CAPABILITY GRAMMAR (mandatory — architecture-general):",
    "Values keys are operation-specific. Do not treat width/height as legal on every op.",
    "Emit only fields that actually change versus CURRENT inventory. Do not copy unchanged geometry into values to “preserve” it.",
    "",
    "ABSOLUTE POSITION — set_position:",
    "- set_position / move_object are POSITION-ONLY: require left, top, delta_left, and/or delta_top numbers.",
    "- Legal values: left and/or top (only fields that change).",
    "- Illegal values: width, height, delta_width, delta_height, w, h, delta_w, delta_h.",
    "- INVALID: set_position or move_object with values:{} (empty object). Position ops MUST include at least one finite left/top/delta_left/delta_top.",
    "- INVALID: set_position with no finite left/top/delta_left/delta_top (including semantic placeholder booleans).",
    "- If current inventory geometry already satisfies the Founder item, emit ZERO ops for that item — do not emit an identity set_position.",
    "- Do not include an unchanged left in a set_position operation merely by copying inventory geometry.",
    "- If align_objects legitimately owns a target's left axis, that target's set_position must contain only the axis it actually changes (for example top only).",
    "- set_position does not change text wrapping. The executor ignores width/height on position ops and the plan is rejected.",
    "INVALID (schema-rejected — empty values on position op):",
    JSON.stringify({
      op: "set_position",
      target_id: "block-example-heading",
      before_summary:
        "Textbox id=block-example-heading already at the correct top=165",
      intended_change:
        "Ensure heading top remains at 165 for alignment (no actual move)",
      values: {},
      founder_feedback_item:
        "Align the section headings to the same vertical baseline.",
      confidence: 0.9,
    }),
    "Reason: values:{} is never legal on set_position/move_object. If geometry is already correct, emit zero ops for that item.",
    "INVALID (schema-rejected — width on position-only op):",
    JSON.stringify({
      op: "set_position",
      target_id: "block-example-body",
      before_summary:
        "Textbox id=block-example-body currently at left=80 top=400 width already correct",
      intended_change:
        "Move the textbox vertically while copying current width to preserve wrapping",
      values: { top: 394, left: 80, width: 200 },
      founder_feedback_item:
        "Reflow this section content within the existing column width.",
      confidence: 0.9,
    }),
    "Reason: width is not applied by set_position. Copying current width to “preserve wrapping” is illegal.",
    "VALID (same intent — position only; omit unchanged left/width):",
    JSON.stringify({
      op: "set_position",
      target_id: "block-example-body",
      before_summary:
        "Textbox id=block-example-body currently at left=80 top=400 width already correct",
      intended_change: "Set absolute top of this textbox to 394",
      values: { top: 394 },
      founder_feedback_item:
        "Reflow this section content within the existing column width.",
      confidence: 0.9,
    }),
    "",
    "RELATIVE POSITION — move_object:",
    "- Legal values: delta_left and/or delta_top.",
    "- Illegal: size keys (width/height and aliases) on move_object.",
    "",
    "DIMENSION CHANGE — resize_object, set_dimensions, or extend_shape:",
    "- These three execute equivalently for position+dimension fields. Do not invent a fourth size op.",
    "- Legal values: width, height, delta_width, delta_height, and optional left/top when the SAME size op must also move the object.",
    "- Emit width/height only when the dimension actually needs to change. INVALID: identity size fields equal to current inventory width/height solely to “preserve” geometry.",
    "- Never place size fields on set_position or move_object.",
    "VALID (genuine width change on a size-capable op):",
    JSON.stringify({
      op: "set_dimensions",
      target_id: "block-example-shape",
      before_summary: "Rect id=block-example-shape currently width=200",
      intended_change: "Set width to 240 because the shape must grow",
      values: { width: 240 },
      founder_feedback_item: "Widen this decorative shape to the intended size.",
      confidence: 0.9,
    }),
    "- When a shape must move left AND grow width while preserving its right boundary (e.g. extend a sidebar to the page edge), prefer ONE extend_shape or set_dimensions op with both left and width (conflict-safe: one op, left+width axes).",
    "",
    "POSITION + SIZE:",
    "- Use ONE existing size-capable op containing the required position and dimension changes.",
    "- INVALID: set_position plus width. INVALID: two same-axis mutations on the same target.",
    "",
    "MULTI-OBJECT LEFT ALIGNMENT — align_objects:",
    "- Requires ≥2 distinct inventory target_ids, same lane, same horizontal section-unit role (see HORIZONTAL ALIGNMENT COHORTS).",
    "- align_left must actually change at least one target. Do not emit identity align_objects if every target already satisfies the requested align_left.",
    "- Single-object horizontal movement: set_position or move_object, not align_objects.",
    "INVALID (identity align_objects — every target already at requested X):",
    JSON.stringify({
      op: "align_objects",
      target_ids: ["block-example-h1", "block-example-h2"],
      before_summary:
        "Two heading textboxes already at the requested left edge",
      intended_change: "Represent alignment coverage without changing geometry",
      values: { align_left: 100 },
      founder_feedback_item:
        "Align section headings consistently within each existing column.",
      confidence: 0.9,
    }),
    "Reason: if inventory left already equals align_left for every target, emit nothing (or secondary-attribute a genuine related mutation). Do not invent identity align_objects for coverage.",
    "",
    "TEXT REFLOW WITHIN EXISTING WIDTH:",
    "- If Founder asks to reflow/restack text within an already-correct column/textbox width: leave width untouched.",
    "- Do not copy unchanged width into values to preserve wrapping.",
    "- Do not change width merely because the word “reflow” appears.",
    "- When inventory shows effective_height > stored_height (h), the text wraps taller than the Fabric frame — plan clearance using effective_bottom, not stored h.",
    "- If two same-lane text objects overlap under effective geometry (next.top < previous.effective_bottom), you MUST create DIFFERENTIAL clearance: move the lower object down (or raise its top) enough that next.top >= previous.effective_bottom (+ any required gap). Moving BOTH objects by the SAME delta does NOT resolve the collision.",
    "- Prefer set_position / move_object with real numeric tops/deltas for clearance. If a genuine frame-height correction is also required, use resize_object, set_dimensions, or extend_shape — never attach height to set_position.",
    "- Deterministic RevisionLayoutNormalizer owns section-stack spacing, heading/body minimum gaps, Founder-gated internal body rhythm, section-to-section rhythm, and page-fit. Prefer ZERO hand-placed absolute coordinate chains for full-page vertical rhythm — do not invent long set_position stacks when spacing/rhythm feedback can be satisfied by deterministic layout ownership.",
    "- RevisionLayoutNormalizer will NOT silently rewrite an intentionally impossible same-delta plan into a valid one. Do not submit geometry that already preserves an effective overlap.",
    "- Explicit Founder directions are binding: if feedback says move a section upward, do not propose downward tops/delta_top for that section.",
    "",
    "NO MUTATION REQUIRED / VISUAL-REFERENCE-ONLY:",
    "- If the requested visual relationship is already correct, zero new operations is valid.",
    "- Do not fabricate identity set_position, identity align_objects, or identity dimensions solely to make a Founder item appear covered.",
    "- A heading-marker visual-reference requirement may be secondary-attributed (founder_feedback_items) on genuine related operations, or receive ZERO ops if already correct.",
  ].join("\n");
}

export function buildRevisionPlannerPrompt(input: {
  task: RevisionTask;
  inventory: CanvasInventoryObject[];
  page_width: number;
  page_height: number;
  preview_width: number;
  preview_height: number;
  repoRoot?: string;
}): {
  objective: string;
  instructions: string;
  founder_memory_selection: FounderMemorySelectionResult;
} {
  const { task, inventory } = input;
  const changesBlock = task.requested_changes
    .map((c, i) => `${i + 1}. ${c}`)
    .join("\n");
  const coverageLedger = buildFounderItemCoverageLedger(task.requested_changes);
  const candidateHints = buildTargetCandidateHints(
    task.requested_changes,
    inventory,
  );

  const memorySelection = selectFounderMemory({
    channel: "revision",
    repoRoot: input.repoRoot,
    currentFounderRequests: task.requested_changes,
    ctx: toSelectionContext(
      deriveRevisionMemoryContext({
        task,
        enrichment: input.repoRoot
          ? enrichFromCandidateArtifacts(
              input.repoRoot,
              task.prior_candidate_id,
            )
          : null,
      }),
    ),
  });
  const memoryBlock = memorySelection.prompt_block;

  const objective = [
    "FOUNDER CANVAS REVISION PLANNER",
    "Modify the existing Fabric resume design to implement Founder feedback.",
    "Do NOT generate a new unrelated resume.",
    "Preserve unaffected content, names, companies, and section copy unless a Founder item requires a text change.",
    "Implement EVERY Founder instruction.",
    "Return structured JSON only (no markdown).",
    `Role: ${task.role}`,
    `Design family: ${task.design_family ?? "unknown"}`,
    `Prior resume template (legacy internal id): ${task.prior_candidate_id}`,
    `Decision: ${task.decision_id}`,
  ].join(" ");

  const instructions = [
    "You are revising an existing one-page ATS Fabric.js canvas.",
    "CRITICAL RULES:",
    "- Modify the existing design in place via operations.",
    "- Preserve unaffected content.",
    "- Do not invent a brand-new resume layout from scratch.",
    "- Do not output an entire replacement Fabric canvas unless absolutely necessary (prefer operations).",
    "- Implement every Founder instruction listed below.",
    "- Never modify locked system page background (role=pageBackground / system=true) except when Founder explicitly requires a full-page change (then refuse and note).",
    "- Stay within page bounds.",
    "",
    "TARGETING CONTRACT (mandatory — fail closed):",
    "- Use only object IDs provided in the CANVAS OBJECT INVENTORY below.",
    "- Copy IDs exactly from inventory id=… values. Never invent object IDs.",
    "- Never invent or infer roles. Do not use conceptual roles such as label or filled-label unless that exact role string is explicitly present on an inventory object.",
    "",
    "SINGLE-TARGET OPERATIONS (mandatory):",
    `- Ops: ${PLANNER_ALLOWED_OPS.filter((op) => !MULTI_TARGET_OPS.has(op) && op !== "add_object").join(", ")}.`,
    "- MUST use exactly one non-empty target_id copied from inventory.",
    "- MUST NOT include target_ids (forbidden on single-target ops).",
    "- MUST NOT include selector (forbidden on single-target ops).",
    "- one operation = one inventory object.",
    "- To mutate multiple objects: emit multiple single-target ops (each with its own target_id), OR use align_objects/group_objects when true multi-object alignment/grouping is intended.",
    "- For the SUMMARY body, select the body Textbox inventory ID (the paragraph text), NOT the SUMMARY heading Textbox and NOT a decorative Rect.",
    "- section alone is INSUFFICIENT when a section has both a heading label and a body Textbox (e.g. SUMMARY heading + summary body).",
    "- NOT the SUMMARY label when editing summary body copy.",
    "",
    "MOVEMENT / SPACING CONTRACT (mandatory):",
    "- For concrete object movement: use set_position with target_id + absolute top/left, OR move_object with target_id + delta_top/delta_left.",
    "- For true multi-object horizontal alignment: use align_objects with target_ids (≥2) and values.align_left.",
    "- For semantic section spacing / heading→body gaps / page-fit: do NOT invent gap/spacing operations. Deterministic RevisionLayoutNormalizer owns section-stack spacing, heading/body minimum gaps, and page-fit compaction after your executable ops run.",
    "- Intra-section text reflow / readable separation still requires concrete per-object set_position or move_object (differential tops) when Founder asks for that mutation — never a single semantic spacing field, and never identical deltas on overlapping objects.",
    "",
    "WRAP-AWARE GEOMETRY CONTRACT (mandatory):",
    "- Inventory fields: h / stored_height = serialized Fabric frame height (may be undersized).",
    "- effective_height / effective_bottom = deterministic wrap-aware safety geometry (max of stored frame vs estimated wrapped content height).",
    "- text_len = full source character count (inventory text preview may be truncated).",
    "- When effective_bottom of object A exceeds top of horizontally overlapping object B, the plan is geometrically invalid unless B is moved (or A is changed) so clearance exists.",
    "- A pre-execution geometry gate will REJECT plans that still leave effective text-to-text overlaps after your operations are simulated.",
    "",
    "CANONICAL GEOMETRY OWNERSHIP (mandatory):",
    "- For a target object and axis, emit ONE mutation owner.",
    "- If align_objects owns target X's horizontal alignment: do not also emit set_position.left for X; do not emit move_object.delta_left for X.",
    "- A set_position operation MAY still carry top while align_objects owns left.",
    "- INVALID: set_position(X, { left: 60, top: 280 }) plus align_objects([X,Y], { align_left: 60 }).",
    "- VALID: set_position(X, { top: 280 }) plus align_objects([X,Y], { align_left: 60 }).",
    "- Do not create dummy/no-op operations to satisfy attribution.",
    "",
    columnLaneOwnershipGuidanceBlock(),
    "",
    sectionUnitCoherenceGuidanceBlock(),
    "",
    horizontalAlignmentCohortGuidanceBlock(),
    "",
    "INVALID (will be rejected — do not emit):",
    JSON.stringify({
      op: "adjust_spacing",
      target_id: "block-experience-2-t2",
      values: { spacing: 18 },
    }),
    JSON.stringify({
      op: "set_position",
      target_id: "block-summary-1-r0",
      values: { spacing: 24 },
    }),
    JSON.stringify({
      op: "set_position",
      target_ids: ["block-summary-1-r0", "block-experience-2-r0"],
      values: { align_left: 48, vertical_spacing_standardized: true },
    }),
    JSON.stringify({
      op: "move_object",
      target_id: "block-skills-4-t2",
      values: { gap_px: 10 },
    }),
    "",
    "VALID movement examples (IDs/values are EXAMPLES — copy real IDs from CURRENT inventory):",
    JSON.stringify({
      op: "move_object",
      target_id: "block-experience-2-t5",
      before_summary:
        "Textbox id=block-experience-2-t5 section=experience top near prior bullet",
      intended_change: "Move this Experience bullet down by 6px to restore rhythm",
      values: { delta_top: 6 },
      founder_feedback_item:
        "Normalize the spacing inside the Experience section so job titles, employment dates, bullet groups, and the transitions between different employers follow one consistent vertical rhythm without unusually large or compressed gaps.",
      confidence: 0.95,
    }),
    JSON.stringify({
      op: "set_position",
      target_id: "block-experience-2-t5",
      before_summary:
        "Textbox id=block-experience-2-t5 section=experience currently at top≈414",
      intended_change: "Set absolute top of this Experience bullet to 420",
      values: { top: 420 },
      founder_feedback_item:
        "Normalize the spacing inside the Experience section so job titles, employment dates, bullet groups, and the transitions between different employers follow one consistent vertical rhythm without unusually large or compressed gaps.",
      confidence: 0.95,
    }),
    "",
    "VALID alternatives for multi-object work:",
    "- Two separate set_position or move_object ops, each with its own target_id and executable left/top/delta_* values.",
    "- align_objects with target_ids (≥2) and values.align_left when true left-edge alignment is intended.",
    "",
    "MULTI-TARGET OPERATIONS (ONLY align_objects / group_objects — mandatory):",
    "- Use ONLY exact object IDs copied from the provided CANVAS OBJECT INVENTORY.",
    "- target_ids is REQUIRED: a JSON array of at least 2 non-empty inventory object ID strings.",
    "- Never use selector as the targeting mechanism for align_objects / group_objects.",
    "- Never use a single target_id as the sole target for align_objects / group_objects.",
    "- Never leave target_ids empty, omitted, or with fewer than 2 IDs.",
    "- Never infer targets from values (e.g. values.align_left alone is INVALID).",
    "- Never invent object IDs. Copy id=… values exactly from the inventory.",
    "- If only one object needs movement/alignment, use set_position or move_object instead of align_objects.",
    "",
    "MULTI-OBJECT ALIGNMENT SAFETY (mandatory — fail closed):",
    "- NEVER include structural/full-width container objects in an align_objects cohort with ordinary content-column objects.",
    "- Structural examples (when inventory role/section/geometry makes this explicit): header-band, full-width decorative band, page-spanning container/background.",
    "- Do NOT invent or guess hidden roles. Use ONLY explicit inventory role/section/geometry fields.",
    "- If any target's effective width would push right edge past page width at values.align_left, do NOT emit that align_objects op.",
    "- If any target's effective width would push its right edge past the established lane/column band at values.align_left, do NOT emit that align_objects op.",
    "- Do not mix marker, heading, and body/content in one align_objects cohort. See HORIZONTAL ALIGNMENT COHORTS.",
    "- Compatible ordinary content objects of the SAME section-unit role (e.g. section heading labels of similar column width) may share align_objects when geometrically safe.",
    "- Compatible header text objects may align together when geometrically safe; do not mix them with a page-spanning header-band Rect.",
    "",
    "EXECUTABLE VALUES (mandatory):",
    "- values must contain fields the executor can apply — never semantic placeholder booleans or invented spacing fields.",
    "- INVALID values keys (never emit; never substitute for geometry): spacing, gap, gap_px, vertical_spacing, horizontal_spacing, spacing_standardized, vertical_spacing_standardized, qa_pass_boundaries.",
    "- set_position / move_object are POSITION-ONLY: require left, top, delta_left, and/or delta_top numbers.",
    "- Do NOT put width, height, delta_width, delta_height, or shorthand aliases w/h/delta_w/delta_h on set_position or move_object — the executor ignores them and the plan will be rejected.",
    "- Dimensions MUST use resize_object, set_dimensions, or extend_shape with canonical keys width/height/delta_width/delta_height (and left/top when needed). Never invent shorthand dimension keys.",
    "- When a shape must move left AND grow width while preserving its right boundary (e.g. extend a sidebar to the page edge), prefer ONE extend_shape or set_dimensions op with both left and width (conflict-safe: one op, left+width axes). Do NOT emit set_position with a useless width/w field.",
    "- update_text: require values.text string.",
    "- adjust_font_size: require fontSize or delta_fontSize.",
    "- align_objects: require values.align_left number.",
    "- Do NOT rewrite or invent conversions (spacing→delta_top is FORBIDDEN).",
    "- Values keys are per-op — see OPERATION CAPABILITY GRAMMAR. Do not treat width/height as generic keys on every operation.",
    "",
    operationCapabilityGrammarBlock(),
    "",
    "OPERATION NAME RULES (mandatory — exact allowlist only):",
    "- Use ONLY the exact operation names listed below.",
    "- Do not invent synonyms.",
    "- Do not change spelling.",
    "- Do not add or remove hyphens.",
    `- Exact allowlist: ${ALLOWED_OPS.join(", ")}`,
    "- Valid: ungroup_objects. Invalid: un-group_objects (hyphenated synonym).",
    "- INVALID / DEPRECATED op (do not emit): adjust_spacing — it is not planner-allowlisted. Use set_position or move_object instead.",
    "- For header vertical balance, prefer set_position or move_object on specific inventory target_id values with numeric top/delta_top.",
    "- Do not use group_objects or ungroup_objects unless the Founder request actually requires grouping or ungrouping objects.",
    "",
    "FOUNDER FEEDBACK COMPLETENESS (mandatory):",
    "- ONE PHYSICAL MUTATION → ONE OR MORE EXACT FOUNDER ATTRIBUTIONS.",
    "- Coverage is attribution-based, not operation-count-based. Several overlapping Founder items may be covered by one REAL operation.",
    "- Mutation requirements: every MUTATION_REQUIRED Founder requested change MUST have its Exact text attributed on ≥1 REAL planned operation (as founder_feedback_item OR in founder_feedback_items). This does NOT mean one dedicated operation per Founder item.",
    "- Copy the exact requested-change text into founder_feedback_item (verbatim primary) and/or founder_feedback_items (verbatim secondary). Do not paraphrase.",
    "- No mutation requirement may be left without exact attribution on a REAL operation.",
    "- Broad requests such as reviewing overall typography against approved templates still require ≥1 concrete inventory-backed operation (e.g. adjust_font_size / adjust_line_height on a specific textbox id) that carries that exact Founder text as primary or secondary attribution.",
    "- A broad composition requirement such as overall visual balance should normally be attributed to the concrete geometry changes that actually produce that balance, rather than manufacturing extra moves solely for broad coverage.",
    "- Final collision/bounds QA items classified by the system as VERIFICATION_ACCEPTANCE require ZERO operations.",
    "- Final visual-consistency QA items classified by the system as VERIFICATION_ACCEPTANCE require ZERO operations.",
    "- Truthful-content preservation / do-not-fabricate constraints classified as VERIFICATION_ACCEPTANCE require ZERO operations (deterministic content-preservation acceptance owns them).",
    "- Final verification/acceptance requirements (narrow system-recognized final QA acceptance forms only) require ZERO dummy mutation operations.",
    "- NEVER create align_objects / set_position / move_object / update_text / QA placeholder ops merely to represent final QA verification items.",
    "- Page-bounds and collision verification after mutations is owned by deterministic post-execution acceptance — not by planner-invented alignment ops.",
    "- Deterministic post-execution acceptance checks own VERIFICATION_ACCEPTANCE items.",
    "- The system classifies verification/acceptance requirements deterministically. You MUST NOT invent a classification field, and you MUST NOT reclassify ordinary mutation requests as QA.",
    "- Words like QA, review, check, verify, or final alone do NOT exempt a change from requiring operations. Concrete mutations (move/resize/restyle specific objects) always require operations.",
    "- Do NOT reclassify spacing/layout mutation requests as VERIFICATION_ACCEPTANCE. They still require concrete executable ops when mutation is needed.",
    "- Do NOT reclassify collision-repair / displaced-object mutation requests as VERIFICATION_ACCEPTANCE.",
    "- Verification/acceptance requirements are proven by deterministic post-execution checks after mutations run — not by planner self-declaration.",
    "- Do not invent unsupported operations or non-inventory target ids.",
    "- If you cannot safely produce an inventory-backed allowlisted operation for a mutation requirement, do not invent one — the plan is incomplete and will be rejected before execution.",
    "- Plans that skip any mutation requirement are INVALID and will be rejected before execution.",
    "",
    "OVERLAPPING FOUNDER REQUIREMENTS (mandatory):",
    "- Founder requests may overlap semantically (e.g. collision repair vs restore heading positions vs skills scanability; section spacing vs overall column balance).",
    "- A physical object may need changes relevant to multiple Founder items.",
    "- EACH MUTATION_REQUIRED Founder item still requires exact attribution on ≥1 REAL operation via founder_feedback_item and/or founder_feedback_items.",
    "- Rule: when two or more Founder requirements overlap on the SAME physical geometry, first determine ONE coherent final visual outcome, then emit that physical mutation exactly ONCE.",
    "- Put one exact Founder line in founder_feedback_item; put additional exact overlapping MUTATION_REQUIRED Founder lines in founder_feedback_items.",
    "- Prefer founder_feedback_items (Safe pattern C) whenever generating independent operations would touch the same target and geometry axis.",
    "- Safe pattern A: emit separate real executable operations, each attributed to the relevant exact Founder item — ONLY when those operations target different objects or independent axes (no same-target same-axis overlap).",
    "- Safe pattern B: if the same object needs distinct concrete mutations on DIFFERENT axes (e.g. left-only vs top-only), split into real operations and assign each to the proper Founder item.",
    "- Safe pattern C (PREFERRED when one physical mutation genuinely implements multiple overlapping MUTATION_REQUIRED items): emit ONE real operation with founder_feedback_item = primary exact Founder line, and founder_feedback_items = optional array of additional EXACT overlapping Founder lines.",
    "- Prefer multi-attribution (pattern C) over manufacturing a second identical, conflicting, or no-op mutation when one real mutation genuinely addresses both requirements.",
    "- Do NOT emit another same-axis operation on the same target merely to obtain coverage for another Founder line; attach that item to founder_feedback_items on the existing mutation instead.",
    "- Do NOT issue contradictory absolute/relative geometry mutations such as set_position top and then move_object delta_top on the same target for different Founder items.",
    "- Same-target overlapping geometry conflicts (same axis) cause the ENTIRE primary plan to fail BEFORE CoveragePlanRepair and BEFORE canvas execution.",
    "- CoveragePlanRepair is not a mechanism for fixing a contradictory primary plan. Primary geometry must already be internally coherent.",
    "- Multi-attribution is ONLY valid when the same real physical mutation genuinely contributes to every attached Founder requirement.",
    "- Do NOT add secondary attribution merely to satisfy completeness.",
    "- Never attach unrelated Founder requirements merely to satisfy completeness.",
    "- Never include VERIFICATION_ACCEPTANCE items in founder_feedback_item or founder_feedback_items.",
    "- DO NOT emit no-op duplicates merely to satisfy completeness.",
    "- DO NOT duplicate an identical mutation with no additional effect (same target + same values).",
    "- DO NOT set an object to its exact current geometry solely to attach another founder_feedback_item.",
    "- DO NOT emit move_object with delta_top:0 / delta_left:0, or set_fill to the same fill, as completeness padding.",
    "- If an item needs attribution, choose a genuine remaining collision/displacement/spacing mutation for THAT item, use multi-attribution on a real op, or leave the plan incomplete rather than inventing work.",
    "",
    sectionSpacingGroupingAttributionBlock(),
    "",
    "COHERENT FINAL GEOMETRY BEFORE MULTI-ATTRIBUTION (mandatory):",
    "- Before emitting operations for the same section/object, reconcile all applicable Founder requirements into a single intended final geometry.",
    "- Example concept: a narrow request (improve a section's spacing rhythm) and a broad request (improve left/right page balance) that both affect the same objects.",
    "- Do NOT independently solve each request and then stack both moves on the same target/axis.",
    "- Instead: (1) choose the final position once; (2) decide whether that one position genuinely satisfies both; (3) if yes, multi-attribute it with founder_feedback_item + founder_feedback_items; (4) if no single move on that object can satisfy both, use a DIFFERENT non-conflicting element/section for the broader composition goal, or leave the broad item uncovered for CoveragePlanRepair — never create contradictory geometry.",
    "- Do not fabricate a move simply to close coverage.",
    "",
    "COLLISION / DISPLACED-OBJECT ATTRIBUTION (mandatory):",
    '- For requests like "Correct all element collisions and displaced objects in the Education, Skills, and Certifications area…", attribute at least one REAL collision-fixing operation to THAT exact requested-change text.',
    "- Valid: set_position/move_object on an Education/Skills/Certifications heading rect or overlapping body object whose intended_change genuinely resolves overlap/displacement, with founder_feedback_item equal to the collision Founder line.",
    "- INVALID: performing all collision fixes but attributing them only to neighboring style/heading/restore/scanability Founder items.",
    "",
    coverageLedger,
    "",
    "MANDATORY OPERATION FIELDS (every operation — never omit):",
    "- op (allowlisted operation type)",
    "- target_id for every single-target operation (copy exactly from inventory); never target_ids/selector on single-target ops",
    "- target_ids for align_objects / group_objects only (≥2 inventory IDs)",
    "- values (object with executor-actionable numeric/text fields — no placeholder booleans)",
    "- founder_feedback_item (required primary exact Founder change text addressed)",
    "- founder_feedback_items (optional string[] of additional EXACT overlapping Founder lines for the SAME physical mutation; omit when unused)",
    "- confidence (number 0..1)",
    "- intended_change is MANDATORY for every operation: non-empty string describing the exact mutation to apply",
    "- before_summary is MANDATORY for every operation: non-empty string describing the current target object state from the inventory",
    "- Never omit intended_change or before_summary.",
    "- Do not use null, empty strings, placeholders, or inferred shorthand for intended_change or before_summary.",
    "- intended_change must describe the exact mutation (what changes on the canvas object).",
    "- before_summary must describe the current target object state from the provided inventory (id/type/text/geometry as relevant).",
    "",
    "COMPLETE EXAMPLE OPERATION (single-target — copy this field set; replace IDs/values from the CURRENT inventory):",
    JSON.stringify({
      op: "update_text",
      target_id: "block-summary-1-t2",
      before_summary:
        "Textbox id=block-summary-1-t2 section=summary text starts with role summary paragraph",
      intended_change:
        "Replace summary body text with revised copy while keeping the same textbox id",
      values: { text: "Revised professional summary sentence." },
      founder_feedback_item: "Rewrite the professional summary with more specific language.",
      confidence: 0.95,
    }),
    "",
    "COMPLETE EXAMPLE OPERATION (multi-attribution — ONE physical mutation covering overlapping Founder items; EXAMPLE IDs/values only — replace from CURRENT inventory):",
    JSON.stringify({
      op: "set_position",
      target_id: "block-section-example-t1",
      before_summary:
        "Textbox id=block-section-example-t1 section=example-sidebar left=48 top=500 w=208 h=14",
      intended_change:
        "Choose one final section heading position that improves sidebar rhythm and overall column balance",
      values: { top: 470 },
      founder_feedback_item:
        "Refine the example sidebar section so headings, bullets, and spacing follow one consistent rhythm.",
      founder_feedback_items: [
        "Improve the overall visual balance between the left and right columns so the page feels intentionally composed.",
      ],
      confidence: 0.93,
    }),
    "",
    "COMPLETE EXAMPLE OPERATION (multi-target align_objects — SAME LANE ONLY; IDs below are EXAMPLES — copy ≥2 IDs from ONE established lane in the CURRENT inventory):",
    JSON.stringify({
      op: "align_objects",
      target_ids: [
        "block-example-sidebar-t1",
        "block-example-sidebar-t2",
        "block-example-sidebar-t3",
      ],
      before_summary:
        "Sidebar section heading textboxes at mixed left positions within the same column",
      intended_change:
        "Align left edges of sidebar section headings within their existing column",
      values: { align_left: 48 },
      founder_feedback_item:
        "Align section headings consistently within each existing column.",
      confidence: 0.95,
    }),
    "",
    "If another lane (e.g. main column) also needs heading alignment, emit a SEPARATE align_objects operation containing only that lane's targets — never combine sidebar and main-column objects in one cohort.",
    "COMPLETE EXAMPLE OPERATION (second align_objects for a different lane — separate operation, same-lane cohort only):",
    JSON.stringify({
      op: "align_objects",
      target_ids: [
        "block-example-main-t1",
        "block-example-main-t2",
      ],
      before_summary:
        "Main-column section heading textboxes at mixed left positions within the same column",
      intended_change:
        "Align left edges of main-column section headings within their existing column",
      values: { align_left: 72 },
      founder_feedback_item:
        "Align section headings consistently within each existing column.",
      confidence: 0.94,
    }),
    "",
    "COMPLETE EXAMPLE OPERATION (ungroup_objects — exact name, no hyphen; single-target target_id from CURRENT inventory):",
    JSON.stringify({
      op: "ungroup_objects",
      target_id: "block-header-0-t1",
      before_summary:
        "Textbox id=block-header-0-t1 currently has group_id set in data",
      intended_change:
        "Remove group association from this object so it can be positioned independently",
      values: {},
      founder_feedback_item:
        "Ungroup the header name textbox from its temporary layout group.",
      confidence: 0.9,
    }),
    "NOTE: values:{} is legal ONLY for group_objects / ungroup_objects / remove_object / add_object-style ops that do not apply position fields. NEVER copy values:{} onto set_position or move_object.",
    "",
    "FOUNDER REASON (verbatim):",
    task.founder_reason,
    "",
    "CURRENT FOUNDER REQUEST (verbatim — highest authority — implement each):",
    changesBlock,
    "",
    "RELEVANT FOUNDER MEMORY (persistent layout/design preferences — subordinate to CURRENT FOUNDER REQUEST):",
    "Use only when compatible with the current request. Never treat memory lines as current founder_feedback_item attribution.",
    "Memory must not invent resume facts. Current request always wins on conflict.",
    memoryBlock || "(none selected for this template context)",
    "",
    candidateHints,
    "",
    `PAGE BOUNDS: width=${input.page_width} height=${input.page_height}`,
    `PREVIEW DIMENSIONS: width=${input.preview_width} height=${input.preview_height}`,
    "",
    "CANVAS OBJECT INVENTORY:",
    "Geometry field legend: h/stored_height=Fabric frame height; effective_height/effective_bottom=wrap-aware safety geometry; text_len=full character count (text preview may be truncated).",
    inventorySummary(inventory),
    "",
    "BEFORE RETURNING (mandatory internal checklist — do not emit prose; validate structure then return JSON only):",
    "1. Count all MUTATION_REQUIRED Founder items from FOUNDER ITEM COVERAGE REQUIREMENTS.",
    "2. For each MUTATION_REQUIRED item, find ≥1 operation whose founder_feedback_item OR founder_feedback_items contains the Exact founder_feedback_item text (attribution-based coverage — not one dedicated op per item).",
    "3. Confirm each such operation has executable values and a real inventory target_id or target_ids.",
    "4. Confirm no VERIFICATION_ACCEPTANCE item has dummy ops or secondary attributions.",
    "5. Confirm the plan has no internal same-target conflicting geometry mutations (e.g. two set_position tops, or set_position top plus move_object delta_top, on the same object). Such conflicts fail the ENTIRE primary plan BEFORE CoveragePlanRepair and BEFORE canvas execution.",
    "6. Where Founder items overlap on the same geometry, confirm you chose ONE coherent final geometry and used founder_feedback_items instead of a second same-axis mutation.",
    "7. If any MUTATION_REQUIRED item has zero attributions, the plan is incomplete — do not pretend it is complete.",
    "8. SECTION UNIT SELF-CONSISTENCY: for every section with vertical mutations, verify using the plan's OWN requested geometry (not inventory alone): marker remains associated with its heading band; content remains below its heading; no section member is orphaned; the next section begins after current section content; section gaps are intentional.",
    "9. Reject any plan where a marker-only vertical move would separate marker from heading/content (orphan marker).",
    "10. Reject any plan where associated section content would end up above its own heading unless explicitly required.",
    "11. VERTICAL SECTION STACK: previous section content bottom must be strictly less than next section marker/heading band top (configured/minimum spacing). FORBIDDEN: content-bottom >= next-section heading/marker top. Do not solve horizontal ownership while leaving vertical section units overlapping.",
    "",
    "Return JSON with schema:",
    '{ "schema_version":"founder-canvas-revision-plan-1.0.0", "summary":string, "operations":[...], "notes":string[] }',
    "Do NOT add coverage_map or other self-declared coverage fields. Completeness is derived only from founder_feedback_item / founder_feedback_items on operations.",
    "Each operation MUST include all of:",
    "op (EXACTLY one of: " + ALLOWED_OPS.join(", ") + " — no synonyms, no hyphens variants),",
    "target_id (required string for single-target ops — copy from inventory; NEVER with target_ids),",
    "target_ids (REQUIRED string[] with ≥2 inventory IDs for align_objects / group_objects ONLY),",
    "before_summary (required non-empty string),",
    "intended_change (required non-empty string),",
    "values (object with executor-actionable fields),",
    "founder_feedback_item (required primary exact Founder change text addressed),",
    "founder_feedback_items (optional string[] of additional exact overlapping Founder lines),",
    "confidence (0-1).",
    "selector is forbidden on single-target ops and is NOT valid for align_objects / group_objects.",
    "values keys are operation-specific (see OPERATION CAPABILITY GRAMMAR). Position ops: left/top/delta_left/delta_top. Size ops: width/height/delta_width/delta_height (and left/top when that same size op must also move). align_objects: align_left. update_text: text. adjust_font_size: fontSize or delta_fontSize. adjust_line_height: lineHeight. set_fill: fill. set_stroke: stroke and/or strokeWidth.",
    "Never use values keys: spacing, gap, gap_px, vertical_spacing, horizontal_spacing, or similar.",
  ].join("\n");

  return {
    objective,
    instructions,
    founder_memory_selection: memorySelection,
  };
}

/** Architecture-general filter for repair-relevant primary ops (prompt context only). */
export function opTouchesRepairRelevantPrimaryTopics(
  op: CanvasOperation,
): boolean {
  const blob = JSON.stringify({
    target_id: op.target_id,
    target_ids: op.target_ids,
    before_summary: op.before_summary,
    intended_change: op.intended_change,
    founder_feedback_item: op.founder_feedback_item,
    founder_feedback_items: op.founder_feedback_items,
  }).toLowerCase();
  return (
    blob.includes("education") ||
    blob.includes("skills") ||
    blob.includes("certification") ||
    blob.includes("project") ||
    blob.includes("language") ||
    blob.includes("section") ||
    blob.includes("grouping") ||
    blob.includes("grouped") ||
    blob.includes("heading") ||
    blob.includes("marker") ||
    blob.includes("accent") ||
    blob.includes("rhythm") ||
    blob.includes("spacing") ||
    blob.includes("sidebar") ||
    blob.includes("associated content") ||
    blob.includes("collision") ||
    blob.includes("overlap") ||
    blob.includes("displaced")
  );
}

/**
 * Narrow one-shot repair prompt for missing MUTATION_REQUIRED Founder-item coverage.
 * Repair planning uses the SAME prior inventory as the primary planner (pre-execution).
 */
export function buildRevisionCoverageRepairPrompt(input: {
  task: RevisionTask;
  inventory: CanvasInventoryObject[];
  page_width: number;
  page_height: number;
  missing: UncoveredRequestedChange[];
  primaryOperations: CanvasOperation[];
}): { objective: string; instructions: string } {
  const missingBlock = input.missing
    .map((m) => `Item ${m.index + 1} (requested_changes[${m.index}]):\n"${m.text}"`)
    .join("\n\n");
  const relevant = input.primaryOperations.filter(
    opTouchesRepairRelevantPrimaryTopics,
  );
  const relevantBlock =
    relevant.length === 0
      ? "(none matched section/grouping/spacing/collision keywords)"
      : relevant
          .map((op, i) =>
            JSON.stringify({
              primary_op_index: input.primaryOperations.indexOf(op),
              op: op.op,
              target_id: op.target_id ?? null,
              target_ids: op.target_ids ?? null,
              values: op.values,
              intended_change: op.intended_change,
              founder_feedback_item: op.founder_feedback_item,
              founder_feedback_items: op.founder_feedback_items ?? null,
              note: `listed_as_relevant_${i}`,
            }),
          )
          .join("\n");
  const primaryCompact = input.primaryOperations.map((op, i) => ({
    i,
    op: op.op,
    target_id: op.target_id ?? null,
    target_ids: op.target_ids ?? null,
    values: op.values,
    founder_feedback_item: op.founder_feedback_item,
    founder_feedback_items: op.founder_feedback_items ?? null,
  }));

  const occupiedScopes = new Set<string>();
  for (const op of input.primaryOperations) {
    const axes = geomAxesPresent(op.values ?? {});
    const targets = targetIdsOf(op);
    for (const tid of targets) {
      for (const axis of axes) {
        occupiedScopes.add(`${tid}::${axis}`);
      }
    }
  }
  const occupiedList = [...occupiedScopes].sort();
  const exampleMissing =
    input.missing[0]?.text ??
    "Improve the overall visual balance between the left and right columns so the page feels intentionally composed.";

  const objective =
    "Repair ONLY missing Founder-item attribution/coverage in an otherwise valid revision plan. Emit additional REAL executable canvas operations for uncovered MUTATION_REQUIRED items only.";

  const instructions = [
    "You are repairing ONLY missing Founder-item attribution/coverage in an otherwise valid revision plan.",
    "Primary holistic planning already produced a structurally valid operations array.",
    "Primary plan operations are already accepted and FROZEN for repair purposes — CoveragePlanRepair is ADDITIVE ONLY.",
    "Do NOT rewrite, relabel, or re-emit primary operations.",
    "Do NOT invent no-op mutations.",
    "Do NOT emit operations for already-covered Founder items.",
    "Do NOT emit operations for VERIFICATION_ACCEPTANCE items (including truthful-content preservation / no-fabrication constraints).",
    "Items already covered via primary founder_feedback_item OR founder_feedback_items are NOT missing — do not repair them.",
    "",
    "GEOMETRY SEMANTICS (critical):",
    "- Repair planning occurs BEFORE any execution.",
    "- Reason against the SAME prior canvas inventory as the primary planner.",
    "- Do NOT pretend primary operations have already executed.",
    "- Primary operations are provided so you can avoid duplicate/conflicting mutations.",
    "- Do NOT emit a repair mutation that touches the same target + geometry axis as a primary mutation.",
    "- Do NOT attempt to undo or counteract primary positioning.",
    "- Prefer a genuinely different non-conflicting target/axis when solving a missing broad requirement.",
    "- Same-object absolute position conflicts will be rejected deterministically by detectRepairMergeConflicts.",
    "- If the missing requirement cannot be solved without conflicting with the accepted primary plan, do NOT manufacture contradictory moves — the repair call will fail closed.",
    "",
    columnLaneOwnershipGuidanceBlock(),
    "",
    horizontalAlignmentCohortGuidanceBlock(),
    "",
    operationCapabilityGrammarBlock(),
    "",
    "HEADING-MARKER VISUAL REFERENCE (coverage repair — fail closed):",
    "Do not invent align_objects that assigns a section marker and its heading the same align_left when inventory shows they currently occupy different lefts. That collapses the established marker↔heading offset.",
    "A Founder item asking to use a heading and its accent marker as a visual reference, while preserving separate column anchors, must NOT be solved by collapsing those lefts or by mixing marker+heading+body in one align_objects cohort.",
    "Do not create a mutation solely to attribute that item. If it cannot be satisfied without collapsing the offset, conflicting with primary axes, or mixing section-unit roles, do not emit contradictory geometry.",
    "",
    "PRIMARY OCCUPIED GEOMETRY (READ-ONLY — binding constraint):",
    "Each key is target_id::axis already mutated by the accepted primary plan.",
    "If target::axis appears below, coverage repair MUST NOT emit another mutation on that same target::axis.",
    occupiedList.length === 0 ? "(none)" : JSON.stringify(occupiedList),
    "",
    "INVALID repair example (generic IDs — will fail deterministically):",
    "Primary occupied: section-b-marker::top",
    JSON.stringify({
      op: "set_position",
      target_id: "section-b-marker",
      values: { top: 500 },
      founder_feedback_item: exampleMissing,
    }),
    "Reason: section-b-marker::top is already owned by primary — repair cannot contradict or re-set that axis.",
    "",
    "VALID repair pattern when marker::top is occupied:",
    "- Choose another semantically relevant object with an unoccupied axis (e.g. section heading top, first content top) ONLY if that mutation genuinely addresses the missing Founder requirement.",
    "- If a genuine dimension change is required on an unoccupied width/height axis, use resize_object, set_dimensions, or extend_shape — never attach width/height to set_position or move_object.",
    "- If no safe non-conflicting operation exists, do not fabricate one — the repair will fail closed.",
    "",
    "MISSING MUTATION ITEMS (each must receive ≥1 REAL executable operation):",
    missingBlock,
    "",
    "For every missing item above: copy that Exact text VERBATIM into founder_feedback_item on each repair operation that addresses it (or use founder_feedback_items only when one repair mutation genuinely covers multiple missing items).",
    "",
    "RELEVANT EXISTING PRIMARY OPERATIONS (do not duplicate or contradict):",
    relevantBlock,
    "",
    "PRIMARY OPERATIONS COMPACT (all — avoid identical op+target+values):",
    JSON.stringify(primaryCompact),
    "",
    "MANDATORY FIELDS FOR EVERY REPAIR OPERATION (never omit):",
    "- op (allowlisted operation type)",
    "- target_id for every single-target operation (copy exactly from inventory); never target_ids/selector on single-target ops",
    "- target_ids for align_objects / group_objects only (≥2 inventory IDs)",
    "- values (object with executor-actionable numeric/text fields — no placeholder booleans)",
    "- before_summary (required non-empty string describing current target state from inventory)",
    "- intended_change (required non-empty string describing the exact mutation)",
    "- founder_feedback_item (REQUIRED non-empty string — must exactly match one MUTATION_REQUIRED missing Founder item)",
    "- founder_feedback_items (optional string[] of additional EXACT missing Founder lines only when the SAME physical mutation genuinely satisfies them)",
    "- confidence (required number 0..1 — never omit)",
    "",
    "ATTRIBUTION CONTRACT:",
    "- Every emitted repair operation MUST contain a non-empty founder_feedback_item that exactly matches one MUTATION_REQUIRED missing Founder item.",
    "- founder_feedback_items may contain additional exact missing Founder items only when the SAME physical mutation genuinely satisfies them.",
    "- No unattributed repair operation is valid.",
    "- No operation may omit confidence.",
    "- Do NOT invent, paraphrase, or auto-fill Founder attribution text.",
    "",
    "COMPLETE EXAMPLE REPAIR OPERATION (generic IDs — replace from CURRENT inventory; founder_feedback_item must be an EXACT missing Founder line):",
    JSON.stringify({
      op: "set_position",
      target_id: "block-example-t1",
      before_summary:
        "Textbox id=block-example-t1 section=example left=48 top=500 w=208 h=14",
      intended_change:
        "Move one existing element to address the exact missing layout requirement without conflicting with the accepted primary plan",
      values: { top: 420 },
      founder_feedback_item: exampleMissing,
      confidence: 0.92,
    }),
    "",
    "COMPLETE EXAMPLE REPAIR OPERATION (multi-attribution — ONE physical mutation covering two missing items when genuinely true):",
    JSON.stringify({
      op: "set_position",
      target_id: "block-example-sidebar-t2",
      before_summary:
        "Textbox id=block-example-sidebar-t2 left=48 top=620 w=208 h=14",
      intended_change:
        "Choose one final position that improves lower-column presence without touching primary-occupied axes",
      values: { top: 640 },
      founder_feedback_item: exampleMissing,
      founder_feedback_items: input.missing.length > 1 ? [input.missing[1]!.text] : undefined,
      confidence: 0.9,
    }),
    "",
    "RULES:",
    "- Emit ONLY additional REAL executable operations needed for the missing Founder item(s).",
    "- operations MUST be a non-empty array (≥1 repair operation). An empty operations array is INVALID.",
    "- If you cannot produce a valid non-conflicting attributed repair, still return structurally complete ops only when legitimate — otherwise the deterministic validator will fail closed (do not invent contradictory geometry).",
    "- Do not rewrite or relabel existing primary operations.",
    "- Do not duplicate an existing identical mutation (same op + target + values).",
    "- Do not emit a no-op (current geometry, delta_top:0, same fill, etc.).",
    "- Use current/prior canvas inventory geometry, not assumed post-primary geometry.",
    `- Use ONLY these exact ops: ${ALLOWED_OPS.join(", ")}`,
    "- INVALID / DEPRECATED: adjust_spacing.",
    "- Single-target ops require target_id (never target_ids/selector).",
    "- align_objects / group_objects require target_ids with ≥2 inventory IDs.",
    "- values must be executor-actionable (left/top/delta_*/fontSize/text/etc.).",
    "",
    `PAGE BOUNDS: width=${input.page_width} height=${input.page_height}`,
    "",
    "CANVAS OBJECT INVENTORY (prior canvas — pre-execution):",
    inventorySummary(input.inventory),
    "",
    "Return JSON with schema:",
    '{ "schema_version":"founder-canvas-revision-plan-1.0.0", "summary":string, "operations":[...≥1 repair ops only...], "notes":string[] }',
    "operations must contain ONLY repair ops for the missing Founder item(s) and MUST be non-empty.",
  ].join("\n");

  return { objective, instructions };
}

/**
 * One-shot ConflictPlanRepair prompt: return a COMPLETE revised plan.
 * CoveragePlanRepair must NOT run after this call in the same planner invocation.
 */
export function buildRevisionConflictRepairPrompt(input: {
  task: RevisionTask;
  inventory: CanvasInventoryObject[];
  page_width: number;
  page_height: number;
  primaryPlan: RevisionPlan;
  conflictReport: PrimaryConflictReport;
}): { objective: string; instructions: string } {
  const coverageLedger = buildFounderItemCoverageLedger(
    input.task.requested_changes,
  );
  const scopeSet = new Set(input.conflictReport.conflict_scope_keys);
  const frozenOps = input.primaryPlan.operations.filter(
    (op) => !operationInConflictScope(op, scopeSet),
  );
  const conflictScopeOps = input.primaryPlan.operations
    .map((op, i) => ({ op, i }))
    .filter(({ op }) => operationInConflictScope(op, scopeSet));

  const objective =
    "ConflictPlanRepair: return ONE COMPLETE coherent revision plan that resolves primary plan mutation conflicts without CoveragePlanRepair.";

  const instructions = [
    "You are performing the ONE and ONLY ConflictPlanRepair attempt for this Founder revision.",
    "The primary planner produced a structurally attributed plan that FAILED deterministic internal mutation conflict validation.",
    "CoveragePlanRepair will NOT run after this call. Your repaired plan must itself be complete and internally coherent.",
    "",
    "OUTPUT CONTRACT:",
    "- Return a COMPLETE revised plan (full operations array), NOT a patch / delta / repair-ops-only list.",
    "- schema_version must be founder-canvas-revision-plan-1.0.0.",
    "- Reconcile each conflicting target/axis into ONE coherent physical outcome.",
    "- Use founder_feedback_items when the SAME resulting physical mutation genuinely satisfies overlapping MUTATION_REQUIRED Founder lines.",
    "- Do NOT merely delete Founder coverage to remove conflicts.",
    "- Do NOT add unrelated operations outside conflict scope.",
    "- Do NOT alter frozen operations (identity must be preserved).",
    "- Do NOT emit VERIFICATION_ACCEPTANCE mutation ops.",
    "- Do NOT create no-op / zero-delta padding for coverage.",
    "- Do NOT invent qualifications, employers, metrics, tools, or other credentials.",
    "- Do NOT invent object IDs — copy only from inventory.",
    "- This is the ONE and ONLY conflict-repair attempt. There is no second try.",
    "",
    "CONFLICT SCOPE (editable):",
    "- Scope keys are targetId::axis (example: block-skills-4-r0::top).",
    "- You may rewrite operations that touch these conflicting target/axis combinations.",
    "- If an operation touches multiple axes and at least one is conflicted, the whole operation is in conflict scope.",
    "- An independent left mutation on the same target is NOT editable when only top conflicts (and vice versa).",
    `Conflict scope keys: ${JSON.stringify(input.conflictReport.conflict_scope_keys)}`,
    "Conflict-scope primary operations:",
    conflictScopeOps.length === 0
      ? "(none)"
      : conflictScopeOps
          .map(({ op, i }) =>
            JSON.stringify({
              primary_index: i,
              op: op.op,
              target_id: op.target_id ?? null,
              target_ids: op.target_ids ?? null,
              values: op.values,
              intended_change: op.intended_change,
              founder_feedback_item: op.founder_feedback_item,
              founder_feedback_items: op.founder_feedback_items ?? null,
              confidence: op.confidence,
            }),
          )
          .join("\n"),
    "",
    "FROZEN OPERATIONS (must preserve — do not alter):",
    "- Every frozen operation must appear in your complete plan with the same op, targets, values, intended_change, before_summary, founder_feedback_item, founder_feedback_items, and selector.",
    "- Order may change. Content must not.",
    frozenOps.length === 0
      ? "(none — entire plan is conflict-scope)"
      : frozenOps
          .map((op, i) =>
            JSON.stringify({
              frozen_slot: i,
              preservation_fingerprint: operationPreservationFingerprint(op),
              op: op.op,
              target_id: op.target_id ?? null,
              target_ids: op.target_ids ?? null,
              values: op.values,
              intended_change: op.intended_change,
              before_summary: op.before_summary,
              founder_feedback_item: op.founder_feedback_item,
              founder_feedback_items: op.founder_feedback_items ?? null,
              selector: op.selector ?? null,
              confidence: op.confidence,
            }),
          )
          .join("\n"),
    "",
    "STRUCTURED DETERMINISTIC CONFLICT REPORT:",
    JSON.stringify(
      {
        pair_count: input.conflictReport.pairs.length,
        pairs: input.conflictReport.pairs,
        conflict_scope_keys: input.conflictReport.conflict_scope_keys,
        conflict_scope_operation_indices:
          input.conflictReport.conflict_scope_operation_indices,
        frozen_operation_indices:
          input.conflictReport.frozen_operation_indices,
        human_readable_errors: input.conflictReport.errors,
      },
      null,
      2,
    ),
    "",
    "EXACT PRIMARY PLAN (full — rewrite into a complete coherent plan):",
    JSON.stringify(input.primaryPlan),
    "",
    "FOUNDER REQUESTED CHANGES + CLASSIFICATION:",
    coverageLedger,
    "",
    "MULTI-ATTRIBUTION / COHERENT GEOMETRY CONTRACT:",
    "- ONE PHYSICAL MUTATION → ONE OR MORE EXACT FOUNDER ATTRIBUTIONS.",
    "- Coverage is attribution-based, not operation-count-based.",
    "- COHERENT FINAL GEOMETRY BEFORE MULTI-ATTRIBUTION.",
    "- Do NOT emit another same-axis operation on the same target merely to obtain coverage.",
    "- Prefer Safe pattern C: one real operation with founder_feedback_item + optional founder_feedback_items.",
    "- Never include VERIFICATION_ACCEPTANCE items in founder_feedback_item / founder_feedback_items.",
    "- Final collision/bounds QA items classified as VERIFICATION_ACCEPTANCE require ZERO operations.",
    "",
    "CANONICAL HORIZONTAL OWNERSHIP / CONFLICT COLLAPSE (mandatory):",
    "- When set_position/move_object and align_objects claim the same target::left axis, choose ONE canonical representation.",
    "- Prefer align_objects as the left owner when it is a genuine alignment cohort.",
    "- For a mixed-axis set_position { left: L, top: T } where align_objects already legitimately owns left=L: preserve { top: T } and remove only the redundant left field.",
    "- Do NOT retain both representations.",
    "- Do NOT change T merely because left conflicted.",
    "- Do NOT collapse unequal horizontal intents.",
    "- Do NOT use this rule for delta_left.",
    "- Do NOT bypass alignment safety.",
    "- Do not solve horizontal ownership while leaving vertical section units overlapping.",
    "",
    "TRUTHFULNESS:",
    "- Preserve truthful resume content.",
    "- Do not fabricate skills, certifications, education, employment, achievements, metrics, or tools.",
    "",
    columnLaneOwnershipGuidanceBlock(),
    "",
    horizontalAlignmentCohortGuidanceBlock(),
    "",
    operationCapabilityGrammarBlock(),
    "",
    "MANDATORY FIELDS FOR EVERY OPERATION (never omit):",
    "- op (allowlisted operation type)",
    "- target_id for every single-target operation (copy exactly from inventory); never target_ids/selector on single-target ops",
    "- target_ids for align_objects / group_objects only (≥2 inventory IDs)",
    "- values (object with executor-actionable numeric/text fields — no placeholder booleans)",
    "- before_summary (required non-empty string describing current target state from inventory)",
    "- intended_change (required non-empty string describing the exact mutation)",
    "- founder_feedback_item (required primary exact Founder change text addressed)",
    "- founder_feedback_items (optional string[] of additional EXACT overlapping MUTATION_REQUIRED lines)",
    "- confidence (required number 0..1). CONFIDENCE IS MANDATORY. NEVER OMIT confidence FROM A REPAIRED OPERATION.",
    "",
    "COMPLETE EXAMPLE REPAIRED OPERATION (generic IDs — replace from CURRENT inventory):",
    JSON.stringify({
      op: "set_position",
      target_id: "block-example-t1",
      before_summary:
        "Textbox id=block-example-t1 section=example left=48 top=500 w=208 h=14",
      intended_change:
        "Reconcile conflicting geometry into one coherent final position",
      values: { top: 470 },
      founder_feedback_item: "Example Founder change text copied verbatim.",
      confidence: 0.93,
    }),
    "",
    "COMPLETE EXAMPLE REPAIRED OPERATION (align_objects — same-lane cohort only):",
    JSON.stringify({
      op: "align_objects",
      target_ids: ["block-example-sidebar-t1", "block-example-sidebar-t2"],
      before_summary:
        "Sidebar section heading textboxes at mixed left positions within the same column",
      intended_change:
        "Align left edges of sidebar section headings within their existing column",
      values: { align_left: 48 },
      founder_feedback_item: "Align section headings consistently within each column.",
      confidence: 0.95,
    }),
    "",
    "OPERATION RULES:",
    `- Use ONLY these exact ops: ${ALLOWED_OPS.join(", ")}`,
    "- INVALID / DEPRECATED: adjust_spacing.",
    "- Single-target ops require target_id (never target_ids/selector).",
    "- align_objects / group_objects require target_ids with ≥2 inventory IDs.",
    "- values must be executor-actionable (left/top/delta_*/fontSize/text/etc.).",
    "- intended_change and before_summary are mandatory non-empty strings.",
    "- founder_feedback_item required; founder_feedback_items optional exact overlapping MUTATION_REQUIRED lines.",
    "- confidence is mandatory on every operation (number 0..1). Never omit confidence from a repaired operation.",
    "",
    `PAGE BOUNDS: width=${input.page_width} height=${input.page_height}`,
    "",
    "CANVAS OBJECT INVENTORY (prior canvas — pre-execution):",
    inventorySummary(input.inventory),
    "",
    "Return JSON with schema:",
    '{ "schema_version":"founder-canvas-revision-plan-1.0.0", "summary":string, "operations":[...COMPLETE plan ops...], "notes":string[] }',
  ].join("\n");

  return { objective, instructions };
}

function isOp(v: unknown): v is CanvasOpType {
  return isAllowedCanvasOp(v);
}

function feedbackItemCovered(
  requested: string,
  operations: CanvasOperation[],
): boolean {
  const n = normalizeFounderFeedbackItem(requested);
  if (!n) return false;
  return operations.some((op) =>
    operationFounderAttributions(op).some(
      (a) => normalizeFounderFeedbackItem(a) === n,
    ),
  );
}

/**
 * Fail closed for MUTATION_REQUIRED items: each must appear on ≥1 operation.
 * VERIFICATION_ACCEPTANCE items are exempt from plan-operation completeness only
 * (they still require deterministic post-execution acceptance evidence).
 */
/** True when plan completeness may omit ops for this Founder line. */
export function isPlanCoverageExemptRequestedChange(
  requestedChange: string,
): boolean {
  if (
    classifyRequestedChange(requestedChange).classification ===
    "VERIFICATION_ACCEPTANCE"
  ) {
    return true;
  }
  if (isValidationOnlyRequestedChange(requestedChange)) {
    return true;
  }
  return isDeterministicLayoutNormalizerOwnedChange(requestedChange);
}

/** All MUTATION_REQUIRED items are verification or normalizer-owned. */
export function allRequestedChangesAllowEmptyPlan(
  requestedChanges: string[],
): boolean {
  if (requestedChanges.length === 0) return false;
  return requestedChanges.every((c) => isPlanCoverageExemptRequestedChange(c));
}

export function validatePlanCoversRequestedChanges(
  plan: RevisionPlan,
  requestedChanges: string[],
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  for (let i = 0; i < requestedChanges.length; i++) {
    const change = requestedChanges[i]!;
    if (isPlanCoverageExemptRequestedChange(change)) {
      continue;
    }
    if (!feedbackItemCovered(change, plan.operations)) {
      errors.push(
        `requested_changes[${i}] has no planned operation (founder_feedback_item / founder_feedback_items must match exactly): ${change}`,
      );
    }
  }
  return { ok: errors.length === 0, errors };
}

/**
 * MUTATION_REQUIRED items with zero exact-normalized attributions
 * (founder_feedback_item or founder_feedback_items).
 * VERIFICATION_ACCEPTANCE and deterministic-layout-owned items are never returned.
 */
export function findUncoveredRequestedChanges(
  plan: RevisionPlan,
  requestedChanges: string[],
): UncoveredRequestedChange[] {
  const missing: UncoveredRequestedChange[] = [];
  for (let i = 0; i < requestedChanges.length; i++) {
    const change = requestedChanges[i]!;
    if (isPlanCoverageExemptRequestedChange(change)) {
      continue;
    }
    if (!feedbackItemCovered(change, plan.operations)) {
      missing.push({ index: i, text: change });
    }
  }
  return missing;
}

/**
 * Structural / operation validation only (allowlist, targeting, executable values,
 * intended_change / before_summary, founder_feedback_items shape).
 * Does NOT check Founder-item completeness or internal geometry conflicts.
 * When opts.requested_changes is supplied, every attribution must exact-match a
 * MUTATION_REQUIRED requested change (fail closed; no silent drop).
 */
export function validateRevisionPlanShapeAndOperations(
  raw: unknown,
  opts?: {
    allowEmptyOperations?: boolean;
    requested_changes?: string[];
  },
): {
  ok: boolean;
  plan: RevisionPlan | null;
  errors: string[];
} {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, plan: null, errors: ["plan must be an object"] };
  }
  const o = raw as Record<string, unknown>;
  const operationsRaw = o.operations;
  const allowEmpty = opts?.allowEmptyOperations === true;
  const requestedChanges = opts?.requested_changes;
  const requestedByNorm = new Map<string, string>();
  if (requestedChanges) {
    for (const change of requestedChanges) {
      const n = normalizeFounderFeedbackItem(change);
      if (n) requestedByNorm.set(n, change);
    }
  }
  if (!Array.isArray(operationsRaw)) {
    errors.push("operations must be a non-empty array");
  } else if (operationsRaw.length === 0 && !allowEmpty) {
    errors.push("operations must be a non-empty array");
  }
  const operations: CanvasOperation[] = [];
  if (Array.isArray(operationsRaw)) {
    for (let i = 0; i < operationsRaw.length; i++) {
      const item = operationsRaw[i];
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        errors.push(`operations[${i}] invalid`);
        continue;
      }
      const opItem = item as Record<string, unknown>;
      if (!isOp(opItem.op)) {
        if (isDeprecatedPlannerOp(opItem.op)) {
          errors.push(
            `operations[${i}].op ${String(opItem.op)} is deprecated for new plans (not planner-allowlisted); use set_position or move_object with left/top/delta_left/delta_top`,
          );
        } else {
          errors.push(`operations[${i}].op not allowlisted`);
        }
        continue;
      }
      const feedback = String(opItem.founder_feedback_item ?? "").trim();
      if (!feedback) {
        errors.push(`operations[${i}].founder_feedback_item required`);
        continue;
      }
      // Fail closed: do not invent intended_change / before_summary from other fields.
      if (
        opItem.intended_change !== undefined &&
        typeof opItem.intended_change !== "string"
      ) {
        errors.push(
          `operations[${i}].intended_change must be a non-empty string`,
        );
        continue;
      }
      const intended =
        typeof opItem.intended_change === "string"
          ? opItem.intended_change.trim()
          : "";
      if (!intended) {
        errors.push(`operations[${i}].intended_change required`);
        continue;
      }
      if (
        opItem.before_summary !== undefined &&
        typeof opItem.before_summary !== "string"
      ) {
        errors.push(
          `operations[${i}].before_summary must be a non-empty string`,
        );
        continue;
      }
      const beforeSummary =
        typeof opItem.before_summary === "string"
          ? opItem.before_summary.trim()
          : "";
      if (!beforeSummary) {
        errors.push(`operations[${i}].before_summary required`);
        continue;
      }
      if (
        opItem.confidence === undefined ||
        opItem.confidence === null ||
        opItem.confidence === ""
      ) {
        errors.push(`operations[${i}].confidence required`);
        continue;
      }
      const confidence = Number(opItem.confidence);
      if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
        errors.push(`operations[${i}].confidence must be 0..1`);
        continue;
      }
      if (
        !opItem.values ||
        typeof opItem.values !== "object" ||
        Array.isArray(opItem.values)
      ) {
        errors.push(`operations[${i}].values required (object)`);
        continue;
      }

      const op = opItem.op;
      const values = opItem.values as Record<string, unknown>;
      const valuesErr = validateExecutableMutationValues(op, i, values);
      if (valuesErr) {
        errors.push(valuesErr);
        continue;
      }

      const rawTargetId = opItem.target_id;
      const hasStringTargetId = typeof rawTargetId === "string";
      const targetId =
        hasStringTargetId && rawTargetId.trim().length > 0
          ? rawTargetId.trim()
          : undefined;
      const hasSelector =
        !!opItem.selector &&
        typeof opItem.selector === "object" &&
        !Array.isArray(opItem.selector);
      const hasTargetIds = hasNonEmptyTargetIdsArray(opItem);

      // Deny-by-default single-target contract (no auto-repair / no conversion).
      if (operationRequiresInventoryTargetId(op)) {
        if (hasTargetIds) {
          errors.push(
            `operations[${i}] ${op}: target_ids is invalid for single-target operations; use target_id for one object, or use align_objects/group_objects for true multi-object mutations`,
          );
          continue;
        }
        if (hasSelector) {
          errors.push(
            `operations[${i}] ${op}: selector is invalid for single-target operations; use target_id only (one operation = one inventory object)`,
          );
          continue;
        }
        if (hasStringTargetId && rawTargetId.trim().length === 0) {
          errors.push(
            `operations[${i}] ${op}: target_id must be a non-empty string`,
          );
          continue;
        }
        if (!targetId) {
          errors.push(
            `operations[${i}] ${op}: target_id is required for single-target operations (selector-only is invalid)`,
          );
          continue;
        }
      } else if (MULTI_TARGET_OPS.has(op)) {
        // Fail closed: inventory target_ids (≥2) required. Selector-only /
        // target_id-only / values-only / empty targets are INVALID.
        const multiErr = validateMultiTargetIds(op, i, opItem);
        if (multiErr) {
          errors.push(multiErr);
          continue;
        }
      }
      // add_object: exempt — no existing target required.

      const multiTargetIds =
        MULTI_TARGET_OPS.has(op) && Array.isArray(opItem.target_ids)
          ? (opItem.target_ids as unknown[]).map((id) => String(id).trim())
          : undefined;

      let secondaryItems: string[] | undefined;
      if (opItem.founder_feedback_items !== undefined) {
        if (
          !Array.isArray(opItem.founder_feedback_items) ||
          opItem.founder_feedback_items.some((x) => typeof x !== "string")
        ) {
          errors.push(
            `operations[${i}].founder_feedback_items must be an array of non-empty strings`,
          );
          continue;
        }
        const seenSec = new Set<string>();
        const deduped: string[] = [];
        let emptyEntry = false;
        for (const rawItem of opItem.founder_feedback_items) {
          const t = String(rawItem ?? "").trim();
          if (!t) {
            emptyEntry = true;
            break;
          }
          const n = normalizeFounderFeedbackItem(t);
          if (seenSec.has(n)) continue; // exact-normalized dedupe (keep first)
          seenSec.add(n);
          deduped.push(t);
        }
        if (emptyEntry) {
          errors.push(
            `operations[${i}].founder_feedback_items entries must be non-empty strings`,
          );
          continue;
        }
        secondaryItems = deduped.length > 0 ? deduped : undefined;
      }

      if (requestedChanges && requestedChanges.length > 0) {
        const attributions = operationFounderAttributions({
          founder_feedback_item: feedback,
          founder_feedback_items: secondaryItems,
        });
        let attributionInvalid = false;
        for (const attr of attributions) {
          const n = normalizeFounderFeedbackItem(attr);
          const matched = requestedByNorm.get(n);
          if (!matched) {
            errors.push(
              `operations[${i}] founder attribution is not an exact requested_changes match: ${attr}`,
            );
            attributionInvalid = true;
            continue;
          }
          if (
            classifyRequestedChange(matched).classification ===
            "VERIFICATION_ACCEPTANCE"
          ) {
            errors.push(
              `operations[${i}] founder attribution must not claim VERIFICATION_ACCEPTANCE item: ${attr}`,
            );
            attributionInvalid = true;
          }
        }
        if (attributionInvalid) continue;
      }

      const built: CanvasOperation = {
        op,
        target_id: targetId,
        // Single-target ops never carry selector (rejected above).
        selector: undefined,
        target_ids: multiTargetIds,
        before_summary: beforeSummary,
        intended_change: intended,
        values,
        founder_feedback_item: feedback,
        confidence,
      };
      if (secondaryItems && secondaryItems.length > 0) {
        built.founder_feedback_items = secondaryItems;
      }
      operations.push(built);
    }
  }

  if (errors.length) return { ok: false, plan: null, errors };

  const plan: RevisionPlan = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: String(o.summary ?? "Founder canvas revision"),
    operations,
    notes: Array.isArray(o.notes) ? o.notes.map(String) : [],
  };

  return { ok: true, plan, errors: [] };
}

/**
 * Full plan validation: structural ops → internal mutation conflicts → completeness.
 * Completeness failures still return plan: null (fail closed; unchanged contract).
 */
export function validateRevisionPlan(
  raw: unknown,
  opts?: { requested_changes?: string[]; allowEmptyOperations?: boolean },
): {
  ok: boolean;
  plan: RevisionPlan | null;
  errors: string[];
} {
  const shape = validateRevisionPlanShapeAndOperations(raw, {
    allowEmptyOperations: opts?.allowEmptyOperations,
    requested_changes: opts?.requested_changes,
  });
  if (!shape.ok || !shape.plan) {
    return shape;
  }

  const conflicts = detectInternalPlanMutationConflicts(shape.plan.operations);
  if (!conflicts.ok) {
    return { ok: false, plan: null, errors: conflicts.errors };
  }

  const requested = opts?.requested_changes;
  if (requested && requested.length > 0) {
    const cover = validatePlanCoversRequestedChanges(shape.plan, requested);
    if (!cover.ok) {
      return { ok: false, plan: null, errors: cover.errors };
    }
  }

  return { ok: true, plan: shape.plan, errors: [] };
}

/** Extract plan from OpenAI structured_output (may nest under plan / operations). */
export function extractPlanFromProviderOutput(
  structured: Record<string, unknown> | null | undefined,
): unknown {
  if (!structured) return null;

  // Never treat the legacy incomplete-JSON provider wrapper as a plan.
  const notes = structured.notes;
  if (
    Array.isArray(notes) &&
    notes.some(
      (n) =>
        typeof n === "string" &&
        (n === "openai_response_was_not_json_object" ||
          n === "revision_planning_incomplete_json" ||
          n === "openai_output_truncated"),
    )
  ) {
    return structured;
  }

  if (Array.isArray(structured.operations)) return structured;
  if (structured.plan && typeof structured.plan === "object") {
    return structured.plan;
  }
  if (structured.revision_plan && typeof structured.revision_plan === "object") {
    return structured.revision_plan;
  }
  // Complete JSON string in summary ONLY (JSON.parse must succeed fully — no repair).
  if (typeof structured.summary === "string") {
    const s = structured.summary.trim();
    if (s.startsWith("{") && s.includes("operations")) {
      try {
        const parsed = JSON.parse(s) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          const p = parsed as Record<string, unknown>;
          if (Array.isArray(p.operations)) return parsed;
        }
      } catch {
        /* truncated / invalid — do not repair */
      }
    }
  }
  // Or notes[0]
  if (Array.isArray(structured.notes)) {
    for (const n of structured.notes) {
      if (typeof n !== "string") continue;
      const s = n.trim();
      if (!s.startsWith("{")) continue;
      try {
        const parsed = JSON.parse(s) as unknown;
        if (
          parsed &&
          typeof parsed === "object" &&
          Array.isArray((parsed as { operations?: unknown }).operations)
        ) {
          return parsed;
        }
      } catch {
        /* ignore */
      }
    }
  }
  return structured;
}
