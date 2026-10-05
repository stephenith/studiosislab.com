/**
 * Pre-execution plan geometry safety.
 *
 * Simulates a revision plan on an isolated canvas clone using the same
 * executor semantics as production. Content/text growth then receives the
 * same deterministic height-sync / post-content reflow / layout-normalizer
 * owners the production pipeline applies after execute — so transient
 * pre-reflow wrap overlaps are not a false blocker. Geometry-only plans
 * are still judged on the unreflowed simulation (equal-delta collisions
 * remain fail-closed).
 *
 * A plan that remains overlapping, OOB, or page-overflowing after those
 * applicable owners still fail-closes. Does NOT replace C2 shared
 * geometry admission or FeedbackCoverage.
 */
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import { executeCanvasOperations } from "./CanvasOperationExecutor.js";
import { evaluateSharedGeometryAdmission } from "../geometry-admission/SharedGeometryAdmission.js";
import {
  applyPostContentReflow,
  isContentMutationOp,
} from "./PostContentReflow.js";
import { compileFounderFeedbackIR } from "./FounderFeedbackIR.js";
import { applyPostExecutionLayoutWorld } from "./FounderFeedbackFulfillment.js";
import {
  findOutOfBoundsObjects,
  findTextOverlapFindings,
} from "./RevisionAcceptanceChecks.js";
import {
  effectiveObjectBBox,
  isFabricTextObject,
} from "./TextEffectiveHeight.js";
import type { CanvasOperation, RevisionPlan } from "./revision-task-types.js";

export type PlanGeometryCollisionFinding = {
  code:
    | "PLAN_TEXT_OVERLAP"
    | "PLAN_PAGE_OOB"
    | "PLAN_PAGE_OVERFLOW"
    | "PLAN_EXEC_SIM_FAILED"
    | "PLAN_LAYOUT_FAILED";
  message: string;
  object_ids: string[];
  metrics: Record<string, number | string | null>;
};

export type PlanGeometrySafetyReport = {
  schema_version: "founder-plan-geometry-safety-1.1.0";
  at: string;
  ok: boolean;
  error: string | null;
  simulation_ok: boolean;
  layout_applied: boolean;
  text_overlaps: number;
  page_oob: number;
  page_overflow: number;
  findings: PlanGeometryCollisionFinding[];
  mutated_object_ids: string[];
  proposed_positions: Array<{
    id: string;
    top: number | null;
    left: number | null;
    stored_height: number | null;
    effective_height: number | null;
    effective_bottom: number | null;
  }>;
};

function objectId(o: Record<string, unknown>, index: number): string {
  if (typeof o.id === "string" && o.id.trim()) return o.id;
  const data = o.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const id = (data as { id?: unknown }).id;
    if (typeof id === "string" && id.trim()) return id;
  }
  return `obj-${index}`;
}

function mutatedIdsFromPlan(plan: RevisionPlan): Set<string> {
  const ids = new Set<string>();
  for (const op of plan.operations) {
    collectOpTargets(op, ids);
  }
  return ids;
}

function collectOpTargets(op: CanvasOperation, ids: Set<string>): void {
  if (typeof op.target_id === "string" && op.target_id.trim()) {
    ids.add(op.target_id.trim());
  }
  if (Array.isArray(op.target_ids)) {
    for (const id of op.target_ids) {
      if (typeof id === "string" && id.trim()) ids.add(id.trim());
    }
  }
}

function proposedPositions(
  canvas: FabricCanvasDoc,
  onlyIds?: Set<string>,
): PlanGeometrySafetyReport["proposed_positions"] {
  const out: PlanGeometrySafetyReport["proposed_positions"] = [];
  const objects = canvas.objects ?? [];
  for (let i = 0; i < objects.length; i++) {
    const o = objects[i]!;
    if (!isFabricTextObject(o)) continue;
    const id = objectId(o, i);
    if (onlyIds && !onlyIds.has(id)) continue;
    const box = effectiveObjectBBox(o);
    out.push({
      id,
      top: typeof o.top === "number" ? o.top : null,
      left: typeof o.left === "number" ? o.left : null,
      stored_height: typeof o.height === "number" ? o.height : null,
      effective_height: box.height,
      effective_bottom: box.bottom,
    });
  }
  return out;
}

function planHasContentMutation(plan: RevisionPlan): boolean {
  return plan.operations.some((op) => isContentMutationOp(op));
}

/**
 * Deterministic pre-execution geometry gate.
 * Mutates nothing in the caller's canvas (executor clones internally).
 */
export function validatePlanGeometrySafety(input: {
  canvas: FabricCanvasDoc;
  plan: RevisionPlan;
  requested_changes?: string[];
}): PlanGeometrySafetyReport {
  const at = new Date().toISOString();
  const findings: PlanGeometryCollisionFinding[] = [];
  const mutated = mutatedIdsFromPlan(input.plan);

  const simulated = executeCanvasOperations({
    canvas: input.canvas,
    operations: input.plan.operations,
  });

  if (!simulated.ok) {
    findings.push({
      code: "PLAN_EXEC_SIM_FAILED",
      message: simulated.error ?? "plan simulation failed",
      object_ids: [],
      metrics: {},
    });
    return {
      schema_version: "founder-plan-geometry-safety-1.1.0",
      at,
      ok: false,
      error: `plan geometry simulation failed: ${simulated.error ?? "unknown"}`,
      simulation_ok: false,
      layout_applied: false,
      text_overlaps: 0,
      page_oob: 0,
      page_overflow: 0,
      findings,
      mutated_object_ids: [...mutated],
      proposed_positions: [],
    };
  }

  let evalCanvas = simulated.canvas;
  let layoutApplied = false;
  const requested = input.requested_changes ?? [];
  const ir = compileFounderFeedbackIR(requested);
  const hasIrLayout = ir.items.some((item) =>
    (item.fulfillment ?? []).some(
      (p) =>
        p.kind === "PRESENTATION" ||
        p.kind === "RELATIONAL_ALIGNMENT" ||
        p.kind === "STYLE",
    ),
  );
  const needsWorld = planHasContentMutation(input.plan) || hasIrLayout;
  const needsContentReflow = input.plan.operations.some((op) => {
    switch (op.op) {
      case "update_text":
      case "add_object":
      case "adjust_font_size":
      case "adjust_line_height":
        return true;
      default:
        return false;
    }
  });
  if (needsWorld) {
    if (needsContentReflow) {
      const reflowed = applyPostContentReflow({ canvas: evalCanvas });
      evalCanvas = reflowed.canvas;
    }
    const world = applyPostExecutionLayoutWorld({
      canvas: evalCanvas,
      ir,
      requested_changes: requested,
      prior_canvas: input.canvas,
    });
    evalCanvas = world.canvas;
    layoutApplied = true;
    const normalized = world.normalized;
    if (!normalized.report.ok) {
      findings.push({
        code: "PLAN_LAYOUT_FAILED",
        message: normalized.report.error ?? "deterministic layout failed",
        object_ids: [...mutated],
        metrics: {},
      });
    }
    if (normalized.report.page_overflow) {
      findings.push({
        code: "PLAN_PAGE_OVERFLOW",
        message: "plan geometry safety failed: page overflow after layout",
        object_ids: [...mutated],
        metrics: {
          page_overflow_bottom: normalized.report.page_overflow_bottom,
        },
      });
    }
    const admission = evaluateSharedGeometryAdmission(evalCanvas);
    if (!admission.page_fit_pass && !normalized.report.page_overflow) {
      findings.push({
        code: "PLAN_PAGE_OVERFLOW",
        message: `plan geometry safety failed: page_fit=${admission.page_fit_pass}`,
        object_ids: [...mutated],
        metrics: { page_overflow_px: admission.page_overflow_px },
      });
    }
  }

  const overlapFindings = findTextOverlapFindings(evalCanvas);
  for (const f of overlapFindings) {
    const involvesMutated =
      mutated.size === 0
        ? false
        : f.object_ids.some((id) => mutated.has(id));
    if (!layoutApplied && !involvesMutated) continue;
    findings.push({
      code: "PLAN_TEXT_OVERLAP",
      message: f.message,
      object_ids: f.object_ids,
      metrics: {
        gap: typeof f.metrics?.gap === "number" ? f.metrics.gap : null,
        overlapX:
          typeof f.metrics?.overlapX === "number" ? f.metrics.overlapX : null,
      },
    });
  }

  const oob = findOutOfBoundsObjects(evalCanvas).filter(
    (f) => f.code !== "ACC_BOUNDS_UNEVALUABLE",
  );
  for (const f of oob) {
    const involvesMutated =
      mutated.size === 0
        ? false
        : f.object_ids.some((id) => mutated.has(id));
    if (!layoutApplied && !involvesMutated) continue;
    findings.push({
      code: "PLAN_PAGE_OOB",
      message: f.message,
      object_ids: f.object_ids,
      metrics: { ...(f.metrics as Record<string, number | string | null>) },
    });
  }

  const textOverlaps = findings.filter((f) => f.code === "PLAN_TEXT_OVERLAP")
    .length;
  const pageOob = findings.filter((f) => f.code === "PLAN_PAGE_OOB").length;
  const pageOverflow = findings.filter((f) => f.code === "PLAN_PAGE_OVERFLOW")
    .length;
  const ok = findings.length === 0;
  return {
    schema_version: "founder-plan-geometry-safety-1.1.0",
    at,
    ok,
    error: ok
      ? null
      : `plan geometry safety failed: text_overlaps=${textOverlaps} page_oob=${pageOob}${
          pageOverflow ? ` page_overflow=${pageOverflow}` : ""
        }`,
    simulation_ok: true,
    layout_applied: layoutApplied,
    text_overlaps: textOverlaps,
    page_oob: pageOob,
    page_overflow: pageOverflow,
    findings,
    mutated_object_ids: [...mutated],
    proposed_positions: proposedPositions(
      evalCanvas,
      mutated.size > 0 ? mutated : undefined,
    ),
  };
}
