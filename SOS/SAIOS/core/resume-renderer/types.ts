/**
 * Resume Renderer Engine V1 — contracts (Agent #128).
 * Executes DesignBrief Resume JSON instructions only.
 * Never modifies DesignBrief. No AI. Dry-run only.
 */

/** Minimal Resume JSON shape the renderer consumes (from DesignBrief output). */
export type ResumeJsonInput = {
  version: string;
  dry_run: boolean;
  publication_allowed: boolean;
  template_generated: boolean;
  page: {
    size: string;
    width_px: number;
    height_px: number;
    background: string;
  };
  typography: {
    heading_family: string;
    body_family: string;
    scale_pt: { name: number; heading: number; body: number; meta: number };
    line_height: { heading: number; body: number };
    weights: { name: number; heading: number; body: number };
    ats_safe_fonts_only: boolean;
  };
  spacing: {
    unit_px: number;
    section_gap_px: number;
    item_gap_px: number;
    paragraph_gap_px: number;
    header_rule_gap_px: number;
    density: string;
  };
  colors: {
    id: string;
    background: string;
    body_text: string;
    heading_text: string;
    accent: string;
    rule: string;
    muted: string;
    contrast_ok: boolean;
    ats_safe: boolean;
    rationale?: string;
  };
  visual_guidance?: {
    hero_emphasis?: string;
    content_profile?: string;
    rule_style?: "short" | "full" | "double";
    design_variant?: number;
    visual_profile?: string;
    name_weight?: number;
    layout_intent?: string;
    page_fill_objective?: number;
    typography_strategy?: string;
    spacing_strategy?: string;
    design_personality?: string[];
    information_density?: string;
    visual_rhythm?: string;
    layout_family?: string;
    role_family?: string;
    header_style?: string;
    [key: string]: unknown;
  };
  sections: Array<{
    id: string;
    component: string;
    order: number;
    placeholder_content: string;
  }>;
  objects_plan: Array<{
    kind: string;
    section: string;
    component: string;
    fill?: string;
    fontFamily?: string;
    fontSize?: number;
  }>;
};

export type LayoutMargins = {
  top: number;
  right: number;
  bottom: number;
  left: number;
  content_width_px?: number;
};

export type ResolvedTheme = {
  background: string;
  body_text: string;
  heading_text: string;
  accent: string;
  rule: string;
  muted: string;
  pale_tint?: string;
  on_accent?: string;
  header_band?: string;
  sidebar_bg?: string;
};

export type ResolvedTypography = {
  heading_family: string;
  body_family: string;
  scale_pt: ResumeJsonInput["typography"]["scale_pt"];
  line_height: ResumeJsonInput["typography"]["line_height"];
  weights: ResumeJsonInput["typography"]["weights"];
};

export type ResolvedSpacing = {
  unit_px: number;
  section_gap_px: number;
  item_gap_px: number;
  paragraph_gap_px: number;
  header_rule_gap_px: number;
};

export type RenderNode = {
  id: string;
  kind: "page" | "section" | "block" | "text" | "rule" | "rect" | "circle" | "line";
  section?: string;
  component?: string;
  text?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  rx?: number;
  ry?: number;
  role?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: number;
  textAlign?: "left" | "center" | "right";
  children?: RenderNode[];
};

export type RenderTree = {
  version: "resume-render-tree-1.0.0";
  dry_run: true;
  page: { width_px: number; height_px: number; background: string };
  root: RenderNode;
  cursor_end_y: number;
  content_bottom_y: number;
};

export type CanvasObject = Record<string, unknown> & {
  type: string;
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

export type CanvasJson = {
  version: "6.9.1";
  width: number;
  height: number;
  objects: CanvasObject[];
  aios?: {
    dry_run: true;
    publication_allowed: false;
    template_generated: false;
    published: false;
    live_enabled: false;
    fabric_compat: "6.9.1";
    source_resume_json_version: string;
    brief_id: string | null;
    task_id: string | null;
    rendered_at: string;
    fictional_sample_only: true;
    schema: "studiosislab-fabric-canvas";
  };
};

export type OverflowReport = {
  overflow: boolean;
  page_height_px: number;
  content_bottom_y: number;
  overflow_px: number;
  offending_nodes: Array<{ id: string; bottom: number }>;
};

export type RenderValidation = {
  pass: boolean;
  errors: string[];
  warnings: string[];
};

export type PreviewDocument = {
  version: "resume-preview-1.0.0";
  dry_run: true;
  publication_allowed: false;
  status: "preview_ready" | "overflow" | "invalid";
  founder_review_required: true;
  canvas_path: string;
  render_tree_path: string;
  notes: string[];
};

export type ResumeRenderResult = {
  render_tree: RenderTree;
  canvas_json: CanvasJson;
  overflow: OverflowReport;
  validation: RenderValidation;
  preview: PreviewDocument;
  wrote_artifacts: string[];
  overall: "PASS" | "FAIL";
};

export type ResumeRendererOptions = {
  repoRoot?: string;
  resumeJsonPath?: string;
  layoutBlueprintPath?: string;
  briefId?: string | null;
  taskId?: string | null;
  persist?: boolean;
  fixture?: boolean;
  resume_json?: ResumeJsonInput;
  margins?: LayoutMargins;
};
