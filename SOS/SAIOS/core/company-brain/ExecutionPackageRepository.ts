/**
 * ExecutionPackageRepository — append-only persistence (Agent #165).
 * Platform consolidation (Agent #176): extends BaseAppendOnlyRepository.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveRepoRoot } from "./PlanRepository.js";
import { BaseAppendOnlyRepository } from "../../platform/repositories/BaseAppendOnlyRepository.js";
import type {
  ExecutionPackage,
  ExecutionPackageEvent,
  ExecutionPackageSnapshot,
} from "./execution-package-types.js";

const LOG_REL = "SOS/07_LOGS/saios/company-brain/execution-packages";

export function executionPackageLogDir(
  repoRoot?: string,
  fixture = false,
): string {
  const base = join(repoRoot ?? resolveRepoRoot(), LOG_REL);
  return fixture ? join(base, "fixtures") : base;
}

export class ExecutionPackageRepository extends BaseAppendOnlyRepository {
  constructor(repoRoot?: string, opts?: { fixture?: boolean }) {
    super({
      repoRoot: repoRoot ?? resolveRepoRoot(),
      logRelativePath: LOG_REL,
      fixture: Boolean(opts?.fixture),
      lenientJsonl: true,
    });
  }

  save(pkg: ExecutionPackage): string[] {
    const paths = this.saveNamedArtifact(
      pkg.package_id,
      pkg,
      "latest-execution-package.json",
      "execution-packages.jsonl",
    );

    const snapshot: ExecutionPackageSnapshot = {
      schema_version: "execution-package-snapshot-1.0.0",
      updated_at: pkg.created_at,
      latest_package_id: pkg.package_id,
      mission_id: pkg.mission_id,
      execution_id: pkg.execution_id,
      dry_run: true,
      execution_allowed: false,
      queue_enqueue_allowed: false,
      publishing_allowed: false,
      package_count: this.list().length,
    };
    this.atomicWrite("execution-package-index.json", snapshot);
    paths.push(`${this.relativeLogDir}/execution-package-index.json`);

    return paths;
  }

  appendEvent(event: ExecutionPackageEvent): void {
    this.appendJsonl("execution-package-events.jsonl", event);
  }

  list(): ExecutionPackage[] {
    return this.readJsonl<ExecutionPackage>("execution-packages.jsonl");
  }

  get(packageId: string): ExecutionPackage | null {
    const p = join(this.dir, `${packageId}.json`);
    if (!existsSync(p)) return null;
    try {
      return JSON.parse(readFileSync(p, "utf8")) as ExecutionPackage;
    } catch {
      return null;
    }
  }

  loadLatest(): ExecutionPackage | null {
    return this.loadJson("latest-execution-package.json");
  }

  loadLatestForMission(missionId: string): ExecutionPackage | null {
    const all = this.list().filter((p) => p.mission_id === missionId);
    return all.length ? all[all.length - 1]! : null;
  }

  loadSnapshot(): ExecutionPackageSnapshot | null {
    return this.loadJson("execution-package-index.json");
  }
}
