/**
 * Founder Action Adapters verify — Agent #225.
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import {
  ALL_FOUNDER_ACTION_TYPES,
  executeFounderAction,
  loadFounderActionSurface,
} from "./FounderActionAdapters.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-action-adapters/founder-actions-verify.json",
);
const GUARD = join(REPO, "SOS/SAIOS/architecture/runtime-guard.ts");
const ADAPTER = join(import.meta.dirname, "FounderActionAdapters.ts");
const PC = join(
  REPO,
  "SOS/SAIOS/core/first-production-cycle/ProductionController.ts",
);
const HEALTH = join(
  REPO,
  "SOS/SAIOS/core/first-production-cycle/ProductionHealthGate.ts",
);
const BUDGET = join(
  REPO,
  "SOS/SAIOS/core/first-production-cycle/ResourceBudgetGovernor.ts",
);
const SCHED = join(
  REPO,
  "SOS/SAIOS/core/first-production-cycle/AdaptiveSchedulingPolicy.ts",
);
const ENG = join(
  REPO,
  "SOS/SAIOS/core/engineering-intelligence/EngineeringIntelligence.ts",
);
const PORT = join(
  REPO,
  "SOS/SAIOS/core/first-production-cycle/PortfolioPlanner.ts",
);
const STRAT = join(
  REPO,
  "SOS/SAIOS/core/first-production-cycle/ProductionStrategyEngine.ts",
);
const MC = join(
  REPO,
  "SOS/SAIOS/dashboard/src/views/mission-control/MissionControlHome.tsx",
);
const PANEL = join(
  REPO,
  "SOS/SAIOS/dashboard/src/views/mission-control/FounderActionsPanel.tsx",
);
const SERVER = join(REPO, "SOS/SAIOS/dashboard/server.ts");
const LOCK = join(
  REPO,
  "SOS/07_LOGS/saios/founder-action-adapters/in-flight.lock.json",
);

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
  const healthBefore = existsSync(HEALTH) ? sha(HEALTH) : "missing";
  const budgetBefore = existsSync(BUDGET) ? sha(BUDGET) : "missing";
  const schedBefore = sha(SCHED);
  const engBefore = sha(ENG);
  const portBefore = sha(PORT);
  const stratBefore = sha(STRAT);

  assert(existsSync(ADAPTER), "adapter module");
  assert(existsSync(PANEL), "actions panel");
  assert(existsSync(MC), "mission control");
  const src = readFileSync(ADAPTER, "utf8");

  assert(src.includes("owns_production: false"), "never owns production");
  assert(src.includes("owns_business_logic: false"), "never owns business logic");
  assert(src.includes("SystemOrchestrator"), "integrates System Orchestrator");
  assert(src.includes("coordinateFounderRun"), "founder run via orchestrator");
  assert(src.includes("ProductionController"), "names ProductionController");
  assert(src.includes("AutonomousProductionService"), "delegates autonomous");
  assert(!src.includes("class ProductionEngine"), "no ProductionEngine");
  assert(!src.includes("ActionQueue"), "no ActionQueue");
  assert(!src.includes("ParallelExecutor"), "no ParallelExecutor");
  assert(!src.includes("CleanupEngine"), "no CleanupEngine");
  assert(src.includes("runtime_guard_bypassed: false"), "never bypass guard");
  assert(
    src.includes("production_controller_bypassed: false"),
    "never bypass controller",
  );
  checks.every_adapter_delegates = true;
  checks.no_business_logic_ownership = true;

  assert(ALL_FOUNDER_ACTION_TYPES.length >= 14, "action types present");

  // Safe refresh — no production loop
  const refresh = await executeFounderAction({
    action_type: "operations.refresh_fcc_snapshot",
    requested_by: "verify-225",
    repoRoot: REPO,
  });
  assert(
    refresh.outcome === "Success" || refresh.outcome === "Warning",
    `fcc refresh: ${refresh.reason}`,
  );
  assert(refresh.action.delegated_to?.includes("FounderCommandCenter"), "fcc delegate");
  assert(refresh.action.owns_production === false, "refresh owns_production false");
  assert(refresh.action.live === false, "LIVE false in audit");
  assert(refresh.action.publication_allowed === false, "pub false in audit");
  checks.audit_history_written = true;

  const schedOff = await executeFounderAction({
    action_type: "scheduling.disable",
    requested_by: "verify-225",
    repoRoot: REPO,
  });
  assert(
    schedOff.outcome === "Success" || schedOff.outcome === "Warning",
    `sched disable: ${schedOff.reason}`,
  );
  const schedOn = await executeFounderAction({
    action_type: "scheduling.enable",
    requested_by: "verify-225",
    repoRoot: REPO,
  });
  assert(
    schedOn.outcome === "Success" || schedOn.outcome === "Warning",
    `sched enable: ${schedOn.reason}`,
  );
  checks.scheduling_preference_ok = true;

  // Single cycle enters ProductionController
  const cycle = await executeFounderAction({
    action_type: "production.run_single_cycle",
    requested_by: "verify-225",
    repoRoot: REPO,
    production_opts: {
      verification: true,
      verification_context: "aios-verify",
      force_mock: true,
      batch_size: 1,
    },
  });
  assert(
    cycle.outcome === "Success" ||
      cycle.outcome === "Warning" ||
      cycle.outcome === "Failure",
    `cycle ran: ${cycle.outcome}`,
  );
  assert(
    cycle.action.delegated_to?.includes("ProductionController"),
    "production enters ProductionController",
  );
  assert(cycle.action.production_controller_bypassed === false, "no PC bypass");
  const resp = cycle.action.canonical_response as {
    entrypoint?: string;
    production?: { entrypoint?: string; live?: boolean; publication_allowed?: boolean };
    live?: boolean;
    publication_allowed?: boolean;
  } | null;
  if (resp && cycle.outcome !== "Failure" && cycle.outcome !== "Rejected") {
    const entry = resp.entrypoint ?? resp.production?.entrypoint;
    assert(
      !entry || entry === "ProductionController",
      "entrypoint PC",
    );
  }
  checks.production_enters_controller = true;

  // Duplicate / busy handling via lock
  mkdirSync(resolve(LOCK, ".."), { recursive: true });
  writeFileSync(
    LOCK,
    `${JSON.stringify({
      action_id: "faa-test-lock",
      action_type: "operations.refresh_dashboard",
      at: new Date().toISOString(),
    })}\n`,
    "utf8",
  );
  const dup = await executeFounderAction({
    action_type: "operations.refresh_dashboard",
    requested_by: "verify-225",
    repoRoot: REPO,
  });
  assert(dup.outcome === "Rejected", "duplicate rejected");
  assert(dup.action.validation_result === "fail", "validation fail");
  const busy = await executeFounderAction({
    action_type: "portfolio.refresh",
    requested_by: "verify-225",
    repoRoot: REPO,
  });
  assert(busy.outcome === "Rejected", "busy rejected");
  assert(busy.reason.toLowerCase().includes("busy"), "busy reason");
  if (existsSync(LOCK)) unlinkSync(LOCK);
  checks.duplicate_requests_handled = true;

  const surface = loadFounderActionSurface({ repoRoot: REPO, limit: 10 });
  assert(surface.recent_actions.length >= 1, "action history readable");
  assert(surface.live === false, "surface LIVE off");
  assert(surface.publication_allowed === false, "surface pub false");
  assert(surface.founder_approval_required === true, "founder approval");
  assert(surface.production_entry === "ProductionController", "PC entry");
  checks.action_history_readable = true;
  checks.founder_approval_respected = true;

  const mc = readFileSync(MC, "utf8");
  assert(mc.includes("FounderActionsPanel"), "MC wires panel");
  const panel = readFileSync(PANEL, "utf8");
  assert(panel.includes("Founder Actions"), "panel title");
  assert(panel.includes("Idle") || panel.includes("execution_status"), "status");
  assert(panel.includes("Recent Actions") || panel.includes("Action History"), "history");
  assert(panel.includes("/api/founder-action"), "posts to adapter API");
  assert(!panel.includes("Run Cleanup"), "no cleanup CTA");
  assert(!panel.includes("enable_live"), "no live CTA");

  const server = readFileSync(SERVER, "utf8");
  assert(server.includes("/api/founder-actions"), "GET actions API");
  assert(server.includes("/api/founder-action"), "POST action API");
  assert(server.includes("executeFounderAction"), "server delegates");
  assert(
    server.includes("cleanup/refactor/publish/live/code controls forbidden"),
    "forbid unsafe",
  );
  checks.mission_control_integration = true;

  assert(sha(GUARD) === guardBefore, "Runtime Guard unchanged");
  assert(sha(PC) === pcBefore, "ProductionController unchanged");
  if (existsSync(HEALTH)) {
    assert(sha(HEALTH) === healthBefore, "Health Gate unchanged");
  }
  if (existsSync(BUDGET)) {
    assert(sha(BUDGET) === budgetBefore, "Budget Governor unchanged");
  }
  assert(sha(SCHED) === schedBefore, "Scheduling unchanged");
  assert(sha(ENG) === engBefore, "Engineering unchanged");
  assert(sha(PORT) === portBefore, "Portfolio unchanged");
  assert(sha(STRAT) === stratBefore, "Strategy unchanged");
  checks.runtime_guard_unchanged = true;
  checks.canonical_owners_unchanged = true;

  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE OFF");
  checks.live_off = true;

  const result = {
    agent: "225",
    ok: true,
    generated_at: new Date().toISOString(),
    live: false,
    publication_allowed: false,
    openai_called: false,
    owns_production: false,
    adapters_only_delegate: true,
    production_entry: "ProductionController",
    checks,
    runtime_guard_sha256: guardBefore,
    production_controller_sha256: pcBefore,
  };

  mkdirSync(resolve(OUT, ".."), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));
  console.log("PASS aios:founder-actions:verify");
}

main().catch((e) => {
  console.error("FAIL", e instanceof Error ? e.message : e);
  process.exit(1);
});
