/**
 * ExecutionControllerRepository — append-only persistence (Agent #179).
 * Scaffold only. Never executes.
 */
import { join, resolve } from "node:path";
import { BaseAppendOnlyRepository } from "../../platform/repositories/BaseAppendOnlyRepository.js";
import type {
  ExecutionControllerEvent,
  ExecutionControllerHealth,
  ExecutionControllerHistoryEntry,
  ExecutionControllerRecord,
  ExecutionControllerSnapshot,
} from "./ExecutionControllerTypes.js";

const LOG_REL = "SOS/07_LOGS/saios/runtime/execution-controller";

function resolveRepoRoot(fromDir = import.meta.dirname): string {
  return resolve(fromDir, "../../../..");
}

export function executionControllerLogDir(
  repoRoot?: string,
  fixture = false,
): string {
  const base = join(repoRoot ?? resolveRepoRoot(), LOG_REL);
  return fixture ? join(base, "fixtures") : base;
}

export class ExecutionControllerRepository extends BaseAppendOnlyRepository {
  constructor(repoRoot?: string, opts?: { fixture?: boolean }) {
    super({
      repoRoot: repoRoot ?? resolveRepoRoot(),
      logRelativePath: LOG_REL,
      fixture: Boolean(opts?.fixture),
    });
  }

  save(record: ExecutionControllerRecord): string[] {
    return this.saveNamedArtifact(
      record.controller_id,
      record,
      "latest-execution-controller.json",
      "execution-controller-records.jsonl",
    );
  }

  appendEvent(e: ExecutionControllerEvent): void {
    this.appendJsonl("execution-controller-events.jsonl", e);
  }

  appendHistory(entry: ExecutionControllerHistoryEntry): void {
    this.appendJsonl("execution-controller-history.jsonl", entry);
  }

  list(): ExecutionControllerRecord[] {
    return this.readJsonl("execution-controller-records.jsonl");
  }

  listEvents(): ExecutionControllerEvent[] {
    return this.readJsonl("execution-controller-events.jsonl");
  }

  listHistory(): ExecutionControllerHistoryEntry[] {
    return this.readJsonl("execution-controller-history.jsonl");
  }

  getForMission(missionId: string): ExecutionControllerRecord | null {
    const all = this.list().filter((r) => r.mission_id === missionId);
    return all.length ? all[all.length - 1]! : null;
  }

  get(controllerId: string): ExecutionControllerRecord | null {
    const all = this.list().filter((r) => r.controller_id === controllerId);
    return all.length ? all[all.length - 1]! : null;
  }

  hasReadyController(missionId: string, readinessChecksum: string): boolean {
    return this.list().some(
      (r) =>
        r.mission_id === missionId &&
        r.checksum_chain.readiness_checksum === readinessChecksum &&
        r.controller_status === "EXECUTION_CONTROLLER_READY",
    );
  }

  writeLatest(snapshot: ExecutionControllerSnapshot): void {
    this.atomicWrite("latest-execution-controller-snapshot.json", snapshot);
  }

  writeHealth(health: ExecutionControllerHealth): void {
    this.atomicWrite("execution-controller-health.json", health);
  }

  loadLatestRecord(): ExecutionControllerRecord | null {
    return this.loadJson("latest-execution-controller.json");
  }

  loadLatest(): ExecutionControllerSnapshot | null {
    return this.loadJson("latest-execution-controller-snapshot.json");
  }

  loadHealth(): ExecutionControllerHealth | null {
    return this.loadJson("execution-controller-health.json");
  }
}
