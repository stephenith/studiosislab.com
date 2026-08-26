/**
 * SystemReadinessRepository — append-only persistence (Agent #171).
 * Platform consolidation (Agent #173): extends BaseAppendOnlyRepository.
 */
import { join, resolve } from "node:path";
import { BaseAppendOnlyRepository } from "../../platform/repositories/BaseAppendOnlyRepository.js";
import type {
  SystemReadinessCertificate,
  SystemReadinessEvent,
  SystemReadinessHealth,
  SystemReadinessSnapshot,
} from "./system-readiness-types.js";

const LOG_REL = "SOS/07_LOGS/saios/runtime/system-readiness";

function resolveRepoRoot(fromDir = import.meta.dirname): string {
  return resolve(fromDir, "../../../..");
}

export function systemReadinessLogDir(
  repoRoot?: string,
  fixture = false,
): string {
  const base = join(repoRoot ?? resolveRepoRoot(), LOG_REL);
  return fixture ? join(base, "fixtures") : base;
}

export class SystemReadinessRepository extends BaseAppendOnlyRepository {
  constructor(repoRoot?: string, opts?: { fixture?: boolean }) {
    super({
      repoRoot: repoRoot ?? resolveRepoRoot(),
      logRelativePath: LOG_REL,
      fixture: Boolean(opts?.fixture),
    });
  }

  save(cert: SystemReadinessCertificate): string[] {
    return this.saveNamedArtifact(
      cert.certificate_id,
      cert,
      "latest-system-readiness.json",
      "system-readiness-certificates.jsonl",
    );
  }

  appendEvent(e: SystemReadinessEvent): void {
    this.appendJsonl("system-readiness-events.jsonl", e);
  }

  appendHistory(entry: Record<string, unknown>): void {
    this.appendJsonl("system-readiness-history.jsonl", entry);
  }

  list(): SystemReadinessCertificate[] {
    return this.readJsonl("system-readiness-certificates.jsonl");
  }

  listEvents(): SystemReadinessEvent[] {
    return this.readJsonl("system-readiness-events.jsonl");
  }

  getForMission(missionId: string): SystemReadinessCertificate | null {
    const all = this.list().filter((c) => c.mission_id === missionId);
    return all.length ? all[all.length - 1]! : null;
  }

  hasCertificate(missionId: string, planChecksum: string): boolean {
    return this.list().some(
      (c) =>
        c.mission_id === missionId &&
        c.checksum_chain.plan_checksum === planChecksum &&
        c.certificate_status === "SYSTEM_READY",
    );
  }

  writeLatest(snapshot: SystemReadinessSnapshot): void {
    this.atomicWrite("latest-system-readiness-snapshot.json", snapshot);
  }

  writeHealth(health: SystemReadinessHealth): void {
    this.atomicWrite("system-readiness-health.json", health);
  }

  loadLatestCertificate(): SystemReadinessCertificate | null {
    return this.loadJson("latest-system-readiness.json");
  }

  loadLatest(): SystemReadinessSnapshot | null {
    return this.loadJson("latest-system-readiness-snapshot.json");
  }

  loadHealth(): SystemReadinessHealth | null {
    return this.loadJson("system-readiness-health.json");
  }
}
