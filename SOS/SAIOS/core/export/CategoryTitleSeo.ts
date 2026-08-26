/**
 * StudiosisLab public naming / category / SEO draft helpers — Agent #243.
 * Design-family and internal IDs never appear in public titles/slugs.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO = resolve(import.meta.dirname, "../../../..");

/** Manifest-style category IDs used by recent similar templates. */
const ROLE_TO_CATEGORY: Record<string, string> = {
  marketing_manager: "sales-marketing-advertising",
  software_engineer: "it",
  graphic_designer: "creative-designing",
  accountant: "finance-accounting",
  hr_manager: "business-management",
  human_resources_manager: "business-management",
  finance: "finance-accounting",
  marketing: "sales-marketing-advertising",
  creative: "creative-designing",
  engineering: "it",
  ats: "business-management",
};

const ROLE_TO_TITLE: Record<string, string> = {
  marketing_manager: "Marketing Manager Resume",
  software_engineer: "Software Engineer Resume",
  graphic_designer: "Graphic Designer Resume",
  accountant: "Accountant Resume",
  hr_manager: "Human Resources Manager Resume",
  human_resources_manager: "Human Resources Manager Resume",
};

function titleCaseWords(input: string): string {
  return input
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function normalizeRoleKey(role: string): string {
  return String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function publicDisplayTitle(role: string): string {
  const key = normalizeRoleKey(role);
  if (ROLE_TO_TITLE[key]) return ROLE_TO_TITLE[key];
  const pretty = titleCaseWords(key.replace(/_/g, " "));
  return pretty.endsWith(" Resume") ? pretty : `${pretty} Resume`;
}

export function mapCategoryId(role: string, fallbackCategory?: string | null): string {
  const key = normalizeRoleKey(role);
  if (ROLE_TO_CATEGORY[key]) return ROLE_TO_CATEGORY[key];
  const fb = String(fallbackCategory ?? "").toLowerCase().trim();
  if (fb === "finance" || fb === "finance-accounting") return "finance-accounting";
  if (fb === "marketing" || fb === "sales" || fb === "sales-marketing-advertising") {
    return "sales-marketing-advertising";
  }
  if (fb === "creative" || fb === "creative-designing") return "creative-designing";
  if (fb === "it" || fb === "it-software" || fb === "engineering") return "it";
  if (fb === "business" || fb === "business-management" || fb === "ats") {
    return "business-management";
  }
  return "business";
}

export function slugifyRole(role: string): string {
  const title = publicDisplayTitle(role)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return title.endsWith("-resume") ? title : `${title}-resume`;
}

function loadExistingSlugs(): Set<string> {
  const set = new Set<string>();
  const seoPath = join(REPO, "src/data/templateSeoContent.ts");
  if (!existsSync(seoPath)) return set;
  const raw = readFileSync(seoPath, "utf8");
  for (const m of raw.matchAll(/slug:\s*"([^"]+)"/g)) {
    set.add(m[1]!.toLowerCase());
  }
  return set;
}

/**
 * Prefer exact role slug; on collision suggest a curated alternate
 * (ATS qualifier — not design-family, not numeric noise).
 */
export function buildSeoSlug(role: string): {
  slug: string;
  collision: boolean;
  suggested_alternate_slug: string | null;
} {
  const primary = slugifyRole(role);
  const existing = loadExistingSlugs();
  if (!existing.has(primary)) {
    return { slug: primary, collision: false, suggested_alternate_slug: null };
  }
  const alt = primary.replace(/-resume$/, "-ats-resume");
  return {
    slug: primary,
    collision: true,
    suggested_alternate_slug: existing.has(alt)
      ? primary.replace(/-resume$/, "-professional-resume")
      : alt,
  };
}

export function buildTags(role: string, categoryId: string): string[] {
  const title = publicDisplayTitle(role);
  const roleLabel = title.replace(/\s+Resume$/i, "").toLowerCase();
  return [
    roleLabel,
    `${roleLabel} resume`,
    categoryId.replace(/-/g, " "),
    "ats resume",
    "resume template",
    "resume",
  ];
}

export function buildSeoDescription(title: string, role: string): string {
  const roleLabel = publicDisplayTitle(role).replace(/\s+Resume$/i, "");
  return `Use this ${title.toLowerCase()} template to present ${roleLabel.toLowerCase()} experience clearly for ATS and hiring managers.`;
}
