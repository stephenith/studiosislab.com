/**
 * Backup / rollback metadata availability.
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./SecurityConfiguration.js";
import { readJsonSafe, sourceEntry } from "./security-utils.js";
import type { SecurityFinding } from "./types.js";

export function checkBackupHealth(): {
  findings: SecurityFinding[];
  sources: ReturnType<typeof sourceEntry>[];
  pass: boolean;
} {
  const projectStatePath = join(REPO_ROOT, "SOS/project-state.json");
  const pubDir = join(REPO_ROOT, "SOS/07_LOGS/saios/publication");
  const sources = [
    sourceEntry("project-state", projectStatePath),
    sourceEntry("publication", pubDir),
  ];
  const findings: SecurityFinding[] = [];

  const state = readJsonSafe<{
    pending_actions?: string[];
    discovery?: {
      releases?: Array<{
        status?: string;
        rollback_available?: boolean;
        snapshot_dir?: string;
      }>;
    };
    operations?: {
      rollbacks?: unknown[];
      rollback?: { available?: boolean; count?: number };
      release_manager?: { rollbacks?: unknown };
    };
    factory_v1?: { status?: string };
  }>(projectStatePath);

  const releases = state.data?.discovery?.releases ?? [];
  const withRollback = releases.filter((r) => r.rollback_available === true);
  const rolledBack = releases.filter((r) => r.status === "rolled_back");
  const snapshotsPresent = withRollback.filter(
    (r) => r.snapshot_dir && existsSync(r.snapshot_dir),
  ).length;

  const pendingMentions = (state.data?.pending_actions ?? []).some((a) =>
    /rollback/i.test(a),
  );

  findings.push({
    id: "backup-rollback-metadata",
    area: "backup",
    level: withRollback.length > 0 ? "GREEN" : "YELLOW",
    title:
      withRollback.length > 0
        ? `Rollback metadata present (${withRollback.length} release(s) rollback_available)`
        : "No explicit rollback_available flags in discovery.releases",
    detail: `rollback_available=${withRollback.length}; rolled_back=${rolledBack.length}; pendingMentions=${pendingMentions}`,
    source: "project-state.json",
    pass: true,
  });

  const snapshotRoot = join(
    REPO_ROOT,
    "SOS/07_LOGS/saios/publication/release-manager/snapshots",
  );
  let snapshotDirs = 0;
  if (existsSync(snapshotRoot)) {
    try {
      snapshotDirs = readdirSync(snapshotRoot).length;
    } catch {
      snapshotDirs = 0;
    }
  }

  findings.push({
    id: "backup-publication-artifacts",
    area: "backup",
    level: snapshotDirs > 0 || snapshotsPresent > 0 ? "GREEN" : "YELLOW",
    title:
      snapshotDirs > 0 || snapshotsPresent > 0
        ? `Release snapshots available (${snapshotDirs || snapshotsPresent})`
        : "No release-manager snapshots found",
    detail: snapshotRoot,
    source: "publication",
    pass: true,
  });

  return { findings, sources, pass: true };
}
