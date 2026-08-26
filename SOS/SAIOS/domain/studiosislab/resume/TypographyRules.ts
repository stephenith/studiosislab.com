import type { TypographyScale } from "./types.js";

/**
 * Typography rules for StudiosisLab resume templates.
 */
export const TYPOGRAPHY_SCALE: readonly TypographyScale[] = [
  { element: "name", min_pt: 16, max_pt: 28, recommended_pt: 22, weight: "bold" },
  { element: "job_title_header", min_pt: 14, max_pt: 20, recommended_pt: 16, weight: "bold" },
  { element: "section_heading", min_pt: 12, max_pt: 16, recommended_pt: 14, weight: "bold" },
  { element: "job_title", min_pt: 11, max_pt: 13, recommended_pt: 12, weight: "bold" },
  { element: "company_name", min_pt: 10, max_pt: 12, recommended_pt: 11, weight: "normal" },
  { element: "body_bullet", min_pt: 10, max_pt: 12, recommended_pt: 11, weight: "normal" },
  { element: "date_location", min_pt: 10, max_pt: 11, recommended_pt: 10, weight: "normal" },
  { element: "contact_line", min_pt: 9, max_pt: 11, recommended_pt: 10, weight: "normal" },
] as const;

export const FONT_TIERS = {
  ats_safe: ["Arial", "Calibri", "Helvetica", "Times New Roman", "Georgia", "Verdana", "Tahoma"],
  visual_approved: [
    "Inter",
    "Roboto",
    "Open Sans",
    "Lato",
    "Montserrat",
    "DM Sans",
    "Work Sans",
    "Nunito",
    "Arimo",
  ],
  restrict: [
    "Material Icons",
    "Playfair Display",
    "Fjalla One",
    "Prompt",
    "BIZ UDPGothic",
  ],
} as const;

export const TYPOGRAPHY_RULES = [
  "Maximum 2 font families per template (heading + body)",
  "Line height 1.1–1.25 for body Textbox objects",
  "charSpacing 0–80 for uppercase labels; 0 for body bullets",
  "No text smaller than 10pt except footnotes (visual tier only)",
  "Bold for section headings and job titles; avoid all-caps body paragraphs",
  "Use fill contrast ratio ≥ 4.5:1 against background (WCAG AA)",
] as const;

export function getTypographyScale(element: string): TypographyScale | undefined {
  return TYPOGRAPHY_SCALE.find((t) => t.element === element);
}
