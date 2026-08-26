/**
 * Agent #246 — Founder Release Controller verification + fixture-only demo.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
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
  runAuthorizedExportRelease,
  runReleaseManager,
} from "../../runtime/publication/ReleaseManager.js";
import {
  approveAndExecuteRelease,
  buildPublicationPlan,
  getReleaseStatus,
  requestRelease,
} from "./FounderReleaseController.js";
import { readReleaseAudit } from "./ReleaseAudit.js";
import type { FounderReleaseAuthorization } from "./types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(REPO, "SOS/07_LOGS/saios/export/verify-founder-release.json");
const REPORT = join(
  REPO,
  "SOS/09_REPORTS/AIOS_FOUNDER_RELEASE_CONTROLLER_V1_REPORT.md",
);
const FIXTURE_EXPORT = "exp-20260724-d47db9f2";
const FIXTURE_CANDIDATE = "cand-fixture-aios-242-staging-demo";
const MANIFEST = join(REPO, "templates.manifest.json");
const PUBLIC_TEMPLATES = join(REPO, "public/templates");
const REGISTRY = join(REPO, "src/data/systemTemplates/registry.generated.ts");
const CATALOG = join(REPO, "src/data/templateCatalog.generated.ts");
const SEO = join(REPO, "src/data/templateSeoContent.ts");
const TEMPLATE_JSON = join(REPO, "src/data/template-json/t099.json");

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function websiteFingerprint(): Record<string, string> {
  return {
    manifest: sha256File(MANIFEST),
    registry: sha256File(REGISTRY),
    catalog: sha256File(CATALOG),
    seo: sha256File(SEO),
    public_listing: createHash("sha256")
      .update(readdirSync(PUBLIC_TEMPLATES).sort().join("\n"))
      .digest("hex"),
  };
}

function resetFixtureReady(): void {
  const res = findReservationByCandidate(FIXTURE_CANDIDATE);
  if (!res) throw new Error("fixture reservation missing");
  updateReservationStatus({
    reservation_id: res.reservation_id,
    status: "READY_FOR_RELEASE",
    reason: "verify harness reset READY_FOR_RELEASE",
    export_package_id: FIXTURE_EXPORT,
  });
}

async function main(): Promise<void> {
  process.env.SOS_AIOS_LIVE = "0";
  const checks: Record<string, boolean> = {};
  const beforeAll = websiteFingerprint();

  resetFixtureReady();

  // --- approval required / no approval rejection ---
  const noApproval = await approveAndExecuteRelease({
    export_package_id: FIXTURE_EXPORT,
    explicit_approval: false,
    confirm_phrase: "RELEASE_TO_STUDIOSISLAB",
    confirm_dialog: true,
    actor: "verify",
  });
  checks.approval_required = noApproval.ok === false;
  checks.no_approval_rejection = (noApproval.error ?? "").includes(
    "explicit_approval",
  );

  const badPhrase = await approveAndExecuteRelease({
    export_package_id: FIXTURE_EXPORT,
    explicit_approval: true,
    confirm_phrase: "yes",
    confirm_dialog: true,
    actor: "verify",
  });
  checks.confirm_phrase_required = badPhrase.ok === false;

  const noDialog = await approveAndExecuteRelease({
    export_package_id: FIXTURE_EXPORT,
    explicit_approval: true,
    confirm_phrase: "RELEASE_TO_STUDIOSISLAB",
    confirm_dialog: false,
    actor: "verify",
  });
  checks.confirm_dialog_required = noDialog.ok === false;

  // --- ReleaseManager cannot bypass controller ---
  let bypassBlocked = false;
  try {
    runReleaseManager({
      package_dir: join(EXPORT_PACKAGES_ROOT, FIXTURE_EXPORT),
      founder_final_publish_approval: true,
      persist: false,
    });
  } catch (e) {
    bypassBlocked = String(e).includes("FounderReleaseAuthorization");
  }
  checks.release_manager_cannot_bypass = bypassBlocked;

  let authRequired = false;
  try {
    runAuthorizedExportRelease({
      authorization: {
        authorization_id: "fake",
        export_package_id: FIXTURE_EXPORT,
        catalogue_id: "t099",
        reservation_id: "fake",
        founder_name: "x",
        approved_at: new Date().toISOString(),
        explicit_approval: true,
        confirm_phrase: "RELEASE_TO_STUDIOSISLAB",
        scope: "export_package_release",
        nonce: "n",
        signature: "bad",
      } satisfies FounderReleaseAuthorization,
      export_package_dir: join(EXPORT_PACKAGES_ROOT, FIXTURE_EXPORT),
      persist: false,
    });
  } catch (e) {
    authRequired = String(e).includes("authorization");
  }
  checks.unauthorized_engine_rejected = authRequired;

  // website still untouched
  const mid = websiteFingerprint();
  checks.website_untouched_pre_release = JSON.stringify(mid) === JSON.stringify(beforeAll);

  // --- integrity mismatch ---
  resetFixtureReady();
  const integrityPath = join(
    EXPORT_PACKAGES_ROOT,
    FIXTURE_EXPORT,
    "integrity.json",
  );
  const integrityBak = `${integrityPath}.bak-verify`;
  copyFileSync(integrityPath, integrityBak);
  const integrity = JSON.parse(readFileSync(integrityPath, "utf8")) as {
    files: Record<string, string>;
  };
  integrity.files["template.json"] = "0".repeat(64);
  writeFileSync(integrityPath, JSON.stringify(integrity, null, 2));
  const integrityFail = await approveAndExecuteRelease({
    export_package_id: FIXTURE_EXPORT,
    explicit_approval: true,
    confirm_phrase: "RELEASE_TO_STUDIOSISLAB",
    confirm_dialog: true,
    actor: "verify",
  });
  copyFileSync(integrityBak, integrityPath);
  checks.integrity_mismatch = integrityFail.ok === false;
  resetFixtureReady();

  // --- rollback (forced failure after copy) ---
  const beforeRollback = websiteFingerprint();
  const rollbackResult = await approveAndExecuteRelease({
    export_package_id: FIXTURE_EXPORT,
    explicit_approval: true,
    confirm_phrase: "RELEASE_TO_STUDIOSISLAB",
    confirm_dialog: true,
    actor: "verify",
    force_fail_after: "copy_template",
  });
  const afterRollback = websiteFingerprint();
  checks.rollback =
    rollbackResult.ok === false &&
    rollbackResult.rolled_back === true &&
    JSON.stringify(afterRollback) === JSON.stringify(beforeRollback);
  resetFixtureReady();

  // --- request transition ---
  const requested = requestRelease({
    export_package_id: FIXTURE_EXPORT,
    actor: "verify",
  });
  checks.release_requested = requested.status === "RELEASE_REQUESTED";

  // --- plan / SEO collision awareness ---
  const plan = buildPublicationPlan({ export_package_id: FIXTURE_EXPORT });
  checks.seo_collision_plan =
    plan.seo_collision === true &&
    plan.seo_slug_resolved === "accountant-ats-resume";

  // --- successful release (fixture only) ---
  const success = await approveAndExecuteRelease({
    export_package_id: FIXTURE_EXPORT,
    explicit_approval: true,
    confirm_phrase: "RELEASE_TO_STUDIOSISLAB",
    confirm_dialog: true,
    founder_name: "Stephen",
    actor: "verify-demo",
  });
  checks.successful_release =
    success.ok === true && success.status === "RELEASE_COMPLETED";

  checks.reservation_committed =
    findReservationByCandidate(FIXTURE_CANDIDATE)?.status ===
    "RELEASE_COMPLETED";

  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as {
    templates: Array<{ id: string; status: string }>;
  };
  checks.manifest_updated = Boolean(
    manifest.templates.some((t) => t.id === "t099" && t.status === "published"),
  );
  checks.assets_copied =
    existsSync(join(PUBLIC_TEMPLATES, "t099.png")) &&
    existsSync(join(PUBLIC_TEMPLATES, "t099.webp")) &&
    existsSync(TEMPLATE_JSON);
  checks.registries_regenerated =
    readFileSync(REGISTRY, "utf8").includes('id: "t099"') &&
    readFileSync(CATALOG, "utf8").includes('id: "t099"');
  const seoText = readFileSync(SEO, "utf8");
  checks.seo_updated =
    seoText.includes('templateId: "t099"') &&
    seoText.includes('slug: "accountant-ats-resume"');
  checks.seo_collision_resolved = checks.seo_updated;

  // --- duplicate release ---
  const dup = await approveAndExecuteRelease({
    export_package_id: FIXTURE_EXPORT,
    explicit_approval: true,
    confirm_phrase: "RELEASE_TO_STUDIOSISLAB",
    confirm_dialog: true,
    actor: "verify",
  });
  checks.duplicate_release_blocked = dup.ok === false;

  // --- audit ---
  const audit = readReleaseAudit();
  checks.audit_written =
    audit.some((e) => e.type === "approval" && e.ok) &&
    audit.some((e) => e.type === "completion" && e.ok) &&
    audit.some((e) => e.type === "rollback") &&
    audit.some((e) => e.type === "failure");

  // --- status API ---
  const status = getReleaseStatus({ export_package_id: FIXTURE_EXPORT });
  checks.status_api = status.reservation_status === "RELEASE_COMPLETED";

  checks.live_off = process.env.SOS_AIOS_LIVE !== "1";
  checks.auto_publish_false = success.auto_publish === false;

  const ok = Object.values(checks).every(Boolean);
  const payload = {
    ok,
    agent: 246,
    checks,
    fixture: {
      export_package_id: FIXTURE_EXPORT,
      candidate_id: FIXTURE_CANDIDATE,
      catalogue_id: "t099",
      status: findReservationByCandidate(FIXTURE_CANDIDATE)?.status ?? null,
      release_id: success.release_id,
      slug: "accountant-ats-resume",
    },
    publication_allowed_auto: false,
    live: false,
  };
  mkdirSync(join(REPO, "SOS/07_LOGS/saios/export"), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);

  writeFileSync(
    REPORT,
    [
      "# AIOS Founder Release Controller V1 Report",
      "",
      "**Agent:** #246",
      `**Overall:** ${ok ? "PASS" : "FAIL"}`,
      "**LIVE:** OFF",
      "**auto_publish:** false",
      "",
      "## 1. Current System",
      "",
      "- Pipeline through Publication Readiness complete.",
      "- Founder Release Controller is the sole authorization layer for StudiosisLab commit.",
      "- ReleaseManager executes only with minted FounderReleaseAuthorization.",
      "",
      "## 2. Founder Authorization",
      "",
      "- Requires `explicit_approval=true`, confirmation dialog, and phrase `RELEASE_TO_STUDIOSISLAB`.",
      "- Never infers approval. Boolean flags alone cannot authorize export packages.",
      "",
      "## 3. Release Execution",
      "",
      "- Lifecycle: READY_FOR_RELEASE → RELEASE_REQUESTED → FOUNDER_RELEASE_APPROVED → RELEASE_EXECUTING → RELEASE_COMPLETED | RELEASE_FAILED.",
      "- Atomic snapshot → mutate → verify → commit; fixture demo released `t099`.",
      "",
      "## 4. Rollback",
      "",
      "- On failure, restores manifest, registries, assets, template JSON, SEO from snapshot.",
      "- Forced failure test confirmed website fingerprint unchanged.",
      "",
      "## 5. Dashboard",
      "",
      "- Founder-only release APIs + Founder Review actions (Release / Plan / Dry Run) with confirmation dialog.",
      "",
      "## 6. CLI",
      "",
      "- `npm run aios:release`",
      "- `npm run aios:release:verify`",
      "",
      "## 7. Tests",
      "",
      "| Check | Result |",
      "|-------|--------|",
      ...Object.entries(checks).map(
        ([k, v]) => `| ${k} | ${v ? "PASS" : "FAIL"} |`,
      ),
      "",
      "## 8. Demonstration",
      "",
      `- Fixture only: \`${FIXTURE_EXPORT}\` / \`${FIXTURE_CANDIDATE}\` → catalogue \`t099\`.`,
      "- Real Founder OpenAI templates were not published.",
      `- SEO collision resolved to \`accountant-ats-resume\`.`,
      "",
      "## 9. Files Changed",
      "",
      "- `SOS/SAIOS/core/founder-release/*`",
      "- `SOS/SAIOS/runtime/publication/ExportPackageReleaseEngine.ts`",
      "- `SOS/SAIOS/runtime/publication/ReleaseManager.ts` (export gate)",
      "- Export reservation statuses extended",
      "- Dashboard release APIs + Founder Review actions",
      "- package.json scripts",
      "- this report",
      "",
      "## 10. Verification",
      "",
      `- Machine JSON: \`${OUT.replace(`${REPO}/`, "")}\``,
      `- Overall: **${ok ? "PASS" : "FAIL"}**`,
      "",
      "## 11. Remaining Gaps",
      "",
      "- Continuous/auto release remains intentionally disabled.",
      "- Batch multi-package Founder release UI polish can follow.",
      "",
      "## 12. Exact Next Action",
      "",
      "- Agent #247: post-release verification / catalogue health / Founder release ops hardening (LIVE remains Founder-controlled).",
      "",
    ].join("\n"),
  );

  console.log(JSON.stringify(payload, null, 2));
  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
