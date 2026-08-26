/**
 * Layout blueprint from Brain/Mock planning output.
 */
import type { BrainPlanningOutput, LayoutBlueprint, PageSize } from "./types.js";

const MM_TO_PX = 96 / 25.4;

const PAGE: Record<PageSize, { width_px: number; height_px: number }> = {
  A4: { width_px: 794, height_px: 1123 },
  Letter: { width_px: 816, height_px: 1056 },
};

function mmToPx(mm: number): number {
  return Math.round(mm * MM_TO_PX);
}

export function buildLayoutBlueprint(output: BrainPlanningOutput): LayoutBlueprint {
  const rawColumns = Number(output.layout?.columns ?? 1);
  // ATS-safe DesignBrief V1 forces single column when Mock asks for multi
  const columns: 1 | 2 = rawColumns >= 2 ? 1 : 1;
  const page_size: PageSize =
    String(output.layout?.page_size ?? "A4").toLowerCase() === "letter"
      ? "Letter"
      : "A4";
  const m = output.layout?.margins_mm ?? {};
  // DNA-balanced defaults (was 12mm all sides — sparse Word-doc frame)
  const margins_mm = {
    top: Number(m.top ?? 14),
    right: Number(m.right ?? 14),
    bottom: Number(m.bottom ?? 14),
    left: Number(m.left ?? 14),
  };
  const margins_px = {
    top: mmToPx(margins_mm.top),
    right: mmToPx(margins_mm.right),
    bottom: mmToPx(margins_mm.bottom),
    left: mmToPx(margins_mm.left),
  };
  const page = PAGE[page_size];
  return {
    structure: "single_column",
    columns,
    page_size,
    width_px: page.width_px,
    height_px: page.height_px,
    margins_mm,
    margins_px,
    content_width_px: page.width_px - margins_px.left - margins_px.right,
    reading_flow: "top_to_bottom",
    whitespace_strategy:
      "DNA-influenced ATS whitespace — filled page rhythm, clear section gaps, no sparse empty lower half",
  };
}
