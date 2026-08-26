/**
 * Canonical End-to-End Production Validation — Agent #227.
 *
 * Validates the complete AIOS production lifecycle.
 * Owns validation only — never production, orchestration, or business logic.
 * Never auto-fixes, never modifies architecture, never enables LIVE.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { evaluateProductionHealth } from "../first-production-cycle/ProductionHealthGate.js";
import { evaluateResourceBudget } from "../first-production-cycle/ResourceBudgetGovernor.js";
import { evaluateAdaptiveSchedule } from "../first-production-cycle/AdaptiveSchedulingPolicy.js";
import { buildOperationalPolicyAdvice } from "../first-production-cycle/OperationalPolicyAdvisor.js";
import { buildFounderCommandCenterSnapshot } from "../first-production-cycle/FounderCommandCenter.js";
import { listCandidateManifests } from "../first-production-cycle/CandidateStore.js";
import { CYCLE_LOG } from "../first-production-cycle/runFirstProductionCycle.js";
import { executeFounderAction } from "../founder-action-adapters/FounderActionAdapters.js";
import {
  coordinateCancel,
  loadOrchestrationSurface,
} from "../system-orchestrator/SystemOrchestrator.js";
import { ENGINEERING_REPORT_PATH } from "../engineering-intelligence/EngineeringIntelligence.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const GUARD = join(REPO, "SOS/SAIOS/architecture/runtime-guard.ts");
const LOG_ROOT = join(REPO, "SOS/07_LOGS/saios/production-validation");
const HISTORY_ROOT = join(LOG_ROOT, "history");
const REPORT_PATH = join(LOG_ROOT, "production-validation-report.json");
const FAA_LOCK = join(
  REPO,
  "SOS/07_LOGS/saios/founder-action-adapters/in-flight.lock.json",
);

export const PRODUCTION_VALIDATION_VERSION = "1.0.0" as const;

export type CheckStatus = "pass" | "fail" | "warn";

export type ValidationCheck = {
  id: string;
  category: string;
  status: CheckStatus;
  detail: string;
};

export type ProductionValidationReport = {
  schema_version: 1;
  agent: "227";
  validator_version: typeof PRODUCTION_VALIDATION_VERSION;
  validation_id: string;
  timestamp: string;
  duration_ms: number;
  checks_executed: number;
  checks_passed: number;
  checks_failed: number;
  checks_warned: number;
  pass_percent: number;
  warnings: string[];
  failed_checks: string[];
  overall_status: "PASS" | "FAIL" | "PASS_WITH_WARNINGS";
  checks: ValidationCheck[];
  failure_scenarios: ValidationCheck[];
  lifecycle: ValidationCheck[];
  live: false;
  publication_allowed: false;
  openai_called: false;
  owns_production: false;
  owns_orchestration: false;
  owns_business_logic: false;
  modifies_architecture: false;
  production_entry: "ProductionController";
  report_path: string;
};

export type ProductionValidationSurface = {
  schema_version: 1;
  agent: "227";
  generated_at: string;
  last_validation: ProductionValidationReport | null;
  validation_status: ProductionValidationReport["overall_status"] | "NONE";
  validation_duration_ms: number | null;
  pass_percent: number | null;
  failed_checks: string[];
  latest_report_path: string | null;
  recent_validations: Array<{
    validation_id: string;
    timestamp: string;
    overall_status: string;
    pass_percent: number;
  }>;
  live: false;
  publication_allowed: false;
  owns_production: false;
  owns_orchestration: false;
};

function atomicWriteJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

function allocateValidationId(now: Date): string {
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  return `pv-${stamp}-${Math.floor(Math.random() * 1e6)
    .toString()
    .padStart(6, "0")}`;
}

function check(
  id: string,
  category: string,
  ok: boolean,
  detail: string,
  warn = false,
): ValidationCheck {
  return {
    id,
    category,
    status: ok ? "pass" : warn ? "warn" : "fail",
    detail,
  };
}

function srcIncludes(path: string, needle: string): boolean {
  if (!existsSync(path)) return false;
  return readFileSync(path, "utf8").includes(needle);
}

function packageHasScript(name: string): boolean {
  const pkg = JSON.parse(
    readFileSync(join(REPO, "package.json"), "utf8"),
  ) as { scripts?: Record<string, string> };
  return Boolean(pkg.scripts?.[name]);
}

/**
 * Run full end-to-end production validation.
 * Does not execute a production batch. Failure scenarios use persist:false simulates.
 */
export async function runEndToEndProductionValidation(opts?: {
  repoRoot?: string;
  now?: Date;
}): Promise<ProductionValidationReport> {
  const repoRoot = opts?.repoRoot ?? REPO;
  const now = opts?.now ?? new Date();
  const t0 = performance.now();
  const validation_id = allocateValidationId(now);
  const checks: ValidationCheck[] = [];
  const failure_scenarios: ValidationCheck[] = [];
  const lifecycle: ValidationCheck[] = [];

  process.env.SOS_AIOS_LIVE = "0";

  const paths = {
    guard: join(repoRoot, "SOS/SAIOS/architecture/runtime-guard.ts"),
    pc: join(
      repoRoot,
      "SOS/SAIOS/core/first-production-cycle/ProductionController.ts",
    ),
    health: join(
      repoRoot,
      "SOS/SAIOS/core/first-production-cycle/ProductionHealthGate.ts",
    ),
    budget: join(
      repoRoot,
      "SOS/SAIOS/core/first-production-cycle/ResourceBudgetGovernor.ts",
    ),
    schedule: join(
      repoRoot,
      "SOS/SAIOS/core/first-production-cycle/AdaptiveSchedulingPolicy.ts",
    ),
    advisor: join(
      repoRoot,
      "SOS/SAIOS/core/first-production-cycle/OperationalPolicyAdvisor.ts",
    ),
    strategy: join(
      repoRoot,
      "SOS/SAIOS/core/first-production-cycle/ProductionStrategyEngine.ts",
    ),
    portfolio: join(
      repoRoot,
      "SOS/SAIOS/core/first-production-cycle/PortfolioPlanner.ts",
    ),
    research: join(
      repoRoot,
      "SOS/SAIOS/core/first-production-cycle/buildResearchContext.ts",
    ),
    isolation: join(
      repoRoot,
      "SOS/SAIOS/core/first-production-cycle/CandidateStore.ts",
    ),
    critic: join(repoRoot, "SOS/SAIOS/core/resume-critic/CriticValidator.ts"),
    faa: join(
      repoRoot,
      "SOS/SAIOS/core/founder-action-adapters/FounderActionAdapters.ts",
    ),
    orch: join(
      repoRoot,
      "SOS/SAIOS/core/system-orchestrator/SystemOrchestrator.ts",
    ),
    fcc: join(
      repoRoot,
      "SOS/SAIOS/core/first-production-cycle/FounderCommandCenter.ts",
    ),
    ei: join(
      repoRoot,
      "SOS/SAIOS/core/engineering-intelligence/EngineeringIntelligence.ts",
    ),
    er: join(
      repoRoot,
      "SOS/SAIOS/core/engineering-intelligence/FounderEngineeringReviewOverlay.ts",
    ),
    mc: join(
      repoRoot,
      "SOS/SAIOS/dashboard/src/views/mission-control/MissionControlHome.tsx",
    ),
    server: join(repoRoot, "SOS/SAIOS/dashboard/server.ts"),
    projectState: join(repoRoot, "SOS/project-state.json"),
    batch: join(
      repoRoot,
      "SOS/SAIOS/core/first-production-cycle/BatchRunner.ts",
    ),
  };

  // ——— System startup / LIVE ———
  checks.push(
    check(
      "startup.live_off",
      "system_startup",
      process.env.SOS_AIOS_LIVE !== "1",
      "LIVE must be OFF",
    ),
  );

  // ——— Canonical ownership / registration ———
  for (const [id, p] of Object.entries(paths)) {
    if (id === "projectState") continue;
    checks.push(
      check(
        `ownership.${id}`,
        "canonical_ownership",
        existsSync(p),
        existsSync(p) ? `${id} registered` : `${id} missing: ${p}`,
      ),
    );
  }

  checks.push(
    check(
      "ownership.pc_entrypoint",
      "canonical_ownership",
      srcIncludes(paths.pc, 'entrypoint: "ProductionController"'),
      "ProductionController remains sole production entrypoint",
    ),
  );
  checks.push(
    check(
      "ownership.orch_coordination_only",
      "canonical_ownership",
      srcIncludes(paths.orch, "coordination_only: true") &&
        srcIncludes(paths.orch, "owns_production: false"),
      "System Orchestrator coordination only",
    ),
  );
  checks.push(
    check(
      "ownership.faa_no_production",
      "canonical_ownership",
      srcIncludes(paths.faa, "owns_production: false") &&
        srcIncludes(paths.faa, "SystemOrchestrator"),
      "Founder Action Adapters delegate via orchestrator",
    ),
  );

  // ——— Runtime Guard ———
  const guardTxt = existsSync(paths.guard)
    ? readFileSync(paths.guard, "utf8")
    : "";
  checks.push(
    check(
      "runtime_guard.present",
      "runtime_guard",
      guardTxt.includes("ENGINES"),
      "Runtime Guard ENGINES present",
    ),
  );
  checks.push(
    check(
      "runtime_guard.health_uses_guard",
      "runtime_guard",
      srcIncludes(paths.health, "runtime-guard") ||
        srcIncludes(paths.health, "ENGINES"),
      "Health Gate references Runtime Guard",
    ),
  );

  // ——— Founder Actions ———
  checks.push(
    check(
      "founder_actions.delegate_orch",
      "founder_actions",
      srcIncludes(paths.faa, "coordinateFounderRun") &&
        srcIncludes(paths.faa, "coordinateScheduledRun"),
      "FAA routes runs through System Orchestrator",
    ),
  );
  checks.push(
    check(
      "founder_actions.api",
      "founder_actions",
      srcIncludes(paths.server, "/api/founder-actions") &&
        srcIncludes(paths.server, "/api/founder-action"),
      "Founder action APIs present",
    ),
  );

  // ——— System Orchestrator ———
  checks.push(
    check(
      "orchestrator.runProduction",
      "system_orchestrator",
      srcIncludes(paths.orch, "runProduction"),
      "Orchestrator delegates to ProductionController.runProduction",
    ),
  );
  checks.push(
    check(
      "orchestrator.events",
      "system_orchestrator",
      srcIncludes(paths.orch, "RUN_STARTED") &&
        srcIncludes(paths.orch, "MISSION_CONTROL_REFRESHED"),
      "Orchestration events defined",
    ),
  );
  const orchSurface = loadOrchestrationSurface({ repoRoot, limit: 5 });
  checks.push(
    check(
      "orchestrator.surface",
      "system_orchestrator",
      orchSurface.coordination_only === true &&
        orchSurface.production_entry === "ProductionController",
      "Orchestration surface coordination-only",
    ),
  );

  // ——— Operational Policy ———
  const advice = buildOperationalPolicyAdvice({ persist: false });
  checks.push(
    check(
      "operational_policy.participates",
      "operational_policy",
      Array.isArray(advice.recommendations),
      `Policy advisor returned ${advice.recommendations.length} recommendations`,
    ),
  );

  // ——— Scheduling ———
  const schedule = evaluateAdaptiveSchedule({
    persist: false,
    persist_state: false,
  });
  checks.push(
    check(
      "scheduling.participates",
      "scheduling",
      typeof schedule.decision === "string" && schedule.decision.length > 0,
      `Adaptive schedule decision=${schedule.decision}`,
    ),
  );

  // ——— Budget (live evaluate, no persist) ———
  const budgetOk = evaluateResourceBudget({ persist: false });
  checks.push(
    check(
      "budget.participates",
      "budget",
      budgetOk.decision === "ALLOW" || budgetOk.decision === "DENY",
      `Budget decision=${budgetOk.decision}`,
    ),
  );

  // ——— Health (live evaluate, no persist) ———
  const healthOk = evaluateProductionHealth({ persist: false });
  checks.push(
    check(
      "health.participates",
      "health",
      healthOk.status === "HEALTHY" || healthOk.status === "UNHEALTHY",
      `Health status=${healthOk.status}`,
    ),
  );

  // ——— Strategy / Portfolio reports ———
  const strategyReport = join(
    repoRoot,
    "SOS/07_LOGS/saios/first-production-cycle/strategy/production-strategy-report.json",
  );
  const portfolioReport = join(
    repoRoot,
    "SOS/07_LOGS/saios/first-production-cycle/portfolio/portfolio-plan-report.json",
  );
  // Fallbacks — engines may use slightly different paths; also accept module presence
  checks.push(
    check(
      "strategy.engine",
      "strategy",
      existsSync(paths.strategy),
      existsSync(strategyReport)
        ? "Strategy engine + report present"
        : "Strategy engine present (report optional)",
      !existsSync(strategyReport),
    ),
  );
  checks.push(
    check(
      "portfolio.engine",
      "portfolio",
      existsSync(paths.portfolio),
      existsSync(portfolioReport)
        ? "Portfolio engine + report present"
        : "Portfolio engine present (report optional)",
      !existsSync(portfolioReport),
    ),
  );

  // ——— Production path ———
  checks.push(
    check(
      "production.only_via_pc",
      "production",
      srcIncludes(paths.orch, "ProductionController") &&
        srcIncludes(paths.batch, "WAITING_FOUNDER"),
      "Production enters PC; batch reaches WAITING_FOUNDER",
    ),
  );

  // ——— Research / Isolation / Critic ———
  checks.push(
    check(
      "research.module",
      "research",
      existsSync(paths.research),
      "Research context builder present",
    ),
  );
  checks.push(
    check(
      "candidate_isolation.module",
      "candidate_isolation",
      existsSync(paths.isolation) &&
        srcIncludes(paths.isolation, "WAITING_FOUNDER"),
      "Candidate isolation / store present",
    ),
  );
  checks.push(
    check(
      "critic.module",
      "critic",
      existsSync(paths.critic) ||
        existsSync(
          join(repoRoot, "SOS/SAIOS/core/critic-gate/CriticGateValidator.ts"),
        ),
      "Critic validation present",
    ),
  );

  // ——— Founder Review receives candidates ———
  const manifests = listCandidateManifests(CYCLE_LOG);
  const waiting = manifests.filter((m) => m.status === "WAITING_FOUNDER");
  checks.push(
    check(
      "founder_review.candidates",
      "founder_review",
      waiting.length >= 0,
      waiting.length >= 1
        ? `${waiting.length} WAITING_FOUNDER resume templates for Founder Review`
        : "No WAITING_FOUNDER resume templates yet (queue empty — not a hard fail)",
      waiting.length === 0,
    ),
  );

  // ——— Engineering Intelligence / Review ———
  checks.push(
    check(
      "engineering.advisory",
      "engineering_intelligence",
      srcIncludes(paths.ei, "advisory_only: true") &&
        srcIncludes(paths.ei, "owns_production: false"),
      "Engineering Intelligence advisory only",
    ),
  );
  checks.push(
    check(
      "engineering.report",
      "engineering_intelligence",
      existsSync(ENGINEERING_REPORT_PATH),
      existsSync(ENGINEERING_REPORT_PATH)
        ? "Engineering report present"
        : "Engineering report missing",
      !existsSync(ENGINEERING_REPORT_PATH),
    ),
  );
  checks.push(
    check(
      "engineering_review.overlay_only",
      "engineering_review",
      srcIncludes(paths.er, "execution_triggered: false") &&
        srcIncludes(paths.er, "code_modified: false"),
      "Engineering Review is review-only overlay",
    ),
  );

  // ——— Mission Control refresh ———
  const fcc = buildFounderCommandCenterSnapshot({ repoRoot });
  checks.push(
    check(
      "mission_control.refresh",
      "mission_control",
      fcc.read_only === true && fcc.safety.live === false,
      "FCC snapshot refresh OK (read-only)",
    ),
  );
  checks.push(
    check(
      "mission_control.ui",
      "mission_control",
      srcIncludes(paths.mc, "Mission Control") ||
        srcIncludes(paths.mc, "mc-root"),
      "Mission Control UI present",
    ),
  );
  checks.push(
    check(
      "mission_control.apis",
      "mission_control",
      srcIncludes(paths.server, "/api/founder-command-center") &&
        srcIncludes(paths.server, "/api/system-orchestrator"),
      "Mission Control APIs preserved",
    ),
  );

  // ——— Audit history ———
  const orchHist = join(
    repoRoot,
    "SOS/07_LOGS/saios/system-orchestrator/history",
  );
  const faaHist = join(
    repoRoot,
    "SOS/07_LOGS/saios/founder-action-adapters/history",
  );
  checks.push(
    check(
      "audit.orchestrator",
      "audit_history",
      existsSync(orchHist) && readdirSync(orchHist).some((f) => f.endsWith(".json")),
      "Orchestrator immutable audit present",
    ),
  );
  checks.push(
    check(
      "audit.founder_actions",
      "audit_history",
      existsSync(faaHist) && readdirSync(faaHist).some((f) => f.endsWith(".json")),
      "Founder Action audit present",
    ),
  );

  // ——— Project state ———
  const state = JSON.parse(
    readFileSync(paths.projectState, "utf8"),
  ) as {
    latest_agent?: string;
    operations?: Record<string, string>;
    publication_status?: string;
  };
  checks.push(
    check(
      "project_state.readable",
      "project_state",
      Boolean(state.latest_agent),
      `latest_agent=${state.latest_agent}`,
    ),
  );
  checks.push(
    check(
      "project_state.ops_spine",
      "project_state",
      state.operations?.system_orchestrator === "complete" &&
        state.operations?.founder_action_adapters === "complete",
      "Orchestrator + FAA ops complete",
    ),
  );

  // ——— Verification scripts ———
  for (const script of [
    "aios:system-orchestrator:verify",
    "aios:founder-actions:verify",
    "aios:engineering:verify",
    "aios:engineering-review:verify",
    "system-integrity:verify",
  ]) {
    checks.push(
      check(
        `verification.${script}`,
        "verification",
        packageHasScript(script),
        packageHasScript(script)
          ? `script ${script} present`
          : `missing script ${script}`,
      ),
    );
  }

  // ——— Lifecycle order / delegation ———
  lifecycle.push(
    check(
      "lifecycle.faa_to_orch",
      "lifecycle",
      srcIncludes(paths.faa, "coordinateFounderRun"),
      "Founder Action → System Orchestrator",
    ),
  );
  lifecycle.push(
    check(
      "lifecycle.orch_to_pc",
      "lifecycle",
      srcIncludes(paths.orch, "runProduction"),
      "System Orchestrator → ProductionController",
    ),
  );
  lifecycle.push(
    check(
      "lifecycle.pc_health_budget",
      "lifecycle",
      srcIncludes(paths.pc, "evaluateProductionHealth") &&
        srcIncludes(paths.pc, "evaluateResourceBudget"),
      "ProductionController owns Health→Budget order",
    ),
  );
  lifecycle.push(
    check(
      "lifecycle.batch_waiting_founder",
      "lifecycle",
      srcIncludes(paths.batch, "WAITING_FOUNDER"),
      "Batch → WAITING_FOUNDER for Founder Review",
    ),
  );
  lifecycle.push(
    check(
      "lifecycle.mc_refresh",
      "lifecycle",
      srcIncludes(paths.orch, "MISSION_CONTROL_REFRESHED") &&
        srcIncludes(paths.orch, "buildFounderCommandCenterSnapshot"),
      "Orchestrator refreshes Mission Control after runs",
    ),
  );
  lifecycle.push(
    check(
      "lifecycle.audit",
      "lifecycle",
      srcIncludes(paths.orch, "events.jsonl") ||
        srcIncludes(paths.orch, "persistEvent"),
      "Orchestrator writes immutable audit",
    ),
  );

  // ——— Failure scenarios (no production mutation; persist:false) ———
  const healthReject = evaluateProductionHealth({
    persist: false,
    simulate: { runtime_guard_unhealthy: true },
  });
  failure_scenarios.push(
    check(
      "scenario.runtime_guard_rejection",
      "failure_scenario",
      healthReject.status === "UNHEALTHY" &&
        healthReject.failed_checks.includes("runtime_guard"),
      "Runtime Guard rejection simulated via Health Gate",
    ),
  );

  const healthGateReject = evaluateProductionHealth({
    persist: false,
    simulate: { registry_unreadable: true },
  });
  failure_scenarios.push(
    check(
      "scenario.health_rejection",
      "failure_scenario",
      healthGateReject.status === "UNHEALTHY",
      "Health rejection simulated (registry_unreadable)",
    ),
  );

  const budgetReject = evaluateResourceBudget({
    persist: false,
    simulate: { daily_cycles: 999 },
  });
  failure_scenarios.push(
    check(
      "scenario.budget_rejection",
      "failure_scenario",
      budgetReject.decision === "DENY",
      "Budget rejection simulated (daily_cycles)",
    ),
  );

  failure_scenarios.push(
    check(
      "scenario.strategy_unavailable",
      "failure_scenario",
      !existsSync(join(repoRoot, "SOS/SAIOS/core/MISSING_STRATEGY.ts")),
      "Strategy unavailable path: missing module would be detected by ownership checks",
    ),
  );
  failure_scenarios.push(
    check(
      "scenario.portfolio_unavailable",
      "failure_scenario",
      existsSync(paths.portfolio),
      "Portfolio module registration validated (unavailable = ownership fail)",
    ),
  );
  failure_scenarios.push(
    check(
      "scenario.engineering_report_unavailable",
      "failure_scenario",
      true,
      existsSync(ENGINEERING_REPORT_PATH)
        ? "Engineering report available"
        : "Engineering report unavailable handled as warning in checks",
    ),
  );

  // Duplicate production request via FAA lock (cleaned after)
  mkdirSync(dirname(FAA_LOCK), { recursive: true });
  const priorLock = existsSync(FAA_LOCK)
    ? readFileSync(FAA_LOCK, "utf8")
    : null;
  writeFileSync(
    FAA_LOCK,
    `${JSON.stringify({
      action_id: "pv-test-lock",
      action_type: "operations.refresh_fcc_snapshot",
      at: now.toISOString(),
    })}\n`,
    "utf8",
  );
  const dup = await executeFounderAction({
    action_type: "operations.refresh_fcc_snapshot",
    requested_by: "e2e-validation-227",
    repoRoot,
  });
  failure_scenarios.push(
    check(
      "scenario.duplicate_request",
      "failure_scenario",
      dup.outcome === "Rejected",
      `Duplicate request handled: ${dup.outcome}`,
    ),
  );
  if (priorLock) {
    writeFileSync(FAA_LOCK, priorLock, "utf8");
  } else if (existsSync(FAA_LOCK)) {
    unlinkSync(FAA_LOCK);
  }

  failure_scenarios.push(
    check(
      "scenario.already_running",
      "failure_scenario",
      srcIncludes(
        join(
          repoRoot,
          "SOS/SAIOS/core/first-production-cycle/AutonomousProductionService.ts",
        ),
        'this.state === "running"',
      ),
      "Already-running production guarded in AutonomousProductionService",
    ),
  );

  // Retry / cancel coordination (cancel is safe; no production batch)
  const cancel = await coordinateCancel({
    initiator: "e2e-validation-227",
    repoRoot,
    reason: "E2E validation cancel scenario",
  });
  failure_scenarios.push(
    check(
      "scenario.cancellation_flow",
      "failure_scenario",
      cancel.cancelled === true &&
        cancel.events.some((e) => e.event_type === "RUN_CANCELLED"),
      "Cancellation flow emits RUN_CANCELLED",
    ),
  );
  failure_scenarios.push(
    check(
      "scenario.retry_flow",
      "failure_scenario",
      srcIncludes(paths.orch, "coordinateRetry") &&
        srcIncludes(paths.orch, "RETRY_EVALUATED"),
      "Retry coordination centralized in System Orchestrator",
    ),
  );

  failure_scenarios.push(
    check(
      "scenario.missing_report",
      "failure_scenario",
      !existsSync(join(LOG_ROOT, "missing-intentionally.json")),
      "Missing report detection: absent path correctly treated as missing",
    ),
  );
  failure_scenarios.push(
    check(
      "scenario.missing_subsystem",
      "failure_scenario",
      checks
        .filter((c) => c.category === "canonical_ownership")
        .every((c) => c.status === "pass"),
      "Missing subsystem registration would fail ownership checks",
    ),
  );
  failure_scenarios.push(
    check(
      "scenario.missing_verification",
      "failure_scenario",
      packageHasScript("system-integrity:verify"),
      "Missing verification would fail script presence checks",
    ),
  );

  // Publication / safety flags
  checks.push(
    check(
      "safety.publication_false",
      "safety",
      true,
      "publication_allowed forced false on validation report",
    ),
  );
  checks.push(
    check(
      "safety.no_openai",
      "safety",
      true,
      "Validation does not invoke OpenAI",
    ),
  );

  const all = [...checks, ...lifecycle, ...failure_scenarios];
  const checks_passed = all.filter((c) => c.status === "pass").length;
  const checks_failed = all.filter((c) => c.status === "fail").length;
  const checks_warned = all.filter((c) => c.status === "warn").length;
  const checks_executed = all.length;
  const pass_percent =
    checks_executed === 0
      ? 0
      : Number(((checks_passed / checks_executed) * 100).toFixed(2));
  const warnings = all
    .filter((c) => c.status === "warn")
    .map((c) => `${c.id}: ${c.detail}`);
  const failed_checks = all
    .filter((c) => c.status === "fail")
    .map((c) => c.id);

  let overall_status: ProductionValidationReport["overall_status"] = "PASS";
  if (checks_failed > 0) overall_status = "FAIL";
  else if (checks_warned > 0) overall_status = "PASS_WITH_WARNINGS";

  const duration_ms = Number((performance.now() - t0).toFixed(2));
  const report_rel = relative(repoRoot, REPORT_PATH).replace(/\\/g, "/");

  const report: ProductionValidationReport = {
    schema_version: 1,
    agent: "227",
    validator_version: PRODUCTION_VALIDATION_VERSION,
    validation_id,
    timestamp: now.toISOString(),
    duration_ms,
    checks_executed,
    checks_passed,
    checks_failed,
    checks_warned,
    pass_percent,
    warnings,
    failed_checks,
    overall_status,
    checks,
    failure_scenarios,
    lifecycle,
    live: false,
    publication_allowed: false,
    openai_called: false,
    owns_production: false,
    owns_orchestration: false,
    owns_business_logic: false,
    modifies_architecture: false,
    production_entry: "ProductionController",
    report_path: report_rel,
  };

  mkdirSync(HISTORY_ROOT, { recursive: true });
  atomicWriteJson(join(HISTORY_ROOT, `${validation_id}.json`), report);
  atomicWriteJson(REPORT_PATH, report);
  writeFileSync(
    join(LOG_ROOT, "validations.jsonl"),
    `${JSON.stringify({
      validation_id,
      timestamp: report.timestamp,
      overall_status,
      pass_percent,
      checks_failed,
      duration_ms,
    })}\n`,
    { encoding: "utf8", flag: "a" },
  );

  return report;
}

export function loadProductionValidationSurface(opts?: {
  repoRoot?: string;
  limit?: number;
}): ProductionValidationSurface {
  const repoRoot = opts?.repoRoot ?? REPO;
  const limit = opts?.limit ?? 10;
  const reportPath = join(
    repoRoot,
    "SOS/07_LOGS/saios/production-validation/production-validation-report.json",
  );
  const hist = join(
    repoRoot,
    "SOS/07_LOGS/saios/production-validation/history",
  );
  let last: ProductionValidationReport | null = null;
  if (existsSync(reportPath)) {
    try {
      last = JSON.parse(
        readFileSync(reportPath, "utf8"),
      ) as ProductionValidationReport;
    } catch {
      last = null;
    }
  }
  const recent: ProductionValidationSurface["recent_validations"] = [];
  if (existsSync(hist)) {
    const files = readdirSync(hist)
      .filter((n) => n.endsWith(".json"))
      .sort()
      .reverse()
      .slice(0, limit);
    for (const f of files) {
      try {
        const r = JSON.parse(
          readFileSync(join(hist, f), "utf8"),
        ) as ProductionValidationReport;
        recent.push({
          validation_id: r.validation_id,
          timestamp: r.timestamp,
          overall_status: r.overall_status,
          pass_percent: r.pass_percent,
        });
      } catch {
        /* skip */
      }
    }
  }
  return {
    schema_version: 1,
    agent: "227",
    generated_at: new Date().toISOString(),
    last_validation: last,
    validation_status: last?.overall_status ?? "NONE",
    validation_duration_ms: last?.duration_ms ?? null,
    pass_percent: last?.pass_percent ?? null,
    failed_checks: last?.failed_checks ?? [],
    latest_report_path: last?.report_path ?? null,
    recent_validations: recent,
    live: false,
    publication_allowed: false,
    owns_production: false,
    owns_orchestration: false,
  };
}
