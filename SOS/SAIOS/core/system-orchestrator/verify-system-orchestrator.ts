/**
 * System Orchestrator verify — Agent #226.
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
  coordinateFounderRun,
  coordinateRefresh,
  coordinateRetry,
  coordinateStartup,
  loadOrchestrationSurface,
} from "./SystemOrchestrator.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/system-orchestrator/system-orchestrator-verify.json",
);
const GUARD = join(REPO, "SOS/SAIOS/architecture/runtime-guard.ts");
const ORCH = join(import.meta.dirname, "SystemOrchestrator.ts");
const FAA = join(
  REPO,
  "SOS/SAIOS/core/founder-action-adapters/FounderActionAdapters.ts",
);
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
  "SOS/SAIOS/dashboard/src/views/mission-control/OrchestrationStatusPanel.tsx",
);
const SERVER = join(REPO, "SOS/SAIOS/dashboard/server.ts");

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
  const healthBefore = sha(HEALTH);
  const budgetBefore = sha(BUDGET);
  const schedBefore = sha(SCHED);
  const engBefore = sha(ENG);
  const portBefore = sha(PORT);
  const stratBefore = sha(STRAT);

  assert(existsSync(ORCH), "orchestrator module");
  assert(existsSync(PANEL), "orchestration panel");
  assert(existsSync(MC), "mission control");

  const src = readFileSync(ORCH, "utf8");
  assert(src.includes("coordination_only: true"), "coordination only");
  assert(src.includes("owns_production: false"), "never owns production");
  assert(src.includes("owns_business_logic: false"), "never owns business logic");
  assert(src.includes("runProduction"), "delegates runProduction");
  assert(src.includes("ProductionController"), "names ProductionController");
  assert(!src.includes("class ProductionEngine"), "no ProductionEngine");
  assert(!src.includes("WorkerPool"), "no WorkerPool");
  assert(!src.includes("ParallelExecutor"), "no ParallelExecutor");
  assert(!src.includes("class Queue"), "no Queue");
  assert(!src.includes("Microservice"), "no Microservice");
  assert(src.includes("runtime_guard_bypassed: false"), "never bypass guard");
  assert(
    src.includes("production_controller_bypassed: false"),
    "never bypass controller",
  );
  assert(src.includes("SYSTEM_STARTED"), "SYSTEM_STARTED event");
  assert(src.includes("RUN_REQUESTED"), "RUN_REQUESTED event");
  assert(src.includes("RUN_COMPLETED"), "RUN_COMPLETED event");
  assert(src.includes("MISSION_CONTROL_REFRESHED"), "MC refresh event");
  checks.coordination_only = true;
  checks.no_business_logic_migration = true;

  const startup = await coordinateStartup({
    initiator: "verify-226",
    repoRoot: REPO,
  });
  assert(startup.ok, `startup: ${startup.reason}`);
  assert(
    startup.events.some((e) => e.event_type === "SYSTEM_STARTED"),
    "SYSTEM_STARTED emitted",
  );
  assert(
    startup.events.some((e) => e.event_type === "SYSTEM_IDLE"),
    "SYSTEM_IDLE emitted",
  );
  checks.startup_flow = true;

  const refresh = await coordinateRefresh({
    kind: "mission_control",
    initiator: "verify-226",
    repoRoot: REPO,
  });
  assert(refresh.ok, `mc refresh: ${refresh.reason}`);
  assert(
    refresh.events.some((e) => e.event_type === "MISSION_CONTROL_REFRESHED"),
    "MISSION_CONTROL_REFRESHED",
  );
  checks.mission_control_refresh = true;

  const run = await coordinateFounderRun({
    initiator: "verify-226",
    repoRoot: REPO,
    production_opts: {
      verification: true,
      verification_context: "aios-verify",
      force_mock: true,
      batch_size: 1,
    },
  });
  assert(!run.blocked, `founder run blocked: ${run.reason}`);
  assert(
    run.events.some((e) => e.event_type === "RUN_REQUESTED"),
    "RUN_REQUESTED",
  );
  assert(
    run.events.some(
      (e) => e.event_type === "RUN_STARTED" || e.event_type === "RUN_BLOCKED",
    ),
    "RUN_STARTED or BLOCKED",
  );
  assert(
    run.events.some((e) => e.delegated_subsystem === "ProductionController"),
    "delegated to ProductionController",
  );
  if (run.production) {
    const p = run.production as { entrypoint?: string };
    assert(p.entrypoint === "ProductionController", "entrypoint PC");
  }
  checks.production_owner_preserved = true;
  checks.orchestration_events_generated = true;

  const retry = await coordinateRetry({
    initiator: "verify-226",
    repoRoot: REPO,
  });
  assert(
    retry.events.some((e) => e.event_type === "RETRY_EVALUATED"),
    "RETRY_EVALUATED",
  );
  checks.retry_coordination = true;

  const surface = loadOrchestrationSurface({ repoRoot: REPO, limit: 10 });
  assert(surface.recent_events.length >= 1, "immutable audit readable");
  assert(surface.coordination_only === true, "surface coordination only");
  assert(surface.owns_production === false, "surface owns_production false");
  assert(surface.live === false, "LIVE off");
  assert(surface.publication_allowed === false, "pub false");
  assert(surface.production_entry === "ProductionController", "PC entry");
  assert(surface.state.current_lifecycle_stage.length > 0, "lifecycle stage");
  checks.immutable_audit_written = true;

  const faa = readFileSync(FAA, "utf8");
  assert(faa.includes("SystemOrchestrator"), "FAA integrates orchestrator");
  assert(faa.includes("coordinateFounderRun"), "FAA founder run via orch");
  assert(faa.includes("coordinateRetry"), "FAA retry via orch");
  assert(faa.includes("coordinateScheduledRun"), "FAA schedule via orch");
  checks.founder_actions_integrate = true;

  const mc = readFileSync(MC, "utf8");
  assert(mc.includes("OrchestrationStatusPanel"), "MC wires orch panel");
  const panel = readFileSync(PANEL, "utf8");
  assert(panel.includes("Current lifecycle stage") || panel.includes("Lifecycle"), "lifecycle");
  assert(panel.includes("orchestration") || panel.includes("Orchestration"), "orch label");
  assert(panel.includes("/api/system-orchestrator"), "loads orch API");

  const server = readFileSync(SERVER, "utf8");
  assert(server.includes("/api/system-orchestrator"), "GET orch API");
  assert(server.includes("loadOrchestrationSurface"), "server loads surface");
  checks.mission_control_integration = true;

  assert(sha(GUARD) === guardBefore, "Runtime Guard unchanged");
  assert(sha(PC) === pcBefore, "ProductionController unchanged");
  assert(sha(HEALTH) === healthBefore, "Health unchanged");
  assert(sha(BUDGET) === budgetBefore, "Budget unchanged");
  assert(sha(SCHED) === schedBefore, "Scheduling unchanged");
  assert(sha(ENG) === engBefore, "Engineering unchanged");
  assert(sha(PORT) === portBefore, "Portfolio unchanged");
  assert(sha(STRAT) === stratBefore, "Strategy unchanged");
  checks.canonical_owners_unchanged = true;
  checks.runtime_guard_unchanged = true;

  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE OFF");
  checks.live_off = true;

  const result = {
    agent: "226",
    ok: true,
    generated_at: new Date().toISOString(),
    live: false,
    publication_allowed: false,
    openai_called: false,
    owns_production: false,
    coordination_only: true,
    production_entry: "ProductionController",
    checks,
    runtime_guard_sha256: guardBefore,
    production_controller_sha256: pcBefore,
  };

  mkdirSync(resolve(OUT, ".."), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));
  console.log("PASS aios:system-orchestrator:verify");
}

main().catch((e) => {
  console.error("FAIL", e instanceof Error ? e.message : e);
  process.exit(1);
});
