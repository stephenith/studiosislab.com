/**
 * Publication Director — prepare founder-approved templates for publication.
 * Never generates designs, researches, performs QA, or publishes automatically.
 */
import {
  collectApprovalContext,
  findFounderApprovedPrototype,
} from "./ApprovalCollector.js";
import { validatePublicationPackage, assertCatalogIdUnique } from "./PackageValidator.js";
import { assignPermanentTemplateId, loadExistingManifestIds } from "./TemplateIdAssigner.js";
import { prepareThumbnails, copyTemplateJson } from "./ThumbnailPreparer.js";
import { buildTemplateMetadata, buildCategoryMetadata, newPublicationId } from "./MetadataBuilder.js";
import { buildSEODraft, buildLandingPageMarkdown } from "./SEODraftBuilder.js";
import { buildManifestDraft, buildRegistryDraft } from "./ManifestDraftBuilder.js";
import { upsertCatalogEntry, PUBLICATION_ROOT } from "./CatalogManager.js";
import { resolvePublicationState } from "./PublicationStates.js";
import { initialVersion } from "./VersionManager.js";
import { buildReleasePackage, buildReleaseNotes } from "./ReleasePackageBuilder.js";
import { persistPublicationArtifacts, resolvePackageDir } from "./PublicationReporter.js";
import { appendPublicationMemory } from "./PublicationMemory.js";
import type { PublicationRecord, PublicationRunOptions, PublicationRunResult } from "./types.js";

export const PUBLICATION_MANAGER = {
  module: "resume-catalog-publication-manager",
  version: "1.0.0",
  role: "publication_preparation_only",
  description:
    "Converts founder-approved templates into production-ready draft assets. Never publishes automatically.",
  prohibitions: [
    "no_resume_generation",
    "no_research",
    "no_qa_execution",
    "no_auto_publish",
    "no_src_modification",
    "no_manifest_update",
    "no_registry_update",
  ],
} as const;

export async function runPublicationPrep(
  options: PublicationRunOptions = {},
): Promise<PublicationRunResult> {
  const prototype_dir = options.prototype_dir ?? findFounderApprovedPrototype();
  const ctx = collectApprovalContext(prototype_dir);
  const founder_approved = options.founder_approved === true;

  if (!founder_approved) {
    throw new Error("Founder approval required — set founder_approved: true after founder review");
  }

  const catalog_id = assignPermanentTemplateId(ctx.prototype_id);
  const existing_ids = loadExistingManifestIds();
  if (!assertCatalogIdUnique(catalog_id, existing_ids)) {
    throw new Error(`Catalog ID collision: ${catalog_id}`);
  }

  const package_dir = resolvePackageDir(catalog_id);

  let validation = validatePublicationPackage({
    ctx,
    founder_approved,
    catalog_id,
    package_dir,
  });
  validation = {
    ...validation,
    checks: { ...validation.checks, catalog_id_unique: assertCatalogIdUnique(catalog_id, existing_ids) },
    pass: validation.pass && assertCatalogIdUnique(catalog_id, existing_ids),
  };

  const state = resolvePublicationState({
    founder_approved,
    validation_pass: validation.pass,
  });

  copyTemplateJson({ prototype_dir, package_dir });
  prepareThumbnails({ prototype_dir, package_dir, catalog_id });

  const metadata = buildTemplateMetadata({
    ctx,
    catalog_id,
    state,
    founder_name: options.founder_name ?? "Stephen",
    version: initialVersion(),
  });

  const seo = buildSEODraft(ctx, catalog_id);
  const manifest = buildManifestDraft(metadata, seo);
  const registry = buildRegistryDraft(metadata, seo);
  const category = buildCategoryMetadata(metadata.category_id);
  const landing_page = buildLandingPageMarkdown(seo, metadata);
  const release_notes = buildReleaseNotes(metadata);
  const release = buildReleasePackage({
    catalog_id,
    prototype_id: ctx.prototype_id,
    state,
    package_dir,
    manifest,
  });

  const publication: PublicationRecord = {
    publication_id: newPublicationId(),
    catalog_id,
    prototype_id: ctx.prototype_id,
    state,
    founder_approved: true,
    founder_final_publish_approval: false,
    prepared_at: new Date().toISOString(),
    package_dir,
    artifacts: [],
    validation_pass: validation.pass,
  };

  upsertCatalogEntry(
    {
      ...metadata,
      slug: seo.slug,
      thumbnail_path: `/templates/${catalog_id}.webp`,
    },
    options.persist !== false,
  );

  const artifact_paths = persistPublicationArtifacts({
    package_dir,
    publication,
    metadata,
    category,
    seo,
    manifest,
    registry,
    release,
    release_notes,
    landing_page,
    persist: options.persist,
  });

  publication.artifacts = artifact_paths.map((p) => p.replace(PUBLICATION_ROOT + "/", ""));

  appendPublicationMemory(
    {
      recorded_at: new Date().toISOString(),
      source: "publication_prep",
      catalog_id,
      prototype_id: ctx.prototype_id,
      state,
      note: `Publication package prepared — ${state}`,
    },
    options.persist !== false,
  );

  return {
    pass: validation.pass,
    catalog_id,
    prototype_id: ctx.prototype_id,
    output_root: PUBLICATION_ROOT,
    package_dir,
    state,
    publication,
    validation,
    artifacts: publication.artifacts,
  };
}
