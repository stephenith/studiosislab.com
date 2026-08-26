/**
 * Production Batch 001 — first real production templates for founder review.
 */
export const BATCH_ID = "production-batch-001";

export const QUALITY_THRESHOLDS = {
  visual_render: 96,
  premium: 97,
  ats: 97,
  overall: 97,
  max_similarity: 0.7,
} as const;

export type BatchRole = {
  slug: string;
  title: string;
  objective: string;
  composition_mode: "premium" | "ats" | "executive" | "creative" | "student";
  seed: number;
};

export const BATCH_ROLES: BatchRole[] = [
  {
    slug: "software-engineer",
    title: "Software Engineer",
    composition_mode: "premium",
    seed: 1001,
    objective:
      "Production batch 001: Premium ATS resume template for a senior software engineer. Technical projects, clean hierarchy, Fabric 6.9.1, founder publication quality.",
  },
  {
    slug: "data-analyst",
    title: "Data Analyst",
    composition_mode: "ats",
    seed: 2002,
    objective:
      "Production batch 001: Premium ATS resume template for a data analyst. Metrics-driven experience, skills-forward, ATS-safe single column.",
  },
  {
    slug: "project-manager",
    title: "Project Manager",
    composition_mode: "premium",
    seed: 3003,
    objective:
      "Production batch 001: Premium ATS resume template for a project manager. Delivery outcomes, stakeholder scope, executive scan path.",
  },
  {
    slug: "marketing-manager",
    title: "Marketing Manager",
    composition_mode: "premium",
    seed: 4004,
    objective:
      "Production batch 001: Premium resume template for a marketing manager. Campaign metrics, brand sensibility, ATS-compatible structure.",
  },
  {
    slug: "sales-executive",
    title: "Sales Executive",
    composition_mode: "executive",
    seed: 5005,
    objective:
      "Production batch 001: Premium executive resume template for a sales executive. Revenue metrics forward, confident premium layout.",
  },
  {
    slug: "hr-specialist",
    title: "HR Specialist",
    composition_mode: "premium",
    seed: 6006,
    objective:
      "Production batch 001: Premium ATS resume template for an HR specialist. People-ops tone, certifications prominent.",
  },
  {
    slug: "finance-analyst",
    title: "Finance Analyst",
    composition_mode: "ats",
    seed: 7007,
    objective:
      "Production batch 001: Premium ATS resume template for a finance analyst. Conservative hierarchy, metrics-driven.",
  },
  {
    slug: "graphic-designer",
    title: "Graphic Designer",
    composition_mode: "creative",
    seed: 8008,
    objective:
      "Production batch 001: Premium creative-professional resume for a graphic designer. Visual polish with ATS-safe text structure.",
  },
  {
    slug: "teacher",
    title: "Teacher",
    composition_mode: "premium",
    seed: 9009,
    objective:
      "Production batch 001: Premium ATS resume template for an experienced teacher. Education credentials prominent, accessible typography.",
  },
  {
    slug: "student-fresher",
    title: "Student / Fresher",
    composition_mode: "student",
    seed: 1010,
    objective:
      "Production batch 001: Premium entry-level ATS resume for a student fresher. Education-first hierarchy, minimal decoration.",
  },
];
