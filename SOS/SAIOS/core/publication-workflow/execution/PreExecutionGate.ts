/**
 * Pre-execution revalidation — fail closed before any production writes.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { discoverEligibleCandidates } from "../EligibilityCollector.js";
import { filterPublicationGitPaths } from "../GitPathAllowlist.js";
import { defaultPublicationRoots, type PublicationRoots } from "../paths.js";
import {
  discoveryOptionsForPlan,
  readPlan,
  resolvePlanScope,
} from "../PublicationPlanService.js";
import { verifyPublicationPlan } from "../PublicationVerifyService.js";
import { verifyStagingChecksumManifest } from "../../staging/ChecksumManifest.js";
import type { PublicationPlan } from "../types.js";

export type PreExecutionGateResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  checks: Array<{ name: string; pass: boolean; detail: string }>;
};

export function runPreExecutionGate(
  planId: string,
  roots: PublicationRoots = defaultPublicationRoots(),
  opts: { skip_git_dirty?: boolean } = {},
): PreExecutionGateResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const checks: PreExecutionGateResult["checks"] = [];

  const plan = readPlan(planId, roots);
  if (!plan) {
    return {
      ok: false,
      errors: [`Plan not found: ${planId}`],
      warnings: [],
      checks: [{ name: "plan_exists", pass: false, detail: "missing" }],
    };
  }

  const verification = verifyPublicationPlan(planId, roots);
  checks.push({
    name: "reverify_pass",
    pass: verification.pass,
    detail: verification.pass
      ? "verify pass=true"
      : verification.errors.join("; "),
  });
  if (!verification.pass) {
    errors.push(`Pre-execution verification failed: ${verification.errors.join("; ")}`);
  }

  const discovery = discoverEligibleCandidates(
    roots,
    discoveryOptionsForPlan(plan),
  );
  const scope = resolvePlanScope(plan);
  const planFp =
    typeof plan.eligibility_fingerprint === "string"
      ? plan.eligibility_fingerprint
      : "";
  const discoveryFp =
    typeof discovery.eligibility_fingerprint === "string"
      ? discovery.eligibility_fingerprint
      : "";
  const zeroEligible =
    plan.entries.length === 0 && discovery.eligible.length === 0;
  const fpOk = zeroEligible
    ? true
    : planFp.length > 0 && planFp === discoveryFp;
  checks.push({
    name: "eligibility_fingerprint_unchanged",
    pass: fpOk,
    detail: zeroEligible
      ? "zero-eligible NO_WORK"
      : fpOk
        ? "unchanged"
        : "fingerprint drifted or missing",
  });
  if (!fpOk) errors.push("Eligibility fingerprint changed since plan");

  if (scope.mode === "explicit" && discovery.missing_requested.length > 0) {
    errors.push(
      `Explicit scope Resume Template(s) no longer eligible: ${discovery.missing_requested.join(", ")}`,
    );
    checks.push({
      name: "explicit_scope_still_eligible",
      pass: false,
      detail: discovery.missing_requested.join(", "),
    });
  }

  const planIds = new Set(plan.entries.map((e) => e.candidate_id));
  const discoveredIds = new Set(discovery.eligible.map((e) => e.candidate_id));
  const omitted = [...discoveredIds].filter((id) => !planIds.has(id));
  const extra = [...planIds].filter((id) => !discoveredIds.has(id));
  const setsMatch =
    omitted.length === 0 &&
    extra.length === 0 &&
    planIds.size === discoveredIds.size;
  checks.push({
    name: "no_candidate_omission",
    pass: setsMatch,
    detail: setsMatch
      ? "PLANNED_ENTRY_IDS == APPLY_DISCOVERY_IDS"
      : `omitted=[${omitted.join(",")}] extra=[${extra.join(",")}]`,
  });
  if (!setsMatch) {
    errors.push(
      `Resume template plan/apply scope mismatch: planned=[${[...planIds].sort().join("|")}] discovery=[${[...discoveredIds].sort().join("|")}]`,
    );
  }
  if (scope.mode === "all_eligible" && omitted.length) {
    errors.push(`Resume template omission: ${omitted.join(", ")}`);
  }
  for (const entry of plan.entries) {
    const pkg = join(roots.stagingPackagesRoot, entry.staging_package_id);
    const checksumPath = join(pkg, "checksums.json");
    if (!existsSync(checksumPath)) {
      checks.push({
        name: "staging_checksum",
        pass: false,
        detail: `missing checksums for ${entry.staging_package_id}`,
      });
      errors.push(`Missing staging checksums: ${entry.staging_package_id}`);
      continue;
    }
    const result = verifyStagingChecksumManifest({
      packageDir: pkg,
      checksumsPath: checksumPath,
    });
    checks.push({
      name: "staging_checksum",
      pass: result.ok,
      detail: result.ok
        ? `${entry.staging_package_id} ok`
        : `${entry.staging_package_id}: ${result.errors.join("; ")}`,
    });
    if (!result.ok) {
      errors.push(
        `Staging checksum failed ${entry.staging_package_id}: ${result.errors.join("; ")}`,
      );
    }

    // Current revision / not published
    const lifePath = join(roots.lifecycleRoot, `${entry.candidate_id}.json`);
    if (existsSync(lifePath)) {
      const life = JSON.parse(readFileSync(lifePath, "utf8")) as {
        lifecycle_status?: string;
        staging_package_id?: string;
      };
      if (life.lifecycle_status === "PUBLISHED") {
        errors.push(`Resume template already published: ${entry.candidate_id}`);
        checks.push({
          name: "not_already_published",
          pass: false,
          detail: entry.candidate_id,
        });
      }
      if (
        life.staging_package_id &&
        life.staging_package_id !== entry.staging_package_id
      ) {
        errors.push(
          `Resume template superseded/staging drift: ${entry.candidate_id} now ${life.staging_package_id}`,
        );
        checks.push({
          name: "current_revision",
          pass: false,
          detail: entry.candidate_id,
        });
      }
    }

    const candPath = join(
      roots.candidatesRoot,
      entry.candidate_id,
      "candidate.json",
    );
    if (existsSync(candPath)) {
      const cand = JSON.parse(readFileSync(candPath, "utf8")) as {
        superseded_by_revision?: string;
      };
      if (cand.superseded_by_revision) {
        errors.push(
          `Resume template superseded after plan: ${entry.candidate_id} → ${cand.superseded_by_revision}`,
        );
        checks.push({
          name: "not_superseded",
          pass: false,
          detail: entry.candidate_id,
        });
      }
    }

    // Catalogue ID available in manifest
    if (existsSync(roots.manifestPath)) {
      const man = JSON.parse(readFileSync(roots.manifestPath, "utf8")) as {
        templates?: Array<{ id?: string; status?: string }>;
      };
      const hit = (man.templates ?? []).find(
        (t) =>
          String(t.id ?? "").toLowerCase() ===
          entry.proposed_catalogue_id.toLowerCase(),
      );
      if (hit && String(hit.status ?? "").toLowerCase() === "published") {
        errors.push(
          `Catalogue ${entry.proposed_catalogue_id} already published in manifest`,
        );
        checks.push({
          name: "catalogue_id_available",
          pass: false,
          detail: entry.proposed_catalogue_id,
        });
      }
    }
  }

  const allow = filterPublicationGitPaths(plan.git_path_allowlist);
  checks.push({
    name: "git_path_allowlist",
    pass: allow.rejected.length === 0,
    detail:
      allow.rejected.length === 0
        ? "allowlist ok"
        : allow.rejected.map((r) => r.path).join(", "),
  });
  if (allow.rejected.length) {
    errors.push(
      `Git allowlist rejected: ${allow.rejected.map((r) => r.path).join(", ")}`,
    );
  }

  if (!opts.skip_git_dirty) {
    // Best-effort: adapters also check; here we only note when website root is real repo
    checks.push({
      name: "working_tree_check_deferred",
      pass: true,
      detail: "Working tree conflict checked at write phase via adapters",
    });
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    checks,
  };
}

export function assertPlanEntriesComplete(plan: PublicationPlan): string[] {
  const errors: string[] = [];
  if (plan.entries.length === 0) errors.push("Plan has zero entries");
  for (const e of plan.entries) {
    if (!e.proposed_catalogue_id) {
      errors.push(`Missing catalogue ID for ${e.candidate_id}`);
    }
    if (!e.staging_package_id) {
      errors.push(`Missing staging package for ${e.candidate_id}`);
    }
  }
  return errors;
}
