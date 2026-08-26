/**
 * FounderGateRuntime — façade for pause / resume / recovery.
 */
import { CyclePauseManager } from "./CyclePauseManager.js";
import { CycleResumeManager } from "./CycleResumeManager.js";
import { FounderDecisionWatcher } from "./FounderDecisionWatcher.js";
import { WaitingFounderRepository } from "./WaitingFounderRepository.js";
import { buildFounderGateReport } from "./FounderGateReporter.js";
import type { PauseInput } from "./CyclePauseManager.js";
import type { ResumeInput } from "./CycleResumeManager.js";
import type { WatchedDecision } from "./FounderDecisionWatcher.js";

export class FounderGateRuntime {
  readonly repo = new WaitingFounderRepository();
  readonly pauseMgr = new CyclePauseManager(this.repo);
  readonly resumeMgr = new CycleResumeManager(this.repo);
  readonly watcher = new FounderDecisionWatcher(this.repo, this.resumeMgr);

  pause(input: PauseInput) {
    const cp = this.pauseMgr.pauseForFounder(input);
    this.repo.writeReport(
      buildFounderGateReport(this.repo.activeWaiting(true)),
    );
    return cp;
  }

  resume(input: ResumeInput) {
    return this.resumeMgr.resume(input);
  }

  consumeDashboardDecision(decision: WatchedDecision) {
    return this.watcher.consumeRecordedDecision(decision);
  }

  recover() {
    return this.pauseMgr.recoverWaiting();
  }

  listWaiting(includeFixtures = false) {
    return this.repo.activeWaiting(includeFixtures);
  }
}

export function createFounderGateRuntime(): FounderGateRuntime {
  return new FounderGateRuntime();
}
