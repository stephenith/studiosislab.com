/**
 * StudiosisLab Resume Design System v1 — shared types.
 */

export const DESIGN_SYSTEM_VERSION = "1.0.0";

export type SpacingToken = 4 | 8 | 12 | 16 | 20 | 24 | 32 | 40 | 48 | 64;

export type TypographyRole =
  | "display"
  | "heading"
  | "subheading"
  | "section"
  | "body"
  | "caption"
  | "label";

export type GridLayoutId =
  | "classic-ats"
  | "executive"
  | "corporate"
  | "modern"
  | "sidebar"
  | "creative-ats-safe"
  | "compact"
  | "student"
  | "technical"
  | "dual-column"
  | "executive-split"
  | "minimal"
  | "sidebar-layout";

export type HeaderVariantId =
  | "executive"
  | "corporate"
  | "minimal"
  | "technical"
  | "creative"
  | "student"
  | "healthcare"
  | "marketing"
  | "finance"
  | "operations";

export type SectionVariantId =
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "certificates"
  | "awards"
  | "languages"
  | "summary"
  | "volunteer"
  | "achievements"
  | "publications"
  | "references";

export type ColorPaletteId =
  | "corporate-blue"
  | "minimal-gray"
  | "executive-navy"
  | "emerald"
  | "teal"
  | "indigo"
  | "slate"
  | "professional-black"
  | "muted-accent";

export type ComponentId =
  | "header"
  | "contact-block"
  | "timeline"
  | "skill-chips"
  | "skill-lists"
  | "section-header"
  | "horizontal-divider"
  | "vertical-divider"
  | "timeline-bullet"
  | "achievement-card"
  | "sidebar-widget"
  | "language-block"
  | "certification-block"
  | "project-card"
  | "education-layout"
  | "experience-layout";

export type ATSComponentFlags = {
  ats_safe: boolean;
  machine_readable: boolean;
  text_order: string;
  contrast_safe: boolean;
  print_safe: boolean;
};

export type DesignTokenSet = {
  version: string;
  spacing: SpacingToken[];
  typography_roles: TypographyRole[];
  grid_layouts: GridLayoutId[];
  color_palettes: ColorPaletteId[];
  generated_at: string;
};

export type ValidationIssue = {
  code: string;
  severity: "error" | "warning";
  message: string;
  path?: string;
};

export type DesignValidationResult = {
  pass: boolean;
  validated_at: string;
  issues: ValidationIssue[];
  checks: Record<string, boolean>;
};

export type DesignSystemResult = {
  pass: boolean;
  version: string;
  output_dir: string;
  validation: DesignValidationResult;
  artifacts: string[];
  summary: {
    spacing_tokens: number;
    typography_roles: number;
    grid_layouts: number;
    header_variants: number;
    section_variants: number;
    color_palettes: number;
    components: number;
    ats_rules: number;
    accessibility_rules: number;
  };
};

export type RunDesignSystemOptions = {
  persist?: boolean;
  apply_founder_calibration?: boolean;
};
