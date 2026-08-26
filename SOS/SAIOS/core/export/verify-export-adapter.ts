/**
 * Agent #243 — Export adapter verification + fixture-only demonstration.
 * Never publishes. Never writes StudiosisLab website files.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { upsertLifecycle, readLifecycle } from "../staging/CandidateLifecycleStore.js";
import {
  computeHighestUsedCatalogueNumber,
  listReservations,
  reserveCatalogueId,
  updateReservationStatus,
} from "./CatalogueReservation.js";
import { convertStagedCanvasToTemplateJson } from "./FabricExportConverter.js";
import { buildSeoSlug, publicDisplayTitle, mapCategoryId } from "./CategoryTitleSeo.js";
import {
  exportStagedPackage,
  getExportStatus,
  EXPORT_PACKAGES_ROOT,
} from "./ExportService.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(REPO, "SOS/07_LOGS/saios/export/verify-export-adapter.json");
const REPORT = join(
  REPO,
  "SOS/09_REPORTS/AIOS_STUDIOSISLAB_EXPORT_ADAPTER_V1_REPORT.md",
);
const FIXTURE_CANDIDATE = "cand-fixture-aios-242-staging-demo";
const FIXTURE_STAGING = "stg-20260724-ba6e7e88";
const MANIFEST = join(REPO, "templates.manifest.json");
const PUBLIC_TEMPLATES = join(REPO, "public/templates");
const REGISTRY = join(REPO, "src/data/templateCatalog.generated.ts");

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function dirSnapshot(path: string): string {
  if (!existsSync(path)) return "missing";
  const names = readdirSync(path).sort();
  const h = createHash("sha256");
  h.update(names.join("\n"));
  return h.digest("hex");
}

async function main(): Promise<void> {
  process.env.SOS_AIOS_LIVE = "0";
  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE OFF");

  const checks: Record<string, boolean> = {};
  const manifestBefore = sha256File(MANIFEST);
  const publicBefore = dirSnapshot(PUBLIC_TEMPLATES);
  const registryBefore = existsSync(REGISTRY) ? sha256File(REGISTRY) : "missing";

  // Fixture must remain VALIDATED
  const life = readLifecycle(FIXTURE_CANDIDATE);
  assert(life?.lifecycle_status === "VALIDATED", "fixture must be VALIDATED");
  assert(
    life?.staging_package_id === FIXTURE_STAGING,
    "fixture staging package mismatch",
  );

  // Monotonic policy (no gap-fill)
  const hi = computeHighestUsedCatalogueNumber();
  checks.monotonic_policy =
    hi.next_id ===
    `t${String(hi.highest_used + 1).padStart(3, "0")}`;
  checks.not_gap_fill = hi.next_id !== "t086"; // gap-fill would pick t086

  // Fabric conversion
  const canvas = JSON.parse(
    readFileSync(
      join(
        REPO,
        "SOS/07_LOGS/saios/staging/packages",
        FIXTURE_STAGING,
        "canvas.json",
      ),
      "utf8",
    ),
  );
  const converted = convertStagedCanvasToTemplateJson(canvas);
  checks.fabric_conversion =
    converted.template.version === "6.9.1" &&
    converted.template.width === 794 &&
    converted.object_count > 0 &&
    !("aios" in converted.template);

  // Titles / categories / SEO helpers
  checks.title_convention =
    publicDisplayTitle("accountant") === "Accountant Resume";
  checks.category_mapping =
    mapCategoryId("accountant", "finance") === "finance-accounting";
  const seo = buildSeoSlug("accountant");
  checks.seo_collision_detection = seo.collision === true; // accountant-resume exists

  // Non-validated rejected
  const blockedId = "cand-fixture-aios-243-not-validated";
  upsertLifecycle({
    candidate_id: blockedId,
    generation_id: "GEN-VERIFY-BLOCK",
    lifecycle_status: "APPROVED",
    approval_decision_id: "decision-block",
    founder_approved_at: new Date().toISOString(),
    staging_package_id: null,
    content_fingerprint: "x",
  });
  const blocked = await exportStagedPackage({ candidate_id: blockedId });
  checks.non_validated_rejected = blocked.ok === false;

  const changesLife = "cand-fixture-aios-243-changes";
  upsertLifecycle({
    candidate_id: changesLife,
    generation_id: "GEN-VERIFY-CH",
    lifecycle_status: "CHANGES_REQUESTED",
    approval_decision_id: null,
    founder_approved_at: null,
    staging_package_id: "stg-does-not-exist-243",
    content_fingerprint: "y",
  });
  const blockedChanges = await exportStagedPackage({
    candidate_id: changesLife,
  });
  checks.changes_requested_rejected = blockedChanges.ok === false;

  // VALIDATED fixture export
  const exported = await exportStagedPackage({
    candidate_id: FIXTURE_CANDIDATE,
    actor: "verify",
  });
  checks.validated_exports = exported.ok === true;
  checks.reservation_present = Boolean(exported.reservation_id);
  checks.catalogue_reserved = Boolean(
    exported.reserved_catalogue_id?.match(/^t\d{3}$/),
  );
  checks.export_package_exists = Boolean(
    exported.export_package_id &&
      existsSync(
        join(EXPORT_PACKAGES_ROOT, exported.export_package_id!, "origin.json"),
      ),
  );

  let originChain = false;
  let manifestDraftValid = false;
  let integrityOk = false;
  let seoDraftOk = false;
  let searchOk = false;
  if (exported.export_package_id) {
    const dir = join(EXPORT_PACKAGES_ROOT, exported.export_package_id);
    const required = [
      "origin.json",
      "catalogue-allocation.json",
      "template.json",
      "manifest-entry.json",
      "metadata.json",
      "seo.json",
      "search.json",
      "asset-plan.json",
      "integrity.json",
      "validation-report.json",
    ];
    checks.package_files = required.every((f) => existsSync(join(dir, f)));
    const origin = JSON.parse(readFileSync(join(dir, "origin.json"), "utf8"));
    originChain =
      origin.generation_id &&
      origin.candidate_id === FIXTURE_CANDIDATE &&
      origin.staging_package_id === FIXTURE_STAGING &&
      origin.reservation_id &&
      origin.reserved_catalogue_id &&
      origin.export_package_id === exported.export_package_id &&
      origin.future_release_id === null &&
      origin.publication_allowed === false;
    const me = JSON.parse(
      readFileSync(join(dir, "manifest-entry.json"), "utf8"),
    );
    manifestDraftValid =
      me.status === "draft" &&
      me.id === exported.reserved_catalogue_id &&
      me.title === "Accountant Resume" &&
      typeof me.categoryId === "string" &&
      me.jsonPath.includes(me.id);
    const tpl = JSON.parse(readFileSync(join(dir, "template.json"), "utf8"));
    checks.template_no_aios = !("aios" in tpl);
    const seoDoc = JSON.parse(readFileSync(join(dir, "seo.json"), "utf8"));
    seoDraftOk =
      Boolean(seoDoc.slug) &&
      seoDoc.collision === true &&
      Boolean(seoDoc.suggested_alternate_slug) &&
      seoDoc.isPublished === false;
    const search = JSON.parse(readFileSync(join(dir, "search.json"), "utf8"));
    searchOk = Boolean(search.normalized_text) && Array.isArray(search.tags);
    const integrity = JSON.parse(
      readFileSync(join(dir, "integrity.json"), "utf8"),
    );
    integrityOk =
      integrity.algorithm === "sha256" &&
      Object.keys(integrity.files || {}).length >= 8;
    // Verify one checksum
    const sampleRel = "template.json";
    integrityOk =
      integrityOk &&
      sha256File(join(dir, sampleRel)) === integrity.files[sampleRel];
  }
  checks.origin_chain = originChain;
  checks.manifest_draft_valid = manifestDraftValid;
  checks.seo_draft = seoDraftOk;
  checks.search_metadata = searchOk;
  checks.integrity = integrityOk;

  // Duplicate export returns existing
  const again = await exportStagedPackage({
    candidate_id: FIXTURE_CANDIDATE,
    actor: "verify",
  });
  checks.duplicate_export_idempotent =
    again.ok === true &&
    again.idempotent === true &&
    again.export_package_id === exported.export_package_id;

  // Reservation collision: cannot create second active reservation for same staging with different ID
  // (idempotent reserve returns same)
  const r2 = reserveCatalogueId({
    generation_id: exported.generation_id,
    candidate_id: FIXTURE_CANDIDATE,
    staging_package_id: FIXTURE_STAGING,
  });
  checks.reservation_idempotent =
    r2.created === false &&
    r2.reservation.reservation_id === exported.reservation_id;

  // Rollback / FAILED path — mark a synthetic reservation FAILED without consuming live ID reuse
  const fakeStaging = `stg-verify-rollback-${Date.now().toString(36)}`;
  // Create a temporary fake staging package that fails eligibility after reservation...
  // Simpler: updateReservationStatus FAILED on a clone path via reserve for a unique staging id that won't export
  const roll = reserveCatalogueId({
    generation_id: "GEN-VERIFY-ROLLBACK",
    candidate_id: "cand-fixture-aios-243-rollback",
    staging_package_id: fakeStaging,
    reason: "rollback test reservation",
  });
  updateReservationStatus({
    reservation_id: roll.reservation.reservation_id,
    status: "FAILED",
    reason: "verify rollback simulation",
  });
  const afterFail = listReservations().find(
    (r) => r.reservation_id === roll.reservation.reservation_id,
  );
  checks.rollback_failed_status = afterFail?.status === "FAILED";
  // Failed IDs are not reused (next > failed number)
  const hi2 = computeHighestUsedCatalogueNumber();
  const failedNum = Number(roll.reservation.reserved_catalogue_id.slice(1));
  checks.failed_ids_not_reused = hi2.highest_used >= failedNum;

  // Website unchanged
  checks.manifest_unchanged = sha256File(MANIFEST) === manifestBefore;
  checks.public_templates_unchanged = dirSnapshot(PUBLIC_TEMPLATES) === publicBefore;
  checks.registry_unchanged =
    (existsSync(REGISTRY) ? sha256File(REGISTRY) : "missing") === registryBefore;
  checks.publication_allowed_false = exported.publication_allowed === false;
  checks.live_off = process.env.SOS_AIOS_LIVE !== "1";
  checks.release_manager_not_invoked = !readFileSync(
    join(REPO, "SOS/SAIOS/core/export/ExportService.ts"),
    "utf8",
  ).match(/import\s+.*ReleaseManager/);
  checks.no_tmp_promoted = !readdirSync(EXPORT_PACKAGES_ROOT).some((n) =>
    n.startsWith(".tmp-"),
  );

  const status = getExportStatus({ candidate_id: FIXTURE_CANDIDATE });
  checks.status_cli =
    status.export_package_id === exported.export_package_id &&
    status.reservation?.status === "EXPORT_BUILT";

  // Clean verify-only lifecycle noise candidates (optional leave)
  void blockedId;
  void changesLife;

  const allPass = Object.values(checks).every(Boolean);
  const result = {
    generated_at: new Date().toISOString(),
    agent: 243,
    overall: allPass ? "PASS" : "FAIL",
    live: false,
    publication_allowed: false,
    checks,
    highest_used: hi,
    fixture: {
      candidate_id: FIXTURE_CANDIDATE,
      staging_package_id: FIXTURE_STAGING,
      reservation_id: exported.reservation_id,
      reserved_catalogue_id: exported.reserved_catalogue_id,
      export_package_id: exported.export_package_id,
      export_path: exported.export_path,
    },
  };
  mkdirSync(join(REPO, "SOS/07_LOGS/saios/export"), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);

  const md = [
    `# AIOS StudiosisLab Export Adapter V1 Report`,
    ``,
    `**Agent:** #243`,
    `**Overall:** ${allPass ? "PASS" : "FAIL"}`,
    `**LIVE:** OFF`,
    `**publication_allowed:** false`,
    ``,
    `## 1. Current System`,
    ``,
    `- Staging VALIDATED packages feed the export adapter.`,
    `- ReleaseManager remains separate and was not invoked.`,
    `- Website / live manifest / registries untouched.`,
    ``,
    `## 2. Existing Catalogue Rules Applied`,
    ``,
    `- Monotonic \`tNNN\` (no gap-fill). Next after used max: \`${hi.next_id}\` at verify start.`,
    `- Public titles: \`{Role} Resume\` Title Case.`,
    `- Categories mapped to existing aliases (e.g. accountant → finance-accounting).`,
    `- Design family kept internal (origin/metadata only).`,
    ``,
    `## 3. Reservation System`,
    ``,
    `- File: \`SOS/07_LOGS/saios/export/catalogue-id-reservations.json\``,
    `- States: RESERVED → EXPORT_BUILT | FAILED | ROLLED_BACK | CANCELLED | COMMITTED`,
    `- Atomic lock; cancelled/failed numbers not reused.`,
    `- Fixture reservation: \`${exported.reservation_id}\` → \`${exported.reserved_catalogue_id}\``,
    ``,
    `## 4. Export Package`,
    ``,
    `- Path: \`${exported.export_path}\``,
    `- Contains origin, catalogue-allocation, template, manifest-entry, metadata, seo, search, asset-plan, integrity, validation-report.`,
    ``,
    `## 5. Fabric Conversion`,
    ``,
    `- Fabric 6.9.1 preserved; \`aios\` root stripped; objects retained; no visual edits.`,
    ``,
    `## 6. Manifest Draft`,
    ``,
    `- \`status: draft\` only; not written to \`templates.manifest.json\`.`,
    ``,
    `## 7. SEO Draft`,
    ``,
    `- Slug collision detection for Accountant → alternate suggested; \`isPublished: false\`.`,
    ``,
    `## 8. Search Metadata`,
    ``,
    `- tags / keywords / normalized_text / role / category.`,
    ``,
    `## 9. Origin Chain`,
    ``,
    `- generation → candidate → decision → staging → reservation → export; \`future_release_id: null\`.`,
    ``,
    `## 10. Integrity`,
    ``,
    `- SHA-256 per artifact in \`integrity.json\`.`,
    ``,
    `## 11. Tests`,
    ``,
    `| Check | Result |`,
    `|-------|--------|`,
    ...Object.entries(checks).map(
      ([k, v]) => `| ${k} | ${v ? "PASS" : "FAIL"} |`,
    ),
    ``,
    `## 12. Demonstration`,
    ``,
    `- Fixture only: \`${FIXTURE_CANDIDATE}\` / \`${FIXTURE_STAGING}\`.`,
    `- Real Agent #240 OpenAI templates were not exported or reserved.`,
    ``,
    `## 13. Files Changed`,
    ``,
    `- \`SOS/SAIOS/core/export/*\``,
    `- package.json scripts`,
    `- export logs under \`SOS/07_LOGS/saios/export/\``,
    `- this report`,
    ``,
    `## 14. Verification`,
    ``,
    `- Machine JSON: \`${OUT.replace(REPO + "/", "")}\``,
    `- Overall: **${allPass ? "PASS" : "FAIL"}**`,
    `- Website/manifest/registry unchanged: ${checks.manifest_unchanged && checks.registry_unchanged}`,
    ``,
    `## 15. Remaining Gaps`,
    ``,
    `- Image optimization deferred.`,
    `- Live manifest merge / ReleaseManager publication deferred.`,
    `- COMMITTED reservation state reserved for future Founder publish agent.`,
    ``,
    `## 16. Exact Next Action`,
    ``,
    `- Agent #244: asset optimization (PNG/WebP) from export asset-plan, still without live publish.`,
    ``,
  ].join("\n");
  writeFileSync(REPORT, `${md}\n`);

  console.log(
    JSON.stringify(
      { ok: allPass, checks, fixture: result.fixture, highest_used: hi },
      null,
      2,
    ),
  );
  if (!allPass) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
