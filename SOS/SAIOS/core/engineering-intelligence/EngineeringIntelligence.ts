/**
 * Canonical Engineering Intelligence — Agent #223.
 * Advisory-only engineering governance & recommendation engine.
 *
 * Owns: analysis, scoring, recommendations, trend notes, recommendation history.
 * Never: edits code, deletes files, rewrites architecture, installs packages,
 * executes production, calls OpenAI, modifies policies / project-state / Runtime Guard.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const REPO = resolve(import.meta.dirname, "../../../..");

export const ENGINEERING_VERSION = "1.0.0" as const;
export const ENGINEERING_LOG_ROOT = join(
  REPO,
  "SOS/07_LOGS/saios/engineering-intelligence",
);
export const ENGINEERING_HISTORY_ROOT = join(ENGINEERING_LOG_ROOT, "history");
export const ENGINEERING_REPORT_PATH = join(
  ENGINEERING_LOG_ROOT,
  "engineering-intelligence-report.json",
);

export type EngineeringCategory =
  | "architecture"
  | "code_quality"
  | "performance"
  | "storage"
  | "documentation"
  | "verification"
  | "dependencies"
  | "legacy"
  | "maintainability";

export type EngineeringSeverity = "critical" | "high" | "medium" | "low" | "info";

export type EngineeringRecommendationStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED";

export type EngineeringRecommendation = {
  recommendation_id: string;
  category: EngineeringCategory;
  severity: EngineeringSeverity;
  confidence: number;
  affected_components: string[];
  supporting_evidence: string[];
  estimated_benefit: string;
  risk: string;
  suggested_action: string;
  requires_founder_approval: true;
  status: EngineeringRecommendationStatus;
};

export type CategoryScores = {
  architecture: number;
  code_quality: number;
  performance: number;
  storage: number;
  documentation: number;
  verification: number;
  dependencies: number;
  maintainability: number;
  overall: number;
};

export type EngineeringFindings = {
  architecture: {
    canonical_entrypoint_present: boolean;
    legacy_founder_surfaces_marked: boolean;
    duplicate_command_surfaces: number;
    runtime_guard_present: boolean;
  };
  code_quality: {
    large_ts_files: number;
    first_production_cycle_modules: number;
    dashboard_view_count: number;
  };
  performance: {
    log_json_files: number;
    history_json_files: number;
    cache_opportunity_notes: string[];
  };
  storage: {
    report_md_count: number;
    saios_log_dirs: number;
    engineering_history_count: number;
  };
  documentation: {
    missing_readmes: string[];
    present_readmes: string[];
    canonical_reports_present: number;
  };
  verification: {
    aios_verify_scripts: number;
    system_integrity_present: boolean;
    engineering_verify_present: boolean;
  };
  dependencies: {
    package_dependency_count: number;
    package_dev_dependency_count: number;
  };
  legacy: {
    founder_control_center_legacy: boolean;
    founder_dashboard_runtime_legacy: boolean;
    legacy_notes: string[];
  };
};

export type EngineeringIntelligenceReport = {
  schema_version: 1;
  engineering_version: typeof ENGINEERING_VERSION;
  agent: "223";
  generated_at: string;
  advisory_only: true;
  owns_code: false;
  owns_production: false;
  can_mutate_architecture: false;
  code_modified: false;
  files_deleted: false;
  packages_installed: false;
  policies_modified: false;
  project_state_modified: false;
  runtime_guard_modified: false;
  production_triggered: false;
  openai_called: false;
  publication_allowed: false;
  live: false;
  founder_approval_required: true;
  findings: EngineeringFindings;
  scores: CategoryScores;
  recommendations: EngineeringRecommendation[];
  recommendation_count: number;
  open_count: number;
  severity_summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  trends: {
    previous_overall: number | null;
    overall_delta: number | null;
    history_samples: number;
  };
  report_path: string;
  history_path: string;
  duration_ms: number;
};

function atomicWriteJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

function safeReadJson(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function listFilesRecursive(
  root: string,
  opts: { maxDepth: number; ext?: string; maxFiles?: number },
  depth = 0,
): string[] {
  if (!existsSync(root) || depth > opts.maxDepth) return [];
  const out: string[] = [];
  let entries: string[] = [];
  try {
    entries = readdirSync(root);
  } catch {
    return [];
  }
  for (const name of entries) {
    if (name === "node_modules" || name === ".git" || name === "dist") continue;
    const abs = join(root, name);
    let st;
    try {
      st = statSync(abs);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      out.push(...listFilesRecursive(abs, opts, depth + 1));
    } else if (st.isFile()) {
      if (!opts.ext || name.endsWith(opts.ext)) out.push(abs);
    }
    if (opts.maxFiles && out.length >= opts.maxFiles) return out;
  }
  return out;
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function countSeverity(
  recs: EngineeringRecommendation[],
  s: EngineeringSeverity,
): number {
  return recs.filter((r) => r.severity === s).length;
}

function buildFindings(repoRoot: string): EngineeringFindings {
  const cycle = join(repoRoot, "SOS/SAIOS/core/first-production-cycle");
  const guard = join(repoRoot, "SOS/SAIOS/architecture/runtime-guard.ts");
  const fccReadme = join(
    repoRoot,
    "SOS/SAIOS/runtime/founder-control-center/README.md",
  );
  const fdReadme = join(repoRoot, "SOS/SAIOS/runtime/founder-dashboard/README.md");
  const entry = join(cycle, "ProductionController.ts");
  const pkgPath = join(repoRoot, "package.json");

  const cycleTs = existsSync(cycle)
    ? listFilesRecursive(cycle, { maxDepth: 2, ext: ".ts", maxFiles: 500 })
    : [];
  const largeTs = cycleTs.filter((p) => {
    try {
      return statSync(p).size > 40_000;
    } catch {
      return false;
    }
  }).length;

  const dashViews = join(repoRoot, "SOS/SAIOS/dashboard/src/views");
  const viewCount = existsSync(dashViews)
    ? listFilesRecursive(dashViews, { maxDepth: 3, ext: ".tsx", maxFiles: 200 })
        .length
    : 0;

  const logsRoot = join(repoRoot, "SOS/07_LOGS/saios");
  const logJson = existsSync(logsRoot)
    ? listFilesRecursive(logsRoot, { maxDepth: 4, ext: ".json", maxFiles: 2000 })
    : [];
  const historyJson = logJson.filter((p) => p.includes(`${join("history")}`) || p.includes("/history/"));

  const reportsDir = join(repoRoot, "SOS/09_REPORTS");
  const reportMd = existsSync(reportsDir)
    ? listFilesRecursive(reportsDir, { maxDepth: 2, ext: ".md", maxFiles: 500 })
    : [];

  let saiosLogDirs = 0;
  if (existsSync(logsRoot)) {
    try {
      saiosLogDirs = readdirSync(logsRoot).filter((n) => {
        try {
          return statSync(join(logsRoot, n)).isDirectory();
        } catch {
          return false;
        }
      }).length;
    } catch {
      saiosLogDirs = 0;
    }
  }

  let engHist = 0;
  const histRoot = join(logsRoot, "engineering-intelligence", "history");
  if (existsSync(histRoot)) {
    try {
      engHist = readdirSync(histRoot).filter((n) => n.endsWith(".json")).length;
    } catch {
      engHist = 0;
    }
  }

  const readmeTargets = [
    "SOS/SAIOS/core/first-production-cycle/README.md",
    "SOS/SAIOS/dashboard/README.md",
    "SOS/SAIOS/runtime/founder-control-center/README.md",
    "SOS/SAIOS/runtime/founder-dashboard/README.md",
    "SOS/SAIOS/core/engineering-intelligence/README.md",
  ];
  const present_readmes: string[] = [];
  const missing_readmes: string[] = [];
  for (const rel of readmeTargets) {
    if (existsSync(join(repoRoot, rel))) present_readmes.push(rel);
    else missing_readmes.push(rel);
  }

  const pkg = safeReadJson(pkgPath);
  const scripts =
    pkg && typeof pkg.scripts === "object" && pkg.scripts
      ? (pkg.scripts as Record<string, string>)
      : {};
  const aiosVerify = Object.keys(scripts).filter(
    (k) => k.startsWith("aios:") && k.endsWith(":verify"),
  ).length;
  const deps =
    pkg && typeof pkg.dependencies === "object" && pkg.dependencies
      ? Object.keys(pkg.dependencies as object).length
      : 0;
  const devDeps =
    pkg && typeof pkg.devDependencies === "object" && pkg.devDependencies
      ? Object.keys(pkg.devDependencies as object).length
      : 0;

  const fccLegacy =
    existsSync(fccReadme) &&
    readFileSync(fccReadme, "utf8").includes("Legacy (Non-Canonical)");
  const fdLegacy =
    existsSync(fdReadme) &&
    readFileSync(fdReadme, "utf8").includes("Legacy (Non-Canonical)");

  const duplicate_command_surfaces =
    (existsSync(join(repoRoot, "SOS/SAIOS/runtime/founder-control-center"))
      ? 1
      : 0) +
    (existsSync(join(repoRoot, "SOS/SAIOS/runtime/founder-dashboard"))
      ? 1
      : 0);

  const canonicalReports = [
    "SOS/09_REPORTS/AIOS_CANONICAL_FOUNDER_COMMAND_CENTER_FOUNDATION_V1_REPORT.md",
    "SOS/09_REPORTS/AIOS_MISSION_CONTROL_UI_V1_REPORT.md",
    "SOS/09_REPORTS/AIOS_CANONICAL_OPERATIONAL_POLICY_ADVISOR_V1_REPORT.md",
    "SOS/09_REPORTS/AIOS_SYSTEM_INTEGRITY_CERTIFICATION_V1_REPORT.md",
  ].filter((r) => existsSync(join(repoRoot, r))).length;

  return {
    architecture: {
      canonical_entrypoint_present: existsSync(entry),
      legacy_founder_surfaces_marked: fccLegacy && fdLegacy,
      duplicate_command_surfaces,
      runtime_guard_present:
        existsSync(guard) &&
        readFileSync(guard, "utf8").includes("ENGINES"),
    },
    code_quality: {
      large_ts_files: largeTs,
      first_production_cycle_modules: cycleTs.length,
      dashboard_view_count: viewCount,
    },
    performance: {
      log_json_files: logJson.length,
      history_json_files: historyJson.length,
      cache_opportunity_notes: [
        historyJson.length > 200
          ? "High history JSON count — consider bounded retention policy (advisory)"
          : "History volume within advisory comfort band",
        logJson.length > 1000
          ? "Large saios JSON surface — avoid full-tree scans in hot paths"
          : "Log JSON surface moderate",
      ],
    },
    storage: {
      report_md_count: reportMd.length,
      saios_log_dirs: saiosLogDirs,
      engineering_history_count: engHist,
    },
    documentation: {
      missing_readmes,
      present_readmes,
      canonical_reports_present: canonicalReports,
    },
    verification: {
      aios_verify_scripts: aiosVerify,
      system_integrity_present: existsSync(
        join(
          repoRoot,
          "SOS/SAIOS/architecture/system-integrity/verify-system-integrity.ts",
        ),
      ),
      engineering_verify_present: Boolean(scripts["aios:engineering:verify"]),
    },
    dependencies: {
      package_dependency_count: deps,
      package_dev_dependency_count: devDeps,
    },
    legacy: {
      founder_control_center_legacy: fccLegacy,
      founder_dashboard_runtime_legacy: fdLegacy,
      legacy_notes: [
        fccLegacy
          ? "founder-control-center classified Legacy (Non-Canonical)"
          : "founder-control-center missing Legacy marker",
        fdLegacy
          ? "founder-dashboard classified Legacy (Non-Canonical)"
          : "founder-dashboard missing Legacy marker",
      ],
    },
  };
}

function scoreFromFindings(f: EngineeringFindings): CategoryScores {
  let architecture = 100;
  if (!f.architecture.canonical_entrypoint_present) architecture -= 40;
  if (!f.architecture.runtime_guard_present) architecture -= 25;
  if (!f.architecture.legacy_founder_surfaces_marked) architecture -= 15;
  if (f.architecture.duplicate_command_surfaces > 0) architecture -= 5;

  let code_quality = 100;
  code_quality -= Math.min(30, f.code_quality.large_ts_files * 8);
  if (f.code_quality.first_production_cycle_modules > 60) code_quality -= 10;
  if (f.code_quality.dashboard_view_count > 40) code_quality -= 5;

  let performance = 100;
  if (f.performance.history_json_files > 200) performance -= 20;
  else if (f.performance.history_json_files > 100) performance -= 10;
  if (f.performance.log_json_files > 1500) performance -= 20;
  else if (f.performance.log_json_files > 800) performance -= 10;

  let storage = 100;
  if (f.storage.report_md_count > 300) storage -= 15;
  if (f.storage.saios_log_dirs > 80) storage -= 15;
  if (f.storage.engineering_history_count > 100) storage -= 10;

  let documentation = 100;
  documentation -= Math.min(40, f.documentation.missing_readmes.length * 12);
  if (f.documentation.canonical_reports_present < 3) documentation -= 10;

  let verification = 100;
  if (!f.verification.system_integrity_present) verification -= 40;
  if (f.verification.aios_verify_scripts < 10) verification -= 20;
  else if (f.verification.aios_verify_scripts < 15) verification -= 8;
  if (!f.verification.engineering_verify_present) verification -= 5;

  let dependencies = 100;
  const totalDeps =
    f.dependencies.package_dependency_count +
    f.dependencies.package_dev_dependency_count;
  if (totalDeps > 80) dependencies -= 20;
  else if (totalDeps > 50) dependencies -= 10;

  let maintainability = clampScore(
    (architecture + code_quality + documentation + verification) / 4,
  );

  const overall = clampScore(
    architecture * 0.18 +
      code_quality * 0.14 +
      performance * 0.1 +
      storage * 0.1 +
      documentation * 0.12 +
      verification * 0.14 +
      dependencies * 0.08 +
      maintainability * 0.14,
  );

  return {
    architecture: clampScore(architecture),
    code_quality: clampScore(code_quality),
    performance: clampScore(performance),
    storage: clampScore(storage),
    documentation: clampScore(documentation),
    verification: clampScore(verification),
    dependencies: clampScore(dependencies),
    maintainability,
    overall,
  };
}

function buildRecommendations(
  f: EngineeringFindings,
  scores: CategoryScores,
): EngineeringRecommendation[] {
  const recs: EngineeringRecommendation[] = [];

  if (!f.architecture.legacy_founder_surfaces_marked) {
    recs.push({
      recommendation_id: "eng-arch-legacy-markers",
      category: "architecture",
      severity: "high",
      confidence: 0.95,
      affected_components: [
        "SOS/SAIOS/runtime/founder-control-center",
        "SOS/SAIOS/runtime/founder-dashboard",
      ],
      supporting_evidence: f.legacy.legacy_notes,
      estimated_benefit: "Clearer Founder surface ownership; fewer wrong entrypoints",
      risk: "Documentation-only change if markers missing",
      suggested_action:
        "Ensure Legacy (Non-Canonical) markers remain on pre-spine founder surfaces",
      requires_founder_approval: true,
      status: "OPEN",
    });
  }

  if (f.architecture.duplicate_command_surfaces >= 2) {
    recs.push({
      recommendation_id: "eng-arch-duplicate-command-surfaces",
      category: "legacy",
      severity: "medium",
      confidence: 0.9,
      affected_components: [
        "runtime/founder-control-center",
        "runtime/founder-dashboard",
        "dashboard Mission Control",
      ],
      supporting_evidence: [
        `duplicate_command_surfaces=${f.architecture.duplicate_command_surfaces}`,
        "Canonical host is SOS/SAIOS/dashboard",
      ],
      estimated_benefit: "Reduced Founder confusion; single observation shell",
      risk: "Premature deletion may break legacy verify scripts",
      suggested_action:
        "Plan intentional legacy deprecation bridge; do not delete without Founder approval",
      requires_founder_approval: true,
      status: "OPEN",
    });
  }

  if (f.code_quality.large_ts_files > 0) {
    recs.push({
      recommendation_id: "eng-code-large-modules",
      category: "code_quality",
      severity: f.code_quality.large_ts_files >= 3 ? "high" : "medium",
      confidence: 0.85,
      affected_components: ["SOS/SAIOS/core/first-production-cycle"],
      supporting_evidence: [
        `large_ts_files=${f.code_quality.large_ts_files}`,
        "threshold >40KB",
      ],
      estimated_benefit: "Easier review and lower coupling risk",
      risk: "Split may touch production ownership boundaries",
      suggested_action:
        "Schedule Founder-approved modularization of largest cycle modules",
      requires_founder_approval: true,
      status: "OPEN",
    });
  }

  if (f.performance.history_json_files > 100) {
    recs.push({
      recommendation_id: "eng-perf-history-growth",
      category: "performance",
      severity: f.performance.history_json_files > 200 ? "high" : "medium",
      confidence: 0.88,
      affected_components: ["SOS/07_LOGS/saios/**/history"],
      supporting_evidence: [
        `history_json_files=${f.performance.history_json_files}`,
        ...f.performance.cache_opportunity_notes,
      ],
      estimated_benefit: "Faster advisory scans; smaller disk footprint",
      risk: "Retention policy must preserve auditability",
      suggested_action:
        "Define bounded history retention for advisory logs (Founder-approved)",
      requires_founder_approval: true,
      status: "OPEN",
    });
  }

  if (f.storage.saios_log_dirs > 60) {
    recs.push({
      recommendation_id: "eng-storage-log-dir-growth",
      category: "storage",
      severity: "medium",
      confidence: 0.8,
      affected_components: ["SOS/07_LOGS/saios"],
      supporting_evidence: [`saios_log_dirs=${f.storage.saios_log_dirs}`],
      estimated_benefit: "Clearer operational taxonomy",
      risk: "Cleanup must not erase release/audit artifacts",
      suggested_action:
        "Inventory obsolete log namespaces; archive rather than delete",
      requires_founder_approval: true,
      status: "OPEN",
    });
  }

  if (f.documentation.missing_readmes.length > 0) {
    recs.push({
      recommendation_id: "eng-docs-missing-readmes",
      category: "documentation",
      severity: "medium",
      confidence: 0.98,
      affected_components: f.documentation.missing_readmes,
      supporting_evidence: f.documentation.missing_readmes.map(
        (p) => `missing:${p}`,
      ),
      estimated_benefit: "Faster onboarding and ownership clarity",
      risk: "Low — docs only",
      suggested_action: "Add README stubs for missing subsystem packages",
      requires_founder_approval: true,
      status: "OPEN",
    });
  }

  if (!f.verification.engineering_verify_present) {
    recs.push({
      recommendation_id: "eng-verify-script-missing",
      category: "verification",
      severity: "high",
      confidence: 0.99,
      affected_components: ["package.json", "engineering-intelligence"],
      supporting_evidence: ["aios:engineering:verify absent at analysis time"],
      estimated_benefit: "Integrity coverage for Engineering Intelligence",
      risk: "Low",
      suggested_action: "Add aios:engineering:verify and wire system-integrity",
      requires_founder_approval: true,
      status: "OPEN",
    });
  }

  if (scores.overall < 75) {
    recs.push({
      recommendation_id: "eng-maintainability-overall",
      category: "maintainability",
      severity: scores.overall < 60 ? "critical" : "high",
      confidence: 0.9,
      affected_components: ["AIOS platform"],
      supporting_evidence: [
        `overall=${scores.overall}`,
        `architecture=${scores.architecture}`,
        `verification=${scores.verification}`,
      ],
      estimated_benefit: "Raises platform governance readiness",
      risk: "Broad remediations need sequenced Founder approval",
      suggested_action:
        "Prioritize open high/critical engineering recommendations before LIVE",
      requires_founder_approval: true,
      status: "OPEN",
    });
  }

  if (
    f.dependencies.package_dependency_count +
      f.dependencies.package_dev_dependency_count >
    50
  ) {
    recs.push({
      recommendation_id: "eng-deps-growth",
      category: "dependencies",
      severity: "low",
      confidence: 0.75,
      affected_components: ["package.json"],
      supporting_evidence: [
        `dependencies=${f.dependencies.package_dependency_count}`,
        `devDependencies=${f.dependencies.package_dev_dependency_count}`,
      ],
      estimated_benefit: "Smaller install surface; fewer supply-chain risks",
      risk: "Removal may break tooling",
      suggested_action:
        "Audit unused packages; remove only with Founder-approved PR",
      requires_founder_approval: true,
      status: "OPEN",
    });
  }

  // Stable sort for determinism
  const sevRank: Record<EngineeringSeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
  };
  return recs.sort(
    (a, b) =>
      sevRank[a.severity] - sevRank[b.severity] ||
      a.recommendation_id.localeCompare(b.recommendation_id),
  );
}

function readTrends(repoRoot: string, overall: number): EngineeringIntelligenceReport["trends"] {
  const histRoot = join(
    repoRoot,
    "SOS/07_LOGS/saios/engineering-intelligence/history",
  );
  let previous_overall: number | null = null;
  let history_samples = 0;
  if (existsSync(histRoot)) {
    try {
      const files = readdirSync(histRoot)
        .filter((n) => n.endsWith(".json"))
        .sort();
      history_samples = files.length;
      if (files.length > 0) {
        const last = safeReadJson(join(histRoot, files[files.length - 1]!));
        const scores =
          last?.scores && typeof last.scores === "object"
            ? (last.scores as Record<string, unknown>)
            : null;
        if (typeof scores?.overall === "number") previous_overall = scores.overall;
      }
    } catch {
      /* ignore */
    }
  }
  return {
    previous_overall,
    overall_delta:
      previous_overall === null ? null : Number((overall - previous_overall).toFixed(2)),
    history_samples,
  };
}

/**
 * Build Engineering Intelligence report. Advisory only.
 * When persist=true, writes ONLY engineering-intelligence artifacts.
 */
export function buildEngineeringIntelligenceReport(opts?: {
  repoRoot?: string;
  persist?: boolean;
  now?: Date;
}): EngineeringIntelligenceReport {
  const t0 = performance.now();
  const repoRoot = opts?.repoRoot ?? REPO;
  const now = opts?.now ?? new Date();
  const generated_at = now.toISOString();

  const findings = buildFindings(repoRoot);
  const scores = scoreFromFindings(findings);
  const recommendations = buildRecommendations(findings, scores);
  const trends = readTrends(repoRoot, scores.overall);

  const logRoot = join(repoRoot, "SOS/07_LOGS/saios/engineering-intelligence");
  const historyRoot = join(logRoot, "history");
  mkdirSync(historyRoot, { recursive: true });
  const stamp = generated_at.replace(/[:.]/g, "-");
  const report_path_abs = join(logRoot, "engineering-intelligence-report.json");
  const history_path_abs = join(historyRoot, `engineering-${stamp}.json`);

  const severity_summary = {
    critical: countSeverity(recommendations, "critical"),
    high: countSeverity(recommendations, "high"),
    medium: countSeverity(recommendations, "medium"),
    low: countSeverity(recommendations, "low"),
    info: countSeverity(recommendations, "info"),
  };

  const report: EngineeringIntelligenceReport = {
    schema_version: 1,
    engineering_version: ENGINEERING_VERSION,
    agent: "223",
    generated_at,
    advisory_only: true,
    owns_code: false,
    owns_production: false,
    can_mutate_architecture: false,
    code_modified: false,
    files_deleted: false,
    packages_installed: false,
    policies_modified: false,
    project_state_modified: false,
    runtime_guard_modified: false,
    production_triggered: false,
    openai_called: false,
    publication_allowed: false,
    live: false,
    founder_approval_required: true,
    findings,
    scores,
    recommendations,
    recommendation_count: recommendations.length,
    open_count: recommendations.filter((r) => r.status === "OPEN").length,
    severity_summary,
    trends,
    report_path: relative(repoRoot, report_path_abs).replace(/\\/g, "/"),
    history_path: relative(repoRoot, history_path_abs).replace(/\\/g, "/"),
    duration_ms: Number((performance.now() - t0).toFixed(2)),
  };

  if (opts?.persist !== false) {
    atomicWriteJson(report_path_abs, report);
    atomicWriteJson(history_path_abs, report);
  }

  return report;
}

export function engineeringFingerprint(
  report: EngineeringIntelligenceReport,
): string {
  return JSON.stringify({
    scores: report.scores,
    recommendation_ids: report.recommendations.map((r) => r.recommendation_id),
    severities: report.recommendations.map((r) => r.severity),
    open_count: report.open_count,
    severity_summary: report.severity_summary,
    finding_keys: {
      large_ts_files: report.findings.code_quality.large_ts_files,
      aios_verify_scripts: report.findings.verification.aios_verify_scripts,
      missing_readmes: report.findings.documentation.missing_readmes,
      duplicate_command_surfaces:
        report.findings.architecture.duplicate_command_surfaces,
      runtime_guard_present: report.findings.architecture.runtime_guard_present,
      package_dependency_count:
        report.findings.dependencies.package_dependency_count,
    },
  });
}
