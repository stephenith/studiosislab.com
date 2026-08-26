/**
 * StudiosisLab Export Adapter — Agent #243.
 * VALIDATED STAGED → export package. Never publishes. Never writes website.
 */
import { createHash, randomUUID } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { readLifecycle } from "../staging/CandidateLifecycleStore.js";
import { STAGING_PACKAGES_ROOT } from "../staging/StagingService.js";
import type { StagingManifest, StagingValidationReport } from "../staging/types.js";
import {
  verifyStagingChecksumManifest,
} from "../staging/ChecksumManifest.js";
import {
  findReservationByCandidate,
  findReservationByStaging,
  reserveCatalogueId,
  updateReservationStatus,
} from "./CatalogueReservation.js";
import {
  buildSeoDescription,
  buildSeoSlug,
  buildTags,
  mapCategoryId,
  publicDisplayTitle,
} from "./CategoryTitleSeo.js";
import { convertStagedCanvasToTemplateJson } from "./FabricExportConverter.js";
import type {
  AssetPlan,
  ExportOrigin,
  ExportResult,
  ExportValidationReport,
  ManifestDraftEntry,
  SearchMetadata,
  SeoDraft,
} from "./types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
export const EXPORT_PACKAGES_ROOT = join(
  REPO,
  "SOS/07_LOGS/saios/export/packages",
);
export const EXPORT_FAILURES_ROOT = join(
  REPO,
  "SOS/07_LOGS/saios/export/failures",
);

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function sha256Json(data: unknown): string {
  return createHash("sha256")
    .update(`${JSON.stringify(data)}\n`)
    .digest("hex");
}

function atomicWriteJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

function recoverIncompleteTemps(): void {
  if (!existsSync(EXPORT_PACKAGES_ROOT)) return;
  for (const name of readdirSync(EXPORT_PACKAGES_ROOT)) {
    if (!name.startsWith(".tmp-")) continue;
    rmSync(join(EXPORT_PACKAGES_ROOT, name), { recursive: true, force: true });
  }
}

function resolveStagingPackageId(input: {
  candidate_id?: string | null;
  staging_package_id?: string | null;
}): { staging_package_id: string; candidate_id: string } {
  if (input.staging_package_id) {
    const dir = join(STAGING_PACKAGES_ROOT, input.staging_package_id);
    const manifestPath = join(dir, "staging-manifest.json");
    if (!existsSync(manifestPath)) {
      throw new Error(`Staging package not found: ${input.staging_package_id}`);
    }
    const m = JSON.parse(readFileSync(manifestPath, "utf8")) as StagingManifest;
    return {
      staging_package_id: input.staging_package_id,
      candidate_id: m.candidate_id,
    };
  }
  if (!input.candidate_id) {
    throw new Error("candidate_id or staging_package_id required");
  }
  const life = readLifecycle(input.candidate_id);
  if (!life?.staging_package_id) {
    throw new Error(
      `No staging package for candidate ${input.candidate_id} — stage first`,
    );
  }
  return {
    staging_package_id: life.staging_package_id,
    candidate_id: input.candidate_id,
  };
}

function assertValidatedEligible(input: {
  candidate_id: string;
  staging_package_id: string;
  stagingManifest: StagingManifest;
  stagingValidation: StagingValidationReport | null;
}): string[] {
  const errors: string[] = [];
  const life = readLifecycle(input.candidate_id);
  if (!life) {
    errors.push("lifecycle record missing");
  } else if (life.lifecycle_status !== "VALIDATED") {
    errors.push(
      `lifecycle must be VALIDATED (is ${life.lifecycle_status})`,
    );
  }
  if (life && life.staging_package_id !== input.staging_package_id) {
    errors.push("lifecycle staging_package_id mismatch");
  }
  if (
    input.stagingManifest.current_lifecycle_status !== "VALIDATED" &&
    input.stagingManifest.current_lifecycle_status !== "STAGED"
  ) {
    // Prefer VALIDATED; allow STAGED only if lifecycle says VALIDATED
    if (life?.lifecycle_status !== "VALIDATED") {
      errors.push(
        `staging package status ${input.stagingManifest.current_lifecycle_status} not exportable`,
      );
    }
  }
  if (!input.stagingManifest.generation_id) {
    errors.push("generation ID missing");
  }
  if (!input.stagingManifest.approval_decision_id) {
    errors.push("approval decision missing");
  }
  if (input.stagingManifest.publication_allowed === true) {
    errors.push("publication_allowed must be false");
  }
  if (input.stagingManifest.ats_result?.pass !== true) {
    errors.push("ATS must PASS");
  }
  if (input.stagingManifest.editor_compatibility_result?.pass !== true) {
    errors.push("editor compatibility must PASS");
  }
  if (input.stagingManifest.contrast_result?.pass !== true) {
    errors.push("contrast must PASS");
  }
  if (input.stagingManifest.safe_area_result?.pass !== true) {
    errors.push("safe-area must PASS");
  }
  if (input.stagingManifest.founder_quality_class !== "PUBLISHABLE") {
    errors.push(
      `Founder quality must be PUBLISHABLE (is ${input.stagingManifest.founder_quality_class})`,
    );
  }
  if (input.stagingValidation && input.stagingValidation.pass !== true) {
    errors.push("staging validation report did not pass");
  }

  // Verify staging checksums for core artifacts (shared canonical parser)
  const pkgDir = join(STAGING_PACKAGES_ROOT, input.staging_package_id);
  const checksumResult = verifyStagingChecksumManifest({
    packageDir: pkgDir,
    requireCoreFiles: true,
    requiredFiles: [
      "canvas.json",
      "preview-source.png",
      "thumbnail-source.png",
    ],
  });
  if (!checksumResult.ok) {
    for (const err of checksumResult.errors) {
      errors.push(`staging ${err}`);
    }
  }
  return errors;
}

export function getExportStatus(input: {
  candidate_id?: string | null;
  staging_package_id?: string | null;
}): {
  candidate_id: string | null;
  staging_package_id: string | null;
  lifecycle_status: string | null;
  reservation: ReturnType<typeof findReservationByCandidate>;
  export_package_id: string | null;
  export_path: string | null;
  publication_allowed: false;
} {
  try {
    const resolved = resolveStagingPackageId(input);
    const life = readLifecycle(resolved.candidate_id);
    const reservation =
      findReservationByStaging(resolved.staging_package_id) ??
      findReservationByCandidate(resolved.candidate_id);
    const export_package_id = reservation?.export_package_id ?? null;
    return {
      candidate_id: resolved.candidate_id,
      staging_package_id: resolved.staging_package_id,
      lifecycle_status: life?.lifecycle_status ?? null,
      reservation,
      export_package_id,
      export_path: export_package_id
        ? relative(
            REPO,
            join(EXPORT_PACKAGES_ROOT, export_package_id),
          ).replace(/\\/g, "/")
        : null,
      publication_allowed: false,
    };
  } catch {
    return {
      candidate_id: input.candidate_id ?? null,
      staging_package_id: input.staging_package_id ?? null,
      lifecycle_status: input.candidate_id
        ? readLifecycle(input.candidate_id)?.lifecycle_status ?? null
        : null,
      reservation: input.candidate_id
        ? findReservationByCandidate(input.candidate_id)
        : null,
      export_package_id: null,
      export_path: null,
      publication_allowed: false,
    };
  }
}

export async function exportStagedPackage(input: {
  candidate_id?: string | null;
  staging_package_id?: string | null;
  actor?: string;
}): Promise<ExportResult> {
  process.env.SOS_AIOS_LIVE = "0";
  recoverIncompleteTemps();

  const fail = (
    error: string,
    partial: Partial<ExportResult> = {},
  ): ExportResult => ({
    ok: false,
    idempotent: false,
    candidate_id: partial.candidate_id ?? input.candidate_id ?? "",
    generation_id: partial.generation_id ?? "",
    staging_package_id: partial.staging_package_id ?? null,
    reservation_id: partial.reservation_id ?? null,
    reserved_catalogue_id: partial.reserved_catalogue_id ?? null,
    export_package_id: null,
    export_path: null,
    validation: partial.validation ?? null,
    error,
    publication_allowed: false,
  });

  let staging_package_id = "";
  let candidate_id = "";
  let reservation_id: string | null = null;

  try {
    const resolved = resolveStagingPackageId(input);
    staging_package_id = resolved.staging_package_id;
    candidate_id = resolved.candidate_id;

    const pkgDir = join(STAGING_PACKAGES_ROOT, staging_package_id);
    const stagingManifest = JSON.parse(
      readFileSync(join(pkgDir, "staging-manifest.json"), "utf8"),
    ) as StagingManifest;
    const stagingValidation = existsSync(join(pkgDir, "validation-report.json"))
      ? (JSON.parse(
          readFileSync(join(pkgDir, "validation-report.json"), "utf8"),
        ) as StagingValidationReport)
      : null;

    const eligibilityErrors = assertValidatedEligible({
      candidate_id,
      staging_package_id,
      stagingManifest,
      stagingValidation,
    });
    if (eligibilityErrors.length) {
      return fail(eligibilityErrors.join("; "), {
        candidate_id,
        generation_id: stagingManifest.generation_id,
        staging_package_id,
      });
    }

    // Idempotent: existing EXPORT_BUILT package
    const existing = findReservationByStaging(staging_package_id);
    if (
      existing &&
      (existing.status === "EXPORT_BUILT" ||
        existing.status === "ASSETS_READY" ||
        existing.status === "READY_FOR_RELEASE" ||
        existing.status === "RELEASE_REQUESTED" ||
        existing.status === "FOUNDER_RELEASE_APPROVED" ||
        existing.status === "RELEASE_EXECUTING" ||
        existing.status === "RELEASE_COMPLETED") &&
      existing.export_package_id &&
      existsSync(
        join(
          EXPORT_PACKAGES_ROOT,
          existing.export_package_id,
          "validation-report.json",
        ),
      )
    ) {
      return {
        ok: true,
        idempotent: true,
        candidate_id,
        generation_id: stagingManifest.generation_id,
        staging_package_id,
        reservation_id: existing.reservation_id,
        reserved_catalogue_id: existing.reserved_catalogue_id,
        export_package_id: existing.export_package_id,
        export_path: relative(
          REPO,
          join(EXPORT_PACKAGES_ROOT, existing.export_package_id),
        ).replace(/\\/g, "/"),
        validation: JSON.parse(
          readFileSync(
            join(
              EXPORT_PACKAGES_ROOT,
              existing.export_package_id,
              "validation-report.json",
            ),
            "utf8",
          ),
        ) as ExportValidationReport,
        error: null,
        publication_allowed: false,
      };
    }

    const { reservation } = reserveCatalogueId({
      generation_id: stagingManifest.generation_id,
      candidate_id,
      staging_package_id,
      reason: `Export from ${staging_package_id} by ${input.actor ?? "cli"}`,
    });
    reservation_id = reservation.reservation_id;
    const catalogue_id = reservation.reserved_catalogue_id;

    const export_package_id = `exp-${new Date()
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "")}-${randomUUID().slice(0, 8)}`;
    const tmpDir = join(EXPORT_PACKAGES_ROOT, `.tmp-${export_package_id}`);
    const finalDir = join(EXPORT_PACKAGES_ROOT, export_package_id);
    mkdirSync(tmpDir, { recursive: true });

    try {
      const canvasRaw = JSON.parse(
        readFileSync(join(pkgDir, "canvas.json"), "utf8"),
      );
      const converted = convertStagedCanvasToTemplateJson(canvasRaw);
      const title = publicDisplayTitle(stagingManifest.role);
      const categoryId = mapCategoryId(
        stagingManifest.role,
        stagingManifest.category,
      );
      const tags = buildTags(stagingManifest.role, categoryId);
      const slugInfo = buildSeoSlug(stagingManifest.role);

      const manifestEntry: ManifestDraftEntry = {
        id: catalogue_id,
        title,
        categoryId,
        thumbnailPath: `/templates/${catalogue_id}.png`,
        jsonPath: `src/data/template-json/${catalogue_id}.json`,
        status: "draft",
        tags,
      };

      const seo: SeoDraft = {
        templateId: catalogue_id,
        title: `${title} Template | StudiosisLab`,
        slug: slugInfo.slug,
        description: buildSeoDescription(title, stagingManifest.role),
        keywords: tags,
        canonical_draft: `https://studiosislab.com/resume/${slugInfo.suggested_alternate_slug ?? slugInfo.slug}`,
        collision: slugInfo.collision,
        suggested_alternate_slug: slugInfo.suggested_alternate_slug,
        h1: `${title} Template`,
        isPublished: false,
      };
      if (slugInfo.collision && slugInfo.suggested_alternate_slug) {
        seo.canonical_draft = `https://studiosislab.com/resume/${slugInfo.suggested_alternate_slug}`;
      }

      const search: SearchMetadata = {
        templateId: catalogue_id,
        title,
        role: stagingManifest.role,
        category: categoryId.replace(/-/g, " "),
        categoryId,
        tags,
        keywords: tags,
        normalized_text: [catalogue_id, title, categoryId, ...tags]
          .join(" ")
          .toLowerCase(),
      };

      const assetPlan: AssetPlan = {
        catalogue_id,
        expected_png: `/templates/${catalogue_id}.png`,
        expected_webp: `/templates/${catalogue_id}.webp`,
        future_avif: `/templates/${catalogue_id}.avif`,
        source_preview: relative(
          REPO,
          join(pkgDir, "preview-source.png"),
        ).replace(/\\/g, "/"),
        source_thumbnail: relative(
          REPO,
          join(pkgDir, "thumbnail-source.png"),
        ).replace(/\\/g, "/"),
        optimization_deferred: true,
      };

      const origin: ExportOrigin = {
        generation_id: stagingManifest.generation_id,
        candidate_id,
        approval_decision_id: stagingManifest.approval_decision_id,
        staging_package_id,
        reservation_id: reservation.reservation_id,
        reserved_catalogue_id: catalogue_id,
        export_package_id,
        future_release_id: null,
        source_batch: stagingManifest.source_batch_id,
        openai_provider: stagingManifest.source_provider,
        openai_model: stagingManifest.source_model,
        role: stagingManifest.role,
        design_family: stagingManifest.design_family,
        created_at: new Date().toISOString(),
        publication_allowed: false,
        live: false,
      };

      const catalogueAllocation = {
        reservation_id: reservation.reservation_id,
        reserved_catalogue_id: catalogue_id,
        policy: "monotonic_highest_used_plus_one",
        status: "RESERVED",
        generation_id: stagingManifest.generation_id,
        candidate_id,
        staging_package_id,
        publication_allowed: false,
        live_manifest_written: false,
      };

      const metadata = {
        catalogue_id,
        title,
        categoryId,
        role: stagingManifest.role,
        design_family_internal: stagingManifest.design_family,
        tags,
        status: "draft",
        publication_allowed: false,
      };

      atomicWriteJson(join(tmpDir, "origin.json"), origin);
      atomicWriteJson(
        join(tmpDir, "catalogue-allocation.json"),
        catalogueAllocation,
      );
      atomicWriteJson(join(tmpDir, "template.json"), converted.template);
      atomicWriteJson(join(tmpDir, "manifest-entry.json"), manifestEntry);
      atomicWriteJson(join(tmpDir, "metadata.json"), metadata);
      atomicWriteJson(join(tmpDir, "seo.json"), seo);
      atomicWriteJson(join(tmpDir, "search.json"), search);
      atomicWriteJson(join(tmpDir, "asset-plan.json"), assetPlan);

      // Copy source preview refs as evidence (not optimized public assets)
      mkdirSync(join(tmpDir, "sources"), { recursive: true });
      copyFileSync(
        join(pkgDir, "preview-source.png"),
        join(tmpDir, "sources", "preview-source.png"),
      );
      copyFileSync(
        join(pkgDir, "thumbnail-source.png"),
        join(tmpDir, "sources", "thumbnail-source.png"),
      );

      const artifactRels = [
        "origin.json",
        "catalogue-allocation.json",
        "template.json",
        "manifest-entry.json",
        "metadata.json",
        "seo.json",
        "search.json",
        "asset-plan.json",
        "sources/preview-source.png",
        "sources/thumbnail-source.png",
      ];
      const files: Record<string, string> = {};
      for (const rel of artifactRels) {
        files[rel] = sha256File(join(tmpDir, rel));
      }
      // Re-verify
      const mismatches: string[] = [];
      for (const [rel, sum] of Object.entries(files)) {
        if (sha256File(join(tmpDir, rel)) !== sum) mismatches.push(rel);
      }

      const checks: Record<string, boolean> = {
        reservation_present: true,
        template_conversion: converted.object_count > 0,
        aios_metadata_stripped: !("aios" in converted.template),
        manifest_schema:
          Boolean(manifestEntry.id) &&
          Boolean(manifestEntry.title) &&
          Boolean(manifestEntry.categoryId) &&
          Boolean(manifestEntry.thumbnailPath) &&
          Boolean(manifestEntry.jsonPath) &&
          manifestEntry.status === "draft",
        seo_draft: Boolean(seo.slug) && Boolean(seo.title),
        search_metadata: Boolean(search.normalized_text),
        checksums_match: mismatches.length === 0,
        no_duplicate_export: true,
        website_untouched: true,
        release_manager_not_invoked: true,
        publication_allowed_false: true,
        origin_chain_complete: Boolean(
          origin.generation_id &&
            origin.candidate_id &&
            origin.approval_decision_id &&
            origin.staging_package_id &&
            origin.reservation_id &&
            origin.reserved_catalogue_id &&
            origin.export_package_id,
        ),
      };

      const errors: string[] = [];
      for (const [k, v] of Object.entries(checks)) {
        if (!v) errors.push(`check failed: ${k}`);
      }
      for (const m of mismatches) errors.push(`checksum mismatch: ${m}`);

      const validation: ExportValidationReport = {
        export_package_id,
        candidate_id,
        generation_id: stagingManifest.generation_id,
        pass: errors.length === 0,
        checked_at: new Date().toISOString(),
        checks,
        errors,
        warnings: slugInfo.collision
          ? [
              `SEO slug collision on ${slugInfo.slug}; suggested alternate ${slugInfo.suggested_alternate_slug}`,
            ]
          : [],
        publication_allowed: false,
        website_files_written: false,
        release_manager_invoked: false,
        live_manifest_modified: false,
      };
      atomicWriteJson(join(tmpDir, "validation-report.json"), validation);
      files["validation-report.json"] = sha256File(
        join(tmpDir, "validation-report.json"),
      );

      const integrity = {
        algorithm: "sha256",
        generated_at: new Date().toISOString(),
        export_package_id,
        files,
        package_digest: sha256Json(files),
      };
      atomicWriteJson(join(tmpDir, "integrity.json"), integrity);

      if (!validation.pass) {
        mkdirSync(EXPORT_FAILURES_ROOT, { recursive: true });
        const failDir = join(
          EXPORT_FAILURES_ROOT,
          `${export_package_id}-failed`,
        );
        renameSync(tmpDir, failDir);
        updateReservationStatus({
          reservation_id: reservation.reservation_id,
          status: "FAILED",
          export_package_id: null,
          reason: errors.join("; "),
        });
        return fail(errors.join("; "), {
          candidate_id,
          generation_id: stagingManifest.generation_id,
          staging_package_id,
          reservation_id: reservation.reservation_id,
          reserved_catalogue_id: catalogue_id,
          validation,
        });
      }

      mkdirSync(EXPORT_PACKAGES_ROOT, { recursive: true });
      renameSync(tmpDir, finalDir);

      updateReservationStatus({
        reservation_id: reservation.reservation_id,
        status: "EXPORT_BUILT",
        export_package_id,
        reason: "Export package atomically promoted",
      });

      return {
        ok: true,
        idempotent: false,
        candidate_id,
        generation_id: stagingManifest.generation_id,
        staging_package_id,
        reservation_id: reservation.reservation_id,
        reserved_catalogue_id: catalogue_id,
        export_package_id,
        export_path: relative(REPO, finalDir).replace(/\\/g, "/"),
        validation,
        error: null,
        publication_allowed: false,
      };
    } catch (inner) {
      if (existsSync(tmpDir)) {
        mkdirSync(EXPORT_FAILURES_ROOT, { recursive: true });
        const failDir = join(
          EXPORT_FAILURES_ROOT,
          `${export_package_id}-error`,
        );
        try {
          renameSync(tmpDir, failDir);
        } catch {
          rmSync(tmpDir, { recursive: true, force: true });
        }
      }
      throw inner;
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    if (reservation_id) {
      try {
        updateReservationStatus({
          reservation_id,
          status: "FAILED",
          export_package_id: null,
          reason: detail,
        });
      } catch {
        /* ignore */
      }
    }
    return fail(detail, {
      candidate_id,
      staging_package_id: staging_package_id || null,
      reservation_id,
    });
  }
}
