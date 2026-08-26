/**
 * Grid system — column layouts and gutters.
 */
import { LAYOUT_SAFE_AREA } from "../../domain/studiosislab/resume/LayoutRules.js";
import type { GridLayoutId } from "./types.js";
import { DESIGN_SYSTEM_VERSION } from "./types.js";

export type GridLayoutSpec = {
  id: GridLayoutId;
  name: string;
  columns: number;
  gutter_px: number;
  margin_px: number;
  ats_safe: boolean;
  description: string;
};

const GRID_LAYOUTS: GridLayoutSpec[] = [
  {
    id: "classic-ats",
    name: "Classic ATS",
    columns: 1,
    gutter_px: 0,
    margin_px: 56,
    ats_safe: true,
    description: "Single column, linear reading order",
  },
  {
    id: "executive",
    name: "Executive",
    columns: 1,
    gutter_px: 0,
    margin_px: 48,
    ats_safe: true,
    description: "Wide margins, prominent header band",
  },
  {
    id: "corporate",
    name: "Corporate",
    columns: 1,
    gutter_px: 0,
    margin_px: 52,
    ats_safe: true,
    description: "Balanced corporate single column",
  },
  {
    id: "modern",
    name: "Modern",
    columns: 1,
    gutter_px: 16,
    margin_px: 48,
    ats_safe: true,
    description: "Clean modern single column with accent spacing",
  },
  {
    id: "sidebar",
    name: "Sidebar",
    columns: 2,
    gutter_px: 24,
    margin_px: 48,
    ats_safe: false,
    description: "70/30 split — visual tier only",
  },
  {
    id: "creative-ats-safe",
    name: "Creative ATS-Safe",
    columns: 1,
    gutter_px: 12,
    margin_px: 44,
    ats_safe: true,
    description: "Creative typography within single column",
  },
  {
    id: "compact",
    name: "Compact",
    columns: 1,
    gutter_px: 0,
    margin_px: 40,
    ats_safe: true,
    description: "Tighter margins for dense content",
  },
  {
    id: "student",
    name: "Student",
    columns: 1,
    gutter_px: 0,
    margin_px: 48,
    ats_safe: true,
    description: "Education-first single column",
  },
  {
    id: "technical",
    name: "Technical",
    columns: 1,
    gutter_px: 0,
    margin_px: 52,
    ats_safe: true,
    description: "Skills-heavy single column",
  },
  {
    id: "dual-column",
    name: "Dual Column",
    columns: 2,
    gutter_px: 20,
    margin_px: 48,
    ats_safe: false,
    description: "Two equal columns — visual tier",
  },
  {
    id: "executive-split",
    name: "Executive Split",
    columns: 2,
    gutter_px: 24,
    margin_px: 48,
    ats_safe: false,
    description: "60/40 executive split layout",
  },
  {
    id: "minimal",
    name: "Minimal",
    columns: 1,
    gutter_px: 0,
    margin_px: 64,
    ats_safe: true,
    description: "Generous whitespace, minimal decoration",
  },
  {
    id: "sidebar-layout",
    name: "Sidebar Layout",
    columns: 2,
    gutter_px: 20,
    margin_px: 48,
    ats_safe: false,
    description: "Left sidebar for contact/skills",
  },
];

export function buildGridSystem() {
  return {
    version: DESIGN_SYSTEM_VERSION,
    canvas: {
      width: LAYOUT_SAFE_AREA.canvas_width,
      height: LAYOUT_SAFE_AREA.canvas_height,
    },
    layouts: GRID_LAYOUTS,
    alignment_rules: [
      "Content aligns to left gutter",
      "Dual-column layouts require verified text order",
      "Gutters must be multiples of 4px",
    ],
    generated_at: new Date().toISOString(),
  };
}

export function getGridLayout(id: GridLayoutId): GridLayoutSpec | undefined {
  return GRID_LAYOUTS.find((g) => g.id === id);
}
