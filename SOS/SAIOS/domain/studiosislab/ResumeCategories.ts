import type { ResumeCategory } from "./types.js";

/**
 * StudiosisLab resume category catalog — business knowledge only.
 */
export const RESUME_CATEGORIES: readonly ResumeCategory[] = [
  {
    id: "business",
    name: "Business",
    priority: "P1",
    seo_value: 8,
    ats_importance: 9,
    sample_job_roles: ["Business Analyst", "Operations Manager", "Management Consultant", "Project Coordinator"],
    recommended_template_count: 4,
  },
  {
    id: "finance",
    name: "Finance",
    priority: "P1",
    seo_value: 9,
    ats_importance: 9,
    sample_job_roles: ["Financial Analyst", "Accountant", "Investment Associate", "Controller"],
    recommended_template_count: 4,
  },
  {
    id: "marketing",
    name: "Marketing",
    priority: "P0",
    seo_value: 10,
    ats_importance: 8,
    sample_job_roles: ["Marketing Manager", "Content Strategist", "SEO Specialist", "Brand Manager"],
    recommended_template_count: 5,
  },
  {
    id: "sales",
    name: "Sales",
    priority: "P0",
    seo_value: 9,
    ats_importance: 8,
    sample_job_roles: ["Account Executive", "Sales Development Rep", "Regional Sales Manager", "Business Development"],
    recommended_template_count: 4,
  },
  {
    id: "healthcare",
    name: "Healthcare",
    priority: "P1",
    seo_value: 9,
    ats_importance: 10,
    sample_job_roles: ["Registered Nurse", "Medical Assistant", "Healthcare Administrator", "Clinical Research Coordinator"],
    recommended_template_count: 4,
  },
  {
    id: "engineering",
    name: "Engineering",
    priority: "P0",
    seo_value: 10,
    ats_importance: 9,
    sample_job_roles: ["Software Engineer", "Mechanical Engineer", "Civil Engineer", "DevOps Engineer"],
    recommended_template_count: 5,
  },
  {
    id: "it",
    name: "IT",
    priority: "P0",
    seo_value: 10,
    ats_importance: 9,
    sample_job_roles: ["Systems Administrator", "IT Support Specialist", "Network Engineer", "Cloud Architect"],
    recommended_template_count: 4,
  },
  {
    id: "design",
    name: "Design",
    priority: "P1",
    seo_value: 8,
    ats_importance: 7,
    sample_job_roles: ["UX Designer", "Graphic Designer", "Product Designer", "Visual Designer"],
    recommended_template_count: 3,
  },
  {
    id: "government",
    name: "Government",
    priority: "P2",
    seo_value: 7,
    ats_importance: 10,
    sample_job_roles: ["Policy Analyst", "Program Manager", "Administrative Officer", "Public Affairs Specialist"],
    recommended_template_count: 3,
  },
  {
    id: "legal",
    name: "Legal",
    priority: "P2",
    seo_value: 8,
    ats_importance: 10,
    sample_job_roles: ["Paralegal", "Legal Assistant", "Compliance Officer", "Contract Administrator"],
    recommended_template_count: 3,
  },
  {
    id: "hospitality",
    name: "Hospitality",
    priority: "P2",
    seo_value: 7,
    ats_importance: 7,
    sample_job_roles: ["Hotel Manager", "Front Desk Supervisor", "Event Coordinator", "Restaurant Manager"],
    recommended_template_count: 3,
  },
  {
    id: "education",
    name: "Education",
    priority: "P1",
    seo_value: 8,
    ats_importance: 8,
    sample_job_roles: ["Teacher", "Academic Advisor", "Curriculum Developer", "School Administrator"],
    recommended_template_count: 3,
  },
  {
    id: "student",
    name: "Student",
    priority: "P0",
    seo_value: 10,
    ats_importance: 8,
    sample_job_roles: ["Intern", "Graduate Student", "Entry-Level Candidate", "Campus Ambassador"],
    recommended_template_count: 4,
  },
  {
    id: "executive",
    name: "Executive",
    priority: "P1",
    seo_value: 8,
    ats_importance: 9,
    sample_job_roles: ["CEO", "COO", "VP of Operations", "Director of Strategy"],
    recommended_template_count: 3,
  },
  {
    id: "creative",
    name: "Creative",
    priority: "P1",
    seo_value: 8,
    ats_importance: 6,
    sample_job_roles: ["Art Director", "Copywriter", "Creative Producer", "Motion Designer"],
    recommended_template_count: 3,
  },
] as const;

export const TOTAL_RECOMMENDED_TEMPLATES = RESUME_CATEGORIES.reduce(
  (sum, c) => sum + c.recommended_template_count,
  0,
);

export function getResumeCategoryById(id: string): ResumeCategory | undefined {
  return RESUME_CATEGORIES.find((c) => c.id === id);
}

export function getResumeCategoryByName(name: string): ResumeCategory | undefined {
  return RESUME_CATEGORIES.find((c) => c.name.toLowerCase() === name.toLowerCase());
}

export function listResumeCategoriesByPriority(priority: ResumeCategory["priority"]): ResumeCategory[] {
  return RESUME_CATEGORIES.filter((c) => c.priority === priority);
}
