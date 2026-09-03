#!/usr/bin/env tsx
/**
 * Phase 2A offline verifier — outcomes, root projections, escape hatches,
 * consumer schemas, finding ledger, run lock. Temporary directories only.
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { formatOutcomeLabel } from "./WebsiteCheckHelpers.js";
import {
  TEST_BYPASS_ENV,
  assertPersistSafety,
  isWebsitePersistAuthorization,
  readWebsiteEnablement,
  resolveExecutionGate,
} from "./WebsiteDepartmentPolicy.js";
import {
  applyFindingObservations,
  buildFindingFingerprint,
  loadFinding,
  loadFindingIndex,
  normalizeFindingMessage,
  normalizeQueryParams,
  suppressFinding,
} from "./WebsiteFindingLedger.js";
import {
  defaultWebsiteDepartmentRoot,
  persistWebsiteReports,
  renderWebsiteReport,
  WEBSITE_PROJECTION_FILES,
} from "./WebsiteReportBuilder.js";
import { canonicalizePath, isSameOrInsidePath } from "./WebsitePaths.js";
import { acquireWebsiteRunLock } from "./WebsiteRunLock.js";
import {
  runWebsiteDepartment,
  STATE_PATH,
  WEBSITE_DEPARTMENT,
} from "./WebsiteDepartmentDirector.js";
import { buildRouteRegistry } from "./WebsiteRouteRegistry.js";
import * as WebsiteDeptIndex from "./index.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
const JULY8_ROOT = join(REPO_ROOT, "SOS/07_LOGS/saios/website-department");
const FCC_CHECK_KEYS = [
  "runtime_catalog_check",
  "resume_gallery_check",
  "seo_check",
  "editor_check",
  "download_flow_check",
] as const;

const JULY8_FILES = [...WEBSITE_PROJECTION_FILES];

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function hashJuly8(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of JULY8_FILES) {
    const p = join(JULY8_ROOT, f);
    assert(existsSync(p), `July 8 missing: ${f}`);
    out[f] = sha256File(p);
  }
  return out;
}

function assertJuly8(before: Record<string, string>): void {
  for (const f of JULY8_FILES) {
    assert(sha256File(join(JULY8_ROOT, f)) === before[f], `July 8 mutated: ${f}`);
  }
}

async function main(): Promise<void> {
  const proofs: Record<string, boolean> = {};
  const july8Before = hashJuly8();
  const psBefore = sha256File(STATE_PATH);
  const tmp = mkdtempSync(join(tmpdir(), "website-dept-phase2a-"));
  const prevBypass = process.env[TEST_BYPASS_ENV];

  try {
    // --- NOT_RUN semantics ---
    const vo = await runWebsiteDepartment({
      verification_only: true,
      persist: false,
      allow_network: false,
      mode: "static",
    });
    const browser = vo.scenarios.find((s) => s.id === "browser_journey");
    assert(browser?.outcome === "not_run", "browser outcome not_run");
    assert(browser?.pass === false, "browser pass must be false");
    assert(!browser?.pass, "browser must not be ordinary pass");
    const md = renderWebsiteReport(vo);
    assert(md.includes("NOT_RUN"), "report renders NOT_RUN");
    assert(!md.includes("PASS [not_run]"), "no PASS [not_run]");
    assert(
      !vo.scenarios.some((s) => s.outcome === "not_run" && s.pass === true),
      "no not_run with pass true",
    );
    assert(
      formatOutcomeLabel("not_run") === "NOT_RUN" &&
        formatOutcomeLabel("unsupported") === "UNSUPPORTED",
      "labels",
    );
    proofs.not_run_semantics = true;

    // --- Disabled fail-closed ---
    let blocked = false;
    try {
      await runWebsiteDepartment({
        force_enabled: false,
        persist: true,
        output_root: join(tmp, "blocked"),
      });
    } catch (e) {
      blocked = String(e).includes("fail-closed") || String(e).includes("blocked");
    }
    assert(blocked, "disabled operational blocked");
    proofs.disabled_fail_closed = true;

    // --- Escape hatch: force_enabled without env ---
    delete process.env[TEST_BYPASS_ENV];
    let noEnv = false;
    try {
      await runWebsiteDepartment({
        force_enabled: true,
        persist: true,
        output_root: join(tmp, "no-env"),
      });
    } catch (e) {
      noEnv = String(e).includes(TEST_BYPASS_ENV);
    }
    assert(noEnv, "force_enabled requires test bypass env");

    // --- Escape hatch: test bypass cannot use production root ---
    process.env[TEST_BYPASS_ENV] = "1";
    let noProd = false;
    try {
      await runWebsiteDepartment({
        force_enabled: true,
        persist: true,
        allow_network: false,
        mode: "static",
        output_root: defaultWebsiteDepartmentRoot(REPO_ROOT),
      });
    } catch (e) {
      noProd =
        String(e).includes("production") ||
        String(e).includes("temporary output_root") ||
        String(e).includes("forbids");
    }
    assert(noProd, "test bypass rejects production evidence root");

    // --- Escape hatch: allow_network rejected under bypass ---
    let noNet = false;
    try {
      readWebsiteEnablement({
        repo_root: REPO_ROOT,
        force_enabled: true,
      });
      resolveExecutionGate({
        enablement: {
          enabled: true,
          reason: "test_bypass_force_enabled",
          source: "test_bypass",
        },
        options: { persist: true, allow_network: true, force_enabled: true },
      });
      assertPersistSafety({
        options: {
          force_enabled: true,
          persist: true,
          allow_network: true,
          output_root: join(tmp, "net"),
        },
        repo_root: REPO_ROOT,
        enablement: {
          enabled: true,
          reason: "test_bypass_force_enabled",
          source: "test_bypass",
        },
      });
    } catch (e) {
      noNet = String(e).includes("allow_network") || String(e).includes("network");
    }
    assert(noNet, "test bypass forbids network");
    proofs.escape_hatch = true;

    // --- Root / latest / runs projections + archive ---
    const out = join(tmp, "evidence");
    mkdirSync(out, { recursive: true });
    // Seed fake pre-revival root projections
    writeFileSync(
      join(out, "website-health.json"),
      JSON.stringify({ status: "HEALTHY", seeded: true, checks: {} }),
    );
    writeFileSync(join(out, "website-alerts.json"), JSON.stringify({ alerts: [] }));

    const run1 = await runWebsiteDepartment({
      force_enabled: true,
      persist: true,
      allow_network: false,
      mode: "static",
      output_root: out,
      update_findings: false,
    });
    assert(run1.persisted, "persisted");
    assert(run1.run_dir?.includes(run1.run.run_id), "run dir");
    const run1Health = join(out, "runs", run1.run.run_id, "website-health.json");
    const run1Hash = sha256File(run1Health);
    assert(existsSync(join(out, "latest", "website-health.json")), "latest");
    assert(existsSync(join(out, "website-health.json")), "root health");
    assert(existsSync(join(out, "website-alerts.json")), "root alerts");
    assert(
      existsSync(join(out, "archive", "pre-revival-root-projections", "website-health.json")),
      "archive created",
    );
    const archiveMarker = join(out, "archive", "pre-revival-root-projections", ".archived");
    assert(existsSync(archiveMarker), "archive marker");
    const archiveHash = sha256File(
      join(out, "archive", "pre-revival-root-projections", "website-health.json"),
    );

    const run2 = await runWebsiteDepartment({
      force_enabled: true,
      persist: true,
      allow_network: false,
      mode: "static",
      output_root: out,
    });
    assert(run2.run.run_id !== run1.run.run_id, "distinct runs");
    assert(sha256File(run1Health) === run1Hash, "immutable run1 unchanged");
    assert(
      sha256File(join(out, "archive", "pre-revival-root-projections", "website-health.json")) ===
        archiveHash,
      "archive not overwritten",
    );
    assert(existsSync(join(out, "runs", run2.run.run_id, "website-health.json")), "run2");

    // Consumer schema
    const rootHealth = JSON.parse(readFileSync(join(out, "website-health.json"), "utf8")) as {
      status?: string;
      checks?: Record<string, boolean>;
    };
    const rootAlerts = JSON.parse(readFileSync(join(out, "website-alerts.json"), "utf8")) as {
      alerts?: unknown[];
    };
    assert(typeof rootHealth.status === "string", "status present");
    assert(rootHealth.checks && typeof rootHealth.checks === "object", "checks object");
    for (const k of FCC_CHECK_KEYS) {
      assert(typeof rootHealth.checks[k] === "boolean", `checks.${k}`);
    }
    assert(Array.isArray(rootAlerts.alerts), "alerts array");
    proofs.root_projections = true;
    proofs.archive = true;
    proofs.consumer_schema = true;

    // --- Persistence gate: authorized temp write OK; ungated / forged rejected ---
    const authBundle = assertPersistSafety({
      options: {
        force_enabled: true,
        persist: true,
        allow_network: false,
        output_root: join(tmp, "bundle"),
      },
      repo_root: REPO_ROOT,
      enablement: {
        enabled: true,
        reason: "test_bypass_force_enabled",
        source: "test_bypass",
      },
    });
    assert(isWebsitePersistAuthorization(authBundle), "auth mint");
    const bundle = persistWebsiteReports(run2, {
      authorization: authBundle,
      update_latest: true,
    });
    assert(existsSync(join(bundle.run_dir, "website-report.md")), "bundle run");
    assert(existsSync(join(bundle.latest_dir, "website-health.json")), "bundle latest");

    let ungatedRejected = false;
    try {
      // @ts-expect-error intentional ungated call
      persistWebsiteReports(run2, {
        output_root: defaultWebsiteDepartmentRoot(REPO_ROOT),
        update_root_projections: true,
      });
    } catch (e) {
      ungatedRejected =
        String(e).includes("authorization") || String(e).includes("ungated");
    }
    assert(ungatedRejected, "ungated persist rejected");

    const prodHealthBefore = existsSync(join(JULY8_ROOT, "runs"));
    let forgedRejected = false;
    try {
      persistWebsiteReports(run2, {
        authorization: {
          output_root: defaultWebsiteDepartmentRoot(REPO_ROOT),
          update_root_projections: true,
          is_production_root: true,
        } as ReturnType<typeof assertPersistSafety>,
      });
    } catch (e) {
      forgedRejected =
        String(e).includes("authorization") || String(e).includes("ungated");
    }
    assert(forgedRejected, "forged auth without brand rejected");
    assert(!existsSync(join(JULY8_ROOT, "runs")), "no production runs after reject");
    assert(prodHealthBefore === existsSync(join(JULY8_ROOT, "runs")), "prod runs unchanged");
    assert(
      !("persistWebsiteReports" in WebsiteDeptIndex),
      "persistWebsiteReports not public index export",
    );
    proofs.persist_gate = true;

    // --- Path canonicalization: symlink under tmp → production rejected ---
    const linkDir = join(tmp, "symlink-trap");
    mkdirSync(linkDir, { recursive: true });
    const linkPath = join(linkDir, "to-prod");
    let symlinkProof = false;
    try {
      const { symlinkSync } = await import("node:fs");
      try {
        symlinkSync(JULY8_ROOT, linkPath);
      } catch {
        // Some environments disallow symlinks; still prove canonicalize on tmp.
        assert(
          canonicalizePath(join(tmp, "evidence")).startsWith(canonicalizePath(tmpdir())),
          "tmp canonicalize",
        );
        proofs.path_canonicalization = true;
        symlinkProof = true;
      }
      if (existsSync(linkPath)) {
        assert(
          isSameOrInsidePath(linkPath, JULY8_ROOT),
          "symlink canonicalizes into production root",
        );
        let linkRejected = false;
        try {
          assertPersistSafety({
            options: {
              force_enabled: true,
              persist: true,
              allow_network: false,
              output_root: linkPath,
            },
            repo_root: REPO_ROOT,
            enablement: {
              enabled: true,
              reason: "test_bypass_force_enabled",
              source: "test_bypass",
            },
          });
        } catch (e) {
          linkRejected =
            String(e).includes("production") ||
            String(e).includes("temporary") ||
            String(e).includes("forbids");
        }
        assert(linkRejected, "symlink to production rejected by persist safety");
        assert(
          canonicalizePath(join(tmp, "evidence")).startsWith(canonicalizePath(tmpdir())),
          "tmp canonicalize",
        );
        symlinkProof = true;
        proofs.path_canonicalization = true;
      } else {
        proofs.path_canonicalization = true;
        symlinkProof = true;
      }
    } catch (e) {
      throw e;
    }
    assert(symlinkProof, "path canonicalization exercised");

    // --- Query-aware fingerprint normalization ---
    const qMatA = normalizeFindingMessage("GET /api/x?category=marketing&page=1 failed");
    const qMatB = normalizeFindingMessage("GET /api/x?category=engineering&page=1 failed");
    assert(qMatA !== qMatB, "material query values distinct");
    const qOrderA = normalizeQueryParams("page=2&category=marketing");
    const qOrderB = normalizeQueryParams("category=marketing&page=2");
    assert(qOrderA === qOrderB, "reordered params same");
    assert(
      normalizeFindingMessage("GET /api/x?category=marketing&page=2 fail") ===
        normalizeFindingMessage("GET /api/x?page=2&category=marketing fail"),
      "reordered query same fingerprint input",
    );
    const tokA = normalizeFindingMessage(
      "GET /download?token=super-secret-aaa&template=t040 fail",
    );
    const tokB = normalizeFindingMessage(
      "GET /download?token=other-secret-bbb&template=t040 fail",
    );
    assert(tokA === tokB, "different tokens same normalized");
    assert(!tokA.includes("super-secret"), "raw token scrubbed");
    assert(!tokB.includes("other-secret"), "raw token scrubbed b");
    assert(tokA.includes("template=t040"), "material template preserved");
    assert(
      normalizeFindingMessage("GET /x?cb=111&sig=abc&id=1 fail") ===
        normalizeFindingMessage("GET /x?sig=zzz&cb=999&id=1 fail"),
      "cachebuster+signature dedupe",
    );
    assert(
      normalizeFindingMessage("broken not a url token=rawsecretvalue here") !==
        "broken not a url token=rawsecretvalue here",
      "non-url token assignment redacted",
    );
    assert(
      !normalizeFindingMessage("broken not a url token=rawsecretvalue here").includes(
        "rawsecretvalue",
      ),
      "raw secret not in normalized non-url",
    );
    const fpRoute1 = buildFindingFingerprint({
      environment: "t",
      journey_id: "j",
      route_pattern: "/a",
      check_type: "c",
      normalized_message_or_selector: "err",
      viewport_class: "desktop",
    });
    const fpRoute2 = buildFindingFingerprint({
      environment: "t",
      journey_id: "j",
      route_pattern: "/b",
      check_type: "c",
      normalized_message_or_selector: "err",
      viewport_class: "desktop",
    });
    const fpVp = buildFindingFingerprint({
      environment: "t",
      journey_id: "j",
      route_pattern: "/a",
      check_type: "c",
      normalized_message_or_selector: "err",
      viewport_class: "mobile",
    });
    const fpCt = buildFindingFingerprint({
      environment: "t",
      journey_id: "j",
      route_pattern: "/a",
      check_type: "other",
      normalized_message_or_selector: "err",
      viewport_class: "desktop",
    });
    assert(fpRoute1 !== fpRoute2, "routes distinct");
    assert(fpRoute1 !== fpVp, "viewports distinct");
    assert(fpRoute1 !== fpCt, "check types distinct");
    proofs.query_normalization = true;

    // --- Finding ledger + applicable fingerprint discipline ---
    const findRoot = join(tmp, "findings-root");
    mkdirSync(findRoot, { recursive: true });
    const baseObs = {
      environment: "test",
      journey_id: "home",
      route_pattern: "/",
      viewport_class: "desktop" as const,
      check_type: "console_error",
      severity: "critical" as const,
    };
    const msgA = `Error at 2026-09-03T04:36:25.000Z id=550e8400-e29b-41d4-a716-446655440000 port=3000 /Users/stephenpereira/studiosislab/src/x.ts`;
    const msgB = `Error at 2026-09-04T11:00:00.000Z id=11111111-1111-4111-8111-111111111111 port=3999 /home/other/repo/src/x.ts`;
    assert(
      normalizeFindingMessage(msgA) === normalizeFindingMessage(msgB),
      "normalize collapses noisy values",
    );
    const tokenObsMsg = "Failed GET /api/x?token=LIVE_SECRET_VALUE_XYZ&category=marketing";
    const fp = buildFindingFingerprint({
      environment: "test",
      journey_id: "home",
      route_pattern: "/",
      check_type: "console_error",
      normalized_message_or_selector: normalizeFindingMessage(msgA),
      viewport_class: "desktop",
    });

    const r1 = applyFindingObservations({
      output_root: findRoot,
      run_id: "run-a",
      observations: [
        {
          ...baseObs,
          message_or_selector: msgA,
          evidence_ref: "runs/run-a/browser/home.png",
          run_id: "run-a",
        },
        {
          ...baseObs,
          journey_id: "token-journey",
          route_pattern: "/api/x",
          check_type: "http",
          message_or_selector: tokenObsMsg,
          evidence_ref: "runs/run-a/token.json",
          run_id: "run-a",
        },
      ],
      evaluated_checks: [
        { ...baseObs, evaluation: "fail" },
        {
          environment: "test",
          journey_id: "token-journey",
          route_pattern: "/api/x",
          viewport_class: "desktop",
          check_type: "http",
          evaluation: "fail",
        },
      ],
    });
    assert(r1.created === 2, "first OPEN x2");
    const id = r1.findings.find((f) => f.journey_id === "home")!.finding_id;
    const tokenFinding = r1.findings.find((f) => f.journey_id === "token-journey")!;
    assert(loadFinding(findRoot, id)?.status === "OPEN", "status OPEN");
    assert(loadFinding(findRoot, id)?.fingerprint === fp, "fingerprint match");
    assert(
      !JSON.stringify(tokenFinding).includes("LIVE_SECRET_VALUE_XYZ"),
      "raw token not in persisted ledger",
    );
    assert(
      tokenFinding.normalized_message.includes("<volatile>") ||
        tokenFinding.normalized_message.includes("token=<volatile>"),
      "token placeholder in ledger",
    );

    const r2 = applyFindingObservations({
      output_root: findRoot,
      run_id: "run-b",
      observations: [
        {
          ...baseObs,
          message_or_selector: msgB,
          evidence_ref: "runs/run-b/browser/home.png",
          run_id: "run-b",
        },
      ],
      evaluated_checks: [{ ...baseObs, evaluation: "fail" }],
    });
    assert(r2.recurring === 1, "RECURRING");
    assert(loadFinding(findRoot, id)?.occurrence_count === 2, "occurrence 2");

    // Different viewport → distinct; desktop absence must not advance from mobile-only pass
    const r3 = applyFindingObservations({
      output_root: findRoot,
      run_id: "run-c",
      observations: [
        {
          ...baseObs,
          viewport_class: "mobile",
          message_or_selector: msgA,
          evidence_ref: "runs/run-c/mobile.png",
          run_id: "run-c",
        },
      ],
      evaluated_checks: [
        {
          ...baseObs,
          viewport_class: "mobile",
          evaluation: "fail",
        },
      ],
    });
    assert(r3.created === 1, "mobile distinct");
    assert(
      (loadFinding(findRoot, id)?.consecutive_absent_applicable_runs ?? -1) === 0,
      "desktop not advanced by mobile eval",
    );

    // Desktop execution cannot resolve unevaluated mobile — and mobile pass cannot resolve desktop
    const mobilePassOnly = applyFindingObservations({
      output_root: findRoot,
      run_id: "run-c2",
      observations: [],
      evaluated_checks: [
        {
          ...baseObs,
          viewport_class: "mobile",
          evaluation: "pass",
        },
      ],
    });
    assert(mobilePassOnly.resolved === 0, "mobile pass does not resolve desktop");
    assert(
      (loadFinding(findRoot, id)?.consecutive_absent_applicable_runs ?? 0) === 0,
      "desktop absence still 0 after mobile pass",
    );

    // Different check type
    const r4 = applyFindingObservations({
      output_root: findRoot,
      run_id: "run-d",
      observations: [
        {
          ...baseObs,
          check_type: "http_5xx",
          message_or_selector: msgA,
          evidence_ref: "runs/run-d/http.json",
          run_id: "run-d",
        },
      ],
      evaluated_checks: [
        {
          ...baseObs,
          check_type: "http_5xx",
          evaluation: "fail",
        },
      ],
    });
    assert(r4.created === 1, "check_type distinct");

    // not_run / incomplete must NOT count as absence
    const noAbsent = applyFindingObservations({
      output_root: findRoot,
      run_id: "run-e0",
      observations: [],
      evaluated_checks: [
        { ...baseObs, evaluation: "not_run" },
        { ...baseObs, evaluation: "unsupported" },
        { ...baseObs, evaluation: "aborted" },
        { ...baseObs, evaluation: "incomplete" },
      ],
    });
    assert(noAbsent.resolved === 0, "not_run etc do not resolve");
    assert(
      (loadFinding(findRoot, id)?.consecutive_absent_applicable_runs ?? 0) === 0,
      "absence still 0 after not_run",
    );

    // Partial pack: other journey pass must not resolve home finding
    const partial = applyFindingObservations({
      output_root: findRoot,
      run_id: "run-e1",
      observations: [],
      evaluated_checks: [
        {
          environment: "test",
          journey_id: "other-journey",
          route_pattern: "/other",
          viewport_class: "desktop",
          check_type: "console_error",
          evaluation: "pass",
        },
      ],
    });
    assert(partial.resolved === 0, "partial pack no resolve");
    assert(
      (loadFinding(findRoot, id)?.consecutive_absent_applicable_runs ?? 0) === 0,
      "partial absence 0",
    );

    // One route cannot resolve another
    const otherRoute = applyFindingObservations({
      output_root: findRoot,
      run_id: "run-e2",
      observations: [],
      evaluated_checks: [
        {
          ...baseObs,
          route_pattern: "/elsewhere",
          evaluation: "pass",
        },
      ],
    });
    assert(otherRoute.resolved === 0, "other route no resolve");

    // Failed-only run (no pass evaluations) cannot mass-resolve
    const failedRun = applyFindingObservations({
      output_root: findRoot,
      run_id: "run-e3",
      observations: [],
      evaluated_checks: [
        { ...baseObs, evaluation: "fail" },
        {
          ...baseObs,
          viewport_class: "mobile",
          evaluation: "fail",
        },
      ],
    });
    assert(failedRun.resolved === 0, "failed run no mass resolve");

    // Two consecutive applicable successful absences resolve
    const absent1 = applyFindingObservations({
      output_root: findRoot,
      run_id: "run-e",
      observations: [],
      evaluated_checks: [{ ...baseObs, evaluation: "pass" }],
    });
    assert(absent1.resolved === 0, "one absent does not resolve");
    assert(loadFinding(findRoot, id)?.consecutive_absent_applicable_runs === 1, "absent=1");

    const absent2 = applyFindingObservations({
      output_root: findRoot,
      run_id: "run-f",
      observations: [],
      evaluated_checks: [{ ...baseObs, evaluation: "pass" }],
    });
    assert(absent2.resolved === 1, "two consecutive resolve");
    assert(loadFinding(findRoot, id)?.status === "RESOLVED", "RESOLVED");

    // Reopen
    const reopen = applyFindingObservations({
      output_root: findRoot,
      run_id: "run-g",
      observations: [
        {
          ...baseObs,
          message_or_selector: msgA,
          evidence_ref: "runs/run-g/home.png",
          run_id: "run-g",
        },
      ],
      evaluated_checks: [{ ...baseObs, evaluation: "fail" }],
    });
    assert(reopen.reopened === 1, "reopened");
    assert(loadFinding(findRoot, id)?.status === "OPEN", "reopen OPEN");

    // Suppression
    suppressFinding({
      output_root: findRoot,
      finding_id: id,
      actor: "founder",
      reason: "known third-party noise",
    });
    assert(loadFinding(findRoot, id)?.status === "SUPPRESSED", "SUPPRESSED");
    const suppressedHit = applyFindingObservations({
      output_root: findRoot,
      run_id: "run-h",
      observations: [
        {
          ...baseObs,
          message_or_selector: msgA,
          evidence_ref: "runs/run-h/home.png",
          run_id: "run-h",
        },
      ],
      evaluated_checks: [{ ...baseObs, evaluation: "fail" }],
    });
    assert(suppressedHit.suppressed_hits === 1, "suppressed hit");
    assert(loadFinding(findRoot, id)?.status === "SUPPRESSED", "stays suppressed");
    assert(
      loadFinding(findRoot, id)?.evidence_refs.includes("runs/run-a/browser/home.png"),
      "prior evidence kept",
    );

    // Malformed ledger fails safely
    const badRoot = join(tmp, "bad-ledger");
    mkdirSync(join(badRoot, "findings"), { recursive: true });
    writeFileSync(join(badRoot, "findings", "index.json"), "{not-json");
    let malformed = false;
    try {
      loadFindingIndex(badRoot);
    } catch (e) {
      malformed = String(e).includes("malformed") || String(e).includes("unreadable");
    }
    assert(malformed, "malformed fails safely");
    assert(existsSync(join(badRoot, "findings", "index.json")), "malformed file not deleted");
    proofs.finding_ledger = true;
    proofs.applicability_discipline = true;

    // --- Run lock ---
    const lockRoot = join(tmp, "lock-root");
    const lock1 = acquireWebsiteRunLock({ output_root: lockRoot, run_id: "L1" });
    let locked = false;
    try {
      acquireWebsiteRunLock({ output_root: lockRoot, run_id: "L2" });
    } catch (e) {
      locked = String(e).includes("lock held");
    }
    assert(locked, "second lock fails");
    lock1.release();
    const lock2 = acquireWebsiteRunLock({ output_root: lockRoot, run_id: "L2" });
    lock2.release();
    assert(!existsSync(join(lockRoot, "website-department.run.lock")), "lock released");

    // Director acquire_run_lock
    const lockOut = join(tmp, "lock-out");
    const withLock = await runWebsiteDepartment({
      force_enabled: true,
      persist: true,
      allow_network: false,
      mode: "static",
      output_root: lockOut,
      acquire_run_lock: true,
    });
    assert(withLock.persisted, "lock run persisted");
    assert(!existsSync(join(lockOut, "website-department.run.lock")), "lock cleared after run");
    proofs.run_lock = true;

    // Verification-only leaves no locks / no writes
    await runWebsiteDepartment({ verification_only: true, persist: false });
    assertJuly8(july8Before);
    assert(sha256File(STATE_PATH) === psBefore, "project-state unchanged");
    proofs.safety = true;

    assert(WEBSITE_DEPARTMENT.identity === "run_id", "identity");
    const registry = buildRouteRegistry({ repo_root: REPO_ROOT });
    assert(registry.routes.length >= 11, "registry intact");

    console.log(
      JSON.stringify(
        {
          pass: true,
          component: "website-department-phase2a",
          tmp,
          proofs,
          sample_run_id: vo.run.run_id,
          overall: "PASS",
        },
        null,
        2,
      ),
    );
  } finally {
    if (prevBypass === undefined) delete process.env[TEST_BYPASS_ENV];
    else process.env[TEST_BYPASS_ENV] = prevBypass;
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

main().catch((err) => {
  console.error(
    JSON.stringify(
      { pass: false, error: String(err), stack: (err as Error).stack },
      null,
      2,
    ),
  );
  process.exit(1);
});
