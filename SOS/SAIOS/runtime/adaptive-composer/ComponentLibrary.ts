/**
 * Premium component libraries — reusable building blocks with variants.
 * Principles only — never copies external templates.
 */
import type { ComponentCategory, ComponentVariant } from "./types.js";

export type ComponentDefinition = {
  category: ComponentCategory;
  variant: ComponentVariant;
  ats_safe: boolean;
  premium_weight: number;
  spacing_bias: "generous" | "balanced" | "compact";
  typography_bias: "classic" | "modern" | "technical";
  description: string;
};

const VARIANTS: ComponentVariant[] = [
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

const CATEGORIES: ComponentCategory[] = [
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
  "cta",
  "accent",
  "whitespace",
  "grid",
];

function buildLibrary(): ComponentDefinition[] {
  const defs: ComponentDefinition[] = [];
  for (const category of CATEGORIES) {
    for (const variant of VARIANTS) {
      const ats_safe = variant === "ats" || variant === "minimal" || variant === "corporate";
      const premium_weight =
        variant === "luxury" || variant === "executive"
          ? 98
          : variant === "modern" || variant === "tech"
            ? 95
            : variant === "ats" || variant === "minimal"
              ? 88
              : 92;
      defs.push({
        category,
        variant,
        ats_safe,
        premium_weight,
        spacing_bias:
          variant === "luxury" || variant === "executive"
            ? "generous"
            : variant === "minimal" || variant === "ats"
              ? "compact"
              : "balanced",
        typography_bias:
          variant === "tech" || variant === "software"
            ? "technical"
            : variant === "creative" || variant === "marketing"
              ? "modern"
              : "classic",
        description: `${variant} ${category.replace(/_/g, " ")} block`,
      });
    }
  }
  return defs;
}

export const COMPONENT_LIBRARY = buildLibrary();

export function getComponentsForCategory(category: ComponentCategory): ComponentDefinition[] {
  return COMPONENT_LIBRARY.filter((c) => c.category === category);
}

export function getComponent(
  category: ComponentCategory,
  variant: ComponentVariant,
): ComponentDefinition | undefined {
  return COMPONENT_LIBRARY.find((c) => c.category === category && c.variant === variant);
}

export const DEFAULT_SECTION_ORDER = [
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
  "footer",
];
