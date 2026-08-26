/**
 * Color harmony engine — professional palette decisions.
 */
import type { BrainMemoryStore } from "./DesignMemory.js";
import type { IndustryStyleDecision } from "./IndustryStyleEngine.js";
import type { ColorSystem } from "./types.js";

const INDUSTRY_ACCENTS: Partial<Record<string, { primary: string; secondary: string }>> = {
  software: { primary: "#2563eb", secondary: "#1d4ed8" },
  finance: { primary: "#1e3a5f", secondary: "#374151" },
  healthcare: { primary: "#0891b2", secondary: "#0e7490" },
  executive: { primary: "#111827", secondary: "#4b5563" },
  legal: { primary: "#1f2937", secondary: "#6b7280" },
  creative: { primary: "#7c3aed", secondary: "#db2777" },
  government: { primary: "#1e40af", secondary: "#1e3a8a" },
};

export function resolveColorHarmony(
  style: IndustryStyleDecision,
  memory: BrainMemoryStore,
): ColorSystem {
  const accent =
    INDUSTRY_ACCENTS[style.industry]?.primary ??
    memory.aggregate.preferred_accents[0] ??
    "#2563eb";

  const secondary =
    INDUSTRY_ACCENTS[style.industry]?.secondary ?? "#4b5563";

  const use_accent = !style.conservative || style.premium_feel;

  let palette_style: ColorSystem["palette_style"] = "calm-professional";
  if (style.premium_feel) palette_style = "executive-neutral";
  if (style.design_language === "creative-expressive") palette_style = "creative-accent";

  return {
    primary_accent: use_accent ? accent : "#374151",
    secondary_accent: secondary,
    text: "#111827",
    muted: "#6b7280",
    background: "#ffffff",
    use_accent,
    contrast_ratio: 12.5,
    palette_style,
  };
}
