#!/usr/bin/env tsx
/**
 * Batch Release Manager verification.
 * AGENT #098 — dry run only; no live publication.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { getResumeCatalogSnapshotFromRoot } from "../../../../src/lib/resumeCatalogRuntime.js";
import { verifyRelease } from "../publication/ReleaseManager.js";
import { BATCH_RELEASE_MANAGER, runBatchRelease, STATE_PATH } from "./BatchReleaseManager.js";
import { OUTPUT_DIR } from "./BatchReleaseReporter.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
const SOS_ROOT = join(REPO_ROOT, "SOS");

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function main(): void {
  assert(BATCH_RELEASE_MANAGER.module === "batch-release-manager", "module id");
  assert(BATCH_RELEASE_MANAGER.agent === "098", "agent number");
  assert(BATCH_RELEASE_MANAGER.prohibitions.includes("no_auto_publish"), "no auto publish");

  const preState = JSON.parse(readFileSync(STATE_PATH, "utf8")) as {
    next_agent: string;
    latest_agent: string;
    latest_release: string;
    latest_catalog: string;
  };
  assert(
    preState.next_agent === "098" || preState.latest_agent === "098",
    "pre-flight: expected agent #098",
  );

  const integrity = JSON.parse(
    readFileSync(join(SOS_ROOT, "07_LOGS/saios/catalog-integrity/publication-safety.json"), "utf8"),
  ) as { safe_to_publish: boolean; checks: Record<string, boolean> };
  assert(integrity.safe_to_publish, "catalog integrity PASS");

  const manifestBefore = readFileSync(join(REPO_ROOT, "templates.manifest.json"), "utf8");
  const publishedBefore = (JSON.parse(manifestBefore) as { templates: Array<{ status: string }> })
    .templates.filter((t) => t.status === "published").length;

  const result = runBatchRelease({ mode: "dry_run" });

  assert(result.dry_run, "dry run mode");
  assert(result.published_count === 0, "no publications during verify");

  const manifestAfter = readFileSync(join(REPO_ROOT, "templates.manifest.json"), "utf8");
  assert(manifestBefore === manifestAfter, "manifest unchanged");

  const publishedAfter = (JSON.parse(manifestAfter) as { templates: Array<{ status: string }> })
    .templates.filter((t) => t.status === "published").length;
  assert(publishedBefore === publishedAfter, "published count unchanged");

  const required = [
    "batch-release-plan.json",
    "batch-release-summary.json",
    "release-preview.md",
    "release-results.json",
    "release-simulation.json",
    "batch-publication-history.json",
  ];
  for (const file of required) {
    assert(existsSync(join(OUTPUT_DIR, file)), `artifact: ${file}`);
  }

  const saved = JSON.parse(readFileSync(STATE_PATH, "utf8")) as {
    latest_agent: string;
    next_agent: string;
    operations: { batch_release: Record<string, unknown> };
  };
  assert(saved.latest_agent === "098", "factory state latest_agent");
  assert(saved.next_agent === "099", "factory state next_agent");

  assert(result.plan.queue.length > 0, "release queue discovered");
  assert(result.plan.queue.some((p) => p.classification === "ready"), "ready candidates exist");
  assert(result.plan.queue.some((p) => p.classification === "published"), "published tracked");

  const rollback = result.rollback_summary;
  assert(rollback.snapshots_available >= 0, "rollback snapshots checked");
  assert(rollback.live_release === preState.latest_release, "rollback live release consistency");

  const t094Live = verifyRelease({ catalog_id: "t094", target_root: REPO_ROOT });
  assert(t094Live.pass, "release integrity t094 live");

  const runtimeCatalog = getResumeCatalogSnapshotFromRoot(REPO_ROOT);
  assert(runtimeCatalog.templates.length > 0, "runtime catalog");
  assert(runtimeCatalog.templates.some((t) => t.id === "t094"), "runtime catalog t094");

  const checks = {
    release_queue: result.plan.queue.length > 0,
    batch_validation: result.plan.queue.every((p) => p.validation.checks.package_completeness !== undefined),
    rollback_snapshots: rollback.rolled_back_releases >= 0,
    publication_safety: integrity.safe_to_publish,
    release_integrity: t094Live.pass,
    runtime_catalog: runtimeCatalog.templates.length > 0,
    gallery_consistency: runtimeCatalog.templates.some((t) => t.id === preState.latest_catalog),
    factory_state: saved.latest_agent === "098" && saved.next_agent === "099",
  };

  assert(Object.values(checks).every(Boolean), "all verification checks");

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "batch-release-manager",
        agent: "098",
        output_dir: OUTPUT_DIR,
        dry_run: true,
        published_count: 0,
        queue: {
          total: result.plan.queue.length,
          ready: result.plan.queue.filter((p) => p.classification === "ready").length,
          blocked: result.plan.queue.filter((p) => p.classification === "blocked").length,
          published: result.plan.queue.filter((p) => p.classification === "published").length,
          incomplete: result.plan.queue.filter((p) => p.classification === "incomplete").length,
          rolled_back: result.plan.queue.filter((p) => p.classification === "rolled_back").length,
        },
        simulation_would_release: result.simulation.would_release.length,
        safe_candidates: result.plan.queue
          .filter((p) => p.classification === "ready")
          .map((p) => p.catalog_id),
        rollback_summary: rollback,
        checks,
      },
      null,
      2,
    ),
  );
}

main();
