/**
 * Deterministic plan-internal + repair-vs-primary geometry conflict detection.
 * Fail closed. No auto-rewrite.
 */
import type { CanvasOperation } from "./revision-task-types.js";

const ABSOLUTE_GEOM_KEYS = ["left", "top", "width", "height"] as const;
const DELTA_GEOM_KEYS = [
  "delta_left",
  "delta_top",
  "delta_width",
  "delta_height",
] as const;
const GEOM_FAMILY_KEYS = [...ABSOLUTE_GEOM_KEYS, ...DELTA_GEOM_KEYS] as const;

function finiteNum(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function stableValuesJson(values: Record<string, unknown>): string {
  const keys = Object.keys(values).sort();
  const ordered: Record<string, unknown> = {};
  for (const k of keys) ordered[k] = values[k];
  return JSON.stringify(ordered);
}

function targetKey(op: CanvasOperation): string {
  if (op.target_ids && op.target_ids.length > 0) {
    return `ids:${[...op.target_ids].map((s) => s.trim()).sort().join(",")}`;
  }
  if (op.target_id) return `id:${op.target_id.trim()}`;
  return "id:";
}

export function operationMutationFingerprint(op: CanvasOperation): string {
  return `${op.op}|${targetKey(op)}|${stableValuesJson(op.values ?? {})}`;
}

export function targetIdsOf(op: CanvasOperation): string[] {
  if (op.target_ids && op.target_ids.length > 0) {
    return op.target_ids.map((s) => s.trim()).filter(Boolean);
  }
  if (op.target_id) return [op.target_id.trim()];
  return [];
}

/** Geometry axes touched by an operation's values (left/top/width/height families + align_left). */
export function geomAxesPresent(values: Record<string, unknown>): Set<string> {
  const out = new Set<string>();
  for (const k of GEOM_FAMILY_KEYS) {
    if (finiteNum(values[k])) {
      out.add(k.replace(/^delta_/, ""));
    }
  }
  if (finiteNum(values.align_left)) {
    // Horizontal alignment competes with left-axis mutations.
    out.add("left");
  }
  return out;
}

export function geomKeysPresent(values: Record<string, unknown>): Set<string> {
  const out = new Set<string>();
  for (const k of GEOM_FAMILY_KEYS) {
    if (finiteNum(values[k])) out.add(k);
  }
  if (finiteNum(values.align_left)) out.add("align_left");
  return out;
}

/**
 * True when two ops share a target and mutate overlapping geometry axes.
 * Independent axes (e.g. left-only vs top-only) do not conflict.
 */
export function operationsConflictOnSharedGeometry(
  a: CanvasOperation,
  b: CanvasOperation,
): { conflict: boolean; sharedTargets: string[]; axes: string[] } {
  const aTargets = new Set(targetIdsOf(a));
  const sharedTargets = targetIdsOf(b).filter((id) => aTargets.has(id));
  if (sharedTargets.length === 0) {
    return { conflict: false, sharedTargets: [], axes: [] };
  }
  const aAxes = geomAxesPresent(a.values ?? {});
  const bAxes = geomAxesPresent(b.values ?? {});
  if (aAxes.size === 0 || bAxes.size === 0) {
    return { conflict: false, sharedTargets, axes: [] };
  }
  const axes = [...aAxes].filter((axis) => bAxes.has(axis));
  return { conflict: axes.length > 0, sharedTargets, axes };
}

/**
 * Detect conflicts within a single RevisionPlan before repair/execution.
 * A) exact duplicate mutation fingerprint
 * B) same-target overlapping geometry axis
 */
export function detectInternalPlanMutationConflicts(
  operations: CanvasOperation[],
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const seenFp = new Map<string, number>();

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i]!;
    const fp = operationMutationFingerprint(op);
    const prev = seenFp.get(fp);
    if (prev != null) {
      errors.push(
        `plan mutation conflict: operations[${prev}] and operations[${i}] are exact duplicate mutations (op+target+values)`,
      );
    } else {
      seenFp.set(fp, i);
    }
  }

  for (let i = 0; i < operations.length; i++) {
    for (let j = i + 1; j < operations.length; j++) {
      const a = operations[i]!;
      const b = operations[j]!;
      // Exact duplicates already reported; still report axis conflict only when fingerprints differ.
      if (operationMutationFingerprint(a) === operationMutationFingerprint(b)) {
        continue;
      }
      const hit = operationsConflictOnSharedGeometry(a, b);
      if (hit.conflict) {
        errors.push(
          `plan mutation conflict: operations[${i}] and operations[${j}] conflict on shared target geometry (${hit.sharedTargets.join(",")}) axes=[${hit.axes.join(",")}]`,
        );
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Reject exact duplicates and same-target geometry conflicts between repair and primary.
 * Relative move after absolute set on the same target fails closed.
 */
export function detectRepairMergeConflicts(
  primaryOps: CanvasOperation[],
  repairOps: CanvasOperation[],
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const primaryFingerprints = new Set(
    primaryOps.map(operationMutationFingerprint),
  );

  for (let ri = 0; ri < repairOps.length; ri++) {
    const repair = repairOps[ri]!;
    const fp = operationMutationFingerprint(repair);
    if (primaryFingerprints.has(fp)) {
      errors.push(
        `coverage repair merge conflict: repair operations[${ri}] is an exact duplicate of a primary mutation (op+target+values)`,
      );
      continue;
    }

    const repairTargets = new Set(targetIdsOf(repair));
    const repairGeom = geomKeysPresent(repair.values ?? {});
    if (repairTargets.size === 0 || repairGeom.size === 0) continue;

    for (let pi = 0; pi < primaryOps.length; pi++) {
      const primary = primaryOps[pi]!;
      const hit = operationsConflictOnSharedGeometry(primary, repair);
      if (hit.conflict) {
        errors.push(
          `coverage repair merge conflict: repair operations[${ri}] conflicts with primary operations[${pi}] on shared target geometry (${hit.sharedTargets.join(",")})`,
        );
        break;
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
