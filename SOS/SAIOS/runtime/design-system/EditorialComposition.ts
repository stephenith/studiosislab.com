/**
 * Editorial composition — magazine-grade layout thinking for resumes.
 * AGENT #080 — StudiosisLab Design DNA.
 */
import type { DesignMemoryContext } from "./DesignMemoryBridge.js";
import type { DesignConceptRule } from "./DesignPsychology.js";
import { DESIGN_DNA_VERSION } from "./DesignDNAVersion.js";

export const EDITORIAL_COMPOSITION_CONCEPTS: DesignConceptRule[] = [
  {
    id: "editorial_composition",
    label: "Editorial Composition",
    definition: "Page treated as editorial spread — hero, body, supporting rails.",
    psychology: "Magazines choreograph entry, dwell, and exit; resumes should too.",
    observed_in: ["Kinfolk", "Monocle", "premium editorial PDFs"],
    measurable: { hero_zone_pct: 0.22, body_zone_pct: 0.58 },
    design_system_refs: ["premium_header.header_zone_max_pct", "content_density"],
    brain_question: "Where is the hero, body, and footer of this story?",
  },
  {
    id: "visual_tension",
    label: "Visual Tension",
    definition: "Controlled contrast between dense and open zones creates interest.",
    psychology: "All-calm or all-dense pages feel dead; tension creates energy.",
    observed_in: ["Swiss posters", "Enhancv", "editorial covers"],
    measurable: { density_variance_min: 0.15, experience_density_peak: true },
    design_system_refs: ["visual_language.focal_weights", "experience_block"],
    brain_question: "Is there enough contrast between dense and open zones?",
  },
  {
    id: "shape_language",
    label: "Shape Language",
    definition: "Repeated geometric cues (rules, markers, bars) form a family.",
    psychology: "Consistent shapes become brand; random shapes become noise.",
    observed_in: ["Linear UI", "StudiosisLab markers", "Stripe lines"],
    measurable: { rule_thickness_px: 1, marker_width_px: 48, accent_bar_height_px: 4 },
    design_system_refs: ["premium_identity", "dividers"],
    brain_question: "Do lines and markers speak the same visual language?",
  },
  {
    id: "content_compression",
    label: "Content Compression",
    definition: "Fitting signal without crushing readability — editorial tightening.",
    psychology: "Premium density is full but never crowded.",
    observed_in: ["Resume.io one-page", "executive one-pagers"],
    measurable: { page_utilization_min: 0.8, page_utilization_max: 0.93 },
    design_system_refs: ["content_density"],
    brain_question: "Is the page full of signal or full of noise?",
  },
  {
    id: "information_priority",
    label: "Information Priority",
    definition: "What matters most gets first position and strongest voice.",
    psychology: "Priority is proven by placement, not bullet count.",
    observed_in: ["Novorésumé", "Enhancv experience blocks"],
    measurable: { experience_before_skills: true, summary_after_header: true },
    design_system_refs: ["hierarchy", "sections"],
    brain_question: "What is the single most important fact on this page?",
  },
  {
    id: "print_behaviour",
    label: "Print Behaviour",
    definition: "Layout survives PDF export, grayscale, and US Letter scaling.",
    psychology: "Print-safe design signals professionalism in offline handoffs.",
    observed_in: ["ATS PDF exports", "recruiter printouts"],
    measurable: { print_safe: true, min_margin_px: 40 },
    design_system_refs: ["constraints", "responsive"],
    brain_question: "Will this still feel premium when printed in grayscale?",
  },
];

export const EDITORIAL_COMPOSITION_RULES = {
  hero_zone_max_pct: 0.24,
  experience_zone_target_pct: 0.42,
  supporting_zone_max_pct: 0.28,
  shape_family: ["accent-bar", "section-marker", "section-rule"],
} as const;

export function buildEditorialCompositionSystem(ctx: DesignMemoryContext) {
  const density = ctx.effective_content_density;
  const header = ctx.effective_premium_header;

  return {
    version: DESIGN_DNA_VERSION,
    module: "editorial-composition",
    spec: EDITORIAL_COMPOSITION_RULES,
    concepts: EDITORIAL_COMPOSITION_CONCEPTS,
    resolved: {
      hero_zone_max_pct: header.header_zone_max_pct,
      page_utilization_target: density.page_utilization_target,
      shape_elements: EDITORIAL_COMPOSITION_RULES.shape_family,
      experience_zone_target_pct: EDITORIAL_COMPOSITION_RULES.experience_zone_target_pct,
    },
    intelligence_questions: EDITORIAL_COMPOSITION_CONCEPTS.map((c) => c.brain_question),
  };
}
