/**
 * Agent #236 — Design Intelligence principles extracted from Template DNA +
 * controlled ATS/modern-resume research (structured, not copy).
 */
export type LayoutFamilyId =
  | "classic-single"
  | "modern-editorial"
  | "dense-professional";

export type HeaderStyleId =
  | "stacked-title-rule"
  | "oversized-name-short-rule"
  | "compact-inline-rule";

export type DesignIntelligencePrinciples = {
  version: "1.0.0";
  agent: "236";
  extracted_at: string;
  source: {
    template_dna: string;
    catalog_families_sampled: string[];
    research_notes: string[];
  };
  typography_scale: {
    name_pt: { min: number; target: number; max: number };
    heading_pt: { min: number; target: number; max: number };
    body_pt: { min: number; target: number; max: number };
    meta_pt: { min: number; target: number; max: number };
    hierarchy_min_delta_name_to_body: number;
    ats_safe_families: string[];
  };
  spacing_scale: {
    section_gap_px: { compact: number; balanced: number; spacious: number };
    item_gap_px: { compact: number; balanced: number; spacious: number };
    paragraph_gap_px: { compact: number; balanced: number; spacious: number };
    margins_mm: { compact: number; balanced: number; spacious: number };
  };
  page_fill: {
    minimum: number;
    target: number;
    premium: number;
    word_doc_threshold: number;
  };
  alignment: {
    content_edges: "single_left";
    date_alignment: "left_muted_meta";
    bullet_prefix: "•";
  };
  layout_families: Array<{
    id: LayoutFamilyId;
    description: string;
    columns: 1;
    ats_safe: true;
    header_style: HeaderStyleId;
    density: "compact" | "balanced" | "spacious";
    rule_style: "short" | "full" | "double";
    section_emphasis: string[];
  }>;
  header_styles: Record<
    HeaderStyleId,
    { name_weight: 600 | 700; rule: "short" | "full" | "double"; title_under_name: boolean }
  >;
  sidebar_strategies: {
    ats_generation: "forbidden";
    mapping:
      "Catalog sidebar families map to accent header weight + full-width rule, never dual-column canvas";
  };
  section_rhythm: {
    preferred_orders: Record<string, string[]>;
    required_core: string[];
  };
  visual_density: {
    min_text_objects: number;
    target_text_objects: number;
    roles_min: number;
    bullets_per_role: { min: number; max: number };
  };
  ats_safe_styling: {
    single_column: true;
    icons: false;
    images: false;
    tables: false;
    high_contrast: true;
    standard_headings: true;
  };
  role_preferences: Record<
    string,
    {
      dna_families: string[];
      preferred_layout_order: LayoutFamilyId[];
      personality: string[];
      section_bias: string[];
      palette_bias: string[];
    }
  >;
  modern_trends: string[];
};

export const DESIGN_INTELLIGENCE_PRINCIPLES: DesignIntelligencePrinciples = {
  version: "1.0.0",
  agent: "236",
  extracted_at: "2026-07-24T04:00:00.000Z",
  source: {
    template_dna:
      "SOS/SAIOS/domain/studiosislab/resume/intelligence/data/template-dna.json",
    catalog_families_sampled: [
      "executive-ats",
      "sales-marketing-ats",
      "engineering-technical",
      "designer-portfolio",
      "finance-conservative",
      "hr-people-ops",
      "corporate-modern",
    ],
    research_notes: [
      "Catalog peers (t066/t094) use ~40pt name, 5–6 type steps, content to page bottom (~100% fill), 26–40 text objects",
      "ATS-safe generation remains single-column; sidebar DNA becomes header accent weight, not dual-column canvas",
      "Icons/images forbidden in ATS path; dividers and typography carry hierarchy",
      "Modern builders emphasize clear section rhythm, muted meta dates, achievement-dense bullets, skill grouping",
      "Whitespace should breathe between sections but never leave a barren lower half",
    ],
  },
  typography_scale: {
    name_pt: { min: 34, target: 40, max: 42 },
    heading_pt: { min: 11, target: 12, max: 14 },
    body_pt: { min: 10.5, target: 11, max: 12 },
    meta_pt: { min: 9.5, target: 10, max: 11 },
    hierarchy_min_delta_name_to_body: 22,
    ats_safe_families: [
      "Inter",
      "Roboto",
      "Source Sans 3",
      "IBM Plex Sans",
      "Arial",
      "Calibri",
      "Georgia",
    ],
  },
  spacing_scale: {
    section_gap_px: { compact: 20, balanced: 26, spacious: 32 },
    item_gap_px: { compact: 8, balanced: 10, spacious: 12 },
    paragraph_gap_px: { compact: 6, balanced: 8, spacious: 10 },
    margins_mm: { compact: 12, balanced: 14, spacious: 16 },
  },
  page_fill: {
    minimum: 0.78,
    target: 0.88,
    premium: 0.92,
    word_doc_threshold: 0.55,
  },
  alignment: {
    content_edges: "single_left",
    date_alignment: "left_muted_meta",
    bullet_prefix: "•",
  },
  layout_families: [
    {
      id: "classic-single",
      description:
        "Balanced ATS single column — full accent rule, steady section rhythm, education after experience",
      columns: 1,
      ats_safe: true,
      header_style: "stacked-title-rule",
      density: "balanced",
      rule_style: "full",
      section_emphasis: ["experience", "summary", "skills"],
    },
    {
      id: "modern-editorial",
      description:
        "Editorial hierarchy — oversized name, short intentional rule, breathable gaps, projects emphasis",
      columns: 1,
      ats_safe: true,
      header_style: "oversized-name-short-rule",
      density: "spacious",
      rule_style: "short",
      section_emphasis: ["summary", "experience", "projects"],
    },
    {
      id: "dense-professional",
      description:
        "High-density professional — compact gaps, double rule, certifications/skills weight",
      columns: 1,
      ats_safe: true,
      header_style: "compact-inline-rule",
      density: "compact",
      rule_style: "double",
      section_emphasis: ["experience", "skills", "certifications"],
    },
  ],
  header_styles: {
    "stacked-title-rule": {
      name_weight: 700,
      rule: "full",
      title_under_name: true,
    },
    "oversized-name-short-rule": {
      name_weight: 600,
      rule: "short",
      title_under_name: true,
    },
    "compact-inline-rule": {
      name_weight: 700,
      rule: "double",
      title_under_name: true,
    },
  },
  sidebar_strategies: {
    ats_generation: "forbidden",
    mapping:
      "Catalog sidebar families map to accent header weight + full-width rule, never dual-column canvas",
  },
  section_rhythm: {
    preferred_orders: {
      "classic-single": [
        "header",
        "summary",
        "experience",
        "education",
        "skills",
        "certifications",
        "languages",
      ],
      "modern-editorial": [
        "header",
        "summary",
        "experience",
        "projects",
        "skills",
        "education",
        "languages",
      ],
      "dense-professional": [
        "header",
        "summary",
        "experience",
        "skills",
        "education",
        "certifications",
        "languages",
      ],
    },
    required_core: ["header", "summary", "experience", "skills", "education"],
  },
  visual_density: {
    min_text_objects: 26,
    target_text_objects: 32,
    roles_min: 2,
    bullets_per_role: { min: 3, max: 4 },
  },
  ats_safe_styling: {
    single_column: true,
    icons: false,
    images: false,
    tables: false,
    high_contrast: true,
    standard_headings: true,
  },
  role_preferences: {
    marketing_manager: {
      dna_families: ["sales-marketing-ats", "executive-ats", "sales-marketing-visual"],
      preferred_layout_order: [
        "classic-single",
        "modern-editorial",
        "dense-professional",
      ],
      personality: ["strategic", "campaign-led", "measurable"],
      section_bias: ["experience", "skills", "projects"],
      palette_bias: ["ats-navy-accent", "ats-slate-accent"],
    },
    software_engineer: {
      dna_families: ["engineering-technical", "executive-ats"],
      preferred_layout_order: [
        "dense-professional",
        "classic-single",
        "modern-editorial",
      ],
      personality: ["technical", "systems", "clarity"],
      section_bias: ["experience", "projects", "skills"],
      palette_bias: ["ats-mono-ink", "ats-slate-accent"],
    },
    graphic_designer: {
      dna_families: ["designer-portfolio", "creative-visual"],
      preferred_layout_order: [
        "modern-editorial",
        "classic-single",
        "dense-professional",
      ],
      personality: ["editorial", "visual", "craft"],
      section_bias: ["projects", "experience", "skills"],
      palette_bias: ["ats-slate-accent", "ats-navy-accent"],
    },
    accountant: {
      dna_families: ["finance-conservative", "executive-ats"],
      preferred_layout_order: [
        "classic-single",
        "dense-professional",
        "modern-editorial",
      ],
      personality: ["precise", "conservative", "trust"],
      section_bias: ["experience", "certifications", "education"],
      palette_bias: ["ats-mono-ink", "ats-navy-accent"],
    },
    hr_manager: {
      dna_families: ["hr-people-ops", "operations-management", "executive-ats"],
      preferred_layout_order: [
        "classic-single",
        "modern-editorial",
        "dense-professional",
      ],
      personality: ["people-first", "structured", "empathetic"],
      section_bias: ["experience", "skills", "certifications"],
      palette_bias: ["ats-navy-accent", "ats-forest-accent"],
    },
  },
  modern_trends: [
    "Oversized name as brand signal",
    "Muted contact line under title",
    "Full or intentional short accent rule (not decorative clutter)",
    "Achievement bullets with metrics",
    "Skill grouping with separators",
    "Page fill targeting catalog density without overflow",
    "ATS single-column as default for parse reliability",
  ],
};
