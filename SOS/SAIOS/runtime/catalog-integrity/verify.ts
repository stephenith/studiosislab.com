#!/usr/bin/env tsx
/**
 * Catalog Integrity verification.
 * AGENT #097
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { CATALOG_INTEGRITY, runCatalogIntegrity, STATE_PATH } from "./CatalogIntegrityManager.js";
import { OUTPUT_DIR } from "./PublicationAuditReporter.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
const SOS_ROOT = join(REPO_ROOT, "SOS");

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function main(): void {
  assert(CATALOG_INTEGRITY.module === "catalog-integrity", "module id");
  assert(CATALOG_INTEGRITY.agent === "097", "agent number");

  const preState = JSON.parse(readFileSync(STATE_PATH, "utf8")) as {
    next_agent: string;
    latest_release: string;
    latest_catalog: string;
  };
  assert(
    preState.next_agent === "097" || preState.latest_agent === "097",
    "pre-flight: expected agent #097",
  );

  const { result, artifacts, pendingQueue } = runCatalogIntegrity();

  const required = [
    "catalog-integrity.json",
    "catalog-conflicts.json",
    "publication-safety.json",
    "catalog-history.json",
    "resolution-plan.md",
    "publication-audit.md",
  ];
  for (const file of required) {
    assert(existsSync(join(OUTPUT_DIR, file)), `artifact exists: ${file}`);
  }

  const saved = JSON.parse(readFileSync(STATE_PATH, "utf8")) as {
    latest_agent: string;
    next_agent: string;
    operations: { catalog_integrity: Record<string, unknown> };
  };
  assert(saved.latest_agent === "097", "project state latest_agent");
  assert(saved.next_agent === "098", "project state next_agent");
  assert(saved.operations?.catalog_integrity?.last_run, "operations.catalog_integrity");

  const checks = result.safety.checks;
  assert(checks.unique_catalog_ids, "unique catalog IDs");
  assert(checks.unique_template_ids, "unique template IDs");
  assert(checks.unique_slugs, "unique slugs");
  assert(checks.unique_seo_routes, "unique SEO routes");
  assert(checks.unique_registry_entries, "unique registry entries");
  assert(checks.unique_release_ids, "unique release IDs");
  assert(checks.publication_consistency, "publication consistency");
  assert(checks.rollback_consistency, "rollback consistency");
  assert(checks.live_layer_no_critical_conflicts, "live layer no critical conflicts");
  assert(checks.pipeline_conflicts_documented, "pipeline conflicts documented");

  assert(result.resolutions.length > 0, "resolution plan for pipeline conflict");
  assert(existsSync(join(OUTPUT_DIR, "resolution-plan.md")), "resolution-plan.md");

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "catalog-integrity",
        agent: "097",
        output_dir: artifacts.output_dir,
        conflicts_detected: result.conflicts.length,
        resolutions: result.resolutions.length,
        next_available_catalog_id: result.next_available_catalog_id,
        safe_to_publish: result.safety.safe_to_publish,
        next_safe_candidate: pendingQueue.find((p) => p.safe && p.catalog_id !== "t094") ?? null,
        pending_queue_safe: pendingQueue.filter((p) => p.safe).length,
        pending_queue_blocked: pendingQueue.filter((p) => !p.safe).length,
        checks,
      },
      null,
      2,
    ),
  );
}

main();
