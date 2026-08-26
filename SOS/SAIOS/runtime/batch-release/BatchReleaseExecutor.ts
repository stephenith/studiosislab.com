/**
 * Executes batch release in dry-run / simulation modes only by default.
 * Real release requires explicit founder_final_publish_approval per template.
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { verifyRelease } from "../publication/ReleaseManager.js";
import type {
  BatchReleasePlan,
  BatchReleaseSimulation,
  PackageRecord,
  ReleaseMode,
} from "./types.js";

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function simulateBatchRelease(input: {
  mode: ReleaseMode;
  plan: BatchReleasePlan;
  packages: PackageRecord[];
  target_root: string;
}): BatchReleaseSimulation {
  const { mode, plan, packages, target_root } = input;
  const byId = new Map(packages.map((p) => [p.catalog_id, p]));
  const would_release: BatchReleaseSimulation["would_release"] = [];
  const would_skip: BatchReleaseSimulation["would_skip"] = [];

  const isNonPublishingMode = mode !== "real_release";

  for (const catalogId of plan.selected_for_release) {
    const pkg = byId.get(catalogId);
    if (!pkg) {
      would_skip.push({ catalog_id: catalogId, reason: "package_not_found" });
      continue;
    }

    if (pkg.classification === "published") {
      would_skip.push({ catalog_id: catalogId, reason: "already_published" });
      continue;
    }

    if (pkg.classification !== "ready") {
      would_skip.push({ catalog_id: catalogId, reason: pkg.classification });
      continue;
    }

    if (pkg.blockers.length > 0) {
      would_skip.push({ catalog_id: catalogId, reason: pkg.blockers.join(",") });
      continue;
    }

    if (!pkg.founder_final_publish_approval && mode === "real_release") {
      would_skip.push({
        catalog_id: catalogId,
        reason: "founder_final_publish_approval_required",
      });
      continue;
    }

    const liveCheck = verifyRelease({ catalog_id: catalogId, target_root });
    if (liveCheck.pass) {
      would_skip.push({ catalog_id: catalogId, reason: "already_live" });
      continue;
    }

    would_release.push({
      catalog_id: catalogId,
      prototype_id: pkg.prototype_id,
      package_checksum: sha256File(join(pkg.package_dir, "template.json")),
      rollback_snapshot_would_be_created: true,
      validation_pass: pkg.validation.pass,
    });
  }

  return {
    generated_at: new Date().toISOString(),
    mode,
    would_release,
    would_skip,
    live_changes: isNonPublishingMode ? 0 : would_release.length,
  };
}

export function buildRollbackSummary(input: {
  releaseHistoryPath: string;
}): {
  rolled_back_releases: number;
  snapshots_available: number;
  live_release: string;
} {
  const history = JSON.parse(readFileSync(input.releaseHistoryPath, "utf8")) as Array<{
    release_id: string;
    status: string;
    snapshot_dir?: string;
  }>;

  const rolledBack = history.filter((r) => r.status === "rolled_back");
  const snapshotsAvailable = rolledBack.filter((r) => r.snapshot_dir).length;
  const live = history.find((r) => r.status === "released");

  return {
    rolled_back_releases: rolledBack.length,
    snapshots_available: snapshotsAvailable,
    live_release: live?.release_id ?? "none",
  };
}
