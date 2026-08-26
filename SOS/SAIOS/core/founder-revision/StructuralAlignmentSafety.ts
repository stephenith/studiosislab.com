/**
 * Inventory/canvas-aware structural alignment safety for Founder revision plans.
 * Fail closed. No auto-rewrite / no silent clamp of unsafe align_objects.
 */
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import type { RevisionPlan } from "./revision-task-types.js";
import {
  CONTENT_GRID_LEFT_TOLERANCE_PX,
  detectLayoutLanesFromCanvas,
  inspectRevisionSectionGroups,
} from "./RevisionLayoutNormalizer.js";

const PAGE_EDGE_TOLERANCE_PX = 0.5;
/** Width ≥ this fraction of page width → treated as page-spanning structural. */
export const FULL_WIDTH_STRUCTURAL_RATIO = 0.85;

/** Identifiable rejection: align_objects cohort spans ≥2 established body lanes. */
export const CROSS_LANE_ALIGNMENT_NOT_ALLOWED =
  "CROSS_LANE_ALIGNMENT_NOT_ALLOWED";

/** Identifiable rejection: align_left would place a target outside its lane band. */
export const ALIGN_LEFT_OUTSIDE_TARGET_LANE =
  "ALIGN_LEFT_OUTSIDE_TARGET_LANE";

/**
 * Identifiable rejection: one align_objects cohort mixes distinct section-unit
 * horizontal roles (marker / heading / body). A single align_left cannot
 * preserve established relative offsets between those roles.
 */
export const MIXED_SECTION_UNIT_ALIGNMENT_NOT_ALLOWED =
  "MIXED_SECTION_UNIT_ALIGNMENT_NOT_ALLOWED";

export type SectionUnitHorizontalRole = "marker" | "heading" | "body";

/**
 * Map inventory object IDs to section-unit horizontal roles using the existing
 * RevisionLayoutNormalizer section classifier. Unclassified IDs are omitted
 * (fail-open for header/unknown objects).
 */
export function sectionUnitHorizontalRoleByObjectId(
  canvas: FabricCanvasDoc,
): Map<string, SectionUnitHorizontalRole> {
  const map = new Map<string, SectionUnitHorizontalRole>();
  for (const g of inspectRevisionSectionGroups(canvas)) {
    if (g.heading_rect_id) map.set(g.heading_rect_id, "marker");
    if (g.heading_text_id) map.set(g.heading_text_id, "heading");
    for (const id of g.body_ids) map.set(id, "body");
  }
  return map;
}

/**
 * Horizontal tolerance for lane-boundary checks — matches content-grid convention.
 * Must stay small so obvious cross-lane moves (e.g. 296→60) fail closed.
 */
export const ALIGN_LANE_BOUNDARY_TOLERANCE_PX = CONTENT_GRID_LEFT_TOLERANCE_PX;

type FabricObj = Record<string, unknown> & {
  type?: string;
  id?: string;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  scaleX?: number;
  scaleY?: number;
  data?: Record<string, unknown>;
  role?: string;
};

function objectId(o: FabricObj, index: number): string {
  if (typeof o.id === "string" && o.id.trim()) return o.id;
  const data = o.data;
  if (data && typeof data.id === "string" && data.id.trim()) return data.id;
  return `obj-${index}`;
}

function finite(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function effectiveWidth(o: FabricObj): number {
  return Number(o.width ?? 0) * Number(o.scaleX ?? 1);
}

function roleOf(o: FabricObj): string {
  return String(o.data?.role ?? o.role ?? "")
    .trim()
    .toLowerCase();
}

function isRect(o: FabricObj): boolean {
  return String(o.type ?? "")
    .toLowerCase()
    .includes("rect");
}

function isSystemBg(o: FabricObj): boolean {
  const data = o.data;
  if (!data) return false;
  return (
    data.system === true ||
    data.kind === "page-bg" ||
    data.role === "pageBackground" ||
    o.role === "pageBackground"
  );
}

/**
 * Structural container / full-width band — not ordinary content.
 * Ordinary header textboxes are NOT structural.
 */
export function isStructuralAlignTarget(
  o: FabricObj,
  pageWidth: number,
): boolean {
  if (isSystemBg(o)) return true;
  const role = roleOf(o);
  if (
    role === "header-band" ||
    role === "pagebackground" ||
    role === "sidebar-bg" ||
    role === "column-bg" ||
    role === "decorative" ||
    role === "background" ||
    role === "page-bg"
  ) {
    return true;
  }
  if (isRect(o) && pageWidth > 0) {
    const w = effectiveWidth(o);
    if (w >= pageWidth * FULL_WIDTH_STRUCTURAL_RATIO) return true;
  }
  return false;
}

function findById(
  objects: FabricObj[],
  id: string,
): { obj: FabricObj; index: number } | null {
  const exact = objects.findIndex((o, j) => objectId(o, j) === id);
  if (exact >= 0) return { obj: objects[exact]!, index: exact };
  return null;
}

export type AlignObjectsSafetyResult = {
  ok: boolean;
  errors: string[];
};

/**
 * Validate a single align_objects cohort against canvas geometry.
 * Rejects structural+content mixes, out-of-bounds simulated lefts, and
 * cross-lane / out-of-lane-band alignments when ≥2 body lanes exist.
 */
export function validateAlignObjectsSafety(input: {
  targets: FabricObj[];
  target_ids: string[];
  align_left: number;
  page_width: number;
  page_height: number;
  operation_index?: number;
  /** Prior canvas for authoritative lane detection (preferred). */
  canvas?: FabricCanvasDoc;
}): AlignObjectsSafetyResult {
  const errors: string[] = [];
  const prefix =
    input.operation_index != null
      ? `operations[${input.operation_index}] align_objects`
      : "align_objects";
  const pageW = input.page_width;
  const alignLeft = input.align_left;

  if (!Number.isFinite(alignLeft)) {
    return { ok: false, errors: [`${prefix}: values.align_left must be finite`] };
  }

  const structural: string[] = [];
  const ordinary: string[] = [];

  for (let i = 0; i < input.targets.length; i++) {
    const t = input.targets[i]!;
    const id = input.target_ids[i] ?? objectId(t, i);
    if (isSystemBg(t)) {
      errors.push(
        `${prefix}: refuses system/page background target_id=${id}`,
      );
      continue;
    }
    if (isStructuralAlignTarget(t, pageW)) {
      structural.push(id);
    } else {
      ordinary.push(id);
    }

    const w = effectiveWidth(t);
    const newLeft = alignLeft;
    const newRight = newLeft + w;
    if (
      newLeft < -PAGE_EDGE_TOLERANCE_PX ||
      newRight > pageW + PAGE_EDGE_TOLERANCE_PX
    ) {
      errors.push(
        `${prefix}: proposed align_left=${alignLeft} places target_id=${id} outside page bounds (left=${newLeft.toFixed(1)} right=${newRight.toFixed(1)} page_width=${pageW})`,
      );
    }
  }

  if (structural.length > 0 && ordinary.length > 0) {
    errors.push(
      `${prefix}: refuses mixed structural/full-width container with ordinary content targets (structural=[${structural.join(", ")}] content=[${ordinary.join(", ")}])`,
    );
  }

  // Section-unit role mix is independent of lane count. Lane band / cross-lane
  // checks apply only when ≥2 body lanes exist.
  if (input.canvas) {
    const roleById = sectionUnitHorizontalRoleByObjectId(input.canvas);
    const classified = input.target_ids
      .map((id) => ({ id, role: roleById.get(id) }))
      .filter(
        (row): row is { id: string; role: SectionUnitHorizontalRole } =>
          row.role != null,
      );
    const distinctRoles = [...new Set(classified.map((r) => r.role))].sort();
    if (distinctRoles.length > 1) {
      const byRole = distinctRoles
        .map((role) => {
          const ids = classified.filter((r) => r.role === role).map((r) => r.id);
          return `${role}:[${ids.join(",")}]`;
        })
        .join("; ");
      errors.push(
        `${prefix}: ${MIXED_SECTION_UNIT_ALIGNMENT_NOT_ALLOWED}: cohort mixes section-unit roles (${byRole}); emit separate align_objects per role so a single align_left cannot collapse established marker/heading/body offsets`,
      );
    }

    const detection = detectLayoutLanesFromCanvas(input.canvas);
    if (detection.lane_count >= 2) {
      const laneByTarget = new Map<string, string>();
      for (const id of input.target_ids) {
        const laneId = detection.object_id_to_lane[id];
        if (laneId) laneByTarget.set(id, laneId);
      }
      const distinctLanes = [...new Set(laneByTarget.values())].sort();
      if (distinctLanes.length > 1) {
        const byLane = distinctLanes
          .map((laneId) => {
            const ids = [...laneByTarget.entries()]
              .filter(([, l]) => l === laneId)
              .map(([id]) => id);
            return `${laneId}:[${ids.join(",")}]`;
          })
          .join("; ");
        errors.push(
          `${prefix}: ${CROSS_LANE_ALIGNMENT_NOT_ALLOWED}: cohort spans ${distinctLanes.length} established lanes (${byLane})`,
        );
      }

      const laneMeta = new Map(
        detection.lanes.map((l) => [l.lane_id, l] as const),
      );
      const tol = ALIGN_LANE_BOUNDARY_TOLERANCE_PX;
      for (const [id, laneId] of laneByTarget) {
        const lane = laneMeta.get(laneId);
        if (!lane) continue;
        const tIdx = input.target_ids.indexOf(id);
        const target = tIdx >= 0 ? input.targets[tIdx] : undefined;
        const w = target ? effectiveWidth(target) : 0;
        const newRight = alignLeft + w;
        const inBand =
          alignLeft >= lane.bounds_left - tol &&
          newRight <= lane.bounds_right + tol;
        if (!inBand) {
          errors.push(
            `${prefix}: ${ALIGN_LEFT_OUTSIDE_TARGET_LANE}: target_id=${id} lane=${laneId} proposed_left=${alignLeft} effective_width=${w} proposed_right=${newRight} outside lane band [${lane.bounds_left.toFixed(1)}, ${lane.bounds_right.toFixed(1)}] (tolerance_px=${tol})`,
          );
        }
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Inventory-aware plan validation before execution.
 * Enforces align_objects structural, bounds, section-unit role, and cross-lane safety.
 */
export function validateRevisionPlanAgainstInventory(input: {
  canvas: FabricCanvasDoc;
  plan: RevisionPlan;
}): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const objects = (input.canvas.objects ?? []) as FabricObj[];
  const pageW = finite(input.canvas.width) ? Number(input.canvas.width) : 794;
  const pageH = finite(input.canvas.height) ? Number(input.canvas.height) : 1123;

  for (let i = 0; i < input.plan.operations.length; i++) {
    const op = input.plan.operations[i]!;
    if (op.op !== "align_objects") continue;

    const ids = op.target_ids?.length
      ? op.target_ids
      : op.target_id
        ? [op.target_id]
        : [];
    if (ids.length < 2) {
      errors.push(
        `operations[${i}] align_objects: target_ids with at least 2 inventory object IDs required`,
      );
      continue;
    }

    const targets: FabricObj[] = [];
    const resolvedIds: string[] = [];
    for (const id of ids) {
      const found = findById(objects, id);
      if (!found) {
        errors.push(
          `operations[${i}] align_objects: unresolved target_id=${id}`,
        );
        continue;
      }
      targets.push(found.obj);
      resolvedIds.push(id);
    }
    if (targets.length !== ids.length) continue;

    const alignLeft = finite(op.values?.align_left)
      ? Number(op.values!.align_left)
      : null;
    if (alignLeft == null) {
      errors.push(
        `operations[${i}] align_objects: values.align_left number required`,
      );
      continue;
    }

    const safety = validateAlignObjectsSafety({
      targets,
      target_ids: resolvedIds,
      align_left: alignLeft,
      page_width: pageW,
      page_height: pageH,
      operation_index: i,
      canvas: input.canvas,
    });
    errors.push(...safety.errors);
  }

  return { ok: errors.length === 0, errors };
}

/** Shared helper for executor defense-in-depth. */
export function assertAlignObjectsExecutable(input: {
  targets: FabricObj[];
  target_ids: string[];
  align_left: number;
  page_width: number;
  page_height: number;
  /** Prior/current canvas before this mutation — required for lane topology checks. */
  canvas?: FabricCanvasDoc;
}): void {
  const safety = validateAlignObjectsSafety(input);
  if (!safety.ok) {
    throw new Error(safety.errors.join("; "));
  }
}
