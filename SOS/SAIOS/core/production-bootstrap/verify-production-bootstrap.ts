/**
 * Production Bootstrap verify — Agent #229.
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
  loadProductionBootstrapSurface,
  runProductionBootstrap,
} from "./ProductionBootstrap.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/production-bootstrap/production-bootstrap-verify.json",
);
const GUARD = join(REPO, "SOS/SAIOS/architecture/runtime-guard.ts");
const BOOT = join(import.meta.dirname, "ProductionBootstrap.ts");
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
  "SOS/SAIOS/dashboard/src/views/mission-control/ProductionBootstrapPanel.tsx",
);
const SERVER = join(REPO, "SOS/SAIOS/dashboard/server.ts");
const REPORT = join(
  REPO,
  "SOS/07_LOGS/saios/production-bootstrap/production-bootstrap-report.json",
);

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function sha(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function main(): void {
  process.env.SOS_AIOS_LIVE = "0";
  const checks: Record<string, boolean> = {};

  const guardBefore = sha(GUARD);
  const pcBefore = sha(PC);
  const orchBefore = sha(ORCH);
  const faaBefore = sha(FAA);

  assert(existsSync(BOOT), "bootstrap module");
  assert(existsSync(PANEL), "bootstrap panel");
  const src = readFileSync(BOOT, "utf8");
  assert(src.includes("owns_production: false"), "never owns production");
  assert(src.includes("owns_orchestration: false"), "never owns orchestration");
  assert(src.includes("owns_governance: false"), "never owns governance");
  assert(src.includes("executes_production: false"), "never executes production");
  assert(src.includes("generates_content: false"), "never generates content");
  assert(src.includes("bypasses_runtime_guard: false"), "never bypasses guard");
  assert(
    src.includes("bypasses_founder_approval: false"),
    "never bypasses founder approval",
  );
  assert(src.includes("founder_approval_required: true"), "founder approval required");
  assert(!src.includes("runProduction("), "does not call runProduction");
  assert(!src.includes("class ProductionEngine"), "no ProductionEngine");
  checks.bootstrap_owns_nothing = true;
  checks.no_production_execution = true;

  const report = runProductionBootstrap({ repoRoot: REPO });
  assert(existsSync(REPORT), "bootstrap report generated");
  assert(report.live === false, "LIVE off");
  assert(report.publication_allowed === false, "pub false");
  assert(report.executes_production === false, "no execution");
  assert(report.founder_approval_required === true, "founder approval");
  assert(report.bypasses_runtime_guard === false, "no guard bypass");
  assert(report.production_entry === "ProductionController", "PC entry");
  assert(report.checks_executed >= 20, "enough checks");
  assert(
    report.readiness === "READY" || report.readiness === "NOT_READY",
    "readiness set",
  );
  assert(report.overall_status !== "FAIL" || report.readiness === "NOT_READY", "consistency");
  assert(report.readiness === "READY", `readiness ${report.readiness}: ${report.failed_checks.join(",")}`);
  checks.report_ok = true;
  checks.readiness_ready = true;

  const surface = loadProductionBootstrapSurface({ repoRoot: REPO });
  assert(surface.last_bootstrap != null, "surface has last bootstrap");
  assert(surface.readiness_result === "READY", "surface READY");
  assert(surface.founder_approval_required === true, "surface founder approval");
  assert(surface.executes_production === false, "surface no execute");
  checks.surface_ok = true;

  const mc = readFileSync(MC, "utf8");
  assert(mc.includes("ProductionBootstrapPanel"), "MC wires panel");
  const panel = readFileSync(PANEL, "utf8");
  assert(panel.includes("Production Bootstrap"), "panel title");
  assert(panel.includes("Bootstrap Status") || panel.includes("bootstrap_status"), "status");
  assert(panel.includes("Readiness") || panel.includes("readiness"), "readiness");
  assert(panel.includes("/api/production-bootstrap"), "API");

  const server = readFileSync(SERVER, "utf8");
  assert(server.includes("/api/production-bootstrap"), "bootstrap API");
  assert(server.includes("loadProductionBootstrapSurface"), "loads surface");
  assert(server.includes("/api/founder-command-center"), "FCC API preserved");
  assert(server.includes("/api/production-readiness"), "readiness API preserved");
  assert(server.includes("/api/production-validation"), "validation API preserved");
  checks.mission_control_integration = true;
  checks.existing_apis_preserved = true;

  assert(sha(GUARD) === guardBefore, "Runtime Guard unchanged");
  assert(sha(PC) === pcBefore, "ProductionController unchanged");
  assert(sha(ORCH) === orchBefore, "Orchestrator unchanged");
  assert(sha(FAA) === faaBefore, "FAA unchanged");
  checks.ownership_preserved = true;
  checks.architecture_preserved = true;

  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE OFF");
  checks.live_off = true;

  const result = {
    agent: "229",
    ok: true,
    generated_at: new Date().toISOString(),
    live: false,
    publication_allowed: false,
    openai_called: false,
    owns_production: false,
    owns_orchestration: false,
    owns_governance: false,
    executes_production: false,
    readiness: report.readiness,
    overall_status: report.overall_status,
    passed: report.passed,
    failed: report.failed,
    checks,
    runtime_guard_sha256: guardBefore,
  };

  mkdirSync(resolve(OUT, ".."), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));
  console.log("PASS aios:production-bootstrap:verify");
}

main();
