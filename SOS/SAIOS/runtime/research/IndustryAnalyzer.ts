/**
 * Industry analyzer — map founder objective to industry profile and hiring context.
 */
import type { ExperienceLevel, IndustryAnalysis, IndustryId } from "./types.js";
import { SUPPORTED_INDUSTRIES } from "./types.js";

const INDUSTRY_KEYWORDS: Record<IndustryId, string[]> = {
  software: ["software", "developer", "engineer", "tech", "it", "programming"],
  finance: ["finance", "accounting", "banking", "investment", "cfa"],
  marketing: ["marketing", "brand", "digital", "content", "seo"],
  sales: ["sales", "account executive", "business development", "revenue"],
  healthcare: ["healthcare", "medical", "nurse", "clinical", "hospital"],
  engineering: ["engineering", "mechanical", "civil", "structural"],
  construction: ["construction", "builder", "contractor", "site"],
  government: ["government", "federal", "public sector", "civil service"],
  legal: ["legal", "attorney", "lawyer", "paralegal", "counsel"],
  hr: ["human resources", "hr", "talent", "recruiting", "people ops"],
  operations: ["operations", "logistics", "supply chain", "process"],
  hospitality: ["hospitality", "hotel", "restaurant", "travel", "tourism"],
  education: ["education", "teacher", "professor", "school"],
  creative: ["creative", "designer", "portfolio", "art", "ux"],
  academic: ["academic", "research", "phd", "postdoc", "faculty"],
  student: ["student", "intern", "entry level", "graduate", "new grad"],
  executive: ["executive", "ceo", "cto", "cfo", "director", "vp"],
};

const INDUSTRY_PROFILES: Record<
  IndustryId,
  Omit<IndustryAnalysis, "industry" | "confidence">
> = {
  software: {
    experience_level: "mid",
    hiring_style: "Skills-forward, project evidence, ATS keyword matching",
    ats_sensitivity: "high",
    expected_resume_length: "one_page",
    visual_preference: "ats_first",
    target_recruiter_style: "Technical recruiter, fast scan",
  },
  finance: {
    experience_level: "senior",
    hiring_style: "Conservative, metrics-driven, credentials prominent",
    ats_sensitivity: "high",
    expected_resume_length: "one_page",
    visual_preference: "ats_first",
    target_recruiter_style: "Corporate HR, compliance-aware",
  },
  marketing: {
    experience_level: "mid",
    hiring_style: "Portfolio-aware, campaign metrics, brand sensibility",
    ats_sensitivity: "medium",
    expected_resume_length: "one_page",
    visual_preference: "hybrid",
    target_recruiter_style: "Creative hiring manager",
  },
  sales: {
    experience_level: "mid",
    hiring_style: "Quota achievement, territory, relationship building",
    ats_sensitivity: "medium",
    expected_resume_length: "one_page",
    visual_preference: "balanced",
    target_recruiter_style: "Sales leader, results-focused",
  },
  healthcare: {
    experience_level: "mid",
    hiring_style: "Licenses, certifications, clinical experience",
    ats_sensitivity: "high",
    expected_resume_length: "one_page",
    visual_preference: "ats_first",
    target_recruiter_style: "Clinical recruiter",
  },
  engineering: {
    experience_level: "senior",
    hiring_style: "Projects, standards, safety, technical depth",
    ats_sensitivity: "high",
    expected_resume_length: "one_page",
    visual_preference: "ats_first",
    target_recruiter_style: "Engineering manager",
  },
  construction: {
    experience_level: "mid",
    hiring_style: "Safety certs, project scale, trade expertise",
    ats_sensitivity: "medium",
    expected_resume_length: "one_page",
    visual_preference: "ats_first",
    target_recruiter_style: "Site manager / PM",
  },
  government: {
    experience_level: "mid",
    hiring_style: "Formal structure, clearance, compliance sections",
    ats_sensitivity: "high",
    expected_resume_length: "two_page",
    visual_preference: "ats_first",
    target_recruiter_style: "Federal HR specialist",
  },
  legal: {
    experience_level: "senior",
    hiring_style: "Bar admission, practice areas, deal/case scale",
    ats_sensitivity: "high",
    expected_resume_length: "one_page",
    visual_preference: "ats_first",
    target_recruiter_style: "Legal recruiting partner",
  },
  hr: {
    experience_level: "mid",
    hiring_style: "HRIS, policy, employee relations metrics",
    ats_sensitivity: "medium",
    expected_resume_length: "one_page",
    visual_preference: "balanced",
    target_recruiter_style: "HR business partner",
  },
  operations: {
    experience_level: "mid",
    hiring_style: "Efficiency metrics, process improvement, scale",
    ats_sensitivity: "high",
    expected_resume_length: "one_page",
    visual_preference: "ats_first",
    target_recruiter_style: "Operations director",
  },
  hospitality: {
    experience_level: "entry",
    hiring_style: "Service experience, languages, availability",
    ats_sensitivity: "medium",
    expected_resume_length: "one_page",
    visual_preference: "visual_first",
    target_recruiter_style: "Hiring manager, personality scan",
  },
  education: {
    experience_level: "mid",
    hiring_style: "Credentials, curriculum, student outcomes",
    ats_sensitivity: "medium",
    expected_resume_length: "one_page",
    visual_preference: "balanced",
    target_recruiter_style: "Principal / dean",
  },
  creative: {
    experience_level: "mid",
    hiring_style: "Portfolio link, visual hierarchy, project showcase",
    ats_sensitivity: "low",
    expected_resume_length: "one_page",
    visual_preference: "visual_first",
    target_recruiter_style: "Creative director",
  },
  academic: {
    experience_level: "senior",
    hiring_style: "Publications, grants, teaching, research",
    ats_sensitivity: "medium",
    expected_resume_length: "two_page",
    visual_preference: "ats_first",
    target_recruiter_style: "Search committee",
  },
  student: {
    experience_level: "entry",
    hiring_style: "Education, internships, projects, skills",
    ats_sensitivity: "high",
    expected_resume_length: "one_page",
    visual_preference: "ats_first",
    target_recruiter_style: "Campus recruiter",
  },
  executive: {
    experience_level: "executive",
    hiring_style: "Leadership scope, P&L, board exposure, transformation",
    ats_sensitivity: "medium",
    expected_resume_length: "two_page",
    visual_preference: "hybrid",
    target_recruiter_style: "Executive search consultant",
  },
};

export function analyzeIndustry(objective: string): IndustryAnalysis {
  const lower = objective.toLowerCase();
  let best: IndustryId = "software";
  let bestScore = 0;

  for (const industry of SUPPORTED_INDUSTRIES) {
    const keywords = INDUSTRY_KEYWORDS[industry];
    const score = keywords.filter((kw) => lower.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      best = industry;
    }
  }

  if (bestScore === 0) {
    if (lower.includes("ats")) best = "software";
    else if (lower.includes("professional")) best = "operations";
  }

  const profile = INDUSTRY_PROFILES[best];
  let experience_level = profile.experience_level;
  if (lower.includes("senior") || lower.includes("lead")) experience_level = "senior";
  if (lower.includes("executive") || lower.includes("director")) experience_level = "executive";
  if (lower.includes("student") || lower.includes("intern")) experience_level = "entry";

  return {
    industry: best,
    ...profile,
    experience_level,
    confidence: Math.min(70 + bestScore * 10, 98),
  };
}
