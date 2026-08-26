/**
 * SectionRenderer — family-aware section placement (Agent #237).
 */
import { renderBlock } from "./BlockRenderer.js";
import type { PageLayout } from "./PageLayoutEngine.js";
import type {
  RenderNode,
  ResolvedSpacing,
  ResolvedTheme,
  ResolvedTypography,
  ResumeJsonInput,
} from "./types.js";

// Agent #239 — secondary content in sidebar; narrative stays in main
const SIDEBAR_SECTIONS = new Set([
  "skills",
  "certifications",
  "languages",
  "projects",
]);

export function renderSections(input: {
  resume: ResumeJsonInput;
  layout: PageLayout;
  theme: ResolvedTheme;
  typography: ResolvedTypography;
  spacing: ResolvedSpacing;
}): { sections: RenderNode[]; cursor_end_y: number } {
  const sorted = [...input.resume.sections].sort((a, b) => a.order - b.order);
  const vg = input.resume.visual_guidance;
  const sections: RenderNode[] = [];

  // Decorative page rails (family silhouette)
  const railNodes: RenderNode[] = [];
  const accent = String(vg?.accent_shape_strategy ?? "");
  if (accent === "left_rail" || accent === "index_rail") {
    railNodes.push({
      id: "page-accent-rail",
      kind: "rect",
      role: "accent-rail",
      x: Math.max(8, input.layout.content_x - 14),
      y: input.layout.content_top - 8,
      width: 4,
      height: input.layout.height_px - input.layout.content_top - input.layout.margins.bottom,
      fill: input.theme.accent,
    });
  }
  let seq = 0;
  let mainY = input.layout.content_top;
  let sideY = input.layout.content_top;
  let headerEnd = input.layout.content_top;

  for (const section of sorted) {
    const isHeader = section.id === "header" || section.component === "HeaderBlock";
    const useSidebar =
      input.layout.has_sidebar &&
      !isHeader &&
      SIDEBAR_SECTIONS.has(section.id);

    const x = isHeader
      ? input.layout.content_x
      : useSidebar
        ? input.layout.sidebar_x
        : input.layout.main_x;
    const width = isHeader
      ? input.layout.content_width
      : useSidebar
        ? input.layout.sidebar_width
        : input.layout.main_width;
    // Non-band headers start inside safe top; band headers may begin at y=0
    const headerY =
      input.layout.header_band_height > 0 ? 0 : input.layout.margins.top;
    const y = isHeader ? headerY : useSidebar ? sideY : mainY;

    const { node, height } = renderBlock({
      section_id: section.id,
      component: section.component,
      x,
      y,
      width,
      page_width: input.layout.width_px,
      theme: input.theme,
      typography: input.typography,
      spacing: input.spacing,
      seq: seq++,
      visual_guidance: vg,
      layout: input.layout,
    });

    sections.push({
      id: `section-${section.id}`,
      kind: "section",
      section: section.id,
      component: section.component,
      x,
      y,
      width,
      height,
      children: [node],
    });

    if (isHeader) {
      headerEnd = y + height + 8;
      mainY = Math.max(mainY, headerEnd);
      sideY = Math.max(sideY, headerEnd);
    } else if (useSidebar) {
      sideY += height + Math.max(14, input.spacing.section_gap_px);
    } else {
      const mainGap = input.layout.has_sidebar
        ? input.spacing.section_gap_px + 14
        : input.spacing.section_gap_px;
      mainY += height + mainGap;
    }
  }

  const cursor_end_y = Math.max(mainY, sideY) - input.spacing.section_gap_px;

  // Sidebar background sized to actual content (not full page void filler)
  if (input.layout.has_sidebar) {
    const top = Math.max(0, headerEnd - 8);
    railNodes.push({
      id: "page-sidebar-bg",
      kind: "rect",
      role: "sidebar-bg",
      x: input.layout.sidebar_x - 8,
      y: top,
      width: input.layout.sidebar_width + 8,
      height: Math.max(120, cursor_end_y - top + 12),
      fill: input.theme.sidebar_bg ?? input.theme.pale_tint ?? "#f1f5f9",
    });
  }

  // Accent rail sized to content depth
  for (const rail of railNodes) {
    if (rail.role === "accent-rail") {
      rail.height = Math.max(120, cursor_end_y - (rail.y ?? 0));
    }
  }

  return {
    sections: [...railNodes, ...sections],
    cursor_end_y,
  };
}
