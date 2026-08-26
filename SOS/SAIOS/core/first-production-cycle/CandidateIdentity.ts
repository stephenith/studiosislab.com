/**
 * Run-unique canonical candidate identity — Agent #207.
 * Same ProductionTarget may be selected again; IDs must never collide.
 */
import { randomBytes } from "node:crypto";
import type { ProductionTarget } from "./ProductionTarget.js";
import { titleToRoleFamily } from "./selectProductionTarget.js";

export type CandidateIdentity = {
  candidate_id: string;
  task_id: string;
  review_id: string;
  cycle_id: string;
  run_id: string;
  run_stamp: string;
  target_slug: string;
  candidate_title: string;
  created_at: string;
};

/** Readable slug from target (not unique alone). */
export function targetSlug(target: ProductionTarget): string {
  return `${target.category}-${titleToRoleFamily(target.title)}`
    .replace(/_+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 40);
}

/**
 * Allocate a collision-safe identity for a new canonical run.
 * Prefix = target slug; stamp = UTC ISO compact; suffix = 6 hex bytes.
 */
export function allocateCandidateIdentity(
  target: ProductionTarget,
  now: Date = new Date(),
): CandidateIdentity {
  const created_at = now.toISOString();
  const run_stamp = created_at.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const suffix = randomBytes(3).toString("hex");
  const slug = targetSlug(target) || "candidate";
  const run_id = `${slug}-${run_stamp}-${suffix}`;
  const candidate_id = `cand-${run_id}`;
  const task_id = `cycle-${run_id}`;
  const cycle_id = `cycle-run-${run_id}`;
  const review_id = `founder-review-${task_id}`;
  return {
    candidate_id,
    task_id,
    review_id,
    cycle_id,
    run_id,
    run_stamp,
    target_slug: slug,
    candidate_title: `${target.title} Resume`,
    created_at,
  };
}
