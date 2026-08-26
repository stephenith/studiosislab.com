/**
 * Discovers template lifecycle from SOS logs — no hardcoded template ids.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import type { QueueStage, TemplateLifecycleRecord } from "./types.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
const SOS_ROOT = join(REPO_ROOT, "SOS");
const LOGS_ROOT = join(SOS_ROOT, "07_LOGS/saios");
const MANIFEST_PATH = join(REPO_ROOT, "templates.manifest.json");

type BatchResult = {
  role?: { slug?: string; title?: string };
  prototype_dir?: string;
  prototype_id?: string;
  catalog_id?: string;
  qa_pass?: boolean;
  render_pass?: boolean;
  critic_pass?: boolean;
  publication_pass?: boolean;
  publication_state?: string;
  awaiting_founder?: boolean;
  scores?: {
    premium?: number;
    ats?: number;
    render?: number;
    overall?: number;
  };
};

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

function sha256File(path: string): string | null {
  if (!existsSync(path)) return null;
  try {
    return createHash("sha256").update(readFileSync(path)).digest("hex");
  } catch {
    return null;
  }
}

function inferBatchId(prototypeId: string): string | null {
  if (prototypeId.startsWith("production-batch-001-")) return "production-batch-001";
  if (prototypeId.startsWith("premium-collection-")) return "premium-collection";
  return null;
}

function inferRole(prototypeId: string, batch?: BatchResult): string | null {
  if (batch?.role?.title) return batch.role.title;
  const stripped = prototypeId
    .replace(/^production-batch-001-/, "")
    .replace(/^premium-collection-/, "")
    .replace(/-v3$/, "")
    .replace(/-/g, " ");
  return stripped || null;
}

function classifyStage(input: {
  generated: boolean;
  qaPass: boolean | null;
  awaitingFounder: boolean;
  publicationState: string | null;
  published: boolean;
  rolledBack: boolean;
  releaseStatus: string | null;
}): QueueStage {
  if (input.rolledBack) return "rolled_back";
  if (input.published && input.releaseStatus === "released") return "published";
  if (input.publicationState === "ready_to_publish") return "ready_to_publish";
  if (input.awaitingFounder) return "founder_review";
  if (input.qaPass === true) return "qa_complete";
  if (input.generated) return "generated";
  return "draft";
}

function detectIssues(input: {
  catalogId: string | null;
  prototypeId: string;
  packageDir: string | null;
  published: boolean;
  manifestPublished: boolean;
  stale: boolean;
  qaPass: boolean | null;
  duplicateCatalog: boolean;
}): string[] {
  const issues: string[] = [];
  if (input.duplicateCatalog) issues.push("duplicate_catalog_id");
  if (input.stale) issues.push("stale_publication_or_release");
  if (input.packageDir) {
    const required = [
      "template.json",
      "thumbnail.png",
      "manifest-entry.json",
      "registry-entry.ts",
      "seo.json",
    ];
    for (const file of required) {
      if (!existsSync(join(input.packageDir, file))) issues.push(`missing_package_${file}`);
    }
  } else if (input.catalogId) {
    issues.push("missing_publication_package");
  }
  if (input.published && input.catalogId) {
    const thumb = join(REPO_ROOT, "public/templates", `${input.catalogId}.png`);
    if (!existsSync(thumb)) issues.push("missing_thumbnail");
    const json = join(REPO_ROOT, "src/data/template-json", `${input.catalogId}.json`);
    if (!existsSync(json)) issues.push("missing_template_json");
    const seoPath = join(REPO_ROOT, "src/data/templateSeoContent.ts");
    if (existsSync(seoPath)) {
      const seo = readFileSync(seoPath, "utf8");
      if (!seo.includes(`templateId: "${input.catalogId}"`)) issues.push("missing_seo_entry");
    }
    const registryPath = join(REPO_ROOT, "src/data/systemTemplates/registry.generated.ts");
    if (existsSync(registryPath)) {
      const registry = readFileSync(registryPath, "utf8");
      if (!registry.includes(`id: "${input.catalogId}"`)) issues.push("missing_registry_entry");
    }
  }
  if (input.manifestPublished !== input.published) issues.push("manifest_release_mismatch");
  if (input.qaPass === false) issues.push("qa_failed");
  return issues;
}

export function discoverTemplateLifecycles(input: {
  factoryVersion: string;
  designDnaVersion: string;
  latestCalibration: string;
  latestFounderReview: string;
}): TemplateLifecycleRecord[] {
  const generatedRoot = join(LOGS_ROOT, "generated-resumes");
  const batchResult = readJson<{ batch_id?: string; results?: BatchResult[] }>(
    join(LOGS_ROOT, "production-batch-001/mission-result.json"),
  );
  const batchByPrototype = new Map<string, BatchResult>();
  for (const result of batchResult?.results ?? []) {
    const dir = result.prototype_dir ?? "";
    const prototypeId = dir.split("/").pop() ?? "";
    if (prototypeId) batchByPrototype.set(prototypeId, result);
  }

  const manifest = readJson<{ templates?: Array<{ id: string; status: string }> }>(MANIFEST_PATH);
  const publishedIds = new Set(
    (manifest?.templates ?? []).filter((t) => t.status === "published").map((t) => t.id),
  );

  const catalog = readJson<{
    templates?: Array<{
      catalog_id: string;
      prototype_id: string;
      publication_state: string;
      industry?: string;
    }>;
  }>(join(LOGS_ROOT, "publication/catalog.json"));

  const catalogByPrototype = new Map(
    (catalog?.templates ?? []).map((t) => [t.prototype_id, t]),
  );
  const catalogById = new Map((catalog?.templates ?? []).map((t) => [t.catalog_id, t]));

  const releases = readJson<
    Array<{ release_id: string; catalog_id: string; status: string; checksum: string }>
  >(join(LOGS_ROOT, "publication/release-manager/release-history.json")) ?? [];

  type ReleaseRow = (typeof releases)[number] & { release_date?: string };
  const releaseByCatalog = new Map<string, ReleaseRow>();
  for (const release of releases as ReleaseRow[]) {
    const existing = releaseByCatalog.get(release.catalog_id);
    if (!existing || (release.release_date ?? "") > (existing.release_date ?? "")) {
      releaseByCatalog.set(release.catalog_id, release);
    }
  }

  const catalogIdCounts = new Map<string, number>();
  for (const result of batchResult?.results ?? []) {
    if (!result.catalog_id) continue;
    catalogIdCounts.set(result.catalog_id, (catalogIdCounts.get(result.catalog_id) ?? 0) + 1);
  }

  const prototypeDirs = existsSync(generatedRoot)
    ? readdirSync(generatedRoot, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
    : [];

  const records: TemplateLifecycleRecord[] = [];

  for (const prototypeId of prototypeDirs) {
    const generatedDir = join(generatedRoot, prototypeId);
    const previewPath = join(generatedDir, "template-preview.json");
    const generated = existsSync(previewPath);
    const batch = batchByPrototype.get(prototypeId);
    const catalogEntry = catalogByPrototype.get(prototypeId) ?? null;
    const catalogId = batch?.catalog_id ?? catalogEntry?.catalog_id ?? null;

    const qaValidation = readJson<{ pass?: boolean }>(
      join(LOGS_ROOT, "qa", prototypeId, "validation.json"),
    );
    const renderEval = readJson<{ quality_gate_pass?: boolean; overall_render_score?: number }>(
      join(LOGS_ROOT, "visual-render/evaluations", prototypeId, "render-evaluation.json"),
    );
    const critic = readJson<{ ready_for_founder_review?: boolean; overall_score?: number }>(
      join(LOGS_ROOT, "founder-critic/reviews", prototypeId, "founder-review.json"),
    );
    const competitive = readJson<{
      gate_pass?: boolean;
      overall_competitive_score?: number;
      confidence?: number;
    }>(join(LOGS_ROOT, "competitive-validation/evaluations", prototypeId, "competitive-score.json"));

    const confidence = readJson<{ overall_confidence?: number }>(
      join(generatedDir, "confidence.json"),
    );

    const packageDirRel = catalogId
      ? relative(REPO_ROOT, join(LOGS_ROOT, "publication/packages", catalogId))
      : null;
    const packageDir = packageDirRel ? join(REPO_ROOT, packageDirRel) : null;

    const release = catalogId ? releaseByCatalog.get(catalogId) : null;
    const published = catalogId ? publishedIds.has(catalogId) : false;
    const rolledBack = release?.status === "rolled_back";

    const freshnessReasons: string[] = [];
    if (published && catalogId && packageDir) {
      const genHash = sha256File(previewPath);
      const pkgHash = sha256File(join(packageDir, "template.json"));
      const liveHash = sha256File(join(REPO_ROOT, "src/data/template-json", `${catalogId}.json`));
      if (genHash && pkgHash && genHash !== pkgHash) {
        freshnessReasons.push("package_template_differs_from_latest_generated");
      }
      if (release?.checksum && pkgHash && release.checksum !== pkgHash && release.status === "released") {
        freshnessReasons.push("release_checksum_differs_from_package");
      }
      if (liveHash && pkgHash && liveHash !== pkgHash && release?.status === "released") {
        freshnessReasons.push("live_template_differs_from_package");
      }
    }

    const awaitingFounder =
      batch?.awaiting_founder === true ||
      catalogEntry?.publication_state === "ready_to_publish";

    const stage = classifyStage({
      generated,
      qaPass: qaValidation?.pass ?? batch?.qa_pass ?? null,
      awaitingFounder,
      publicationState: batch?.publication_state ?? catalogEntry?.publication_state ?? null,
      published,
      rolledBack,
      releaseStatus: release?.status ?? null,
    });

    const duplicateCatalog = catalogId ? (catalogIdCounts.get(catalogId) ?? 0) > 1 : false;
    const stale = freshnessReasons.length > 0;

    const issues = detectIssues({
      catalogId,
      prototypeId,
      packageDir,
      published,
      manifestPublished: published,
      stale,
      qaPass: qaValidation?.pass ?? null,
      duplicateCatalog,
    });

    records.push({
      prototype_id: prototypeId,
      catalog_id: catalogId,
      role: inferRole(prototypeId, batch),
      industry: catalogEntry?.industry ?? null,
      batch_id: inferBatchId(prototypeId),
      current_stage: stage,
      generation_status: generated ? "complete" : "missing",
      qa_status: qaValidation?.pass === false ? "FAIL" : qaValidation?.pass ? "PASS" : "unknown",
      visual_render_status: renderEval?.quality_gate_pass
        ? `PASS (${renderEval.overall_render_score ?? "?"})`
        : renderEval
          ? "FAIL"
          : "not_run",
      founder_critic_status: critic?.ready_for_founder_review
        ? `ready (${critic.overall_score ?? "?"})`
        : critic
          ? "reviewed"
          : "not_run",
      competitive_validation_status: competitive?.gate_pass
        ? `PASS (${competitive.overall_competitive_score ?? "?"})`
        : competitive
          ? "FAIL"
          : "not_run",
      publication_status: catalogEntry?.publication_state ?? batch?.publication_state ?? "none",
      release_status: release?.status ?? "none",
      rollback_status: release?.status === "rolled_back" ? "rolled_back" : release ? "available" : "none",
      release_id: release?.release_id ?? null,
      founder_approval: published ? "published" : awaitingFounder ? "awaiting" : "none",
      latest_review: input.latestFounderReview,
      latest_calibration: input.latestCalibration,
      latest_design_dna: input.designDnaVersion,
      scores: {
        premium: batch?.scores?.premium ?? null,
        ats: batch?.scores?.ats ?? null,
        render: batch?.scores?.render ?? renderEval?.overall_render_score ?? null,
        competitive: competitive?.overall_competitive_score ?? null,
        confidence: confidence?.overall_confidence ?? competitive?.confidence ?? null,
        overall: batch?.scores?.overall ?? null,
      },
      paths: {
        generated_dir: relative(REPO_ROOT, generatedDir),
        package_dir: packageDirRel,
        qa_validation: existsSync(join(LOGS_ROOT, "qa", prototypeId, "validation.json"))
          ? relative(REPO_ROOT, join(LOGS_ROOT, "qa", prototypeId, "validation.json"))
          : null,
      },
      freshness: { stale, reasons: freshnessReasons },
      issues,
      searchable: {
        catalog_id: catalogId,
        prototype_id: prototypeId,
        role: inferRole(prototypeId, batch),
        industry: catalogEntry?.industry ?? null,
        batch_id: inferBatchId(prototypeId),
        publication_status: catalogEntry?.publication_state ?? "none",
        founder_review: input.latestFounderReview,
        release_id: release?.release_id ?? null,
      },
    });
  }

  return records.sort((a, b) => {
    const aTime = existsSync(join(LOGS_ROOT, "generated-resumes", a.prototype_id, "template-preview.json"))
      ? statSync(join(LOGS_ROOT, "generated-resumes", a.prototype_id, "template-preview.json")).mtimeMs
      : 0;
    const bTime = existsSync(join(LOGS_ROOT, "generated-resumes", b.prototype_id, "template-preview.json"))
      ? statSync(join(LOGS_ROOT, "generated-resumes", b.prototype_id, "template-preview.json")).mtimeMs
      : 0;
    return bTime - aTime;
  });
}
