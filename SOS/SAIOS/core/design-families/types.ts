/**
 * Agent #237 — Design Family contracts.
 * Families define composition systems, not color presets.
 */

export type LayoutArchitectureId =
  | "classic_single"
  | "wide_header_single"
  | "narrow_ats_sidebar"
  | "header_band"
  | "editorial_offset"
  | "section_index"
  | "compact_corporate"
  | "technical_grid";

export type HeaderSystemId =
  | "dark_band_full"
  | "oversized_name_split_contact"
  | "muted_band_name_block"
  | "split_header_meta_column"
  | "editorial_title"
  | "minimal_vertical_accent"
  | "compact_corporate"
  | "centered_restrained";

export type SectionTitleSystemId =
  | "text_short_rule"
  | "filled_label"
  | "vertical_accent_bar"
  | "numbered_marker"
  | "uppercase_compact"
  | "pale_strip"
  | "full_width_divider"
  | "geometric_marker"
  | "swiss_grid_label"
  | "sidebar_label";

export type AlignmentSystemId =
  | "strict_left"
  | "split_header_right_contact"
  | "offset_body"
  | "sidebar_main"
  | "centered_header_left_body"
  | "grid_two_track";

export type DensityMode = "compact" | "standard" | "airy";

export type DesignFamilyId =
  | "executive"
  | "corporate"
  | "modern"
  | "editorial"
  | "minimal"
  | "creative"
  | "technical"
  | "swiss"
  | "professional_sidebar"
  | "contemporary_accent";

export type SpacingTokens = {
  page_margin_mm: number;
  header_to_summary_gap_px: number;
  section_before_gap_px: number;
  section_after_heading_gap_px: number;
  role_to_date_gap_px: number;
  bullet_gap_px: number;
  subsection_gap_px: number;
  line_height_body: number;
  line_height_heading: number;
  density: DensityMode;
};

export type ColorStrategy = {
  primary_neutral: string;
  accent: string;
  pale_tint: string;
  text: string;
  muted: string;
  on_accent: string;
  header_band?: string;
  sidebar_bg?: string;
};

export type DesignFamilyContract = {
  family_id: DesignFamilyId;
  design_personality: string[];
  layout_architecture: LayoutArchitectureId;
  header_system: HeaderSystemId;
  alignment_system: AlignmentSystemId;
  typography_scale: {
    name_pt: number;
    heading_pt: number;
    body_pt: number;
    meta_pt: number;
    heading_family: string;
    body_family: string;
    name_weight: 600 | 700;
  };
  spacing: SpacingTokens;
  section_title_system: SectionTitleSystemId;
  divider_strategy: "short" | "full" | "double" | "none" | "vertical";
  accent_shape_strategy:
    | "none"
    | "header_band"
    | "left_rail"
    | "section_markers"
    | "filled_labels"
    | "geometric_dots"
    | "pale_strips"
    | "index_rail";
  color_strategy: ColorStrategy;
  sidebar_policy: "forbidden" | "narrow_ats_safe" | "visual_rail_only";
  icon_policy: "forbidden";
  page_fill_target: number;
  density_target: DensityMode;
  role_suitability: string[];
  ats_risk_level: "low" | "medium";
  allowed_fabric_object_types: string[];
  forbidden_visual_treatments: string[];
  silhouette_hint: string;
};

export type ResolvedDesignFamily = DesignFamilyContract & {
  variant: 0 | 1;
  role_family: string;
  selected_at: string;
  reasoning_order: string[];
};
