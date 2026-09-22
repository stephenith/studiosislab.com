/**
 * Phase 6N — one shared canonicalize → normalize → shape-validate pipeline
 * for every revision-plan origin.
 *
 * Deterministic only. No provider calls. Does not weaken schema validation.
 * set_position remains position-only; dimension aliases become canonical
 * set_dimensions ops when the transformation is unambiguous.
 */
import type { CanvasInventoryObject } from "./revision-task-types.js";
import type {
  RevisionPlan,
  RevisionPlanOrigin,
} from "./revision-task-types.js";
import { canonicalizeRevisionPlanHorizontalOwnership } from "./EquivalentHorizontalOwnership.js";
import {
  stripIdentityPositionOps,
  stripNonExecutablePositionOpsFromRaw,
} from "./PositionOpCanonicalization.js";
import {
  repairAiPlanFounderAttribution,
  type ProvenanceRepairRecord,
} from "./RevisionPlanProvenanceRepair.js";
import {
  allRequestedChangesAllowEmptyPlan,
  validateRevisionPlanShapeAndOperations,
} from "./RevisionPromptBuilder.js";

export const REVISION_PLAN_PREPARATION_PIPELINE_COUNT = 1;
export const REVISION_PLANNING_MAX_PROVIDER_CALLS = 2;

export const REVISION_PLAN_ORIGINS: readonly RevisionPlanOrigin[] = [
  "PRIMARY",
  "SHAPE_REPAIR",
  "COVERAGE_REPAIR",
  "CONFLICT_REPAIR",
  "DETERMINISTIC_LAYOUT",
];

const POSITION_OPS = new Set(["set_position", "move_object"]);
const DIMENSION_OPS = new Set([
  "set_dimensions",
  "resize_object",
  "extend_shape",
]);

const POSITION_KEYS = new Set(["left", "top", "delta_left", "delta_top"]);
const POSITION_PASSTHROUGH_KEYS = new Set(["fill"]);

const DIMENSION_ALIAS_TO_CANONICAL: Record<string, string> = {
  w: "width",
  h: "height",
  width: "width",
  height: "height",
  delta_w: "delta_width",
  delta_h: "delta_height",
  delta_width: "delta_width",
  delta_height: "delta_height",
};

const DIMENSION_KEYS = new Set(Object.keys(DIMENSION_ALIAS_TO_CANONICAL));

function finiteNum(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function cloneMeta(op: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of [
    "target_id",
    "target_ids",
    "selector",
    "before_summary",
    "intended_change",
    "founder_feedback_item",
    "founder_feedback_items",
    "confidence",
    "plan_origin",
  ]) {
    if (key in op) out[key] = op[key];
  }
  return out;
}

function hasExecutablePosition(values: Record<string, unknown>): boolean {
  return (
    finiteNum(values.left) ||
    finiteNum(values.top) ||
    finiteNum(values.delta_left) ||
    finiteNum(values.delta_top)
  );
}

function collectDimensionIntents(
  values: Record<string, unknown>,
  prefix: string,
): { ok: true; dims: Record<string, number> } | { ok: false; errors: string[] } {
  const dims: Record<string, number> = {};
  const errors: string[] = [];
  for (const [key, raw] of Object.entries(values)) {
    if (!DIMENSION_KEYS.has(key)) continue;
    if (raw == null) continue;
    if (!finiteNum(raw)) {
      errors.push(
        `plan_canonicalization: ${prefix}: values.${key} must be a finite number`,
      );
      continue;
    }
    const canon = DIMENSION_ALIAS_TO_CANONICAL[key]!;
    if (canon in dims && dims[canon] !== raw) {
      errors.push(
        `plan_canonicalization: ${prefix}: conflicting ${canon} intents (${dims[canon]} vs ${raw})`,
      );
      continue;
    }
    dims[canon] = raw;
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, dims };
}

function unknownGeometryKeys(
  op: string,
  values: Record<string, unknown>,
): string[] {
  const unknown: string[] = [];
  for (const key of Object.keys(values)) {
    if (POSITION_KEYS.has(key) || DIMENSION_KEYS.has(key)) continue;
    if (POSITION_OPS.has(op) && POSITION_PASSTHROUGH_KEYS.has(key)) continue;
    unknown.push(key);
  }
  return unknown;
}

function stampOrigin(
  op: Record<string, unknown>,
  origin?: RevisionPlanOrigin,
): Record<string, unknown> {
  if (!origin) return op;
  if (typeof op.plan_origin === "string" && op.plan_origin.trim()) return op;
  return { ...op, plan_origin: origin };
}

/**
 * Deterministic rewrite of mixed position+dimension operations and aliases.
 * Fail closed on unknown keys, nonnumeric dimensions, or conflicting aliases.
 * Does not invent geometry values.
 */
export function canonicalizeRevisionPlanOperations(
  raw: unknown,
  opts?: { origin?: RevisionPlanOrigin },
): {
  raw: unknown;
  errors: string[];
  split_count: number;
  alias_rewrites: number;
} {
  if (!isRecord(raw) || !Array.isArray(raw.operations)) {
    return { raw, errors: [], split_count: 0, alias_rewrites: 0 };
  }
  const origin = opts?.origin;
  const operations: unknown[] = [];
  const errors: string[] = [];
  let split_count = 0;
  let alias_rewrites = 0;

  for (let i = 0; i < raw.operations.length; i++) {
    const item = raw.operations[i];
    if (!isRecord(item)) {
      operations.push(item);
      continue;
    }
    const op = String(item.op ?? "");
    const prefix = `operations[${i}] ${op || "unknown"}`;
    const values = isRecord(item.values) ? { ...item.values } : null;

    if (!values || (!POSITION_OPS.has(op) && !DIMENSION_OPS.has(op))) {
      operations.push(stampOrigin(item, origin));
      continue;
    }

    const unknown = unknownGeometryKeys(op, values);
    if (unknown.length > 0) {
      errors.push(
        `plan_canonicalization: ${prefix}: unknown geometry key ${unknown
          .map((k) => JSON.stringify(k))
          .join(", ")}`,
      );
      operations.push(stampOrigin(item, origin));
      continue;
    }

    const collected = collectDimensionIntents(values, prefix);
    if (!collected.ok) {
      errors.push(...collected.errors);
      operations.push(stampOrigin(item, origin));
      continue;
    }

    if (POSITION_OPS.has(op)) {
      const posValues: Record<string, unknown> = {};
      for (const key of POSITION_KEYS) {
        if (key in values) posValues[key] = values[key];
      }
      if (typeof values.fill === "string") posValues.fill = values.fill;
      const hasPos = hasExecutablePosition(posValues);
      const hasDim = Object.keys(collected.dims).length > 0;
      const meta = cloneMeta(item);

      if (hasPos && hasDim) {
        operations.push(
          stampOrigin(
            { ...meta, op, values: posValues },
            origin,
          ),
        );
        operations.push(
          stampOrigin(
            {
              ...meta,
              op: "set_dimensions",
              values: { ...collected.dims },
              intended_change:
                typeof meta.intended_change === "string"
                  ? meta.intended_change
                  : item.intended_change,
            },
            origin,
          ),
        );
        split_count += 1;
        continue;
      }
      if (!hasPos && hasDim) {
        operations.push(
          stampOrigin(
            {
              ...meta,
              op: "set_dimensions",
              values: { ...collected.dims },
            },
            origin,
          ),
        );
        split_count += 1;
        continue;
      }
      operations.push(stampOrigin({ ...item, values: posValues }, origin));
      continue;
    }

    // Compatible dimension op: rewrite aliases to canonical keys only.
    const nextValues: Record<string, unknown> = {};
    for (const key of POSITION_KEYS) {
      if (key in values) nextValues[key] = values[key];
    }
    for (const [canon, n] of Object.entries(collected.dims)) {
      nextValues[canon] = n;
    }
    const rewritten = DIMENSION_ALIAS_TO_CANONICAL
      ? Object.keys(values).some((k) =>
          k === "w" || k === "h" || k === "delta_w" || k === "delta_h",
        )
      : false;
    if (rewritten) alias_rewrites += 1;
    operations.push(stampOrigin({ ...item, values: nextValues }, origin));
  }

  return {
    raw: { ...raw, operations },
    errors,
    split_count,
    alias_rewrites,
  };
}

export function prepareRevisionPlanForValidation(input: {
  extracted: unknown;
  inventory: CanvasInventoryObject[];
  requested_changes: string[];
  origin: RevisionPlanOrigin;
  allowEmptyOperations?: boolean;
}): {
  ok: boolean;
  plan: RevisionPlan | null;
  errors: string[];
  provenance_repairs?: ProvenanceRepairRecord[];
  canonicalization?: {
    split_count: number;
    alias_rewrites: number;
  };
} {
  const allowEmpty =
    input.allowEmptyOperations ??
    allRequestedChangesAllowEmptyPlan(input.requested_changes);
  const provenance = repairAiPlanFounderAttribution({
    extracted: input.extracted,
    requested_changes: input.requested_changes,
  });
  const canonical = canonicalizeRevisionPlanOperations(provenance.repaired, {
    origin: input.origin,
  });
  if (canonical.errors.length > 0) {
    return {
      ok: false,
      plan: null,
      errors: canonical.errors,
      provenance_repairs: provenance.repairs,
      canonicalization: {
        split_count: canonical.split_count,
        alias_rewrites: canonical.alias_rewrites,
      },
    };
  }
  const strippedEmpty = stripNonExecutablePositionOpsFromRaw(canonical.raw);
  let shape = validateRevisionPlanShapeAndOperations(strippedEmpty.raw, {
    requested_changes: input.requested_changes,
    allowEmptyOperations: allowEmpty,
    inventory: input.inventory,
  });
  if (!shape.ok || !shape.plan) {
    return {
      ok: false,
      plan: null,
      errors: shape.errors,
      provenance_repairs: provenance.repairs,
      canonicalization: {
        split_count: canonical.split_count,
        alias_rewrites: canonical.alias_rewrites,
      },
    };
  }
  const identity = stripIdentityPositionOps(shape.plan, input.inventory);
  if (identity.stripped_count > 0) {
    shape = validateRevisionPlanShapeAndOperations(identity.plan, {
      requested_changes: input.requested_changes,
      allowEmptyOperations: allowEmpty,
      inventory: input.inventory,
    });
    if (!shape.ok || !shape.plan) {
      return {
        ok: false,
        plan: null,
        errors: shape.errors,
        provenance_repairs: provenance.repairs,
        canonicalization: {
          split_count: canonical.split_count,
          alias_rewrites: canonical.alias_rewrites,
        },
      };
    }
  }
  const owned = canonicalizeRevisionPlanHorizontalOwnership(shape.plan);
  const stamped: RevisionPlan = {
    ...owned,
    operations: owned.operations.map((op) =>
      op.plan_origin
        ? op
        : {
            ...op,
            plan_origin: input.origin,
          },
    ),
  };
  return {
    ok: true,
    plan: stamped,
    errors: [],
    provenance_repairs: provenance.repairs,
    canonicalization: {
      split_count: canonical.split_count,
      alias_rewrites: canonical.alias_rewrites,
    },
  };
}

/** Alias kept so existing callers share the exact same implementation. */
export function prepareExtractedPlanForValidation(input: {
  extracted: unknown;
  inventory: CanvasInventoryObject[];
  requested_changes: string[];
  origin?: RevisionPlanOrigin;
  allowEmptyOperations?: boolean;
}): ReturnType<typeof prepareRevisionPlanForValidation> {
  return prepareRevisionPlanForValidation({
    extracted: input.extracted,
    inventory: input.inventory,
    requested_changes: input.requested_changes,
    origin: input.origin ?? "PRIMARY",
    allowEmptyOperations: input.allowEmptyOperations,
  });
}
