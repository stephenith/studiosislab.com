import type { QualityStandard } from "./types.js";

/**
 * Quality standards for StudiosisLab product deliverables.
 */
export const QUALITY_STANDARDS: readonly QualityStandard[] = [
  {
    id: "template-quality",
    name: "Template Quality",
    description: "Visual polish, consistency, and category fit of resume templates",
    metrics: ["layout consistency", "typography scale", "section completeness", "category alignment"],
    minimum_score: 85,
  },
  {
    id: "ats-quality",
    name: "ATS Quality",
    description: "Applicant tracking system parse rate and formatting safety",
    metrics: ["parse success rate", "single-column safety", "no image text", "standard section headers"],
    minimum_score: 90,
  },
  {
    id: "seo-quality",
    name: "SEO Quality",
    description: "Search discoverability and on-page optimization",
    metrics: ["title uniqueness", "meta completeness", "internal links", "schema validity"],
    minimum_score: 80,
  },
  {
    id: "accessibility",
    name: "Accessibility",
    description: "WCAG 2.1 AA compliance for builder and catalog pages",
    metrics: ["color contrast", "keyboard navigation", "aria labels", "focus indicators"],
    minimum_score: 85,
  },
  {
    id: "performance",
    name: "Performance",
    description: "Page load and interaction responsiveness",
    metrics: ["LCP under 2.5s", "FID under 100ms", "CLS under 0.1", "TTI under 3.5s"],
    minimum_score: 80,
  },
  {
    id: "core-web-vitals",
    name: "Core Web Vitals",
    description: "Google Core Web Vitals pass thresholds for production pages",
    metrics: ["LCP", "INP", "CLS", "mobile lab pass rate"],
    minimum_score: 75,
  },
] as const;

export function getQualityStandardById(id: string): QualityStandard | undefined {
  return QUALITY_STANDARDS.find((s) => s.id === id);
}
