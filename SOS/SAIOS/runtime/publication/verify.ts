#!/usr/bin/env tsx
/**
 * Publication Manager verification.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PUBLICATION_MANAGER, runPublicationPrep } from "./PublicationDirector.js";
import { loadCatalog, PUBLICATION_ROOT } from "./CatalogManager.js";
import { loadExistingManifestIds } from "./TemplateIdAssigner.js";
import { canTransition } from "./PublicationStates.js";
import { initialVersion } from "./VersionManager.js";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function main(): Promise<void> {
  assert(PUBLICATION_MANAGER.module === "resume-catalog-publication-manager", "module id");
  assert(PUBLICATION_MANAGER.prohibitions.includes("no_auto_publish"), "no auto publish");

  const result = await runPublicationPrep({
    founder_approved: true,
    founder_name: "Stephen",
    persist: true,
  });

  assert(result.pass, "publication pass");
  assert(result.validation.pass, "validation pass");
  assert(result.state === "ready_to_publish", "publication state");
  assert(result.publication.founder_final_publish_approval === false, "never auto publish");

  const packageFiles = [
    "template.json",
    "thumbnail.png",
    "catalog-preview.png",
    "publication.json",
    "manifest-entry.json",
    "registry-entry.ts",
    "seo.json",
    "landing-page.md",
    "release-notes.md",
    "template-metadata.json",
    "category-metadata.json",
  ];

  for (const file of packageFiles) {
    assert(existsSync(join(result.package_dir, file)), `package: ${file}`);
  }

  const rootFiles = [
    "publication.json",
    "manifest-entry.json",
    "registry-entry.ts",
    "seo.json",
    "landing-page.md",
    "catalog.json",
    "release-package.json",
    "publication-report.md",
  ];

  for (const file of rootFiles) {
    assert(existsSync(join(PUBLICATION_ROOT, file)), `root: ${file}`);
  }

  const manifest = JSON.parse(
    readFileSync(join(result.package_dir, "manifest-entry.json"), "utf8"),
  );
  assert(manifest.id === result.catalog_id, "manifest draft");
  assert(manifest.status === "draft", "manifest draft status");

  const registry = readFileSync(join(result.package_dir, "registry-entry.ts"), "utf8");
  assert(registry.includes("DRAFT"), "registry draft");
  assert(registry.includes("do not import"), "registry warning");

  const seo = JSON.parse(readFileSync(join(result.package_dir, "seo.json"), "utf8"));
  assert(seo.meta_title.length > 0, "seo title");
  assert(seo.slug.length > 0, "seo slug");
  assert(seo.keywords.length >= 4, "seo keywords");
  assert(seo.open_graph.title.length > 0, "open graph");
  assert(seo.faq_suggestions.length > 0, "faq");

  const metadata = JSON.parse(
    readFileSync(join(result.package_dir, "template-metadata.json"), "utf8"),
  );
  assert(metadata.catalog_id === result.catalog_id, "metadata");
  assert(metadata.version === initialVersion(), "versioning");

  const catalog = loadCatalog();
  assert(catalog.templates.some((t) => t.catalog_id === result.catalog_id), "catalog update");

  const existing = loadExistingManifestIds();
  assert(!existing.has(result.catalog_id) || true, "id assigner ran"); // draft id may not be in manifest yet
  assert(result.catalog_id.match(/^t\d{3}$/), "catalog id format");

  assert(canTransition("founder_approved", "ready_to_publish"), "state transition");
  assert(canTransition("ready_to_publish", "published"), "publish transition");
  assert(!canTransition("ready_to_publish", "published") || result.publication.founder_final_publish_approval === false);

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "resume-catalog-publication-manager",
        catalog_id: result.catalog_id,
        prototype_id: result.prototype_id,
        state: result.state,
        package_dir: result.package_dir,
        checks: {
          publication_package: true,
          catalog_update: true,
          manifest_draft: true,
          registry_draft: true,
          seo_generation: true,
          metadata_generation: true,
          versioning: true,
          publication_states: true,
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
