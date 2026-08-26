/**
 * DesignBrief assembly — immutable construction instruction record.
 * Agent #235 — normalizes Brain/OpenAI planning + Design DNA visual profiles.
 */
import { randomUUID } from "node:crypto";
import { buildAtsConstraints } from "./AtsConstraintsBuilder.js";
import { selectColorPalette } from "./ColorPaletteSelector.js";
import { mapComponents } from "./ComponentMapper.js";
import { buildLayoutBlueprint } from "./LayoutBlueprintBuilder.js";
import { mapResumeJson } from "./ResumeJsonMapper.js";
import { buildSectionOrdering } from "./SectionOrderBuilder.js";
import { buildSpacingSystem } from "./SpacingSystemBuilder.js";
import { buildTypographyBlueprint } from "./TypographyBlueprintBuilder.js";
import { validateDesignBrief } from "./DesignBriefValidator.js";
import { normalizeBrainPlanningOutput } from "./normalizeBrainPlanning.js";
import { buildVisualGuidance } from "./visualGuidance.js";
import type { BrainPlanningOutput, DesignBrief, DesignBriefBuildInput } from "./types.js";

export function createDesignBrief(input: DesignBriefBuildInput): DesignBrief {
  const rawIn = input.brain_output ?? {};
  const seed = [
    input.task_id,
    (rawIn as { objective?: string }).objective,
    (rawIn as { role_family?: string }).role_family,
    ...(Array.isArray(rawIn.notes) ? rawIn.notes.map(String) : []),
  ]
    .filter(Boolean)
    .join(" ");
  const output: BrainPlanningOutput = normalizeBrainPlanningOutput(rawIn, {
    seed,
    role_family: (rawIn as { role_family?: string }).role_family,
    design_family: (rawIn as { design_family?: string }).design_family,
    design_variant: (() => {
      const dv = Number((rawIn as { design_variant?: number }).design_variant);
      return Number.isFinite(dv) ? dv : undefined;
    })(),
  });
  const layout = buildLayoutBlueprint(output);
  const typography = buildTypographyBlueprint(output);
  const sections = buildSectionOrdering(output);
  const spacing = buildSpacingSystem(layout, output);
  const colors = selectColorPalette(output);
  const ats = buildAtsConstraints(layout);
  const visual_guidance = buildVisualGuidance(output);
  const components = mapComponents(sections);
  const resume_json = mapResumeJson({
    layout,
    typography,
    spacing,
    colors,
    sections,
    components,
    visual_guidance,
  });

  const notes = [
    ...(Array.isArray(output.notes) ? output.notes.map(String) : []),
    "DesignBrief V1 — dry-run construction instructions only",
    "No Fabric template written",
    "No publication",
    "Mock provider source only",
    "Agent #235 visual_guidance + DNA-influenced profiles applied",
  ];

  const draft: DesignBrief = {
    brief_id: `dbf-${randomUUID().slice(0, 12)}`,
    version: "1.0.0",
    created_at: new Date().toISOString(),
    source: {
      provider: "mock",
      task_id: input.task_id ?? null,
      skill_id: input.skill_id ?? null,
      plan_type: output.plan_type ? String(output.plan_type) : null,
      fingerprint: output.fingerprint ? String(output.fingerprint) : null,
    },
    dry_run: true,
    live_enabled: false,
    publication_allowed: false,
    template_generated: false,
    renderer_ready: false,
    layout,
    typography,
    sections,
    spacing,
    colors,
    ats,
    visual_guidance,
    components,
    resume_json,
    notes,
    validation: { pass: false, errors: [], warnings: [] },
  };

  const validation = validateDesignBrief(draft);
  return {
    ...draft,
    renderer_ready: validation.pass,
    validation,
  };
}
