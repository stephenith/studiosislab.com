import type { SEOStandard } from "./types.js";

/**
 * SEO standards for StudiosisLab template catalog and landing pages.
 */
export const SEO_STANDARDS: readonly SEOStandard[] = [
  {
    id: "page-metadata",
    name: "Page Metadata",
    requirements: [
      "Unique title tag per template and category page",
      "Meta description 150–160 characters with primary keyword",
      "Canonical URL per template slug",
      "Open Graph and Twitter card tags",
    ],
  },
  {
    id: "content-structure",
    name: "Content Structure",
    requirements: [
      "One H1 per page with category + intent keyword",
      "H2 sections for features, FAQ, and use cases",
      "Internal links between related categories and templates",
      "Schema.org JobPosting and FAQPage where applicable",
    ],
  },
  {
    id: "keyword-targeting",
    name: "Keyword Targeting",
    requirements: [
      "Primary: ATS resume template + category",
      "Secondary: job role + resume format variants",
      "Long-tail: free ATS resume template for [role]",
      "Avoid keyword cannibalization across category pages",
    ],
  },
  {
    id: "indexing",
    name: "Indexing",
    requirements: [
      "XML sitemap updated on template publish",
      "Robots.txt allows catalog pages",
      "Noindex on draft and preview URLs",
      "Core Web Vitals pass before index request",
    ],
  },
] as const;

export function getSEOStandardById(id: string): SEOStandard | undefined {
  return SEO_STANDARDS.find((s) => s.id === id);
}
