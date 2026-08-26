/**
 * QueueSubmissionRepository — append-only persistence (Agent #167).
 * Platform consolidation (Agent #176): extends BaseAppendOnlyRepository.
 * JSONL parsing remains strict (malformed lines throw).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveRepoRoot } from "./PlanRepository.js";
import { BaseAppendOnlyRepository } from "../../platform/repositories/BaseAppendOnlyRepository.js";
import type {
  QueueSubmissionEvent,
  QueueSubmissionHealth,
  QueueSubmissionHistoryEntry,
  QueueSubmissionPackage,
  QueueSubmissionSnapshot,
} from "./queue-submission-types.js";

const LOG_REL = "SOS/07_LOGS/saios/company-brain/queue-submission";

export function queueSubmissionLogDir(
  repoRoot?: string,
  fixture = false,
): string {
  const base = join(repoRoot ?? resolveRepoRoot(), LOG_REL);
  return fixture ? join(base, "fixtures") : base;
}

export class QueueSubmissionRepository extends BaseAppendOnlyRepository {
  constructor(repoRoot?: string, opts?: { fixture?: boolean }) {
    super({
      repoRoot: repoRoot ?? resolveRepoRoot(),
      logRelativePath: LOG_REL,
      fixture: Boolean(opts?.fixture),
      // Strict JSONL — matches pre-migration behavior (throws on bad lines).
      lenientJsonl: false,
    });
  }

  save(pkg: QueueSubmissionPackage): string[] {
    return this.saveNamedArtifact(
      pkg.submission_id,
      pkg,
      "latest-queue-submission.json",
      "queue-submissions.jsonl",
    );
  }

  appendEvent(e: QueueSubmissionEvent): void {
    this.appendJsonl("queue-submission-events.jsonl", e);
  }

  appendHistory(h: QueueSubmissionHistoryEntry): void {
    this.appendJsonl("queue-submission-history.jsonl", h);
  }

  list(): QueueSubmissionPackage[] {
    return this.readJsonl("queue-submissions.jsonl");
  }

  listEvents(): QueueSubmissionEvent[] {
    return this.readJsonl("queue-submission-events.jsonl");
  }

  listHistory(): QueueSubmissionHistoryEntry[] {
    return this.readJsonl("queue-submission-history.jsonl");
  }

  get(submissionId: string): QueueSubmissionPackage | null {
    const p = join(this.dir, `${submissionId}.json`);
    if (!existsSync(p)) {
      return (
        this.list()
          .reverse()
          .find((x) => x.submission_id === submissionId) ?? null
      );
    }
    return JSON.parse(readFileSync(p, "utf8")) as QueueSubmissionPackage;
  }

  getForMission(missionId: string): QueueSubmissionPackage | null {
    const all = this.list().filter((p) => p.mission_id === missionId);
    return all.length ? all[all.length - 1]! : null;
  }

  hasSubmissionForPackage(
    missionId: string,
    executionPackageId: string,
    executionPackageChecksum: string,
  ): boolean {
    return this.list().some(
      (p) =>
        p.mission_id === missionId &&
        p.execution_package_id === executionPackageId &&
        p.execution_package_checksum === executionPackageChecksum,
    );
  }

  writeLatest(snapshot: QueueSubmissionSnapshot): void {
    this.atomicWrite("latest-queue-submission-snapshot.json", snapshot);
  }

  writePending(
    pending: Array<{
      mission_id: string;
      submission_id: string;
      submission_checksum: string;
      status: string;
    }>,
  ): void {
    this.atomicWrite("pending-queue-submissions.json", {
      schema_version: "pending-queue-submissions-1.0.0",
      updated_at: new Date().toISOString(),
      count: pending.length,
      pending,
    });
  }

  writeHealth(health: QueueSubmissionHealth): void {
    this.atomicWrite("queue-submission-health.json", health);
  }

  loadLatestPackage(): QueueSubmissionPackage | null {
    return this.loadJson("latest-queue-submission.json");
  }

  loadLatest(): QueueSubmissionSnapshot | null {
    return this.loadJson("latest-queue-submission-snapshot.json");
  }

  loadHealth(): QueueSubmissionHealth | null {
    return this.loadJson("queue-submission-health.json");
  }

  loadPending(): {
    count: number;
    pending: Array<{
      mission_id: string;
      submission_id: string;
      submission_checksum: string;
      status: string;
    }>;
  } | null {
    return this.loadJson("pending-queue-submissions.json");
  }
}
