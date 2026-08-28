/**
 * Deterministic production role/title taxonomy — Phase 5F.
 * Structural job-role catalog only (no candidate content fabrication).
 * Sized to sustain morning+evening Resume Template batches beyond a 10-role pool.
 */
import type {
  ProductionCategory,
  ProductionSeniority,
  ProductionTarget,
} from "./ProductionTarget.js";

function titleToRoleFamily(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}
export type RoleTaxonomyEntry = {
  /** Stable cursor / audit id (category + slug). */
  id: string;
  category: ProductionCategory;
  title: string;
  seniority: ProductionSeniority;
  industry: string;
};

function entry(
  category: ProductionCategory,
  title: string,
  seniority: ProductionSeniority,
  industry: string,
): RoleTaxonomyEntry {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return {
    id: `${category}:${slug}`,
    category,
    title,
    seniority,
    industry,
  };
}

/** Objective templates keyed by category (coverage donor language). */
export const CATEGORY_OBJECTIVE_TEMPLATES: Record<ProductionCategory, string> = {
  ats: "Premium ATS-optimized {title} resume for {industry} professional",
  executive: "Executive {title} resume with premium hierarchy for senior leader",
  creative: "Creative {title} resume with modern visual hierarchy",
  student: "Student-oriented {title} resume optimized for early-career hiring",
  healthcare: "Healthcare {title} resume with ATS compliance",
  marketing: "Marketing {title} resume with campaign metrics focus",
  finance: "Finance {title} resume with conservative premium layout",
  engineering: "Engineering {title} resume with technical project emphasis",
  resume_refresh:
    "Refresh premium {title} resume with updated composition blocks",
  seo_expansion: "SEO-oriented {title} resume landing metadata expansion",
};

export function buildObjectiveForRole(
  category: ProductionCategory,
  title: string,
  industry: string,
): string {
  return CATEGORY_OBJECTIVE_TEMPLATES[category]
    .replace(/\{title\}/g, title)
    .replace(/\{industry\}/g, industry)
    .replace(/\{category\}/g, category);
}

/**
 * Expanded deterministic catalog. Multiple distinct titles per category.
 * Generic structural roles only — not fabricated person/employment facts.
 */
export const PRODUCTION_ROLE_TAXONOMY: RoleTaxonomyEntry[] = [
  // ats (software / ops / admin)
  entry("ats", "Operations Analyst", "mid", "software"),
  entry("ats", "Business Analyst", "mid", "software"),
  entry("ats", "Operations Manager", "senior", "software"),
  entry("ats", "Program Coordinator", "mid", "software"),
  entry("ats", "HR Generalist", "mid", "software"),
  entry("ats", "Paralegal", "mid", "software"),
  entry("ats", "Executive Assistant", "mid", "software"),
  entry("ats", "Office Manager", "mid", "software"),
  entry("ats", "Customer Success Associate", "entry", "software"),
  entry("ats", "Data Entry Specialist", "entry", "software"),

  // executive
  entry("executive", "Chief Operating Officer", "executive", "executive"),
  entry("executive", "VP of Operations", "executive", "executive"),
  entry("executive", "Chief of Staff", "executive", "executive"),
  entry("executive", "Managing Director", "executive", "executive"),
  entry("executive", "General Manager", "executive", "executive"),
  entry("executive", "Director of Strategy", "senior", "executive"),
  entry("executive", "VP of Sales", "executive", "executive"),
  entry("executive", "Chief Marketing Officer", "executive", "executive"),

  // creative
  entry("creative", "Creative Director", "senior", "creative"),
  entry("creative", "Art Director", "senior", "creative"),
  entry("creative", "Graphic Designer", "mid", "creative"),
  entry("creative", "UX Designer", "mid", "creative"),
  entry("creative", "Product Designer", "mid", "creative"),
  entry("creative", "Event Coordinator", "mid", "creative"),
  entry("creative", "Copywriter", "mid", "creative"),
  entry("creative", "Motion Designer", "mid", "creative"),
  entry("creative", "Brand Designer", "mid", "creative"),
  entry("creative", "UI Designer", "mid", "creative"),

  // student / early career
  entry("student", "Recent Graduate", "student", "student"),
  entry("student", "Teacher", "mid", "student"),
  entry("student", "Teaching Assistant", "entry", "student"),
  entry("student", "Research Assistant", "entry", "student"),
  entry("student", "Intern", "entry", "student"),
  entry("student", "Campus Ambassador", "entry", "student"),
  entry("student", "Tutor", "entry", "student"),
  entry("student", "Career Changer", "entry", "student"),

  // healthcare
  entry("healthcare", "Clinical Nurse Manager", "senior", "healthcare"),
  entry("healthcare", "Registered Nurse", "mid", "healthcare"),
  entry("healthcare", "Medical Assistant", "entry", "healthcare"),
  entry("healthcare", "Physician Assistant", "senior", "healthcare"),
  entry("healthcare", "Pharmacist", "senior", "healthcare"),
  entry("healthcare", "Physical Therapist", "mid", "healthcare"),
  entry("healthcare", "Healthcare Administrator", "mid", "healthcare"),
  entry("healthcare", "Dental Hygienist", "mid", "healthcare"),
  entry("healthcare", "Medical Coder", "mid", "healthcare"),
  entry("healthcare", "Clinical Research Coordinator", "mid", "healthcare"),

  // marketing
  entry("marketing", "Marketing Manager", "mid", "marketing"),
  entry("marketing", "Brand Manager", "senior", "marketing"),
  entry("marketing", "Content Strategist", "mid", "marketing"),
  entry("marketing", "Account Executive", "mid", "marketing"),
  entry("marketing", "Sales Development Rep", "entry", "marketing"),
  entry("marketing", "Digital Marketing Specialist", "mid", "marketing"),
  entry("marketing", "Product Marketing Manager", "senior", "marketing"),
  entry("marketing", "Social Media Manager", "mid", "marketing"),
  entry("marketing", "Growth Marketing Manager", "mid", "marketing"),
  entry("marketing", "Public Relations Specialist", "mid", "marketing"),

  // finance
  entry("finance", "Financial Analyst", "mid", "finance"),
  entry("finance", "Accountant", "mid", "finance"),
  entry("finance", "Controller", "senior", "finance"),
  entry("finance", "Bookkeeper", "entry", "finance"),
  entry("finance", "Investment Analyst", "mid", "finance"),
  entry("finance", "FP&A Analyst", "mid", "finance"),
  entry("finance", "Auditor", "mid", "finance"),
  entry("finance", "Treasury Analyst", "mid", "finance"),
  entry("finance", "Tax Specialist", "mid", "finance"),
  entry("finance", "Credit Analyst", "mid", "finance"),

  // engineering
  entry("engineering", "Software Engineer", "mid", "engineering"),
  entry("engineering", "Cloud Architect", "senior", "engineering"),
  entry("engineering", "DevOps Engineer", "senior", "engineering"),
  entry("engineering", "Backend Engineer", "mid", "engineering"),
  entry("engineering", "Frontend Engineer", "mid", "engineering"),
  entry("engineering", "Systems Administrator", "mid", "engineering"),
  entry("engineering", "Mechanical Engineer", "mid", "engineering"),
  entry("engineering", "Data Engineer", "mid", "engineering"),
  entry("engineering", "QA Engineer", "mid", "engineering"),
  entry("engineering", "Security Engineer", "mid", "engineering"),
  entry("engineering", "Mobile Engineer", "mid", "engineering"),
  entry("engineering", "Site Reliability Engineer", "senior", "engineering"),

  // resume_refresh (cross-functional refresh roles)
  entry("resume_refresh", "Product Manager", "mid", "software"),
  entry("resume_refresh", "Hotel Manager", "mid", "software"),
  entry("resume_refresh", "Project Manager", "mid", "software"),
  entry("resume_refresh", "Scrum Master", "mid", "software"),
  entry("resume_refresh", "Business Operations Lead", "senior", "software"),
  entry("resume_refresh", "Customer Support Manager", "mid", "software"),
  entry("resume_refresh", "Supply Chain Analyst", "mid", "software"),
  entry("resume_refresh", "Retail Store Manager", "mid", "software"),

  // seo_expansion
  entry("seo_expansion", "SEO Specialist", "mid", "marketing"),
  entry("seo_expansion", "SEO Manager", "senior", "marketing"),
  entry("seo_expansion", "Content SEO Writer", "mid", "marketing"),
  entry("seo_expansion", "Technical SEO Analyst", "mid", "marketing"),
  entry("seo_expansion", "Link Building Specialist", "mid", "marketing"),
  entry("seo_expansion", "Local SEO Specialist", "mid", "marketing"),
  entry("seo_expansion", "SEO Content Strategist", "mid", "marketing"),
  entry("seo_expansion", "Search Marketing Analyst", "mid", "marketing"),
];

export function roleCountsByCategory(): Record<ProductionCategory, number> {
  const out = {} as Record<ProductionCategory, number>;
  for (const r of PRODUCTION_ROLE_TAXONOMY) {
    out[r.category] = (out[r.category] ?? 0) + 1;
  }
  return out;
}

export function totalRoleTaxonomyCount(): number {
  return PRODUCTION_ROLE_TAXONOMY.length;
}

export function buildTargetFromRoleEntry(
  role: RoleTaxonomyEntry,
): ProductionTarget {
  return {
    category: role.category,
    title: role.title,
    industry: role.industry,
    seniority: role.seniority,
    objective: buildObjectiveForRole(role.category, role.title, role.industry),
    role_family: titleToRoleFamily(role.title),
  };
}

/** Primary legacy title per category (compat for goal-seed builders). */
export const PRIMARY_TITLE_BY_CATEGORY: Record<ProductionCategory, string> = {
  ats: "Operations Analyst",
  executive: "Chief Operating Officer",
  creative: "Creative Director",
  student: "Recent Graduate",
  healthcare: "Clinical Nurse Manager",
  marketing: "Marketing Manager",
  finance: "Financial Analyst",
  engineering: "Software Engineer",
  resume_refresh: "Product Manager",
  seo_expansion: "SEO Specialist",
};
