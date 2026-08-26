/**
 * RenderValidator — gates preview readiness without changing DesignBrief.
 */
import type {
  CanvasJson,
  OverflowReport,
  RenderTree,
  RenderValidation,
  ResumeJsonInput,
} from "./types.js";

export function validateRender(input: {
  resume: ResumeJsonInput;
  tree: RenderTree;
  canvas: CanvasJson;
  overflow: OverflowReport;
}): RenderValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (input.resume.dry_run !== true) {
    errors.push("resume JSON must be dry_run");
  }
  if (input.resume.publication_allowed === true) {
    errors.push("renderer refuses publication_allowed=true inputs");
  }
  if (input.canvas.version !== "6.9.1") {
    errors.push("canvas.version must be Fabric 6.9.1");
  }
  if (input.canvas.aios?.publication_allowed !== false) {
    errors.push("aios.publication_allowed must be false");
  }
  if (input.canvas.aios?.published !== false) {
    errors.push("aios.published must be false");
  }
  if (input.canvas.aios?.live_enabled !== false) {
    errors.push("aios.live_enabled must be false");
  }
  if (input.canvas.aios?.template_generated !== false) {
    errors.push("aios.template_generated must be false");
  }
  if (input.canvas.aios?.dry_run !== true) {
    errors.push("aios.dry_run must be true");
  }
  if (input.tree.dry_run !== true) errors.push("render_tree.dry_run must be true");

  if (!input.resume.sections?.length) {
    errors.push("resume JSON has no sections");
  }
  if (!input.canvas.objects.length) {
    errors.push("canvas has no objects");
  }

  const hasBg = input.canvas.objects.some((o) => {
    const data = o.data as Record<string, unknown> | undefined;
    return (
      o.role === "pageBackground" ||
      o.isPageBg === true ||
      data?.role === "pageBackground"
    );
  });
  if (!hasBg) errors.push("missing page background");

  const textCount = input.canvas.objects.filter((o) => o.type === "Textbox").length;
  if (textCount < 3) errors.push("insufficient text objects for preview");

  // Content objects must be editable in StudiosisLab editor
  const content = input.canvas.objects.filter((o) => {
    const data = o.data as Record<string, unknown> | undefined;
    return !(
      o.role === "pageBackground" ||
      o.isPageBg === true ||
      data?.role === "pageBackground"
    );
  });
  for (const o of content) {
    if (o.selectable !== true || o.evented !== true) {
      errors.push(`object ${String(o.id)} must be selectable+evented for editor`);
      break;
    }
    for (const key of [
      "version",
      "originX",
      "originY",
      "scaleX",
      "scaleY",
      "visible",
      "id",
    ] as const) {
      if (o[key] === undefined) {
        errors.push(`object ${String(o.id)} missing Fabric prop ${key}`);
        break;
      }
    }
  }

  if (input.overflow.overflow) {
    errors.push(
      `content overflow by ${input.overflow.overflow_px}px (bottom=${input.overflow.content_bottom_y})`,
    );
  }

  if (!input.resume.typography?.ats_safe_fonts_only) {
    warnings.push("typography.ats_safe_fonts_only not set");
  }
  if (!input.resume.colors?.ats_safe) {
    warnings.push("colors.ats_safe not set");
  }

  return { pass: errors.length === 0, errors, warnings };
}
