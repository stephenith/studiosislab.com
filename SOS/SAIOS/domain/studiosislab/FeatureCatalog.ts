import type { CatalogFeature } from "./types.js";

/**
 * StudiosisLab product feature catalog — business knowledge only.
 */
export const FEATURE_CATALOG: readonly CatalogFeature[] = [
  {
    id: "resume-builder",
    name: "Resume Builder",
    description: "Interactive editor for creating and customizing ATS-friendly resumes",
    priority: "P0",
    revenue_relevance: 10,
    status: "live",
  },
  {
    id: "resume-templates",
    name: "Resume Templates",
    description: "Category-based ATS resume template library with previews and downloads",
    priority: "P0",
    revenue_relevance: 10,
    status: "live",
  },
  {
    id: "ats-checker",
    name: "ATS Checker",
    description: "Automated resume parsing and ATS compatibility scoring",
    priority: "P0",
    revenue_relevance: 9,
    status: "live",
  },
  {
    id: "cover-letter",
    name: "Cover Letter",
    description: "Cover letter templates paired with resume categories",
    priority: "P1",
    revenue_relevance: 8,
    status: "planned",
  },
  {
    id: "invoice-generator",
    name: "Invoice Generator",
    description: "Freelancer and contractor invoice templates",
    priority: "P2",
    revenue_relevance: 7,
    status: "planned",
  },
  {
    id: "portfolio-builder",
    name: "Portfolio Builder",
    description: "Showcase pages for creative and technical professionals",
    priority: "P1",
    revenue_relevance: 8,
    status: "roadmap",
  },
  {
    id: "pdf-tools",
    name: "PDF Tools",
    description: "Merge, split, compress, and convert resume PDFs",
    priority: "P1",
    revenue_relevance: 7,
    status: "planned",
  },
  {
    id: "projects",
    name: "Projects",
    description: "Project case study and portfolio project sections",
    priority: "P2",
    revenue_relevance: 6,
    status: "roadmap",
  },
  {
    id: "e-sign",
    name: "E-sign",
    description: "Electronic signature for contracts and offer letters",
    priority: "P3",
    revenue_relevance: 5,
    status: "roadmap",
  },
  {
    id: "dashboard",
    name: "Dashboard",
    description: "User dashboard for documents, downloads, and account management",
    priority: "P0",
    revenue_relevance: 9,
    status: "live",
  },
] as const;

export function getFeatureById(id: string): CatalogFeature | undefined {
  return FEATURE_CATALOG.find((f) => f.id === id);
}

export function listFeaturesByStatus(status: CatalogFeature["status"]): CatalogFeature[] {
  return FEATURE_CATALOG.filter((f) => f.status === status);
}
