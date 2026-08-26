/**
 * Render reporter — persist all evaluation artifacts.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { DimensionScore, RenderMetrics, RenderScores, VisualIssueFlag } from "./types.js";

const SOS_ROOT = resolve(import.meta.dirname, "../../..");
export const VISUAL_RENDER_OUTPUT_ROOT = join(SOS_ROOT, "07_LOGS/saios/visual-render");

export function persistRenderArtifacts(input: {
  output_dir: string;
  template_name: string;
  metrics: RenderMetrics;
  dimensions: DimensionScore[];
  scores: RenderScores;
  issues: VisualIssueFlag[];
  improvement_plan: string;
  founder_preview: string;
  eye_flow: object;
  persist?: boolean;
}): string[] {
  const files: string[] = [];
  const write = (name: string, content: object | string) => {
    const path = join(input.output_dir, name);
    if (input.persist !== false) {
      mkdirSync(input.output_dir, { recursive: true });
      writeFileSync(path, typeof content === "string" ? content : JSON.stringify(content, null, 2));
    }
    files.push(name);
  };

  write("visual-analysis.json", {
    template_name: input.template_name,
    analyzed_at: new Date().toISOString(),
    source: "fabric_rendered_canvas",
    dimensions: input.dimensions,
    issues: input.issues,
    metrics_summary: {
      object_count: input.metrics.object_count,
      left_margin_px: input.metrics.left_margin_px,
      non_white_ratio: input.metrics.non_white_ratio,
    },
  });

  write("render-score.json", input.scores);
  write("premium-perception.json", {
    premium_score: input.scores.premium_score,
    looks_premium: input.issues.includes("looks_premium"),
    looks_memorable: input.issues.includes("looks_memorable"),
    looks_like_resume_builder: input.issues.includes("looks_like_resume_builder"),
  });
  write("eye-flow.json", input.eye_flow);
  write("whitespace-analysis.json", {
    left_margin_px: input.metrics.left_margin_px,
    right_margin_px: input.metrics.right_margin_px,
    non_white_ratio: input.metrics.non_white_ratio,
    too_much_whitespace: input.issues.includes("too_much_whitespace"),
    too_dense: input.issues.includes("too_dense"),
  });
  write("layout-balance.json", {
    vertical_bands: input.metrics.vertical_bands,
    header_zone_density: input.metrics.header_zone_density,
    body_zone_density: input.metrics.body_zone_density,
    unbalanced: input.issues.includes("unbalanced_layout"),
  });
  write("typography-analysis.json", {
    font_sizes_pt: input.metrics.font_sizes_pt,
    hierarchy_ratio:
      input.metrics.font_sizes_pt.length >= 2
        ? input.metrics.font_sizes_pt[0]! / input.metrics.font_sizes_pt.at(-1)!
        : null,
    weak_typography: input.issues.includes("weak_typography"),
  });
  write("hierarchy-analysis.json", {
    section_hierarchy_score: input.dimensions.find((d) => d.dimension === "section_hierarchy")?.score,
    poor_hierarchy: input.issues.includes("poor_hierarchy"),
    weak_headers: input.issues.includes("weak_headers"),
  });
  write("improvement-plan.md", input.improvement_plan);
  write("founder-review-preview.md", input.founder_preview);

  return files;
}

export function resolveOutputDir(template_name: string): string {
  return join(VISUAL_RENDER_OUTPUT_ROOT, "evaluations", template_name);
}
