/**
 * StudiosisLab Publication Readiness Validator — Agent #245.
 * ASSETS_READY → READY_FOR_RELEASE (dry-run only). Never publishes.
 */
import { createHash } from "node:crypto";
import {
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
import {
  findReservationByCandidate,
  listReservations,
  updateReservationStatus,
} from "../export/CatalogueReservation.js";
import { EXPORT_PACKAGES_ROOT } from "../export/ExportService.js";
import type {
  AssetPlan,
  ExportOrigin,
  ManifestDraftEntry,
  SeoDraft,
} from "../export/types.js";
import {
  PUBLICATION_READINESS_VERSION,
  type DryRunSimulationReport,
  type DryRunStep,
  type PublicationReadinessDoc,
  type PublicationReadinessResult,
} from "./types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const FAILURES_ROOT = join(
  REPO,
  "SOS/07_LOGS/saios/export/publication-readiness-failures",
);

const REQUIRED_FILES = [
  "origin.json",
  "catalogue-allocation.json",
  "template.json",
  "manifest-entry.json",
  "metadata.json",
  "seo.json",
  "search.json",
  "asset-plan.json",
  "asset-report.json",
  "asset-fingerprint.json",
  "compatibility.json",
  "integrity.json",
  "validation-report.json",
] as const;

const REQUIRED_ASSETS = [
  "assets/preview.png",
  "assets/preview.webp",
  "assets/thumbnail.png",
  "assets/thumbnail.webp",
] as const;

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function atomicWriteJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
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
  throw new Error(
    "export_package_id or candidate_id with ASSETS_READY package required",
  );
}

function findReservationForExport(exportPackageId: string) {
  return (
    listReservations().find((r) => r.export_package_id === exportPackageId) ??
    null
  );
}

function loadExistingSlugs(): Set<string> {
  const set = new Set<string>();
  const seoPath = join(REPO, "src/data/templateSeoContent.ts");
  if (!existsSync(seoPath)) return set;
  const raw = readFileSync(seoPath, "utf8");
  for (const m of raw.matchAll(/slug:\s*"([^"]+)"/g)) {
    set.add(m[1]!.toLowerCase());
  }
  return set;
}

function validatePackageFiles(pkgDir: string): {
  ok: boolean;
  errors: string[];
  checks: Record<string, boolean>;
} {
  const checks: Record<string, boolean> = {};
  const errors: string[] = [];
  for (const f of REQUIRED_FILES) {
    const ok = existsSync(join(pkgDir, f));
    checks[`file_${f}`] = ok;
    if (!ok) errors.push(`missing required file: ${f}`);
  }
  return { ok: errors.length === 0, errors, checks };
}

function validateManifest(
  pkgDir: string,
  catalogueId: string,
): { ok: boolean; errors: string[]; warnings: string[]; checks: Record<string, boolean> } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const checks: Record<string, boolean> = {};
  const me = readJson<ManifestDraftEntry>(join(pkgDir, "manifest-entry.json"));
  checks.required_id = Boolean(me.id);
  checks.required_title = Boolean(me.title?.trim());
  checks.required_category = Boolean(me.categoryId?.trim());
  checks.required_thumbnail = Boolean(me.thumbnailPath?.trim());
  checks.required_json_path = Boolean(me.jsonPath?.trim());
  checks.status_draft = me.status === "draft";
  checks.id_matches_reservation = me.id === catalogueId;
  checks.thumbnail_path_shape = me.thumbnailPath === `/templates/${catalogueId}.png`;
  checks.json_path_shape =
    me.jsonPath === `src/data/template-json/${catalogueId}.json`;
  checks.no_design_family_in_title = !/executive|contemporary|editorial|technical|modern_v/i.test(
    me.title ?? "",
  );
  for (const [k, v] of Object.entries(checks)) {
    if (!v) errors.push(`manifest: ${k} failed`);
  }
  if (!Array.isArray(me.tags) || me.tags.length === 0) {
    warnings.push("manifest tags empty");
  }
  return { ok: errors.length === 0, errors, warnings, checks };
}

function validateFabric(pkgDir: string): {
  ok: boolean;
  errors: string[];
  warnings: string[];
  checks: Record<string, boolean>;
  fabric_version: string;
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const checks: Record<string, boolean> = {};
  const tpl = readJson<Record<string, unknown>>(join(pkgDir, "template.json"));
  const fabric_version = String(tpl.version ?? "");
  checks.fabric_version_6 = fabric_version.startsWith("6.");
  checks.has_width = Number(tpl.width) === 794 || Number(tpl.width) > 0;
  checks.has_height = Number(tpl.height) === 1123 || Number(tpl.height) > 0;
  checks.a4_dimensions =
    Number(tpl.width) === 794 && Number(tpl.height) === 1123;
  checks.has_objects =
    Array.isArray(tpl.objects) && (tpl.objects as unknown[]).length > 0;
  checks.no_aios_root = !("aios" in tpl) && !("saios" in tpl);
  checks.no_generation_metadata =
    !("generation_id" in tpl) && !("candidate_id" in tpl);

  const objects = Array.isArray(tpl.objects)
    ? (tpl.objects as Array<Record<string, unknown>>)
    : [];
  const fonts = new Set<string>();
  let hasText = false;
  for (const o of objects) {
    if (o.aios || o.saios) checks.no_aios_on_objects = false;
    if (typeof o.fontFamily === "string") fonts.add(o.fontFamily);
    if (/text/i.test(String(o.type ?? ""))) hasText = true;
  }
  if (checks.no_aios_on_objects === undefined) checks.no_aios_on_objects = true;
  checks.has_text_objects = hasText;
  checks.fonts_present = fonts.size > 0 || !hasText;
  checks.editor_compatible_types = objects.every((o) => {
    const t = String(o.type ?? "").toLowerCase();
    return [
      "rect",
      "textbox",
      "i-text",
      "text",
      "line",
      "circle",
      "triangle",
      "path",
      "group",
      "image",
      "",
    ].includes(t);
  });

  for (const [k, v] of Object.entries(checks)) {
    if (!v) errors.push(`fabric: ${k} failed`);
  }
  if (!checks.a4_dimensions && checks.has_width && checks.has_height) {
    warnings.push(
      `fabric dimensions ${tpl.width}x${tpl.height} (expected 794x1123)`,
    );
  }
  return { ok: errors.length === 0, errors, warnings, checks, fabric_version };
}

function validateSeo(
  pkgDir: string,
  catalogueId: string,
): { ok: boolean; errors: string[]; warnings: string[]; checks: Record<string, boolean> } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const checks: Record<string, boolean> = {};
  const seo = readJson<SeoDraft>(join(pkgDir, "seo.json"));
  checks.has_slug = Boolean(seo.slug?.trim());
  checks.has_title = Boolean(seo.title?.trim());
  checks.has_description = Boolean(seo.description?.trim());
  checks.has_canonical = Boolean(seo.canonical_draft?.trim());
  checks.template_id_match = seo.templateId === catalogueId;
  checks.not_published = seo.isPublished === false;
  checks.collision_flag_boolean = typeof seo.collision === "boolean";

  const existing = loadExistingSlugs();
  const slugTaken = existing.has(String(seo.slug).toLowerCase());
  checks.collision_state_consistent =
    seo.collision === slugTaken ||
    (seo.collision === true && Boolean(seo.suggested_alternate_slug));
  if (seo.collision && !seo.suggested_alternate_slug) {
    errors.push("seo: collision true but no suggested_alternate_slug");
  }
  if (seo.collision) {
    warnings.push(
      `seo slug collision on ${seo.slug}; alternate ${seo.suggested_alternate_slug}`,
    );
  }
  for (const [k, v] of Object.entries(checks)) {
    if (!v) errors.push(`seo: ${k} failed`);
  }
  return { ok: errors.length === 0, errors, warnings, checks };
}

function validateAssets(pkgDir: string): {
  ok: boolean;
  errors: string[];
  warnings: string[];
  checks: Record<string, boolean>;
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const checks: Record<string, boolean> = {};
  for (const rel of REQUIRED_ASSETS) {
    const p = join(pkgDir, rel);
    const ok = existsSync(p) && statSync(p).size > 0;
    checks[`asset_${rel}`] = ok;
    if (!ok) errors.push(`asset missing or empty: ${rel}`);
  }

  const report = readJson<{
    pass?: boolean;
    status?: string;
    png?: unknown;
    webp?: unknown;
  }>(join(pkgDir, "asset-report.json"));
  checks.asset_report_pass =
    report.pass === true && report.status === "PASS";
  if (!checks.asset_report_pass) errors.push("asset-report did not PASS");

  const fp = readJson<{
    assets?: Array<{ path: string; sha256: string; width: number; height: number }>;
  }>(join(pkgDir, "asset-fingerprint.json"));
  checks.fingerprint_entries =
    Array.isArray(fp.assets) && fp.assets.length >= 4;
  if (!checks.fingerprint_entries) {
    errors.push("asset-fingerprint incomplete");
  } else {
    for (const a of fp.assets ?? []) {
      const p = join(pkgDir, a.path);
      if (!existsSync(p) || sha256File(p) !== a.sha256) {
        errors.push(`fingerprint mismatch: ${a.path}`);
        checks[`fingerprint_${a.path}`] = false;
      } else {
        checks[`fingerprint_${a.path}`] = true;
      }
      if (!(a.width > 0 && a.height > 0)) {
        errors.push(`fingerprint dimensions invalid: ${a.path}`);
      }
    }
  }

  const plan = readJson<AssetPlan>(join(pkgDir, "asset-plan.json"));
  checks.asset_plan_has_catalogue = Boolean(plan.catalogue_id);
  if (!checks.asset_plan_has_catalogue) errors.push("asset-plan missing catalogue_id");

  return { ok: errors.length === 0, errors, warnings, checks };
}

function validateIntegrity(pkgDir: string): {
  ok: boolean;
  errors: string[];
  checks: Record<string, boolean>;
} {
  const errors: string[] = [];
  const checks: Record<string, boolean> = {};
  const integrity = readJson<{
    files?: Record<string, string>;
    algorithm?: string;
  }>(join(pkgDir, "integrity.json"));
  checks.algorithm_sha256 = integrity.algorithm === "sha256";
  checks.has_files = Boolean(integrity.files && Object.keys(integrity.files).length > 0);
  for (const rel of [
    ...REQUIRED_ASSETS,
    "asset-fingerprint.json",
    "compatibility.json",
    "asset-report.json",
    "template.json",
    "manifest-entry.json",
    "origin.json",
  ]) {
    const expected = integrity.files?.[rel];
    const p = join(pkgDir, rel);
    if (!expected) {
      // older integrity may omit some — warn via check false only for assets
      if (rel.startsWith("assets/") || rel.startsWith("asset-") || rel === "compatibility.json") {
        checks[`integrity_${rel}`] = false;
        errors.push(`integrity missing entry: ${rel}`);
      }
      continue;
    }
    if (!existsSync(p)) {
      checks[`integrity_${rel}`] = false;
      errors.push(`integrity target missing: ${rel}`);
      continue;
    }
    const match = sha256File(p) === expected;
    checks[`integrity_${rel}`] = match;
    if (!match) errors.push(`integrity checksum mismatch: ${rel}`);
  }
  return { ok: errors.length === 0, errors, checks };
}

function validateCompatibility(pkgDir: string): {
  ok: boolean;
  errors: string[];
  checks: Record<string, boolean>;
} {
  const errors: string[] = [];
  const checks: Record<string, boolean> = {};
  const c = readJson<{
    compatible?: boolean;
    export_schema?: string;
    manifest_schema?: string;
    fabric_version?: string;
    asset_pipeline_version?: string;
    publication_allowed?: boolean;
  }>(join(pkgDir, "compatibility.json"));
  checks.compatible_flag = c.compatible === true;
  checks.export_schema = c.export_schema === "export-package-1.0.0";
  checks.manifest_schema =
    c.manifest_schema === "studiosislab-manifest-draft-1.0.0";
  checks.fabric_version = String(c.fabric_version ?? "").startsWith("6.");
  checks.asset_pipeline_version = Boolean(c.asset_pipeline_version);
  checks.publication_still_false = c.publication_allowed === false;
  for (const [k, v] of Object.entries(checks)) {
    if (!v) errors.push(`compatibility: ${k} failed`);
  }
  return { ok: errors.length === 0, errors, checks };
}

function buildDryRunSimulation(input: {
  export_package_id: string;
  catalogue_id: string;
  pkgDir: string;
}): DryRunSimulationReport {
  const id = input.catalogue_id;
  const steps: DryRunStep[] = [
    {
      step: "manifest_insertion",
      action: "Merge manifest-entry.json into templates.manifest.json",
      target: "templates.manifest.json",
      would_write: true,
      simulated: true,
      ok: existsSync(join(input.pkgDir, "manifest-entry.json")),
      detail: `Would insert draft id=${id} with status=draft (not executed)`,
    },
    {
      step: "registry_generation",
      action: "Run templates:sync to regenerate registries",
      target: "src/data/*generated.ts",
      would_write: true,
      simulated: true,
      ok: true,
      detail: "Would regenerate registry/catalog/snapshots (not executed)",
    },
    {
      step: "seo_merge",
      action: "Merge seo.json into templateSeoContent.ts",
      target: "src/data/templateSeoContent.ts",
      would_write: true,
      simulated: true,
      ok: existsSync(join(input.pkgDir, "seo.json")),
      detail: "Would append SEO draft with isPublished gated by Founder (not executed)",
    },
    {
      step: "asset_copy",
      action: "Copy assets PNG/WebP into public/templates",
      target: `public/templates/${id}.png|.webp`,
      would_write: true,
      simulated: true,
      ok: REQUIRED_ASSETS.every((a) => existsSync(join(input.pkgDir, a))),
      detail: "Would copy production assets (not executed)",
    },
    {
      step: "template_installation",
      action: "Install template.json into src/data/template-json",
      target: `src/data/template-json/${id}.json`,
      would_write: true,
      simulated: true,
      ok: existsSync(join(input.pkgDir, "template.json")),
      detail: "Would install Fabric template JSON (not executed)",
    },
    {
      step: "release_manager",
      action: "Invoke ReleaseManager with founder_final_publish_approval",
      target: "SOS/SAIOS/runtime/publication/ReleaseManager.ts",
      would_write: true,
      simulated: true,
      ok: true,
      detail: "Dry-run only — ReleaseManager was NOT invoked",
    },
  ];
  return {
    schema_version: "publication-dry-run-1.0.0",
    export_package_id: input.export_package_id,
    catalogue_id: id,
    simulated_at: new Date().toISOString(),
    website_modified: false,
    release_manager_invoked: false,
    steps,
    pass: steps.every((s) => s.ok),
    publication_allowed: false,
  };
}

export function getPublicationReadinessStatus(input: {
  export_package_id?: string | null;
  candidate_id?: string | null;
}): {
  export_package_id: string | null;
  reservation_status: string | null;
  ready_for_release: boolean;
  report_path: string | null;
  simulation_path: string | null;
  publication_allowed: false;
} {
  try {
    const id = resolveExportPackageId(input);
    const dir = join(EXPORT_PACKAGES_ROOT, id);
    const reservation = findReservationForExport(id);
    return {
      export_package_id: id,
      reservation_status: reservation?.status ?? null,
      ready_for_release: reservation?.status === "READY_FOR_RELEASE",
      report_path: existsSync(join(dir, "publication-readiness.json"))
        ? relative(REPO, join(dir, "publication-readiness.json")).replace(
            /\\/g,
            "/",
          )
        : null,
      simulation_path: existsSync(join(dir, "publication-dry-run.json"))
        ? relative(REPO, join(dir, "publication-dry-run.json")).replace(
            /\\/g,
            "/",
          )
        : null,
      publication_allowed: false,
    };
  } catch {
    return {
      export_package_id: null,
      reservation_status: null,
      ready_for_release: false,
      report_path: null,
      simulation_path: null,
      publication_allowed: false,
    };
  }
}

export async function validatePublicationReadiness(input: {
  export_package_id?: string | null;
  candidate_id?: string | null;
  actor?: string;
}): Promise<PublicationReadinessResult> {
  process.env.SOS_AIOS_LIVE = "0";

  const fail = (
    export_package_id: string,
    error: string,
    status: PublicationReadinessResult["status"] = "PUBLICATION_VALIDATION_FAILED",
  ): PublicationReadinessResult => ({
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
    ready_for_release: false,
    report_path: null,
    simulation_path: null,
    error,
    publication_allowed: false,
  });

  let export_package_id = "";
  try {
    export_package_id = resolveExportPackageId(input);
    const pkgDir = join(EXPORT_PACKAGES_ROOT, export_package_id);
    if (!existsSync(pkgDir)) {
      return fail(export_package_id, "Export package directory missing", "REJECTED");
    }

    const reservation = findReservationForExport(export_package_id);
    if (!reservation) {
      return fail(export_package_id, "No reservation for export package", "REJECTED");
    }

    const rejectedStatuses = [
      "EXPORT_BUILT",
      "FAILED",
      "ROLLED_BACK",
      "CANCELLED",
      "ASSET_PROCESSING_FAILED",
      "RESERVED",
    ];
    if (rejectedStatuses.includes(reservation.status)) {
      return fail(
        export_package_id,
        `Reservation status ${reservation.status} rejected — require ASSETS_READY`,
        "REJECTED",
      );
    }

    if (
      reservation.status !== "ASSETS_READY" &&
      reservation.status !== "READY_FOR_RELEASE" &&
      reservation.status !== "PUBLICATION_VALIDATION_FAILED"
    ) {
      return fail(
        export_package_id,
        `Unsupported reservation status ${reservation.status}`,
        "REJECTED",
      );
    }

    // Idempotent
    if (
      reservation.status === "READY_FOR_RELEASE" &&
      existsSync(join(pkgDir, "publication-readiness.json")) &&
      existsSync(join(pkgDir, "publication-dry-run.json"))
    ) {
      const existing = readJson<PublicationReadinessDoc>(
        join(pkgDir, "publication-readiness.json"),
      );
      if (existing.ready_for_release && existing.status === "PASS") {
        return {
          ok: true,
          idempotent: true,
          export_package_id,
          export_path: relative(REPO, pkgDir).replace(/\\/g, "/"),
          status: "READY_FOR_RELEASE",
          ready_for_release: true,
          report_path: relative(
            REPO,
            join(pkgDir, "publication-readiness.json"),
          ).replace(/\\/g, "/"),
          simulation_path: relative(
            REPO,
            join(pkgDir, "publication-dry-run.json"),
          ).replace(/\\/g, "/"),
          error: null,
          publication_allowed: false,
        };
      }
    }

    const origin = readJson<ExportOrigin>(join(pkgDir, "origin.json"));
    const catalogue_id =
      reservation.reserved_catalogue_id ||
      readJson<{ reserved_catalogue_id?: string }>(
        join(pkgDir, "catalogue-allocation.json"),
      ).reserved_catalogue_id ||
      "";

    const files = validatePackageFiles(pkgDir);
    const manifest = existsSync(join(pkgDir, "manifest-entry.json"))
      ? validateManifest(pkgDir, catalogue_id)
      : {
          ok: false,
          errors: ["manifest-entry.json missing"],
          warnings: [] as string[],
          checks: { manifest_entry_exists: false },
        };
    const fabric = existsSync(join(pkgDir, "template.json"))
      ? validateFabric(pkgDir)
      : {
          ok: false,
          errors: ["template.json missing"],
          warnings: [] as string[],
          checks: { template_exists: false },
          fabric_version: "",
        };
    const seo = existsSync(join(pkgDir, "seo.json"))
      ? validateSeo(pkgDir, catalogue_id)
      : {
          ok: false,
          errors: ["seo.json missing"],
          warnings: [] as string[],
          checks: { seo_exists: false },
        };
    const assets =
      existsSync(join(pkgDir, "asset-report.json")) &&
      existsSync(join(pkgDir, "asset-fingerprint.json"))
        ? validateAssets(pkgDir)
        : {
            ok: false,
            errors: ["asset report/fingerprint missing"],
            warnings: [] as string[],
            checks: { assets_meta_exists: false },
          };
    const integrity = existsSync(join(pkgDir, "integrity.json"))
      ? validateIntegrity(pkgDir)
      : {
          ok: false,
          errors: ["integrity.json missing"],
          checks: { integrity_exists: false },
        };
    const compatibility = existsSync(join(pkgDir, "compatibility.json"))
      ? validateCompatibility(pkgDir)
      : {
          ok: false,
          errors: ["compatibility.json missing"],
          checks: { compatibility_exists: false },
        };
    const dryRun = buildDryRunSimulation({
      export_package_id,
      catalogue_id,
      pkgDir,
    });

    // Origin chain
    const originChecks: Record<string, boolean> = {
      origin_generation_id: Boolean(origin.generation_id),
      origin_candidate_id: Boolean(origin.candidate_id),
      origin_staging: Boolean(origin.staging_package_id),
      origin_reservation: origin.reservation_id === reservation.reservation_id,
      origin_catalogue: origin.reserved_catalogue_id === catalogue_id,
      origin_export: origin.export_package_id === export_package_id,
      origin_publication_false: origin.publication_allowed === false,
      origin_future_release_null: origin.future_release_id === null,
    };

    const checks: Record<string, boolean> = {
      ...files.checks,
      ...manifest.checks,
      ...fabric.checks,
      ...seo.checks,
      ...assets.checks,
      ...integrity.checks,
      ...compatibility.checks,
      ...originChecks,
      dry_run_pass: dryRun.pass,
      dry_run_no_website_write: dryRun.website_modified === false,
      dry_run_no_release_manager: dryRun.release_manager_invoked === false,
    };

    const blocking_issues = [
      ...files.errors,
      ...manifest.errors,
      ...fabric.errors,
      ...seo.errors,
      ...assets.errors,
      ...integrity.errors,
      ...compatibility.errors,
      ...Object.entries(originChecks)
        .filter(([, v]) => !v)
        .map(([k]) => `origin: ${k} failed`),
    ];
    if (!dryRun.pass) blocking_issues.push("dry-run simulation failed");

    const warnings = [
      ...manifest.warnings,
      ...fabric.warnings,
      ...seo.warnings,
      ...assets.warnings,
    ];

    const pass = blocking_issues.length === 0;
    const factory = existsSync(join(REPO, "SOS/project-state.json"))
      ? readJson<{ factory_version?: string }>(
          join(REPO, "SOS/project-state.json"),
        )
      : {};
    const release_version = `${factory.factory_version ?? "1.5.0"}-ready-${catalogue_id}`;

    const readiness: PublicationReadinessDoc = {
      schema_version: "publication-readiness-1.0.0",
      export_package_id,
      catalogue_id,
      reservation_id: reservation.reservation_id,
      status: pass ? "PASS" : "FAIL",
      ready_for_release: pass,
      release_version,
      publication_readiness_version: PUBLICATION_READINESS_VERSION,
      checked_at: new Date().toISOString(),
      blocking_issues,
      warnings,
      checks,
      sections: {
        package_files: files.ok,
        manifest: manifest.ok,
        fabric: fabric.ok,
        seo: seo.ok,
        assets: assets.ok,
        integrity: integrity.ok,
        compatibility: compatibility.ok,
        dry_run: dryRun.pass,
      },
      future_release_manager_compatible: pass && compatibility.ok,
      publication_allowed: false,
      live: false,
      website_files_written: false,
      release_manager_invoked: false,
    };

    // Write via temp then promote sidecars (do not mutate template/manifest drafts)
    const tmpDir = join(pkgDir, `.tmp-pubready-${Date.now().toString(36)}`);
    mkdirSync(tmpDir, { recursive: true });
    try {
      atomicWriteJson(join(tmpDir, "publication-readiness.json"), readiness);
      atomicWriteJson(join(tmpDir, "publication-dry-run.json"), dryRun);

      // Merge into integrity
      const integrityPath = join(pkgDir, "integrity.json");
      const integ = existsSync(integrityPath)
        ? readJson<{
            algorithm: string;
            generated_at: string;
            export_package_id: string;
            files: Record<string, string>;
            package_digest?: string;
          }>(integrityPath)
        : {
            algorithm: "sha256",
            generated_at: new Date().toISOString(),
            export_package_id,
            files: {} as Record<string, string>,
          };
      integ.files["publication-readiness.json"] = sha256File(
        join(tmpDir, "publication-readiness.json"),
      );
      integ.files["publication-dry-run.json"] = sha256File(
        join(tmpDir, "publication-dry-run.json"),
      );
      integ.generated_at = new Date().toISOString();
      integ.package_digest = createHash("sha256")
        .update(`${JSON.stringify(integ.files)}\n`)
        .digest("hex");
      atomicWriteJson(join(tmpDir, "integrity.json"), integ);

      renameSync(
        join(tmpDir, "publication-readiness.json"),
        join(pkgDir, "publication-readiness.json"),
      );
      renameSync(
        join(tmpDir, "publication-dry-run.json"),
        join(pkgDir, "publication-dry-run.json"),
      );
      renameSync(join(tmpDir, "integrity.json"), join(pkgDir, "integrity.json"));
      rmSync(tmpDir, { recursive: true, force: true });

      // Refresh sidecar hashes after final placement
      const finalInteg = readJson<{
        algorithm: string;
        export_package_id: string;
        files: Record<string, string>;
      }>(join(pkgDir, "integrity.json"));
      finalInteg.files["publication-readiness.json"] = sha256File(
        join(pkgDir, "publication-readiness.json"),
      );
      finalInteg.files["publication-dry-run.json"] = sha256File(
        join(pkgDir, "publication-dry-run.json"),
      );
      atomicWriteJson(join(pkgDir, "integrity.json"), {
        ...finalInteg,
        generated_at: new Date().toISOString(),
        package_digest: createHash("sha256")
          .update(`${JSON.stringify(finalInteg.files)}\n`)
          .digest("hex"),
      });

      if (!pass) {
        mkdirSync(FAILURES_ROOT, { recursive: true });
        const failCopy = join(
          FAILURES_ROOT,
          `${export_package_id}-${Date.now().toString(36)}`,
        );
        mkdirSync(failCopy, { recursive: true });
        writeFileSync(
          join(failCopy, "publication-readiness.json"),
          `${JSON.stringify(readiness, null, 2)}\n`,
        );
        writeFileSync(
          join(failCopy, "publication-dry-run.json"),
          `${JSON.stringify(dryRun, null, 2)}\n`,
        );
        updateReservationStatus({
          reservation_id: reservation.reservation_id,
          status: "PUBLICATION_VALIDATION_FAILED",
          reason: blocking_issues.join("; "),
        });
        return {
          ok: false,
          idempotent: false,
          export_package_id,
          export_path: relative(REPO, pkgDir).replace(/\\/g, "/"),
          status: "PUBLICATION_VALIDATION_FAILED",
          ready_for_release: false,
          report_path: relative(
            REPO,
            join(pkgDir, "publication-readiness.json"),
          ).replace(/\\/g, "/"),
          simulation_path: relative(
            REPO,
            join(pkgDir, "publication-dry-run.json"),
          ).replace(/\\/g, "/"),
          error: blocking_issues.join("; "),
          publication_allowed: false,
        };
      }

      updateReservationStatus({
        reservation_id: reservation.reservation_id,
        status: "READY_FOR_RELEASE",
        reason: `Publication readiness PASS by ${input.actor ?? "cli"} (${PUBLICATION_READINESS_VERSION})`,
      });

      return {
        ok: true,
        idempotent: false,
        export_package_id,
        export_path: relative(REPO, pkgDir).replace(/\\/g, "/"),
        status: "READY_FOR_RELEASE",
        ready_for_release: true,
        report_path: relative(
          REPO,
          join(pkgDir, "publication-readiness.json"),
        ).replace(/\\/g, "/"),
        simulation_path: relative(
          REPO,
          join(pkgDir, "publication-dry-run.json"),
        ).replace(/\\/g, "/"),
        error: null,
        publication_allowed: false,
      };
    } catch (inner) {
      if (existsSync(tmpDir)) {
        rmSync(tmpDir, { recursive: true, force: true });
      }
      throw inner;
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    if (export_package_id) {
      const reservation = findReservationForExport(export_package_id);
      if (
        reservation &&
        (reservation.status === "ASSETS_READY" ||
          reservation.status === "PUBLICATION_VALIDATION_FAILED")
      ) {
        try {
          updateReservationStatus({
            reservation_id: reservation.reservation_id,
            status: "PUBLICATION_VALIDATION_FAILED",
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

/** Exposed for tests — assert dry-run never writes website paths. */
export function assertDryRunDidNotTouchWebsite(before: {
  manifest: string;
  publicSnap: string;
  registry: string;
}): boolean {
  const manifest = existsSync(join(REPO, "templates.manifest.json"))
    ? sha256File(join(REPO, "templates.manifest.json"))
    : "missing";
  const pub = existsSync(join(REPO, "public/templates"))
    ? createHash("sha256")
        .update(readdirSync(join(REPO, "public/templates")).sort().join("\n"))
        .digest("hex")
    : "missing";
  const reg = existsSync(join(REPO, "src/data/templateCatalog.generated.ts"))
    ? sha256File(join(REPO, "src/data/templateCatalog.generated.ts"))
    : "missing";
  return (
    manifest === before.manifest &&
    pub === before.publicSnap &&
    reg === before.registry
  );
}
