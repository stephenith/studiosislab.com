import type { DesignStandard, MarketRegion } from "./types.js";

/**
 * ATS compatibility standards for StudiosisLab resume templates.
 */
export const ATS_STANDARDS: readonly DesignStandard[] = [
  {
    id: "layout-ats-safe",
    name: "ATS-Safe Layout",
    description: "Layout rules that maximize ATS parse success",
    requirements: [
      "Prefer single-column reading order top-to-bottom",
      "No text inside images; all content in Textbox objects",
      "Avoid tables, multi-column text boxes, and sidebar layouts for ATS tier",
      "Contact information in body canvas, not simulated header/footer bands",
      "Copy-paste test: plain-text order must match visual order",
    ],
  },
  {
    id: "typography-ats-safe",
    name: "ATS-Safe Typography",
    description: "Font and sizing rules for parser compatibility",
    requirements: [
      "Tier A fonts: Arial, Calibri, Helvetica, Times New Roman, Georgia, Verdana",
      "Tier B (visual tier): Inter, Roboto, Open Sans, Lato — require ATS QA pass",
      "Avoid: script fonts, Material Icons as text, extreme charSpacing (>50)",
      "Body 10.5–12pt; section headers 12–16pt; name 16–24pt",
    ],
  },
  {
    id: "section-ats-safe",
    name: "ATS Section Headings",
    description: "Standard section labels recognized by parsers",
    requirements: [
      'Use "Work Experience" or "Experience" — not "Career Journey"',
      'Use "Education" — not "Academic Background"',
      'Use "Skills" — not "Core Competencies" alone',
      "Dates: MM/YYYY or Month YYYY; use Present not Current",
      "Bullet characters: standard disc, circle, or hyphen only",
    ],
  },
  {
    id: "export-ats-safe",
    name: "ATS Export",
    description: "Export behavior requirements for downstream ATS checks",
    requirements: [
      "Export text-selectable PDF via PNG rasterization of Fabric canvas",
      "No image-only PDF exports for ATS-tier templates",
      "DOCX export path must preserve linear text order when enabled",
      "File size under 500KB for single-page ATS resumes",
    ],
  },
] as const;

export const MARKET_ATS_NOTES: Record<MarketRegion, string[]> = {
  US: [
    "Single-column strongly preferred by Workday, Greenhouse, Lever, iCIMS",
    "No photos in ATS tier — US recruiters expect photo-free resumes",
    "Quantified bullets strongly expected in experience section",
    "1 page under 10 years experience; 2 pages acceptable senior",
  ],
  UK: [
    "CV term acceptable; same parser risks as US for multi-column",
    "2.54cm (1 inch) margins conventional; never below 1.9cm",
    "Arial, Calibri, Helvetica safest; avoid decorative header boxes",
    "Career gaps as dated entries preferred over graphics",
  ],
  GLOBAL: [
    "Default to US/UK ATS-safe baseline unless market override specified",
    "Photo templates flagged as visual-tier only",
    "English section headings unless locale pack specified",
  ],
};

export const EXTERNAL_ATS_PRINCIPLES_2025_2026 = [
  "Single-column, text-first layouts outperform decorative multi-column designs in parse tests",
  "System fonts reduce substitution failures (□□□ boxes) in legacy ATS",
  "Whitespace aids human scan time without hurting parsers when text remains linear",
  "Skill bars, icons, and progress meters are decorative — not machine-readable",
  "Tagged accessible PDFs help but do not replace linear layout discipline",
  "Reverse-chronological experience remains the safest structure",
] as const;

export function getAtsStandardById(id: string): DesignStandard | undefined {
  return ATS_STANDARDS.find((s) => s.id === id);
}
