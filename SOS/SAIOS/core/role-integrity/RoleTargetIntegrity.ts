/**
 * Phase 6A — Canonical professional role-target integrity contract.
 *
 * Authoritative target: production_target.title (+ role_family slug).
 * Generated structured role: RoleSample / provider content title.
 * Rendered role: header professional title text (not person name).
 *
 * Fail-closed: ROLE_MISMATCH and ROLE_UNEVALUABLE must not enter Founder Review.
 */
import {
  listDeterministicPackFamilies,
  resolveDeterministicPackFamily,
} from "../resume-renderer/SampleContent.js";

type CanvasLike = { objects?: unknown[] } | null | undefined;
export type RoleMatchKind =
  | "ROLE_MATCH"
  | "ROLE_COMPATIBLE_ALIAS"
  | "ROLE_MISMATCH"
  | "ROLE_UNEVALUABLE";

export type RoleTargetIntegrityResult = {
  schema_version: "role-target-integrity-1.0.0";
  pass: boolean;
  match: RoleMatchKind;
  reason: string;
  target_title: string;
  target_role_family: string;
  target_normalized: string;
  structured_role: string | null;
  structured_normalized: string | null;
  rendered_role: string | null;
  rendered_normalized: string | null;
  content_source: "openai" | "deterministic_pack" | "unknown" | null;
  pack_family: string | null;
  evaluated_at: string;
};

/**
 * Explicit equivalence only — derived from existing SEO/category maps
 * plus standard title expansions that preserve the same profession.
 * Do not invent broad synonym tables.
 */
const EXPLICIT_ROLE_ALIASES: Record<string, string> = {
  hr_manager: "hr_manager",
  human_resources_manager: "hr_manager",
  human_resource_manager: "hr_manager",
  vp_of_operations: "vice_president_of_operations",
  vp_operations: "vice_president_of_operations",
  vice_president_of_operations: "vice_president_of_operations",
};

export function normalizeRoleKey(raw: string | null | undefined): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/** Canonical alias root when an explicit mapping exists; else the key itself. */
export function canonicalRoleKey(raw: string | null | undefined): string {
  const key = normalizeRoleKey(raw);
  if (!key) return "";
  return EXPLICIT_ROLE_ALIASES[key] ?? key;
}

export function rolesAreCompatible(
  a: string | null | undefined,
  b: string | null | undefined,
): { ok: boolean; kind: RoleMatchKind } {
  const na = canonicalRoleKey(a);
  const nb = canonicalRoleKey(b);
  if (!na || !nb) {
    return { ok: false, kind: "ROLE_UNEVALUABLE" };
  }
  if (na === nb) {
    const aRaw = normalizeRoleKey(a);
    const bRaw = normalizeRoleKey(b);
    if (aRaw !== bRaw && (EXPLICIT_ROLE_ALIASES[aRaw] || EXPLICIT_ROLE_ALIASES[bRaw])) {
      return { ok: true, kind: "ROLE_COMPATIBLE_ALIAS" };
    }
    return { ok: true, kind: "ROLE_MATCH" };
  }
  return { ok: false, kind: "ROLE_MISMATCH" };
}

function objectSection(o: Record<string, unknown>): string {
  const data = o.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return String((data as { section?: unknown }).section ?? "");
  }
  return String(o.section ?? "");
}

function objectRole(o: Record<string, unknown>): string {
  const data = o.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const r = (data as { role?: unknown }).role;
    if (typeof r === "string" && r.trim()) return r.trim().toLowerCase();
  }
  return String(o.role ?? "").trim().toLowerCase();
}

function looksLikeContact(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /@/.test(t) ||
    /\+?\d[\d\s().-]{6,}\d/.test(t) ||
    /linkedin\.com|github\.com|http/.test(t) ||
    /·/.test(t) && /@|\d{3}/.test(t)
  );
}

function looksLikeSectionHeading(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (/^(summary|experience|education|skills|projects|certifications|languages|awards|interests|profile|objective|work history|employment)$/i.test(t)) {
    return true;
  }
  // ALL-CAPS short labels (SUMMARY, EXPERIENCE, …) are not professional titles.
  if (t.length <= 24 && t === t.toUpperCase() && /^[A-Z][A-Z\s/&-]+$/.test(t)) {
    return true;
  }
  return false;
}

/**
 * Extract rendered professional title from canvas header.
 * Prefers data.role professional_title / role / title; never person name.
 */
export function extractRenderedProfessionalRole(
  canvas: CanvasLike,
): string | null {
  const objs = (canvas?.objects ?? []) as Array<Record<string, unknown>>;
  if (!objs.length) return null;

  const tagged = objs.find((o) => {
    const role = objectRole(o);
    const text = String(o.text ?? "").trim();
    return (
      text &&
      !looksLikeContact(text) &&
      !looksLikeSectionHeading(text) &&
      (role === "professional_title" ||
        role === "role" ||
        role === "job_title" ||
        role === "title")
    );
  });
  if (tagged) return String(tagged.text).trim();

  const headerTexts = objs
    .filter((o) => {
      const t = String(o.type ?? "").toLowerCase();
      if (!t.includes("text")) return false;
      const text = String(o.text ?? "").trim();
      if (!text || looksLikeContact(text) || looksLikeSectionHeading(text)) return false;
      const section = objectSection(o).toLowerCase();
      const top = typeof o.top === "number" ? o.top : 9999;
      return section === "header" || section === "identity" || top < 160;
    })
    .sort((a, b) => {
      const ta = typeof a.top === "number" ? a.top : 0;
      const tb = typeof b.top === "number" ? b.top : 0;
      if (ta !== tb) return ta - tb;
      const fa = typeof a.fontSize === "number" ? a.fontSize : 0;
      const fb = typeof b.fontSize === "number" ? b.fontSize : 0;
      return fb - fa;
    });

  if (headerTexts.length === 0) return null;
  // Largest / first is usually name; professional title is the next non-contact line.
  if (headerTexts.length === 1) {
    // Single header text that is not a person-name-only (contains job cue) may be combined.
    const only = String(headerTexts[0]!.text ?? "").trim();
    if (/\b(manager|engineer|analyst|designer|accountant|director|specialist|officer)\b/i.test(only)) {
      return only;
    }
    return null;
  }
  // Skip presumed name (first), take next non-heading title line.
  for (let i = 1; i < headerTexts.length; i++) {
    const text = String(headerTexts[i]!.text ?? "").trim();
    if (text && !looksLikeSectionHeading(text) && !looksLikeContact(text)) {
      return text;
    }
  }
  return null;
}

export function extractStructuredRoleTitle(input: {
  resume_content?: unknown;
  openai_resume_content?: unknown;
  sample_title?: string | null;
}): string | null {
  if (input.sample_title && String(input.sample_title).trim()) {
    return String(input.sample_title).trim();
  }
  for (const raw of [input.resume_content, input.openai_resume_content]) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const title = String((raw as { title?: unknown }).title ?? "").trim();
    if (title) return title;
  }
  return null;
}

export function evaluateRoleTargetIntegrity(input: {
  target_title: string;
  target_role_family?: string | null;
  structured_role?: string | null;
  rendered_role?: string | null;
  content_source?: "openai" | "deterministic_pack" | "unknown" | null;
  pack_family?: string | null;
}): RoleTargetIntegrityResult {
  const target_title = String(input.target_title ?? "").trim();
  const target_role_family = String(
    input.target_role_family ?? normalizeRoleKey(target_title),
  ).trim();
  const target_normalized = canonicalRoleKey(target_role_family || target_title);
  const structured = input.structured_role?.trim() || null;
  const rendered = input.rendered_role?.trim() || null;
  const structured_normalized = structured ? canonicalRoleKey(structured) : null;
  const rendered_normalized = rendered ? canonicalRoleKey(rendered) : null;

  const base = {
    schema_version: "role-target-integrity-1.0.0" as const,
    target_title,
    target_role_family,
    target_normalized,
    structured_role: structured,
    structured_normalized,
    rendered_role: rendered,
    rendered_normalized,
    content_source: input.content_source ?? null,
    pack_family: input.pack_family ?? null,
    evaluated_at: new Date().toISOString(),
  };

  if (!target_normalized) {
    return {
      ...base,
      pass: false,
      match: "ROLE_UNEVALUABLE",
      reason: "target professional role missing",
    };
  }
  if (!structured_normalized && !rendered_normalized) {
    return {
      ...base,
      pass: false,
      match: "ROLE_UNEVALUABLE",
      reason: "generated structured and rendered professional roles both missing",
    };
  }
  if (!structured_normalized || !rendered_normalized) {
    return {
      ...base,
      pass: false,
      match: "ROLE_UNEVALUABLE",
      reason: !structured_normalized
        ? "structured generated role missing"
        : "rendered header professional role missing",
    };
  }

  const structVsRender = rolesAreCompatible(structured, rendered);
  if (!structVsRender.ok) {
    return {
      ...base,
      pass: false,
      match: structVsRender.kind,
      reason: `structured role "${structured}" disagrees with rendered header role "${rendered}"`,
    };
  }

  const targetVsStruct = rolesAreCompatible(target_title || target_role_family, structured);
  if (!targetVsStruct.ok) {
    return {
      ...base,
      pass: false,
      match: targetVsStruct.kind,
      reason: `target "${target_title}" (${target_role_family}) mismatches structured role "${structured}"`,
    };
  }

  const targetVsRender = rolesAreCompatible(target_title || target_role_family, rendered);
  if (!targetVsRender.ok) {
    return {
      ...base,
      pass: false,
      match: targetVsRender.kind,
      reason: `target "${target_title}" mismatches rendered header role "${rendered}"`,
    };
  }

  const kind =
    targetVsStruct.kind === "ROLE_COMPATIBLE_ALIAS" ||
    targetVsRender.kind === "ROLE_COMPATIBLE_ALIAS" ||
    structVsRender.kind === "ROLE_COMPATIBLE_ALIAS"
      ? "ROLE_COMPATIBLE_ALIAS"
      : "ROLE_MATCH";

  return {
    ...base,
    pass: true,
    match: kind,
    reason:
      kind === "ROLE_COMPATIBLE_ALIAS"
        ? "target, structured, and rendered roles compatible via explicit alias"
        : "target, structured, and rendered professional roles match",
  };
}

export function evaluateCanvasRoleTargetIntegrity(input: {
  target_title: string;
  target_role_family?: string | null;
  canvas: CanvasLike;
  resume_content?: unknown;
  openai_resume_content?: unknown;
  sample_title?: string | null;
  content_source?: "openai" | "deterministic_pack" | "unknown" | null;
  pack_family?: string | null;
}): RoleTargetIntegrityResult {
  const structured = extractStructuredRoleTitle({
    resume_content: input.resume_content,
    openai_resume_content: input.openai_resume_content,
    sample_title: input.sample_title,
  });
  const rendered = extractRenderedProfessionalRole(input.canvas);
  return evaluateRoleTargetIntegrity({
    target_title: input.target_title,
    target_role_family: input.target_role_family,
    structured_role: structured,
    rendered_role: rendered,
    content_source: input.content_source,
    pack_family: input.pack_family,
  });
}

export function auditRolePackCoverage(roleFamilies: string[]): {
  total: number;
  exact_pack_covered: string[];
  explicit_alias_covered: string[];
  missing_role_content: string[];
} {
  const packs = new Set(listDeterministicPackFamilies());
  const exact: string[] = [];
  const alias: string[] = [];
  const missing: string[] = [];
  for (const raw of roleFamilies) {
    const key = normalizeRoleKey(raw);
    const resolved = resolveDeterministicPackFamily(key);
    if (resolved.match === "EXACT" && resolved.pack && packs.has(resolved.pack)) {
      exact.push(key);
    } else if (resolved.match === "ALIAS" && resolved.pack) {
      alias.push(key);
    } else {
      missing.push(key);
    }
  }
  return {
    total: roleFamilies.length,
    exact_pack_covered: exact,
    explicit_alias_covered: alias,
    missing_role_content: missing,
  };
}
