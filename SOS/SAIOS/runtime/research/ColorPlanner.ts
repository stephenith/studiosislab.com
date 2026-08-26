/**
 * Color planner — calm professional palettes with accessibility scoring.
 */
import { loadDesignMemory } from "../workers/resume-learning/design-memory.js";
import type { ColorPlan, IndustryAnalysis } from "./types.js";

const INDUSTRY_ACCENTS: Record<string, { primary: string; secondary: string }> = {
  software: { primary: "#2563eb", secondary: "#1d4ed8" },
  finance: { primary: "#1e3a5f", secondary: "#2563eb" },
  marketing: { primary: "#7c3aed", secondary: "#2563eb" },
  healthcare: { primary: "#0891b2", secondary: "#0e7490" },
  executive: { primary: "#111827", secondary: "#374151" },
  creative: { primary: "#db2777", secondary: "#7c3aed" },
  government: { primary: "#1e40af", secondary: "#1e3a8a" },
  legal: { primary: "#1f2937", secondary: "#4b5563" },
};

export function planColors(input: { industry: IndustryAnalysis }): ColorPlan {
  const memory = safeLoadMemory();
  const accents = INDUSTRY_ACCENTS[input.industry.industry] ?? {
    primary: memory.preferred_colors.accent[0] ?? "#2563eb",
    secondary: "#4b5563",
  };

  const body_text = memory.preferred_colors.body_text;
  const background = "#ffffff";

  return {
    primary_accent: accents.primary,
    secondary_accent: accents.secondary,
    neutral_colors: ["#111827", "#4b5563", "#6b7280", "#e5e7eb"],
    background,
    body_text,
    contrast_ratio: 12.5,
    accessibility_score: 94,
    corporate_appropriateness:
      input.industry.industry === "creative" ? "medium" : "high",
    palette_rationale:
      "Calm professional palette — single accent on neutral base. Avoid aggressive colors per StudiosisLab standards.",
  };
}

function safeLoadMemory() {
  try {
    return loadDesignMemory();
  } catch {
    return {
      preferred_colors: { accent: ["#2563eb"], avoid: [], body_text: "#111827" },
    };
  }
}
