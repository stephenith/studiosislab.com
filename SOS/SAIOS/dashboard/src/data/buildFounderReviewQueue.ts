/**
 * Dashboard adapter over the canonical Founder Review projection.
 *
 * Registry admission, supersession, preview gates, and decision overlay live in:
 *   SOS/SAIOS/core/founder-review/FounderReviewProjection.ts
 *
 * This file must not duplicate those rules.
 */
import type { FounderReviewQueueItem } from "./types.js";
import {
  loadFounderReviewProjection,
  loadWaitingTemplatesFromRegistry,
} from "../../../core/founder-review/FounderReviewProjection.js";
import type { FounderReviewProjectionItem } from "../../../core/founder-review/FounderReviewProjectionTypes.js";

function toQueueItem(item: FounderReviewProjectionItem): FounderReviewQueueItem {
  return item as FounderReviewQueueItem;
}

/**
 * Registry-admitted resume templates (pre-decision overlay).
 * @deprecated Prefer loadWaitingTemplatesFromRegistry from core; kept for call-site compatibility.
 */
export function loadWaitingCandidatesFromRegistry(
  repoRoot: string,
): FounderReviewQueueItem[] {
  return loadWaitingTemplatesFromRegistry(repoRoot).map(toQueueItem);
}

/**
 * Canonical Founder Review queue for /api/snapshot and /api/review-queue.
 */
export function loadReviewQueueForRepo(
  repoRoot: string,
): FounderReviewQueueItem[] {
  return loadFounderReviewProjection(repoRoot).map(toQueueItem);
}

export {
  loadFounderReviewProjection,
  loadWaitingTemplatesFromRegistry,
  summarizeFounderReviewProjection,
  countFounderReviewWaiting,
  countFounderReviewWaitingByCategory,
} from "../../../core/founder-review/FounderReviewProjection.js";
