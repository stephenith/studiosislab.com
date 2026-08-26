/**
 * First Premium Collection — role definitions and quality thresholds.
 */
export const COLLECTION_ID = "first-premium-collection";

export const QUALITY_THRESHOLDS = {
  visual: 97,
  premium: 97,
  ats: 97,
  overall: 97,
  max_similarity: 0.7,
} as const;

export type CollectionRole = {
  slug: string;
  title: string;
  objective: string;
};

export const COLLECTION_ROLES: CollectionRole[] = [
  {
    slug: "software-engineer",
    title: "Software Engineer",
    objective:
      "Generate a premium modern ATS resume template for a senior software engineer. Emphasize technical projects, clean hierarchy, and ATS-safe structure.",
  },
  {
    slug: "marketing-manager",
    title: "Marketing Manager",
    objective:
      "Generate a premium modern ATS resume template for a marketing manager. Professional visual hierarchy with measurable campaign outcomes.",
  },
  {
    slug: "sales-executive",
    title: "Sales Executive",
    objective:
      "Generate a premium executive ATS resume template for a sales executive. Revenue metrics forward, confident premium layout.",
  },
  {
    slug: "finance-analyst",
    title: "Finance Analyst",
    objective:
      "Generate a premium modern ATS resume template for a finance analyst. Conservative color harmony, metrics-driven experience section.",
  },
  {
    slug: "hr-specialist",
    title: "HR Specialist",
    objective:
      "Generate a premium modern ATS resume template for an HR specialist. People-ops tone, clear certifications and skills.",
  },
  {
    slug: "customer-support",
    title: "Customer Support",
    objective:
      "Generate a premium modern ATS resume template for a customer support lead. Readable scan path, calm professional spacing.",
  },
  {
    slug: "project-manager",
    title: "Project Manager",
    objective:
      "Generate a premium modern ATS resume template for a project manager. Delivery outcomes, stakeholder scope, ATS-safe structure.",
  },
  {
    slug: "graphic-designer",
    title: "Graphic Designer",
    objective:
      "Generate a premium creative-professional resume template for a graphic designer. Visual polish with ATS-safe text structure.",
  },
  {
    slug: "teacher",
    title: "Teacher",
    objective:
      "Generate a premium modern ATS resume template for an experienced teacher. Education credentials prominent, accessible typography.",
  },
  {
    slug: "student-fresher",
    title: "Student / Fresher",
    objective:
      "Generate a premium entry-level ATS resume template for a student fresher. Education-first hierarchy, minimal decoration, high readability.",
  },
];
