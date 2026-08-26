/**
 * Batch verification for a publication plan — any failure invalidates the batch.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { discoverEligibleCandidates } from "./EligibilityCollector.js";
import { filterPublicationGitPaths } from "./GitPathAllowlist.js";
import {
  defaultPublicationRoots,
  QUARANTINED_TEMPLATE_IDS,
  type PublicationRoots,
} from "./paths.js";
import {
  readPlan,
  writePlan,
} from "./PublicationPlanService.js";
import type {
  PublicationVerificationCheck,
  PublicationVerificationReport,
} from "./types.js";
import { verifyStagingChecksumManifest } from "../staging/ChecksumManifest.js";

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function check(
  name: string,
  pass: boolean,
  detail: string,
  candidate_id?: string,
): PublicationVerificationCheck {
  return { name, pass, detail, candidate_id };
}

export function verifyPublicationPlan(
  planId: string,
  roots: PublicationRoots = defaultPublicationRoots(),
): PublicationVerificationReport {
  const plan = readPlan(planId, roots);
  if (!plan) {
    return {
      plan_id: planId,
      verified_at: new Date().toISOString(),
      pass: false,
      checks: [check("plan_exists", false, `Plan not found: ${planId}`)],
      errors: [`Plan not found: ${planId}`],
      warnings: [],
      eligible_count: 0,
      discovered_eligible_count: 0,
      omission_detected: true,
    };
  }

  const checks: PublicationVerificationCheck[] = [];
  const errors: string[] = [];
  const warnings: string[] = [...plan.warnings];

  const discovery = discoverEligibleCandidates(roots);
  checks.push(
    check(
      "eligibility_fingerprint_stable",
      discovery.eligibility_fingerprint === plan.eligibility_fingerprint,
      discovery.eligibility_fingerprint === plan.eligibility_fingerprint
        ? "Fingerprint matches plan"
        : `Fingerprint drift: plan=${plan.eligibility_fingerprint.slice(0, 12)}… discovery=${discovery.eligibility_fingerprint.slice(0, 12)}…`,
    ),
  );

  const planIds = new Set(plan.entries.map((e) => e.candidate_id));
  const discoveredIds = new Set(discovery.eligible.map((e) => e.candidate_id));
  const omitted = [...discoveredIds].filter((id) => !planIds.has(id));
  const extra = [...planIds].filter((id) => !discoveredIds.has(id));
  const omission_detected = omitted.length > 0;
  checks.push(
    check(
      "no_candidate_omission",
      !omission_detected && extra.length === 0,
      omission_detected
        ? `Omitted eligible: ${omitted.join(", ")}`
        : extra.length
          ? `Plan has non-eligible entries: ${extra.join(", ")}`
          : "Plan matches current eligible set",
    ),
  );
  if (omission_detected) {
    errors.push(`Eligible resume templates omitted from plan: ${omitted.join(", ")}`);
  }
  if (extra.length) {
    errors.push(`Plan entries no longer eligible: ${extra.join(", ")}`);
  }

  // Catalogue uniqueness within plan + against live manifest
  const proposed = plan.entries.map((e) => e.proposed_catalogue_id);
  checks.push(
    check(
      "catalogue_ids_unique_in_plan",
      new Set(proposed).size === proposed.length,
      `Proposed IDs: ${proposed.join(", ")}`,
    ),
  );

  let manifestIds = new Set<string>();
  if (existsSync(roots.manifestPath)) {
    const manifest = readJson<{ templates?: Array<{ id?: string }> }>(
      roots.manifestPath,
    );
    manifestIds = new Set(
      (manifest.templates ?? []).map((t) => String(t.id ?? "").toLowerCase()),
    );
  }

  for (const entry of plan.entries) {
    const cid = entry.candidate_id;
    const pkg = join(roots.stagingPackagesRoot, entry.staging_package_id);

    // Founder approval proof
    checks.push(
      check(
        "founder_approval",
        entry.eligibility_proof.founder_decision === "APPROVED",
        `decision ${entry.decision_id}`,
        cid,
      ),
    );

    // Supersession
    const candPath = join(roots.candidatesRoot, cid, "candidate.json");
    let superseded = false;
    if (existsSync(candPath)) {
      const cand = readJson<{ superseded_by_revision?: string }>(candPath);
      superseded = Boolean(cand.superseded_by_revision);
    }
    checks.push(
      check(
        "not_superseded",
        !superseded,
        superseded ? "candidate has superseded_by_revision" : "current revision",
        cid,
      ),
    );
    if (superseded) errors.push(`${cid} is superseded`);

    // Staging validation
    const vrPath = join(pkg, "validation-report.json");
    const vrOk = existsSync(vrPath) && readJson<{ pass?: boolean }>(vrPath).pass === true;
    checks.push(
      check("staging_validation_pass", vrOk, vrPath, cid),
    );
    if (!vrOk) errors.push(`${cid} staging validation failed or missing`);

    // Canvas / preview / thumbnail
    const canvas = join(pkg, "canvas.json");
    const preview = join(pkg, "preview-source.png");
    const thumb = join(pkg, "thumbnail-source.png");
    checks.push(check("canvas_exists", existsSync(canvas), canvas, cid));
    checks.push(check("preview_exists", existsSync(preview), preview, cid));
    checks.push(check("thumbnail_exists", existsSync(thumb), thumb, cid));
    if (!existsSync(canvas)) errors.push(`${cid} missing canvas.json`);
    if (!existsSync(preview)) errors.push(`${cid} missing preview-source.png`);
    if (!existsSync(thumb)) errors.push(`${cid} missing thumbnail-source.png`);

    // Checksums — canonical { algorithm, generated_at, files } via shared parser
    const checksumsPath = join(pkg, "checksums.json");
    const checksumResult = verifyStagingChecksumManifest({
      packageDir: pkg,
      checksumsPath,
      requireCoreFiles: true,
    });
    const checksumOk = checksumResult.ok;
    if (!checksumOk) {
      for (const err of checksumResult.errors) {
        errors.push(`${cid} ${err}`);
      }
    }
    checks.push(
      check(
        "package_checksums",
        checksumOk,
        checksumOk
          ? `ok schema=${checksumResult.schema} files=${checksumResult.verified_files.length}`
          : checksumResult.errors.join("; "),
        cid,
      ),
    );

    // Manifest collision
    const cat = entry.proposed_catalogue_id.toLowerCase();
    const collision = manifestIds.has(cat);
    checks.push(
      check(
        "manifest_no_collision",
        !collision,
        collision
          ? `${cat} already in templates.manifest.json`
          : `${cat} free`,
        cid,
      ),
    );
    if (collision) errors.push(`Manifest collision on ${cat}`);

    // Quarantine
    const quarantined = (QUARANTINED_TEMPLATE_IDS as readonly string[]).includes(
      cat,
    );
    checks.push(
      check(
        "not_quarantined",
        !quarantined,
        quarantined ? `${cat} is quarantined` : `${cat} not quarantined`,
        cid,
      ),
    );
    if (quarantined) errors.push(`${cat} is quarantined`);

    // Git allowlist for expected files
    const { rejected } = filterPublicationGitPaths(
      entry.expected_generated_files,
    );
    checks.push(
      check(
        "generated_file_allowlist",
        rejected.length === 0,
        rejected.length
          ? rejected.map((r) => `${r.path}: ${r.reason}`).join("; ")
          : "all expected paths allowlisted",
        cid,
      ),
    );
    if (rejected.length) {
      errors.push(
        `${cid} expected files outside allowlist: ${rejected.map((r) => r.path).join(", ")}`,
      );
    }
  }

  // Plan-level allowlist consistency
  const { rejected: planRejected } = filterPublicationGitPaths(
    plan.git_path_allowlist,
  );
  checks.push(
    check(
      "plan_git_allowlist",
      planRejected.length === 0,
      planRejected.length
        ? planRejected.map((r) => r.path).join(", ")
        : "plan allowlist clean",
    ),
  );

  const pass = checks.every((c) => c.pass) && errors.length === 0;
  const report: PublicationVerificationReport = {
    plan_id: planId,
    verified_at: new Date().toISOString(),
    pass,
    checks,
    errors,
    warnings,
    eligible_count: plan.entries.length,
    discovered_eligible_count: discovery.eligible.length,
    omission_detected,
  };

  // Persist verification onto plan (no website writes)
  const next = {
    ...plan,
    status: pass ? ("VERIFIED" as const) : plan.status,
    updated_at: new Date().toISOString(),
    verification: report,
  };
  // On failure, keep DRAFT but attach report; do not mark VERIFIED
  if (!pass && plan.status === "VERIFIED") {
    next.status = "DRAFT";
  }
  writePlan(next, roots);

  // Write sidecar report
  const reportPath = join(roots.plansRoot, `${planId}.verification.json`);
  mkdirSync(roots.plansRoot, { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  return report;
}
