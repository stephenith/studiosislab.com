/**
 * End-to-End Production Validation verify — Agent #227.
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
  loadProductionValidationSurface,
  runEndToEndProductionValidation,
} from "./EndToEndProductionValidation.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/production-validation/production-validation-verify.json",
);
const GUARD = join(REPO, "SOS/SAIOS/architecture/runtime-guard.ts");
const VAL = join(import.meta.dirname, "EndToEndProductionValidation.ts");
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
  "SOS/SAIOS/dashboard/src/views/mission-control/ProductionValidationPanel.tsx",
);
const SERVER = join(REPO, "SOS/SAIOS/dashboard/server.ts");
const REPORT = join(
  REPO,
  "SOS/07_LOGS/saios/production-validation/production-validation-report.json",
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
  const orchBefore = sha(ORCH);
  const faaBefore = sha(FAA);

  assert(existsSync(VAL), "validator module");
  assert(existsSync(PANEL), "validation panel");
  const src = readFileSync(VAL, "utf8");
  assert(src.includes("owns_production: false"), "never owns production");
  assert(src.includes("owns_orchestration: false"), "never owns orchestration");
  assert(src.includes("owns_business_logic: false"), "never owns business logic");
  assert(src.includes("modifies_architecture: false"), "never modifies architecture");
  assert(!src.includes("class ProductionEngine"), "no ProductionEngine");
  assert(!src.includes("class SystemOrchestrator"), "does not redefine orchestrator");
  assert(src.includes("persist: false"), "failure sims use persist:false");
  checks.validation_owns_nothing = true;

  const report = await runEndToEndProductionValidation({ repoRoot: REPO });
  assert(existsSync(REPORT), "validation report generated");
  assert(report.live === false, "LIVE off");
  assert(report.publication_allowed === false, "pub false");
  assert(report.openai_called === false, "no openai");
  assert(report.owns_production === false, "owns_production false");
  assert(report.owns_orchestration === false, "owns_orchestration false");
  assert(report.production_entry === "ProductionController", "PC entry");
  assert(report.checks_executed > 20, "enough checks");
  assert(report.overall_status !== "FAIL", `overall ${report.overall_status}: ${report.failed_checks.join(",")}`);
  assert(report.failure_scenarios.length >= 8, "failure scenarios covered");
  assert(report.lifecycle.length >= 4, "lifecycle checks");
  checks.report_generated = true;
  checks.lifecycle_validated = true;
  checks.failure_scenarios_covered = true;

  const surface = loadProductionValidationSurface({ repoRoot: REPO });
  assert(surface.last_validation != null, "surface has last validation");
  assert(surface.validation_status !== "NONE", "status present");
  assert(surface.owns_production === false, "surface owns_production false");
  checks.surface_ok = true;

  const mc = readFileSync(MC, "utf8");
  assert(mc.includes("ProductionValidationPanel"), "MC wires panel");
  const panel = readFileSync(PANEL, "utf8");
  assert(panel.includes("Production Validation"), "panel title");
  assert(panel.includes("Pass") || panel.includes("pass_percent"), "pass %");
  assert(panel.includes("Failed Checks") || panel.includes("failed_checks"), "failed checks");
  assert(panel.includes("/api/production-validation"), "API");

  const server = readFileSync(SERVER, "utf8");
  assert(server.includes("/api/production-validation"), "GET validation API");
  assert(server.includes("loadProductionValidationSurface"), "loads surface");
  // Existing APIs preserved
  assert(server.includes("/api/founder-command-center"), "FCC API preserved");
  assert(server.includes("/api/system-orchestrator"), "orch API preserved");
  assert(server.includes("/api/founder-actions"), "FAA API preserved");
  checks.mission_control_integration = true;
  checks.existing_apis_preserved = true;

  assert(sha(GUARD) === guardBefore, "Runtime Guard unchanged");
  assert(sha(PC) === pcBefore, "ProductionController unchanged");
  assert(sha(ORCH) === orchBefore, "System Orchestrator unchanged");
  assert(sha(FAA) === faaBefore, "Founder Action Adapters unchanged");
  checks.architecture_unchanged = true;
  checks.ownership_unchanged = true;

  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE OFF");
  checks.live_off = true;

  const result = {
    agent: "227",
    ok: true,
    generated_at: new Date().toISOString(),
    live: false,
    publication_allowed: false,
    openai_called: false,
    owns_production: false,
    owns_orchestration: false,
    validation_overall: report.overall_status,
    pass_percent: report.pass_percent,
    checks,
    runtime_guard_sha256: guardBefore,
  };

  mkdirSync(resolve(OUT, ".."), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));
  console.log("PASS aios:production-validation:verify");
}

main().catch((e) => {
  console.error("FAIL", e instanceof Error ? e.message : e);
  process.exit(1);
});
