/**
 * ThemeRenderer — resolve colors from Resume JSON + family color strategy.
 * Agent #239 — auto on_accent contrast against header band.
 */
import { pickAccessibleTextColor } from "./contrast.js";
import type { ResolvedTheme, ResumeJsonInput } from "./types.js";

export function renderTheme(input: ResumeJsonInput): ResolvedTheme {
  const c = input.colors;
  const cs = input.visual_guidance?.color_strategy as
    | Record<string, string>
    | undefined;
  const header_band = cs?.header_band ?? cs?.accent;
  const on_accent = pickAccessibleTextColor(header_band ?? "#0f172a", {
    largeText: true,
    preferred: cs?.on_accent ?? "#ffffff",
  }).color;
  const body_text = pickAccessibleTextColor(c.background ?? "#ffffff", {
    preferred: cs?.text ?? c.body_text,
  }).color;
  return {
    background: c.background,
    body_text,
    heading_text: cs?.primary_neutral ?? c.heading_text,
    accent: cs?.accent ?? c.accent,
    rule: cs?.pale_tint ?? c.rule,
    muted: cs?.muted ?? c.muted,
    pale_tint: cs?.pale_tint,
    on_accent,
    header_band,
    sidebar_bg: cs?.sidebar_bg,
  };
}
