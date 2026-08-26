/**
 * Section-unit vertical coherence for Founder revisions.
 *
 * Horizontal / lane ownership remains StructuralAlignmentSafety.
 * This module owns marker↔heading Y relationship when Founder explicitly
 * requires heading-marker relationship, marker-relative-to-heading alignment,
 * or heading+marker+content grouping.
 *
 * Policy: restore marker Y from the same section's prior/reference delta when
 * that relation is known. Fail closed when the planned geometry detaches the
 * marker and no prior/reference relation can be proven. Never invent a global
 * "marker top === heading top" rule.
 *
 * Does not call OpenAI. Does not mutate the caller-provided canvases in place.
 */
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import {
  isHeadingMarkerReferenceRequest,
  isMarkerHeadingRelativeAlignmentRequest,
  isSectionUnitGroupingRequest,
} from "./FeedbackCoverage.js";
import { isSectionMarkerRole } from "./RevisionLayoutNormalizer.js";
import { normalizeFounderFeedbackItem } from "./RevisionPromptBuilder.js";

export const SECTION_UNIT_VERTICAL_DETACHMENT =
  "SECTION_UNIT_VERTICAL_DETACHMENT";

/** Same noise as heading→content equality / coverage gap relation. */
export const MARKER_HEADING_Y_NOISE_PX = 2;

type FabricObj = Record<string, unknown> & {
  type?: string;
  id?: string;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  scaleX?: number;
  scaleY?: number;
  text?: string;
  role?: string;
  data?: Record<string, unknown>;
};

export type MarkerHeadingYRestoration = {
  section: string;
  marker_id: string;
  heading_id: string;
  prior_delta: number;
  planned_delta: number;
  restored_top: number;
};

export type SectionUnitVerticalSafetyReport = {
  ok: boolean;
  skipped: boolean;
  error: string | null;
  restorations: MarkerHeadingYRestoration[];
};

function deepCloneCanvas(canvas: FabricCanvasDoc): FabricCanvasDoc {
  return JSON.parse(JSON.stringify(canvas)) as FabricCanvasDoc;
}

function objectId(o: FabricObj, index: number): string {
  if (typeof o.id === "string" && o.id.trim()) return o.id;
  const data = o.data;
  if (data && typeof data.id === "string" && data.id.trim()) return data.id;
  return `obj-${index}`;
}

function sectionOf(o: FabricObj): string | null {
  const s = o.data?.section;
  return typeof s === "string" && s.trim() ? s.trim().toLowerCase() : null;
}

function isRect(o: FabricObj): boolean {
  return String(o.type ?? "")
    .toLowerCase()
    .includes("rect");
}

function isText(o: FabricObj): boolean {
  const t = String(o.type ?? "").toLowerCase();
  return t === "textbox" || t === "text" || t === "i-text";
}

function headingLabel(text: string | undefined): string | null {
  if (!text) return null;
  const t = text.trim().toUpperCase();
  const labels = [
    "SUMMARY",
    "EXPERIENCE",
    "EDUCATION",
    "SKILLS",
    "PROJECTS",
    "CERTIFICATIONS",
    "LANGUAGES",
  ];
  for (const label of labels) {
    if (t === label || new RegExp(`^(0?\\d\\s+)?${label}\\b`).test(t)) return label;
  }
  return null;
}

export function founderRequiresSectionUnitVerticalCoherence(
  requestedChanges: string[],
): boolean {
  for (const raw of requestedChanges) {
    const n = normalizeFounderFeedbackItem(raw);
    if (!n) continue;
    if (isSectionUnitGroupingRequest(n)) return true;
    if (isHeadingMarkerReferenceRequest(n)) return true;
    if (isMarkerHeadingRelativeAlignmentRequest(n)) return true;
  }
  return false;
}

function indexById(objects: FabricObj[]): Map<string, FabricObj> {
  const map = new Map<string, FabricObj>();
  for (let i = 0; i < objects.length; i++) {
    const o = objects[i]!;
    map.set(objectId(o, i), o);
  }
  return map;
}

function objectsInSection(objects: FabricObj[], section: string): FabricObj[] {
  return objects.filter((o) => sectionOf(o) === section);
}

function findHeading(objs: FabricObj[], section: string): FabricObj | null {
  const expected = section.toUpperCase();
  const byLabel = objs.find(
    (o) =>
      isText(o) &&
      headingLabel(typeof o.text === "string" ? o.text : undefined) === expected,
  );
  if (byLabel) return byLabel;
  return (
    objs.find(
      (o) =>
        isText(o) &&
        String(o.data?.role ?? o.role ?? "").toLowerCase() === "section-heading",
    ) ?? null
  );
}

function findMarker(objs: FabricObj[]): FabricObj | null {
  const explicit = objs.find((o) => isRect(o) && isSectionMarkerRole(o));
  return explicit ?? null;
}

function snap(n: number): number {
  return Number(n.toFixed(2));
}

function markerHeadingOverlap(
  marker: FabricObj,
  heading: FabricObj,
): boolean {
  const mTop = Number(marker.top ?? 0);
  const mBot = mTop + Number(marker.height ?? 0) * Number(marker.scaleY ?? 1);
  const hTop = Number(heading.top ?? 0);
  const hBot = hTop + Number(heading.height ?? 0) * Number(heading.scaleY ?? 1);
  return Math.min(mBot, hBot) - Math.max(mTop, hTop) >= 0.5;
}

/**
 * When Founder requires section-unit / heading-marker vertical coherence:
 * restore each explicit section-marker's Y from the same section's prior
 * marker↔heading delta. Fail closed if a marker is detached and no prior
 * relation exists.
 */
export function applySectionUnitVerticalSafety(input: {
  priorCanvas: FabricCanvasDoc;
  afterCanvas: FabricCanvasDoc;
  requested_changes: string[];
}): { canvas: FabricCanvasDoc; report: SectionUnitVerticalSafetyReport } {
  const canvas = deepCloneCanvas(input.afterCanvas);
  const report: SectionUnitVerticalSafetyReport = {
    ok: true,
    skipped: true,
    error: null,
    restorations: [],
  };

  if (!founderRequiresSectionUnitVerticalCoherence(input.requested_changes)) {
    return { canvas, report };
  }
  report.skipped = false;

  const priorObjs = (input.priorCanvas.objects ?? []) as FabricObj[];
  const afterObjs = (canvas.objects ?? []) as FabricObj[];
  const priorById = indexById(priorObjs);
  const afterById = indexById(afterObjs);

  const sections = new Set<string>();
  for (const o of afterObjs) {
    const s = sectionOf(o);
    if (s && s !== "header") sections.add(s);
  }

  for (const section of [...sections].sort()) {
    const afterSec = objectsInSection(afterObjs, section);
    const marker = findMarker(afterSec);
    const heading = findHeading(afterSec, section);
    if (!marker || !heading) continue;
    const markerId = objectId(marker, 0);
    const headingId = objectId(heading, 0);
    const liveMarker = afterById.get(markerId) ?? marker;
    const liveHeading = afterById.get(headingId) ?? heading;

    const priorMarker = priorById.get(markerId);
    const priorHeading = priorById.get(headingId);
    const priorKnown =
      priorMarker != null &&
      priorHeading != null &&
      Number.isFinite(Number(priorMarker.top)) &&
      Number.isFinite(Number(priorHeading.top));

    const plannedDelta = snap(
      Number(liveMarker.top ?? 0) - Number(liveHeading.top ?? 0),
    );

    if (priorKnown) {
      const priorDelta = snap(
        Number(priorMarker!.top ?? 0) - Number(priorHeading!.top ?? 0),
      );
      if (Math.abs(plannedDelta - priorDelta) <= MARKER_HEADING_Y_NOISE_PX) {
        continue;
      }
      const restoredTop = snap(Number(liveHeading.top ?? 0) + priorDelta);
      if (Math.abs(Number(liveMarker.top ?? 0) - restoredTop) <= 0.01) continue;
      liveMarker.top = restoredTop;
      report.restorations.push({
        section,
        marker_id: markerId,
        heading_id: headingId,
        prior_delta: priorDelta,
        planned_delta: plannedDelta,
        restored_top: restoredTop,
      });
      continue;
    }

    if (!markerHeadingOverlap(liveMarker, liveHeading)) {
      report.ok = false;
      report.error =
        `${SECTION_UNIT_VERTICAL_DETACHMENT}: section=${section} ` +
        `marker=${markerId} top=${liveMarker.top} is detached from heading=${headingId} ` +
        `top=${liveHeading.top} and no prior marker↔heading Y relation is available`;
      return { canvas, report };
    }
  }

  return { canvas, report };
}
