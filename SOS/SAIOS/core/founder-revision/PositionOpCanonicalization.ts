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

/**
 * Parse explicit vertical/horizontal direction from Founder or intended_change text.
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
  if (/\b(upward|upwards|higher)\b/.test(n) || /\bmove\b[\s\S]{0,40}\bup\b/.test(n)) {
    out.add("up");
  }
  if (
    /\b(downward|downwards|lower)\b/.test(n) ||
    /\bmove\b[\s\S]{0,40}\bdown\b/.test(n)
  ) {
    out.add("down");
  }
  if (/\b(leftward)\b/.test(n) || /\bmove\b[\s\S]{0,40}\bleft\b/.test(n)) {
    out.add("left");
  }
  if (/\b(rightward)\b/.test(n) || /\bmove\b[\s\S]{0,40}\bright\b/.test(n)) {
    out.add("right");
  }
  return out;
}

function sectionTokensFromText(text: string): string[] {
  const n = text.toLowerCase();
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
  ];
  return sections.filter((s) => new RegExp(`\\b${s}\\b`).test(n));
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
 * intended_change direction for the same section (e.g. "move Languages upward"
 * must not produce positive delta_top).
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
  }> = [];

  for (const change of input.requested_changes) {
    const dirs = parseExplicitMoveDirections(change);
    if (dirs.size === 0) continue;
    feedbackDirs.push({
      text: change,
      sections: sectionTokensFromText(change),
      dirs,
    });
  }

  for (let i = 0; i < input.plan.operations.length; i++) {
    const op = input.plan.operations[i]!;
    if (!isPositionOp(op.op)) continue;

    const intendedDirs = parseExplicitMoveDirections(op.intended_change ?? "");
    const fbText = op.founder_feedback_item ?? "";
    const fbDirs = parseExplicitMoveDirections(fbText);
    const fbSections = sectionTokensFromText(fbText);
    const section = opTargetSection(op, input.inventory);

    const matchedFeedback = feedbackDirs.filter((f) => {
      if (f.sections.length === 0) return false;
      if (!section) return false;
      return f.sections.some(
        (s) => section === s || section.includes(s) || s.includes(section),
      );
    });

    const required = new Set<VerticalDirection>();
    // intended_change is op-local — always bind.
    for (const d of intendedDirs) required.add(d);
    // founder_feedback_item directions only when FB section matches the target
    // (avoids multi-attributed "Move Summary down" constraining Education ops).
    const fbSectionMatches =
      fbSections.length === 0
        ? false
        : section != null &&
          fbSections.some(
            (s) => section === s || section.includes(s) || s.includes(section),
          );
    if (fbSectionMatches) {
      for (const d of fbDirs) required.add(d);
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
