/**
 * Agent #239 — Adaptive content density with underfill recovery.
 */
import type { PageLayout } from "./PageLayoutEngine.js";
import { detectOverflow } from "./OverflowDetector.js";
import { renderSections } from "./SectionRenderer.js";
import type {
  RenderNode,
  ResolvedSpacing,
  ResolvedTheme,
  ResolvedTypography,
  ResumeJsonInput,
  RenderTree,
} from "./types.js";

export type DensityFitResult = {
  sections: RenderNode[];
  cursor_end_y: number;
  content_level: number;
  page_fill: number;
};

const DROP_PRIORITY = [
  "languages",
  "certifications",
  "projects",
] as const;

function cloneResume(
  resume: ResumeJsonInput,
  contentLevel: number,
  dropCount: number,
  gapScale = 1,
): ResumeJsonInput {
  const drop = new Set(DROP_PRIORITY.slice(0, dropCount));
  const sections = resume.sections.filter(
    (s) => !drop.has(s.id as (typeof DROP_PRIORITY)[number]),
  );
  const baseGap = Number(resume.spacing?.section_gap_px ?? 22);
  const vg = {
    ...(resume.visual_guidance ?? {}),
    content_level: contentLevel,
  };
  return {
    ...resume,
    sections,
    spacing: {
      ...resume.spacing,
      section_gap_px: Math.max(12, Math.round(baseGap * gapScale)),
    },
    visual_guidance: vg,
  };
}

function buildTree(
  layout: PageLayout,
  sections: RenderNode[],
  cursor_end_y: number,
): RenderTree {
  return {
    version: "resume-render-tree-1.0.0",
    dry_run: true,
    page: {
      width_px: layout.width_px,
      height_px: layout.height_px,
      background: layout.background,
    },
    root: {
      id: "page-root",
      kind: "page",
      x: 0,
      y: 0,
      width: layout.width_px,
      height: layout.height_px,
      fill: layout.background,
      children: sections,
    },
    cursor_end_y,
    content_bottom_y: cursor_end_y,
  };
}

function tryRender(
  input: {
    resume: ResumeJsonInput;
    layout: PageLayout;
    theme: ResolvedTheme;
    typography: ResolvedTypography;
    spacing: ResolvedSpacing;
  },
  level: number,
  drop: number,
  gapScale: number,
): DensityFitResult & { overflow: boolean } {
  const resume = cloneResume(input.resume, level, drop, gapScale);
  const spacing: ResolvedSpacing = {
    ...input.spacing,
    section_gap_px: resume.spacing.section_gap_px,
  };
  const { sections, cursor_end_y } = renderSections({
    resume,
    layout: input.layout,
    theme: input.theme,
    typography: input.typography,
    spacing,
  });
  const tree = buildTree(input.layout, sections, cursor_end_y);
  const overflow = detectOverflow(tree);
  const limit = input.layout.content_bottom_limit;
  return {
    sections,
    cursor_end_y,
    content_level: level,
    page_fill: cursor_end_y / Math.max(1, limit),
    overflow: overflow.overflow,
  };
}

export function fitContentDensity(input: {
  resume: ResumeJsonInput;
  layout: PageLayout;
  theme: ResolvedTheme;
  typography: ResolvedTypography;
  spacing: ResolvedSpacing;
}): DensityFitResult {
  const fillTarget = Number(
    (input.resume.visual_guidance as { page_fill_target?: number } | undefined)
      ?.page_fill_target ?? 0.9,
  );

  const trimAttempts: Array<{ level: number; drop: number; gap: number }> = [
    { level: 4, drop: 0, gap: 1 },
    { level: 3, drop: 0, gap: 1 },
    { level: 3, drop: 1, gap: 0.92 },
    { level: 2, drop: 1, gap: 0.88 },
    { level: 2, drop: 2, gap: 0.85 },
    { level: 1, drop: 2, gap: 0.82 },
    { level: 0, drop: 3, gap: 0.8 },
  ];

  let bestFit: DensityFitResult | null = null;
  for (const a of trimAttempts) {
    const r = tryRender(input, a.level, a.drop, a.gap);
    if (!r.overflow) {
      bestFit = r;
      break;
    }
  }

  if (!bestFit) {
    const lean = tryRender(input, 0, 3, 0.75);
    return lean;
  }

  const sidebar =
    String(
      (input.resume.visual_guidance as { sidebar_policy?: string } | undefined)
        ?.sidebar_policy ?? "",
    ) === "narrow_ats_safe";

  // Underfill recovery: widen gaps slightly within family limits (not filler text)
  if (bestFit.page_fill < fillTarget - 0.04 || sidebar) {
    for (const gap of sidebar
      ? [1.1, 1.2, 1.35, 1.5, 1.65]
      : [1.08, 1.15, 1.22]) {
      const r = tryRender(input, 4, 0, gap);
      if (!r.overflow && r.page_fill >= bestFit.page_fill) {
        bestFit = r;
        if (r.page_fill >= (sidebar ? 0.9 : fillTarget - 0.02)) break;
      }
    }
  }

  return bestFit;
}
