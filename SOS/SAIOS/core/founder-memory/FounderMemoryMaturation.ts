/**
 * Phase 6C — Outcome-aware Founder Memory maturation.
 * Promotion is rule-specific and evidence-based. Failed revisions, repeated
 * unresolved feedback, factual/one-off content, and uncertain attribution
 * never become trusted reusable design memory.
 */
import {
  isLayoutDesignConstraintText,
} from "./FounderMemoryConsumption.js";
import { classifyIssueType } from "./FounderPreferenceNormalizer.js";
import type {
  FounderPreferenceMemoryRecord,
  MemoryScope,
} from "./FounderPreferenceMemoryTypes.js";

export type MaturationVerdict =
  | "PROMOTABLE"
  | "KEEP_PROVISIONAL"
  | "SUPERSEDE"
  | "INSUFFICIENT_EVIDENCE";

export type RevisionOutcomeKind = "SUCCESS" | "FAIL" | "NONE";
export type LaterFounderOutcomeKind =
  | "APPROVE"
  | "REQUEST_CHANGES"
  | "REJECT"
  | "NONE";

export type MaturationEvidence = {
  revision_outcome: RevisionOutcomeKind;
  later_founder_outcome: LaterFounderOutcomeKind;
  /** Same Founder issue still requested after the revision. */
  same_issue_persists: boolean;
  /** Rule can be mapped to the feedback item / revision / later outcome. */
  attribution_certain: boolean;
  later_request_texts?: string[];
};

export type MaturationEvaluation = {
  verdict: MaturationVerdict;
  reason: string;
};

const FACTUAL_RE =
  /\b(aws|azure|gcp|certification|certified|bachelor|master'?s|phd|degree|gpa|employer|worked at|years? of experience|\d+\+?\s*years|salary|revenue of \$|increased sales by \d+|linkedin\.com\/in\/)\b/i;

const ONE_OFF_RE =
  /\b(this template|this resume only|change the name to|replace .+ with|candidate name|add my|use my)\b/i;

export function isFactualOrOneOffContent(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (FACTUAL_RE.test(t)) return true;
  if (ONE_OFF_RE.test(t)) return true;
  if (classifyIssueType(t) === "CONTENT_INTEGRITY") return true;
  return false;
}

/**
 * Rendering invariants that hold for every resume regardless of design family,
 * layout architecture, role or section.
 */
const UNIVERSAL_LAYOUT_INVARIANT_RE =
  /\b(must not|never|no|avoid|prevent|without|ensure no|do not)\b[\s\S]{0,40}\b(overlap|overlapp|collide|collision|clip|clipped|clipping|truncat|cut off|out[- ]of[- ]bounds|off[- ]page|outside the page|exceed(s)? (its|the) (text ?box|bounds|page))\b/i;

const POSITIVE_SEPARATION_RE =
  /\b(maintain|keep|ensure|preserve|require)\b[\s\S]{0,40}\b(positive (separation|spacing|gap)|non-?overlapping|minimum (separation|spacing|gap)|clear separation)\b/i;

/**
 * Tokens that tie a rule to one architecture, family, lane, section or role.
 * Their presence means the rule is NOT architecture-independent.
 */
const SCOPE_SPECIFIC_TOKEN_RE =
  /\b(sidebar|two[- ]column|single[- ]column|multi[- ]column|left column|right column|header band|lane|narrow_ats|professional_sidebar|summary|experience|skills|projects|certifications|education|languages|manager|analyst|engineer|designer|accountant)\b/i;

/**
 * True when a confirmed Founder rule is an unambiguously architecture-independent
 * rendering invariant (no overlap, no clipping, no out-of-bounds text, positive
 * separation) and therefore eligible for GLOBAL scope.
 *
 * Fail closed: factual/one-off content and anything naming a specific
 * architecture, family, lane, section or role is never universal.
 */
export function isUniversalLayoutInvariantRule(text: string): boolean {
  const t = String(text ?? "").trim();
  if (!t) return false;
  if (isFactualOrOneOffContent(t)) return false;
  if (SCOPE_SPECIFIC_TOKEN_RE.test(t)) return false;
  return UNIVERSAL_LAYOUT_INVARIANT_RE.test(t) || POSITIVE_SEPARATION_RE.test(t);
}

/**
 * Scope for a rule being confirmed.
 *
 * Universal rendering invariants widen to GLOBAL at confirmation time so they
 * reach every future generation instead of staying trapped at the architecture
 * of the one template that produced them. Everything else keeps its original
 * scope. Applies to newly confirmed rules only — historical rows are immutable.
 */
export function resolveConfirmedMemoryScope(input: {
  currentScope: MemoryScope;
  normalized_rule: string | null;
  raw_founder_feedback: string | null;
}): MemoryScope {
  if (input.currentScope === "GLOBAL") return "GLOBAL";
  const text = input.normalized_rule?.trim() || input.raw_founder_feedback?.trim() || "";
  return isUniversalLayoutInvariantRule(text) ? "GLOBAL" : input.currentScope;
}

export function sameIssuePersists(
  rule: FounderPreferenceMemoryRecord,
  laterRequests: string[],
): boolean {
  if (!laterRequests.length) return false;
  const needle = (rule.normalized_rule || rule.raw_founder_feedback || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 80);
  if (needle.length < 12) return false;
  const tokens = needle.split(" ").filter((w) => w.length > 3);
  if (tokens.length < 2) return false;
  return laterRequests.some((req) => {
    const r = req.toLowerCase();
    const hits = tokens.filter((t) => r.includes(t)).length;
    return hits >= Math.min(3, tokens.length);
  });
}

export function evaluateMemoryMaturation(
  rec: FounderPreferenceMemoryRecord,
  evidence: MaturationEvidence,
): MaturationEvaluation {
  const text = rec.normalized_rule || rec.raw_founder_feedback || "";

  if (isFactualOrOneOffContent(text) || !isLayoutDesignConstraintText(text)) {
    return {
      verdict: "KEEP_PROVISIONAL",
      reason:
        "factual or one-off / non-layout content cannot mature as reusable design memory",
    };
  }

  if (rec.status === "SUPERSEDED" || rec.superseded_by) {
    return { verdict: "SUPERSEDE", reason: "already superseded" };
  }

  if (evidence.later_founder_outcome === "REJECT") {
    return {
      verdict: "SUPERSEDE",
      reason: "later Founder REJECT prevents or supersedes unsafe memory",
    };
  }

  if (evidence.revision_outcome === "FAIL") {
    return {
      verdict: "KEEP_PROVISIONAL",
      reason: "failed revision cannot confirm memory",
    };
  }

  if (evidence.same_issue_persists) {
    return {
      verdict: "KEEP_PROVISIONAL",
      reason:
        "Founder requested the same change again — prior implementation is not confirmed",
    };
  }

  if (evidence.later_founder_outcome === "REQUEST_CHANGES") {
    return {
      verdict: "KEEP_PROVISIONAL",
      reason: "later REQUEST CHANGES is not confirmation",
    };
  }

  if (evidence.revision_outcome === "NONE") {
    return {
      verdict: "INSUFFICIENT_EVIDENCE",
      reason: "no revision outcome to attribute",
    };
  }

  if (evidence.later_founder_outcome === "NONE") {
    return {
      verdict: "KEEP_PROVISIONAL",
      reason: "technical revision success alone is not Founder approval",
    };
  }

  if (!evidence.attribution_certain) {
    return {
      verdict: "INSUFFICIENT_EVIDENCE",
      reason: "cannot truthfully attribute this rule to the later outcome",
    };
  }

  if (
    evidence.revision_outcome === "SUCCESS" &&
    evidence.later_founder_outcome === "APPROVE"
  ) {
    return {
      verdict: "PROMOTABLE",
      reason:
        "successful revision plus later Founder APPROVE of the corrected result",
    };
  }

  return {
    verdict: "INSUFFICIENT_EVIDENCE",
    reason: "outcome combination is not sufficient to mature this rule",
  };
}

/**
 * Historical records without a linked successful revision + later APPROVE
 * stay untouched. This classifier never mutates persisted state.
 */
export function classifyHistoricalMemory(
  rec: FounderPreferenceMemoryRecord,
): MaturationEvaluation {
  if (rec.status === "CONFIRMED") {
    return { verdict: "KEEP_PROVISIONAL", reason: "already CONFIRMED" };
  }
  if (rec.status === "SUPERSEDED") {
    return { verdict: "SUPERSEDE", reason: "already SUPERSEDED" };
  }
  const text = rec.normalized_rule || rec.raw_founder_feedback || "";
  if (isFactualOrOneOffContent(text)) {
    return {
      verdict: "KEEP_PROVISIONAL",
      reason: "factual/one-off — never historically promotable as design memory",
    };
  }
  if (rec.acceptance_result === "pending" || !rec.revision_task_id) {
    return {
      verdict: "INSUFFICIENT_EVIDENCE",
      reason:
        "no linked revision-task outcome + later Founder APPROVE attribution",
    };
  }
  return {
    verdict: "INSUFFICIENT_EVIDENCE",
    reason: "historical linkage is not deterministic enough to mutate",
  };
}
