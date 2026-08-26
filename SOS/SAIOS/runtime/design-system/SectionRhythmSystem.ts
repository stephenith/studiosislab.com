/**
 * Advanced vertical rhythm — intentional section-to-section transitions.
 * Founder Review #003.
 */
import type { DesignMemoryContext } from "./DesignMemoryBridge.js";
import { DESIGN_SYSTEM_VERSION } from "./types.js";

export const SECTION_RHYTHM_RULES = {
  after_summary_px: 24,
  after_experience_px: 20,
  after_skills_px: 16,
  after_education_px: 12,
  after_certifications_px: 8,
  default_transition_px: 16,
} as const;

export type SectionRhythmSpec = typeof SECTION_RHYTHM_RULES;

export type SectionTransitionKey =
  | "summary"
  | "experience"
  | "skills"
  | "education"
  | "certifications";

export function buildSectionRhythmSystem(ctx: DesignMemoryContext) {
  const r = ctx.effective_section_rhythm;

  const transitions: Record<SectionTransitionKey, number> = {
    summary: r.after_summary_px,
    experience: r.after_experience_px,
    skills: r.after_skills_px,
    education: r.after_education_px,
    certifications: r.after_certifications_px,
  };

  return {
    version: DESIGN_SYSTEM_VERSION,
    spec: r,
    transitions,
    resolve_after_section: (sectionKey: string): number => {
      const key = sectionKey as SectionTransitionKey;
      return transitions[key] ?? r.default_transition_px;
    },
    rhythm_tiers: {
      large: r.after_summary_px,
      medium: r.after_experience_px,
      standard: r.after_skills_px,
      compact: r.after_education_px,
      minimal: r.after_certifications_px,
    },
    rules: [
      "Summary → Experience: largest transition (visual chapter break)",
      "Experience → Skills: medium transition",
      "Skills → Education: standard transition",
      "Education → Certifications: compact transition",
      "All values on 4px grid; intentional not uniform",
    ],
    generated_at: new Date().toISOString(),
  };
}
