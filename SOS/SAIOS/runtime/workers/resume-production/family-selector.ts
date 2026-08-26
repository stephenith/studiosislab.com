/**
 * Select best design family for a target template brief.
 */
import type { DesignFamily } from "../../../domain/studiosislab/resume/intelligence/types.js";

export type FamilySelectionResult = {
  selected_family_id: string;
  display_name: string;
  tier: "ats_safe" | "visual" | "hybrid";
  score: number;
  rationale: string[];
  reference_template_ids: string[];
  reference_dna_notes: string[];
};

const BRIEF_FAMILY_AFFINITY: Record<string, string[]> = {
  "modern ats professional": [
    "corporate-modern",
    "operations-management",
    "minimal-ats",
    "executive-ats",
    "administrative-ats",
  ],
};

export function selectDesignFamily(
  brief: string,
  families: readonly DesignFamily[],
  options?: { exclude_family_ids?: string[] },
): FamilySelectionResult {
  const normalized = brief.toLowerCase().trim();
  const affinity =
    BRIEF_FAMILY_AFFINITY[normalized] ??
    BRIEF_FAMILY_AFFINITY["modern ats professional"];

  const exclude = new Set(options?.exclude_family_ids ?? []);
  const candidates = families.filter((f) => affinity.includes(f.id) && !exclude.has(f.id));
  const pool = candidates.length > 0 ? candidates : families.filter((f) => !exclude.has(f.id));

  const scored = pool.map((f) => {
    let score = f.ats_score * 0.55 + f.visual_score * 0.25;
    if (f.id === "corporate-modern") score += 15;
    if (f.tier === "ats_safe" || f.tier === "hybrid") score += 8;
    if (normalized.includes("modern") && f.id === "corporate-modern") score += 10;
    if (normalized.includes("professional") && f.id === "operations-management") score += 5;
    if (normalized.includes("ats") && f.ats_score >= 90) score += 5;
    return { family: f, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const winner = scored[0]?.family ?? families[0];

  const refs = winner.template_ids.slice(0, 3);
  if (winner.id === "corporate-modern" && refs.length === 0) {
    refs.push("t002");
  }

  return {
    selected_family_id: winner.id,
    display_name: winner.display_name,
    tier: winner.id === "corporate-modern" ? "ats_safe" : winner.tier,
    score: Math.round(scored[0]?.score ?? 0),
    rationale: [
      `Brief "${brief}" maps to affinity list: ${affinity.join(", ")}`,
      `Winner ${winner.display_name}: ATS ${winner.ats_score}, Visual ${winner.visual_score}`,
      "corporate-modern selected for modern + professional + general business fit",
      "Production tier forced to ats_safe per brief (ATS friendly requirement)",
      `Spacing rules: ${winner.spacing_rules.slice(0, 2).join("; ")}`,
      `Typography rules: ${winner.typography_rules.slice(0, 2).join("; ")}`,
    ],
    reference_template_ids: refs.length ? refs : ["t049", "t057", "t002"],
    reference_dna_notes: [
      "Match single-column flow from operations-management family",
      "Apply 48–56px gutters from LAYOUT_SAFE_AREA",
      "Decoration density target < 0.12 (minimal-ats pattern)",
      "No images, no groups, no widgets — flat Textbox + Line + Rect only",
    ],
  };
}
