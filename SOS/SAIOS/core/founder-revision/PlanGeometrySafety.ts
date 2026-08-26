/**
 * Pre-execution plan geometry safety.
 *
 * Simulates a revision plan on an isolated canvas clone using the same
 * executor semantics as production, then checks wrap-aware text overlaps
 * involving plan-touched objects and obvious page-bound violations BEFORE
 * executeCanvasOperations mutates the working pipeline canvas.
 *
 * Pre-existing overlaps among completely untouched objects are left to the
 * normalizer / final acceptance — this gate answers whether the proposed
 * mutations themselves are geometrically capable (e.g. reject equal-delta
 * moves that preserve an effective collision).
 *
 * Does NOT replace final RevisionAcceptanceChecks / FeedbackCoverage.
 */
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import { executeCanvasOperations } from "./CanvasOperationExecutor.js";
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
  code: "PLAN_TEXT_OVERLAP" | "PLAN_PAGE_OOB" | "PLAN_EXEC_SIM_FAILED";
  message: string;
  object_ids: string[];
  metrics: Record<string, number | string | null>;
};

export type PlanGeometrySafetyReport = {
  schema_version: "founder-plan-geometry-safety-1.0.0";
  at: string;
  ok: boolean;
  error: string | null;
  simulation_ok: boolean;
  text_overlaps: number;
  page_oob: number;
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

/**
 * Deterministic pre-execution geometry gate.
 * Mutates nothing in the caller's canvas (executor clones internally).
 */
export function validatePlanGeometrySafety(input: {
  canvas: FabricCanvasDoc;
  plan: RevisionPlan;
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
      schema_version: "founder-plan-geometry-safety-1.0.0",
      at,
      ok: false,
      error: `plan geometry simulation failed: ${simulated.error ?? "unknown"}`,
      simulation_ok: false,
      text_overlaps: 0,
      page_oob: 0,
      findings,
      mutated_object_ids: [...mutated],
      proposed_positions: [],
    };
  }

  const overlapFindings = findTextOverlapFindings(simulated.canvas);
  for (const f of overlapFindings) {
    const involvesMutated =
      mutated.size === 0
        ? false
        : f.object_ids.some((id) => mutated.has(id));
    if (!involvesMutated) continue;
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

  // Page OOB: only fail when a mutated object (or any object if plan is empty
  // and somehow creates OOB — empty plan cannot) is out of bounds after sim.
  const oob = findOutOfBoundsObjects(simulated.canvas).filter(
    (f) => f.code !== "ACC_BOUNDS_UNEVALUABLE",
  );
  for (const f of oob) {
    const involvesMutated =
      mutated.size === 0
        ? false
        : f.object_ids.some((id) => mutated.has(id));
    if (!involvesMutated) continue;
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
  const ok = findings.length === 0;
  return {
    schema_version: "founder-plan-geometry-safety-1.0.0",
    at,
    ok,
    error: ok
      ? null
      : `plan geometry safety failed: text_overlaps=${textOverlaps} page_oob=${pageOob}`,
    simulation_ok: true,
    text_overlaps: textOverlaps,
    page_oob: pageOob,
    findings,
    mutated_object_ids: [...mutated],
    proposed_positions: proposedPositions(
      simulated.canvas,
      mutated.size > 0 ? mutated : undefined,
    ),
  };
}
