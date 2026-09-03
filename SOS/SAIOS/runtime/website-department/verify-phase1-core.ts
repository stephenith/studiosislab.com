#!/usr/bin/env tsx
/**
 * Phase 1 core revival — bounded offline verifier.
 * Uses temporary directories only. Never writes SOS/project-state.json or production evidence.
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
import {
  assertNoAgentMutation,
  mergeWebsiteDepartmentProjection,
} from "./WebsiteProjectStateProjection.js";
import { createWebsiteRunId } from "./WebsiteRunIdentity.js";
import {
  FORBIDDEN_LEGACY_CATALOG,
  FORBIDDEN_LEGACY_SLUG,
  buildRouteRegistry,
} from "./WebsiteRouteRegistry.js";
import {
  runWebsiteDepartment,
  STATE_PATH,
  WEBSITE_DEPARTMENT,
} from "./WebsiteDepartmentDirector.js";
import {
  TEST_BYPASS_ENV,
  assertPersistSafety,
  readWebsiteEnablement,
  resolveExecutionGate,
} from "./WebsiteDepartmentPolicy.js";
import { persistWebsiteReports } from "./WebsiteReportBuilder.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
const JULY8_ROOT = join(REPO_ROOT, "SOS/07_LOGS/saios/website-department");

const JULY8_FILES = [
  "website-health.json",
  "route-health.json",
  "scenario-results.json",
  "seo-health.json",
  "sitemap-health.json",
  "mobile-health.json",
  "download-flow.json",
  "runtime-errors.json",
  "website-alerts.json",
  "website-report.md",
] as const;

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
    assert(existsSync(p), `July 8 evidence missing: ${f}`);
    out[f] = sha256File(p);
  }
  return out;
}

function assertJuly8Unchanged(before: Record<string, string>): void {
  for (const f of JULY8_FILES) {
    const after = sha256File(join(JULY8_ROOT, f));
    assert(after === before[f], `July 8 evidence mutated: ${f}`);
  }
}

/** Patch global fetch to prove no network during verification-only. */
function installNetworkGuard(): { calls: string[]; restore: () => void } {
  const calls: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push(url);
    throw new Error(`NETWORK_FORBIDDEN: ${url}`);
  }) as typeof fetch;
  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

async function main(): Promise<void> {
  const proofs: Record<string, boolean | string> = {};
  const july8Before = hashJuly8();
  const tmp = mkdtempSync(join(tmpdir(), "website-dept-phase1-"));
  const network = installNetworkGuard();

  try {
    // --- Module identity ---
    assert(WEBSITE_DEPARTMENT.identity === "run_id", "identity is run_id");
    assert(!("agent" in WEBSITE_DEPARTMENT), "no agent field");
    proofs.agent_id_decoupled = true;

    // --- Registry ---
    const registry = buildRouteRegistry({ repo_root: REPO_ROOT });
    const paths = registry.routes.map((r) => r.path);
    const ids = registry.routes.map((r) => r.id);
    assert(registry.routes.length >= 11, "critical route count");
    assert(ids.includes("home"), "home");
    assert(ids.includes("resume_gallery"), "resume gallery");
    assert(ids.includes("resume_template_detail"), "template detail");
    assert(ids.includes("resume_builder"), "resume builder");
    assert(ids.includes("editor_entry"), "editor");
    assert(ids.includes("tools_entry"), "tools");
    assert(ids.includes("esign_marketing"), "esign");
    assert(ids.includes("login"), "login");
    assert(ids.includes("sitemap"), "sitemap");
    assert(ids.includes("robots"), "robots");
    assert(ids.includes("api_resume_catalog"), "catalog api");
    assert(!paths.some((p) => p.includes(FORBIDDEN_LEGACY_SLUG)), "no senior-software-engineer-resume");
    assert(
      registry.example.seo_slug !== FORBIDDEN_LEGACY_SLUG,
      "derived slug not legacy",
    );
    // Hardcoded default must not force t094 — derived example must come from catalog data.
    assert(Boolean(registry.example.template_id), "derived template_id");
    assert(Boolean(registry.example.seo_slug), "derived seo_slug");
    // Source of registry must not hardcode the legacy defaults as DEFAULT_* constants in runtime paths.
    const registrySrc = readFileSync(
      join(import.meta.dirname, "WebsiteRouteRegistry.ts"),
      "utf8",
    );
    assert(!registrySrc.includes('DEFAULT_CATALOG_ID = "t094"'), "no DEFAULT_CATALOG_ID t094");
    assert(
      !registrySrc.includes('DEFAULT_SEO_SLUG = "senior-software-engineer-resume"'),
      "no DEFAULT_SEO_SLUG legacy",
    );
    assert(
      !registry.routes.some((r) => r.path === `/resume/${FORBIDDEN_LEGACY_SLUG}`),
      "legacy path absent",
    );
    // If derived id happens to be t094 that is catalog truth; hardcode absence is the requirement.
    void FORBIDDEN_LEGACY_CATALOG;
    const authRequired = registry.routes.filter((r) => r.auth === "auth_required");
    assert(authRequired.length >= 1, "auth_required routes identified");
    proofs.route_registry = true;

    // --- Disabled fail-closed ---
    const enablement = readWebsiteEnablement({
      repo_root: REPO_ROOT,
      force_enabled: false,
    });
    assert(enablement.enabled === false, "forced disabled");
    const gate = resolveExecutionGate({
      enablement,
      options: { persist: true, mode: "static" },
    });
    assert(gate.allowed === false, "operational blocked while disabled");

    let blocked = false;
    try {
      await runWebsiteDepartment({
        force_enabled: false,
        persist: true,
        mode: "static",
        output_root: join(tmp, "should-not-write"),
      });
    } catch (err) {
      blocked = String(err).includes("fail-closed") || String(err).includes("blocked");
    }
    assert(blocked, "disabled operational mode throws");
    proofs.disabled_fail_closed = true;

    // --- Verification-only ---
    const result = await runWebsiteDepartment({
      verification_only: true,
      persist: false,
      allow_network: false,
      mode: "static",
      repo_root: REPO_ROOT,
    });
    assert(result.mode === "verification_only", "verification_only mode");
    assert(result.persisted === false, "persist false");
    assert(result.project_state_written === false, "no project-state write");
    assert(result.run.run_id.startsWith("webrun-"), "run_id");
    assert(result.run.completed_at, "completed_at");
    assert(result.run.browser_coverage === "not_run", "browser coverage");
    assert(result.run.auth_coverage === "not_run", "auth coverage");
    assert(result.run.mobile_coverage === "static_evidence_only", "mobile coverage");
    assert(result.run.download_coverage === "static_evidence_only", "download coverage");
    assert(result.run.evidence_kind === "static", "evidence kind");
    assert(network.calls.length === 0, `no network calls (got ${network.calls.join(",")})`);
    assert(
      result.scenarios.some(
        (s) =>
          s.id === "browser_journey" &&
          s.execution === "not_run" &&
          s.outcome === "not_run" &&
          s.pass === false,
      ),
      "browser NOT_RUN",
    );
    assert(
      result.scenarios.some(
        (s) =>
          s.id === "authentication_behaviour" &&
          s.execution === "not_run" &&
          s.outcome === "not_run" &&
          s.pass === false,
      ),
      "auth NOT_RUN",
    );
    assert(
      result.scenarios.some(
        (s) =>
          s.id === "mobile_viewport_behaviour" &&
          s.execution === "not_run" &&
          s.outcome === "not_run",
      ),
      "mobile viewport NOT_RUN",
    );
    assert(
      result.scenarios.some(
        (s) =>
          s.id === "download_execution" && s.execution === "not_run" && s.outcome === "not_run",
      ),
      "download NOT_RUN",
    );
    assert(
      !result.scenarios.some((s) => s.outcome === "not_run" && s.pass === true),
      "no not_run with pass true",
    );
    proofs.verification_only = true;
    proofs.no_network = true;
    proofs.truthful_coverage = true;

    // --- Run ID uniqueness ---
    const idsGenerated = new Set<string>();
    for (let i = 0; i < 20; i++) {
      idsGenerated.add(createWebsiteRunId());
    }
    assert(idsGenerated.size === 20, "run ids unique");
    const r2 = await runWebsiteDepartment({
      verification_only: true,
      persist: false,
      allow_network: false,
      mode: "static",
    });
    assert(r2.run.run_id !== result.run.run_id, "department run ids unique");
    proofs.run_id_unique = true;

    // --- Project-state merge (temp copy only) ---
    const realState = JSON.parse(readFileSync(STATE_PATH, "utf8"));
    const agentBefore = {
      latest_agent: realState.latest_agent,
      next_agent: realState.next_agent,
    };
    const stateCopyPath = join(tmp, "project-state.copy.json");
    writeFileSync(stateCopyPath, JSON.stringify(realState, null, 2));
    const before = JSON.parse(readFileSync(stateCopyPath, "utf8"));
    const merged = mergeWebsiteDepartmentProjection(before, result);
    assertNoAgentMutation(before, merged);
    assert(merged.latest_agent === agentBefore.latest_agent, "latest_agent preserved");
    assert(merged.next_agent === agentBefore.next_agent, "next_agent preserved");
    const web = (merged.operations as { website_department: Record<string, unknown> })
      .website_department;
    assert(web.enabled === false, "enabled preserved");
    assert(typeof web.reason === "string", "reason preserved");
    assert(web.scheduled_checks === false, "scheduled_checks preserved");
    assert(web.autonomous_changes === false, "autonomous_changes preserved");
    assert(web.last_run_id === result.run.run_id, "last_run_id set");
    // Real file untouched
    const realAfter = JSON.parse(readFileSync(STATE_PATH, "utf8"));
    assert(realAfter.latest_agent === agentBefore.latest_agent, "real latest_agent untouched");
    assert(realAfter.next_agent === agentBefore.next_agent, "real next_agent untouched");
    assert(
      JSON.stringify(realAfter.operations?.website_department) ===
        JSON.stringify(realState.operations?.website_department),
      "real website_department untouched",
    );
    proofs.project_state_preservation = true;

    // --- Immutable evidence in temp dirs (test bypass required for force_enabled) ---
    const prevBypass = process.env[TEST_BYPASS_ENV];
    process.env[TEST_BYPASS_ENV] = "1";
    const outA = join(tmp, "evidence-a");
    const outB = join(tmp, "evidence-b");
    mkdirSync(outA, { recursive: true });
    mkdirSync(outB, { recursive: true });

    // Seed fake "prior latest" to prove overwrite only within injected root
    writeFileSync(join(outA, "website-health.json"), JSON.stringify({ prior: true }));

    const persistedA = await runWebsiteDepartment({
      force_enabled: true,
      persist: true,
      allow_network: false,
      mode: "static",
      output_root: outA,
      project_state_path: stateCopyPath,
      verification_only: false,
    });
    assert(persistedA.persisted === true, "temp persist A");
    assert(persistedA.run_dir?.includes(persistedA.run.run_id), "run dir A");
    assert(existsSync(join(outA, "runs", persistedA.run.run_id, "website-health.json")), "run file A");
    assert(existsSync(join(outA, "latest", "website-health.json")), "latest A");

    const persistedB = await runWebsiteDepartment({
      force_enabled: true,
      persist: true,
      allow_network: false,
      mode: "static",
      output_root: outB,
      project_state_path: null,
    });
    assert(persistedB.run.run_id !== persistedA.run.run_id, "distinct run ids across roots");
    assert(existsSync(join(outA, "runs", persistedA.run.run_id, "website-health.json")), "A intact");
    assert(existsSync(join(outB, "runs", persistedB.run.run_id, "website-health.json")), "B intact");
    assert(!existsSync(join(outA, "runs", persistedB.run.run_id)), "B did not write into A");

    // Second run into outA preserves first run dir
    const persistedA2 = await runWebsiteDepartment({
      force_enabled: true,
      persist: true,
      allow_network: false,
      mode: "static",
      output_root: outA,
      project_state_path: null,
    });
    assert(
      existsSync(join(outA, "runs", persistedA.run.run_id, "website-health.json")),
      "prior run preserved",
    );
    assert(
      existsSync(join(outA, "runs", persistedA2.run.run_id, "website-health.json")),
      "new run written",
    );
    const latestHealth = JSON.parse(
      readFileSync(join(outA, "latest", "website-health.json"), "utf8"),
    );
    assert(latestHealth.run_id === persistedA2.run.run_id, "latest projection updated");
    assert(latestHealth.status, "latest has status");
    proofs.immutable_evidence = true;

    // Authorized persist via assertPersistSafety capability
    const bundleAuth = assertPersistSafety({
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
    const bundle = persistWebsiteReports(persistedA2, {
      authorization: bundleAuth,
      update_latest: true,
    });
    assert(existsSync(join(bundle.latest_dir, "website-alerts.json")), "alerts projection");
    assert(existsSync(join(bundle.run_dir, "website-report.md")), "report md");
    proofs.latest_projections = true;

    // Test bypass does not write project-state; copy remains agent-stable
    const copyAfter = JSON.parse(readFileSync(stateCopyPath, "utf8"));
    assert(copyAfter.latest_agent === agentBefore.latest_agent, "copy agents preserved after persist");
    assertNoAgentMutation(before, copyAfter);
    proofs.no_agent_mutation = true;

    if (prevBypass === undefined) delete process.env[TEST_BYPASS_ENV];
    else process.env[TEST_BYPASS_ENV] = prevBypass;

    assertJuly8Unchanged(july8Before);
    proofs.july8_untouched = true;

    // Director source must not overwrite latest_agent/next_agent
    const directorSrc = readFileSync(
      join(import.meta.dirname, "WebsiteDepartmentDirector.ts"),
      "utf8",
    );
    assert(!directorSrc.includes('latest_agent: "100"'), "no latest_agent 100 write");
    assert(!directorSrc.includes('next_agent: "101"'), "no next_agent 101 write");
    assert(!directorSrc.includes("Expected agent #100"), "no agent #100 requirement");
    proofs.director_decoupled = true;

    console.log(
      JSON.stringify(
        {
          pass: true,
          component: "website-department-phase1-core",
          tmp,
          proofs,
          sample_run_id: result.run.run_id,
          registry_example: result.registry_example,
          status: result.status,
          network_calls: network.calls.length,
          july8_files_hashed: Object.keys(july8Before).length,
          overall: "PASS",
        },
        null,
        2,
      ),
    );
  } finally {
    network.restore();
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

main().catch((err) => {
  console.error(JSON.stringify({ pass: false, error: String(err), stack: (err as Error).stack }, null, 2));
  process.exit(1);
});
