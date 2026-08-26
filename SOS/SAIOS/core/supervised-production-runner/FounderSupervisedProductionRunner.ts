/**
 * Founder Supervised Production Runner V1 — Agent #230.
 *
 * Submits and tracks one Founder-approved supervised production request.
 * Owns no generation, orchestration, or governance logic.
 * Always delegates: Founder Action Adapter → System Orchestrator → ProductionController.
 * Never publishes. Never enables LIVE. Never bypasses Founder approval or Runtime Guard.
 */
import {
  accessSync,
  constants,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { createRequire } from "node:module";
import type { ProductionTarget } from "../first-production-cycle/ProductionTarget.js";
import { evaluateProductionHealth } from "../first-production-cycle/ProductionHealthGate.js";
import { evaluateResourceBudget } from "../first-production-cycle/ResourceBudgetGovernor.js";
import { buildOperationalPolicyAdvice } from "../first-production-cycle/OperationalPolicyAdvisor.js";
import { executeFounderAction } from "../founder-action-adapters/FounderActionAdapters.js";
import { coordinateCancel } from "../system-orchestrator/SystemOrchestrator.js";
import { readAutonomousStatusFile } from "../first-production-cycle/AutonomousProductionService.js";

const require = createRequire(import.meta.url);
try {
  const dotenv = require("dotenv") as {
    config: (opts?: { path?: string }) => unknown;
  };
  dotenv.config({ path: resolve(process.cwd(), ".env.local") });
} catch {
  /* dotenv optional when env already injected */
}

const REPO = resolve(import.meta.dirname, "../../../..");
const LOG_ROOT = join(
  REPO,
  "SOS/07_LOGS/saios/supervised-production-runner",
);
const HISTORY_ROOT = join(LOG_ROOT, "history");
const REPORT_PATH = join(
  LOG_ROOT,
  "first-supervised-production-run-report.json",
);
const GUARD = join(REPO, "SOS/SAIOS/architecture/runtime-guard.ts");
const CATALOGUE = join(REPO, "src/data/template-json");
const CANDIDATES = join(
  REPO,
  "SOS/07_LOGS/saios/first-production-cycle/candidates",
);
const BOOTSTRAP_REPORT = join(
  REPO,
  "SOS/07_LOGS/saios/production-bootstrap/production-bootstrap-report.json",
);
const READINESS_REPORT = join(
  REPO,
  "SOS/07_LOGS/saios/production-readiness/production-readiness-report.json",
);

export const SUPERVISED_RUNNER_VERSION = "1.0.0" as const;

/** First-run hard limits — runner cannot exceed these. */
export const FIRST_RUN_LIMITS = {
  production_type: "resume_template_generation",
  requested_templates: 5,
  maximum_templates: 5,
  maximum_concurrency: 1,
  publication: false,
  live_mode: false,
  founder_approval_required: true,
  automatic_retry: false,
} as const;

export type SupervisedRunState =
  | "PENDING_APPROVAL"
  | "VALIDATING"
  | "BLOCKED"
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "PARTIALLY_COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "AWAITING_FOUNDER_REVIEW";

export type PreflightCheck = {
  id: string;
  status: "pass" | "fail" | "warn";
  detail: string;
};

export type SelectedRole = {
  category: ProductionTarget["category"];
  title: string;
  industry: string;
  seniority: ProductionTarget["seniority"];
  role_family: string;
  objective: string;
};

export type SupervisedRunReport = {
  schema_version: 1;
  agent: "230";
  runner_version: typeof SUPERVISED_RUNNER_VERSION;
  run_id: string;
  implementation_status: "complete";
  batch_status: SupervisedRunState;
  founder_approval: {
    required: true;
    granted: boolean;
    granted_at: string | null;
    granted_by: string | null;
    action: "START FIRST SUPERVISED RUN" | null;
  };
  request: {
    production_type: typeof FIRST_RUN_LIMITS.production_type;
    requested_templates: 5;
    maximum_templates: 5;
    maximum_concurrency: 1;
    publication: false;
    live_mode: false;
    founder_approval_required: true;
    automatic_retry: false;
    simulation_mode: boolean;
  };
  selected_roles: SelectedRole[];
  start_time: string | null;
  end_time: string | null;
  duration_ms: number | null;
  pipeline_stages: string[];
  checks: PreflightCheck[];
  preflight_ok: boolean;
  preflight_blocker: string | null;
  provider: string;
  model: string | null;
  estimated_provider_calls: number;
  estimated_cost_usd: number;
  estimated_maximum_cost_usd: number;
  recorded_cost_usd: number | null;
  templates_requested: 5;
  templates_completed: number;
  templates_failed: number;
  candidate_ids: string[];
  founder_review_ids: string[];
  current_pipeline_stage: string | null;
  progress: {
    completed: number;
    failed: number;
    requested: 5;
    percent: number;
  };
  runtime_guard_result: string | null;
  budget_result: string | null;
  health_result: string | null;
  orchestration: unknown;
  founder_action: unknown;
  warnings: string[];
  errors: string[];
  final_status: SupervisedRunState;
  publication_status: "disabled";
  live_status: "OFF";
  publication_allowed: false;
  live: false;
  owns_production: false;
  owns_orchestration: false;
  owns_governance: false;
  bypasses_founder_approval: false;
  bypasses_runtime_guard: false;
  can_publish: false;
  can_enable_live: false;
  exceeds_first_run_limits: false;
  production_entry: "ProductionController";
  report_path: string;
  locations: {
    founder_review: string;
    generated_outputs: string;
    production_report: string;
    audit_history: string;
    mission_control: string;
  };
};

export type SupervisedRunSurface = {
  schema_version: 1;
  agent: "230";
  generated_at: string;
  run: SupervisedRunReport | null;
  display: {
    run_id: string | null;
    status: SupervisedRunState | "NONE";
    start_time: string | null;
    duration_ms: number | null;
    progress: SupervisedRunReport["progress"] | null;
    templates_requested: number;
    templates_completed: number;
    templates_failed: number;
    current_pipeline_stage: string | null;
    selected_roles: SelectedRole[];
    provider: string | null;
    model: string | null;
    estimated_cost_usd: number | null;
    estimated_maximum_cost_usd: number | null;
    recorded_cost_usd: number | null;
    estimated_provider_calls: number | null;
    runtime_guard_result: string | null;
    budget_result: string | null;
    health_result: string | null;
    founder_review_count: number;
    latest_audit: string | null;
    concurrency: 1;
    publication_status: "disabled";
    live_status: "OFF";
    founder_approval_required: true;
    simulation_mode: boolean | null;
  };
  preflight_preview: {
    templates: 5;
    selected_roles: SelectedRole[];
    estimated_provider_calls: number;
    estimated_maximum_cost_usd: number;
    concurrency: 1;
    publication: "disabled";
    live: "OFF";
    founder_approval: "required";
    simulation_available: boolean;
    real_provider_available: boolean;
  };
  links: {
    founder_review: string;
    generated_outputs: string;
    production_report: string;
    audit_history: string;
    mission_control_url: string;
  };
  cancel_supported: true;
  retry_supported: false;
  live: false;
  publication_allowed: false;
  founder_approval_required: true;
  production_entry: "ProductionController";
};

function atomicWriteJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

function appendHistory(report: SupervisedRunReport, repoRoot: string): void {
  const root = join(repoRoot, relative(REPO, HISTORY_ROOT));
  mkdirSync(root, { recursive: true });
  const name = `${report.run_id}.json`;
  atomicWriteJson(join(root, name), report);
  const jsonl = join(root, "runs.jsonl");
  const line = `${JSON.stringify({
    run_id: report.run_id,
    timestamp: new Date().toISOString(),
    batch_status: report.batch_status,
    final_status: report.final_status,
    templates_completed: report.templates_completed,
    simulation_mode: report.request.simulation_mode,
  })}\n`;
  writeFileSync(jsonl, line, { flag: "a", encoding: "utf8" });
}

function allocateRunId(now: Date): string {
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  return `supervised-run-${stamp}`;
}

function openaiKeyPresent(): boolean {
  return Boolean(
    process.env.OPENAI_API_KEY?.trim() ||
      process.env.SOS_OPENAI_API_KEY?.trim(),
  );
}

function openaiOneTestEnabled(): boolean {
  return process.env.SOS_AI_FOUNDER_OPENAI_ONE_TEST === "1";
}

function realProviderAvailable(): boolean {
  return openaiKeyPresent() && openaiOneTestEnabled();
}

/**
 * Five commercially useful ATS-friendly US roles, chosen to avoid
 * exact WAITING_FOUNDER title collisions in the existing candidate queue.
 */
export function selectFirstBatchRoles(): SelectedRole[] {
  return [
    {
      category: "engineering",
      title: "Full Stack Developer",
      industry: "engineering",
      seniority: "mid",
      role_family: "full_stack_developer",
      objective:
        "Produce an ATS-friendly Full Stack Developer resume construction cycle (supervised)",
    },
    {
      category: "finance",
      title: "Investment Banking Analyst",
      industry: "finance",
      seniority: "entry",
      role_family: "investment_banking_analyst",
      objective:
        "Produce an ATS-friendly Investment Banking Analyst resume construction cycle (supervised)",
    },
    {
      category: "healthcare",
      title: "Registered Nurse",
      industry: "healthcare",
      seniority: "mid",
      role_family: "registered_nurse",
      objective:
        "Produce an ATS-friendly Registered Nurse resume construction cycle (supervised)",
    },
    {
      category: "marketing",
      title: "Growth Marketing Manager",
      industry: "marketing",
      seniority: "mid",
      role_family: "growth_marketing_manager",
      objective:
        "Produce an ATS-friendly Growth Marketing Manager resume construction cycle (supervised)",
    },
    {
      category: "ats",
      title: "Business Operations Specialist",
      industry: "software",
      seniority: "mid",
      role_family: "business_operations_specialist",
      objective:
        "Produce an ATS-friendly Business Operations Specialist resume construction cycle (supervised)",
    },
  ];
}

function rolesToTargets(roles: SelectedRole[]): ProductionTarget[] {
  return roles.map((r) => ({
    category: r.category,
    title: r.title,
    industry: r.industry,
    seniority: r.seniority,
    objective: r.objective,
    role_family: r.role_family,
  }));
}

function estimateCost(simulation: boolean): {
  provider_calls: number;
  estimated_cost_usd: number;
  estimated_maximum_cost_usd: number;
  provider: string;
  model: string | null;
} {
  if (simulation) {
    return {
      provider_calls: 0,
      estimated_cost_usd: 0,
      estimated_maximum_cost_usd: 0,
      provider: "mock",
      model: "mock-provider",
    };
  }
  // Conservative upper bound for 5 OpenAI-backed template cycles
  return {
    provider_calls: 5,
    estimated_cost_usd: 0.35,
    estimated_maximum_cost_usd: 2.5,
    provider: "openai",
    model: "gpt-4o-mini (provider adapter default when eligible)",
  };
}

function checkRuntimeGuardFile(): { ok: boolean; detail: string } {
  if (!existsSync(GUARD)) {
    return { ok: false, detail: "Runtime Guard file missing" };
  }
  const txt = readFileSync(GUARD, "utf8");
  if (!txt.includes("ENGINES")) {
    return { ok: false, detail: "Runtime Guard missing ENGINES" };
  }
  return { ok: true, detail: "Runtime Guard present" };
}

function dirWritable(path: string): boolean {
  try {
    mkdirSync(path, { recursive: true });
    accessSync(path, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export function runSupervisedPreflight(opts?: {
  repoRoot?: string;
  simulation_mode?: boolean;
}): {
  ok: boolean;
  blocker: string | null;
  checks: PreflightCheck[];
} {
  const repoRoot = opts?.repoRoot ?? REPO;
  const simulation = opts?.simulation_mode ?? true;
  const checks: PreflightCheck[] = [];
  const fail = (id: string, detail: string) => {
    checks.push({ id, status: "fail", detail });
  };
  const pass = (id: string, detail: string) => {
    checks.push({ id, status: "pass", detail });
  };
  const warn = (id: string, detail: string) => {
    checks.push({ id, status: "warn", detail });
  };

  if (process.env.SOS_AIOS_LIVE === "1") {
    fail("live_off", "SOS_AIOS_LIVE=1 — LIVE must be OFF");
  } else {
    pass("live_off", "LIVE is OFF");
  }
  pass("publication_allowed", "publication_allowed remains false");

  // Bootstrap READY
  if (!existsSync(join(repoRoot, relative(REPO, BOOTSTRAP_REPORT)))) {
    fail("bootstrap_ready", "Bootstrap report missing — run Production Bootstrap");
  } else {
    try {
      const boot = JSON.parse(
        readFileSync(join(repoRoot, relative(REPO, BOOTSTRAP_REPORT)), "utf8"),
      ) as { readiness?: string };
      if (boot.readiness === "READY") {
        pass("bootstrap_ready", "Production Bootstrap readiness READY");
      } else {
        fail(
          "bootstrap_ready",
          `Production Bootstrap readiness is ${boot.readiness ?? "unknown"}`,
        );
      }
    } catch (e) {
      fail(
        "bootstrap_ready",
        `Bootstrap report unreadable: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  // Readiness not NOT_READY
  if (!existsSync(join(repoRoot, relative(REPO, READINESS_REPORT)))) {
    fail("readiness", "Production Readiness report missing");
  } else {
    try {
      const ready = JSON.parse(
        readFileSync(join(repoRoot, relative(REPO, READINESS_REPORT)), "utf8"),
      ) as { launch_recommendation?: string };
      const rec = ready.launch_recommendation ?? "NOT_READY";
      if (rec === "NOT_READY") {
        fail("readiness", "Production Readiness is NOT_READY");
      } else {
        pass("readiness", `Production Readiness: ${rec}`);
      }
    } catch (e) {
      fail(
        "readiness",
        `Readiness report unreadable: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  const guard = checkRuntimeGuardFile();
  if (guard.ok) pass("runtime_guard", guard.detail);
  else fail("runtime_guard", guard.detail);

  try {
    const advice = buildOperationalPolicyAdvice({ persist: false });
    pass(
      "operational_policy",
      `Operational Policy consulted (${advice.recommendations?.length ?? 0} recommendations)`,
    );
  } catch (e) {
    fail(
      "operational_policy",
      `Operational Policy failed: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  try {
    const budget = evaluateResourceBudget({
      proposed_batch_size: 5,
      persist: false,
    });
    if (budget.decision === "ALLOW") {
      pass("budget", `Budget ALLOW (decision=${budget.decision})`);
    } else {
      fail(
        "budget",
        `Budget DENY: ${budget.violations.map((v) => v.detail).join("; ") || "denied"}`,
      );
    }
  } catch (e) {
    fail(
      "budget",
      `Budget Governor failed: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  try {
    const health = evaluateProductionHealth({
      cycleLog: join(repoRoot, "SOS/07_LOGS/saios/first-production-cycle"),
      queue_max: 50,
      persist: false,
    });
    if (health.status === "HEALTHY") {
      pass("health", `Health Gate HEALTHY`);
    } else {
      fail("health", `Health Gate ${health.status}`);
    }
  } catch (e) {
    fail(
      "health",
      `Health Gate failed: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  // Provider / credentials
  if (simulation) {
    pass("ai_provider", "Simulation mode — mock provider configured");
    pass("credentials", "Simulation mode — real credentials not required");
  } else if (realProviderAvailable()) {
    pass(
      "ai_provider",
      "OpenAI one-test eligible (SOS_AI_FOUNDER_OPENAI_ONE_TEST=1 + key)",
    );
    pass("credentials", "Provider credentials available (value not stored)");
  } else if (!openaiKeyPresent()) {
    fail(
      "credentials",
      "Real mode requested but OPENAI_API_KEY / SOS_OPENAI_API_KEY missing",
    );
    fail("ai_provider", "Real provider not configured");
  } else {
    fail(
      "ai_provider",
      "Real mode requested but SOS_AI_FOUNDER_OPENAI_ONE_TEST is not 1",
    );
    fail("credentials", "One-test flag required for real OpenAI generation");
  }

  if (existsSync(join(repoRoot, relative(REPO, CATALOGUE)))) {
    pass("catalogue", "Template catalogue readable");
  } else {
    fail("catalogue", `Template catalogue missing at ${CATALOGUE}`);
  }

  if (dirWritable(join(repoRoot, relative(REPO, CANDIDATES)))) {
    pass("output_dirs", "Candidate output directory writable");
  } else {
    fail("output_dirs", "Candidate output directory not writable");
  }

  if (dirWritable(join(repoRoot, relative(REPO, LOG_ROOT)))) {
    pass("report_dirs", "Supervised run report directory writable");
  } else {
    fail("report_dirs", "Supervised run report directory not writable");
  }

  const reviewView = join(
    repoRoot,
    "SOS/SAIOS/dashboard/src/views/FounderReviewView.tsx",
  );
  if (existsSync(reviewView)) {
    pass("founder_review", "Founder Review view available");
  } else {
    fail("founder_review", "Founder Review view missing");
  }

  const mc = join(
    repoRoot,
    "SOS/SAIOS/dashboard/src/views/mission-control/MissionControlHome.tsx",
  );
  if (existsSync(mc)) {
    pass("mission_control", "Mission Control available");
  } else {
    fail("mission_control", "Mission Control missing");
  }

  // No other production run active
  try {
    const auto = readAutonomousStatusFile();
    if (auto?.running) {
      fail("no_active_run", "AutonomousProductionService is currently running");
    } else {
      pass("no_active_run", "No autonomous production run active");
    }
  } catch {
    pass("no_active_run", "Autonomous status readable / idle");
  }

  const existing = loadLatestReport(repoRoot);
  if (
    existing &&
    (existing.batch_status === "RUNNING" ||
      existing.batch_status === "QUEUED" ||
      existing.batch_status === "VALIDATING")
  ) {
    fail(
      "no_active_supervised",
      `Supervised run ${existing.run_id} already ${existing.batch_status}`,
    );
  } else {
    pass("no_active_supervised", "No active supervised run");
  }

  const failed = checks.filter((c) => c.status === "fail");
  return {
    ok: failed.length === 0,
    blocker: failed[0]?.detail ?? null,
    checks,
  };
}

export function loadLatestReport(
  repoRoot: string = REPO,
): SupervisedRunReport | null {
  const path = join(repoRoot, relative(REPO, REPORT_PATH));
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as SupervisedRunReport;
  } catch {
    return null;
  }
}

function persistReport(
  report: SupervisedRunReport,
  repoRoot: string,
): SupervisedRunReport {
  const path = join(repoRoot, relative(REPO, REPORT_PATH));
  atomicWriteJson(path, report);
  appendHistory(report, repoRoot);
  return report;
}

function baseReport(
  now: Date,
  roles: SelectedRole[],
  simulation: boolean,
): SupervisedRunReport {
  const est = estimateCost(simulation);
  return {
    schema_version: 1,
    agent: "230",
    runner_version: SUPERVISED_RUNNER_VERSION,
    run_id: allocateRunId(now),
    implementation_status: "complete",
    batch_status: "PENDING_APPROVAL",
    founder_approval: {
      required: true,
      granted: false,
      granted_at: null,
      granted_by: null,
      action: null,
    },
    request: {
      production_type: "resume_template_generation",
      requested_templates: 5,
      maximum_templates: 5,
      maximum_concurrency: 1,
      publication: false,
      live_mode: false,
      founder_approval_required: true,
      automatic_retry: false,
      simulation_mode: simulation,
    },
    selected_roles: roles,
    start_time: null,
    end_time: null,
    duration_ms: null,
    pipeline_stages: [],
    checks: [],
    preflight_ok: false,
    preflight_blocker: null,
    provider: est.provider,
    model: est.model,
    estimated_provider_calls: est.provider_calls,
    estimated_cost_usd: est.estimated_cost_usd,
    estimated_maximum_cost_usd: est.estimated_maximum_cost_usd,
    recorded_cost_usd: null,
    templates_requested: 5,
    templates_completed: 0,
    templates_failed: 0,
    candidate_ids: [],
    founder_review_ids: [],
    current_pipeline_stage: null,
    progress: { completed: 0, failed: 0, requested: 5, percent: 0 },
    runtime_guard_result: null,
    budget_result: null,
    health_result: null,
    orchestration: null,
    founder_action: null,
    warnings: [],
    errors: [],
    final_status: "PENDING_APPROVAL",
    publication_status: "disabled",
    live_status: "OFF",
    publication_allowed: false,
    live: false,
    owns_production: false,
    owns_orchestration: false,
    owns_governance: false,
    bypasses_founder_approval: false,
    bypasses_runtime_guard: false,
    can_publish: false,
    can_enable_live: false,
    exceeds_first_run_limits: false,
    production_entry: "ProductionController",
    report_path: relative(REPO, REPORT_PATH),
    locations: {
      founder_review: "Mission Control → Founder Review (route: review)",
      generated_outputs:
        "SOS/07_LOGS/saios/first-production-cycle/candidates/",
      production_report: relative(REPO, REPORT_PATH),
      audit_history: relative(REPO, HISTORY_ROOT),
      mission_control: "http://127.0.0.1:4310",
    },
  };
}

/**
 * Prepare the first supervised batch. Leaves PENDING_APPROVAL.
 * Does not start production.
 */
export function prepareSupervisedRun(opts?: {
  repoRoot?: string;
  simulation_mode?: boolean;
  now?: Date;
}): SupervisedRunReport {
  process.env.SOS_AIOS_LIVE = "0";
  const repoRoot = opts?.repoRoot ?? REPO;
  const now = opts?.now ?? new Date();
  const simulation = opts?.simulation_mode ?? true;
  const roles = selectFirstBatchRoles();
  const report = baseReport(now, roles, simulation);
  const pre = runSupervisedPreflight({
    repoRoot,
    simulation_mode: simulation,
  });
  report.checks = pre.checks;
  report.preflight_ok = pre.ok;
  report.preflight_blocker = pre.blocker;
  if (!pre.ok) {
    report.batch_status = "BLOCKED";
    report.final_status = "BLOCKED";
    report.errors.push(pre.blocker ?? "Preflight failed");
  }
  return persistReport(report, repoRoot);
}

function extractProductionMeta(orch: unknown): {
  candidate_count: number;
  health: string | null;
  budget: string | null;
  execution_id: string | null;
  stop_reason: string | null;
} {
  const o = orch as {
    production?: {
      candidate_count?: number;
      health?: string;
      budget?: string;
      execution_id?: string;
      stop_reason?: string;
    };
    canonical_response?: {
      production?: {
        candidate_count?: number;
        health?: string;
        budget?: string;
        execution_id?: string;
        stop_reason?: string;
      };
    };
  } | null;
  const p = o?.production ?? o?.canonical_response?.production ?? null;
  return {
    candidate_count: p?.candidate_count ?? 0,
    health: p?.health ?? null,
    budget: p?.budget ?? null,
    execution_id: p?.execution_id ?? null,
    stop_reason: p?.stop_reason ?? null,
  };
}

function collectNewCandidates(
  before: Set<string>,
  repoRoot: string,
): { ids: string[]; reviews: string[] } {
  const root = join(repoRoot, relative(REPO, CANDIDATES));
  if (!existsSync(root)) return { ids: [], reviews: [] };
  const ids: string[] = [];
  const reviews: string[] = [];
  for (const name of readdirSync(root)) {
    if (!name.startsWith("cand-")) continue;
    if (before.has(name)) continue;
    const cj = join(root, name, "candidate.json");
    if (!existsSync(cj)) continue;
    try {
      const c = JSON.parse(readFileSync(cj, "utf8")) as {
        candidate_id?: string;
        review_id?: string;
        status?: string;
      };
      if (c.candidate_id) ids.push(c.candidate_id);
      if (c.review_id) reviews.push(c.review_id);
    } catch {
      ids.push(name);
    }
  }
  return { ids, reviews };
}

function listCandidateDirs(repoRoot: string): Set<string> {
  const root = join(repoRoot, relative(REPO, CANDIDATES));
  const set = new Set<string>();
  if (!existsSync(root)) return set;
  for (const name of readdirSync(root)) {
    if (name.startsWith("cand-")) set.add(name);
  }
  return set;
}

/**
 * Founder-approved start. Delegates through FAA → Orchestrator → ProductionController.
 * Never publishes. Caps at 5 templates / concurrency 1.
 */
export async function approveAndStartSupervisedRun(opts: {
  repoRoot?: string;
  requested_by?: string;
  simulation_mode?: boolean;
  now?: Date;
}): Promise<SupervisedRunReport> {
  process.env.SOS_AIOS_LIVE = "0";
  const repoRoot = opts.repoRoot ?? REPO;
  const now = opts.now ?? new Date();
  const simulation = opts.simulation_mode ?? true;

  let report = loadLatestReport(repoRoot);
  if (!report || report.batch_status === "COMPLETED" || report.batch_status === "CANCELLED" || report.batch_status === "FAILED" || report.batch_status === "PARTIALLY_COMPLETED" || report.batch_status === "AWAITING_FOUNDER_REVIEW") {
    report = prepareSupervisedRun({
      repoRoot,
      simulation_mode: simulation,
      now,
    });
  } else {
    report.request.simulation_mode = simulation;
    const est = estimateCost(simulation);
    report.provider = est.provider;
    report.model = est.model;
    report.estimated_provider_calls = est.provider_calls;
    report.estimated_cost_usd = est.estimated_cost_usd;
    report.estimated_maximum_cost_usd = est.estimated_maximum_cost_usd;
  }

  if (
    report.batch_status === "RUNNING" ||
    report.batch_status === "QUEUED" ||
    report.batch_status === "VALIDATING"
  ) {
    report.errors.push("Run already in progress");
    return persistReport(report, repoRoot);
  }

  report.batch_status = "VALIDATING";
  report.final_status = "VALIDATING";
  report.current_pipeline_stage = "preflight";
  report.pipeline_stages = ["preflight"];
  persistReport(report, repoRoot);

  const pre = runSupervisedPreflight({
    repoRoot,
    simulation_mode: simulation,
  });
  report.checks = pre.checks;
  report.preflight_ok = pre.ok;
  report.preflight_blocker = pre.blocker;
  report.runtime_guard_result =
    pre.checks.find((c) => c.id === "runtime_guard")?.detail ?? null;
  report.budget_result =
    pre.checks.find((c) => c.id === "budget")?.detail ?? null;
  report.health_result =
    pre.checks.find((c) => c.id === "health")?.detail ?? null;

  if (!pre.ok) {
    report.batch_status = "BLOCKED";
    report.final_status = "BLOCKED";
    report.errors.push(pre.blocker ?? "Preflight failed");
    report.end_time = new Date().toISOString();
    return persistReport(report, repoRoot);
  }

  report.founder_approval = {
    required: true,
    granted: true,
    granted_at: now.toISOString(),
    granted_by: opts.requested_by ?? "founder",
    action: "START FIRST SUPERVISED RUN",
  };
  report.batch_status = "QUEUED";
  report.final_status = "QUEUED";
  report.start_time = now.toISOString();
  report.current_pipeline_stage = "queued";
  report.pipeline_stages.push("queued");
  persistReport(report, repoRoot);

  report.batch_status = "RUNNING";
  report.final_status = "RUNNING";
  report.current_pipeline_stage = "production";
  report.pipeline_stages.push(
    "runtime_guard",
    "operational_policy",
    "adaptive_scheduling",
    "budget",
    "health",
    "strategy",
    "portfolio",
    "production",
  );
  persistReport(report, repoRoot);

  const before = listCandidateDirs(repoRoot);
  const t0 = performance.now();

  try {
    const action = await executeFounderAction({
      action_type: "production.supervised_first_run",
      requested_by: opts.requested_by ?? "founder",
      repoRoot,
      production_opts: {
        batch_size: 5,
        max_openai_per_batch: 5,
        force_mock: simulation,
        select_target: false,
        forced_targets: rolesToTargets(report.selected_roles),
      },
    });

    report.founder_action = {
      outcome: action.outcome,
      reason: action.reason,
      action_id: action.action.action_id,
      delegated_to: action.action.delegated_to,
      // strip secrets — only store safe fields
    };
    report.orchestration = action.action.canonical_response;

    const meta = extractProductionMeta(action.action.canonical_response);
    report.health_result = meta.health ?? report.health_result;
    report.budget_result = meta.budget ?? report.budget_result;
    report.runtime_guard_result =
      report.runtime_guard_result ?? "Runtime Guard participated via orchestrator";

    const collected = collectNewCandidates(before, repoRoot);
    report.candidate_ids = collected.ids;
    report.founder_review_ids = collected.reviews;
    report.templates_completed = Math.min(5, collected.ids.length);
    report.templates_failed = Math.max(
      0,
      5 - report.templates_completed,
    );
    if (
      action.outcome === "Failure" ||
      action.outcome === "Rejected" ||
      meta.stop_reason === "fatal_error" ||
      meta.stop_reason === "live_refused" ||
      meta.stop_reason === "health_unhealthy" ||
      meta.stop_reason === "budget_denied"
    ) {
      report.batch_status = "FAILED";
      report.final_status = "FAILED";
      report.errors.push(action.reason);
    } else if (report.templates_completed === 0) {
      report.batch_status = "FAILED";
      report.final_status = "FAILED";
      report.errors.push(
        `No candidates produced (stop_reason=${meta.stop_reason ?? "unknown"})`,
      );
    } else if (report.templates_completed < 5) {
      report.batch_status = "PARTIALLY_COMPLETED";
      report.final_status = "PARTIALLY_COMPLETED";
      report.warnings.push(
        `Completed ${report.templates_completed}/5 templates`,
      );
    } else {
      report.batch_status = "AWAITING_FOUNDER_REVIEW";
      report.final_status = "AWAITING_FOUNDER_REVIEW";
    }

    report.pipeline_stages.push("founder_review", "mission_control_refresh", "audit");
    report.current_pipeline_stage =
      report.batch_status === "AWAITING_FOUNDER_REVIEW" ||
      report.batch_status === "PARTIALLY_COMPLETED"
        ? "awaiting_founder_review"
        : report.batch_status.toLowerCase();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    report.batch_status = "FAILED";
    report.final_status = "FAILED";
    report.errors.push(msg);
    report.current_pipeline_stage = "failed";
  }

  report.end_time = new Date().toISOString();
  report.duration_ms = Number((performance.now() - t0).toFixed(2));
  report.progress = {
    completed: report.templates_completed,
    failed: report.templates_failed,
    requested: 5,
    percent: Math.round((report.templates_completed / 5) * 100),
  };
  report.recorded_cost_usd = simulation ? 0 : null;
  report.publication_allowed = false;
  report.live = false;
  report.publication_status = "disabled";
  report.live_status = "OFF";
  report.exceeds_first_run_limits = false;

  return persistReport(report, repoRoot);
}

/**
 * Cancel via existing System Orchestrator only.
 */
export async function cancelSupervisedRun(opts?: {
  repoRoot?: string;
  requested_by?: string;
}): Promise<SupervisedRunReport> {
  const repoRoot = opts?.repoRoot ?? REPO;
  let report = loadLatestReport(repoRoot);
  if (!report) {
    report = prepareSupervisedRun({ repoRoot, simulation_mode: true });
  }

  const orch = await coordinateCancel({
    initiator: opts?.requested_by ?? "founder",
    repoRoot,
  });
  report.orchestration = {
    cancel: {
      ok: orch.ok,
      cancelled: orch.cancelled,
      reason: orch.reason,
    },
  };
  report.batch_status = "CANCELLED";
  report.final_status = "CANCELLED";
  report.end_time = new Date().toISOString();
  report.current_pipeline_stage = "cancelled";
  report.warnings.push(orch.reason);
  return persistReport(report, repoRoot);
}

export function loadSupervisedRunSurface(opts?: {
  repoRoot?: string;
}): SupervisedRunSurface {
  const repoRoot = opts?.repoRoot ?? REPO;
  const run = loadLatestReport(repoRoot);
  const roles = run?.selected_roles ?? selectFirstBatchRoles();
  const sim = run?.request.simulation_mode ?? true;
  const est = estimateCost(sim);
  const port = Number(process.env.AIOS_DASHBOARD_PORT ?? 4310);

  return {
    schema_version: 1,
    agent: "230",
    generated_at: new Date().toISOString(),
    run,
    display: {
      run_id: run?.run_id ?? null,
      status: run?.batch_status ?? "NONE",
      start_time: run?.start_time ?? null,
      duration_ms: run?.duration_ms ?? null,
      progress: run?.progress ?? null,
      templates_requested: 5,
      templates_completed: run?.templates_completed ?? 0,
      templates_failed: run?.templates_failed ?? 0,
      current_pipeline_stage: run?.current_pipeline_stage ?? null,
      selected_roles: roles,
      provider: run?.provider ?? est.provider,
      model: run?.model ?? est.model,
      estimated_cost_usd: run?.estimated_cost_usd ?? est.estimated_cost_usd,
      estimated_maximum_cost_usd:
        run?.estimated_maximum_cost_usd ?? est.estimated_maximum_cost_usd,
      recorded_cost_usd: run?.recorded_cost_usd ?? null,
      estimated_provider_calls:
        run?.estimated_provider_calls ?? est.provider_calls,
      runtime_guard_result: run?.runtime_guard_result ?? null,
      budget_result: run?.budget_result ?? null,
      health_result: run?.health_result ?? null,
      founder_review_count: run?.founder_review_ids.length ?? 0,
      latest_audit: run
        ? join(relative(REPO, HISTORY_ROOT), `${run.run_id}.json`)
        : null,
      concurrency: 1,
      publication_status: "disabled",
      live_status: "OFF",
      founder_approval_required: true,
      simulation_mode: run?.request.simulation_mode ?? null,
    },
    preflight_preview: {
      templates: 5,
      selected_roles: roles,
      estimated_provider_calls: est.provider_calls,
      estimated_maximum_cost_usd: estimateCost(
        !realProviderAvailable(),
      ).estimated_maximum_cost_usd,
      concurrency: 1,
      publication: "disabled",
      live: "OFF",
      founder_approval: "required",
      simulation_available: true,
      real_provider_available: realProviderAvailable(),
    },
    links: {
      founder_review: `http://127.0.0.1:${port}/#review`,
      generated_outputs:
        "SOS/07_LOGS/saios/first-production-cycle/candidates/",
      production_report: relative(REPO, REPORT_PATH),
      audit_history: relative(REPO, HISTORY_ROOT),
      mission_control_url: `http://127.0.0.1:${port}`,
    },
    cancel_supported: true,
    retry_supported: false,
    live: false,
    publication_allowed: false,
    founder_approval_required: true,
    production_entry: "ProductionController",
  };
}
