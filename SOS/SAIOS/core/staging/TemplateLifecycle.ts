/**
 * Central lifecycle transition validator — Agent #242.
 */
import type { TemplateLifecycleStatus } from "./types.js";

const ALLOWED: Record<TemplateLifecycleStatus, TemplateLifecycleStatus[]> = {
  GENERATING: ["QUALITY_CHECK", "READY_FOR_REVIEW", "REJECTED"],
  QUALITY_CHECK: ["READY_FOR_REVIEW", "REJECTED", "CHANGES_REQUESTED"],
  READY_FOR_REVIEW: ["APPROVED", "CHANGES_REQUESTED", "REJECTED"],
  APPROVED: ["STAGING_REQUESTED", "CHANGES_REQUESTED", "REJECTED"],
  CHANGES_REQUESTED: ["READY_FOR_REVIEW", "REJECTED", "GENERATING"],
  REJECTED: [],
  STAGING_REQUESTED: ["STAGING", "STAGING_FAILED", "APPROVED"],
  STAGING: ["STAGED", "STAGING_FAILED"],
  STAGED: ["VALIDATED", "STAGING_FAILED"],
  VALIDATED: ["PUBLISHING", "PUBLISHED", "PUBLICATION_FAILED", "ROLLED_BACK"],
  STAGING_FAILED: ["STAGING_REQUESTED", "APPROVED"],
  RELEASE_FAILED: ["VALIDATED", "ROLLED_BACK"],
  PUBLISHING: ["PUBLISHED", "PUBLICATION_FAILED"],
  PUBLICATION_FAILED: ["VALIDATED", "PUBLISHING", "ROLLED_BACK"],
  PUBLISHED: ["ROLLED_BACK"],
  ROLLED_BACK: ["APPROVED", "READY_FOR_REVIEW"],
};

export function canTransition(
  from: TemplateLifecycleStatus,
  to: TemplateLifecycleStatus,
): boolean {
  if (from === to) return true;
  return (ALLOWED[from] ?? []).includes(to);
}

export function assertTransition(
  from: TemplateLifecycleStatus,
  to: TemplateLifecycleStatus,
): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid lifecycle transition: ${from} → ${to}`);
  }
}

/** Founder decision kinds map onto lifecycle statuses. */
export function lifecycleFromFounderDecision(
  decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED",
): TemplateLifecycleStatus {
  if (decision === "APPROVED") return "APPROVED";
  if (decision === "REJECTED") return "REJECTED";
  return "CHANGES_REQUESTED";
}
