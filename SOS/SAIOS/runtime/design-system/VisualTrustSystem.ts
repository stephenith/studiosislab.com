/**
 * Visual trust — confidence, trust, perceived value signals.
 * AGENT #080 — StudiosisLab Design DNA.
 */
import type { DesignMemoryContext } from "./DesignMemoryBridge.js";
import type { DesignConceptRule } from "./DesignPsychology.js";
import { DESIGN_DNA_VERSION } from "./DesignDNAVersion.js";

export const VISUAL_TRUST_CONCEPTS: DesignConceptRule[] = [
  {
    id: "trust_through_restraint",
    label: "Trust Through Restraint",
    definition: "One accent, one axis, one voice — excess erodes credibility.",
    psychology: "Novorésumé and Stripe win trust by refusing visual noise.",
    observed_in: ["Novorésumé", "Stripe", "government-grade ATS"],
    measurable: { accent_elements_max: 5, palette_count: 1 },
    design_system_refs: ["colors.palettes", "premium_identity"],
    brain_question: "Is every non-text element earning its place?",
  },
  {
    id: "alignment_trust",
    label: "Alignment Trust",
    definition: "Shared left edge creates subconscious reliability.",
    psychology: "Misalignment reads as carelessness before content is judged.",
    observed_in: ["Linear", "Notion", "Resume.io"],
    measurable: { left_gutter_variance_px: 4, column_count_max: 1 },
    design_system_refs: ["grid.classic-ats", "constraints"],
    brain_question: "Does one vertical axis hold the entire composition?",
  },
  {
    id: "contrast_trust",
    label: "Contrast Trust",
    definition: "Readable contrast signals respect for accessibility and professionalism.",
    psychology: "Low contrast feels faded; WCAG+ contrast feels intentional.",
    observed_in: ["Apple documentation", "accessible SaaS"],
    measurable: { contrast_ratio_min: 7, body_pt_min: 10.5 },
    design_system_refs: ["accessibility", "typography"],
    brain_question: "Is text crisp at 100% zoom without strain?",
  },
  {
    id: "predictable_structure",
    label: "Predictable Structure",
    definition: "Section order and naming match recruiter mental models.",
    psychology: "Surprise layout = cognitive tax; familiar scan = trust.",
    observed_in: ["Resume.io", "ATS parsers", "LinkedIn"],
    measurable: { standard_section_names: true, single_column: true },
    design_system_refs: ["sections", "ats"],
    brain_question: "Would an ATS and a human agree on section order?",
  },
  {
    id: "perceived_value_signal",
    label: "Perceived Value Signal",
    definition: "Craft details (marker, rule, rhythm) signal paid-tier quality.",
    psychology: "Free builders look flat; premium products have micro-structure.",
    observed_in: ["Resume.io Pro", "Enhancv", "Canva Pro"],
    measurable: { identity_markers_min: 4, header_rule_present: true },
    design_system_refs: ["premium_identity", "premium_header"],
    brain_question: "What detail proves this is not a free template?",
  },
];

export const VISUAL_TRUST_RULES = {
  trust_score_weights: {
    restraint: 0.25,
    alignment: 0.2,
    contrast: 0.2,
    structure: 0.2,
    value_signal: 0.15,
  },
  trust_floor: 88,
  confidence_boost_when_met: 4,
} as const;

export function buildVisualTrustSystem(ctx: DesignMemoryContext) {
  const identity = ctx.effective_premium_identity;
  const page = ctx.effective_page_width;

  return {
    version: DESIGN_DNA_VERSION,
    module: "visual-trust",
    spec: VISUAL_TRUST_RULES,
    concepts: VISUAL_TRUST_CONCEPTS,
    resolved: {
      accent_restraint_max: VISUAL_TRUST_CONCEPTS[0]!.measurable.accent_elements_max as number,
      margin_px: page.margin_px,
      contrast_ratio_min: 7,
      identity_markers_expected: identity.section_marker ? 4 : 0,
      trust_floor: VISUAL_TRUST_RULES.trust_floor,
    },
    intelligence_questions: VISUAL_TRUST_CONCEPTS.map((c) => c.brain_question),
  };
}
