/**
 * Composer reporter — persist composition artifacts.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { CompositionConfidence, CompositionPlan } from "./types.js";

const SOS_ROOT = resolve(import.meta.dirname, "../../..");
export const COMPOSER_OUTPUT_ROOT = join(SOS_ROOT, "07_LOGS/saios/adaptive-composer");

export function resolveCompositionDir(composition_id: string): string {
  return join(COMPOSER_OUTPUT_ROOT, "compositions", composition_id);
}

export function persistCompositionArtifacts(input: {
  output_dir: string;
  plan: CompositionPlan;
  confidence: CompositionConfidence;
  research_principles: string[];
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

  write("composition-plan.json", input.plan);
  write("layout-composition.json", input.plan.layout);
  write("component-selection.json", {
    composition_id: input.plan.composition_id,
    components: input.plan.components,
    section_order: input.plan.section_order,
  });
  write("spacing-strategy.json", input.plan.spacing);
  write("hierarchy-strategy.json", input.plan.hierarchy);
  write("typography-strategy.json", input.plan.typography);
  write("composition-confidence.json", input.confidence);
  write("visual-composition.md", buildVisualCompositionMd(input.plan, input.confidence));
  write("design-rationale.md", buildDesignRationaleMd(input.plan, input.research_principles));

  return files;
}

function buildVisualCompositionMd(plan: CompositionPlan, confidence: CompositionConfidence): string {
  return [
    `# Visual Composition — ${plan.composition_id}`,
    "",
    `**Objective:** ${plan.objective}`,
    `**Industry:** ${plan.industry} | **Mode:** ${plan.mode}`,
    "",
    "## Layout",
    `- Mode: ${plan.layout.layout_mode}`,
    `- Columns: ${plan.layout.column_count}`,
    `- Grid gutter: ${plan.layout.grid_gutter_px}px`,
    "",
    "## Components",
    ...plan.components.slice(0, 8).map((c) => `- ${c.category}: **${c.variant}**`),
    "",
    "## Scores",
    `- Premium: ${confidence.premium_score}/100`,
    `- ATS: ${confidence.ats_score}/100`,
    `- Visual render prediction: ${confidence.visual_render_prediction}/100`,
    `- Founder: ${confidence.founder_prediction}`,
    "",
  ].join("\n");
}

function buildDesignRationaleMd(plan: CompositionPlan, principles: string[]): string {
  return [
    `# Design Rationale — ${plan.composition_id}`,
    "",
    "## Composition Rules",
    "Every placement, spacing, and hierarchy decision is justified — never random.",
    "",
    "## Layout Justification",
    ...plan.layout.justification.map((j) => `- ${j}`),
    "",
    "## Spacing Justification",
    ...plan.spacing.justification.map((j) => `- ${j}`),
    "",
    "## Typography Justification",
    ...plan.typography.justification.map((j) => `- ${j}`),
    "",
    "## Hierarchy Justification",
    ...plan.hierarchy.justification.map((j) => `- ${j}`),
    "",
    "## Research Principles Applied",
    ...principles.slice(0, 6).map((p) => `- ${p}`),
    "",
    "## Section Order",
    plan.hierarchy.section_order.join(" → "),
    "",
  ].join("\n");
}
