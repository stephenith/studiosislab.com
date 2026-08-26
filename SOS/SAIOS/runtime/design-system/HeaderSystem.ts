/**
 * Header library — premium header variants.
 */
import type { ATSComponentFlags, HeaderVariantId } from "./types.js";
import { DESIGN_SYSTEM_VERSION } from "./types.js";

export type HeaderVariant = {
  id: HeaderVariantId;
  name: string;
  alignment: "left" | "center" | "split";
  spacing_px: {
    top: number;
    bottom: number;
    name_to_title: number;
    title_to_contact: number;
    contact_to_content: number;
  };
  name_scale: "display" | "heading";
  title_scale: "heading" | "subheading";
  contact_arrangement: "inline" | "stacked" | "split-row" | "sidebar-block";
  accent_style: "none" | "underline" | "band" | "rule" | "color-block";
} & ATSComponentFlags;

const BASE_ATS: ATSComponentFlags = {
  ats_safe: true,
  machine_readable: true,
  text_order: "name → title → contact",
  contrast_safe: true,
  print_safe: true,
};

const HEADER_VARIANTS: HeaderVariant[] = [
  {
    id: "executive",
    name: "Executive",
    alignment: "center",
    spacing_px: { top: 44, bottom: 24, name_to_title: 14, title_to_contact: 12, contact_to_content: 20 },
    name_scale: "display",
    title_scale: "heading",
    contact_arrangement: "inline",
    accent_style: "rule",
    ...BASE_ATS,
  },
  {
    id: "corporate",
    name: "Corporate",
    alignment: "left",
    spacing_px: { top: 40, bottom: 20, name_to_title: 12, title_to_contact: 12, contact_to_content: 20 },
    name_scale: "display",
    title_scale: "subheading",
    contact_arrangement: "split-row",
    accent_style: "band",
    ...BASE_ATS,
  },
  {
    id: "minimal",
    name: "Minimal",
    alignment: "left",
    spacing_px: { top: 48, bottom: 16, name_to_title: 12, title_to_contact: 12, contact_to_content: 20 },
    name_scale: "heading",
    title_scale: "subheading",
    contact_arrangement: "stacked",
    accent_style: "none",
    ...BASE_ATS,
  },
  {
    id: "technical",
    name: "Technical",
    alignment: "left",
    spacing_px: { top: 40, bottom: 20, name_to_title: 12, title_to_contact: 12, contact_to_content: 20 },
    name_scale: "display",
    title_scale: "subheading",
    contact_arrangement: "inline",
    accent_style: "underline",
    ...BASE_ATS,
  },
  {
    id: "creative",
    name: "Creative",
    alignment: "left",
    spacing_px: { top: 36, bottom: 20, name_to_title: 14, title_to_contact: 12, contact_to_content: 20 },
    name_scale: "display",
    title_scale: "heading",
    contact_arrangement: "stacked",
    accent_style: "color-block",
    ats_safe: true,
    machine_readable: true,
    text_order: "name → title → contact",
    contrast_safe: true,
    print_safe: true,
  },
  {
    id: "student",
    name: "Student",
    alignment: "left",
    spacing_px: { top: 44, bottom: 16, name_to_title: 12, title_to_contact: 12, contact_to_content: 20 },
    name_scale: "heading",
    title_scale: "subheading",
    contact_arrangement: "stacked",
    accent_style: "none",
    ...BASE_ATS,
  },
  {
    id: "healthcare",
    name: "Healthcare",
    alignment: "left",
    spacing_px: { top: 40, bottom: 20, name_to_title: 12, title_to_contact: 12, contact_to_content: 20 },
    name_scale: "display",
    title_scale: "subheading",
    contact_arrangement: "split-row",
    accent_style: "rule",
    ...BASE_ATS,
  },
  {
    id: "marketing",
    name: "Marketing",
    alignment: "center",
    spacing_px: { top: 40, bottom: 24, name_to_title: 14, title_to_contact: 12, contact_to_content: 20 },
    name_scale: "display",
    title_scale: "heading",
    contact_arrangement: "inline",
    accent_style: "color-block",
    ...BASE_ATS,
  },
  {
    id: "finance",
    name: "Finance",
    alignment: "left",
    spacing_px: { top: 44, bottom: 20, name_to_title: 12, title_to_contact: 12, contact_to_content: 20 },
    name_scale: "display",
    title_scale: "subheading",
    contact_arrangement: "split-row",
    accent_style: "rule",
    ...BASE_ATS,
  },
  {
    id: "operations",
    name: "Operations",
    alignment: "left",
    spacing_px: { top: 40, bottom: 20, name_to_title: 12, title_to_contact: 12, contact_to_content: 20 },
    name_scale: "display",
    title_scale: "subheading",
    contact_arrangement: "inline",
    accent_style: "band",
    ...BASE_ATS,
  },
];

export function buildHeaderSystem() {
  return {
    version: DESIGN_SYSTEM_VERSION,
    variants: HEADER_VARIANTS,
    generated_at: new Date().toISOString(),
  };
}

export function getHeaderVariant(id: HeaderVariantId): HeaderVariant | undefined {
  return HEADER_VARIANTS.find((h) => h.id === id);
}
