/**
 * Canonical Production Readiness Audit — Agent #228.
 *
 * Independent release certification. Reuses existing evidence only.
 * Owns audit only — never production, orchestration, business logic, or governance.
 * Never executes production, repairs failures, or alters architecture.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const REPO = resolve(import.meta.dirname, "../../../..");
const LOG_ROOT = join(REPO, "SOS/07_LOGS/saios/production-readiness");
const HISTORY_ROOT = join(LOG_ROOT, "history");
const REPORT_PATH = join(LOG_ROOT, "production-readiness-report.json");

export const PRODUCTION_READINESS_VERSION = "1.0.0" as const;

export type BlockerSeverity = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type LaunchRecommendation =
  | "READY_FOR_STAGING"
  | "READY_WITH_MINOR_ACTIONS"
  | "NOT_READY";

export type ReadinessScores = {
  architecture: number;
  governance: number;
  production: number;
  engineering: number;
  verification: number;
  performance: number;
  storage: number;
  security: number;
  documentation: number;
  overall: number;
};

export type ReadinessBlocker = {
  blocker_id: string;
  category: string;
  severity: BlockerSeverity;
  description: string;
  supporting_evidence: string[];
  impact: string;
  launch_blocking: boolean;
  recommended_action: string;
  requires_founder_approval: boolean;
};

export type AuditSourceRef = {
  id: string;
  path: string;
  available: boolean;
  detail: string;
};

export type ProductionReadinessReport = {
  schema_version: 1;
  agent: "228";
  audit_version: typeof PRODUCTION_READINESS_VERSION;
  audit_id: string;
  timestamp: string;
  duration_ms: number;
  scores: ReadinessScores;
  blockers: ReadinessBlocker[];
  blocker_counts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    none: number;
  };
  highest_blocker_level: BlockerSeverity;
  launch_recommendation: LaunchRecommendation;
  launch_rationale: string;
  sources: AuditSourceRef[];
  evidence_summary: Record<string, unknown>;
  live: false;
  publication_allowed: false;
  openai_called: false;
  owns_production: false;
  owns_orchestration: false;
  owns_business_logic: false;
  owns_governance: false;
  executes_production: false;
  modifies_architecture: false;
  regenerates_existing_reports: false;
  production_entry: "ProductionController";
  report_path: string;
};

export type ProductionReadinessSurface = {
  schema_version: 1;
  agent: "228";
  generated_at: string;
  last_audit: ProductionReadinessReport | null;
  overall_readiness: number | null;
  launch_recommendation: LaunchRecommendation | "NONE";
  critical_blockers: number;
  high_blockers: number;
  latest_audit_id: string | null;
  audit_age_minutes: number | null;
  recent_audits: Array<{
    audit_id: string;
    timestamp: string;
    overall: number;
    launch_recommendation: LaunchRecommendation;
  }>;
  live: false;
  publication_allowed: false;
  owns_production: false;
  owns_orchestration: false;
  owns_governance: false;
};

function atomicWriteJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

function allocateAuditId(now: Date): string {
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  return `pra-${stamp}-${Math.floor(Math.random() * 1e6)
    .toString()
    .padStart(6, "0")}`;
}

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

function sourceRef(
  id: string,
  absPath: string,
  repoRoot: string,
  detailWhenMissing: string,
): AuditSourceRef {
  const rel = relative(repoRoot, absPath).replace(/\\/g, "/");
  if (!existsSync(absPath)) {
    return {
      id,
      path: rel,
      available: false,
      detail: detailWhenMissing,
    };
  }
  return {
    id,
    path: rel,
    available: true,
    detail: "reused existing evidence",
  };
}

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return clampScore(nums.reduce((a, b) => a + b, 0) / nums.length);
}

/**
 * Build Production Readiness Audit from existing evidence only.
 * Does not regenerate Engineering Intelligence, Validation, or Integrity reports.
 */
export function buildProductionReadinessAudit(opts?: {
  repoRoot?: string;
  now?: Date;
}): ProductionReadinessReport {
  const repoRoot = opts?.repoRoot ?? REPO;
  const now = opts?.now ?? new Date();
  const t0 = performance.now();
  const audit_id = allocateAuditId(now);

  const paths = {
    validation: join(
      repoRoot,
      "SOS/07_LOGS/saios/production-validation/production-validation-report.json",
    ),
    engineering: join(
      repoRoot,
      "SOS/07_LOGS/saios/engineering-intelligence/engineering-intelligence-report.json",
    ),
    integrity: join(
      repoRoot,
      "SOS/07_LOGS/saios/architecture/system-integrity/verify-result.json",
    ),
    integrityScores: join(
      repoRoot,
      "SOS/SAIOS/architecture/system-integrity/SCORES.md",
    ),
    orchState: join(
      repoRoot,
      "SOS/07_LOGS/saios/system-orchestrator/orchestration-state.json",
    ),
    faaLatest: join(
      repoRoot,
      "SOS/07_LOGS/saios/founder-action-adapters/latest-action.json",
    ),
    advisor: join(
      repoRoot,
      "SOS/07_LOGS/saios/first-production-cycle/advisor/operational-policy-advice.json",
    ),
    projectState: join(repoRoot, "SOS/project-state.json"),
    guard: join(repoRoot, "SOS/SAIOS/architecture/runtime-guard.ts"),
    pc: join(
      repoRoot,
      "SOS/SAIOS/core/first-production-cycle/ProductionController.ts",
    ),
    orch: join(
      repoRoot,
      "SOS/SAIOS/core/system-orchestrator/SystemOrchestrator.ts",
    ),
    faa: join(
      repoRoot,
      "SOS/SAIOS/core/founder-action-adapters/FounderActionAdapters.ts",
    ),
    validationModule: join(
      repoRoot,
      "SOS/SAIOS/core/production-validation/EndToEndProductionValidation.ts",
    ),
    mc: join(
      repoRoot,
      "SOS/SAIOS/dashboard/src/views/mission-control/MissionControlHome.tsx",
    ),
    eiOverlay: join(
      repoRoot,
      "SOS/SAIOS/core/engineering-intelligence/FounderEngineeringReviewOverlay.ts",
    ),
  };

  const sources: AuditSourceRef[] = [
    sourceRef("production_validation", paths.validation, repoRoot, "missing"),
    sourceRef("engineering_intelligence", paths.engineering, repoRoot, "missing"),
    sourceRef("system_integrity", paths.integrity, repoRoot, "missing"),
    sourceRef("integrity_scores", paths.integrityScores, repoRoot, "missing"),
    sourceRef("system_orchestrator", paths.orchState, repoRoot, "missing"),
    sourceRef("founder_action_adapters", paths.faaLatest, repoRoot, "missing"),
    sourceRef("operational_policy", paths.advisor, repoRoot, "missing"),
    sourceRef("project_state", paths.projectState, repoRoot, "missing"),
    sourceRef("runtime_guard", paths.guard, repoRoot, "missing"),
    sourceRef("mission_control", paths.mc, repoRoot, "missing"),
  ];

  const validation = readJson<{
    overall_status?: string;
    pass_percent?: number;
    checks_failed?: number;
    checks_warned?: number;
    live?: boolean;
    publication_allowed?: boolean;
    production_entry?: string;
    owns_production?: boolean;
  }>(paths.validation);

  const engineering = readJson<{
    advisory_only?: boolean;
    owns_production?: boolean;
    live?: boolean;
    publication_allowed?: boolean;
    scores?: Record<string, number>;
    findings?: {
      architecture?: { duplicate_command_surfaces?: number };
      legacy?: { duplicate_command_surfaces?: number };
      performance?: { log_json_files?: number };
    };
    recommendation_count?: number;
  }>(paths.engineering);

  const integrity = readJson<{
    ok?: boolean;
    live?: boolean;
    overall_score?: number;
    findings?: { blocker?: number; high?: number };
  }>(paths.integrity);

  const orchState = readJson<{
    coordination_only?: boolean;
    production_entry?: string;
    live?: boolean;
    publication_allowed?: boolean;
  }>(paths.orchState);

  const projectState = readJson<{
    latest_agent?: string;
    next_agent?: string;
    pending_actions?: string[];
    operations?: Record<string, string>;
    publication_status?: string;
  }>(paths.projectState);

  const guardPresent =
    existsSync(paths.guard) &&
    readFileSync(paths.guard, "utf8").includes("ENGINES");
  const pcPresent =
    existsSync(paths.pc) &&
    readFileSync(paths.pc, "utf8").includes(
      'entrypoint: "ProductionController"',
    );
  const orchCoordination =
    existsSync(paths.orch) &&
    readFileSync(paths.orch, "utf8").includes("coordination_only: true");
  const faaDelegates =
    existsSync(paths.faa) &&
    readFileSync(paths.faa, "utf8").includes("owns_production: false");
  const eiReviewOnly =
    existsSync(paths.eiOverlay) &&
    readFileSync(paths.eiOverlay, "utf8").includes("execution_triggered: false");
  const liveOff = process.env.SOS_AIOS_LIVE !== "1";

  const ops = projectState?.operations ?? {};
  const opsComplete = [
    "canonical_production_controller",
    "founder_action_adapters",
    "system_orchestrator",
    "end_to_end_validation",
    "engineering_intelligence",
    "mission_control_ui",
    "command_center_foundation",
  ];
  const opsHit = opsComplete.filter((k) => ops[k] === "complete").length;
  const opsScore = clampScore((opsHit / opsComplete.length) * 100);

  const eiScores = engineering?.scores ?? {};
  const valPass = validation?.pass_percent ?? 0;
  const valOk = validation?.overall_status === "PASS" ||
    validation?.overall_status === "PASS_WITH_WARNINGS";
  const integrityOk = integrity?.ok === true;
  const integrityScore = integrity?.overall_score ?? 0;

  // ——— Deterministic category scores (evidence-based) ———
  const architecture = avg([
    eiScores.architecture ?? 0,
    opsScore,
    pcPresent ? 100 : 0,
    guardPresent ? 100 : 0,
    orchCoordination ? 100 : 0,
  ]);

  const governance = avg([
    guardPresent ? 100 : 0,
    liveOff ? 100 : 0,
    validation?.publication_allowed === false ||
    validation?.publication_allowed == null
      ? 100
      : 0,
    faaDelegates ? 100 : 0,
    eiReviewOnly ? 100 : 0,
    integrityOk ? 100 : 70,
  ]);

  const production = avg([
    valOk ? valPass : Math.min(valPass, 40),
    pcPresent ? 100 : 0,
    orchState?.production_entry === "ProductionController" || pcPresent
      ? 100
      : 0,
    validation?.owns_production === false || validation == null ? 100 : 0,
    ops["canonical_production_controller"] === "complete" ? 100 : 50,
  ]);

  const engOverall = eiScores.overall ?? 0;
  const engineeringScore = avg([
    engOverall,
    engineering?.advisory_only === true ? 100 : 40,
    engineering?.owns_production === false ? 100 : 0,
    eiReviewOnly ? 100 : 60,
  ]);

  const verification = avg([
    valOk ? 100 : 40,
    integrityOk ? 100 : 40,
    eiScores.verification ?? 0,
    existsSync(paths.validationModule) ? 100 : 0,
    ops["end_to_end_validation"] === "complete" ? 100 : 50,
  ]);

  const performanceScore = clampScore(eiScores.performance ?? 70);
  const storage = clampScore(eiScores.storage ?? 70);
  const documentation = avg([
    eiScores.documentation ?? 0,
    existsSync(paths.integrityScores) ? 100 : 50,
    existsSync(
      join(
        repoRoot,
        "SOS/09_REPORTS/AIOS_CANONICAL_END_TO_END_PRODUCTION_VALIDATION_V1_REPORT.md",
      ),
    )
      ? 100
      : 70,
  ]);

  const security = avg([
    liveOff ? 100 : 0,
    guardPresent ? 100 : 0,
    validation?.publication_allowed === false || !validation ? 100 : 0,
    engineering?.publication_allowed === false || !engineering ? 100 : 0,
  ]);

  const scores: ReadinessScores = {
    architecture,
    governance,
    production,
    engineering: engineeringScore,
    verification,
    performance: performanceScore,
    storage,
    security,
    documentation,
    overall: avg([
      architecture,
      governance,
      production,
      engineeringScore,
      verification,
      performanceScore,
      storage,
      security,
      documentation,
    ]),
  };

  // ——— Blockers from evidence ———
  const blockers: ReadinessBlocker[] = [];
  const push = (b: ReadinessBlocker) => blockers.push(b);

  if (!liveOff) {
    push({
      blocker_id: "pra-live-on",
      category: "security",
      severity: "CRITICAL",
      description: "SOS_AIOS_LIVE is enabled",
      supporting_evidence: ["process.env.SOS_AIOS_LIVE=1"],
      impact: "Unsafe for staging certification while LIVE is ON",
      launch_blocking: true,
      recommended_action: "Set SOS_AIOS_LIVE=0 before any staging readiness claim",
      requires_founder_approval: true,
    });
  }

  if (validation?.publication_allowed === true) {
    push({
      blocker_id: "pra-publication-allowed",
      category: "governance",
      severity: "CRITICAL",
      description: "publication_allowed is true in validation evidence",
      supporting_evidence: [
        sources.find((s) => s.id === "production_validation")?.path ??
          "production-validation-report.json",
      ],
      impact: "Publication must remain disabled for this certification phase",
      launch_blocking: true,
      recommended_action: "Keep publication_allowed false until Founder publication gate",
      requires_founder_approval: true,
    });
  }

  if (!pcPresent) {
    push({
      blocker_id: "pra-missing-production-controller",
      category: "production",
      severity: "CRITICAL",
      description: "ProductionController entrypoint missing",
      supporting_evidence: [relative(repoRoot, paths.pc)],
      impact: "No canonical production entry",
      launch_blocking: true,
      recommended_action: "Restore ProductionController as sole production owner",
      requires_founder_approval: true,
    });
  }

  if (!validation) {
    push({
      blocker_id: "pra-validation-report-missing",
      category: "verification",
      severity: "HIGH",
      description: "End-to-end production validation report missing",
      supporting_evidence: [relative(repoRoot, paths.validation)],
      impact: "Cannot certify lifecycle readiness without validation evidence",
      launch_blocking: true,
      recommended_action: "Run aios:production-validation:run and re-audit",
      requires_founder_approval: false,
    });
  } else if (validation.overall_status === "FAIL") {
    push({
      blocker_id: "pra-validation-failed",
      category: "verification",
      severity: "HIGH",
      description: "Production validation overall_status is FAIL",
      supporting_evidence: [
        `pass_percent=${validation.pass_percent}`,
        `checks_failed=${validation.checks_failed}`,
      ],
      impact: "Lifecycle validation did not pass",
      launch_blocking: true,
      recommended_action: "Resolve failed validation checks, then re-audit",
      requires_founder_approval: false,
    });
  }

  if (!guardPresent) {
    push({
      blocker_id: "pra-runtime-guard-missing",
      category: "governance",
      severity: "HIGH",
      description: "Runtime Guard missing or invalid",
      supporting_evidence: [relative(repoRoot, paths.guard)],
      impact: "Safety boundary unavailable",
      launch_blocking: true,
      recommended_action: "Restore SOS/SAIOS/architecture/runtime-guard.ts",
      requires_founder_approval: true,
    });
  }

  if (!integrityOk) {
    push({
      blocker_id: "pra-integrity-not-ok",
      category: "architecture",
      severity: "HIGH",
      description: "System integrity verify-result not ok",
      supporting_evidence: [relative(repoRoot, paths.integrity)],
      impact: "Architecture certification evidence missing or failed",
      launch_blocking: true,
      recommended_action: "Run system-integrity:verify and address failures",
      requires_founder_approval: false,
    });
  }

  if (engineering?.owns_production === true) {
    push({
      blocker_id: "pra-ei-owns-production",
      category: "engineering",
      severity: "HIGH",
      description: "Engineering Intelligence claims production ownership",
      supporting_evidence: [relative(repoRoot, paths.engineering)],
      impact: "Ownership invariant violated",
      launch_blocking: true,
      recommended_action: "Restore advisory_only / owns_production false",
      requires_founder_approval: true,
    });
  }

  const pending = projectState?.pending_actions ?? [];
  if (pending.length > 0) {
    push({
      blocker_id: "pra-pending-founder-actions",
      category: "governance",
      severity: "MEDIUM",
      description: `${pending.length} pending Founder/project actions recorded`,
      supporting_evidence: pending.slice(0, 4),
      impact: "Outstanding Founder work before full release",
      launch_blocking: false,
      recommended_action: "Triage pending_actions in project-state with Founder",
      requires_founder_approval: true,
    });
  }

  const dupSurfaces =
    engineering?.findings?.architecture?.duplicate_command_surfaces ??
    engineering?.findings?.legacy?.duplicate_command_surfaces ??
    0;
  if (dupSurfaces > 0) {
    push({
      blocker_id: "pra-legacy-duplicate-surfaces",
      category: "architecture",
      severity: "MEDIUM",
      description: "Legacy duplicate Founder command surfaces still present",
      supporting_evidence: [`duplicate_command_surfaces=${dupSurfaces}`],
      impact: "Founder confusion risk; Mission Control is canonical",
      launch_blocking: false,
      recommended_action:
        "Plan legacy deprecation bridge; do not delete without Founder approval",
      requires_founder_approval: true,
    });
  }

  if (validation?.overall_status === "PASS_WITH_WARNINGS") {
    push({
      blocker_id: "pra-validation-warnings",
      category: "verification",
      severity: "LOW",
      description: "Production validation passed with warnings",
      supporting_evidence: [`checks_warned=${validation.checks_warned ?? 0}`],
      impact: "Non-blocking readiness noise",
      launch_blocking: false,
      recommended_action: "Review validation warnings before LIVE",
      requires_founder_approval: false,
    });
  }

  if ((eiScores.performance ?? 100) < 75) {
    push({
      blocker_id: "pra-performance-band",
      category: "performance",
      severity: "LOW",
      description: "Engineering performance score below comfort band",
      supporting_evidence: [`performance=${eiScores.performance}`],
      impact: "Operational headroom advisory",
      launch_blocking: false,
      recommended_action: "Monitor log volume; avoid full-tree scans in hot paths",
      requires_founder_approval: false,
    });
  }

  if (!engineering) {
    push({
      blocker_id: "pra-engineering-report-missing",
      category: "engineering",
      severity: "MEDIUM",
      description: "Engineering Intelligence report missing",
      supporting_evidence: [relative(repoRoot, paths.engineering)],
      impact: "Engineering readiness evidence incomplete",
      launch_blocking: false,
      recommended_action: "Run aios:engineering:run (advisory) then re-audit",
      requires_founder_approval: false,
    });
  }

  // If no blockers at all, record NONE sentinel for clarity (not launch-blocking)
  if (blockers.length === 0) {
    push({
      blocker_id: "pra-none",
      category: "overall",
      severity: "NONE",
      description: "No readiness blockers detected from available evidence",
      supporting_evidence: ["all audited sources within thresholds"],
      impact: "None",
      launch_blocking: false,
      recommended_action: "Proceed with staging certification review",
      requires_founder_approval: false,
    });
  }

  const blocker_counts = {
    critical: blockers.filter((b) => b.severity === "CRITICAL").length,
    high: blockers.filter((b) => b.severity === "HIGH").length,
    medium: blockers.filter((b) => b.severity === "MEDIUM").length,
    low: blockers.filter((b) => b.severity === "LOW").length,
    none: blockers.filter((b) => b.severity === "NONE").length,
  };

  let highest_blocker_level: BlockerSeverity = "NONE";
  if (blocker_counts.critical) highest_blocker_level = "CRITICAL";
  else if (blocker_counts.high) highest_blocker_level = "HIGH";
  else if (blocker_counts.medium) highest_blocker_level = "MEDIUM";
  else if (blocker_counts.low) highest_blocker_level = "LOW";

  const launchBlocking = blockers.filter((b) => b.launch_blocking);
  let launch_recommendation: LaunchRecommendation;
  let launch_rationale: string;

  if (launchBlocking.length > 0 || highest_blocker_level === "CRITICAL") {
    launch_recommendation = "NOT_READY";
    launch_rationale = `Launch-blocking issues present (${launchBlocking.map((b) => b.blocker_id).join(", ") || highest_blocker_level})`;
  } else if (
    highest_blocker_level === "MEDIUM" ||
    highest_blocker_level === "LOW" ||
    scores.overall < 90 ||
    pending.length > 0
  ) {
    launch_recommendation = "READY_WITH_MINOR_ACTIONS";
    launch_rationale = `Overall ${scores.overall}; highest blocker ${highest_blocker_level}; pending_actions=${pending.length}. LIVE remains OFF; publication disabled.`;
  } else {
    launch_recommendation = "READY_FOR_STAGING";
    launch_rationale = `Overall ${scores.overall}; no launch-blocking blockers; validation and integrity evidence OK. LIVE OFF; publication_allowed false.`;
  }

  const duration_ms = Number((performance.now() - t0).toFixed(2));
  const report_rel = relative(repoRoot, REPORT_PATH).replace(/\\/g, "/");

  const report: ProductionReadinessReport = {
    schema_version: 1,
    agent: "228",
    audit_version: PRODUCTION_READINESS_VERSION,
    audit_id,
    timestamp: now.toISOString(),
    duration_ms,
    scores,
    blockers,
    blocker_counts,
    highest_blocker_level,
    launch_recommendation,
    launch_rationale,
    sources,
    evidence_summary: {
      validation_status: validation?.overall_status ?? null,
      validation_pass_percent: validation?.pass_percent ?? null,
      engineering_overall: engOverall || null,
      integrity_ok: integrityOk,
      integrity_score: integrityScore || null,
      latest_agent: projectState?.latest_agent ?? null,
      pending_actions: pending.length,
      ops_complete_ratio: `${opsHit}/${opsComplete.length}`,
      live_off: liveOff,
      production_entry: "ProductionController",
    },
    live: false,
    publication_allowed: false,
    openai_called: false,
    owns_production: false,
    owns_orchestration: false,
    owns_business_logic: false,
    owns_governance: false,
    executes_production: false,
    modifies_architecture: false,
    regenerates_existing_reports: false,
    production_entry: "ProductionController",
    report_path: report_rel,
  };

  mkdirSync(HISTORY_ROOT, { recursive: true });
  atomicWriteJson(join(HISTORY_ROOT, `${audit_id}.json`), report);
  atomicWriteJson(REPORT_PATH, report);
  writeFileSync(
    join(LOG_ROOT, "audits.jsonl"),
    `${JSON.stringify({
      audit_id,
      timestamp: report.timestamp,
      overall: scores.overall,
      launch_recommendation,
      highest_blocker_level,
      duration_ms,
    })}\n`,
    { encoding: "utf8", flag: "a" },
  );

  return report;
}

export function loadProductionReadinessSurface(opts?: {
  repoRoot?: string;
  limit?: number;
  now?: Date;
}): ProductionReadinessSurface {
  const repoRoot = opts?.repoRoot ?? REPO;
  const now = opts?.now ?? new Date();
  const limit = opts?.limit ?? 10;
  const reportPath = join(
    repoRoot,
    "SOS/07_LOGS/saios/production-readiness/production-readiness-report.json",
  );
  const hist = join(
    repoRoot,
    "SOS/07_LOGS/saios/production-readiness/history",
  );

  let last: ProductionReadinessReport | null = null;
  if (existsSync(reportPath)) {
    last = readJson<ProductionReadinessReport>(reportPath);
  }

  let audit_age_minutes: number | null = null;
  if (last?.timestamp) {
    const ageMs = now.getTime() - new Date(last.timestamp).getTime();
    audit_age_minutes = Number((ageMs / 60_000).toFixed(2));
  }

  const recent: ProductionReadinessSurface["recent_audits"] = [];
  if (existsSync(hist)) {
    const files = readdirSync(hist)
      .filter((n) => n.endsWith(".json"))
      .sort()
      .reverse()
      .slice(0, limit);
    for (const f of files) {
      const r = readJson<ProductionReadinessReport>(join(hist, f));
      if (!r) continue;
      recent.push({
        audit_id: r.audit_id,
        timestamp: r.timestamp,
        overall: r.scores.overall,
        launch_recommendation: r.launch_recommendation,
      });
    }
  }

  return {
    schema_version: 1,
    agent: "228",
    generated_at: now.toISOString(),
    last_audit: last,
    overall_readiness: last?.scores.overall ?? null,
    launch_recommendation: last?.launch_recommendation ?? "NONE",
    critical_blockers: last?.blocker_counts.critical ?? 0,
    high_blockers: last?.blocker_counts.high ?? 0,
    latest_audit_id: last?.audit_id ?? null,
    audit_age_minutes,
    recent_audits: recent,
    live: false,
    publication_allowed: false,
    owns_production: false,
    owns_orchestration: false,
    owns_governance: false,
  };
}
