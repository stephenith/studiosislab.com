/**
 * Phase 6I — revision-path professional role-target proof.
 *
 * Generation keeps evaluateRoleTargetIntegrity / evaluateCanvasRoleTargetIntegrity
 * (structured + rendered, fail-closed). Revision does not have
 * openai-resume-content.json, so this evaluator uses only revision-native
 * evidence: canonical target role, rendered title, requested section content,
 * replacement completeness, and source-role residue.
 *
 * Deterministic. No LLM. Do not synthesize generation structured JSON.
 * Intentionally does not import RevisionAcceptanceChecks (avoids a cycle).
 */
import {
  extractRenderedProfessionalRole,
  rolesAreCompatible,
  canonicalRoleKey,
} from "./RoleTargetIntegrity.js";
import {
  classifyRequestedChange,
  verificationCheckTypes,
} from "../founder-revision/RequestedChangeClassification.js";
import type { FabricCanvasDoc } from "../founder-revision/CanvasInventory.js";
import type { RevisionPlan } from "../founder-revision/revision-task-types.js";
import { resolveRevisionIntentScope } from "../founder-revision/RevisionIntentScope.js";
import type { SectionReplacementCompletenessReport } from "../founder-revision/SectionReplacementCompleteness.js";

export type ContentSectionKey =
  | "job_title"
  | "summary"
  | "experience"
  | "skills"
  | "projects"
  | "certifications"
  | "education";

export type RevisionRoleMatchKind =
  | "ROLE_MATCH"
  | "ROLE_COMPATIBLE_ALIAS"
  | "ROLE_MISMATCH"
  | "ROLE_CONTENT_INCOMPLETE"
  | "ROLE_UNEVALUABLE";

export type RevisionIncompleteFinding = {
  object_ids: string[];
  message?: string;
};

export type RevisionRoleTargetIntegrityResult = {
  schema_version: "revision-role-target-integrity-1.0.0";
  proof_kind: "REVISION";
  pass: boolean;
  evaluable: boolean;
  match: RevisionRoleMatchKind;
  reason: string;
  target_role: string;
  target_normalized: string;
  rendered_title_role: string | null;
  rendered_title_normalized: string | null;
  requested_role_sections: ContentSectionKey[];
  requested_role_sections_complete: boolean | null;
  source_role_identities: string[];
  source_role_residue: string[];
  residue_object_ids: string[];
  evaluated_at: string;
};

const ROLE_PROOF_BODY_NOUNS: ReadonlyArray<readonly [ContentSectionKey, RegExp]> =
  [
    ["summary", /\b(summary|professional summary)\b/i],
    ["experience", /\b(experience|employment history|work history)\b/i],
    ["skills", /\bskills?\b/i],
    ["projects", /\bprojects?\b/i],
    ["certifications", /\b(certifications?|credentials?)\b/i],
    ["education", /\b(education|qualifications?)\b/i],
  ];

const CONTACT_TEXT_SIGNAL =
  /(@|https?:\/\/|linkedin\.com|github\.com|\+\d[\d\s()-]{6,}|\b\d{3}[)\s-]\s?\d{3}[\s-]\d{4}\b)/i;
const DATE_ONLY_TEXT_RE =
  /^(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?\d{4}(?:\s*[—–\-]\s*(?:present|\d{4}))?$/i;

type CanvasLike = FabricCanvasDoc | { objects?: unknown[] } | null | undefined;

function canvasObjects(canvas: CanvasLike): Array<Record<string, unknown>> {
  if (!canvas || typeof canvas !== "object") return [];
  const objs = (canvas as { objects?: unknown }).objects;
  return Array.isArray(objs) ? (objs as Array<Record<string, unknown>>) : [];
}

function objectId(o: Record<string, unknown>, index: number): string {
  if (typeof o.id === "string" && o.id.trim()) return o.id.trim();
  const data = o.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const id = (data as { id?: unknown }).id;
    if (typeof id === "string" && id.trim()) return id.trim();
  }
  return `obj-${index}`;
}

function objectText(o: Record<string, unknown>): string {
  return typeof o.text === "string" ? o.text : "";
}

function objectSection(o: Record<string, unknown>): string {
  const data = o.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const s = (data as { section?: unknown }).section;
    if (typeof s === "string" && s.trim()) return s.trim().toLowerCase();
  }
  return typeof o.section === "string" ? o.section.trim().toLowerCase() : "";
}

function objectRole(o: Record<string, unknown>): string {
  const data = o.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const r = (data as { role?: unknown }).role;
    if (typeof r === "string" && r.trim()) return r.trim().toLowerCase();
  }
  return typeof o.role === "string" ? o.role.trim().toLowerCase() : "";
}

function isTextLike(o: Record<string, unknown>): boolean {
  const t = String(o.type ?? "").toLowerCase();
  return t.includes("text");
}

function looksLikeHeading(text: string, section: string): boolean {
  const letters = text.replace(/[^A-Za-z]/g, "");
  if (!letters) return false;
  if (letters.toUpperCase() === section.replace(/[^A-Za-z]/g, "").toUpperCase()) {
    return true;
  }
  return text.trim().length <= 30 && letters === letters.toUpperCase();
}

function canvasHasSectionMetadata(canvas: CanvasLike): boolean {
  return canvasObjects(canvas).some((o) => objectSection(o).length > 0);
}

function mutationContentSections(requested_changes: string[]): Set<ContentSectionKey> {
  return new Set(
    resolveRevisionIntentScope(requested_changes).content_mutation_sections,
  );
}

/**
 * Professional body sections the Founder actually asked to role-correct.
 * Languages, candidate name, and contact are never in this set.
 */
export function resolveRequestedRoleProofSections(
  requested_changes: string[],
): Set<ContentSectionKey> {
  const out = mutationContentSections(requested_changes);
  for (const change of requested_changes) {
    const classified = classifyRequestedChange(change);
    if (
      classified.classification === "VERIFICATION_ACCEPTANCE" &&
      verificationCheckTypes(classified).includes("ROLE_TARGET_INTEGRITY")
    ) {
      for (const [key, re] of ROLE_PROOF_BODY_NOUNS) {
        if (re.test(change)) out.add(key);
      }
    }
  }
  return out;
}

function identityObjectIds(canvas: CanvasLike): Set<string> {
  const protectedIds = new Set<string>();
  const headerTexts: { id: string; text: string; fontSize: number }[] = [];
  canvasObjects(canvas).forEach((o, index) => {
    if (!isTextLike(o)) return;
    const text = objectText(o);
    if (!text.trim()) return;
    const id = objectId(o, index);
    if (CONTACT_TEXT_SIGNAL.test(text) || objectSection(o) === "contact") {
      protectedIds.add(id);
      return;
    }
    if (objectSection(o) === "header") {
      headerTexts.push({
        id,
        text,
        fontSize: typeof o.fontSize === "number" ? o.fontSize : 0,
      });
    }
  });
  const names = headerTexts.filter((t) => !CONTACT_TEXT_SIGNAL.test(t.text));
  if (names.length > 0) {
    const maxFont = Math.max(...names.map((t) => t.fontSize));
    for (const t of names) {
      if (t.fontSize === maxFont) protectedIds.add(t.id);
    }
  }
  return protectedIds;
}

function roleProofBodyObjectIds(
  canvas: CanvasLike,
  sections: Set<ContentSectionKey>,
): Set<string> {
  const allowed = new Set<string>();
  if (sections.size === 0) return allowed;
  canvasObjects(canvas).forEach((o, index) => {
    if (!isTextLike(o)) return;
    const text = objectText(o);
    if (!text.trim()) return;
    const section = objectSection(o);
    if (!sections.has(section as ContentSectionKey)) return;
    if (objectRole(o) === "heading" || looksLikeHeading(text, section)) return;
    allowed.add(objectId(o, index));
  });
  for (const id of identityObjectIds(canvas)) allowed.delete(id);
  return allowed;
}

/**
 * Source professional identities named by Founder rewrite lines or the
 * prior-canvas rendered title. Not a generic banned-word list.
 */
export function extractSourceRoleIdentities(input: {
  requested_changes: string[];
  beforeCanvas?: CanvasLike;
  target_role: string;
}): string[] {
  const found: string[] = [];
  for (const change of input.requested_changes) {
    const fromTo = change.match(
      /\bfrom\s+(.+?)\s+to\s+(.+?)(?:\s+while|\s*[.,;]|$)/i,
    );
    if (fromTo?.[1]) found.push(fromTo[1].trim());
    const replaceAll = change.match(
      /replace all\s+(.+?)\s+experience content/i,
    );
    if (replaceAll?.[1]) {
      for (const part of replaceAll[1].split(/\s*,\s*|\s+and\s+/i)) {
        const ident = part.trim();
        if (ident) found.push(ident);
      }
    }
  }
  const priorTitle = extractRenderedProfessionalRole(
    input.beforeCanvas as { objects?: unknown[] } | null | undefined,
  );
  if (priorTitle) found.push(priorTitle);

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const raw of found) {
    const ident = raw.replace(/\s+/g, " ").trim();
    if (ident.length < 4) continue;
    const key = ident.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (rolesAreCompatible(ident, input.target_role).ok) continue;
    unique.push(ident);
  }
  return unique;
}

function identityRegex(identity: string): RegExp {
  const esc = identity.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${esc}\\b`, "i");
}

function scanSourceRoleResidue(input: {
  afterCanvas: CanvasLike;
  sections: Set<ContentSectionKey>;
  identities: string[];
}): { residue: string[]; object_ids: string[] } {
  if (input.identities.length === 0 || input.sections.size === 0) {
    return { residue: [], object_ids: [] };
  }
  const protectedIds = identityObjectIds(input.afterCanvas);
  const bodyIds = roleProofBodyObjectIds(input.afterCanvas, input.sections);
  const byId = new Map<string, string>();
  canvasObjects(input.afterCanvas).forEach((o, i) => {
    byId.set(objectId(o, i), objectText(o));
  });
  const residue: string[] = [];
  const object_ids: string[] = [];
  const seenIdent = new Set<string>();
  for (const id of bodyIds) {
    if (protectedIds.has(id)) continue;
    const text = byId.get(id) ?? "";
    if (!text.trim()) continue;
    for (const ident of input.identities) {
      if (!identityRegex(ident).test(text)) continue;
      if (!seenIdent.has(ident.toLowerCase())) {
        seenIdent.add(ident.toLowerCase());
        residue.push(ident);
      }
      if (!object_ids.includes(id)) object_ids.push(id);
    }
  }
  return { residue, object_ids };
}

function planUpdatedIds(plan: RevisionPlan | null | undefined): Set<string> {
  const updated = new Set<string>();
  if (!plan) return updated;
  for (const op of plan.operations) {
    if (op.op !== "update_text") continue;
    if (op.target_id) updated.add(op.target_id);
    for (const id of op.target_ids ?? []) updated.add(id);
  }
  return updated;
}

function findIncompleteFromPlan(input: {
  canvas: CanvasLike;
  plan: RevisionPlan;
  sections: Set<ContentSectionKey>;
}): string[] {
  const required = roleProofBodyObjectIds(input.canvas, input.sections);
  const updated = planUpdatedIds(input.plan);
  const missing: string[] = [];
  const byId = new Map<string, string>();
  canvasObjects(input.canvas).forEach((o, i) => {
    byId.set(objectId(o, i), objectText(o).trim());
  });
  for (const id of required) {
    if (updated.has(id)) continue;
    const text = byId.get(id) ?? "";
    if (!text) continue;
    if (DATE_ONLY_TEXT_RE.test(text)) continue;
    missing.push(id);
  }
  return missing;
}

function baseResult(input: {
  target_role: string;
  target_normalized: string;
  rendered: string | null;
  sections: ContentSectionKey[];
  complete: boolean | null;
  identities: string[];
  residue: string[];
  residue_object_ids: string[];
  pass: boolean;
  evaluable: boolean;
  match: RevisionRoleMatchKind;
  reason: string;
}): RevisionRoleTargetIntegrityResult {
  return {
    schema_version: "revision-role-target-integrity-1.0.0",
    proof_kind: "REVISION",
    pass: input.pass,
    evaluable: input.evaluable,
    match: input.match,
    reason: input.reason,
    target_role: input.target_role,
    target_normalized: input.target_normalized,
    rendered_title_role: input.rendered,
    rendered_title_normalized: input.rendered
      ? canonicalRoleKey(input.rendered)
      : null,
    requested_role_sections: input.sections,
    requested_role_sections_complete: input.complete,
    source_role_identities: input.identities,
    source_role_residue: input.residue,
    residue_object_ids: input.residue_object_ids,
    evaluated_at: new Date().toISOString(),
  };
}

function preservedIdsFromReplacement(
  report: SectionReplacementCompletenessReport | null | undefined,
): Set<string> {
  const ids = new Set<string>();
  if (!report) return ids;
  for (const section of report.sections) {
    for (const account of section.accounts) {
      if (
        account.disposition === "EXPLICITLY_PRESERVED" ||
        account.disposition === "REPLACED" ||
        account.disposition === "REMOVED"
      ) {
        ids.add(account.object_id);
      }
    }
  }
  return ids;
}

export function evaluateRevisionRoleTargetIntegrity(input: {
  target_role: string | null | undefined;
  afterCanvas?: CanvasLike;
  beforeCanvas?: CanvasLike;
  requested_changes?: string[];
  plan?: RevisionPlan | null;
  incomplete_replacement_findings?: RevisionIncompleteFinding[] | null;
  section_replacement?: SectionReplacementCompletenessReport | null;
}): RevisionRoleTargetIntegrityResult {
  const target_role = String(input.target_role ?? "").trim();
  const target_normalized = canonicalRoleKey(target_role);
  const requested_changes = input.requested_changes ?? [];
  const after = input.afterCanvas;
  const before = input.beforeCanvas ?? null;
  const sections = resolveRequestedRoleProofSections(requested_changes);
  const sectionList = [...sections];
  const identities = extractSourceRoleIdentities({
    requested_changes,
    beforeCanvas: before,
    target_role,
  });
  const mutationSections = mutationContentSections(requested_changes);

  const empty = {
    target_role,
    target_normalized,
    rendered: null as string | null,
    sections: sectionList,
    complete: null as boolean | null,
    identities,
    residue: [] as string[],
    residue_object_ids: [] as string[],
  };

  if (!target_normalized) {
    return baseResult({
      ...empty,
      pass: false,
      evaluable: false,
      match: "ROLE_UNEVALUABLE",
      reason: "target professional role missing",
    });
  }
  if (canvasObjects(after).length === 0) {
    return baseResult({
      ...empty,
      pass: false,
      evaluable: false,
      match: "ROLE_UNEVALUABLE",
      reason: "revision rendered canvas missing",
    });
  }

  const rendered = extractRenderedProfessionalRole(after);
  if (!rendered) {
    return baseResult({
      ...empty,
      pass: false,
      evaluable: false,
      match: "ROLE_UNEVALUABLE",
      reason: "rendered header professional role missing",
    });
  }

  if (sections.size > 0 && !canvasHasSectionMetadata(after)) {
    return baseResult({
      ...empty,
      rendered,
      pass: false,
      evaluable: false,
      match: "ROLE_UNEVALUABLE",
      reason: "revision section metadata missing for requested role-proof sections",
    });
  }

  const titleVsTarget = rolesAreCompatible(target_role, rendered);
  if (!titleVsTarget.ok) {
    return baseResult({
      ...empty,
      rendered,
      pass: false,
      evaluable: true,
      match: "ROLE_MISMATCH",
      reason: `canonical target "${target_role}" mismatches rendered professional title "${rendered}"`,
    });
  }

  let complete: boolean | null = null;
  if (mutationSections.size > 0) {
    if (
      input.incomplete_replacement_findings != null
    ) {
      complete = input.incomplete_replacement_findings.length === 0;
      if (!complete) {
        return baseResult({
          ...empty,
          rendered,
          complete,
          pass: false,
          evaluable: true,
          match: "ROLE_CONTENT_INCOMPLETE",
          reason: `requested professional section replacement incomplete: ${input.incomplete_replacement_findings
            .map((f) => f.object_ids.join(","))
            .join("; ")}`,
        });
      }
    } else if (input.plan) {
      const preserved = preservedIdsFromReplacement(input.section_replacement);
      const missing = findIncompleteFromPlan({
        canvas: before ?? after,
        plan: input.plan,
        sections: mutationSections,
      }).filter((id) => !preserved.has(id));
      complete = missing.length === 0;
      if (!complete) {
        return baseResult({
          ...empty,
          rendered,
          complete,
          pass: false,
          evaluable: true,
          match: "ROLE_CONTENT_INCOMPLETE",
          reason: `requested professional section replacement incomplete: ${missing.join(",")}`,
        });
      }
    } else if (before) {
      const required = roleProofBodyObjectIds(before, mutationSections);
      const afterById = new Map<string, string>();
      canvasObjects(after).forEach((o, i) => {
        afterById.set(objectId(o, i), objectText(o).trim());
      });
      const beforeById = new Map<string, string>();
      canvasObjects(before).forEach((o, i) => {
        beforeById.set(objectId(o, i), objectText(o).trim());
      });
      const preserved = preservedIdsFromReplacement(input.section_replacement);
      const unchanged: string[] = [];
      for (const id of required) {
        if (preserved.has(id)) continue;
        const prev = beforeById.get(id) ?? "";
        const next = afterById.get(id) ?? "";
        if (prev && prev === next && !DATE_ONLY_TEXT_RE.test(prev)) {
          unchanged.push(id);
        }
      }
      complete = unchanged.length === 0;
      if (!complete) {
        return baseResult({
          ...empty,
          rendered,
          complete,
          pass: false,
          evaluable: true,
          match: "ROLE_CONTENT_INCOMPLETE",
          reason: `requested professional section replacement incomplete: ${unchanged.join(",")}`,
        });
      }
    } else {
      return baseResult({
        ...empty,
        rendered,
        pass: false,
        evaluable: false,
        match: "ROLE_UNEVALUABLE",
        reason:
          "section replacement completeness evidence missing (no revision plan or source canvas)",
      });
    }
  } else if (sections.size > 0) {
    complete = true;
  }

  const scanned = scanSourceRoleResidue({
    afterCanvas: after,
    sections,
    identities,
  });
  if (scanned.residue.length > 0) {
    return baseResult({
      ...empty,
      rendered,
      complete,
      residue: scanned.residue,
      residue_object_ids: scanned.object_ids,
      pass: false,
      evaluable: true,
      match: "ROLE_MISMATCH",
      reason: `source-role residue remains in requested sections: ${scanned.residue.join(", ")}`,
    });
  }

  const kind =
    titleVsTarget.kind === "ROLE_COMPATIBLE_ALIAS"
      ? "ROLE_COMPATIBLE_ALIAS"
      : "ROLE_MATCH";
  return baseResult({
    ...empty,
    rendered,
    complete: complete ?? true,
    pass: true,
    evaluable: true,
    match: kind,
    reason:
      kind === "ROLE_COMPATIBLE_ALIAS"
        ? `rendered title and requested professional sections match target "${target_role}" via explicit alias`
        : `rendered title and requested professional sections match target "${target_role}"`,
  });
}
