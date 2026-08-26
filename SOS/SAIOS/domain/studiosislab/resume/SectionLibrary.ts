import type { SectionDefinition } from "./types.js";

/**
 * Standard resume section library for StudiosisLab template generation.
 */
export const SECTION_LIBRARY: readonly SectionDefinition[] = [
  {
    id: "contact",
    standard_heading: "Contact",
    alternate_headings: ["Contact Information", "Details"],
    required: true,
    typical_order: 1,
    ats_keywords: ["email", "phone", "linkedin", "location", "city"],
    placeholder_guidance: "Name, title, email, phone, city/state, LinkedIn URL — single block",
  },
  {
    id: "summary",
    standard_heading: "Professional Summary",
    alternate_headings: ["Summary", "Profile", "About Me"],
    required: true,
    typical_order: 2,
    ats_keywords: ["summary", "profile", "overview"],
    placeholder_guidance: "2–4 lines tailored to category; include years of experience and specialty",
  },
  {
    id: "experience",
    standard_heading: "Work Experience",
    alternate_headings: ["Experience", "Employment History", "Professional Experience"],
    required: true,
    typical_order: 3,
    ats_keywords: ["experience", "employment", "work history"],
    placeholder_guidance: "Reverse-chronological roles with quantified bullets (metrics, %, $)",
  },
  {
    id: "education",
    standard_heading: "Education",
    alternate_headings: ["Academic Background", "Qualifications"],
    required: true,
    typical_order: 4,
    ats_keywords: ["education", "degree", "university", "college"],
    placeholder_guidance: "Degree, institution, graduation year; honors optional",
  },
  {
    id: "skills",
    standard_heading: "Skills",
    alternate_headings: ["Technical Skills", "Core Skills", "Key Skills"],
    required: true,
    typical_order: 5,
    ats_keywords: ["skills", "technologies", "tools", "competencies"],
    placeholder_guidance: "Comma-separated or bullet list; group by category for technical roles",
  },
  {
    id: "certifications",
    standard_heading: "Certifications",
    alternate_headings: ["Certificates", "Licenses"],
    required: false,
    typical_order: 6,
    ats_keywords: ["certification", "license", "credential"],
    placeholder_guidance: "Cert name, issuer, year — especially healthcare, IT, finance",
  },
  {
    id: "projects",
    standard_heading: "Projects",
    alternate_headings: ["Key Projects", "Selected Projects"],
    required: false,
    typical_order: 7,
    ats_keywords: ["project", "portfolio", "case study"],
    placeholder_guidance: "Project name, tech stack, outcome — critical for engineering and design",
  },
  {
    id: "languages",
    standard_heading: "Languages",
    alternate_headings: ["Language Proficiency"],
    required: false,
    typical_order: 8,
    ats_keywords: ["language", "fluent", "proficiency"],
    placeholder_guidance: "Language and level (Native, Professional, Conversational)",
  },
  {
    id: "awards",
    standard_heading: "Awards",
    alternate_headings: ["Honors", "Achievements"],
    required: false,
    typical_order: 9,
    ats_keywords: ["award", "honor", "recognition"],
    placeholder_guidance: "Award name, issuer, year",
  },
  {
    id: "references",
    standard_heading: "References",
    alternate_headings: ["References Available"],
    required: false,
    typical_order: 10,
    ats_keywords: ["reference"],
    placeholder_guidance: '"Available upon request" or omit for one-page resumes',
  },
] as const;

export const CATEGORY_SECTION_DEFAULTS: Record<string, string[]> = {
  engineering: ["contact", "summary", "skills", "experience", "projects", "education", "certifications"],
  healthcare: ["contact", "summary", "experience", "education", "certifications", "skills"],
  finance: ["contact", "summary", "experience", "education", "skills", "certifications"],
  student: ["contact", "summary", "education", "projects", "skills", "experience"],
  creative: ["contact", "summary", "experience", "projects", "skills", "education"],
  default: ["contact", "summary", "experience", "education", "skills"],
};

export function getSectionById(id: string): SectionDefinition | undefined {
  return SECTION_LIBRARY.find((s) => s.id === id);
}

export function getSectionsForCategory(categoryId: string): SectionDefinition[] {
  const ids = CATEGORY_SECTION_DEFAULTS[categoryId] ?? CATEGORY_SECTION_DEFAULTS.default!;
  return ids.map((id) => getSectionById(id)!).filter(Boolean);
}
