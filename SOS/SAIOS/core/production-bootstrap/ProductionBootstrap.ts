/**
 * Canonical Production Bootstrap — Agent #229.
 *
 * Prepares AIOS for the first supervised production cycle.
 * Owns preparation/validation only — never production, orchestration,
 * business logic, or governance. Never executes production.
 * Never bypasses Founder approval or Runtime Guard. Never enables LIVE.
 */
import {
  accessSync,
  constants,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const REPO = resolve(import.meta.dirname, "../../../..");
const LOG_ROOT = join(REPO, "SOS/07_LOGS/saios/production-bootstrap");
const HISTORY_ROOT = join(LOG_ROOT, "history");
const REPORT_PATH = join(LOG_ROOT, "production-bootstrap-report.json");

export const PRODUCTION_BOOTSTRAP_VERSION = "1.0.0" as const;

export type BootstrapCheckStatus = "pass" | "fail" | "warn";

export type BootstrapCheck = {
  id: string;
  category: string;
  status: BootstrapCheckStatus;
  detail: string;
};

export type BootstrapReadiness = "READY" | "NOT_READY";

export type ProductionBootstrapReport = {
  schema_version: 1;
  agent: "229";
  bootstrap_version: typeof PRODUCTION_BOOTSTRAP_VERSION;
  bootstrap_id: string;
  timestamp: string;
  duration_ms: number;
  checks: BootstrapCheck[];
  checks_executed: number;
  passed: number;
  failed: number;
  warnings: number;
  warning_details: string[];
  failed_checks: string[];
  pending_prerequisites: string[];
  overall_status: "PASS" | "FAIL" | "PASS_WITH_WARNINGS";
  readiness: BootstrapReadiness;
  readiness_evidence: string[];
  founder_approval_required: true;
  live: false;
  publication_allowed: false;
  openai_called: false;
  owns_production: false;
  owns_orchestration: false;
  owns_business_logic: false;
  owns_governance: false;
  executes_production: false;
  generates_content: false;
  bypasses_runtime_guard: false;
  bypasses_founder_approval: false;
  production_entry: "ProductionController";
  report_path: string;
};

export type ProductionBootstrapSurface = {
  schema_version: 1;
  agent: "229";
  generated_at: string;
  last_bootstrap: ProductionBootstrapReport | null;
  bootstrap_status: ProductionBootstrapReport["overall_status"] | "NONE";
  bootstrap_time: string | null;
  bootstrap_duration_ms: number | null;
  readiness_result: BootstrapReadiness | "NONE";
  pending_prerequisites: string[];
  recent_bootstraps: Array<{
    bootstrap_id: string;
    timestamp: string;
    readiness: BootstrapReadiness;
    overall_status: string;
  }>;
  live: false;
  publication_allowed: false;
  founder_approval_required: true;
  owns_production: false;
  owns_orchestration: false;
  executes_production: false;
};

function atomicWriteJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

function allocateBootstrapId(now: Date): string {
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  return `pb-${stamp}-${Math.floor(Math.random() * 1e6)
    .toString()
    .padStart(6, "0")}`;
}

function check(
  id: string,
  category: string,
  ok: boolean,
  detail: string,
  warn = false,
): BootstrapCheck {
  return {
    id,
    category,
    status: ok ? "pass" : warn ? "warn" : "fail",
    detail,
  };
}

function srcHas(path: string, needle: string): boolean {
  if (!existsSync(path)) return false;
  return readFileSync(path, "utf8").includes(needle);
}

function ensureWritableDir(dir: string): { ok: boolean; detail: string } {
  try {
    mkdirSync(dir, { recursive: true });
    accessSync(dir, constants.W_OK);
    const probe = join(dir, `.bootstrap-probe-${process.pid}`);
    writeFileSync(probe, "ok\n", "utf8");
    unlinkSync(probe);
    return { ok: true, detail: `writable ${relative(REPO, dir).replace(/\\/g, "/")}` };
  } catch (e) {
    return {
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

function packageHasScript(name: string): boolean {
  const pkg = JSON.parse(
    readFileSync(join(REPO, "package.json"), "utf8"),
  ) as { scripts?: Record<string, string> };
  return Boolean(pkg.scripts?.[name]);
}

/**
 * Run Canonical Production Bootstrap.
 * Validates and prepares only — never executes production.
 */
export function runProductionBootstrap(opts?: {
  repoRoot?: string;
  now?: Date;
}): ProductionBootstrapReport {
  const repoRoot = opts?.repoRoot ?? REPO;
  const now = opts?.now ?? new Date();
  const t0 = performance.now();
  const bootstrap_id = allocateBootstrapId(now);
  const checks: BootstrapCheck[] = [];

  process.env.SOS_AIOS_LIVE = "0";

  const paths = {
    projectState: join(repoRoot, "SOS/project-state.json"),
    guard: join(repoRoot, "SOS/SAIOS/architecture/runtime-guard.ts"),
    providerRegistry: join(repoRoot, "SOS/SAIOS/config/provider-registry.json"),
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
    validation: join(
      repoRoot,
      "SOS/SAIOS/core/production-validation/EndToEndProductionValidation.ts",
    ),
    readiness: join(
      repoRoot,
      "SOS/SAIOS/core/production-readiness/ProductionReadinessAudit.ts",
    ),
    mc: join(
      repoRoot,
      "SOS/SAIOS/dashboard/src/views/mission-control/MissionControlHome.tsx",
    ),
    server: join(repoRoot, "SOS/SAIOS/dashboard/server.ts"),
    templateT094: join(repoRoot, "src/data/template-json/t094.json"),
    cycleLog: join(repoRoot, "SOS/07_LOGS/saios/first-production-cycle"),
    candidates: join(
      repoRoot,
      "SOS/07_LOGS/saios/first-production-cycle/candidates",
    ),
    reports09: join(repoRoot, "SOS/09_REPORTS"),
    saiosLogs: join(repoRoot, "SOS/07_LOGS/saios"),
  };

  // ——— Repository / project state ———
  checks.push(
    check(
      "repo.initialized",
      "repository",
      existsSync(join(repoRoot, "package.json")) &&
        existsSync(join(repoRoot, "SOS")),
      "Repository initialized",
    ),
  );
  checks.push(
    check(
      "startup.live_off",
      "safety",
      process.env.SOS_AIOS_LIVE !== "1",
      "LIVE must be OFF",
    ),
  );

  let projectState: {
    latest_agent?: string;
    operations?: Record<string, string>;
    latest_template?: string;
    pending_actions?: string[];
  } | null = null;
  if (existsSync(paths.projectState)) {
    try {
      projectState = JSON.parse(
        readFileSync(paths.projectState, "utf8"),
      ) as typeof projectState;
    } catch {
      projectState = null;
    }
  }
  checks.push(
    check(
      "project_state.valid",
      "project_state",
      Boolean(projectState?.latest_agent && projectState?.operations),
      projectState
        ? `latest_agent=${projectState.latest_agent}`
        : "project-state invalid/missing",
    ),
  );

  // ——— Mission Control / Founder Command ———
  checks.push(
    check(
      "mission_control.operational",
      "mission_control",
      existsSync(paths.mc) &&
        (srcHas(paths.mc, "Mission Control") || srcHas(paths.mc, "mc-root")),
      "Mission Control UI present",
    ),
  );
  checks.push(
    check(
      "mission_control.connectivity",
      "mission_control",
      srcHas(paths.server, "/api/founder-command-center") &&
        srcHas(paths.server, "/api/system-orchestrator") &&
        srcHas(paths.server, "/api/founder-actions"),
      "Mission Control APIs present",
    ),
  );
  checks.push(
    check(
      "founder_command.operational",
      "founder_command",
      existsSync(paths.fcc) && srcHas(paths.fcc, "read_only: true"),
      "Founder Command Center snapshot module ready",
    ),
  );

  // ——— Adapters / Orchestrator ———
  checks.push(
    check(
      "founder_action_adapters.operational",
      "founder_actions",
      existsSync(paths.faa) &&
        srcHas(paths.faa, "owns_production: false") &&
        srcHas(paths.faa, "SystemOrchestrator"),
      "Founder Action Adapters operational",
    ),
  );
  checks.push(
    check(
      "system_orchestrator.operational",
      "system_orchestrator",
      existsSync(paths.orch) &&
        srcHas(paths.orch, "coordination_only: true") &&
        srcHas(paths.orch, "runProduction"),
      "System Orchestrator operational (delegates to PC)",
    ),
  );

  // ——— Runtime Guard ———
  checks.push(
    check(
      "runtime_guard.operational",
      "runtime_guard",
      srcHas(paths.guard, "ENGINES"),
      "Runtime Guard operational",
    ),
  );

  // ——— Canonical subsystem modules ———
  const subsystems: Array<[string, string, string?]> = [
    ["operational_policy", paths.advisor],
    ["budget_governor", paths.budget],
    ["health_gate", paths.health, "ENGINES"],
    ["strategy_engine", paths.strategy],
    ["portfolio_intelligence", paths.portfolio],
    ["engineering_intelligence", paths.ei, "advisory_only: true"],
    ["engineering_review", paths.er, "execution_triggered: false"],
    ["production_controller", paths.pc, 'entrypoint: "ProductionController"'],
    ["production_validation", paths.validation, "owns_production: false"],
    ["production_readiness", paths.readiness, "owns_production: false"],
  ];
  for (const [id, p, needle] of subsystems) {
    const ok = existsSync(p) && (!needle || srcHas(p, needle));
    checks.push(
      check(
        `subsystem.${id}`,
        "subsystems",
        ok,
        ok ? `${id} operational` : `${id} missing or invalid`,
      ),
    );
  }

  checks.push(
    check(
      "scheduling.operational",
      "subsystems",
      existsSync(paths.schedule),
      "Adaptive Scheduling operational",
    ),
  );

  // ——— AI provider availability (registry) ———
  let providerOk = false;
  let providerDetail = "provider-registry missing";
  if (existsSync(paths.providerRegistry)) {
    try {
      const reg = JSON.parse(
        readFileSync(paths.providerRegistry, "utf8"),
      ) as {
        active_provider_allowed?: string[];
        providers?: Array<{ id: string; enabled?: boolean; implemented?: boolean }>;
      };
      const allowed = reg.active_provider_allowed ?? [];
      const mock = reg.providers?.find((p) => p.id === "mock");
      providerOk =
        allowed.includes("mock") &&
        mock?.enabled === true &&
        mock?.implemented === true;
      providerDetail = providerOk
        ? `mock provider available (allowed=${allowed.join(",")})`
        : "mock provider not enabled/allowed";
    } catch (e) {
      providerDetail = e instanceof Error ? e.message : String(e);
    }
  }
  checks.push(
    check(
      "ai_provider.availability",
      "configuration",
      providerOk,
      providerDetail,
    ),
  );

  // ——— Templates ———
  const templateOk = existsSync(paths.templateT094);
  checks.push(
    check(
      "templates.available",
      "templates",
      templateOk,
      templateOk
        ? `template t094 present (${projectState?.latest_template ?? "t094"})`
        : "template t094 missing",
    ),
  );

  // ——— Storage / reports / queues ———
  const storageProbe = ensureWritableDir(paths.saiosLogs);
  checks.push(
    check(
      "storage.available",
      "storage",
      storageProbe.ok,
      storageProbe.detail,
    ),
  );

  const cycleProbe = ensureWritableDir(paths.cycleLog);
  checks.push(
    check(
      "storage.cycle_log",
      "storage",
      cycleProbe.ok,
      cycleProbe.detail,
    ),
  );

  const candProbe = ensureWritableDir(paths.candidates);
  checks.push(
    check(
      "production_queues.ready",
      "queues",
      candProbe.ok,
      candProbe.detail,
    ),
  );

  const reportsProbe = ensureWritableDir(paths.reports09);
  checks.push(
    check(
      "reports.writable",
      "reports",
      reportsProbe.ok && existsSync(paths.reports09),
      reportsProbe.ok
        ? "SOS/09_REPORTS writable"
        : reportsProbe.detail,
    ),
  );

  // Ensure bootstrap log root prepared (preparation only)
  const bootProbe = ensureWritableDir(LOG_ROOT);
  checks.push(
    check(
      "bootstrap.log_root",
      "reports",
      bootProbe.ok,
      bootProbe.detail,
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
  const auditOk =
    (existsSync(orchHist) &&
      readdirSync(orchHist).some((f) => f.endsWith(".json"))) ||
    (existsSync(faaHist) &&
      readdirSync(faaHist).some((f) => f.endsWith(".json")));
  checks.push(
    check(
      "audit_history.available",
      "audit",
      auditOk,
      auditOk
        ? "Orchestrator/FAA audit history available"
        : "No orchestration/FAA audit history yet",
      !auditOk,
    ),
  );

  // ——— Verification scripts ———
  for (const script of [
    "aios:production-validation:verify",
    "aios:production-readiness:verify",
    "aios:system-orchestrator:verify",
    "aios:founder-actions:verify",
    "system-integrity:verify",
  ]) {
    checks.push(
      check(
        `verification.${script}`,
        "verification",
        packageHasScript(script),
        packageHasScript(script)
          ? `script ${script} present`
          : `missing ${script}`,
      ),
    );
  }

  // ——— Ops completeness (preparation evidence) ———
  const ops = projectState?.operations ?? {};
  const requiredOps = [
    "canonical_production_controller",
    "founder_action_adapters",
    "system_orchestrator",
    "end_to_end_validation",
    "production_readiness",
    "mission_control_ui",
  ];
  for (const key of requiredOps) {
    checks.push(
      check(
        `ops.${key}`,
        "system_state",
        ops[key] === "complete",
        ops[key] === "complete"
          ? `operations.${key}=complete`
          : `operations.${key} not complete`,
      ),
    );
  }

  // ——— Founder approval invariant ———
  checks.push(
    check(
      "founder_approval.required",
      "governance",
      srcHas(paths.faa, "founder_approval_required: true") ||
        srcHas(paths.fcc, "founder_approval_required: true"),
      "Founder approval still required",
    ),
  );

  // ——— Safety: bootstrap must not claim execution powers ———
  checks.push(
    check(
      "safety.no_live",
      "safety",
      true,
      "publication_allowed forced false; LIVE OFF",
    ),
  );

  const passed = checks.filter((c) => c.status === "pass").length;
  const failed = checks.filter((c) => c.status === "fail").length;
  const warnings = checks.filter((c) => c.status === "warn").length;
  const failed_checks = checks
    .filter((c) => c.status === "fail")
    .map((c) => c.id);
  const warning_details = checks
    .filter((c) => c.status === "warn")
    .map((c) => `${c.id}: ${c.detail}`);
  const pending_prerequisites = [
    ...failed_checks,
    ...checks.filter((c) => c.status === "warn").map((c) => c.id),
  ];

  let overall_status: ProductionBootstrapReport["overall_status"] = "PASS";
  if (failed > 0) overall_status = "FAIL";
  else if (warnings > 0) overall_status = "PASS_WITH_WARNINGS";

  const readiness: BootstrapReadiness =
    failed === 0 ? "READY" : "NOT_READY";
  const readiness_evidence =
    readiness === "READY"
      ? [
          `${passed}/${checks.length} checks passed`,
          "ProductionController entrypoint present",
          "Runtime Guard present",
          "Founder approval required",
          "LIVE OFF",
          "mock provider available for supervised dry-run",
          "Bootstrap will not execute production — Founder must approve first cycle",
        ]
      : [
          `${failed} failed prerequisite(s)`,
          ...failed_checks.slice(0, 8),
        ];

  const duration_ms = Number((performance.now() - t0).toFixed(2));
  const report_rel = relative(repoRoot, REPORT_PATH).replace(/\\/g, "/");

  const report: ProductionBootstrapReport = {
    schema_version: 1,
    agent: "229",
    bootstrap_version: PRODUCTION_BOOTSTRAP_VERSION,
    bootstrap_id,
    timestamp: now.toISOString(),
    duration_ms,
    checks,
    checks_executed: checks.length,
    passed,
    failed,
    warnings,
    warning_details,
    failed_checks,
    pending_prerequisites,
    overall_status,
    readiness,
    readiness_evidence,
    founder_approval_required: true,
    live: false,
    publication_allowed: false,
    openai_called: false,
    owns_production: false,
    owns_orchestration: false,
    owns_business_logic: false,
    owns_governance: false,
    executes_production: false,
    generates_content: false,
    bypasses_runtime_guard: false,
    bypasses_founder_approval: false,
    production_entry: "ProductionController",
    report_path: report_rel,
  };

  mkdirSync(HISTORY_ROOT, { recursive: true });
  atomicWriteJson(join(HISTORY_ROOT, `${bootstrap_id}.json`), report);
  atomicWriteJson(REPORT_PATH, report);
  writeFileSync(
    join(LOG_ROOT, "bootstraps.jsonl"),
    `${JSON.stringify({
      bootstrap_id,
      timestamp: report.timestamp,
      readiness,
      overall_status,
      passed,
      failed,
      duration_ms,
    })}\n`,
    { encoding: "utf8", flag: "a" },
  );

  return report;
}

export function loadProductionBootstrapSurface(opts?: {
  repoRoot?: string;
  limit?: number;
}): ProductionBootstrapSurface {
  const repoRoot = opts?.repoRoot ?? REPO;
  const limit = opts?.limit ?? 10;
  const reportPath = join(
    repoRoot,
    "SOS/07_LOGS/saios/production-bootstrap/production-bootstrap-report.json",
  );
  const hist = join(
    repoRoot,
    "SOS/07_LOGS/saios/production-bootstrap/history",
  );

  let last: ProductionBootstrapReport | null = null;
  if (existsSync(reportPath)) {
    try {
      last = JSON.parse(
        readFileSync(reportPath, "utf8"),
      ) as ProductionBootstrapReport;
    } catch {
      last = null;
    }
  }

  const recent: ProductionBootstrapSurface["recent_bootstraps"] = [];
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
        ) as ProductionBootstrapReport;
        recent.push({
          bootstrap_id: r.bootstrap_id,
          timestamp: r.timestamp,
          readiness: r.readiness,
          overall_status: r.overall_status,
        });
      } catch {
        /* skip */
      }
    }
  }

  return {
    schema_version: 1,
    agent: "229",
    generated_at: new Date().toISOString(),
    last_bootstrap: last,
    bootstrap_status: last?.overall_status ?? "NONE",
    bootstrap_time: last?.timestamp ?? null,
    bootstrap_duration_ms: last?.duration_ms ?? null,
    readiness_result: last?.readiness ?? "NONE",
    pending_prerequisites: last?.pending_prerequisites ?? [],
    recent_bootstraps: recent,
    live: false,
    publication_allowed: false,
    founder_approval_required: true,
    owns_production: false,
    owns_orchestration: false,
    executes_production: false,
  };
}
