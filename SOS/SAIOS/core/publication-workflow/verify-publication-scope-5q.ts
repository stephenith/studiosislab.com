/**
 * Phase 5Q — scoped publication planning + non-production exclusion.
 * Offline / no OpenAI / no real publication apply.
 */
import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  collectOccupiedCatalogueNumbers,
  discoverEligibleCandidates,
  proposeCatalogueIds,
} from "./EligibilityCollector.js";
import {
  createPublicationPlan,
  readPlan,
  resolvePlanScope,
} from "./PublicationPlanService.js";
import { getCandidatePublicationStatus } from "./PublicationStatusService.js";
import { verifyPublicationPlan } from "./PublicationVerifyService.js";
import { runPreExecutionGate } from "./execution/PreExecutionGate.js";
import { defaultPublicationRoots, type PublicationRoots } from "./paths.js";
import { isNonProductionResumeTemplate } from "../staging/ApprovalStagingHandoff.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/publication/verify-publication-scope-5q.json",
);

type Check = { name: string; pass: boolean; detail: string };

function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: Boolean(cond), detail };
}

function writeJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function makeRoots(base: string): PublicationRoots {
  return {
    ...defaultPublicationRoots(base),
    repo: base,
    websiteTargetRoot: join(base, "website"),
    decisionsJsonl: join(base, "decisions.jsonl"),
    lifecycleRoot: join(base, "lifecycle"),
    stagingPackagesRoot: join(base, "packages"),
    candidatesRoot: join(base, "candidates"),
    reservationsPath: join(base, "reservations.json"),
    plansRoot: join(base, "plans"),
    manifestPath: join(base, "website/templates.manifest.json"),
    quarantineRoot: join(base, "orphans"),
    releaseHistoryPath: join(base, "release-history.json"),
    releaseManagerRoot: join(base, "release-manager"),
    executionsRoot: join(base, "executions"),
    locksRoot: join(base, "locks"),
    exportPackagesRoot: join(base, "exports"),
  };
}

function seedEligible(
  roots: PublicationRoots,
  input: {
    candId: string;
    pkgId: string;
    title: string;
    decisionId: string;
    genId: string;
    approvedAt?: string;
    fixture?: boolean;
  },
): void {
  const now = input.approvedAt ?? "2026-09-01T12:00:00.000Z";
  const dir = join(roots.stagingPackagesRoot, input.pkgId);
  mkdirSync(dir, { recursive: true });
  const canvas = JSON.stringify({ version: "5.3.0", objects: [] });
  const preview = Buffer.from(`preview-${input.candId}`);
  const thumb = Buffer.from(`thumb-${input.candId}`);
  writeFileSync(join(dir, "canvas.json"), canvas);
  writeFileSync(join(dir, "preview-source.png"), preview);
  writeFileSync(join(dir, "thumbnail-source.png"), thumb);
  writeJson(join(dir, "checksums.json"), {
    algorithm: "sha256",
    generated_at: now,
    files: {
      "canvas.json": sha256(canvas),
      "preview-source.png": sha256(preview.toString("binary")),
      "thumbnail-source.png": sha256(thumb.toString("binary")),
    },
  });
  // Fix checksums to match actual buffers
  writeJson(join(dir, "checksums.json"), {
    algorithm: "sha256",
    generated_at: now,
    files: {
      "canvas.json": sha256(canvas),
      "preview-source.png": createHash("sha256").update(preview).digest("hex"),
      "thumbnail-source.png": createHash("sha256").update(thumb).digest("hex"),
    },
  });
  writeJson(join(dir, "validation-report.json"), {
    staging_package_id: input.pkgId,
    candidate_id: input.candId,
    generation_id: input.genId,
    pass: true,
    checked_at: now,
    checks: { checksums_match: true },
    errors: [],
    warnings: [],
    publication_allowed: false,
  });
  writeJson(join(dir, "staging-manifest.json"), {
    staging_package_id: input.pkgId,
    candidate_id: input.candId,
    generation_id: input.genId,
    title: input.title,
    role: input.title,
    category: "business",
    design_family: "family-a",
    approval_decision_id: input.decisionId,
    founder_approved_at: now,
    staged_at: now,
    current_lifecycle_status: "VALIDATED",
    publication_allowed: false,
    live: false,
  });
  writeJson(join(roots.candidatesRoot, input.candId, "candidate.json"), {
    candidate_id: input.candId,
    review_id: `review-${input.candId}`,
    status: "approved",
    fixture: input.fixture === true ? true : undefined,
    target: { title: input.title, role_family: "ats", category: "business" },
  });
  writeJson(join(roots.lifecycleRoot, `${input.candId}.json`), {
    candidate_id: input.candId,
    generation_id: input.genId,
    lifecycle_status: "VALIDATED",
    approval_decision_id: input.decisionId,
    founder_approved_at: now,
    staging_package_id: input.pkgId,
    updated_at: now,
    publication_allowed: false,
  });
  mkdirSync(dirname(roots.decisionsJsonl), { recursive: true });
  writeFileSync(
    roots.decisionsJsonl,
    `${JSON.stringify({
      decision_id: input.decisionId,
      decision: "APPROVED",
      created_at: now,
      review_id: `review-${input.candId}`,
      structured_feedback: { candidate_id: input.candId },
    })}\n`,
    { flag: "a" },
  );
}

function main(): void {
  const checks: Check[] = [];
  const base = join(
    REPO,
    "SOS/07_LOGS/saios/publication/.tmp-phase5q",
    randomUUID().slice(0, 8),
  );
  mkdirSync(base, { recursive: true });

  try {
    const roots = makeRoots(join(base, "main"));
    mkdirSync(join(roots.websiteTargetRoot), { recursive: true });
    writeJson(roots.manifestPath, {
      templates: [{ id: "t103", title: "Prior", status: "published" }],
    });
    writeJson(roots.reservationsPath, {
      schema_version: 1,
      reservations: [
        {
          reservation_id: "rsv-occupied-mid",
          reserved_catalogue_id: "t104",
          generation_id: "GEN-OCC",
          candidate_id: "cand-ats-sales-dev-historical",
          staging_package_id: "stg-occ",
          reserved_at: "2026-08-01T00:00:00.000Z",
          status: "RELEASE_COMPLETED",
          reason: "historical",
          checksum: "x",
          export_package_id: null,
          updated_at: "2026-08-01T00:00:00.000Z",
          publication_allowed: false,
        },
      ],
    });
    writeFileSync(roots.decisionsJsonl, "");

    const office = "cand-ats-office-manager-sample-5q";
    const hr = "cand-ats-hr-generalist-sample-5q";
    const fixture = "cand-fixture-aios-242-staging-demo";

    seedEligible(roots, {
      candId: office,
      pkgId: "stg-office-5q",
      title: "Office Manager",
      decisionId: "fd-office-5q",
      genId: "GEN-OFFICE-5Q",
      approvedAt: "2026-09-01T10:00:00.000Z",
    });
    seedEligible(roots, {
      candId: hr,
      pkgId: "stg-hr-5q",
      title: "HR Generalist",
      decisionId: "fd-hr-5q",
      genId: "GEN-HR-5Q",
      approvedAt: "2026-09-01T11:00:00.000Z",
    });
    seedEligible(roots, {
      candId: fixture,
      pkgId: "stg-fixture-5q",
      title: "Fixture Demo",
      decisionId: "fd-fixture-5q",
      genId: "GEN-FIX-5Q",
      approvedAt: "2026-07-24T10:00:00.000Z",
      fixture: true,
    });

    // 1+2+11 fixture exclusion + status
    checks.push(
      assert(
        isNonProductionResumeTemplate(fixture, roots.candidatesRoot),
        "fixture_classifier_true",
        fixture,
      ),
    );
    const discoveryAll = discoverEligibleCandidates(roots);
    checks.push(
      assert(
        !discoveryAll.eligible.some((e) => e.candidate_id === fixture),
        "fixture_not_in_eligible",
        discoveryAll.eligible.map((e) => e.candidate_id).join(","),
      ),
    );
    checks.push(
      assert(
        discoveryAll.excluded.some(
          (e) =>
            e.candidate_id === fixture &&
            e.status_label === "EXCLUDED_NON_PRODUCTION",
        ),
        "fixture_excluded_non_production",
        discoveryAll.excluded.find((e) => e.candidate_id === fixture)
          ?.status_label ?? "missing",
      ),
    );
    const fixtureStatus = getCandidatePublicationStatus(fixture, roots);
    checks.push(
      assert(
        fixtureStatus.status_label === "EXCLUDED_NON_PRODUCTION",
        "fixture_status_not_validated_eligible",
        fixtureStatus.status_label,
      ),
    );

    // 16 unscoped finds genuine eligible only
    checks.push(
      assert(
        discoveryAll.eligible.length === 2 &&
          discoveryAll.eligible.every((e) =>
            [office, hr].includes(e.candidate_id),
          ),
        "unscoped_genuine_eligible_only",
        discoveryAll.eligible.map((e) => e.candidate_id).join(","),
      ),
    );

    // 3+4+6 explicit one-template plan
    const { plan: scopedPlan } = createPublicationPlan(roots, {
      candidate_ids: [office],
    });
    const scope = resolvePlanScope(scopedPlan);
    checks.push(
      assert(
        scope.mode === "explicit" &&
          scope.candidate_ids.length === 1 &&
          scope.candidate_ids[0] === office,
        "scope_persisted_explicit_office",
        JSON.stringify(scope),
      ),
    );
    checks.push(
      assert(
        scopedPlan.entries.length === 1 &&
          scopedPlan.entries[0]?.candidate_id === office,
        "explicit_plan_one_entry_office",
        scopedPlan.entries.map((e) => e.candidate_id).join(","),
      ),
    );
    checks.push(
      assert(
        !scopedPlan.entries.some((e) => e.candidate_id === hr),
        "hr_absent_from_explicit_plan",
        "ok",
      ),
    );
    checks.push(
      assert(
        !scopedPlan.entries.some((e) => e.candidate_id === fixture),
        "fixture_absent_from_explicit_plan",
        "ok",
      ),
    );

    // 13+14+15 catalogue collision / quarantine / next free
    const proposed = proposeCatalogueIds(1, roots);
    checks.push(
      assert(
        proposed[0] !== "t104" && proposed[0] !== "t094" && proposed[0] !== "t099",
        "occupied_and_quarantine_skipped",
        proposed.join(","),
      ),
    );
    checks.push(
      assert(
        proposed[0] === "t105",
        "next_free_catalogue_deterministic",
        `got=${proposed[0]} expected=t105 (t103 manifest + t104 reservation)`,
      ),
    );
    checks.push(
      assert(
        scopedPlan.entries[0]?.proposed_catalogue_id === "t105",
        "scoped_plan_uses_next_free_id",
        scopedPlan.entries[0]?.proposed_catalogue_id ?? "",
      ),
    );
    const occupied = collectOccupiedCatalogueNumbers(roots);
    checks.push(
      assert(
        occupied.has(103) && occupied.has(104) && occupied.has(94) && occupied.has(99),
        "occupied_set_includes_manifest_reservation_quarantine",
        [...occupied].sort((a, b) => a - b).join(","),
      ),
    );

    // 7 verify uses same scope + 9 drift: add new eligible after plan
    const verify1 = verifyPublicationPlan(scopedPlan.plan_id, roots);
    checks.push(
      assert(verify1.pass === true, "verify_scoped_pass", verify1.errors.join(";")),
    );

    const late = "cand-ats-late-eligible-5q";
    seedEligible(roots, {
      candId: late,
      pkgId: "stg-late-5q",
      title: "Late Eligible Role",
      decisionId: "fd-late-5q",
      genId: "GEN-LATE-5Q",
      approvedAt: "2026-09-01T12:30:00.000Z",
    });
    const verifyDrift = verifyPublicationPlan(scopedPlan.plan_id, roots);
    checks.push(
      assert(
        verifyDrift.pass === true,
        "scope_drift_new_eligible_ignored",
        verifyDrift.errors.join(";") || "pass",
      ),
    );
    const planAfter = readPlan(scopedPlan.plan_id, roots)!;
    checks.push(
      assert(
        planAfter.entries.length === 1 &&
          planAfter.entries[0]?.candidate_id === office,
        "scoped_plan_entries_unchanged_after_drift",
        String(planAfter.entries.length),
      ),
    );

    // 8+12 apply pre-gate uses same scope; fixture cannot enter
    const gate = runPreExecutionGate(scopedPlan.plan_id, roots, {
      skip_git_dirty: true,
    });
    checks.push(
      assert(
        gate.ok === true,
        "apply_pregate_scoped_ok",
        gate.errors.join(";"),
      ),
    );
    checks.push(
      assert(
        gate.checks.some(
          (c) =>
            c.name === "no_candidate_omission" &&
            c.pass &&
            c.detail.includes("PLANNED_ENTRY_IDS"),
        ),
        "apply_planned_equals_discovery",
        gate.checks.find((c) => c.name === "no_candidate_omission")?.detail ??
          "",
      ),
    );

    // 5 invalid explicit target
    let invalidThrew = false;
    let invalidMsg = "";
    try {
      createPublicationPlan(roots, {
        candidate_ids: ["cand-nonexistent-or-ineligible"],
      });
    } catch (e) {
      invalidThrew = true;
      invalidMsg = e instanceof Error ? e.message : String(e);
    }
    checks.push(
      assert(
        invalidThrew && /not eligible|no substitute/i.test(invalidMsg),
        "invalid_explicit_target_no_substitute",
        invalidMsg.slice(0, 160),
      ),
    );

    // Fixture as explicit target also fails
    let fixtureScopeThrew = false;
    try {
      createPublicationPlan(roots, { candidate_ids: [fixture] });
    } catch {
      fixtureScopeThrew = true;
    }
    checks.push(
      assert(
        fixtureScopeThrew,
        "fixture_explicit_scope_rejected",
        "ok",
      ),
    );

    // 10 target becomes ineligible → fail closed
    const lifePath = join(roots.lifecycleRoot, `${office}.json`);
    const life = JSON.parse(readFileSync(lifePath, "utf8")) as {
      lifecycle_status: string;
      [k: string]: unknown;
    };
    life.lifecycle_status = "CHANGES_REQUESTED";
    writeJson(lifePath, life);
    writeFileSync(
      roots.decisionsJsonl,
      `${JSON.stringify({
        decision_id: "fd-office-cr",
        decision: "CHANGES_REQUESTED",
        created_at: "2026-09-01T13:00:00.000Z",
        review_id: `review-${office}`,
        structured_feedback: { candidate_id: office },
      })}\n`,
      { flag: "a" },
    );
    const verifyInelig = verifyPublicationPlan(scopedPlan.plan_id, roots);
    checks.push(
      assert(
        verifyInelig.pass === false,
        "target_ineligible_verify_fail_closed",
        verifyInelig.errors.join(";").slice(0, 200),
      ),
    );
    const gateInelig = runPreExecutionGate(scopedPlan.plan_id, roots, {
      skip_git_dirty: true,
    });
    checks.push(
      assert(
        gateInelig.ok === false,
        "target_ineligible_apply_fail_closed",
        gateInelig.errors.join(";").slice(0, 200),
      ),
    );

    // Unscoped plan on fresh roots still works for genuine items
    const roots2 = makeRoots(join(base, "unscoped"));
    mkdirSync(join(roots2.websiteTargetRoot), { recursive: true });
    writeJson(roots2.manifestPath, { templates: [{ id: "t050" }] });
    writeJson(roots2.reservationsPath, { schema_version: 1, reservations: [] });
    writeFileSync(roots2.decisionsJsonl, "");
    seedEligible(roots2, {
      candId: "cand-ats-role-a-5q",
      pkgId: "stg-a",
      title: "Role A",
      decisionId: "fd-a",
      genId: "GEN-A",
    });
    seedEligible(roots2, {
      candId: "cand-fixture-demo-5q",
      pkgId: "stg-fx",
      title: "Fixture Role",
      decisionId: "fd-fx",
      genId: "GEN-FX",
      fixture: true,
    });
    const { plan: unscoped } = createPublicationPlan(roots2);
    checks.push(
      assert(
        unscoped.scope.mode === "all_eligible" &&
          unscoped.entries.length === 1 &&
          unscoped.entries[0]?.candidate_id === "cand-ats-role-a-5q",
        "unscoped_nightly_genuine_only",
        JSON.stringify({
          scope: unscoped.scope,
          entries: unscoped.entries.map((e) => e.candidate_id),
        }),
      ),
    );

    // 17 build/git gates unchanged — smoke that readiness 5L helpers still import
    checks.push(
      assert(
        typeof verifyPublicationPlan === "function" &&
          typeof runPreExecutionGate === "function",
        "publication_gates_still_present",
        "ok",
      ),
    );
  } finally {
    try {
      rmSync(base, { recursive: true, force: true });
    } catch {
      /* keep on failure for debug */
    }
  }

  const allPass = checks.every((c) => c.pass);
  const result = {
    generated_at: new Date().toISOString(),
    phase: "5Q",
    overall: allPass ? "PASS" : "FAIL",
    openai: false,
    publication_executed: false,
    checks,
    failed: checks.filter((c) => !c.pass).map((c) => c.name),
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));
  if (!allPass) process.exit(1);
}

main();
