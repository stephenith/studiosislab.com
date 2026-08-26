/**
 * RuntimeReleaseRepository — append-only persistence (Agent #170).
 * Platform consolidation (Agent #173): extends BaseAppendOnlyRepository.
 */
import { join, resolve } from "node:path";
import { BaseAppendOnlyRepository } from "../../platform/repositories/BaseAppendOnlyRepository.js";
import type {
  RuntimeReleaseDecision,
  RuntimeReleaseEvent,
  RuntimeReleaseHealth,
  RuntimeReleaseHistoryEntry,
  RuntimeReleaseSnapshot,
} from "./runtime-release-types.js";

const LOG_REL = "SOS/07_LOGS/saios/runtime/runtime-release";

function resolveRepoRoot(fromDir = import.meta.dirname): string {
  return resolve(fromDir, "../../../..");
}

export function runtimeReleaseLogDir(
  repoRoot?: string,
  fixture = false,
): string {
  const base = join(repoRoot ?? resolveRepoRoot(), LOG_REL);
  return fixture ? join(base, "fixtures") : base;
}

export class RuntimeReleaseRepository extends BaseAppendOnlyRepository {
  constructor(repoRoot?: string, opts?: { fixture?: boolean }) {
    super({
      repoRoot: repoRoot ?? resolveRepoRoot(),
      logRelativePath: LOG_REL,
      fixture: Boolean(opts?.fixture),
    });
  }

  appendDecision(d: RuntimeReleaseDecision): void {
    this.appendJsonl("runtime-release-decisions.jsonl", d);
  }

  appendEvent(e: RuntimeReleaseEvent): void {
    this.appendJsonl("runtime-release-events.jsonl", e);
  }

  appendHistory(h: RuntimeReleaseHistoryEntry): void {
    this.appendJsonl("runtime-release-history.jsonl", h);
  }

  listDecisions(): RuntimeReleaseDecision[] {
    return this.readJsonl("runtime-release-decisions.jsonl");
  }

  listEvents(): RuntimeReleaseEvent[] {
    return this.readJsonl("runtime-release-events.jsonl");
  }

  listHistory(): RuntimeReleaseHistoryEntry[] {
    return this.readJsonl("runtime-release-history.jsonl");
  }

  hasApprovedPlan(missionId: string, planChecksum: string): boolean {
    return this.listDecisions().some(
      (d) =>
        d.mission_id === missionId &&
        d.plan_checksum === planChecksum &&
        d.decision === "APPROVED" &&
        d.status === "CONSUMED",
    );
  }

  writeLatest(snapshot: RuntimeReleaseSnapshot): void {
    this.atomicWrite("latest-runtime-release.json", snapshot);
  }

  writePending(
    pending: Array<{
      mission_id: string;
      runtime_plan_id: string;
      plan_checksum: string;
      status: string;
    }>,
  ): void {
    this.atomicWrite("pending-runtime-releases.json", {
      schema_version: "pending-runtime-releases-1.0.0",
      updated_at: new Date().toISOString(),
      count: pending.length,
      pending,
    });
  }

  writeHealth(health: RuntimeReleaseHealth): void {
    this.atomicWrite("runtime-release-health.json", health);
  }

  loadLatest(): RuntimeReleaseSnapshot | null {
    return this.loadJson("latest-runtime-release.json");
  }

  loadHealth(): RuntimeReleaseHealth | null {
    return this.loadJson("runtime-release-health.json");
  }

  loadPending(): {
    count: number;
    pending: Array<{
      mission_id: string;
      runtime_plan_id: string;
      plan_checksum: string;
      status: string;
    }>;
  } | null {
    return this.loadJson("pending-runtime-releases.json");
  }
}
