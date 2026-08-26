/**
 * Deterministic research builder — Agent #206.
 * Donor algorithms lifted from runtime/research planners + domain ATS standards.
 * Does NOT import or activate legacy research/production engines.
 */
import type { ProductionCategory, ProductionTarget } from "./ProductionTarget.js";
import type { ResearchContext } from "./ResearchContext.js";

type IndustryProfile = {
  hiring_style: string;
  ats_sensitivity: "high" | "medium" | "low";
  expected_resume_length: "one_page" | "two_page";
  visual_preference: string;
  target_recruiter_style: string;
};

/** Donor: IndustryAnalyzer INDUSTRY_PROFILES (subset keyed by ProductionTarget.industry). */
const INDUSTRY_PROFILES: Record<string, IndustryProfile> = {
  software: {
    hiring_style: "Skills-forward, project evidence, ATS keyword matching",
    ats_sensitivity: "high",
    expected_resume_length: "one_page",
    visual_preference: "ats_first",
    target_recruiter_style: "Technical recruiter, fast scan",
  },
  finance: {
    hiring_style: "Conservative, metrics-driven, credentials prominent",
    ats_sensitivity: "high",
    expected_resume_length: "one_page",
    visual_preference: "ats_first",
    target_recruiter_style: "Corporate HR, compliance-aware",
  },
  marketing: {
    hiring_style: "Portfolio-aware, campaign metrics, brand sensibility",
    ats_sensitivity: "medium",
    expected_resume_length: "one_page",
    visual_preference: "hybrid",
    target_recruiter_style: "Creative hiring manager",
  },
  healthcare: {
    hiring_style: "Licenses, certifications, clinical experience",
    ats_sensitivity: "high",
    expected_resume_length: "one_page",
    visual_preference: "ats_first",
    target_recruiter_style: "Clinical recruiter",
  },
  engineering: {
    hiring_style: "Projects, standards, safety, technical depth",
    ats_sensitivity: "high",
    expected_resume_length: "one_page",
    visual_preference: "ats_first",
    target_recruiter_style: "Engineering manager",
  },
  creative: {
    hiring_style: "Portfolio link, visual hierarchy, project showcase",
    ats_sensitivity: "low",
    expected_resume_length: "one_page",
    visual_preference: "visual_first",
    target_recruiter_style: "Creative director / design lead",
  },
  student: {
    hiring_style: "Education, internships, projects, skills",
    ats_sensitivity: "high",
    expected_resume_length: "one_page",
    visual_preference: "ats_first",
    target_recruiter_style: "Campus / early-career recruiter",
  },
  executive: {
    hiring_style: "Leadership scope, P&L, board exposure, transformation",
    ats_sensitivity: "medium",
    expected_resume_length: "two_page",
    visual_preference: "hybrid",
    target_recruiter_style: "Executive search consultant",
  },
};

const DEFAULT_PROFILE: IndustryProfile = {
  hiring_style: "Clear achievements, standard sections, ATS-friendly structure",
  ats_sensitivity: "high",
  expected_resume_length: "one_page",
  visual_preference: "ats_first",
  target_recruiter_style: "Generalist recruiter",
};

/** Donor: LayoutPlanner.defaultSectionOrder */
function sectionOrderFor(industry: string, category: ProductionCategory): string[] {
  if (industry === "healthcare" || category === "healthcare") {
    return ["summary", "licenses", "experience", "education", "skills"];
  }
  if (industry === "executive" || category === "executive") {
    return ["summary", "experience", "leadership", "education", "skills"];
  }
  if (industry === "student" || category === "student") {
    return ["summary", "education", "projects", "experience", "skills"];
  }
  if (category === "creative" || industry === "creative") {
    return ["summary", "experience", "projects", "skills", "education"];
  }
  return ["summary", "experience", "education", "skills", "certifications"];
}

/**
 * Build ResearchContext for a ProductionTarget.
 * Pure / deterministic — same target → same context.
 */
export function buildResearchContext(target: ProductionTarget): ResearchContext {
  const profile = INDUSTRY_PROFILES[target.industry] ?? DEFAULT_PROFILE;
  const atsFirst =
    profile.ats_sensitivity === "high" ||
    target.category === "ats" ||
    /ats/i.test(target.objective);

  const tier: ResearchContext["ats_guidance"]["compatibility_tier"] = atsFirst
    ? "ats_safe"
    : profile.visual_preference === "visual_first"
      ? "visual"
      : "hybrid";

  const section_order = sectionOrderFor(target.industry, target.category);
  const margin_mm = atsFirst ? 14 : 12;

  const sources = [
    "donor:runtime/research/IndustryAnalyzer (lifted profiles)",
    "donor:runtime/research/ATSPlanner (lifted rules)",
    "donor:runtime/research/TypographyPlanner (lifted defaults)",
    "donor:runtime/research/LayoutPlanner (lifted section order)",
    "donor:domain/studiosislab/resume/ATSStandards (ATS-safe principles)",
    `production_target:${target.category}/${target.title}`,
  ];

  return {
    category: target.category,
    title: target.title,
    industry: target.industry,
    seniority: target.seniority,
    ats_guidance: {
      compatibility_tier: tier,
      parse_reliability_score: tier === "ats_safe" ? 95 : tier === "hybrid" ? 82 : 70,
      keyword_strategy: [
        "Mirror standard section headings (Experience, Education, Skills)",
        "Include industry-relevant keywords in experience bullets",
        "Avoid graphics for skill representation in ATS tier",
        `Target industry: ${target.industry}`,
        `Target role: ${target.title} (${target.seniority})`,
      ],
      forbidden_elements:
        tier === "ats_safe"
          ? [
              "Skill bars",
              "Star ratings",
              "Tables for layout",
              "Icons as content",
              "Multi-column text boxes",
              "Images in content area",
            ]
          : ["Skill bars in primary content", "Unreadable decorative fonts"],
      heading_structure: [
        "H1 equivalent: person name on the resume (largest size)",
        "Section headings: uppercase or bold, consistent style",
        "Job titles bold; employers regular weight",
      ],
      text_hierarchy_rules: [
        "All content as selectable text objects",
        "No text in images",
        "Minimum 10.5pt body",
        "Left-aligned body text for ATS parse",
      ],
    },
    typography_guidance: {
      font_family: atsFirst ? "Inter" : "Inter",
      body_size_pt: 10.5,
      heading_scale: atsFirst ? [20, 12, 11] : [22, 13, 11],
      line_height: 1.35,
      visual_density: atsFirst ? "balanced" : "airy",
      accessibility_notes: [
        "Minimum 10.5pt body for ATS parse reliability",
        "Maximum 2 font families",
        "Sufficient contrast between headings and body",
        "Maintain balanced whitespace between sections",
      ],
    },
    layout_guidance: {
      structure: atsFirst
        ? "ats_first"
        : profile.visual_preference === "visual_first"
          ? "modern"
          : profile.visual_preference === "hybrid"
            ? "hybrid"
            : "single_column",
      columns: 1,
      margins_mm: {
        top: margin_mm,
        right: margin_mm,
        bottom: margin_mm,
        left: margin_mm,
      },
      section_order,
      reading_flow:
        "Top-to-bottom, left-to-right; name → contact → summary → experience → education → skills",
      whitespace_strategy:
        "Balanced whitespace with consistent section gaps; avoid dense text blocks",
    },
    industry_guidance: { ...profile },
    writing_recommendations: [
      `Lead with achievements relevant to ${target.title}`,
      "Quantify impact with metrics where plausible (fictional samples only)",
      `Match seniority tone for ${target.seniority} level`,
      `Reflect ${target.industry} hiring expectations: ${profile.hiring_style}`,
      "Use standard date formats (MM/YYYY or Month YYYY)",
    ],
    design_constraints: [
      "Single-column reading order for ATS-safe tiers",
      "No publication / no live website writes in this cycle",
      "Fictional sample content only — no real personal data",
      `Category=${target.category}; respect coverage-selected ProductionTarget`,
      tier === "ats_safe"
        ? "Prefer system-safe fonts and linear text order"
        : "Hybrid visual hierarchy allowed within editor-compatible Fabric schema",
    ],
    research_sources: sources,
    generated_at: new Date().toISOString(),
    deterministic: true,
    ai_planner: false,
  };
}
