/**
 * QueueAdmissionRepository — append-only persistence (Agent #164).
 * Platform consolidation (Agent #176): extends BaseAppendOnlyRepository.
 */
import { join } from "node:path";
import { resolveRepoRoot } from "./PlanRepository.js";
import { BaseAppendOnlyRepository } from "../../platform/repositories/BaseAppendOnlyRepository.js";
import type {
  QueueAdmissionDecision,
  QueueAdmissionEvent,
  QueueAdmissionHealth,
  QueueAdmissionHistoryEntry,
  QueueAdmissionSnapshot,
  QueueReadinessReport,
} from "./queue-admission-types.js";

const LOG_REL = "SOS/07_LOGS/saios/company-brain/queue-admission";

export function queueAdmissionLogDir(
  repoRoot?: string,
  fixture = false,
): string {
  const base = join(repoRoot ?? resolveRepoRoot(), LOG_REL);
  return fixture ? join(base, "fixtures") : base;
}

export class QueueAdmissionRepository extends BaseAppendOnlyRepository {
  constructor(repoRoot?: string, opts?: { fixture?: boolean }) {
    super({
      repoRoot: repoRoot ?? resolveRepoRoot(),
      logRelativePath: LOG_REL,
      fixture: Boolean(opts?.fixture),
      lenientJsonl: true,
    });
  }

  appendDecision(d: QueueAdmissionDecision): void {
    this.appendJsonl("queue-decisions.jsonl", d);
  }

  appendEvent(e: QueueAdmissionEvent): void {
    this.appendJsonl("queue-admission-events.jsonl", e);
  }

  appendHistory(h: QueueAdmissionHistoryEntry): void {
    this.appendJsonl("queue-admission-history.jsonl", h);
  }

  saveReview(report: QueueReadinessReport): void {
    this.atomicWrite("latest-queue-review.json", report);
    this.appendJsonl("queue-reviews.jsonl", report);
    this.atomicWrite(`review-${report.review_id}.json`, report);
  }

  listDecisions(): QueueAdmissionDecision[] {
    return this.readJsonl<QueueAdmissionDecision>("queue-decisions.jsonl");
  }

  listEvents(): QueueAdmissionEvent[] {
    return this.readJsonl<QueueAdmissionEvent>("queue-admission-events.jsonl");
  }

  listHistory(): QueueAdmissionHistoryEntry[] {
    return this.readJsonl<QueueAdmissionHistoryEntry>(
      "queue-admission-history.jsonl",
    );
  }

  loadLatestReview(): QueueReadinessReport | null {
    return this.loadJson("latest-queue-review.json");
  }

  hasApprovedForVersion(missionId: string, version: number): boolean {
    return this.listDecisions().some(
      (d) =>
        d.mission_id === missionId &&
        d.mission_version === version &&
        d.decision === "APPROVE_QUEUE_ADMISSION" &&
        d.status === "CONSUMED",
    );
  }

  writeSnapshot(s: QueueAdmissionSnapshot): void {
    this.atomicWrite("latest-queue-admission.json", s);
  }

  writeHealth(h: QueueAdmissionHealth): void {
    this.atomicWrite("queue-admission-health.json", h);
  }

  loadSnapshot(): QueueAdmissionSnapshot | null {
    return this.loadJson("latest-queue-admission.json");
  }

  loadHealth(): QueueAdmissionHealth | null {
    return this.loadJson("queue-admission-health.json");
  }
}
