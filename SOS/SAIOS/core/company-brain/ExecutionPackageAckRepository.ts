/**
 * ExecutionPackageAckRepository — append-only persistence (Agent #166).
 * Platform consolidation (Agent #176): extends BaseAppendOnlyRepository.
 */
import { join } from "node:path";
import { resolveRepoRoot } from "./PlanRepository.js";
import { BaseAppendOnlyRepository } from "../../platform/repositories/BaseAppendOnlyRepository.js";
import type {
  ExecutionPackageAcknowledgement,
  PackageAckEvent,
  PackageAckHealth,
  PackageAckHistoryEntry,
  PackageAckSnapshot,
} from "./execution-package-ack-types.js";

const LOG_REL = "SOS/07_LOGS/saios/company-brain/execution-package-ack";

export function packageAckLogDir(repoRoot?: string, fixture = false): string {
  const base = join(repoRoot ?? resolveRepoRoot(), LOG_REL);
  return fixture ? join(base, "fixtures") : base;
}

export class ExecutionPackageAckRepository extends BaseAppendOnlyRepository {
  constructor(repoRoot?: string, opts?: { fixture?: boolean }) {
    super({
      repoRoot: repoRoot ?? resolveRepoRoot(),
      logRelativePath: LOG_REL,
      fixture: Boolean(opts?.fixture),
      lenientJsonl: true,
    });
  }

  appendAcknowledgement(a: ExecutionPackageAcknowledgement): void {
    this.appendJsonl("execution-package-acknowledgements.jsonl", a);
  }

  appendEvent(e: PackageAckEvent): void {
    this.appendJsonl("execution-package-ack-events.jsonl", e);
  }

  appendHistory(h: PackageAckHistoryEntry): void {
    this.appendJsonl("execution-package-ack-history.jsonl", h);
  }

  listAcknowledgements(): ExecutionPackageAcknowledgement[] {
    return this.readJsonl("execution-package-acknowledgements.jsonl");
  }

  listEvents(): PackageAckEvent[] {
    return this.readJsonl("execution-package-ack-events.jsonl");
  }

  listHistory(): PackageAckHistoryEntry[] {
    return this.readJsonl("execution-package-ack-history.jsonl");
  }

  hasAcknowledgedVersion(missionId: string, packageVersion: number): boolean {
    return this.listAcknowledgements().some(
      (a) =>
        a.mission_id === missionId &&
        a.execution_package_version === packageVersion &&
        a.decision === "ACKNOWLEDGED" &&
        a.status === "CONSUMED",
    );
  }

  writeLatest(snapshot: PackageAckSnapshot): void {
    this.atomicWrite("latest-execution-package-ack.json", snapshot);
  }

  writePending(
    pending: Array<{
      mission_id: string;
      package_id: string;
      package_version: number;
      checksum: string;
      status: string;
    }>,
  ): void {
    this.atomicWrite("pending-execution-package-acks.json", {
      schema_version: "pending-execution-package-acks-1.0.0",
      updated_at: new Date().toISOString(),
      count: pending.length,
      pending,
    });
  }

  writeHealth(h: PackageAckHealth): void {
    this.atomicWrite("execution-package-ack-health.json", h);
  }

  loadLatest(): PackageAckSnapshot | null {
    return this.loadJson("latest-execution-package-ack.json");
  }

  loadHealth(): PackageAckHealth | null {
    return this.loadJson("execution-package-ack-health.json");
  }

  loadPending(): Array<Record<string, unknown>> {
    const doc = this.loadJson<{ pending?: Array<Record<string, unknown>> }>(
      "pending-execution-package-acks.json",
    );
    return doc?.pending ?? [];
  }
}
