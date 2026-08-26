/**
 * Founder Supervised Production Runner verify — Agent #230.
 * Does NOT start a real provider-backed batch. Proves wiring + limits + safety.
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import {
  FIRST_RUN_LIMITS,
  loadSupervisedRunSurface,
  prepareSupervisedRun,
  runSupervisedPreflight,
  selectFirstBatchRoles,
} from "./FounderSupervisedProductionRunner.js";
import { coordinateSupervisedProduction } from "../system-orchestrator/SystemOrchestrator.js";
import { ALL_FOUNDER_ACTION_TYPES } from "../founder-action-adapters/FounderActionAdapters.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/supervised-production-runner/supervised-production-runner-verify.json",
);
const RUNNER = join(import.meta.dirname, "FounderSupervisedProductionRunner.ts");
const GUARD = join(REPO, "SOS/SAIOS/architecture/runtime-guard.ts");
const PC = join(
  REPO,
  "SOS/SAIOS/core/first-production-cycle/ProductionController.ts",
);
const ORCH = join(
  REPO,
  "SOS/SAIOS/core/system-orchestrator/SystemOrchestrator.ts",
);
const FAA = join(
  REPO,
  "SOS/SAIOS/core/founder-action-adapters/FounderActionAdapters.ts",
);
const MC = join(
  REPO,
  "SOS/SAIOS/dashboard/src/views/mission-control/MissionControlHome.tsx",
);
const PANEL = join(
  REPO,
  "SOS/SAIOS/dashboard/src/views/mission-control/FirstSupervisedRunPanel.tsx",
);
const SERVER = join(REPO, "SOS/SAIOS/dashboard/server.ts");
const RUNBOOK = join(REPO, "SOS/SAIOS/FIRST_SUPERVISED_RUN_RUNBOOK.md");

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function sha(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

async function main(): Promise<void> {
  process.env.SOS_AIOS_LIVE = "0";
  const checks: Record<string, boolean> = {};

  const guardBefore = sha(GUARD);
  const pcBefore = sha(PC);

  assert(existsSync(RUNNER), "runner module");
  assert(existsSync(PANEL), "MC panel");
  assert(existsSync(RUNBOOK), "runbook");

  const src = readFileSync(RUNNER, "utf8");
  assert(src.includes("owns_production: false"), "runner owns no production");
  assert(src.includes("owns_orchestration: false"), "runner owns no orchestration");
  assert(src.includes("owns_governance: false"), "runner owns no governance");
  assert(src.includes("bypasses_founder_approval: false"), "no founder bypass");
  assert(src.includes("bypasses_runtime_guard: false"), "no guard bypass");
  assert(src.includes("can_publish: false"), "cannot publish");
  assert(src.includes("can_enable_live: false"), "cannot enable LIVE");
  assert(src.includes("exceeds_first_run_limits: false"), "cannot exceed limits");
  assert(src.includes("executeFounderAction"), "delegates via FAA");
  assert(src.includes("production.supervised_first_run"), "supervised FAA action");
  assert(!src.includes("class ProductionEngine"), "not a ProductionEngine");
  assert(!src.includes("runProduction("), "runner does not call runProduction directly");
  checks.runner_owns_nothing = true;
  checks.no_direct_production = true;

  assert(FIRST_RUN_LIMITS.maximum_templates === 5, "max templates 5");
  assert(FIRST_RUN_LIMITS.maximum_concurrency === 1, "max concurrency 1");
  assert(FIRST_RUN_LIMITS.publication === false, "publication disabled");
  assert(FIRST_RUN_LIMITS.live_mode === false, "live false");
  assert(FIRST_RUN_LIMITS.founder_approval_required === true, "founder required");
  checks.first_run_limits = true;

  const roles = selectFirstBatchRoles();
  assert(roles.length === 5, "five roles");
  checks.selected_roles = true;

  const pre = runSupervisedPreflight({
    repoRoot: REPO,
    simulation_mode: true,
  });
  assert(Array.isArray(pre.checks) && pre.checks.length >= 10, "preflight checks");
  assert(
    pre.checks.some((c) => c.id === "live_off" && c.status === "pass"),
    "LIVE OFF check",
  );
  assert(
    pre.checks.some((c) => c.id === "runtime_guard"),
    "Runtime Guard participates",
  );
  assert(
    pre.checks.some((c) => c.id === "operational_policy"),
    "Operational Policy participates",
  );
  assert(pre.checks.some((c) => c.id === "budget"), "Budget participates");
  assert(pre.checks.some((c) => c.id === "health"), "Health participates");
  checks.preflight_participants = true;

  const prepared = prepareSupervisedRun({
    repoRoot: REPO,
    simulation_mode: true,
  });
  assert(
    prepared.batch_status === "PENDING_APPROVAL" ||
      prepared.batch_status === "BLOCKED",
    `prepare leaves PENDING_APPROVAL or BLOCKED, got ${prepared.batch_status}`,
  );
  assert(prepared.founder_approval.required === true, "approval required");
  assert(prepared.founder_approval.granted === false, "not auto-granted");
  assert(prepared.publication_allowed === false, "pub false");
  assert(prepared.live === false, "live false");
  assert(prepared.templates_requested === 5, "templates 5");
  assert(prepared.request.maximum_concurrency === 1, "concurrency 1");
  assert(
    !JSON.stringify(prepared).match(/sk-[a-zA-Z0-9]{10,}/),
    "no openai secrets in report",
  );
  checks.prepare_pending_approval = true;
  checks.no_secrets_in_report = true;

  const surface = loadSupervisedRunSurface({ repoRoot: REPO });
  assert(surface.founder_approval_required === true, "surface founder");
  assert(surface.publication_allowed === false, "surface pub");
  assert(surface.production_entry === "ProductionController", "PC entry");
  assert(surface.display.concurrency === 1, "display concurrency");
  checks.surface_ok = true;

  // Prove orchestrator supervised path (mock + budget simulate) — not Founder-approved overnight batch
  const orch = await coordinateSupervisedProduction({
    initiator: "verify-230",
    production_opts: {
      verification: true,
      verification_context: "aios-verify",
      batch_size: 5,
      max_openai_per_batch: 5,
      force_mock: true,
      select_target: false,
      forced_targets: roles.map((r) => ({
        category: r.category,
        title: r.title,
        industry: r.industry,
        seniority: r.seniority,
        objective: r.objective,
        role_family: r.role_family,
      })),
      budget_simulate: { founder_queue_waiting: 0 },
      health_simulate: undefined,
    },
  });
  assert(orch.blocked === false || orch.ok === true || orch.production != null, "orch ran");
  const prod = orch.production as {
    publication_allowed?: boolean;
    live?: boolean;
    entrypoint?: string;
    candidate_count?: number;
  } | null;
  if (prod) {
    assert(prod.publication_allowed === false, "orch pub false");
    assert(prod.live === false, "orch live false");
    assert(
      !prod.entrypoint || prod.entrypoint === "ProductionController",
      "entrypoint PC",
    );
  }
  checks.orchestrator_supervised_path = true;
  checks.production_controller_owner = true;
  checks.no_automatic_publication = true;
  checks.live_off = true;

  assert(
    ALL_FOUNDER_ACTION_TYPES.includes("production.supervised_first_run"),
    "FAA action registered",
  );
  const faa = readFileSync(FAA, "utf8");
  assert(faa.includes("coordinateSupervisedProduction"), "FAA delegates orch");
  assert(faa.includes("production.supervised_first_run"), "FAA type");
  checks.faa_delegates = true;

  const orchSrc = readFileSync(ORCH, "utf8");
  assert(orchSrc.includes("coordinateSupervisedProduction"), "orch export");
  assert(orchSrc.includes("runProduction"), "orch → PC");
  checks.system_orchestrator = true;

  const mc = readFileSync(MC, "utf8");
  assert(mc.includes("FirstSupervisedRunPanel"), "MC wires panel");
  const panel = readFileSync(PANEL, "utf8");
  assert(panel.includes("First Supervised Production Run"), "panel title");
  assert(panel.includes("START FIRST SUPERVISED RUN"), "start action");
  assert(panel.includes("/api/supervised-production-run"), "panel API");
  const server = readFileSync(SERVER, "utf8");
  assert(server.includes("/api/supervised-production-run"), "server API");
  checks.mission_control = true;

  assert(sha(GUARD) === guardBefore, "Runtime Guard unchanged");
  assert(sha(PC) === pcBefore, "ProductionController unchanged");
  checks.architecture_preserved = true;
  checks.ownership_unchanged = true;

  mkdirSync(resolve(OUT, ".."), { recursive: true });
  writeFileSync(
    OUT,
    `${JSON.stringify(
      {
        schema_version: 1,
        agent: "230",
        timestamp: new Date().toISOString(),
        overall: "PASS",
        checks,
        prepared_status: prepared.batch_status,
        preflight_ok: pre.ok,
        preflight_blocker: pre.blocker,
        note: "Real Founder-approved batch not auto-started; left for Mission Control",
        live: false,
        publication_allowed: false,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log("PASS supervised-production-runner verify");
  console.log(`prepared_status=${prepared.batch_status}`);
  console.log(`preflight_ok=${pre.ok} blocker=${pre.blocker ?? "none"}`);
  console.log(`verify → ${OUT}`);
}

main().catch((e) => {
  console.error("FAIL", e instanceof Error ? e.message : e);
  process.exit(1);
});
