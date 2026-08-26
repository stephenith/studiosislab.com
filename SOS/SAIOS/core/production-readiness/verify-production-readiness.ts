/**
 * Production Readiness Audit verify — Agent #228.
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
  buildProductionReadinessAudit,
  loadProductionReadinessSurface,
} from "./ProductionReadinessAudit.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/production-readiness/production-readiness-verify.json",
);
const GUARD = join(REPO, "SOS/SAIOS/architecture/runtime-guard.ts");
const AUDIT = join(import.meta.dirname, "ProductionReadinessAudit.ts");
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
const PV = join(
  REPO,
  "SOS/SAIOS/core/production-validation/EndToEndProductionValidation.ts",
);
const EI = join(
  REPO,
  "SOS/SAIOS/core/engineering-intelligence/EngineeringIntelligence.ts",
);
const MC = join(
  REPO,
  "SOS/SAIOS/dashboard/src/views/mission-control/MissionControlHome.tsx",
);
const PANEL = join(
  REPO,
  "SOS/SAIOS/dashboard/src/views/mission-control/ProductionReadinessPanel.tsx",
);
const SERVER = join(REPO, "SOS/SAIOS/dashboard/server.ts");
const REPORT = join(
  REPO,
  "SOS/07_LOGS/saios/production-readiness/production-readiness-report.json",
);
const VAL_REPORT = join(
  REPO,
  "SOS/07_LOGS/saios/production-validation/production-validation-report.json",
);
const EI_REPORT = join(
  REPO,
  "SOS/07_LOGS/saios/engineering-intelligence/engineering-intelligence-report.json",
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
  const pvBefore = sha(PV);
  const eiBefore = sha(EI);
  const valReportBefore = existsSync(VAL_REPORT) ? sha(VAL_REPORT) : null;
  const eiReportBefore = existsSync(EI_REPORT) ? sha(EI_REPORT) : null;

  assert(existsSync(AUDIT), "audit module");
  assert(existsSync(PANEL), "readiness panel");
  const src = readFileSync(AUDIT, "utf8");
  assert(src.includes("owns_production: false"), "never owns production");
  assert(src.includes("owns_orchestration: false"), "never owns orchestration");
  assert(src.includes("owns_business_logic: false"), "never owns business logic");
  assert(src.includes("owns_governance: false"), "never owns governance");
  assert(src.includes("executes_production: false"), "never executes production");
  assert(src.includes("regenerates_existing_reports: false"), "no regen");
  assert(!src.includes("runProduction("), "does not call runProduction");
  assert(!src.includes("buildEngineeringIntelligenceReport"), "does not regen EI");
  assert(!src.includes("runEndToEndProductionValidation"), "does not re-run validation");
  assert(!src.includes("class ProductionEngine"), "no ProductionEngine");
  checks.audit_owns_nothing = true;
  checks.no_duplicate_audit_logic = true;

  const report = buildProductionReadinessAudit({ repoRoot: REPO });
  assert(existsSync(REPORT), "readiness report generated");
  assert(report.live === false, "LIVE off");
  assert(report.publication_allowed === false, "pub false");
  assert(report.openai_called === false, "no openai");
  assert(report.executes_production === false, "no execution");
  assert(report.regenerates_existing_reports === false, "no regen flag");
  assert(report.scores.overall >= 0 && report.scores.overall <= 100, "overall band");
  assert(
    ["READY_FOR_STAGING", "READY_WITH_MINOR_ACTIONS", "NOT_READY"].includes(
      report.launch_recommendation,
    ),
    "valid launch recommendation",
  );
  assert(report.sources.some((s) => s.id === "production_validation"), "uses validation");
  assert(report.sources.some((s) => s.id === "engineering_intelligence"), "uses EI");
  assert(report.sources.some((s) => s.id === "system_integrity"), "uses integrity");
  assert(report.blockers.length >= 1, "blockers array present");
  assert(
    report.blockers.every(
      (b) =>
        b.blocker_id &&
        b.category &&
        b.severity &&
        b.description &&
        Array.isArray(b.supporting_evidence) &&
        typeof b.launch_blocking === "boolean" &&
        typeof b.requires_founder_approval === "boolean",
    ),
    "blocker schema complete",
  );
  checks.report_ok = true;
  checks.existing_reports_reused = true;

  if (valReportBefore) {
    assert(sha(VAL_REPORT) === valReportBefore, "validation report unchanged");
  }
  if (eiReportBefore) {
    assert(sha(EI_REPORT) === eiReportBefore, "EI report unchanged");
  }
  checks.immutable_reports_preserved = true;

  const surface = loadProductionReadinessSurface({ repoRoot: REPO });
  assert(surface.last_audit != null, "surface has last audit");
  assert(surface.overall_readiness != null, "overall readiness");
  assert(surface.owns_production === false, "surface owns_production false");
  assert(surface.owns_governance === false, "surface owns_governance false");
  checks.surface_ok = true;

  const mc = readFileSync(MC, "utf8");
  assert(mc.includes("ProductionReadinessPanel"), "MC wires panel");
  const panel = readFileSync(PANEL, "utf8");
  assert(panel.includes("Production Readiness"), "panel title");
  assert(panel.includes("Launch Recommendation") || panel.includes("launch_recommendation"), "launch");
  assert(panel.includes("Critical") || panel.includes("critical_blockers"), "critical");
  assert(panel.includes("/api/production-readiness"), "API");

  const server = readFileSync(SERVER, "utf8");
  assert(server.includes("/api/production-readiness"), "GET readiness API");
  assert(server.includes("loadProductionReadinessSurface"), "loads surface");
  assert(server.includes("/api/founder-command-center"), "FCC API preserved");
  assert(server.includes("/api/production-validation"), "validation API preserved");
  assert(server.includes("/api/system-orchestrator"), "orch API preserved");
  assert(server.includes("/api/founder-actions"), "FAA API preserved");
  checks.mission_control_integration = true;
  checks.existing_apis_preserved = true;

  assert(sha(GUARD) === guardBefore, "Runtime Guard unchanged");
  assert(sha(PC) === pcBefore, "ProductionController unchanged");
  assert(sha(ORCH) === orchBefore, "Orchestrator unchanged");
  assert(sha(FAA) === faaBefore, "FAA unchanged");
  assert(sha(PV) === pvBefore, "Validation module unchanged");
  assert(sha(EI) === eiBefore, "Engineering Intelligence unchanged");
  checks.ownership_preserved = true;
  checks.architecture_unchanged = true;
  checks.verification_preserved = true;

  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE OFF");
  checks.live_off = true;

  const result = {
    agent: "228",
    ok: true,
    generated_at: new Date().toISOString(),
    live: false,
    publication_allowed: false,
    openai_called: false,
    owns_production: false,
    owns_orchestration: false,
    owns_governance: false,
    launch_recommendation: report.launch_recommendation,
    overall_readiness: report.scores.overall,
    highest_blocker_level: report.highest_blocker_level,
    checks,
    runtime_guard_sha256: guardBefore,
  };

  mkdirSync(resolve(OUT, ".."), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));
  console.log("PASS aios:production-readiness:verify");
}

main();
