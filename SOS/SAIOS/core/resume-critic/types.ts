/**
 * Resume Critic Engine V1 — contracts (Agent #130).
 * Evaluates only. Never redesigns, reasons, or mutates resumes.
 */

export type CriticCategory =
  | "ats"
  | "visual"
  | "typography"
  | "layout"
  | "technical"
  | "consistency"
  | "sections";

export type CriticFinding = {
  code: string;
  severity: "info" | "warn" | "fail";
  message: string;
  points_deducted: number;
};

export type CategoryReport = {
  category: CriticCategory;
  score: number;
  max: 100;
  findings: CriticFinding[];
  metrics: Record<string, unknown>;
};

export type CriticScores = {
  overall: number;
  ats: number;
  visual: number;
  typography: number;
  layout: number;
  technical: number;
  consistency: number;
  sections: number;
};

export type ReadinessResult = {
  ready: boolean;
  founder_review_allowed: boolean;
  blocked_reasons: string[];
  rules: {
    overall_min: number;
    ats_min: number;
    technical_required: number;
    no_overflow: boolean;
    no_schema_mismatch: boolean;
    no_missing_sections: boolean;
    no_renderer_errors: boolean;
  };
};

export type CanvasObject = Record<string, unknown> & {
  type?: string;
  id?: string;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  scaleX?: number;
  scaleY?: number;
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string | number;
  fontStyle?: string;
  lineHeight?: number;
  charSpacing?: number;
  textAlign?: string;
  underline?: boolean;
  fill?: string;
  selectable?: boolean;
  evented?: boolean;
  lockMovementX?: boolean;
  isPageBg?: boolean;
  role?: string;
  data?: Record<string, unknown>;
  version?: string;
  originX?: string;
  originY?: string;
  visible?: boolean;
};

export type CanvasDocument = {
  version: string;
  width: number;
  height: number;
  objects: CanvasObject[];
  aios?: Record<string, unknown>;
};

export type ResumeJsonLite = {
  sections?: Array<{ id: string; order: number; component?: string }>;
  typography?: {
    heading_family?: string;
    body_family?: string;
    scale_pt?: Record<string, number>;
    line_height?: Record<string, number>;
    ats_safe_fonts_only?: boolean;
  };
  spacing?: {
    section_gap_px?: number;
    unit_px?: number;
  };
  colors?: { ats_safe?: boolean };
  dry_run?: boolean;
  publication_allowed?: boolean;
};

export type OverflowLite = {
  overflow: boolean;
  overflow_px?: number;
  content_bottom_y?: number;
};

export type CriticInput = {
  canvas: CanvasDocument;
  resume_json?: ResumeJsonLite | null;
  overflow?: OverflowLite | null;
  renderer_validation_pass?: boolean | null;
};

export type CriticResult = {
  scores: CriticScores;
  reports: Record<CriticCategory, CategoryReport>;
  readiness: ReadinessResult;
  evaluated_at: string;
  dry_run: true;
  publication_allowed: false;
  live_enabled: false;
  mutated_resume: false;
  used_ai: false;
  used_mock_provider: false;
};

export const REQUIRED_SECTIONS = [
  "header",
  "summary",
  "experience",
  "skills",
  "education",
] as const;

export const OPTIONAL_SECTIONS = [
  "projects",
  "certifications",
  "languages",
  "awards",
  "references",
] as const;
