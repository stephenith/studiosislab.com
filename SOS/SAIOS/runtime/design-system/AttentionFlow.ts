/**
 * Attention flow — eye guidance, scanning, focal hierarchy.
 * AGENT #080 — StudiosisLab Design DNA.
 */
import type { DesignMemoryContext } from "./DesignMemoryBridge.js";
import type { DesignConceptRule } from "./DesignPsychology.js";
import { DESIGN_DNA_VERSION } from "./DesignDNAVersion.js";

export const ATTENTION_FLOW_CONCEPTS: DesignConceptRule[] = [
  {
    id: "focal_hierarchy",
    label: "Focal Hierarchy",
    definition: "Ordered dominance: name → experience → summary → supporting.",
    psychology: "The eye needs a ladder, not a flat field.",
    observed_in: ["Enhancv", "Resume.io", "editorial TOC"],
    measurable: { header_focal: 1.0, experience_focal_min: 0.9, summary_focal: 0.72 },
    design_system_refs: ["visual_language.focal_weights"],
    brain_question: "What is the second focal point after the name?",
  },
  {
    id: "scan_path",
    label: "Scan Path",
    definition: "Default recruiter path: header → summary → experience → skills → education.",
    psychology: "Design the path; do not assume reading order equals visual order.",
    observed_in: ["Recruiter heatmaps", "F-pattern studies"],
    measurable: { scan_zones: 5 },
    design_system_refs: ["hierarchy", "sections"],
    brain_question: "Where does the eye go in the first 6 seconds?",
  },
  {
    id: "experience_anchor",
    label: "Experience Anchor",
    definition: "Work history must win dwell time — it is the hiring decision zone.",
    psychology: "Recruiters hire on experience; everything else supports it.",
    observed_in: ["Novorésumé", "ATS parsers", "executive resumes"],
    measurable: { experience_marker_min_px: 48, role_weight_min: 700 },
    design_system_refs: ["experience_block", "visual_language.experience"],
    brain_question: "Does experience feel like the visual center of the page?",
  },
  {
    id: "effortless_flow",
    label: "Effortless Flow",
    definition: "Transitions between sections feel inevitable, not abrupt.",
    psychology: "Notion and Linear feel effortless because rhythm is consistent.",
    observed_in: ["Notion", "Linear", "Apple settings pages"],
    measurable: { section_transition_tiers: 4, min_gap_px: 4 },
    design_system_refs: ["section_rhythm.transitions"],
    brain_question: "What feels effortless about moving between sections?",
  },
];

export const ATTENTION_FLOW_RULES = {
  default_scan_path: [
    "name_header",
    "title_contact",
    "professional_summary",
    "work_experience",
    "technical_skills",
    "education",
    "certifications",
  ],
  dwell_weights: {
    header: 0.18,
    experience: 0.42,
    summary: 0.15,
    supporting: 0.25,
  },
  recruiter_scan_seconds_target: 8,
} as const;

export function buildAttentionFlowSystem(ctx: DesignMemoryContext) {
  const focal = ctx.effective_visual_language;
  const exp = ctx.effective_experience_block;

  return {
    version: DESIGN_DNA_VERSION,
    module: "attention-flow",
    spec: ATTENTION_FLOW_RULES,
    concepts: ATTENTION_FLOW_CONCEPTS,
    resolved: {
      scan_path: ATTENTION_FLOW_RULES.default_scan_path,
      focal_weights: {
        header: focal.focal_header,
        experience: focal.focal_experience,
        summary: focal.focal_summary,
        supporting: focal.supporting_sections,
      },
      experience_marker_width_px: focal.experience_marker_width_px,
      role_weight: exp.role_weight,
      dwell_experience_pct: ATTENTION_FLOW_RULES.dwell_weights.experience,
    },
    intelligence_questions: ATTENTION_FLOW_CONCEPTS.map((c) => c.brain_question),
  };
}
