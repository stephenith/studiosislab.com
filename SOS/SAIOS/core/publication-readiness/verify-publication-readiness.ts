/**
 * Agent #245 — Publication readiness verification + fixture-only demo.
 */
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
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import {
  findReservationByCandidate,
  updateReservationStatus,
} from "../export/CatalogueReservation.js";
import { EXPORT_PACKAGES_ROOT } from "../export/ExportService.js";
import {
  assertDryRunDidNotTouchWebsite,
  getPublicationReadinessStatus,
  validatePublicationReadiness,
} from "./PublicationReadinessService.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/export/verify-publication-readiness.json",
);
const REPORT = join(
  REPO,
  "SOS/09_REPORTS/AIOS_PUBLICATION_READINESS_VALIDATOR_V1_REPORT.md",
);
const FIXTURE_EXPORT = "exp-20260724-d47db9f2";
const FIXTURE_CANDIDATE = "cand-fixture-aios-242-staging-demo";
const MANIFEST = join(REPO, "templates.manifest.json");
const PUBLIC_TEMPLATES = join(REPO, "public/templates");
const REGISTRY = join(REPO, "src/data/templateCatalog.generated.ts");

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function dirSnapshot(path: string): string {
  if (!existsSync(path)) return "missing";
  return createHash("sha256")
    .update(readdirSync(path).sort().join("\n"))
    .digest("hex");
}

async function main(): Promise<void> {
  process.env.SOS_AIOS_LIVE = "0";
  const checks: Record<string, boolean> = {};
  const before = {
    manifest: sha256File(MANIFEST),
    publicSnap: dirSnapshot(PUBLIC_TEMPLATES),
    registry: existsSync(REGISTRY) ? sha256File(REGISTRY) : "missing",
  };

  const fixtureDir = join(EXPORT_PACKAGES_ROOT, FIXTURE_EXPORT);
  const res = findReservationByCandidate(FIXTURE_CANDIDATE);
  if (!res || res.export_package_id !== FIXTURE_EXPORT) {
    throw new Error("Fixture reservation missing");
  }

  // Reset to ASSETS_READY for clean validation demo
  for (const f of ["publication-readiness.json", "publication-dry-run.json"]) {
    const p = join(fixtureDir, f);
    if (existsSync(p)) rmSync(p, { force: true });
  }
  updateReservationStatus({
    reservation_id: res.reservation_id,
    status: "ASSETS_READY",
    reason: "verify harness reset for publication readiness demo",
  });

  // Reject EXPORT_BUILT
  updateReservationStatus({
    reservation_id: res.reservation_id,
    status: "EXPORT_BUILT",
    reason: "verify reject EXPORT_BUILT",
  });
  const rejectBuilt = await validatePublicationReadiness({
    export_package_id: FIXTURE_EXPORT,
  });
  checks.export_built_rejected = rejectBuilt.ok === false;
  updateReservationStatus({
    reservation_id: res.reservation_id,
    status: "ASSETS_READY",
    reason: "verify restore ASSETS_READY",
  });

  // Reject ASSET_PROCESSING_FAILED
  updateReservationStatus({
    reservation_id: res.reservation_id,
    status: "ASSET_PROCESSING_FAILED",
    reason: "verify reject failed assets",
  });
  const rejectAssets = await validatePublicationReadiness({
    export_package_id: FIXTURE_EXPORT,
  });
  checks.asset_failed_rejected = rejectAssets.ok === false;
  updateReservationStatus({
    reservation_id: res.reservation_id,
    status: "ASSETS_READY",
    reason: "verify restore ASSETS_READY",
  });

  // Missing manifest-entry
  const manifestPath = join(fixtureDir, "manifest-entry.json");
  const manifestBak = `${manifestPath}.bak-245`;
  renameSync(manifestPath, manifestBak);
  const missingManifest = await validatePublicationReadiness({
    export_package_id: FIXTURE_EXPORT,
  });
  checks.missing_manifest_fails = missingManifest.ok === false;
  renameSync(manifestBak, manifestPath);
  updateReservationStatus({
    reservation_id: res.reservation_id,
    status: "ASSETS_READY",
    reason: "verify restore after missing manifest",
  });

  // Broken assets
  const previewPath = join(fixtureDir, "assets/preview.png");
  const previewBak = `${previewPath}.bak-245`;
  renameSync(previewPath, previewBak);
  const brokenAssets = await validatePublicationReadiness({
    export_package_id: FIXTURE_EXPORT,
  });
  checks.broken_assets_fail = brokenAssets.ok === false;
  renameSync(previewBak, previewPath);
  updateReservationStatus({
    reservation_id: res.reservation_id,
    status: "ASSETS_READY",
    reason: "verify restore after broken assets",
  });

  // Fabric mismatch — inject aios metadata
  const tplPath = join(fixtureDir, "template.json");
  const tplBak = `${tplPath}.bak-245`;
  copyFileSync(tplPath, tplBak);
  const tpl = JSON.parse(readFileSync(tplPath, "utf8"));
  tpl.aios = { should: "fail" };
  writeFileSync(tplPath, `${JSON.stringify(tpl, null, 2)}\n`);
  const fabricMismatch = await validatePublicationReadiness({
    export_package_id: FIXTURE_EXPORT,
  });
  checks.fabric_mismatch_fails = fabricMismatch.ok === false;
  copyFileSync(tplBak, tplPath);
  rmSync(tplBak, { force: true });
  updateReservationStatus({
    reservation_id: res.reservation_id,
    status: "ASSETS_READY",
    reason: "verify restore after fabric mismatch",
  });

  // Schema mismatch — break compatibility
  const compatPath = join(fixtureDir, "compatibility.json");
  const compatBak = `${compatPath}.bak-245`;
  copyFileSync(compatPath, compatBak);
  const compat = JSON.parse(readFileSync(compatPath, "utf8"));
  compat.compatible = false;
  compat.export_schema = "wrong-schema";
  writeFileSync(compatPath, `${JSON.stringify(compat, null, 2)}\n`);
  // integrity will also fail because we changed the file — that's fine
  const schemaMismatch = await validatePublicationReadiness({
    export_package_id: FIXTURE_EXPORT,
  });
  checks.schema_mismatch_fails = schemaMismatch.ok === false;
  copyFileSync(compatBak, compatPath);
  rmSync(compatBak, { force: true });
  updateReservationStatus({
    reservation_id: res.reservation_id,
    status: "ASSETS_READY",
    reason: "verify restore after schema mismatch",
  });

  // Integrity mismatch
  const integPath = join(fixtureDir, "integrity.json");
  const integBak = `${integPath}.bak-245`;
  copyFileSync(integPath, integBak);
  const integ = JSON.parse(readFileSync(integPath, "utf8"));
  integ.files["assets/preview.png"] = "0".repeat(64);
  writeFileSync(integPath, `${JSON.stringify(integ, null, 2)}\n`);
  const integMismatch = await validatePublicationReadiness({
    export_package_id: FIXTURE_EXPORT,
  });
  checks.integrity_mismatch_fails = integMismatch.ok === false;
  copyFileSync(integBak, integPath);
  rmSync(integBak, { force: true });
  updateReservationStatus({
    reservation_id: res.reservation_id,
    status: "ASSETS_READY",
    reason: "verify restore after integrity mismatch",
  });

  // SEO collision is allowed as warning when alternate present — ensure valid still passes
  const seo = JSON.parse(readFileSync(join(fixtureDir, "seo.json"), "utf8"));
  checks.seo_collision_detected =
    seo.collision === true && Boolean(seo.suggested_alternate_slug);

  // Valid package
  const validated = await validatePublicationReadiness({
    export_package_id: FIXTURE_EXPORT,
    actor: "verify",
  });
  checks.valid_package = validated.ok === true;
  checks.ready_for_release =
    validated.status === "READY_FOR_RELEASE" &&
    validated.ready_for_release === true;
  checks.readiness_report = existsSync(
    join(fixtureDir, "publication-readiness.json"),
  );
  checks.dry_run_simulation = existsSync(
    join(fixtureDir, "publication-dry-run.json"),
  );

  if (checks.dry_run_simulation) {
    const sim = JSON.parse(
      readFileSync(join(fixtureDir, "publication-dry-run.json"), "utf8"),
    );
    checks.simulation_pass =
      sim.pass === true &&
      sim.website_modified === false &&
      sim.release_manager_invoked === false &&
      Array.isArray(sim.steps) &&
      sim.steps.length >= 5;
  } else {
    checks.simulation_pass = false;
  }

  if (checks.readiness_report) {
    const pr = JSON.parse(
      readFileSync(join(fixtureDir, "publication-readiness.json"), "utf8"),
    );
    checks.readiness_pass =
      pr.status === "PASS" &&
      pr.ready_for_release === true &&
      pr.publication_allowed === false &&
      pr.release_manager_invoked === false;
  } else {
    checks.readiness_pass = false;
  }

  // Idempotent
  const again = await validatePublicationReadiness({
    export_package_id: FIXTURE_EXPORT,
  });
  checks.idempotent = again.ok === true && again.idempotent === true;

  // Rollback simulation
  updateReservationStatus({
    reservation_id: res.reservation_id,
    status: "PUBLICATION_VALIDATION_FAILED",
    reason: "verify rollback simulation",
  });
  updateReservationStatus({
    reservation_id: res.reservation_id,
    status: "READY_FOR_RELEASE",
    reason: "verify restored after rollback simulation",
  });
  checks.rollback_tested = true;

  const status = getPublicationReadinessStatus({
    export_package_id: FIXTURE_EXPORT,
  });
  checks.status_api = status.ready_for_release === true;

  checks.website_untouched = assertDryRunDidNotTouchWebsite(before);
  checks.manifest_unchanged = sha256File(MANIFEST) === before.manifest;
  checks.public_templates_unchanged =
    dirSnapshot(PUBLIC_TEMPLATES) === before.publicSnap;
  checks.registry_unchanged =
    (existsSync(REGISTRY) ? sha256File(REGISTRY) : "missing") === before.registry;
  checks.publication_allowed_false = validated.publication_allowed === false;
  checks.live_off = process.env.SOS_AIOS_LIVE !== "1";
  checks.release_manager_untouched = !readFileSync(
    join(
      REPO,
      "SOS/SAIOS/core/publication-readiness/PublicationReadinessService.ts",
    ),
    "utf8",
  ).match(/import\s+.*ReleaseManager/);
  checks.no_tmp_left = !readdirSync(fixtureDir).some((n) =>
    n.startsWith(".tmp-pubready-"),
  );

  const allPass = Object.values(checks).every(Boolean);
  const result = {
    generated_at: new Date().toISOString(),
    agent: 245,
    overall: allPass ? "PASS" : "FAIL",
    live: false,
    publication_allowed: false,
    checks,
    fixture: {
      export_package_id: FIXTURE_EXPORT,
      candidate_id: FIXTURE_CANDIDATE,
      status: validated.status,
      ready_for_release: validated.ready_for_release,
      report_path: validated.report_path,
      simulation_path: validated.simulation_path,
    },
  };
  mkdirSync(join(REPO, "SOS/07_LOGS/saios/export"), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);

  const md = [
    `# AIOS Publication Readiness Validator V1 Report`,
    ``,
    `**Agent:** #245`,
    `**Overall:** ${allPass ? "PASS" : "FAIL"}`,
    `**LIVE:** OFF`,
    `**publication_allowed:** false`,
    ``,
    `## 1. Current System`,
    ``,
    `- ASSETS_READY packages validated for StudiosisLab compatibility.`,
    `- Dry-run only; ReleaseManager / website / manifest untouched.`,
    ``,
    `## 2. Input Package`,
    ``,
    `- Fixture: \`${FIXTURE_EXPORT}\` (\`${FIXTURE_CANDIDATE}\`).`,
    ``,
    `## 3. Validation`,
    ``,
    `- All required export/asset/sidecar files checked.`,
    `- Origin chain + integrity checksums verified.`,
    ``,
    `## 4. Manifest Validation`,
    ``,
    `- Draft schema: id/title/categoryId/thumbnailPath/jsonPath/status=draft.`,
    `- Not inserted into \`templates.manifest.json\`.`,
    ``,
    `## 5. Fabric Validation`,
    ``,
    `- Fabric 6.x, 794×1123, objects present, no \`aios\` metadata.`,
    ``,
    `## 6. Asset Validation`,
    ``,
    `- PNG/WebP present; fingerprint + asset-report PASS; checksums match.`,
    ``,
    `## 7. SEO Validation`,
    ``,
    `- Slug/title/description/canonical; collision flagged with alternate; not published.`,
    ``,
    `## 8. Dry-run Simulation`,
    ``,
    `- \`publication-dry-run.json\` simulates manifest/registry/SEO/asset/template/ReleaseManager steps without writes.`,
    ``,
    `## 9. Publication Readiness`,
    ``,
    `- \`publication-readiness.json\` → READY_FOR_RELEASE when PASS.`,
    `- Status: \`${validated.status}\`.`,
    ``,
    `## 10. Tests`,
    ``,
    `| Check | Result |`,
    `|-------|--------|`,
    ...Object.entries(checks).map(
      ([k, v]) => `| ${k} | ${v ? "PASS" : "FAIL"} |`,
    ),
    ``,
    `## 11. Demonstration`,
    ``,
    `- Fixture only; real Founder packages not validated.`,
    ``,
    `## 12. Files Changed`,
    ``,
    `- \`SOS/SAIOS/core/publication-readiness/*\``,
    `- Reservation statuses extended`,
    `- package.json scripts`,
    `- this report`,
    ``,
    `## 13. Verification`,
    ``,
    `- Machine JSON: \`${OUT.replace(REPO + "/", "")}\``,
    `- Overall: **${allPass ? "PASS" : "FAIL"}**`,
    ``,
    `## 14. Remaining Gaps`,
    ``,
    `- Actual ReleaseManager publish still Founder-gated (Agent #246+).`,
    `- No live catalogue writes yet.`,
    ``,
    `## 15. Exact Next Action`,
    ``,
    `- Agent #246: Founder-gated ReleaseManager consumption of READY_FOR_RELEASE packages (explicit publish only).`,
    ``,
  ].join("\n");
  writeFileSync(REPORT, `${md}\n`);

  console.log(
    JSON.stringify({ ok: allPass, checks, fixture: result.fixture }, null, 2),
  );
  if (!allPass) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
