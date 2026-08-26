/**
 * CycleCheckpoint — checksum helpers.
 */
import { createHash } from "node:crypto";
import type { CycleCheckpoint } from "./types.js";

export function computeCheckpointChecksum(
  cp: Omit<CycleCheckpoint, "checkpoint_checksum">,
): string {
  const payload = JSON.stringify({
    cycle_id: cp.cycle_id,
    task_id: cp.task_id,
    candidate_id: cp.candidate_id,
    review_id: cp.review_id,
    state: cp.state,
    completed_stages: cp.completed_stages,
    artifact_references: cp.artifact_references,
    critic_result: cp.critic_result,
    queue_action_id: cp.queue_action_id,
    created_at: cp.created_at,
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 24);
}

export function withChecksum(
  cp: Omit<CycleCheckpoint, "checkpoint_checksum">,
): CycleCheckpoint {
  return {
    ...cp,
    checkpoint_checksum: computeCheckpointChecksum(cp),
  };
}

export function verifyChecksum(cp: CycleCheckpoint): boolean {
  const { checkpoint_checksum, ...rest } = cp;
  return computeCheckpointChecksum(rest) === checkpoint_checksum;
}
