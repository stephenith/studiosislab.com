/**
 * Sample profile standards for resume template placeholder content.
 */
export const SAMPLE_PROFILE_STANDARDS = {
  version: "1.0.0",
  naming: {
    pattern: "Fictional first + last names only",
    approved_names: [
      "Alex Morgan",
      "Jordan Lee",
      "Taylor Brooks",
      "Casey Nguyen",
      "Riley Chen",
      "Morgan Patel",
      "Jamie Rivera",
      "Avery Kim",
    ],
    forbidden: ["Real celebrity names", "StudiosisLab staff names", "Trademarked characters"],
  },
  employers: {
    pattern: "Generic or clearly fictional companies",
    approved_examples: [
      "Northbridge Analytics",
      "Summit Health Group",
      "BlueLine Technologies",
      "Harborview Consulting",
      "Pioneer Financial",
    ],
    forbidden: ["Google", "Amazon", "NHS", "Microsoft unless genericized"],
  },
  contact: {
    email_pattern: "firstname.lastname@email.com",
    phone_pattern: "(555) 010-XXXX",
    linkedin_pattern: "linkedin.com/in/firstname-lastname",
    location: "City, ST or City, UK",
  },
  experience: {
    bullets_per_role: { min: 2, max: 4 },
    quantification: "At least 50% of bullets include a number, %, or $",
    tense: "Present for current role; past for previous",
    date_format_us: "MM/YYYY – Present",
    date_format_uk: "Month YYYY – Present",
  },
  education: {
    degree_examples: ["B.S. Computer Science", "MBA", "B.A. Marketing", "RN, BSN"],
    institution_style: "Fictional university or Community College names",
  },
  skills: {
    format: "Comma-separated or 4–8 bullet items",
    category_groups: ["Technical", "Tools", "Soft Skills"],
    no_skill_bars: true,
  },
  json_schema_notes: [
    "Sample profiles may be stored as JSON alongside template for builder import",
    "Field names align with SECTION_LIBRARY ids",
    "Localize date and phone format per market_region metadata",
  ],
} as const;

export type SampleProfileStandards = typeof SAMPLE_PROFILE_STANDARDS;
