/**
 * StudiosisLab Design DNA — permanent creative foundation.
 * AGENT #080 — teaches WHY premium feels premium, not spacing or ATS.
 *
 * Integrates psychology, trust, editorial composition, attention flow,
 * premium behaviour, and brand language into one consumable system.
 */
import type { DesignMemoryContext } from "./DesignMemoryBridge.js";
import { buildDesignPsychologySystem, type DesignConceptRule } from "./DesignPsychology.js";
import { buildVisualTrustSystem } from "./VisualTrustSystem.js";
import { buildEditorialCompositionSystem } from "./EditorialComposition.js";
import { buildAttentionFlowSystem } from "./AttentionFlow.js";
import { buildPremiumBehaviourSystem } from "./PremiumBehaviour.js";
import { buildBrandLanguageSystem } from "./BrandLanguage.js";

import { DESIGN_DNA_VERSION } from "./DesignDNAVersion.js";

export { DESIGN_DNA_VERSION };

export const DESIGN_DNA_INSPIRATION = [
  "Resume.io — confident header rhythm and recruiter scan path",
  "Novorésumé — trustworthy restraint and calm hierarchy",
  "Canva — thumbnail emotional appeal without copying layouts",
  "Enhancv — modern experience focal blocks",
  "Apple documentation — clean negative space and optical balance",
  "Linear — intentional alignment and shape language",
  "Stripe — premium density and single-axis trust",
  "Notion — effortless section rhythm",
  "Editorial magazines — eye guidance and visual tension",
  "Swiss typography — timeless weight contrast and grid discipline",
] as const;

export const DESIGN_DNA_PRINCIPLES = [
  "Never copy layouts — extract design thinking only",
  "Premium is structural: type, rhythm, weight, and space — not graphics",
  "The eye moves before the mind reads — design the scan path",
  "Experience is the hiring decision zone — give it focal mass",
  "Trust is built through restraint, alignment, and predictability",
  "StudiosisLab signature is repeatable micro-structure, not decoration",
  "Emotional appeal wins the click; structure wins the interview",
  "ATS-safe and premium are allies when design is typographic",
] as const;

export type DesignDNABundle = ReturnType<typeof buildDesignDNASystem>;

export function buildDesignDNASystem(ctx: DesignMemoryContext) {
  const psychology = buildDesignPsychologySystem(ctx);
  const visual_trust = buildVisualTrustSystem(ctx);
  const editorial = buildEditorialCompositionSystem(ctx);
  const attention_flow = buildAttentionFlowSystem(ctx);
  const premium_behaviour = buildPremiumBehaviourSystem(ctx);
  const brand_language = buildBrandLanguageSystem(ctx);

  const all_concepts: DesignConceptRule[] = [
    ...psychology.concepts,
    ...visual_trust.concepts,
    ...editorial.concepts,
    ...attention_flow.concepts,
    ...premium_behaviour.concepts,
    ...brand_language.concepts,
  ];

  const intelligence_questions = [
    ...psychology.intelligence_questions,
    ...visual_trust.intelligence_questions,
    ...editorial.intelligence_questions,
    ...attention_flow.intelligence_questions,
    ...premium_behaviour.intelligence_questions,
    ...brand_language.intelligence_questions,
  ];

  const brain_directives = [
    "Where should the eye naturally move?",
    "What deserves attention — not what font size?",
    "What feels effortless about this composition?",
    "Does experience feel like the visual center?",
    "Would someone recognize this as StudiosisLab?",
  ];

  return {
    version: DESIGN_DNA_VERSION,
    module: "studiosislab-design-dna",
    role: "permanent_creative_foundation",
    inspiration: DESIGN_DNA_INSPIRATION,
    principles: DESIGN_DNA_PRINCIPLES,
    psychology,
    visual_trust,
    editorial,
    attention_flow,
    premium_behaviour,
    brand_language,
    concepts: all_concepts,
    concept_count: all_concepts.length,
    intelligence_questions,
    brain_directives,
    resolved: {
      scan_path: attention_flow.resolved.scan_path,
      focal_weights: attention_flow.resolved.focal_weights,
      signature_id: brand_language.resolved.signature_id,
      trust_floor: visual_trust.resolved.trust_floor,
      premium_mode: premium_behaviour.resolved.default_mode,
      hero_zone_max_pct: editorial.resolved.hero_zone_max_pct,
      recognizability_floor: brand_language.resolved.recognizability_floor,
      dwell_experience_pct: attention_flow.resolved.dwell_experience_pct,
    },
    measurable_rule_count: all_concepts.reduce(
      (n, c) => n + Object.keys(c.measurable).length,
      0,
    ),
    design_system_links: [
      "visual_language",
      "premium_identity",
      "premium_header",
      "experience_block",
      "section_rhythm",
      "hierarchy",
      "content_density",
      "page_width",
      "typography",
      "ats",
    ],
  };
}

export function validateDesignDNA(dna: DesignDNABundle): {
  pass: boolean;
  checks: Record<string, boolean>;
  issues: string[];
} {
  const issues: string[] = [];
  const checks: Record<string, boolean> = {
    concept_count_min_30: dna.concept_count >= 30,
    all_concepts_documented: dna.concepts.every((c) => c.definition.length > 10),
    all_concepts_measurable: dna.concepts.every((c) => Object.keys(c.measurable).length > 0),
    all_concepts_linked: dna.concepts.every((c) => c.design_system_refs.length > 0),
    all_concepts_brain_questions: dna.concepts.every((c) => c.brain_question.length > 10),
    intelligence_questions: dna.intelligence_questions.length >= 30,
    brain_directives: dna.brain_directives.length >= 5,
    scan_path_defined: dna.resolved.scan_path.length >= 5,
    signature_defined: dna.resolved.signature_id.length > 0,
    design_system_links: dna.design_system_links.length >= 8,
  };

  for (const [key, ok] of Object.entries(checks)) {
    if (!ok) issues.push(`DNA validation failed: ${key}`);
  }

  return { pass: issues.length === 0, checks, issues };
}

export function scoreDNAAlignment(input: {
  name_pt: number;
  margin_px: number;
  experience_focal: number;
  accent_count: number;
  section_markers: number;
  role_company_split: boolean;
  signature_id: string;
}): number {
  let score = 82;
  if (input.name_pt >= 36) score += 4;
  if (input.margin_px >= 44) score += 3;
  if (input.experience_focal >= 0.9) score += 5;
  if (input.accent_count <= 5) score += 3;
  if (input.section_markers >= 4) score += 3;
  if (input.role_company_split) score += 2;
  if (input.signature_id.includes("studiosislab")) score += 2;
  return Math.min(96, score);
}
