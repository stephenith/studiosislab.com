/**
 * Canonical Production Health Gate — Agent #212.
 * Preflight safety only. Never executes production, OpenAI, Brain, Renderer, Critic, or Founder Review.
 */
import {
  accessSync,
  constants,
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import {
  AIOS_ARCHITECTURE_VERSION,
  ENGINES,
} from "../../architecture/runtime-guard.js";
import {
  candidatesRoot,
  listCandidateManifests,
} from "./CandidateStore.js";
import { countFounderReviewWaiting } from "../founder-review/FounderReviewProjection.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const DEFAULT_CYCLE_LOG = join(
  REPO,
  "SOS/07_LOGS/saios/first-production-cycle",
);

/** Default founder-queue capacity used when callers omit queue_max */
export const DEFAULT_HEALTH_QUEUE_MAX = 20;

export type HealthStatus = "HEALTHY" | "UNHEALTHY";

export type HealthCheckResult = {
  id: string;
  ok: boolean;
  severity: "fail" | "warn";
  detail: string;
};

export type ProductionHealthResult = {
  status: HealthStatus;
  checks: HealthCheckResult[];
  failed_checks: string[];
  warnings: string[];
  timestamp: string;
  duration_ms: number;
  queue_waiting: number;
  queue_max: number;
  report_path: string;
  publication_allowed: false;
  live: false;
};

export type ProductionHealthSimulate = {
  /** Pretend candidate registry cannot be listed */
  registry_unreadable?: boolean;
  /** Pretend waiting count is at/over queue_max */
  queue_over_limit?: boolean;
  /** Pretend candidate root is not writable */
  filesystem_not_writable?: boolean;
  /** Pretend Runtime Guard is missing / unhealthy */
  runtime_guard_unhealthy?: boolean;
  /** Pretend project-state.json unreadable */
  project_state_unreadable?: boolean;
  /** Pretend provider registry missing OpenAI entry */
  openai_not_configured?: boolean;
};

export type ProductionHealthOptions = {
  repoRoot?: string;
  cycleLog?: string;
  queue_max?: number;
  /** When false, still evaluate but do not write health-report.json */
  persist?: boolean;
  simulate?: ProductionHealthSimulate;
};

function tryReadJson(path: string): { ok: boolean; detail: string; data?: unknown } {
  if (!existsSync(path)) {
    return { ok: false, detail: `missing: ${path}` };
  }
  try {
    const data = JSON.parse(readFileSync(path, "utf8")) as unknown;
    return { ok: true, detail: "readable", data };
  } catch (e) {
    return {
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

function probeWritable(dir: string): { ok: boolean; detail: string } {
  try {
    mkdirSync(dir, { recursive: true });
    accessSync(dir, constants.W_OK);
    const probe = join(dir, `.health-probe-${process.pid}-${Date.now()}.tmp`);
    writeFileSync(probe, "ok\n", "utf8");
    unlinkSync(probe);
    return { ok: true, detail: `writable: ${dir}` };
  } catch (e) {
    return {
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

function requiredDirectories(repoRoot: string, cycleLog: string): string[] {
  return [
    join(repoRoot, "SOS"),
    join(repoRoot, "SOS/07_LOGS"),
    join(repoRoot, "SOS/07_LOGS/saios"),
    cycleLog,
    join(repoRoot, "SOS/SAIOS"),
    join(repoRoot, "SOS/SAIOS/core"),
    join(repoRoot, "SOS/SAIOS/core/first-production-cycle"),
    join(repoRoot, "SOS/SAIOS/architecture"),
    join(repoRoot, "SOS/SAIOS/config"),
  ];
}

/**
 * Deterministic production preflight. Returns HEALTHY | UNHEALTHY only.
 * Never calls OpenAI, Brain, Renderer, Critic, or Founder Review.
 */
export function evaluateProductionHealth(
  opts?: ProductionHealthOptions,
): ProductionHealthResult {
  const t0 = performance.now();
  const timestamp = new Date().toISOString();
  const repoRoot = opts?.repoRoot ?? REPO;
  const cycleLog = opts?.cycleLog ?? DEFAULT_CYCLE_LOG;
  const queue_max = Math.max(
    1,
    Math.floor(opts?.queue_max ?? DEFAULT_HEALTH_QUEUE_MAX),
  );
  const sim = opts?.simulate ?? {};
  const checks: HealthCheckResult[] = [];

  const push = (
    id: string,
    ok: boolean,
    detail: string,
    severity: "fail" | "warn" = "fail",
  ) => {
    checks.push({ id, ok, severity, detail });
  };

  // 1. Runtime Guard healthy
  if (sim.runtime_guard_unhealthy) {
    push(
      "runtime_guard",
      false,
      "simulated Runtime Guard unhealthy",
    );
  } else {
    const guardPath = join(
      repoRoot,
      "SOS/SAIOS/architecture/runtime-guard.ts",
    );
    const guardOk =
      existsSync(guardPath) &&
      Boolean(ENGINES.CANONICAL_FIRST_PRODUCTION_CYCLE?.id) &&
      Boolean(AIOS_ARCHITECTURE_VERSION) &&
      process.env.SOS_AIOS_LIVE !== "1";
    push(
      "runtime_guard",
      guardOk,
      guardOk
        ? `Runtime Guard present · version=${AIOS_ARCHITECTURE_VERSION} · LIVE=OFF · engine=${ENGINES.CANONICAL_FIRST_PRODUCTION_CYCLE.id}`
        : process.env.SOS_AIOS_LIVE === "1"
          ? "SOS_AIOS_LIVE=1 — production unsafe"
          : "Runtime Guard missing or incomplete",
    );
  }

  // 2. Candidate registry accessible
  if (sim.registry_unreadable) {
    push("candidate_registry", false, "simulated candidate registry unreadable");
  } else {
    try {
      const root = candidatesRoot(cycleLog);
      mkdirSync(root, { recursive: true });
      const manifests = listCandidateManifests(cycleLog);
      push(
        "candidate_registry",
        true,
        `registry accessible · manifests=${manifests.length} · root=${root}`,
      );
    } catch (e) {
      push(
        "candidate_registry",
        false,
        e instanceof Error ? e.message : String(e),
      );
    }
  }

  // 3. Candidate root writable
  const candRoot = candidatesRoot(cycleLog);
  if (sim.filesystem_not_writable) {
    push(
      "candidate_root_writable",
      false,
      "simulated candidate root not writable",
    );
  } else {
    const w = probeWritable(candRoot);
    push("candidate_root_writable", w.ok, w.detail);
  }

  // 4. Batch directory writable
  const batchRoot = join(cycleLog, "batches");
  if (sim.filesystem_not_writable) {
    push("batch_directory_writable", false, "simulated batch directory not writable");
  } else {
    const w = probeWritable(batchRoot);
    push("batch_directory_writable", w.ok, w.detail);
  }

  // 5. Founder queue below configured limit
  let queue_waiting = 0;
  try {
    queue_waiting = sim.queue_over_limit
      ? queue_max
      : countFounderReviewWaiting(REPO);
  } catch (e) {
    push(
      "founder_queue_capacity",
      false,
      e instanceof Error ? e.message : String(e),
    );
    queue_waiting = -1;
  }
  if (queue_waiting >= 0) {
    const under = queue_waiting < queue_max;
    push(
      "founder_queue_capacity",
      under,
      under
        ? `waiting=${queue_waiting} < queue_max=${queue_max}`
        : `waiting=${queue_waiting} >= queue_max=${queue_max}`,
    );
  }

  // 6. Duplicate registry readable (same candidate manifests — fingerprint source)
  if (sim.registry_unreadable) {
    push("duplicate_registry", false, "simulated duplicate registry unreadable");
  } else {
    try {
      listCandidateManifests(cycleLog);
      push(
        "duplicate_registry",
        true,
        "candidate manifests readable for duplicate fingerprints",
      );
    } catch (e) {
      push(
        "duplicate_registry",
        false,
        e instanceof Error ? e.message : String(e),
      );
    }
  }

  // 7. Project state readable
  const projectStatePath = join(repoRoot, "SOS/project-state.json");
  if (sim.project_state_unreadable) {
    push("project_state", false, "simulated project-state unreadable");
  } else {
    const ps = tryReadJson(projectStatePath);
    const shapeOk =
      ps.ok &&
      typeof (ps.data as { latest_agent?: unknown })?.latest_agent === "string" &&
      typeof (ps.data as { next_agent?: unknown })?.next_agent === "string";
    push(
      "project_state",
      shapeOk,
      shapeOk
        ? `project-state readable · latest_agent=${(ps.data as { latest_agent: string }).latest_agent}`
        : ps.detail,
    );
  }

  // 8. Configuration valid (LIVE off, department enablement if present, cycle log path)
  const liveOff = process.env.SOS_AIOS_LIVE !== "1";
  const enablementPath = join(
    repoRoot,
    "SOS/SAIOS/infra/department-enablement.json",
  );
  let configOk = liveOff;
  let configDetail = liveOff ? "LIVE=OFF" : "LIVE=ON refused";
  if (existsSync(enablementPath)) {
    const en = tryReadJson(enablementPath);
    if (!en.ok) {
      configOk = false;
      configDetail = `enablement unreadable: ${en.detail}`;
    } else {
      configDetail += " · department-enablement readable";
    }
  }
  push("configuration", configOk, configDetail);

  // 9. OpenAI provider configured (registry entry present + implemented — not a live call)
  const registryPath = join(repoRoot, "SOS/SAIOS/config/provider-registry.json");
  if (sim.openai_not_configured) {
    push(
      "openai_provider_configured",
      false,
      "simulated OpenAI provider not configured",
    );
  } else {
    const reg = tryReadJson(registryPath);
    if (!reg.ok) {
      push("openai_provider_configured", false, reg.detail);
    } else {
      const providers = (
        reg.data as {
          providers?: Array<{
            id?: string;
            implemented?: boolean;
            enabled?: boolean;
          }>;
        }
      ).providers;
      const openai = providers?.find((p) => p.id === "openai");
      const mock = providers?.find((p) => p.id === "mock");
      const ok =
        Boolean(openai) &&
        openai?.implemented === true &&
        Boolean(mock) &&
        mock?.enabled === true;
      push(
        "openai_provider_configured",
        ok,
        ok
          ? `openai implemented=${openai?.implemented} enabled=${openai?.enabled} · mock enabled=${mock?.enabled} (no API call)`
          : "OpenAI/mock provider registry entry incomplete",
      );
    }
  }

  // 10. Required directories exist
  const missingDirs = requiredDirectories(repoRoot, cycleLog).filter(
    (d) => !existsSync(d),
  );
  push(
    "required_directories",
    missingDirs.length === 0,
    missingDirs.length === 0
      ? "required SOS/SAIOS log and core directories present"
      : `missing: ${missingDirs.map((d) => d.replace(repoRoot + "/", "")).join(", ")}`,
  );

  const failed_checks = checks
    .filter((c) => !c.ok && c.severity === "fail")
    .map((c) => c.id);
  const warnings = checks
    .filter((c) => !c.ok && c.severity === "warn")
    .map((c) => `${c.id}: ${c.detail}`);

  const status: HealthStatus =
    failed_checks.length === 0 ? "HEALTHY" : "UNHEALTHY";
  const duration_ms = Number((performance.now() - t0).toFixed(2));

  const result: ProductionHealthResult = {
    status,
    checks,
    failed_checks,
    warnings,
    timestamp,
    duration_ms,
    queue_waiting,
    queue_max,
    report_path: "",
    publication_allowed: false,
    live: false,
  };

  if (opts?.persist !== false) {
    mkdirSync(cycleLog, { recursive: true });
    const report_path = join(cycleLog, "health-report.json");
    const payload = {
      ...result,
      report_path: report_path.replace(/\\/g, "/"),
      agent: "212",
      owner: "canonical_production_health_gate",
      executes_production: false,
      calls_openai: false,
    };
    writeFileSync(report_path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    result.report_path = report_path;
  }

  return result;
}

/** Convenience: true only when status === HEALTHY */
export function isProductionHealthy(
  opts?: ProductionHealthOptions,
): boolean {
  return evaluateProductionHealth(opts).status === "HEALTHY";
}
