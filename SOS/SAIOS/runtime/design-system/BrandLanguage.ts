/**
 * Brand language — recognition, memorability, StudiosisLab visual signature.
 * AGENT #080 — StudiosisLab Design DNA.
 */
import type { DesignMemoryContext } from "./DesignMemoryBridge.js";
import type { DesignConceptRule } from "./DesignPsychology.js";
import { DESIGN_DNA_VERSION } from "./DesignDNAVersion.js";

export const BRAND_LANGUAGE_CONCEPTS: DesignConceptRule[] = [
  {
    id: "recognition",
    label: "Recognition",
    definition: "Instantly identifiable as StudiosisLab beside Canva, Resume.io, Enhancv.",
    psychology: "Brand is repeated micro-decisions, not a logo splash.",
    observed_in: ["Stripe", "Linear", "Notion"],
    measurable: { signature_id_required: true, marker_rule_pair: true },
    design_system_refs: ["visual_language.signature", "premium_identity"],
    brain_question: "Would a founder recognize this as ours in a thumbnail grid?",
  },
  {
    id: "visual_signature",
    label: "Visual Signature",
    definition: "Accent bar + section marker + section rule + role/company split.",
    psychology: "Signature must be structural — never clipart or icons.",
    observed_in: ["StudiosisLab FR#004", "Swiss identity systems"],
    measurable: { signature_elements: 4, graphics_forbidden: true },
    design_system_refs: ["visual_language", "premium_identity"],
    brain_question: "What is the one repeatable StudiosisLab move on this page?",
  },
  {
    id: "brand_confidence",
    label: "Brand Confidence",
    definition: "Consistent application of DNA across every template family.",
    psychology: "Inconsistent premium is worse than consistent minimal.",
    observed_in: ["Apple ecosystem", "Google Material discipline"],
    measurable: { dna_version_pinned: true, token_only_design: true },
    design_system_refs: ["design_dna", "tokens"],
    brain_question: "Does this template inherit the same DNA as the last?",
  },
  {
    id: "emotional_appeal",
    label: "Emotional Appeal",
    definition: "Users choose templates emotionally before evaluating ATS.",
    psychology: "Thumbnail emotion drives click; structure drives hire.",
    observed_in: ["Canva marketplace", "Resume.io gallery"],
    measurable: { first_impression_score_min: 90, click_prediction_min: 88 },
    design_system_refs: ["premium_header", "visual_language"],
    brain_question: "Would someone click this thumbnail before reading specs?",
  },
];

export const BRAND_LANGUAGE_RULES = {
  signature_id: "studiosislab-premium-ats-v1",
  identity_phrase: "accent-marker + section rule + role/company split + focal experience",
  recognizability_floor: 90,
  memorability_requires: ["name_dominance", "experience_focal", "signature_marker"],
} as const;

export function buildBrandLanguageSystem(ctx: DesignMemoryContext) {
  const lang = ctx.effective_visual_language;
  const identity = ctx.effective_premium_identity;

  return {
    version: DESIGN_DNA_VERSION,
    module: "brand-language",
    spec: BRAND_LANGUAGE_RULES,
    concepts: BRAND_LANGUAGE_CONCEPTS,
    resolved: {
      signature_id: lang.signature_id,
      identity_phrase: BRAND_LANGUAGE_RULES.identity_phrase,
      accent_marker: identity.accent_marker,
      role_company_split: lang.role_company_split,
      recognizability_floor: BRAND_LANGUAGE_RULES.recognizability_floor,
    },
    intelligence_questions: BRAND_LANGUAGE_CONCEPTS.map((c) => c.brain_question),
  };
}
