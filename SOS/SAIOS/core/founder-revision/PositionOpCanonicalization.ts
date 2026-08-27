/**
 * Deterministic omission of non-executable / identity position ops.
 * Prefer zero ops over identity set_position / move_object placeholders.
 * Does NOT invent coordinates. Does NOT convert semantic booleans.
 */
import type { CanvasInventoryObject } from "./revision-task-types.js";
import type { CanvasOperation, RevisionPlan } from "./revision-task-types.js";
import { snapCoord } from "./EquivalentHorizontalOwnership.js";

function finiteNum(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function isPositionOp(op: string): boolean {
  return op === "set_position" || op === "move_object";
}

function hasExecutablePositionField(values: Record<string, unknown>): boolean {
  return (
    finiteNum(values.left) ||
    finiteNum(values.top) ||
    finiteNum(values.delta_left) ||
    finiteNum(values.delta_top)
  );
}

/**
 * True when values have no executable position field (including {}).
 * Semantic booleans / empty objects are non-executable — omit, do not invent.
 */
export function isNonExecutablePositionValues(
  values: Record<string, unknown> | undefined | null,
): boolean {
  if (!values || typeof values !== "object" || Array.isArray(values)) {
    return true;
  }
  return !hasExecutablePositionField(values);
}

function inventoryById(
  inventory: CanvasInventoryObject[],
): Map<string, CanvasInventoryObject> {
  const m = new Map<string, CanvasInventoryObject>();
  for (const o of inventory) {
    if (o?.id) m.set(o.id, o);
  }
  return m;
}

/**
 * Strip set_position / move_object entries whose values lack any executable
 * position field (Task1 failure class: values:{}).
 * Works on raw provider JSON before shape validation.
 */
export function stripNonExecutablePositionOpsFromRaw(raw: unknown): {
  raw: unknown;
  stripped_count: number;
  stripped_indexes: number[];
} {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { raw, stripped_count: 0, stripped_indexes: [] };
  }
  const root = raw as Record<string, unknown>;
  if (!Array.isArray(root.operations)) {
    return { raw, stripped_count: 0, stripped_indexes: [] };
  }
  const kept: unknown[] = [];
  const stripped_indexes: number[] = [];
  for (let i = 0; i < root.operations.length; i++) {
    const item = root.operations[i];
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      kept.push(item);
      continue;
    }
    const opItem = item as Record<string, unknown>;
    const op = String(opItem.op ?? "");
    if (!isPositionOp(op)) {
      kept.push(item);
      continue;
    }
    const values =
      opItem.values &&
      typeof opItem.values === "object" &&
      !Array.isArray(opItem.values)
        ? (opItem.values as Record<string, unknown>)
        : {};
    if (isNonExecutablePositionValues(values)) {
      stripped_indexes.push(i);
      continue;
    }
    kept.push(item);
  }
  return {
    raw: { ...root, operations: kept },
    stripped_count: stripped_indexes.length,
    stripped_indexes,
  };
}

/**
 * Drop identity position mutations (absolute equals inventory, or delta_*=0).
 * If an op loses all geometry fields, omit the entire operation.
 */
export function stripIdentityPositionOps(
  plan: RevisionPlan,
  inventory: CanvasInventoryObject[],
): { plan: RevisionPlan; stripped_count: number } {
  const byId = inventoryById(inventory);
  const operations: CanvasOperation[] = [];
  let stripped_count = 0;

  for (const op of plan.operations) {
    if (!isPositionOp(op.op)) {
      operations.push(op);
      continue;
    }
    const values = { ...(op.values ?? {}) };
    const tid = typeof op.target_id === "string" ? op.target_id.trim() : "";
    const cur = tid ? byId.get(tid) : undefined;

    if (finiteNum(values.delta_top) && snapCoord(values.delta_top) === 0) {
      delete values.delta_top;
    }
    if (finiteNum(values.delta_left) && snapCoord(values.delta_left) === 0) {
      delete values.delta_left;
    }
    if (cur && finiteNum(values.top) && finiteNum(cur.top)) {
      if (snapCoord(values.top) === snapCoord(cur.top)) delete values.top;
    }
    if (cur && finiteNum(values.left) && finiteNum(cur.left)) {
      if (snapCoord(values.left) === snapCoord(cur.left)) delete values.left;
    }

    if (!hasExecutablePositionField(values)) {
      stripped_count += 1;
      continue;
    }
    operations.push({ ...op, values });
  }

  return {
    plan: { ...plan, operations },
    stripped_count,
  };
}

export type VerticalDirection = "up" | "down" | "left" | "right";

/** Movement verbs that can bind a direction (imperative constructions). */
const MOVE_VERB_RE =
  /\b(?:mov(?:e|ing|ed)|shift(?:ing|ed)?|nudg(?:e|ing|ed)|reposition(?:ing|ed)?|adjust(?:ing|ed)?)\b/;

/**
 * Descriptive "lower X" / "the lower X" nouns — NOT imperative movement.
 * "lower edge", "the lower section", "lower left" must remain direction-none.
 */
const LOWER_DESCRIPTIVE_RE =
  /\b(?:the|a|an)\s+lower\b|\blower\s+(?:edge|half|area|part|portion|band|margin|padding|boundar\w*|region|corner|left|right|quarter|third|side)\b/;

/**
 * Imperative verb "lower …" (e.g. "lower the contact row"), excluding
 * descriptive adjective uses matched by LOWER_DESCRIPTIVE_RE.
 */
const LOWER_VERB_RE =
  /(?:^|[.!?;:]\s*|\b(?:please|then|and)\s+)\s*lower\s+(?:the\s+)?(?!edge|half|area|part|portion|band|margin|padding|boundar\w*|region|corner|left|right|quarter|third|side)\S+/;

/**
 * Parse explicit vertical/horizontal direction from Founder or intended_change text.
 *
 * Binds only EXPLICIT MOVEMENT INTENT (imperative verbs / *ward forms).
 * Descriptive location language (lower edge, bottom padding, section below)
 * must not create a direction requirement.
 */
export function parseExplicitMoveDirections(text: string): Set<VerticalDirection> {
  const n = text
    .replace(/^\*+\s*/, "")
    .replace(/^\d+\.\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  const out = new Set<VerticalDirection>();
  if (!n) return out;

  // Explicit *-ward movement forms.
  if (/\b(upward|upwards)\b/.test(n)) out.add("up");
  if (/\b(downward|downwards)\b/.test(n)) out.add("down");
  if (/\bleftward\b/.test(n)) out.add("left");
  if (/\brightward\b/.test(n)) out.add("right");

  // Imperative raise → up.
  if (/\braise\b/.test(n)) out.add("up");

  // Imperative lower → down (not "lower edge" / "the lower section").
  if (!LOWER_DESCRIPTIVE_RE.test(n) && LOWER_VERB_RE.test(n)) {
    out.add("down");
  }
  // Also: sentence-initial / mid-clause "lower the <object>" without needing
  // leading punctuation when object is clearly a layout target word.
  if (
    !LOWER_DESCRIPTIVE_RE.test(n) &&
    /\blower\s+(?:the\s+)?(?:contact[\w-]*|row|block|object|heading|textbox|name|role|title|section|column|sidebar|marker|band)\b/.test(
      n,
    )
  ) {
    out.add("down");
  }

  // move/shift/nudge/reposition/adjust … direction (incl. higher/lower as adverbs).
  if (MOVE_VERB_RE.test(n)) {
    if (
      /\b(?:upward|upwards|higher)\b/.test(n) ||
      /\b(?:mov(?:e|ing|ed)|shift(?:ing|ed)?|nudg(?:e|ing|ed)|reposition(?:ing|ed)?|adjust(?:ing|ed)?)\b[\s\S]{0,48}\bup\b/.test(
        n,
      )
    ) {
      out.add("up");
    }
    if (
      /\b(?:downward|downwards)\b/.test(n) ||
      (/\blower\b/.test(n) && !LOWER_DESCRIPTIVE_RE.test(n)) ||
      /\b(?:mov(?:e|ing|ed)|shift(?:ing|ed)?|nudg(?:e|ing|ed)|reposition(?:ing|ed)?|adjust(?:ing|ed)?)\b[\s\S]{0,48}\bdown\b/.test(
        n,
      )
    ) {
      out.add("down");
    }
    if (
      /\b(?:mov(?:e|ing|ed)|shift(?:ing|ed)?|nudg(?:e|ing|ed)|reposition(?:ing|ed)?|adjust(?:ing|ed)?)\b[\s\S]{0,48}\bleft\b/.test(
        n,
      )
    ) {
      out.add("left");
    }
    if (
      /\b(?:mov(?:e|ing|ed)|shift(?:ing|ed)?|nudg(?:e|ing|ed)|reposition(?:ing|ed)?|adjust(?:ing|ed)?)\b[\s\S]{0,48}\bright\b/.test(
        n,
      )
    ) {
      out.add("right");
    }
  }

  return out;
}

function normalizeFeedbackText(text: string): string {
  return text
    .replace(/^\*+\s*/, "")
    .replace(/^\d+\.\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function sectionTokensFromText(text: string): string[] {
  const n = normalizeFeedbackText(text);
  const sections = [
    "summary",
    "education",
    "skills",
    "certifications",
    "languages",
    "experience",
    "projects",
    "contact",
    "header",
    "sidebar",
  ];
  return sections.filter((s) => new RegExp(`\\b${s}\\b`).test(n));
}

/** Object classes that can receive OBJECT_SPECIFIC directional intent. */
export type DirectionObjectClass =
  | "contact"
  | "role"
  | "name"
  | "heading"
  | "body"
  | "background"
  | "marker";

export type DirectionScope = "object" | "section";

const SECTION_SCOPE_RE =
  /\b(?:entire|whole|all)\b|\b(?:summary|education|skills|certifications|languages|experience|projects|header|sidebar|column)s?\s+section\b|\bsection\s+(?:of\s+)?(?:the\s+)?(?:summary|education|skills|certifications|languages|experience|projects|header|sidebar)\b|\b(?:entire|whole)\s+(?:header|sidebar|column|block)\b|\b(?:header|sidebar)\s+block\b/;

/**
 * Detect object-class nouns in directional feedback.
 * Containment phrases like "within the blue header" do not create a background
 * class — only explicit rectangle/background wording does.
 */
export function objectClassesFromText(text: string): DirectionObjectClass[] {
  const n = normalizeFeedbackText(text);
  const out: DirectionObjectClass[] = [];
  if (
    /\bcontact(?:[\s-]*information)?(?:\s+row)?\b|\bcontact\s+details?\b|\bcontact[\s-]*info\b/.test(
      n,
    )
  ) {
    out.push("contact");
  }
  if (/\brole(?:\s+title)?\b|\btitle\s+row\b/.test(n)) {
    out.push("role");
  }
  if (/\b(?:the\s+)?name\b|\bcandidate\s+name\b|\bheader\s+name\b/.test(n)) {
    out.push("name");
  }
  if (/\b(?:section\s+)?headings?\b/.test(n)) {
    out.push("heading");
  }
  if (/\bbody(?:\s+text|\s+content)?\b/.test(n)) {
    out.push("body");
  }
  if (
    /\b(?:background(?:\s+rectangle)?|header\s+rectangle|rectangle|pale[\s-]?strip|header[\s-]?band|header\s+background)\b/.test(
      n,
    )
  ) {
    out.push("background");
  }
  if (/\bmarkers?\b/.test(n)) {
    out.push("marker");
  }
  return out;
}

/**
 * OBJECT_SPECIFIC when feedback names concrete object classes and does not
 * use section/group-wide wording. Otherwise SECTION_SPECIFIC (fail-closed
 * for section-token matching).
 */
export function detectDirectionScope(text: string): DirectionScope {
  const n = normalizeFeedbackText(text);
  if (!n) return "section";
  if (SECTION_SCOPE_RE.test(n)) return "section";
  if (objectClassesFromText(n).length > 0) return "object";
  return "section";
}

function inventoryObjectForOp(
  op: CanvasOperation,
  inventory: CanvasInventoryObject[],
): CanvasInventoryObject | undefined {
  const tid = typeof op.target_id === "string" ? op.target_id.trim() : "";
  if (!tid) return undefined;
  return inventory.find((o) => o.id === tid);
}

function isContactLikeObject(obj: CanvasInventoryObject): boolean {
  const role = String(obj.role ?? "").toLowerCase();
  const id = String(obj.id ?? "").toLowerCase();
  const text = String(obj.text ?? "");
  if (/\bcontact\b/.test(role) || /\bcontact\b/.test(id)) return true;
  if (/@/.test(text)) return true;
  if (/\(\s*\d{3}\s*\)/.test(text) || /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/.test(text)) {
    return true;
  }
  return false;
}

function isBackgroundLikeObject(obj: CanvasInventoryObject): boolean {
  const role = String(obj.role ?? "").toLowerCase();
  const type = String(obj.type ?? "").toLowerCase();
  if (type === "rect" || type === "rectangle") return true;
  return /band|strip|background|bg|pale/.test(role);
}

function isNameLikeObject(obj: CanvasInventoryObject): boolean {
  const role = String(obj.role ?? "").toLowerCase();
  if (/\bname\b/.test(role) || role === "header-name") return true;
  // Header textbox without contact signals — typical name line.
  if (
    String(obj.section ?? "").toLowerCase() === "header" &&
    /text/.test(String(obj.type ?? "").toLowerCase()) &&
    !isContactLikeObject(obj) &&
    !isBackgroundLikeObject(obj)
  ) {
    return true;
  }
  return false;
}

function isRoleLikeObject(obj: CanvasInventoryObject): boolean {
  const role = String(obj.role ?? "").toLowerCase();
  if (/\brole\b/.test(role) || /\btitle\b/.test(role)) return true;
  // Combined role+contact rows (common in headers).
  if (isContactLikeObject(obj) && /text/.test(String(obj.type ?? "").toLowerCase())) {
    const text = String(obj.text ?? "");
    if (/[·|]/.test(text) || /\s{2,}/.test(text)) return true;
  }
  return false;
}

function isHeadingLikeObject(obj: CanvasInventoryObject): boolean {
  const role = String(obj.role ?? "").toLowerCase();
  return /\bheading\b/.test(role) || /\blabel\b/.test(role);
}

function isBodyLikeObject(obj: CanvasInventoryObject): boolean {
  const role = String(obj.role ?? "").toLowerCase();
  return role === "body" || /\bbody\b/.test(role);
}

function isMarkerLikeObject(obj: CanvasInventoryObject): boolean {
  const role = String(obj.role ?? "").toLowerCase();
  return /\bmarker\b/.test(role) || /\baccent\b/.test(role);
}

export function inventoryMatchesObjectClass(
  obj: CanvasInventoryObject,
  cls: DirectionObjectClass,
): boolean {
  switch (cls) {
    case "contact":
      return isContactLikeObject(obj);
    case "role":
      return isRoleLikeObject(obj);
    case "name":
      return isNameLikeObject(obj);
    case "heading":
      return isHeadingLikeObject(obj);
    case "body":
      return isBodyLikeObject(obj);
    case "background":
      return isBackgroundLikeObject(obj);
    case "marker":
      return isMarkerLikeObject(obj);
    default:
      return false;
  }
}

function feedbackAppliesToOp(input: {
  feedbackText: string;
  scope: DirectionScope;
  sections: string[];
  objectClasses: DirectionObjectClass[];
  op: CanvasOperation;
  inventory: CanvasInventoryObject[];
  section: string | null;
}): boolean {
  const { scope, sections, objectClasses, op, inventory, section } = input;
  if (scope === "object") {
    if (objectClasses.length === 0) return false;
    const obj = inventoryObjectForOp(op, inventory);
    if (!obj) return false;
    return objectClasses.some((cls) => inventoryMatchesObjectClass(obj, cls));
  }
  // SECTION_SPECIFIC — bind by section/group token overlap only.
  if (sections.length === 0) return false;
  if (!section) return false;
  return sections.some(
    (s) => section === s || section.includes(s) || s.includes(section),
  );
}

function opTargetSection(
  op: CanvasOperation,
  inventory: CanvasInventoryObject[],
): string | null {
  const tid = typeof op.target_id === "string" ? op.target_id.trim() : "";
  if (tid) {
    const hit = inventory.find((o) => o.id === tid);
    if (hit?.section) return String(hit.section).toLowerCase();
    const m = tid.match(/block-([a-z0-9-]+?)-\d/i);
    if (m?.[1]) return m[1].toLowerCase();
  }
  if (op.selector?.section) return String(op.selector.section).toLowerCase();
  return null;
}

function netDeltaTop(
  op: CanvasOperation,
  inventory: CanvasInventoryObject[],
): number | null {
  const values = op.values ?? {};
  if (finiteNum(values.delta_top)) return values.delta_top;
  if (!finiteNum(values.top)) return null;
  const tid = typeof op.target_id === "string" ? op.target_id.trim() : "";
  const cur = tid ? inventory.find((o) => o.id === tid) : undefined;
  if (!cur || !finiteNum(cur.top)) return null;
  return snapCoord(values.top - cur.top);
}

function netDeltaLeft(
  op: CanvasOperation,
  inventory: CanvasInventoryObject[],
): number | null {
  const values = op.values ?? {};
  if (finiteNum(values.delta_left)) return values.delta_left;
  if (!finiteNum(values.left)) return null;
  const tid = typeof op.target_id === "string" ? op.target_id.trim() : "";
  const cur = tid ? inventory.find((o) => o.id === tid) : undefined;
  if (!cur || !finiteNum(cur.left)) return null;
  return snapCoord(values.left - cur.left);
}

/**
 * Fail closed when an op's geometry moves opposite to explicit Founder /
 * intended_change direction for the matching target scope.
 *
 * OBJECT_SPECIFIC feedback (e.g. "move the contact row upward") binds only to
 * matching objects — mentioning a containing section ("within the header")
 * does not expand intent to every object in that section.
 *
 * SECTION_SPECIFIC feedback (e.g. "move the Languages section upward",
 * "move the entire header upward") binds to operations in that section/group.
 */
export function validatePlanVerticalDirections(input: {
  plan: RevisionPlan;
  inventory: CanvasInventoryObject[];
  requested_changes: string[];
}): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const feedbackDirs: Array<{
    text: string;
    sections: string[];
    dirs: Set<VerticalDirection>;
    scope: DirectionScope;
    objectClasses: DirectionObjectClass[];
  }> = [];

  for (const change of input.requested_changes) {
    const dirs = parseExplicitMoveDirections(change);
    if (dirs.size === 0) continue;
    feedbackDirs.push({
      text: change,
      sections: sectionTokensFromText(change),
      dirs,
      scope: detectDirectionScope(change),
      objectClasses: objectClassesFromText(change),
    });
  }

  for (let i = 0; i < input.plan.operations.length; i++) {
    const op = input.plan.operations[i]!;
    if (!isPositionOp(op.op)) continue;

    const intendedDirs = parseExplicitMoveDirections(op.intended_change ?? "");
    const fbText = op.founder_feedback_item ?? "";
    const fbDirs = parseExplicitMoveDirections(fbText);
    const section = opTargetSection(op, input.inventory);

    const matchedFeedback = feedbackDirs.filter((f) =>
      feedbackAppliesToOp({
        feedbackText: f.text,
        scope: f.scope,
        sections: f.sections,
        objectClasses: f.objectClasses,
        op,
        inventory: input.inventory,
        section,
      }),
    );

    const required = new Set<VerticalDirection>();
    // intended_change is op-local — always bind.
    for (const d of intendedDirs) required.add(d);

    // founder_feedback_item directions only when feedback scope matches target.
    if (fbDirs.size > 0 && fbText.trim()) {
      const fbApplies = feedbackAppliesToOp({
        feedbackText: fbText,
        scope: detectDirectionScope(fbText),
        sections: sectionTokensFromText(fbText),
        objectClasses: objectClassesFromText(fbText),
        op,
        inventory: input.inventory,
        section,
      });
      if (fbApplies) {
        for (const d of fbDirs) required.add(d);
      }
    }

    for (const f of matchedFeedback) {
      for (const d of f.dirs) required.add(d);
    }
    if (required.size === 0) continue;

    const dTop = netDeltaTop(op, input.inventory);
    const dLeft = netDeltaLeft(op, input.inventory);
    const eps = 0.5;

    if (required.has("up") && dTop != null && dTop > eps) {
      errors.push(
        `operations[${i}] ${op.op}: explicit upward direction contradicted by downward movement (delta_top=${dTop})`,
      );
    }
    if (required.has("down") && dTop != null && dTop < -eps) {
      errors.push(
        `operations[${i}] ${op.op}: explicit downward direction contradicted by upward movement (delta_top=${dTop})`,
      );
    }
    if (required.has("left") && dLeft != null && dLeft > eps) {
      errors.push(
        `operations[${i}] ${op.op}: explicit leftward direction contradicted by rightward movement (delta_left=${dLeft})`,
      );
    }
    if (required.has("right") && dLeft != null && dLeft < -eps) {
      errors.push(
        `operations[${i}] ${op.op}: explicit rightward direction contradicted by leftward movement (delta_left=${dLeft})`,
      );
    }
  }

  return { ok: errors.length === 0, errors };
}
