/**
 * External best practices (2025–2026) vs StudiosisLab gap analysis.
 * Principles summarized — no layout copying.
 */
export const EXTERNAL_BEST_PRACTICES = {
  research_period: "2025–2026",
  markets: {
    US: {
      principles: [
        "Single-column text-first layout for maximum ATS compatibility",
        "System fonts (Arial, Calibri, Helvetica, Times New Roman)",
        "Standard section headings: Experience, Education, Skills",
        "Quantified achievement bullets",
        "No photos; contact in body not header/footer",
        "0.5–1 inch margins; 10–12pt body, 14–16pt headings",
      ],
    },
    UK: {
      principles: [
        "Same parser risks as US for multi-column and tables",
        "Arial, Calibri, Helvetica preferred; 11pt body conventional",
        "2.54cm margins standard; never below 1.9cm",
        "Plain bold section headers — no text inside colored boxes",
        "Career gaps as dated text entries",
        "Copy-paste to Notepad test for reading order",
      ],
    },
  },
  cross_market: {
    recruiter_readability: [
      "6-second scan: name, title, recent role visible immediately",
      "Whitespace between sections reduces cognitive load",
      "Bold job titles and dates anchor the eye",
      "One accent color maximum",
    ],
    ats_friendliness: [
      "Linear reading order beats visual creativity for parse rate",
      "No tables, skill bars, icons, or text boxes for core content",
      "Text-selectable PDF over image PDF",
      "MM/YYYY dates consistently formatted",
    ],
    accessibility: [
      "WCAG AA contrast minimum 4.5:1",
      "No information conveyed by color alone",
      "Minimum 10pt body for low-vision readers",
    ],
    print: [
      "Print-safe margins ≥ 0.5 inch",
      "Background colors light enough for ink-saving print",
      "Single-column prints predictably on A4 and Letter",
    ],
  },
} as const;

export const GAP_ANALYSIS: readonly string[] = [
  "StudiosisLab corpus uses decorative multi-shape headers — external best practice favors plain bold headings for UK ATS",
  "92 negative-positioned objects exceed StudiosisLab target of zero on content layers",
  "55 images and skill-visual patterns conflict with 2026 ATS text-first guidance",
  "Web fonts (Montserrat, Poppins) widely used — external guidance prefers system fonts for ATS tier",
  "StudiosisLab strength: consistent A4 794×1123 canvas (91% of corpus) aligns with print and export pipeline",
  "StudiosisLab strength: rich section coverage (experience, skills, education) matches recruiter expectations",
  "Improve: introduce explicit ats_safe vs visual tier in generation spec",
  "Improve: enforce VALIDATION_CHECKLIST before QA on every new template",
  "Improve: reduce charSpacing extremes (corpus max 210) per typography rules",
  "Improve: standardize legacy 2480×3508 templates to A4 on next revision cycle (knowledge only — no auto-migration)",
];

export const IMPROVEMENT_PRIORITIES = [
  { priority: 1, action: "Mandate ATS-safe tier defaults for all Resume Worker jobs" },
  { priority: 2, action: "Automate VALIDATION_CHECKLIST before testing-worker QA" },
  { priority: 3, action: "Eliminate negative coordinates on new template content objects" },
  { priority: 4, action: "Add system-font ATS variant for each visual template family" },
  { priority: 5, action: "Thumbnail QA gate per THUMBNAIL_SPECIFICATION" },
] as const;
