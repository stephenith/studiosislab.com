/**
 * Section library — design variants for resume sections.
 */
import { getSectionById, SECTION_LIBRARY } from "../../domain/studiosislab/resume/SectionLibrary.js";
import type { ATSComponentFlags, SectionVariantId } from "./types.js";
import { DESIGN_SYSTEM_VERSION } from "./types.js";

export type SectionVariant = {
  id: SectionVariantId;
  heading_style: "section" | "subheading";
  spacing_px: { before: number; after: number; item_gap: number };
  bullet_style: "disc" | "circle" | "hyphen" | "none" | "chips";
  content_rhythm: "tight" | "balanced" | "airy";
  divider_behavior: "none" | "line" | "spacing-only";
  standard_heading: string;
} & ATSComponentFlags;

const SECTION_IDS: SectionVariantId[] = [
  "experience",
  "education",
  "skills",
  "projects",
  "certificates",
  "awards",
  "languages",
  "summary",
  "volunteer",
  "achievements",
  "publications",
  "references",
];

const DOMAIN_MAP: Record<SectionVariantId, string> = {
  experience: "experience",
  education: "education",
  skills: "skills",
  projects: "projects",
  certificates: "certifications",
  awards: "awards",
  languages: "languages",
  summary: "summary",
  volunteer: "experience",
  achievements: "awards",
  publications: "projects",
  references: "references",
};

function baseSection(id: SectionVariantId): SectionVariant {
  const domainId = DOMAIN_MAP[id];
  const domain = getSectionById(domainId);
  const bullet =
    id === "skills" ? "chips" : id === "summary" || id === "references" ? "none" : "disc";

  return {
    id,
    heading_style: "section",
    spacing_px: { before: 16, after: 8, item_gap: 8 },
    bullet_style: bullet,
    content_rhythm: id === "experience" ? "balanced" : "airy",
    divider_behavior: id === "summary" ? "spacing-only" : "line",
    standard_heading: domain?.standard_heading ?? id,
    ats_safe: true,
    machine_readable: true,
    text_order: "heading → content → bullets",
    contrast_safe: true,
    print_safe: true,
  };
}

export function buildSectionSystem() {
  const variants = SECTION_IDS.map(baseSection);

  return {
    version: DESIGN_SYSTEM_VERSION,
    variants,
    domain_sections: [...SECTION_LIBRARY],
    generated_at: new Date().toISOString(),
  };
}
