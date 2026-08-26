/**
 * ShadowQueueRepository — append-only persistence (Agent #168).
 * Isolated from the existing execution queue.
 * Platform consolidation (Agent #173): extends BaseAppendOnlyRepository.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { BaseAppendOnlyRepository } from "../../platform/repositories/BaseAppendOnlyRepository.js";
import type {
  ShadowQueueEvent,
  ShadowQueueHealth,
  ShadowQueueHistoryEntry,
  ShadowQueueRecord,
  ShadowQueueSnapshot,
} from "./shadow-queue-types.js";

const LOG_REL = "SOS/07_LOGS/saios/runtime/shadow-queue";

function resolveRepoRoot(fromDir = import.meta.dirname): string {
  return resolve(fromDir, "../../../..");
}

export function shadowQueueLogDir(
  repoRoot?: string,
  fixture = false,
): string {
  const base = join(repoRoot ?? resolveRepoRoot(), LOG_REL);
  return fixture ? join(base, "fixtures") : base;
}

export class ShadowQueueRepository extends BaseAppendOnlyRepository {
  constructor(repoRoot?: string, opts?: { fixture?: boolean }) {
    super({
      repoRoot: repoRoot ?? resolveRepoRoot(),
      logRelativePath: LOG_REL,
      fixture: Boolean(opts?.fixture),
    });
  }

  save(record: ShadowQueueRecord): string[] {
    return this.saveNamedArtifact(
      record.shadow_queue_id,
      record,
      "latest-shadow-queue.json",
      "shadow-queue-records.jsonl",
    );
  }

  appendEvent(e: ShadowQueueEvent): void {
    this.appendJsonl("shadow-queue-events.jsonl", e);
  }

  appendHistory(h: ShadowQueueHistoryEntry): void {
    this.appendJsonl("shadow-queue-history.jsonl", h);
  }

  list(): ShadowQueueRecord[] {
    return this.readJsonl("shadow-queue-records.jsonl");
  }

  listEvents(): ShadowQueueEvent[] {
    return this.readJsonl("shadow-queue-events.jsonl");
  }

  listHistory(): ShadowQueueHistoryEntry[] {
    return this.readJsonl("shadow-queue-history.jsonl");
  }

  get(shadowQueueId: string): ShadowQueueRecord | null {
    const p = join(this.dir, `${shadowQueueId}.json`);
    if (!existsSync(p)) {
      return (
        this.list()
          .reverse()
          .find((x) => x.shadow_queue_id === shadowQueueId) ?? null
      );
    }
    return JSON.parse(readFileSync(p, "utf8")) as ShadowQueueRecord;
  }

  getForMission(missionId: string): ShadowQueueRecord | null {
    const all = this.list().filter((r) => r.mission_id === missionId);
    return all.length ? all[all.length - 1]! : null;
  }

  hasReceivedSubmission(
    missionId: string,
    submissionId: string,
    submissionChecksum: string,
  ): boolean {
    return this.list().some(
      (r) =>
        r.mission_id === missionId &&
        r.submission_id === submissionId &&
        r.submission_checksum === submissionChecksum &&
        r.status === "SHADOW_QUEUE_RECEIVED",
    );
  }

  writeLatest(snapshot: ShadowQueueSnapshot): void {
    this.atomicWrite("latest-shadow-queue-snapshot.json", snapshot);
  }

  writeHealth(health: ShadowQueueHealth): void {
    this.atomicWrite("shadow-queue-health.json", health);
  }

  loadLatestRecord(): ShadowQueueRecord | null {
    return this.loadJson("latest-shadow-queue.json");
  }

  loadLatest(): ShadowQueueSnapshot | null {
    return this.loadJson("latest-shadow-queue-snapshot.json");
  }

  loadHealth(): ShadowQueueHealth | null {
    return this.loadJson("shadow-queue-health.json");
  }
}
