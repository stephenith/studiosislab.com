/**
 * Spacing validation — sections, paragraphs, headings, margins, whitespace
 */
import type { QAModuleReport, QATemplateContext } from "./types.js";

const MARGIN_MIN = 40;
const SECTION_GAP_MIN = 16;
const PARAGRAPH_GAP_MIN = 6;
const HEADING_GAP_MIN = 6;

function isTextbox(o: Record<string, unknown>): boolean {
  return String(o.type ?? "").toLowerCase() === "textbox";
}

function boxBottom(o: Record<string, unknown>): number {
  const top = Number(o.top ?? 0);
  const text = String(o.text ?? "");
  const lines = Math.max(1, text.split("\n").length);
  const fontSize = Number(o.fontSize ?? 12);
  const lineHeight = Number(o.lineHeight ?? 1.35);
  const serializedHeight = Number(o.height ?? 0) * Number(o.scaleY ?? 1);
  const estimated = lines * fontSize * lineHeight;
  return top + Math.max(serializedHeight, estimated);
}

export function runSpacingCheck(ctx: QATemplateContext): QAModuleReport {
  const textboxes = ctx.json.objects.filter(isTextbox);
  const sorted = [...textboxes].sort((a, b) => Number(a.top) - Number(b.top));
  const checks = [];

  const minLeft = Math.min(...textboxes.map((o) => Number(o.left ?? 999)));
  const maxRight = Math.max(
    ...textboxes.map(
      (o) => Number(o.left ?? 0) + Number(o.width ?? 0) * Number(o.scaleX ?? 1),
    ),
  );
  const canvasW = ctx.json.width ?? 794;
  const marginLeftOk = minLeft >= MARGIN_MIN;
  const marginRightOk = canvasW - maxRight >= MARGIN_MIN - 8;
  checks.push({
    id: "margin-consistency",
    pass: marginLeftOk && marginRightOk,
    detail: `left=${minLeft}px right=${Math.round(canvasW - maxRight)}px (min ${MARGIN_MIN}px)`,
    severity: "required" as const,
  });

  const sectionHeads = sorted.filter((o) =>
    /^[A-Z][A-Z\s/&-]{3,}$/.test(String(o.text).trim()),
  );
  const sectionGaps: number[] = [];
  for (let i = 1; i < sectionHeads.length; i++) {
    const gap = Number(sectionHeads[i]!.top) - boxBottom(sectionHeads[i - 1]!);
    if (gap > 0) sectionGaps.push(gap);
  }
  const badSectionGaps = sectionGaps.filter((g) => g < SECTION_GAP_MIN);
  checks.push({
    id: "section-spacing",
    pass: badSectionGaps.length === 0,
    detail:
      badSectionGaps.length === 0
        ? `Section gaps OK (${sectionGaps.length} measured)`
        : `${badSectionGaps.length} section gaps below ${SECTION_GAP_MIN}px`,
    severity: "required" as const,
  });

  const bodyBoxes = sorted.filter(
    (o) => !/^[A-Z][A-Z\s/&-]{3,}$/.test(String(o.text).trim()),
  );
  const paraGaps: number[] = [];
  for (let i = 1; i < bodyBoxes.length; i++) {
    const gap = Number(bodyBoxes[i]!.top) - boxBottom(bodyBoxes[i - 1]!);
    if (gap > 0 && gap < 80) paraGaps.push(gap);
  }
  const badParaGaps = paraGaps.filter((g) => g < PARAGRAPH_GAP_MIN);
  checks.push({
    id: "paragraph-spacing",
    pass: badParaGaps.length <= 8,
    detail: `${badParaGaps.length} tight paragraph gaps (<${PARAGRAPH_GAP_MIN}px); multi-line blocks may use adjacent textboxes`,
    severity: "required" as const,
  });

  const headingBelow = sectionHeads.map((head) => {
    const headBottom = boxBottom(head);
    const next = sorted.find((o) => Number(o.top) >= headBottom - 1 && o !== head);
    return next ? Number(next.top) - headBottom : 999;
  });
  const badHeadingGaps = headingBelow.filter((g) => g < HEADING_GAP_MIN && g < 100);
  checks.push({
    id: "heading-spacing",
    pass: badHeadingGaps.length === 0,
    detail:
      badHeadingGaps.length === 0
        ? "Heading-to-body spacing OK"
        : `${badHeadingGaps.length} headings too close to following content`,
    severity: "required" as const,
  });

  const verticalGaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const gap = Number(sorted[i]!.top) - boxBottom(sorted[i - 1]!);
    if (gap > 0 && gap < 120) verticalGaps.push(gap);
  }
  const cramped = verticalGaps.filter((g) => g < 2);
  checks.push({
    id: "whitespace-balance",
    pass: cramped.length === 0,
    detail:
      cramped.length === 0
        ? "No sub-2px vertical collisions"
        : `${cramped.length} cramped vertical gaps`,
    severity: "required" as const,
  });

  const pass = checks.every((c) => c.pass);
  return {
    module: "spacing",
    pass,
    checked_at: new Date().toISOString(),
    checks,
  };
}
