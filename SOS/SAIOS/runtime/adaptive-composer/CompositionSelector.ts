/**
 * Composition selector — intelligently choose component variants.
 */
import type { ComponentCategory, ComponentVariant, CompositionMode, SelectedComponent } from "./types.js";
import type { ComposerKnowledgeContext } from "./KnowledgeConsumer.js";
import { getComponentsForCategory } from "./ComponentLibrary.js";
import type { IndustryId } from "../research/types.js";

const INDUSTRY_VARIANT_MAP: Partial<Record<IndustryId, ComponentVariant>> = {
  software: "software",
  finance: "finance",
  marketing: "marketing",
  healthcare: "healthcare",
  student: "student",
  executive: "executive",
  creative: "creative",
};

const MODE_VARIANT_MAP: Record<CompositionMode, ComponentVariant> = {
  ats: "ats",
  premium: "modern",
  executive: "executive",
  creative: "creative",
  student: "student",
};

const ACTIVE_CATEGORIES: ComponentCategory[] = [
  "header",
  "professional_summary",
  "experience",
  "education",
  "skills",
  "projects",
  "certification",
  "achievements",
  "languages",
  "contact",
  "sidebar",
  "divider",
  "accent",
  "whitespace",
  "grid",
];

export function selectComponents(input: {
  industry: IndustryId;
  mode: CompositionMode;
  knowledge: ComposerKnowledgeContext;
  seed: number;
  redesign_offset?: number;
}): SelectedComponent[] {
  const industryVariant = INDUSTRY_VARIANT_MAP[input.industry] ?? "corporate";
  const modeVariant = MODE_VARIANT_MAP[input.mode];
  const offset = (input.seed + (input.redesign_offset ?? 0)) % 13;

  return ACTIVE_CATEGORIES.map((category, idx) => {
    const pool = getComponentsForCategory(category);
    const preferred =
      pool.find((c) => c.variant === industryVariant) ??
      pool.find((c) => c.variant === modeVariant) ??
      pool[(idx + offset) % pool.length]!;

    const variant = rotateVariant(preferred.variant, offset + idx, input.mode);
    const def = pool.find((c) => c.variant === variant) ?? preferred;

    return {
      category,
      variant: def.variant,
      justification: justifySelection(category, def.variant, input.industry, input.mode, input.knowledge),
    };
  });
}

function rotateVariant(
  base: ComponentVariant,
  offset: number,
  mode: CompositionMode,
): ComponentVariant {
  const variants: ComponentVariant[] = [
    "corporate",
    "executive",
    "modern",
    "minimal",
    "tech",
    "creative",
    "luxury",
    "ats",
    "healthcare",
    "finance",
    "marketing",
    "software",
    "student",
  ];
  if (mode === "ats") return variants[(variants.indexOf("ats") + offset) % variants.length]!;
  const idx = variants.indexOf(base);
  return variants[(idx + offset) % variants.length]!;
}

function justifySelection(
  category: ComponentCategory,
  variant: ComponentVariant,
  industry: IndustryId,
  mode: CompositionMode,
  knowledge: ComposerKnowledgeContext,
): string {
  const parts = [
    `${category} uses ${variant} variant for ${industry} industry`,
    `Mode ${mode} requires ${mode === "ats" ? "ATS-safe parse order" : "premium visual hierarchy"}`,
  ];
  if (knowledge.benchmark_principles[0]) {
    parts.push(`Benchmark: ${knowledge.benchmark_principles[0].slice(0, 60)}`);
  }
  return parts.join("; ");
}
