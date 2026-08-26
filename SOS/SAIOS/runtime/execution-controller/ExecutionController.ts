/**
 * ExecutionController — execution authorization-record owner (Agent #179/#194).
 * One stage inside the distributed Execution Authority Model — not the sole
 * execution authority. Structural framework only. Never executes, dispatches,
 * or enables LIVE.
 */
import { ExecutionLifecycle } from "./ExecutionLifecycle.js";
import type {
  ExecutionControllerResult,
  ExecutionControllerReviewInput,
} from "./ExecutionControllerTypes.js";

export class ExecutionController {
  readonly lifecycle: ExecutionLifecycle;

  constructor(repoRoot?: string) {
    this.lifecycle = new ExecutionLifecycle(repoRoot);
  }

  get registry() {
    return this.lifecycle.registry;
  }

  get root() {
    return this.lifecycle.root;
  }

  getForMission(missionId: string, fixture?: boolean) {
    return this.lifecycle.getForMission(missionId, fixture);
  }

  openForAuthorization(
    missionId: string,
    opts?: { fixture?: boolean },
  ): ExecutionControllerResult {
    return this.lifecycle.openForAuthorization(missionId, opts);
  }

  recordReview(input: ExecutionControllerReviewInput): ExecutionControllerResult {
    return this.lifecycle.recordReview(input);
  }

  refreshSnapshots(fixture?: boolean): void {
    this.lifecycle.refreshSnapshots(fixture);
  }
}

export function createExecutionController(
  repoRoot?: string,
): ExecutionController {
  return new ExecutionController(repoRoot);
}
