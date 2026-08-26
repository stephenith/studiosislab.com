import type { TemplateStandard } from "./types.js";

/**
 * Template design and delivery standards for StudiosisLab resume products.
 */
export const TEMPLATE_STANDARDS: readonly TemplateStandard[] = [
  {
    id: "layout-structure",
    name: "Layout Structure",
    requirements: [
      "Single-column or two-column ATS-safe layouts only",
      "Consistent section hierarchy: contact, summary, experience, education, skills",
      "No text inside images or complex tables",
      "Minimum 11pt body font equivalent",
    ],
  },
  {
    id: "content-blocks",
    name: "Content Blocks",
    requirements: [
      "Reusable section components per category",
      "Placeholder copy aligned to sample job roles",
      "Quantified achievement examples in experience bullets",
      "Skills grouped by relevance not alphabetically only",
    ],
  },
  {
    id: "export-formats",
    name: "Export Formats",
    requirements: [
      "PDF export with embedded fonts",
      "DOCX compatibility for ATS uploads",
      "Print-safe margins (0.5in minimum)",
      "File size under 500KB for PDF",
    ],
  },
  {
    id: "branding",
    name: "Branding",
    requirements: [
      "StudiosisLab watermark optional on free tier",
      "Category-specific accent colors from design tokens",
      "Thumbnail preview matches exported document",
    ],
  },
] as const;

export function getTemplateStandardById(id: string): TemplateStandard | undefined {
  return TEMPLATE_STANDARDS.find((s) => s.id === id);
}
