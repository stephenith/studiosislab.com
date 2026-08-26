/**
 * Premium behaviour — role-specific and ATS-safe premium posture.
 * AGENT #080 — StudiosisLab Design DNA.
 */
import type { DesignMemoryContext } from "./DesignMemoryBridge.js";
import type { DesignConceptRule } from "./DesignPsychology.js";
import { DESIGN_DNA_VERSION } from "./DesignDNAVersion.js";

export const PREMIUM_BEHAVIOUR_CONCEPTS: DesignConceptRule[] = [
  {
    id: "premium_density",
    label: "Premium Density",
    definition: "Full page without clutter — signal-rich, breath-balanced.",
    psychology: "Cheap templates are empty or stuffed; premium fills with purpose.",
    observed_in: ["Resume.io", "Enhancv one-pagers"],
    measurable: { utilization_min: 0.8, utilization_max: 0.93 },
    design_system_refs: ["content_density"],
    brain_question: "Is density premium or merely full?",
  },
  {
    id: "corporate_behaviour",
    label: "Corporate Behaviour",
    definition: "Restrained palette, strong axis, conservative decoration.",
    psychology: "Finance and ops roles punish flash; reward calm authority.",
    observed_in: ["Novorésumé corporate", "executive templates"],
    measurable: { decoration_max: 0.12, palette: "executive-neutral" },
    design_system_refs: ["colors", "ats"],
    brain_question: "Does this behave like a boardroom document?",
  },
  {
    id: "creative_behaviour",
    label: "Creative Behaviour",
    definition: "Expressive hierarchy within ATS-safe text structure.",
    psychology: "Creatives need personality without breaking parse rules.",
    observed_in: ["Canva creative", "graphic designer resumes"],
    measurable: { accent_allowed: true, images_forbidden: true },
    design_system_refs: ["layout.creative-ats-safe"],
    brain_question: "Is personality shown through type and rhythm only?",
  },
  {
    id: "executive_behaviour",
    label: "Executive Behaviour",
    definition: "Generous margins, name dominance, achievement-forward experience.",
    psychology: "Executives are skimmed for scope and impact in seconds.",
    observed_in: ["C-suite templates", "McKinsey-style CVs"],
    measurable: { name_pt_min: 38, margin_px_min: 48 },
    design_system_refs: ["premium_header", "page_width"],
    brain_question: "Does this feel C-suite without feeling dated?",
  },
  {
    id: "ats_safe_premium",
    label: "ATS-Safe Premium Behaviour",
    definition: "Premium through typography and spacing — never graphics or tables.",
    psychology: "ATS and beauty are not opposites when design is structural.",
    observed_in: ["Resume.io ATS mode", "StudiosisLab target"],
    measurable: { single_column: true, textbox_only: true, groups_zero: true },
    design_system_refs: ["ats", "components"],
    brain_question: "Is premium achieved without ATS risk?",
  },
];

export const PREMIUM_BEHAVIOUR_RULES = {
  modes: ["corporate", "creative", "executive", "ats_safe_premium"] as const,
  default_mode: "ats_safe_premium" as const,
  density_target: { min: 0.85, max: 0.92 },
} as const;

export function buildPremiumBehaviourSystem(ctx: DesignMemoryContext) {
  const density = ctx.effective_content_density;
  const typo = ctx.effective_typography;

  return {
    version: DESIGN_DNA_VERSION,
    module: "premium-behaviour",
    spec: PREMIUM_BEHAVIOUR_RULES,
    concepts: PREMIUM_BEHAVIOUR_CONCEPTS,
    resolved: {
      default_mode: PREMIUM_BEHAVIOUR_RULES.default_mode,
      page_utilization_target: density.page_utilization_target,
      name_pt: typo.name_size_pt,
      margin_px: ctx.effective_page_width.margin_px,
      ats_safe_premium: true,
    },
    intelligence_questions: PREMIUM_BEHAVIOUR_CONCEPTS.map((c) => c.brain_question),
  };
}
