/**
 * Color token system — ATS-safe palettes.
 */
import type { ATSComponentFlags, ColorPaletteId } from "./types.js";
import { DESIGN_SYSTEM_VERSION } from "./types.js";

export type ColorPalette = {
  id: ColorPaletteId;
  name: string;
  primary: string;
  accent: string;
  text: string;
  muted: string;
  background: string;
  max_accent_percent: number;
  min_contrast_ratio: number;
} & ATSComponentFlags;

const PALETTES: ColorPalette[] = [
  {
    id: "corporate-blue",
    name: "Corporate Blue",
    primary: "#1E3A5F",
    accent: "#2563EB",
    text: "#1F2937",
    muted: "#6B7280",
    background: "#FFFFFF",
    max_accent_percent: 15,
    min_contrast_ratio: 4.5,
    ats_safe: true,
    machine_readable: true,
    text_order: "text on white background",
    contrast_safe: true,
    print_safe: true,
  },
  {
    id: "minimal-gray",
    name: "Minimal Gray",
    primary: "#374151",
    accent: "#9CA3AF",
    text: "#111827",
    muted: "#6B7280",
    background: "#FFFFFF",
    max_accent_percent: 10,
    min_contrast_ratio: 4.5,
    ats_safe: true,
    machine_readable: true,
    text_order: "text on white background",
    contrast_safe: true,
    print_safe: true,
  },
  {
    id: "executive-navy",
    name: "Executive Navy",
    primary: "#0F172A",
    accent: "#1E40AF",
    text: "#0F172A",
    muted: "#64748B",
    background: "#FFFFFF",
    max_accent_percent: 12,
    min_contrast_ratio: 4.5,
    ats_safe: true,
    machine_readable: true,
    text_order: "text on white background",
    contrast_safe: true,
    print_safe: true,
  },
  {
    id: "emerald",
    name: "Emerald",
    primary: "#064E3B",
    accent: "#059669",
    text: "#1F2937",
    muted: "#6B7280",
    background: "#FFFFFF",
    max_accent_percent: 12,
    min_contrast_ratio: 4.5,
    ats_safe: true,
    machine_readable: true,
    text_order: "text on white background",
    contrast_safe: true,
    print_safe: true,
  },
  {
    id: "teal",
    name: "Teal",
    primary: "#134E4A",
    accent: "#0D9488",
    text: "#1F2937",
    muted: "#6B7280",
    background: "#FFFFFF",
    max_accent_percent: 12,
    min_contrast_ratio: 4.5,
    ats_safe: true,
    machine_readable: true,
    text_order: "text on white background",
    contrast_safe: true,
    print_safe: true,
  },
  {
    id: "indigo",
    name: "Indigo",
    primary: "#312E81",
    accent: "#4F46E5",
    text: "#1F2937",
    muted: "#6B7280",
    background: "#FFFFFF",
    max_accent_percent: 12,
    min_contrast_ratio: 4.5,
    ats_safe: true,
    machine_readable: true,
    text_order: "text on white background",
    contrast_safe: true,
    print_safe: true,
  },
  {
    id: "slate",
    name: "Slate",
    primary: "#334155",
    accent: "#64748B",
    text: "#0F172A",
    muted: "#94A3B8",
    background: "#FFFFFF",
    max_accent_percent: 10,
    min_contrast_ratio: 4.5,
    ats_safe: true,
    machine_readable: true,
    text_order: "text on white background",
    contrast_safe: true,
    print_safe: true,
  },
  {
    id: "professional-black",
    name: "Professional Black",
    primary: "#000000",
    accent: "#374151",
    text: "#111827",
    muted: "#6B7280",
    background: "#FFFFFF",
    max_accent_percent: 8,
    min_contrast_ratio: 7,
    ats_safe: true,
    machine_readable: true,
    text_order: "text on white background",
    contrast_safe: true,
    print_safe: true,
  },
  {
    id: "muted-accent",
    name: "Muted Accent",
    primary: "#4B5563",
    accent: "#D1D5DB",
    text: "#1F2937",
    muted: "#9CA3AF",
    background: "#FFFFFF",
    max_accent_percent: 8,
    min_contrast_ratio: 4.5,
    ats_safe: true,
    machine_readable: true,
    text_order: "text on white background",
    contrast_safe: true,
    print_safe: true,
  },
];

export function buildColorTokenSystem() {
  return {
    version: DESIGN_SYSTEM_VERSION,
    palettes: PALETTES,
    rules: [
      "Maximum accent coverage per palette max_accent_percent",
      "Body text contrast ratio ≥ 4.5:1 (WCAG AA)",
      "Print: avoid light gray body text below #6B7280",
      "No gradient text in ATS tier",
    ],
    generated_at: new Date().toISOString(),
  };
}

export function getColorPalette(id: ColorPaletteId): ColorPalette | undefined {
  return PALETTES.find((p) => p.id === id);
}
