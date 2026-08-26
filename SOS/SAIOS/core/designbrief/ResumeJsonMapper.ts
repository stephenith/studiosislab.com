/**
 * Resume JSON mapping — construction instructions for a future renderer.
 * Does NOT write Fabric template files or publish.
 */
import type {
  ColorPalette,
  ComponentMapping,
  LayoutBlueprint,
  ResumeJsonInstruction,
  SectionOrdering,
  SpacingSystem,
  TypographyBlueprint,
  VisualGuidance,
} from "./types.js";

export function mapResumeJson(input: {
  layout: LayoutBlueprint;
  typography: TypographyBlueprint;
  spacing: SpacingSystem;
  colors: ColorPalette;
  sections: SectionOrdering;
  components: ComponentMapping[];
  visual_guidance?: VisualGuidance;
}): ResumeJsonInstruction {
  const bySection = new Map(input.components.map((c) => [c.section, c]));
  const sections = input.sections.order.map((id, order) => ({
    id,
    component: bySection.get(id)?.component ?? "GenericSectionBlock",
    order,
    placeholder_content: "fictional_sample_only" as const,
  }));

  const objects_plan: ResumeJsonInstruction["objects_plan"] = [
    {
      kind: "pageBackground",
      section: "page",
      component: "PageBackground",
      fill: input.colors.background,
    },
  ];

  for (const s of sections) {
    const comp = bySection.get(s.id);
    objects_plan.push({
      kind: "section",
      section: s.id,
      component: s.component,
      fill: input.colors.body_text,
      fontFamily: input.typography.body_family,
      fontSize: input.typography.scale_pt.body,
    });
    if (comp?.children) {
      for (const child of comp.children) {
        objects_plan.push({
          kind: "primitive",
          section: s.id,
          component: child,
          fill:
            child === "AccentRule"
              ? input.colors.accent
              : child.includes("Heading") || child === "NameText"
                ? input.colors.heading_text
                : input.colors.body_text,
          fontFamily:
            child === "NameText" || child.includes("Heading")
              ? input.typography.heading_family
              : input.typography.body_family,
          fontSize:
            child === "NameText"
              ? input.typography.scale_pt.name
              : child.includes("Heading")
                ? input.typography.scale_pt.heading
                : input.typography.scale_pt.body,
        });
      }
    }
  }

  return {
    version: "designbrief-resume-json-1.0.0",
    dry_run: true,
    publication_allowed: false,
    template_generated: false,
    page: {
      size: input.layout.page_size,
      width_px: input.layout.width_px,
      height_px: input.layout.height_px,
      background: input.colors.background,
    },
    typography: input.typography,
    spacing: input.spacing,
    colors: input.colors,
    visual_guidance: input.visual_guidance,
    sections,
    objects_plan,
  };
}
