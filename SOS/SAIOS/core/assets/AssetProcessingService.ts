/**
 * StudiosisLab Asset Processing Pipeline — Agent #244.
 * EXPORT_BUILT → assets/ (PNG+WebP). Never publishes. Never writes website.
 */
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import sharp from "sharp";
import {
  findReservationByCandidate,
  getReservation,
  listReservations,
  updateReservationStatus,
} from "../export/CatalogueReservation.js";
import { EXPORT_PACKAGES_ROOT } from "../export/ExportService.js";
import type { AssetPlan, ExportOrigin } from "../export/types.js";
import {
  ASSET_PIPELINE_VERSION,
  type AssetFingerprintDoc,
  type AssetFingerprintEntry,
  type AssetProcessingResult,
  type AssetReportDoc,
  type CompatibilityDoc,
} from "./types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const FAILURES_ROOT = join(REPO, "SOS/07_LOGS/saios/export/asset-failures");

/** Catalog-card thumbnail width; height follows A4 aspect from preview. */
const THUMB_WIDTH = 400;
const PREVIEW_MIN_WIDTH = 700;
const PREVIEW_MIN_HEIGHT = 990;
const THUMB_MIN_WIDTH = 180;
const THUMB_MIN_HEIGHT = 250;
const WEBP_QUALITY = 88;
const A4_ASPECT = 794 / 1123;

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

function resolveExportPackageId(input: {
  export_package_id?: string | null;
  candidate_id?: string | null;
}): string {
  if (input.export_package_id) return input.export_package_id;
  if (input.candidate_id) {
    const r = findReservationByCandidate(input.candidate_id);
    if (r?.export_package_id) return r.export_package_id;
  }
  throw new Error("export_package_id or candidate_id with EXPORT_BUILT package required");
}

function findReservationForExport(exportPackageId: string) {
  return (
    listReservations().find((r) => r.export_package_id === exportPackageId) ??
    null
  );
}

function resolveSourcePath(repoRelativeOrAbs: string, pkgDir: string): string {
  if (existsSync(repoRelativeOrAbs)) return repoRelativeOrAbs;
  const fromRepo = join(REPO, repoRelativeOrAbs);
  if (existsSync(fromRepo)) return fromRepo;
  // Prefer package-local evidence copies
  const localPreview = join(pkgDir, "sources", "preview-source.png");
  const localThumb = join(pkgDir, "sources", "thumbnail-source.png");
  if (repoRelativeOrAbs.includes("preview") && existsSync(localPreview)) {
    return localPreview;
  }
  if (repoRelativeOrAbs.includes("thumbnail") && existsSync(localThumb)) {
    return localThumb;
  }
  return fromRepo;
}

async function validatePngBuffer(
  path: string,
  kind: "preview" | "thumbnail",
): Promise<{
  ok: boolean;
  width: number;
  height: number;
  bytes: number;
  errors: string[];
  warnings: string[];
  checks: Record<string, boolean>;
}> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const checks: Record<string, boolean> = {};
  if (!existsSync(path)) {
    return {
      ok: false,
      width: 0,
      height: 0,
      bytes: 0,
      errors: [`missing ${kind} file`],
      warnings,
      checks: { exists: false },
    };
  }
  const bytes = statSync(path).size;
  checks.non_zero_size = bytes > 0;
  if (bytes <= 0) errors.push(`${kind} has zero filesize`);

  let width = 0;
  let height = 0;
  try {
    const meta = await sharp(path).metadata();
    width = Number(meta.width ?? 0);
    height = Number(meta.height ?? 0);
    checks.not_corrupt = Boolean(meta.format);
    checks.has_dimensions = width > 0 && height > 0;
    if (!checks.has_dimensions) errors.push(`${kind} missing dimensions`);
  } catch (e) {
    checks.not_corrupt = false;
    errors.push(
      `${kind} corrupt: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  const aspect = height > 0 ? width / height : 0;
  checks.aspect_near_a4 =
    aspect > 0 && Math.abs(aspect - A4_ASPECT) / A4_ASPECT < 0.12;
  if (!checks.aspect_near_a4 && width > 0) {
    warnings.push(
      `${kind} aspect ${aspect.toFixed(3)} differs from A4 ${A4_ASPECT.toFixed(3)}`,
    );
  }

  if (kind === "preview") {
    checks.min_resolution = width >= PREVIEW_MIN_WIDTH && height >= PREVIEW_MIN_HEIGHT;
    if (!checks.min_resolution) {
      errors.push(
        `preview below minimum resolution (${PREVIEW_MIN_WIDTH}x${PREVIEW_MIN_HEIGHT})`,
      );
    }
    checks.reasonable_filesize = bytes > 10_000 && bytes < 25_000_000;
  } else {
    checks.min_resolution = width >= THUMB_MIN_WIDTH && height >= THUMB_MIN_HEIGHT;
    if (!checks.min_resolution) {
      errors.push(
        `thumbnail below minimum resolution (${THUMB_MIN_WIDTH}x${THUMB_MIN_HEIGHT})`,
      );
    }
    checks.reasonable_filesize = bytes > 1_000 && bytes < 5_000_000;
  }
  if (!checks.reasonable_filesize) {
    errors.push(`${kind} filesize out of range (${bytes} bytes)`);
  }

  // Quality heuristics without redesign: opaque/alpha stats + non-blank sample
  try {
    const { data, info } = await sharp(path)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let transparent = 0;
    let nearWhite = 0;
    let nearBlack = 0;
    const pixels = info.width * info.height;
    const step = Math.max(1, Math.floor(pixels / 4000));
    for (let i = 0; i < pixels; i += step) {
      const o = i * info.channels;
      const r = data[o] ?? 0;
      const g = data[o + 1] ?? 0;
      const b = data[o + 2] ?? 0;
      const a = data[o + 3] ?? 255;
      if (a < 16) transparent += 1;
      if (r > 245 && g > 245 && b > 245) nearWhite += 1;
      if (r < 12 && g < 12 && b < 12) nearBlack += 1;
    }
    const samples = Math.ceil(pixels / step);
    const transparentRatio = transparent / samples;
    const whiteRatio = nearWhite / samples;
    checks.no_majority_transparent = transparentRatio < 0.35;
    checks.background_integrity = whiteRatio < 0.995;
    checks.not_blank = whiteRatio < 0.99 && nearBlack / samples < 0.99;
    if (!checks.no_majority_transparent) {
      errors.push(`${kind} has excessive transparent pixels`);
    }
    if (!checks.not_blank) {
      errors.push(`${kind} appears blank/degenerate`);
    }
    if (!checks.background_integrity) {
      warnings.push(`${kind} is nearly all white — verify content`);
    }
    checks.readable_typography_proxy = checks.not_blank && checks.min_resolution;
    checks.no_severe_compression_proxy = bytes > (kind === "preview" ? 40_000 : 3_000);
    checks.safe_margins_proxy = checks.aspect_near_a4 || checks.min_resolution;
  } catch {
    checks.quality_sample_ok = false;
    warnings.push(`${kind} quality sample skipped`);
  }

  return {
    ok: errors.length === 0,
    width,
    height,
    bytes,
    errors,
    warnings,
    checks,
  };
}

async function writeLosslessPng(src: string, dest: string): Promise<void> {
  // Archival PNG: copy bytes when already PNG; otherwise encode once losslessly.
  const meta = await sharp(src).metadata();
  if (meta.format === "png") {
    copyFileSync(src, dest);
    return;
  }
  await sharp(src).png({ compressionLevel: 9, effort: 7 }).toFile(dest);
}

async function writeWebp(src: string, dest: string): Promise<void> {
  await sharp(src)
    .webp({ quality: WEBP_QUALITY, alphaQuality: 90, effort: 5 })
    .toFile(dest);
}

async function writeThumbnailPngFromPreview(
  previewSrc: string,
  dest: string,
): Promise<void> {
  const meta = await sharp(previewSrc).metadata();
  const w = Number(meta.width ?? 794);
  const h = Number(meta.height ?? 1123);
  const targetH = Math.max(1, Math.round((THUMB_WIDTH * h) / w));
  await sharp(previewSrc)
    .resize(THUMB_WIDTH, targetH, { fit: "fill" })
    .png({ compressionLevel: 9, effort: 7 })
    .toFile(dest);
}

export function getAssetProcessingStatus(input: {
  export_package_id?: string | null;
  candidate_id?: string | null;
}): {
  export_package_id: string | null;
  reservation_status: string | null;
  assets_ready: boolean;
  assets: string[];
  report_path: string | null;
  publication_allowed: false;
} {
  try {
    const id = resolveExportPackageId(input);
    const dir = join(EXPORT_PACKAGES_ROOT, id);
    const reservation = findReservationForExport(id);
    const assetsDir = join(dir, "assets");
    const assets = existsSync(assetsDir)
      ? readdirSync(assetsDir).filter((f) => /\.(png|webp)$/i.test(f))
      : [];
    return {
      export_package_id: id,
      reservation_status: reservation?.status ?? null,
      assets_ready:
        reservation?.status === "ASSETS_READY" &&
        assets.includes("preview.png") &&
        assets.includes("preview.webp") &&
        assets.includes("thumbnail.png") &&
        assets.includes("thumbnail.webp"),
      assets: assets.map((a) => `assets/${a}`),
      report_path: existsSync(join(dir, "asset-report.json"))
        ? relative(REPO, join(dir, "asset-report.json")).replace(/\\/g, "/")
        : null,
      publication_allowed: false,
    };
  } catch {
    return {
      export_package_id: null,
      reservation_status: null,
      assets_ready: false,
      assets: [],
      report_path: null,
      publication_allowed: false,
    };
  }
}

export async function processExportAssets(input: {
  export_package_id?: string | null;
  candidate_id?: string | null;
  actor?: string;
}): Promise<AssetProcessingResult> {
  process.env.SOS_AIOS_LIVE = "0";

  const fail = (
    export_package_id: string,
    error: string,
    status: AssetProcessingResult["status"] = "ASSET_PROCESSING_FAILED",
  ): AssetProcessingResult => ({
    ok: false,
    idempotent: false,
    export_package_id,
    export_path: existsSync(join(EXPORT_PACKAGES_ROOT, export_package_id))
      ? relative(REPO, join(EXPORT_PACKAGES_ROOT, export_package_id)).replace(
          /\\/g,
          "/",
        )
      : null,
    status,
    assets: [],
    report_path: null,
    error,
    publication_allowed: false,
  });

  let export_package_id = "";
  try {
    export_package_id = resolveExportPackageId(input);
    const pkgDir = join(EXPORT_PACKAGES_ROOT, export_package_id);
    if (!existsSync(join(pkgDir, "asset-plan.json"))) {
      return fail(export_package_id, "Export package missing asset-plan.json", "REJECTED");
    }
    if (!existsSync(join(pkgDir, "origin.json"))) {
      return fail(export_package_id, "Not a valid export package", "REJECTED");
    }

    const reservation = findReservationForExport(export_package_id);
    if (!reservation) {
      return fail(
        export_package_id,
        "No reservation linked to export package",
        "REJECTED",
      );
    }
    if (
      ["FAILED", "ROLLED_BACK", "CANCELLED", "ASSET_PROCESSING_FAILED"].includes(
        reservation.status,
      )
    ) {
      // Allow retry from ASSET_PROCESSING_FAILED
      if (reservation.status !== "ASSET_PROCESSING_FAILED") {
        return fail(
          export_package_id,
          `Reservation status ${reservation.status} cannot process assets`,
          "REJECTED",
        );
      }
    }
    if (
      reservation.status !== "EXPORT_BUILT" &&
      reservation.status !== "ASSETS_READY" &&
      reservation.status !== "READY_FOR_RELEASE" &&
      reservation.status !== "ASSET_PROCESSING_FAILED"
    ) {
      return fail(
        export_package_id,
        `Only EXPORT_BUILT (or retry ASSET_PROCESSING_FAILED / idempotent ASSETS_READY) allowed — is ${reservation.status}`,
        "REJECTED",
      );
    }

    // Idempotent success
    if (
      reservation.status === "ASSETS_READY" ||
      reservation.status === "READY_FOR_RELEASE"
    ) {
      const assetsDir = join(pkgDir, "assets");
      const required = [
        "preview.png",
        "preview.webp",
        "thumbnail.png",
        "thumbnail.webp",
      ];
      if (
        required.every((f) => existsSync(join(assetsDir, f))) &&
        existsSync(join(pkgDir, "asset-fingerprint.json")) &&
        existsSync(join(pkgDir, "compatibility.json")) &&
        existsSync(join(pkgDir, "asset-report.json"))
      ) {
        return {
          ok: true,
          idempotent: true,
          export_package_id,
          export_path: relative(REPO, pkgDir).replace(/\\/g, "/"),
          status: "ASSETS_READY",
          assets: required.map((f) => `assets/${f}`),
          report_path: relative(REPO, join(pkgDir, "asset-report.json")).replace(
            /\\/g,
            "/",
          ),
          error: null,
          publication_allowed: false,
        };
      }
    }

    const plan = JSON.parse(
      readFileSync(join(pkgDir, "asset-plan.json"), "utf8"),
    ) as AssetPlan;
    const origin = JSON.parse(
      readFileSync(join(pkgDir, "origin.json"), "utf8"),
    ) as ExportOrigin;

    const previewSrc = resolveSourcePath(plan.source_preview, pkgDir);
    const thumbSrc = resolveSourcePath(plan.source_thumbnail, pkgDir);
    if (!existsSync(previewSrc)) {
      updateReservationStatus({
        reservation_id: reservation.reservation_id,
        status: "ASSET_PROCESSING_FAILED",
        reason: `Missing preview source: ${plan.source_preview}`,
      });
      return fail(export_package_id, `Missing preview PNG source: ${previewSrc}`);
    }
    if (!existsSync(thumbSrc)) {
      updateReservationStatus({
        reservation_id: reservation.reservation_id,
        status: "ASSET_PROCESSING_FAILED",
        reason: `Missing thumbnail source: ${plan.source_thumbnail}`,
      });
      return fail(
        export_package_id,
        `Missing thumbnail PNG source: ${thumbSrc}`,
      );
    }

    // Clean stale tmp
    for (const name of readdirSync(pkgDir)) {
      if (name.startsWith(".tmp-assets-")) {
        rmSync(join(pkgDir, name), { recursive: true, force: true });
      }
    }

    const tmpName = `.tmp-assets-${Date.now().toString(36)}`;
    const tmpDir = join(pkgDir, tmpName);
    const tmpAssets = join(tmpDir, "assets");
    mkdirSync(tmpAssets, { recursive: true });

    try {
      // PNG archival: preview = lossless copy of source preview
      await writeLosslessPng(previewSrc, join(tmpAssets, "preview.png"));
      // Thumbnail PNG: derive from preview at catalog width (better than tiny source)
      await writeThumbnailPngFromPreview(
        previewSrc,
        join(tmpAssets, "thumbnail.png"),
      );
      // WebP production variants
      await writeWebp(join(tmpAssets, "preview.png"), join(tmpAssets, "preview.webp"));
      await writeWebp(
        join(tmpAssets, "thumbnail.png"),
        join(tmpAssets, "thumbnail.webp"),
      );

      const previewPngV = await validatePngBuffer(
        join(tmpAssets, "preview.png"),
        "preview",
      );
      const thumbPngV = await validatePngBuffer(
        join(tmpAssets, "thumbnail.png"),
        "thumbnail",
      );
      const previewWebpV = await validatePngBuffer(
        join(tmpAssets, "preview.webp"),
        "preview",
      );
      const thumbWebpV = await validatePngBuffer(
        join(tmpAssets, "thumbnail.webp"),
        "thumbnail",
      );

      const errors = [
        ...previewPngV.errors.map((e) => `preview.png: ${e}`),
        ...thumbPngV.errors.map((e) => `thumbnail.png: ${e}`),
        ...previewWebpV.errors.map((e) => `preview.webp: ${e}`),
        ...thumbWebpV.errors.map((e) => `thumbnail.webp: ${e}`),
      ];
      const warnings = [
        ...previewPngV.warnings,
        ...thumbPngV.warnings,
        ...previewWebpV.warnings,
        ...thumbWebpV.warnings,
      ];

      const quality_checks: Record<string, boolean> = {
        preview_png_ok: previewPngV.ok,
        thumbnail_png_ok: thumbPngV.ok,
        preview_webp_ok: previewWebpV.ok,
        thumbnail_webp_ok: thumbWebpV.ok,
        ...Object.fromEntries(
          Object.entries(previewPngV.checks).map(([k, v]) => [
            `preview_png_${k}`,
            v,
          ]),
        ),
        ...Object.fromEntries(
          Object.entries(thumbPngV.checks).map(([k, v]) => [
            `thumbnail_png_${k}`,
            v,
          ]),
        ),
      };

      // Fabric version from template.json if present
      let fabric_version = "6.9.1";
      const tplPath = join(pkgDir, "template.json");
      if (existsSync(tplPath)) {
        try {
          const tpl = JSON.parse(readFileSync(tplPath, "utf8")) as {
            version?: string;
          };
          fabric_version = String(tpl.version ?? fabric_version);
        } catch {
          /* keep default */
        }
      }

      const factory = existsSync(join(REPO, "SOS/project-state.json"))
        ? (JSON.parse(readFileSync(join(REPO, "SOS/project-state.json"), "utf8")) as {
            factory_version?: string;
          })
        : {};

      const compatibility: CompatibilityDoc = {
        export_schema: "export-package-1.0.0",
        manifest_schema: "studiosislab-manifest-draft-1.0.0",
        fabric_version,
        studiosislab_version: String(factory.factory_version ?? "1.5.0"),
        asset_pipeline_version: ASSET_PIPELINE_VERSION,
        compatible:
          errors.length === 0 &&
          fabric_version.startsWith("6.") &&
          Boolean(origin.export_package_id),
        future_notes: [
          "ReleaseManager must verify compatibility.json before publication.",
          "AVIF generation deferred to a later agent.",
          "Assets remain inside export package until Founder publish.",
        ],
        checked_at: new Date().toISOString(),
        publication_allowed: false,
      };
      if (!compatibility.compatible) {
        errors.push("compatibility check failed");
      }

      const now = new Date().toISOString();
      const fingerprintAssets: AssetFingerprintEntry[] = [];
      for (const rel of [
        "preview.png",
        "preview.webp",
        "thumbnail.png",
        "thumbnail.webp",
      ] as const) {
        const p = join(tmpAssets, rel);
        const meta = await sharp(p).metadata();
        fingerprintAssets.push({
          path: `assets/${rel}`,
          sha256: sha256File(p),
          width: Number(meta.width ?? 0),
          height: Number(meta.height ?? 0),
          format: rel.endsWith(".webp") ? "webp" : "png",
          filesize: statSync(p).size,
          created_at: now,
          generator_version: ASSET_PIPELINE_VERSION,
        });
      }

      const fingerprint: AssetFingerprintDoc = {
        schema_version: "asset-fingerprint-1.0.0",
        export_package_id,
        catalogue_id: plan.catalogue_id,
        generator_version: ASSET_PIPELINE_VERSION,
        created_at: now,
        assets: fingerprintAssets,
        publication_allowed: false,
      };

      const report: AssetReportDoc = {
        export_package_id,
        catalogue_id: plan.catalogue_id,
        pass: errors.length === 0,
        checked_at: now,
        png: {
          preview: {
            ok: previewPngV.ok,
            width: previewPngV.width,
            height: previewPngV.height,
            bytes: previewPngV.bytes,
          },
          thumbnail: {
            ok: thumbPngV.ok,
            width: thumbPngV.width,
            height: thumbPngV.height,
            bytes: thumbPngV.bytes,
          },
        },
        webp: {
          preview: {
            ok: previewWebpV.ok,
            width: previewWebpV.width,
            height: previewWebpV.height,
            bytes: previewWebpV.bytes,
          },
          thumbnail: {
            ok: thumbWebpV.ok,
            width: thumbWebpV.width,
            height: thumbWebpV.height,
            bytes: thumbWebpV.bytes,
          },
        },
        dimensions: {
          "assets/preview.png": {
            width: previewPngV.width,
            height: previewPngV.height,
            aspect:
              previewPngV.height > 0
                ? previewPngV.width / previewPngV.height
                : 0,
          },
          "assets/preview.webp": {
            width: previewWebpV.width,
            height: previewWebpV.height,
            aspect:
              previewWebpV.height > 0
                ? previewWebpV.width / previewWebpV.height
                : 0,
          },
          "assets/thumbnail.png": {
            width: thumbPngV.width,
            height: thumbPngV.height,
            aspect:
              thumbPngV.height > 0 ? thumbPngV.width / thumbPngV.height : 0,
          },
          "assets/thumbnail.webp": {
            width: thumbWebpV.width,
            height: thumbWebpV.height,
            aspect:
              thumbWebpV.height > 0 ? thumbWebpV.width / thumbWebpV.height : 0,
          },
        },
        quality_checks,
        compression_ratio: {
          preview_webp_vs_png:
            previewPngV.bytes > 0
              ? Number((previewWebpV.bytes / previewPngV.bytes).toFixed(4))
              : null,
          thumbnail_webp_vs_png:
            thumbPngV.bytes > 0
              ? Number((thumbWebpV.bytes / thumbPngV.bytes).toFixed(4))
              : null,
        },
        warnings,
        errors,
        status: errors.length === 0 ? "PASS" : "FAIL",
        publication_allowed: false,
      };

      atomicWriteJson(join(tmpDir, "asset-fingerprint.json"), fingerprint);
      atomicWriteJson(join(tmpDir, "compatibility.json"), compatibility);
      atomicWriteJson(join(tmpDir, "asset-report.json"), report);

      // Merge integrity
      const integrityPath = join(pkgDir, "integrity.json");
      const integrity = existsSync(integrityPath)
        ? (JSON.parse(readFileSync(integrityPath, "utf8")) as {
            algorithm: string;
            generated_at: string;
            export_package_id: string;
            files: Record<string, string>;
            package_digest?: string;
          })
        : {
            algorithm: "sha256",
            generated_at: now,
            export_package_id,
            files: {} as Record<string, string>,
          };

      for (const entry of fingerprintAssets) {
        integrity.files[entry.path] = entry.sha256;
      }
      integrity.files["asset-fingerprint.json"] = sha256File(
        join(tmpDir, "asset-fingerprint.json"),
      );
      integrity.files["compatibility.json"] = sha256File(
        join(tmpDir, "compatibility.json"),
      );
      integrity.files["asset-report.json"] = sha256File(
        join(tmpDir, "asset-report.json"),
      );
      integrity.generated_at = now;
      integrity.package_digest = sha256Json(integrity.files);
      atomicWriteJson(join(tmpDir, "integrity.json"), integrity);

      // Verify checksums re-read
      for (const entry of fingerprintAssets) {
        const again = sha256File(join(pkgDir, tmpName, entry.path));
        if (again !== entry.sha256) {
          errors.push(`checksum mismatch after write: ${entry.path}`);
        }
      }

      if (errors.length > 0) {
        mkdirSync(FAILURES_ROOT, { recursive: true });
        const failDir = join(
          FAILURES_ROOT,
          `${export_package_id}-${Date.now().toString(36)}`,
        );
        renameSync(tmpDir, failDir);
        report.pass = false;
        report.status = "FAIL";
        report.errors = errors;
        atomicWriteJson(join(failDir, "asset-report.json"), report);
        updateReservationStatus({
          reservation_id: reservation.reservation_id,
          status: "ASSET_PROCESSING_FAILED",
          reason: errors.join("; "),
        });
        return fail(export_package_id, errors.join("; "));
      }

      // Atomic promote: replace assets/ and write sidecar reports
      const finalAssets = join(pkgDir, "assets");
      if (existsSync(finalAssets)) {
        rmSync(finalAssets, { recursive: true, force: true });
      }
      renameSync(tmpAssets, finalAssets);
      // Move sidecars
      for (const name of [
        "asset-fingerprint.json",
        "compatibility.json",
        "asset-report.json",
        "integrity.json",
      ]) {
        renameSync(join(tmpDir, name), join(pkgDir, name));
      }
      rmSync(tmpDir, { recursive: true, force: true });

      // Re-verify integrity on final paths
      const finalIntegrity = JSON.parse(
        readFileSync(join(pkgDir, "integrity.json"), "utf8"),
      ) as { files: Record<string, string> };
      for (const [rel, sum] of Object.entries(finalIntegrity.files)) {
        if (!rel.startsWith("assets/") && !rel.startsWith("asset-") && rel !== "compatibility.json" && rel !== "integrity.json") {
          continue;
        }
        if (rel === "integrity.json") continue;
        const p = join(pkgDir, rel);
        if (!existsSync(p)) {
          throw new Error(`Promoted asset missing: ${rel}`);
        }
        if (sha256File(p) !== sum && rel !== "integrity.json") {
          // integrity.json itself was written before final path moves of reports — refresh asset hashes only
          if (rel.startsWith("assets/")) {
            throw new Error(`Post-promote checksum mismatch: ${rel}`);
          }
        }
      }
      // Refresh integrity hashes for sidecars after final placement
      finalIntegrity.files["asset-fingerprint.json"] = sha256File(
        join(pkgDir, "asset-fingerprint.json"),
      );
      finalIntegrity.files["compatibility.json"] = sha256File(
        join(pkgDir, "compatibility.json"),
      );
      finalIntegrity.files["asset-report.json"] = sha256File(
        join(pkgDir, "asset-report.json"),
      );
      for (const rel of [
        "assets/preview.png",
        "assets/preview.webp",
        "assets/thumbnail.png",
        "assets/thumbnail.webp",
      ]) {
        finalIntegrity.files[rel] = sha256File(join(pkgDir, rel));
      }
      const refreshed = {
        ...finalIntegrity,
        algorithm: "sha256",
        generated_at: new Date().toISOString(),
        export_package_id,
        package_digest: sha256Json(finalIntegrity.files),
      };
      atomicWriteJson(join(pkgDir, "integrity.json"), refreshed);

      updateReservationStatus({
        reservation_id: reservation.reservation_id,
        status: "ASSETS_READY",
        reason: `Assets processed by ${input.actor ?? "cli"} (${ASSET_PIPELINE_VERSION})`,
      });

      // Ensure reservation still resolvable
      void getReservation(reservation.reservation_id);

      return {
        ok: true,
        idempotent: false,
        export_package_id,
        export_path: relative(REPO, pkgDir).replace(/\\/g, "/"),
        status: "ASSETS_READY",
        assets: [
          "assets/preview.png",
          "assets/preview.webp",
          "assets/thumbnail.png",
          "assets/thumbnail.webp",
        ],
        report_path: relative(REPO, join(pkgDir, "asset-report.json")).replace(
          /\\/g,
          "/",
        ),
        error: null,
        publication_allowed: false,
      };
    } catch (inner) {
      if (existsSync(tmpDir)) {
        mkdirSync(FAILURES_ROOT, { recursive: true });
        const failDir = join(
          FAILURES_ROOT,
          `${export_package_id}-error-${Date.now().toString(36)}`,
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
    if (export_package_id) {
      const reservation = findReservationForExport(export_package_id);
      if (reservation) {
        try {
          updateReservationStatus({
            reservation_id: reservation.reservation_id,
            status: "ASSET_PROCESSING_FAILED",
            reason: detail,
          });
        } catch {
          /* ignore */
        }
      }
    }
    return fail(export_package_id || "unknown", detail);
  }
}
