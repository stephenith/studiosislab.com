/**
 * Current Founder Review actionability / identity overlay.
 *
 * Historical task status remains immutable. This module only affects the
 * current projection: whether a review may receive an ordinary Founder
 * decision (Approve / Request Changes / Reject). Records are data, not
 * hardcoded Resume Template IDs in production logic.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const FOUNDER_REVIEW_ACTIONABILITY_SCHEMA =
  "founder-review-actionability-1.0.0" as const;

export type ActionabilityValidity = "valid" | "audit_invalid";
export type ActionabilityDecision = "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";

export type FounderReviewActionabilityRecord = {
  review_id: string;
  candidate_id: string;
  validity: "AUDIT_INVALID";
  actionability: "NOT_DECISIONABLE";
  historical_task_id?: string;
  historical_task_status_unchanged?: string;
  reason: string;
  recorded_at: string;
  source: "authorized_audit";
};

export type FounderReviewActionabilityOverlay = {
  schema_version: typeof FOUNDER_REVIEW_ACTIONABILITY_SCHEMA;
  records: FounderReviewActionabilityRecord[];
};

export type ReviewIdentity = {
  review_id: string;
  candidate_id: string;
  task_id?: string;
  cycle_id?: string;
};

export type IdentityResolution =
  | { ok: true; identity: ReviewIdentity }
  | { ok: false; error: string };

export const ACTIONABILITY_OVERLAY_REL =
  "SOS/SAIOS/core/founder-review/actionability-overlay.json";

export function loadActionabilityOverlay(
  repoRoot: string,
): FounderReviewActionabilityOverlay {
  const path = join(repoRoot, ACTIONABILITY_OVERLAY_REL);
  if (!existsSync(path)) {
    return { schema_version: FOUNDER_REVIEW_ACTIONABILITY_SCHEMA, records: [] };
  }
  try {
    const raw = JSON.parse(
      readFileSync(path, "utf8"),
    ) as FounderReviewActionabilityOverlay;
    const records = Array.isArray(raw.records) ? raw.records : [];
    return {
      schema_version: FOUNDER_REVIEW_ACTIONABILITY_SCHEMA,
      records: records.filter(
        (r) =>
          typeof r?.review_id === "string" &&
          typeof r?.candidate_id === "string" &&
          r.validity === "AUDIT_INVALID",
      ),
    };
  } catch {
    return { schema_version: FOUNDER_REVIEW_ACTIONABILITY_SCHEMA, records: [] };
  }
}

export function actionabilityRecordFor(
  overlay: FounderReviewActionabilityOverlay,
  identity: Pick<ReviewIdentity, "review_id" | "candidate_id">,
): FounderReviewActionabilityRecord | null {
  return (
    overlay.records.find(
      (r) =>
        r.review_id === identity.review_id ||
        r.candidate_id === identity.candidate_id,
    ) ?? null
  );
}

export function isAuditInvalidReview(
  overlay: FounderReviewActionabilityOverlay,
  identity: Pick<ReviewIdentity, "review_id" | "candidate_id">,
): boolean {
  return actionabilityRecordFor(overlay, identity) != null;
}

/**
 * Ordinary Founder decisions are allowed only when current validity is
 * `valid`. `audit_invalid` is NOT_DECISIONABLE for Approve, Request Changes,
 * and Reject. There is no ordinary-decision exception for Reject.
 */
export function decisionAllowedForValidity(
  validity: ActionabilityValidity,
  _decision: ActionabilityDecision,
): boolean {
  return validity !== "audit_invalid";
}

export function evaluateFounderDecisionActionability(input: {
  overlay: FounderReviewActionabilityOverlay;
  identity: Pick<ReviewIdentity, "review_id" | "candidate_id">;
  projectedValidity?: ActionabilityValidity | null;
  decision: ActionabilityDecision;
}): {
  allowed: boolean;
  validity: ActionabilityValidity;
  reason: string | null;
} {
  const record = actionabilityRecordFor(input.overlay, input.identity);
  const notDecisionable =
    record?.actionability === "NOT_DECISIONABLE" ||
    record != null ||
    input.projectedValidity === "audit_invalid";
  const validity: ActionabilityValidity = notDecisionable
    ? "audit_invalid"
    : "valid";
  const allowed = decisionAllowedForValidity(validity, input.decision);
  return {
    allowed,
    validity,
    reason: allowed
      ? null
      : "This Resume Template is audit-invalid and is not actionable for Approve, Request Changes, or Reject.",
  };
}

export function identitiesBound(a: ReviewIdentity, b: ReviewIdentity): boolean {
  if (a.review_id !== b.review_id) return false;
  if (a.candidate_id !== b.candidate_id) return false;
  if (a.task_id && b.task_id && a.task_id !== b.task_id) return false;
  if (a.cycle_id && b.cycle_id && a.cycle_id !== b.cycle_id) return false;
  return true;
}

/**
 * Resolve a Founder decision to one review identity.
 * Match on review_id. Reject silent rematch when other IDs disagree.
 */
export function resolveFounderDecisionIdentity(input: {
  submitted: ReviewIdentity;
  catalog: ReviewIdentity[];
}): IdentityResolution {
  const submitted = input.submitted;
  if (!submitted.review_id || !submitted.candidate_id) {
    return { ok: false, error: "review_id and candidate_id are required" };
  }
  const rematchForeign = input.catalog.find((c) => {
    if (c.review_id === submitted.review_id) return false;
    return (
      (submitted.task_id && c.task_id === submitted.task_id) ||
      (submitted.cycle_id && c.cycle_id === submitted.cycle_id) ||
      c.candidate_id === submitted.candidate_id
    );
  });
  if (rematchForeign) {
    return {
      ok: false,
      error: "disjoint review identity fields rematch another review",
    };
  }
  const byReview = input.catalog.filter((c) => c.review_id === submitted.review_id);
  if (byReview.length === 0) {
    return {
      ok: true,
      identity: submitted,
    };
  }
  const resolved = byReview[0]!;
  if (resolved.candidate_id !== submitted.candidate_id) {
    return {
      ok: false,
      error:
        "submitted Resume Template ID does not match the selected review identity",
    };
  }
  if (submitted.task_id && resolved.task_id && submitted.task_id !== resolved.task_id) {
    return {
      ok: false,
      error: "submitted task_id does not match the selected review identity",
    };
  }
  if (
    submitted.cycle_id &&
    resolved.cycle_id &&
    submitted.cycle_id !== resolved.cycle_id
  ) {
    return {
      ok: false,
      error: "submitted cycle_id does not match the selected review identity",
    };
  }
  return {
    ok: true,
    identity: {
      review_id: resolved.review_id,
      candidate_id: resolved.candidate_id,
      task_id: resolved.task_id ?? submitted.task_id,
      cycle_id: resolved.cycle_id ?? submitted.cycle_id,
    },
  };
}
