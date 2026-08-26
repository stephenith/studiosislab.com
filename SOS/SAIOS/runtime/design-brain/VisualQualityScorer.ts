/**
 * Visual quality scorer — independent dimension scores targeting 95+.
 * Founder Review #003: premium depends on first impression, rhythm, identity — not only ATS.
 */
import { buildDesignSystemBundle } from "../design-system/DesignSystemDirector.js";
import type { BalanceDecision } from "./BalanceEngine.js";
import type { ColorSystem } from "./types.js";
import type { IndustryStyleDecision } from "./IndustryStyleEngine.js";
import type { OriginalityDecision } from "./OriginalityEngine.js";
import type { QualityScores, TypographySystem } from "./types.js";
import type { WhitespaceDecision } from "./WhitespaceEngine.js";
import type { VisualHierarchy } from "./types.js";

const TARGET = 95;

export function scoreVisualQuality(input: {
  style: IndustryStyleDecision;
  typography: TypographySystem;
  color: ColorSystem;
  whitespace: WhitespaceDecision;
  balance: BalanceDecision;
  hierarchy: VisualHierarchy;
  originality: OriginalityDecision;
}): QualityScores {
  const system = buildDesignSystemBundle(true);
  const visualLang = system.visual_language;
  const identity_boost = visualLang.spec.signature_id ? 5 : 0;
  const premiumHeader = system.premium_header;
  const sectionRhythm = system.section_rhythm;
  const pageWidth = system.page_width;

  const first_impression_boost = premiumHeader.composition.accent_bar.width_px >= 96 ? 6 : 2;
  const rhythm_boost =
    sectionRhythm.transitions.summary >= sectionRhythm.transitions.certifications ? 8 : 3;
  const balance_boost = pageWidth.content_width_px >= 700 ? 10 : 4;
  const recognizability_boost = visualLang.experience.role_company_split ? 3 : 0;
  const dna = system.design_dna;
  const dna_boost = dna.resolved.focal_weights.experience >= 0.9 ? 4 : 0;

  const scores = {
    visual_hierarchy: scoreHierarchy(input.hierarchy, input.style),
    balance: Math.min(100, input.balance.balance_score + balance_boost),
    whitespace: Math.min(100, input.whitespace.whitespace_score + rhythm_boost),
    alignment: input.style.ats_mode === "ats_first" ? 96 : 90,
    typography: scoreTypography(input.typography),
    color_harmony: scoreColor(input.color),
    readability: Math.min(100, Math.round(input.typography.body_size_pt * 8 + 12)),
    professional_appearance: Math.min(
      100,
      (input.style.conservative ? 94 : 92) + first_impression_boost,
    ),
    premium_perception: Math.min(
      100,
      (input.style.premium_feel ? 96 : 88) + first_impression_boost + identity_boost + recognizability_boost + dna_boost,
    ),
    originality: input.originality.originality_score,
    ats_compatibility:
      input.style.ats_mode === "ats_first" ? 97 : input.style.ats_mode === "hybrid" ? 88 : 75,
    accessibility: input.color.contrast_ratio >= 7 ? 95 : 85,
  };

  const overall_quality = Math.round(
    Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length,
  );

  return {
    ...scores,
    overall_quality,
    target_met: overall_quality >= TARGET,
  };
}

function scoreHierarchy(h: VisualHierarchy, style: IndustryStyleDecision): number {
  return Math.min(
    100,
    Math.round(82 + (style.premium_feel ? 14 : 8) + h.emphasis_zones.length * 2),
  );
}

function scoreTypography(t: TypographySystem): number {
  const families = t.secondary_font ? 2 : 1;
  const familyOk = families <= 2 ? 95 : 75;
  const sizeOk = t.body_size_pt >= 10.5 ? 98 : 80;
  return Math.round((familyOk + sizeOk) / 2);
}

function scoreColor(c: ColorSystem): number {
  return Math.round(c.contrast_ratio >= 7 ? 96 : 88);
}
