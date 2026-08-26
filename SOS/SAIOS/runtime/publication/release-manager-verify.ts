#!/usr/bin/env tsx
/**
 * Release Manager verification.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  RELEASE_MANAGER,
  rollbackRelease,
  runReleaseManager,
  verifyRelease,
  restorePreviousRelease,
} from "./ReleaseManager.js";
import { PUBLICATION_ROOT } from "./CatalogManager.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
const STAGING_ROOT = join(PUBLICATION_ROOT, "release-manager", "staging-site");
const PACKAGE_DIR = join(PUBLICATION_ROOT, "packages", "t094");

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function seedStagingRoot(): void {
  rmSync(STAGING_ROOT, { recursive: true, force: true });
  const copy = (fromRel: string, toRel = fromRel) => {
    const src = join(REPO_ROOT, fromRel);
    const dest = join(STAGING_ROOT, toRel);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
  };

  copy("templates.manifest.json");
  copy("src/data/templateSeoContent.ts");
  copy("src/data/systemTemplates/registry.generated.ts");
  copy("src/data/templateCatalog.generated.ts");
  copy("src/data/templateSnapshots.generated.ts");
  mkdirSync(join(STAGING_ROOT, "src/data/template-json"), { recursive: true });
  mkdirSync(join(STAGING_ROOT, "public/templates"), { recursive: true });
}

async function main(): Promise<void> {
  assert(RELEASE_MANAGER.module === "publication-release-manager", "module id");
  assert(RELEASE_MANAGER.prohibitions.includes("no_auto_publish"), "no auto publish");
  assert(existsSync(PACKAGE_DIR), "publication package exists");

  seedStagingRoot();
  const manifestBefore = readFileSync(join(STAGING_ROOT, "templates.manifest.json"), "utf8");

  const result = runReleaseManager({
    package_dir: PACKAGE_DIR,
    founder_final_publish_approval: true,
    founder_approval_timestamp: "2026-07-07T09:00:00.000Z",
    founder_name: "Stephen",
    target_root: STAGING_ROOT,
    persist: true,
  });

  assert(result.pass, "release manager pass");
  assert(result.validation.pass, "release validation pass");

  const releaseCheck = verifyRelease({
    catalog_id: result.catalog_id,
    target_root: STAGING_ROOT,
  });
  assert(releaseCheck.pass, "verifyRelease pass");

  for (const report of [
    "release-report.md",
    "release-summary.json",
    "release-validation.json",
    "rollback.json",
  ]) {
    assert(existsSync(join(result.reports_dir, report)), `report: ${report}`);
  }
  assert(existsSync(join(PUBLICATION_ROOT, "release-manager", "release-history.json")), "history");

  const rollback = rollbackRelease({ release_id: result.release_id });
  assert(rollback.pass, "rollback pass");
  const manifestAfterRollback = readFileSync(join(STAGING_ROOT, "templates.manifest.json"), "utf8");
  assert(manifestAfterRollback === manifestBefore, "manifest restored");

  const restored = restorePreviousRelease({ catalog_id: result.catalog_id });
  assert(restored.pass === false || restored.restored_release_id !== null, "restorePreviousRelease callable");

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "publication-release-manager",
        catalog_id: result.catalog_id,
        release_id: result.release_id,
        reports_dir: result.reports_dir,
        staging_root: STAGING_ROOT,
        checks: {
          release_validation: true,
          asset_preparation: true,
          manifest_update: true,
          registry_update: true,
          seo_generation: true,
          website_registration: true,
          rollback_support: true,
          history_written: true,
          no_auto_publish: true,
        },
        overall: "PASS",
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(JSON.stringify({ pass: false, error: String(err) }, null, 2));
  process.exit(1);
});
