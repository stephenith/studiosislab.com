/**
 * Write Founder preference memory from decisions — fail-open caller responsibility.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { FounderDecision } from "../founder-decisions/types.js";
import {
  classifyIssueType,
  isGenericRejection,
  isMeaningfulFeedback,
  normalizeRuleText,
  signalTypeForChangeRequest,
} from "./FounderPreferenceNormalizer.js";
import {
  FounderPreferenceMemoryStore,
  bumpConfidence,
} from "./FounderPreferenceMemoryStore.js";
import type {
  CandidateEnrichment,
  MemoryScope,
  FounderPreferenceMemoryRecord,
} from "./FounderPreferenceMemoryTypes.js";

function readJson(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parentFromRevisedCandidateId(candidateId: string): string | null {
  const idx = candidateId.indexOf("-revfb-");
  if (idx <= 0) return null;
  return candidateId.slice(0, idx);
}

function extractFamilyFromObjective(objective: string | null): {
  design_family: string | null;
  architecture: string | null;
} {
  if (!objective) return { design_family: null, architecture: null };
  const fam = objective.match(/design_family\s*[:=]\s*([a-z_]+)/i);
  const arch = objective.match(
    /\b(header_band|classic_single|compact_corporate|editorial_offset|narrow_ats_sidebar|technical_grid|section_index|wide_header_single)\b/i,
  );
  return {
    design_family: fam?.[1]?.toLowerCase() ?? null,
    architecture: arch?.[1]?.toLowerCase() ?? null,
  };
}

export function enrichFromCandidateArtifacts(
  repoRoot: string,
  candidateId: string | null,
): CandidateEnrichment {
  const empty: CandidateEnrichment = {
    candidate_id: candidateId,
    role: null,
    category: null,
    role_family: null,
    design_family: null,
    architecture: null,
    parent_candidate_id: candidateId
      ? parentFromRevisedCandidateId(candidateId)
      : null,
    is_revised: Boolean(candidateId && candidateId.includes("-revfb-")),
  };
  if (!candidateId) return empty;

  const dir = join(
    repoRoot,
    "SOS/07_LOGS/saios/first-production-cycle/candidates",
    candidateId,
  );
  const candidate = readJson(join(dir, "candidate.json"));
  const target =
    readJson(join(dir, "production-target.json")) ??
    ((candidate?.target as Record<string, unknown> | undefined) ?? null);
  const brief = readJson(join(dir, "designbrief.json"));
  const template = readJson(join(dir, "resume-template.json"));

  const role =
    (typeof target?.title === "string" && target.title) ||
    (typeof (candidate?.target as { title?: string } | undefined)?.title ===
      "string" &&
      (candidate?.target as { title: string }).title) ||
    null;
  const category =
    (typeof target?.category === "string" && target.category) ||
    (typeof (candidate?.target as { category?: string } | undefined)?.category ===
      "string" &&
      (candidate?.target as { category: string }).category) ||
    null;
  const role_family =
    (typeof target?.role_family === "string" && target.role_family) ||
    (typeof (candidate?.target as { role_family?: string } | undefined)
      ?.role_family === "string" &&
      (candidate?.target as { role_family: string }).role_family) ||
    null;

  const colors = (brief?.colors as { id?: string } | undefined) ?? undefined;
  const vg =
    (brief?.visual_guidance as Record<string, unknown> | undefined) ??
    undefined;
  const objective =
    typeof target?.objective === "string"
      ? target.objective
      : typeof (candidate?.target as { objective?: string } | undefined)
            ?.objective === "string"
        ? (candidate?.target as { objective: string }).objective
        : null;
  const fromObj = extractFamilyFromObjective(objective);

  let design_family =
    fromObj.design_family ||
    (typeof colors?.id === "string"
      ? colors.id.replace(/^family-/, "")
      : null) ||
    (typeof template?.design_family === "string"
      ? (template.design_family as string)
      : null);

  let architecture =
    fromObj.architecture ||
    (typeof vg?.layout_architecture === "string"
      ? (vg.layout_architecture as string)
      : null) ||
    (typeof vg?.architecture === "string" ? (vg.architecture as string) : null);

  return {
    ...empty,
    role,
    category,
    role_family,
    design_family: design_family ? String(design_family).toLowerCase() : null,
    architecture: architecture ? String(architecture).toLowerCase() : null,
  };
}

export function chooseScope(enrichment: CandidateEnrichment): MemoryScope | null {
  if (enrichment.architecture) return "ARCHITECTURE";
  if (enrichment.design_family) return "DESIGN_FAMILY";
  if (enrichment.category) return "CATEGORY";
  if (enrichment.role) return "ROLE";
  return null;
}

function resolveCandidateId(decision: FounderDecision): string | null {
  const sf = decision.structured_feedback ?? {};
  if (typeof sf.candidate_id === "string" && sf.candidate_id.trim()) {
    return sf.candidate_id.trim();
  }
  return null;
}

export type WriteFromDecisionResult = {
  ok: boolean;
  written: FounderPreferenceMemoryRecord[];
  skipped_reason?: string;
  error?: string;
};

export class FounderPreferenceWriter {
  private readonly store: FounderPreferenceMemoryStore;

  constructor(
    private readonly repoRoot: string = resolve(
      import.meta.dirname,
      "../../../..",
    ),
  ) {
    this.store = new FounderPreferenceMemoryStore(this.repoRoot);
  }

  writeFromDecision(decision: FounderDecision): WriteFromDecisionResult {
    if (decision.fixture) {
      return { ok: true, written: [], skipped_reason: "fixture" };
    }

    const candidate_id = resolveCandidateId(decision);
    const enrichment = enrichFromCandidateArtifacts(this.repoRoot, candidate_id);
    const written: FounderPreferenceMemoryRecord[] = [];

    if (decision.decision === "CHANGES_REQUESTED") {
      const lines =
        decision.requested_changes?.length > 0
          ? decision.requested_changes
          : [decision.reason];
      for (const line of lines) {
        if (!isMeaningfulFeedback(line)) continue;
        const scope = chooseScope(enrichment);
        if (!scope) {
          this.store.appendEvent({
            type: "MEMORY_SKIPPED",
            decision_id: decision.decision_id,
            review_id: decision.review_id,
            detail: "No meaningful scope for REQUEST_CHANGES line",
          });
          continue;
        }
        const issue_type = classifyIssueType(line);
        const normalized_rule = normalizeRuleText(line);
        const signal_type = signalTypeForChangeRequest(issue_type);
        written.push(
          this.store.upsertActive({
            scope,
            issue_type,
            normalized_rule,
            raw_founder_feedback: line.trim(),
            signal_type,
            confidence: "low",
            status: "PROVISIONAL",
            candidate_id: enrichment.candidate_id,
            review_id: decision.review_id,
            decision_id: decision.decision_id,
            revision_task_id: null,
            role: enrichment.role,
            category: enrichment.category,
            role_family: enrichment.role_family,
            design_family: enrichment.design_family,
            architecture: enrichment.architecture,
            section: null,
            component: null,
            positive_or_negative: "negative",
            source_decision: "CHANGES_REQUESTED",
            acceptance_result: "pending",
            active: true,
            confidence_merge: true,
          }),
        );
      }
      return { ok: true, written };
    }

    if (decision.decision === "APPROVED") {
      // Promote provisional rules when revised lineage is proven (revfb parent).
      if (enrichment.is_revised && enrichment.parent_candidate_id) {
        const provisional = this.store.findProvisionalForParent(
          enrichment.parent_candidate_id,
        );
        for (const prev of provisional) {
          written.push(
            this.store.upsertActive({
              scope: prev.scope,
              issue_type: prev.issue_type,
              normalized_rule: prev.normalized_rule,
              raw_founder_feedback: prev.raw_founder_feedback,
              signal_type: prev.signal_type,
              confidence: bumpConfidence(prev.confidence),
              status: "CONFIRMED",
              candidate_id: enrichment.candidate_id,
              review_id: decision.review_id,
              decision_id: decision.decision_id,
              revision_task_id: null,
              role: prev.role ?? enrichment.role,
              category: prev.category ?? enrichment.category,
              role_family: prev.role_family ?? enrichment.role_family,
              design_family: prev.design_family ?? enrichment.design_family,
              architecture: prev.architecture ?? enrichment.architecture,
              section: prev.section,
              component: prev.component,
              positive_or_negative: prev.positive_or_negative,
              source_decision: "APPROVED",
              acceptance_result: "accepted",
              active: true,
              created_at: prev.created_at,
              confidence_merge: false,
            }),
          );
        }
      }

      // Positive exemplar — never invent a textual design rule from boilerplate.
      const scope =
        enrichment.design_family
          ? ("DESIGN_FAMILY" as const)
          : enrichment.architecture
            ? ("ARCHITECTURE" as const)
            : enrichment.category
              ? ("CATEGORY" as const)
              : enrichment.role
                ? ("ROLE" as const)
                : null;
      if (!scope) {
        this.store.appendEvent({
          type: "MEMORY_SKIPPED",
          decision_id: decision.decision_id,
          review_id: decision.review_id,
          detail: "APPROVED without enrichable scope for exemplar",
        });
        return { ok: true, written };
      }
      written.push(
        this.store.upsertActive({
          scope,
          issue_type: "EXEMPLAR",
          normalized_rule: "Founder approved this exemplar.",
          raw_founder_feedback: decision.reason || "APPROVED",
          signal_type: "POSITIVE_EXEMPLAR",
          confidence: "medium",
          status: "CONFIRMED",
          candidate_id: enrichment.candidate_id,
          review_id: decision.review_id,
          decision_id: decision.decision_id,
          revision_task_id: null,
          role: enrichment.role,
          category: enrichment.category,
          role_family: enrichment.role_family,
          design_family: enrichment.design_family,
          architecture: enrichment.architecture,
          section: null,
          component: null,
          positive_or_negative: "positive",
          source_decision: "APPROVED",
          acceptance_result: "accepted",
          active: true,
          confidence_merge: true,
        }),
      );
      return { ok: true, written };
    }

    if (decision.decision === "REJECTED") {
      const scope =
        enrichment.architecture
          ? ("ARCHITECTURE" as const)
          : enrichment.design_family
            ? ("DESIGN_FAMILY" as const)
            : enrichment.category
              ? ("CATEGORY" as const)
              : enrichment.role
                ? ("ROLE" as const)
                : null;
      if (!scope) {
        this.store.appendEvent({
          type: "MEMORY_SKIPPED",
          decision_id: decision.decision_id,
          review_id: decision.review_id,
          detail: "REJECTED without enrichable scope",
        });
        return { ok: true, written };
      }

      const reason = decision.reason || "";
      const generic = isGenericRejection(reason);
      written.push(
        this.store.upsertActive({
          scope,
          issue_type: generic ? "OTHER" : classifyIssueType(reason),
          normalized_rule: generic
            ? "Founder rejected this exemplar."
            : normalizeRuleText(reason),
          raw_founder_feedback: reason || "REJECTED",
          signal_type: "NEGATIVE_EXEMPLAR",
          confidence: "medium",
          status: "CONFIRMED",
          candidate_id: enrichment.candidate_id,
          review_id: decision.review_id,
          decision_id: decision.decision_id,
          revision_task_id: null,
          role: enrichment.role,
          category: enrichment.category,
          role_family: enrichment.role_family,
          design_family: enrichment.design_family,
          architecture: enrichment.architecture,
          section: null,
          component: null,
          positive_or_negative: "negative",
          source_decision: "REJECTED",
          acceptance_result: "rejected",
          active: true,
          confidence_merge: true,
        }),
      );

      // Optional scoped CONSTRAINT when rejection has a clear design instruction.
      if (!generic && isMeaningfulFeedback(reason)) {
        const issue_type = classifyIssueType(reason);
        if (issue_type !== "OTHER") {
          written.push(
            this.store.upsertActive({
              scope,
              issue_type,
              normalized_rule: normalizeRuleText(reason),
              raw_founder_feedback: reason,
              signal_type: "CONSTRAINT",
              confidence: "medium",
              status: "CONFIRMED",
              candidate_id: enrichment.candidate_id,
              review_id: decision.review_id,
              decision_id: decision.decision_id,
              revision_task_id: null,
              role: enrichment.role,
              category: enrichment.category,
              role_family: enrichment.role_family,
              design_family: enrichment.design_family,
              architecture: enrichment.architecture,
              section: null,
              component: null,
              positive_or_negative: "negative",
              source_decision: "REJECTED",
              acceptance_result: "rejected",
              active: true,
              confidence_merge: true,
            }),
          );
        }
      }
      return { ok: true, written };
    }

    return { ok: true, written: [], skipped_reason: "unknown_decision" };
  }
}

/** Fail-open helper for FounderDecisionManager. */
export function writeFounderPreferenceMemorySafe(
  decision: FounderDecision,
  repoRoot?: string,
): WriteFromDecisionResult {
  try {
    const writer = new FounderPreferenceWriter(
      repoRoot ?? resolve(import.meta.dirname, "../../../.."),
    );
    return writer.writeFromDecision(decision);
  } catch (err) {
    try {
      const store = new FounderPreferenceMemoryStore(repoRoot);
      store.appendEvent({
        type: "MEMORY_WRITE_FAILED",
        decision_id: decision.decision_id,
        review_id: decision.review_id,
        detail: err instanceof Error ? err.message : String(err),
      });
    } catch {
      // ignore secondary failures
    }
    return {
      ok: false,
      written: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
