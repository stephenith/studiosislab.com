/**
 * Alignment validation — gutters, columns, overlaps, icon alignment
 */
import type { QAModuleReport, QATemplateContext } from "./types.js";

const LEFT_TOLERANCE = 4;
const RIGHT_TOLERANCE = 6;
const CENTER_TOLERANCE = 8;
const OVERLAP_AREA_THRESHOLD = 100;
const OVERLAP_MIN_VERTICAL_PX = 12;

function objType(o: Record<string, unknown>): string {
  return String(o.type ?? "").toLowerCase();
}

function bounds(o: Record<string, unknown>): {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
} {
  const left = Number(o.left ?? 0);
  const top = Number(o.top ?? 0);
  const width = Number(o.width ?? 0) * Number(o.scaleX ?? 1);
  const serializedHeight = Number(o.height ?? 0) * Number(o.scaleY ?? 1);
  const height = serializedHeight > 0 ? serializedHeight : Number(o.fontSize ?? 12) * Number(o.lineHeight ?? 1.35) * 2;
  return { left, top, width, height, right: left + width, bottom: top + height };
}

function overlapArea(
  a: ReturnType<typeof bounds>,
  b: ReturnType<typeof bounds>,
): number {
  const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return x * y;
}

function isPageBg(o: Record<string, unknown>): boolean {
  return (
    o.isPageBg === true ||
    o.role === "pageBackground" ||
    (o.data as Record<string, unknown> | undefined)?.role === "pageBackground"
  );
}

export function runAlignmentCheck(ctx: QATemplateContext): QAModuleReport {
  const objects = ctx.json.objects.filter((o) => !isPageBg(o));
  const textboxes = objects.filter((o) => objType(o) === "textbox");
  const checks = [];

  const lefts = textboxes.map((o) => Number(o.left ?? 0));
  const leftModes = modeValues(lefts, LEFT_TOLERANCE);
  checks.push({
    id: "left-alignment-consistency",
    pass: leftModes.length <= 3,
    detail: `${leftModes.length} left-alignment columns (max 3): ${leftModes.map((v) => Math.round(v)).join(", ")}`,
    severity: "required" as const,
  });

  const rights = textboxes.map((o) => {
    const b = bounds(o);
    return b.right;
  });
  const rightModes = modeValues(rights, RIGHT_TOLERANCE);
  checks.push({
    id: "right-alignment-consistency",
    pass: rightModes.length <= 2,
    detail: `${rightModes.length} right-edge alignments (max 2)`,
    severity: "required" as const,
  });

  const centers = textboxes
    .filter((o) => String(o.textOriginX ?? o.originX) === "center")
    .map((o) => Number(o.left ?? 0));
  const centerOk =
    centers.length === 0 ||
    centers.every((c) => Math.abs(c - centers[0]!) <= CENTER_TOLERANCE);
  checks.push({
    id: "center-alignment",
    pass: centerOk,
    detail:
      centers.length === 0
        ? "No center-origin textboxes"
        : `Center column at ~${Math.round(centers[0]!)}px`,
    severity: "required" as const,
  });

  const columnBuckets = bucketByLeft(lefts, 48);
  checks.push({
    id: "column-alignment",
    pass: columnBuckets.length <= 2,
    detail: `${columnBuckets.length} content column(s) detected`,
    severity: "required" as const,
  });

  const sectionHeads = textboxes.filter((o) =>
    /^[A-Z][A-Z\s/&-]{3,}$/.test(String(o.text).trim()),
  );
  const headLefts = sectionHeads.map((o) => Number(o.left ?? 0));
  const sectionAligned =
    headLefts.length === 0 ||
    headLefts.every((l) => Math.abs(l - headLefts[0]!) <= LEFT_TOLERANCE);
  checks.push({
    id: "section-alignment",
    pass: sectionAligned,
    detail: `${sectionHeads.length} section headings aligned to left gutter`,
    severity: "required" as const,
  });

  const icons = objects.filter(
    (o) =>
      objType(o) === "image" ||
      String(o.fontFamily ?? "").toLowerCase().includes("icon"),
  );
  checks.push({
    id: "icon-alignment",
    pass: icons.length === 0 || ctx.tier !== "ats_safe",
    detail:
      icons.length === 0
        ? "No icon images in ATS template"
        : `${icons.length} icon-like objects (visual tier only)`,
    severity: "required" as const,
  });

  const contentObjects = objects.filter((o) => {
    const t = objType(o);
    if (t === "line") return false;
    if (t === "rect" && (o.data as Record<string, unknown>)?.role === "accent-bar") return false;
    return true;
  });
  const textOnly = contentObjects.filter((o) => objType(o) === "textbox");
  const overlaps: string[] = [];
  for (let i = 0; i < textOnly.length; i++) {
    for (let j = i + 1; j < textOnly.length; j++) {
      const a = bounds(textOnly[i]!);
      const b = bounds(textOnly[j]!);
      const vOverlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (vOverlap < OVERLAP_MIN_VERTICAL_PX) continue;
      if (overlapArea(a, b) > OVERLAP_AREA_THRESHOLD) {
        overlaps.push(`${i}+${j}`);
      }
    }
  }
  checks.push({
    id: "object-overlap-detection",
    pass: overlaps.length <= 1,
    detail: overlaps.length ? `${overlaps.length} overlapping pairs` : "No unintended overlaps",
    severity: "required" as const,
  });

  const pass = checks.every((c) => c.pass);
  return {
    module: "alignment",
    pass,
    checked_at: new Date().toISOString(),
    checks,
  };
}

function modeValues(values: number[], tolerance: number): number[] {
  const modes: number[] = [];
  for (const v of values) {
    const existing = modes.find((m) => Math.abs(m - v) <= tolerance);
    if (!existing) modes.push(v);
  }
  return modes.sort((a, b) => a - b);
}

function bucketByLeft(lefts: number[], bucketSize: number): number[] {
  const buckets: number[] = [];
  for (const l of lefts) {
    const bucket = Math.round(l / bucketSize) * bucketSize;
    if (!buckets.includes(bucket)) buckets.push(bucket);
  }
  return buckets;
}
