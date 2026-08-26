/**
 * Design psychology — why premium documents feel premium.
 * AGENT #080 — StudiosisLab Design DNA.
 */
import type { DesignMemoryContext } from "./DesignMemoryBridge.js";
import { DESIGN_DNA_VERSION } from "./DesignDNAVersion.js";

export type DesignConceptRule = {
  id: string;
  label: string;
  definition: string;
  psychology: string;
  observed_in: string[];
  measurable: Record<string, number | boolean | string>;
  design_system_refs: string[];
  brain_question: string;
};

export const DESIGN_PSYCHOLOGY_CONCEPTS: DesignConceptRule[] = [
  {
    id: "first_impression",
    label: "First Impression",
    definition: "The emotional verdict formed in the first 1–2 seconds of viewing.",
    psychology: "Users decide trust and quality before reading a single bullet.",
    observed_in: ["Resume.io", "Canva", "Apple product pages"],
    measurable: { header_zone_max_pct: 0.24, name_min_pt: 36, accent_max_count: 5 },
    design_system_refs: ["premium_header", "visual_language.focal_weights.header"],
    brain_question: "Does the header earn attention in the first two seconds?",
  },
  {
    id: "visual_confidence",
    label: "Visual Confidence",
    definition: "Layout certainty — nothing feels accidental or cramped.",
    psychology: "Confident spacing signals competence; hesitation signals amateur work.",
    observed_in: ["Stripe", "Linear", "Novorésumé"],
    measurable: { min_margin_px: 44, min_section_gap_px: 16, overlap_tolerance_px: 0 },
    design_system_refs: ["page_width", "section_rhythm", "spacing"],
    brain_question: "Does every element feel intentionally placed?",
  },
  {
    id: "visual_trust",
    label: "Visual Trust",
    definition: "Perceived reliability through restraint, alignment, and calm hierarchy.",
    psychology: "Trust grows when decoration is minimal and structure is predictable.",
    observed_in: ["Novorésumé", "Apple documentation", "government forms done well"],
    measurable: { max_font_families: 2, contrast_ratio_min: 7, decoration_density_max: 0.15 },
    design_system_refs: ["typography", "accessibility", "ats"],
    brain_question: "Would a recruiter trust this layout before reading content?",
  },
  {
    id: "eye_guidance",
    label: "Eye Guidance",
    definition: "Deliberate path directing gaze through priority content.",
    psychology: "The eye follows size, weight, and position — not reading order alone.",
    observed_in: ["Editorial magazines", "Enhancv", "Swiss posters"],
    measurable: { scan_zones_min: 4, experience_focal_weight_min: 0.9 },
    design_system_refs: ["visual_language.focal_weights", "hierarchy"],
    brain_question: "Where should the eye naturally move after the name?",
  },
  {
    id: "scanning_behaviour",
    label: "Scanning Behaviour",
    definition: "F-pattern and anchor scanning typical of recruiter review (6–10 seconds).",
    psychology: "Recruiters skim — hierarchy must reward partial attention.",
    observed_in: ["Resume.io", "LinkedIn profiles", "recruiter heatmaps"],
    measurable: { name_to_body_ratio_min: 2.8, section_heading_min_pt: 12 },
    design_system_refs: ["hierarchy.ladder", "experience_block"],
    brain_question: "Can a recruiter extract role and company in one scan pass?",
  },
  {
    id: "attention_anchors",
    label: "Attention Anchors",
    definition: "Fixed visual hooks that stop the eye (name, role, first metric).",
    psychology: "Anchors create memory; without them the page becomes wallpaper.",
    observed_in: ["Enhancv", "Canva hero templates", "magazine covers"],
    measurable: { anchor_count_min: 3, experience_marker_min_px: 48 },
    design_system_refs: ["premium_identity.section_marker", "experience_block.role_weight"],
    brain_question: "What three elements anchor attention on this page?",
  },
  {
    id: "visual_weight",
    label: "Visual Weight",
    definition: "Relative prominence of blocks through size, density, and contrast.",
    psychology: "Equal weight everywhere = nothing feels important.",
    observed_in: ["Swiss typography", "Stripe dashboards", "editorial grids"],
    measurable: { header_weight: 1.0, experience_weight_min: 0.9, supporting_weight_max: 0.6 },
    design_system_refs: ["visual_language.focal_weights"],
    brain_question: "Which section deserves the most visual mass?",
  },
  {
    id: "optical_balance",
    label: "Optical Balance",
    definition: "Perceived equilibrium — not mathematical symmetry alone.",
    psychology: "Heavy elements need counterweight in whitespace or alignment.",
    observed_in: ["Apple layouts", "Swiss grids", "Notion pages"],
    measurable: { margin_symmetry_px: 8, content_center_bias: 0.5 },
    design_system_refs: ["page_width", "margins"],
    brain_question: "Does the page feel balanced when squinting?",
  },
  {
    id: "breathing_rhythm",
    label: "Breathing Rhythm",
    definition: "Predictable inhale/exhale between dense and open zones.",
    psychology: "Rhythm creates calm; monotonous density creates fatigue.",
    observed_in: ["Notion", "Linear", "premium magazines"],
    measurable: { min_vertical_gap_px: 4, section_transition_tier_min: 3 },
    design_system_refs: ["section_rhythm.transitions", "spacing"],
    brain_question: "Does the page breathe between sections?",
  },
  {
    id: "negative_space",
    label: "Negative Space",
    definition: "Intentional emptiness that frames content and signals premium.",
    psychology: "Luxury uses space as a material — not leftover area.",
    observed_in: ["Apple", "luxury editorial", "minimal ATS leaders"],
    measurable: { margin_min_px: 44, page_utilization_max: 0.93 },
    design_system_refs: ["content_density", "page_width"],
    brain_question: "Is whitespace working for the content or against it?",
  },
  {
    id: "perceived_value",
    label: "Perceived Value",
    definition: "The feeling that the document is worth attention and download.",
    psychology: "Value is signaled by polish, not ornament.",
    observed_in: ["Resume.io paid tier", "Canva Pro", "Enhancv"],
    measurable: { premium_score_floor: 92, first_impression_min: 90 },
    design_system_refs: ["premium_header", "visual_language.signature"],
    brain_question: "Would a user pay for this aesthetic?",
  },
  {
    id: "white_space_psychology",
    label: "White Space Psychology",
    definition: "How emptiness communicates status, clarity, and respect for reader time.",
    psychology: "Crowded layouts feel cheap; generous margins feel executive.",
    observed_in: ["Executive resumes", "Stripe docs", "Swiss design"],
    measurable: { executive_margin_px: 48, compact_margin_px: 40 },
    design_system_refs: ["page_width.margins", "spacing"],
    brain_question: "Does margin width match the seniority of the role?",
  },
  {
    id: "alignment_psychology",
    label: "Alignment Psychology",
    definition: "Single-axis alignment creates subconscious order and professionalism.",
    psychology: "Misaligned edges trigger distrust before conscious notice.",
    observed_in: ["Linear", "Notion tables", "ATS-safe leaders"],
    measurable: { left_gutter_columns_max: 3, center_text_forbidden: true },
    design_system_refs: ["grid", "constraints"],
    brain_question: "Is there one clear vertical axis of trust?",
  },
  {
    id: "typography_psychology",
    label: "Typography Psychology",
    definition: "Weight and scale communicate authority, warmth, and precision.",
    psychology: "Bold names signal confidence; muted dates signal supporting info.",
    observed_in: ["Swiss typography", "Apple SF Pro hierarchy", "editorial"],
    measurable: { name_weight_min: 700, date_weight_max: 500 },
    design_system_refs: ["hierarchy", "typography.roles"],
    brain_question: "What deserves the boldest voice on this page?",
  },
  {
    id: "reading_speed",
    label: "Reading Speed",
    definition: "How quickly a recruiter extracts signal from layout alone.",
    psychology: "Fast scan = more interviews; slow decode = rejection.",
    observed_in: ["Resume.io F-pattern", "recruiter ATS workflows"],
    measurable: { body_line_height_min: 1.35, bullet_gap_min_px: 8 },
    design_system_refs: ["experience_block", "bullets"],
    brain_question: "Can role, company, and top metric be found in under 8 seconds?",
  },
  {
    id: "memorability",
    label: "Memorability",
    definition: "Distinctive but restrained identity that survives after tab switch.",
    psychology: "Memory requires one signature move — not decoration overload.",
    observed_in: ["StudiosisLab target", "Enhancv accents", "Canva thumbnails"],
    measurable: { signature_elements_min: 2, decoration_max: 6 },
    design_system_refs: ["premium_identity", "visual_language.signature"],
    brain_question: "Would someone recognize this beside competitors?",
  },
  {
    id: "professional_confidence",
    label: "Professional Confidence",
    definition: "Tone that says competent without shouting.",
    psychology: "Over-design reads as insecurity; calm reads as senior.",
    observed_in: ["Novorésumé", "executive templates", "finance resumes"],
    measurable: { accent_palette_count: 1, section_case: "uppercase" },
    design_system_refs: ["colors", "sections"],
    brain_question: "Does this feel senior or try-hard?",
  },
  {
    id: "luxury_minimalism",
    label: "Luxury Minimalism",
    definition: "Premium through reduction — fewer elements, higher craft.",
    psychology: "Luxury removes until only essentials remain.",
    observed_in: ["Apple", "Celine branding", "top ATS templates"],
    measurable: { decoration_density_max: 0.12, font_families_max: 2 },
    design_system_refs: ["ats", "premium_identity"],
    brain_question: "What can be removed without losing hierarchy?",
  },
];

export function buildDesignPsychologySystem(_ctx: DesignMemoryContext) {
  return {
    version: DESIGN_DNA_VERSION,
    module: "design-psychology",
    concepts: DESIGN_PSYCHOLOGY_CONCEPTS,
    concept_count: DESIGN_PSYCHOLOGY_CONCEPTS.length,
    intelligence_questions: DESIGN_PSYCHOLOGY_CONCEPTS.map((c) => c.brain_question),
    principles: DESIGN_PSYCHOLOGY_CONCEPTS.map(
      (c) => `${c.label}: ${c.psychology}`,
    ),
  };
}
