/**
 * Color palette selection — family color strategies + ATS-safe palettes.
 */
import type { BrainPlanningOutput, ColorPalette } from "./types.js";

const PALETTES: Record<string, ColorPalette> = {
  "ats-mono-ink": {
    id: "ats-mono-ink",
    background: "#ffffff",
    body_text: "#0a0a0a",
    heading_text: "#0a0a0a",
    accent: "#0a0a0a",
    rule: "#d4d4d4",
    muted: "#525252",
    contrast_ok: true,
    ats_safe: true,
    rationale: "High-contrast mono ink",
  },
  "ats-navy-accent": {
    id: "ats-navy-accent",
    background: "#ffffff",
    body_text: "#111827",
    heading_text: "#0f172a",
    accent: "#1e3a5f",
    rule: "#cbd5e1",
    muted: "#64748b",
    contrast_ok: true,
    ats_safe: true,
    rationale: "Navy accent",
  },
  "ats-slate-accent": {
    id: "ats-slate-accent",
    background: "#ffffff",
    body_text: "#1f2937",
    heading_text: "#111827",
    accent: "#334155",
    rule: "#e2e8f0",
    muted: "#64748b",
    contrast_ok: true,
    ats_safe: true,
    rationale: "Slate accent",
  },
  "ats-forest-accent": {
    id: "ats-forest-accent",
    background: "#ffffff",
    body_text: "#1a1a1a",
    heading_text: "#14532d",
    accent: "#166534",
    rule: "#86efac",
    muted: "#4b5563",
    contrast_ok: true,
    ats_safe: true,
    rationale: "Forest accent",
  },
};

export function selectColorPalette(output: BrainPlanningOutput): ColorPalette {
  const familyColors = output.family_colors as
    | {
        text?: string;
        accent?: string;
        muted?: string;
        pale_tint?: string;
        primary_neutral?: string;
      }
    | undefined;
  if (familyColors?.text && familyColors?.accent) {
    return {
      id: String(output.palette_id ?? "family-custom"),
      background: "#ffffff",
      body_text: familyColors.text,
      heading_text: familyColors.primary_neutral ?? familyColors.text,
      accent: familyColors.accent,
      rule: familyColors.pale_tint ?? "#e5e7eb",
      muted: familyColors.muted ?? "#64748b",
      contrast_ok: true,
      ats_safe: true,
      rationale: `Design family color strategy (${output.design_family ?? "family"})`,
    };
  }

  const id = String(output.palette_id ?? "");
  if (id && PALETTES[id]) return { ...PALETTES[id] };
  return { ...PALETTES["ats-navy-accent"] };
}
