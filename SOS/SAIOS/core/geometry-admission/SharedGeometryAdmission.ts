/**
 * C2 — one deterministic geometry / safety admission contract.
 *
 * Reuses the revision overlap and page-bounds primitives already proven
 * fail-closed. Generation and revision must not disagree about whether the
 * same rendered canvas is objectively safe to enter Founder Review.
 *
 * Subjective critic scores remain advisory and cannot override this kernel.
 */
import { contentObjects } from "../resume-critic/canvasHelpers.js";
import type { CanvasDocument } from "../resume-critic/types.js";
import type { FabricCanvasDoc } from "../founder-revision/CanvasInventory.js";
import type { AcceptanceFinding } from "../founder-revision/RevisionAcceptanceChecks.js";
import {
  findOutOfBoundsObjects,
  findTextOverlapFindings,
} from "../founder-revision/RevisionAcceptanceChecks.js";
import { effectiveObjectBBox } from "../founder-revision/TextEffectiveHeight.js";

export const SHARED_GEOMETRY_ADMISSION_SCHEMA =
  "shared-geometry-admission-1.0.0" as const;

/** Same threshold as RevisionLayoutNormalizer page_fit.fit_pass. */
export const PAGE_FIT_OVERFLOW_TOLERANCE_PX = 0.5;

export type SharedGeometryFailCode =
  | "GEOMETRY_UNEVALUABLE"
  | "TEXT_OVERLAP"
  | "PAGE_OOB"
  | "PAGE_FIT";

export type SharedGeometryAdmission = {
  schema_version: typeof SHARED_GEOMETRY_ADMISSION_SCHEMA;
  evaluated_at: string;
  pass: boolean;
  unevaluable: boolean;
  text_overlap_count: number;
  page_oob_count: number;
  page_overflow_px: number;
  page_fit_pass: boolean;
  fail_codes: SharedGeometryFailCode[];
  findings: AcceptanceFinding[];
};

export type GenerationFounderReviewAdmission = {
  admit: boolean;
  blocked_by: "none" | "critic" | "geometry";
  geometry_pass: boolean;
  critic_ready: boolean;
};

function asCanvasDoc(canvas: FabricCanvasDoc): CanvasDocument {
  return canvas as unknown as CanvasDocument;
}

/**
 * Read-only page-fit: content bottom vs page height.
 * Does not compact or mutate. Matches fit_pass (overflow <= 0.5).
 */
export function measurePageFitFromCanvas(canvas: FabricCanvasDoc): {
  page_height: number;
  content_bottom: number;
  overflow_px: number;
  pass: boolean;
  unevaluable: boolean;
} {
  const pageH = Number(canvas.height ?? 0);
  if (!(pageH > 0)) {
    return {
      page_height: pageH,
      content_bottom: 0,
      overflow_px: 0,
      pass: false,
      unevaluable: true,
    };
  }
  const objects = contentObjects(asCanvasDoc(canvas));
  let contentBottom = 0;
  for (const o of objects) {
    contentBottom = Math.max(contentBottom, effectiveObjectBBox(o).bottom);
  }
  const overflow = Math.max(0, contentBottom - pageH);
  return {
    page_height: pageH,
    content_bottom: Number(contentBottom.toFixed(2)),
    overflow_px: Number(overflow.toFixed(2)),
    pass: overflow <= PAGE_FIT_OVERFLOW_TOLERANCE_PX,
    unevaluable: false,
  };
}

export function evaluateSharedGeometryAdmission(
  canvas: FabricCanvasDoc,
): SharedGeometryAdmission {
  const overlaps = findTextOverlapFindings(canvas);
  const oobAll = findOutOfBoundsObjects(canvas);
  const unevaluable = oobAll.some((f) => f.code === "ACC_BOUNDS_UNEVALUABLE");
  const oob = oobAll.filter((f) => f.code !== "ACC_BOUNDS_UNEVALUABLE");
  const pageFit = measurePageFitFromCanvas(canvas);

  const findings: AcceptanceFinding[] = [...overlaps, ...oob];
  if (!pageFit.unevaluable && !pageFit.pass) {
    findings.push({
      code: "ACC_PAGE_FIT",
      message: `Page overflow ${pageFit.overflow_px}px exceeds ${PAGE_FIT_OVERFLOW_TOLERANCE_PX}px`,
      object_ids: [],
      metrics: {
        page_height: pageFit.page_height,
        content_bottom: pageFit.content_bottom,
        overflow_px: pageFit.overflow_px,
      },
    });
  }

  const fail_codes: SharedGeometryFailCode[] = [];
  if (unevaluable || pageFit.unevaluable) fail_codes.push("GEOMETRY_UNEVALUABLE");
  if (overlaps.length > 0) fail_codes.push("TEXT_OVERLAP");
  if (oob.length > 0) fail_codes.push("PAGE_OOB");
  if (!pageFit.unevaluable && !pageFit.pass) fail_codes.push("PAGE_FIT");

  return {
    schema_version: SHARED_GEOMETRY_ADMISSION_SCHEMA,
    evaluated_at: new Date().toISOString(),
    pass: fail_codes.length === 0,
    unevaluable: unevaluable || pageFit.unevaluable,
    text_overlap_count: overlaps.length,
    page_oob_count: oob.length,
    page_overflow_px: pageFit.overflow_px,
    page_fit_pass: pageFit.pass && !pageFit.unevaluable,
    fail_codes,
    findings,
  };
}

/**
 * Generation Founder Review admission: geometry is authoritative.
 * Critic scores cannot override a deterministic geometry failure.
 */
export function evaluateGenerationFounderReviewAdmission(input: {
  critic_ready: boolean;
  critic_gate_ready: boolean;
  geometry: SharedGeometryAdmission;
}): GenerationFounderReviewAdmission {
  if (!input.geometry.pass) {
    return {
      admit: false,
      blocked_by: "geometry",
      geometry_pass: false,
      critic_ready: input.critic_ready && input.critic_gate_ready,
    };
  }
  if (!input.critic_ready || !input.critic_gate_ready) {
    return {
      admit: false,
      blocked_by: "critic",
      geometry_pass: true,
      critic_ready: false,
    };
  }
  return {
    admit: true,
    blocked_by: "none",
    geometry_pass: true,
    critic_ready: true,
  };
}
