/**
 * AIOS Runtime Freeze Guard — Agent #160
 *
 * Architecture enforcement only. Does not implement features.
 * Legacy engines remain in the repo; accidental production launches are blocked.
 * Verify suites and explicit opt-in (SOS_AIOS_ALLOW_LEGACY_ENGINE=1) still run.
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const AIOS_ARCHITECTURE_VERSION = "1.0.0-canonical-runtime-freeze";

export type EngineStatus = "CANONICAL" | "LEGACY" | "REFERENCE" | "ARCHIVED";

export type EngineMeta = {
  id: string;
  status: EngineStatus;
  role: string;
  entrypoint: string;
  deprecation_reason?: string;
  canonical_alternative?: string;
};

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const LOCK_DIR = join(REPO_ROOT, "SOS/07_LOGS/saios/runtime-freeze");
const LOCK_FILE = join(LOCK_DIR, "execution.lock");

export const ENGINES = {
  CANONICAL_FIRST_PRODUCTION_CYCLE: {
    id: "core.first-production-cycle",
    status: "CANONICAL" as const,
    role: "canonical_execution_spine",
    entrypoint: "SOS/SAIOS/core/first-production-cycle/runFirstProductionCycle.ts",
    canonical_alternative: "npx tsx SOS/SAIOS/core/first-production-cycle/run.ts",
  },
  REFERENCE_FIRST_DRY_RUN: {
    id: "core.first-dry-run",
    status: "REFERENCE" as const,
    role: "reference_dry_run",
    entrypoint: "SOS/SAIOS/core/first-dry-run/runFirstDryRun.ts",
    deprecation_reason: "Predecessor dry-run. Prefer first-production-cycle.",
    canonical_alternative: "SOS/SAIOS/core/first-production-cycle",
  },
  ARCHIVED_UNIFIED_PRODUCTION: {
    id: "runtime.unified-production",
    status: "ARCHIVED" as const,
    role: "archived_parallel_execution_engine",
    entrypoint: "SOS/SAIOS/runtime/unified-production/UnifiedProductionDirector.ts",
    deprecation_reason:
      "Parallel full execution engine. Superseded by Pipeline A spine (Agent #159/#160).",
    canonical_alternative: "SOS/SAIOS/core/first-production-cycle",
  },
  LEGACY_PIPELINE: {
    id: "runtime.pipeline",
    status: "LEGACY" as const,
    role: "legacy_autonomous_pipeline",
    entrypoint: "SOS/SAIOS/runtime/pipeline/PipelineOrchestrator.ts",
    deprecation_reason: "Legacy Resume Autonomous Production Pipeline.",
    canonical_alternative: "SOS/SAIOS/core/first-production-cycle",
  },
  LEGACY_PRODUCTION_V1: {
    id: "runtime.workers.resume-production.v1",
    status: "LEGACY" as const,
    role: "legacy_generation_worker_cli",
    entrypoint: "SOS/SAIOS/runtime/workers/resume-production/run.ts",
    deprecation_reason: "v1 generator CLI. Not the canonical engine.",
    canonical_alternative: "SOS/SAIOS/core/first-production-cycle",
  },
  LEGACY_PRODUCTION_V2: {
    id: "runtime.workers.resume-production.v2",
    status: "LEGACY" as const,
    role: "legacy_generation_worker",
    entrypoint: "SOS/SAIOS/runtime/workers/resume-production/production-pipeline.ts",
    deprecation_reason: "v2 generation pipeline. Worker capability only — not official engine.",
    canonical_alternative: "SOS/SAIOS/core/first-production-cycle",
  },
  LEGACY_PRODUCTION_V3: {
    id: "runtime.workers.resume-production.v3",
    status: "LEGACY" as const,
    role: "legacy_premium_generator",
    entrypoint: "SOS/SAIOS/runtime/workers/resume-production/production-pipeline-v3.ts",
    deprecation_reason:
      "Premium generator historically produced templates. Reclassified as WORKER under canonical spine.",
    canonical_alternative: "SOS/SAIOS/core/first-production-cycle",
  },
  LEGACY_PRODUCTION_EXECUTOR: {
    id: "runtime.scheduler.ProductionExecutor",
    status: "LEGACY" as const,
    role: "legacy_scheduler_bypass",
    entrypoint: "SOS/SAIOS/runtime/scheduler/ProductionExecutor.ts",
    deprecation_reason: "Delegates to archived unified-production — bypasses canonical spine.",
    canonical_alternative: "SOS/SAIOS/core/first-production-cycle",
  },
  LEGACY_SCHEDULER_CLI: {
    id: "runtime.scheduler.run",
    status: "LEGACY" as const,
    role: "legacy_scheduler_cli",
    entrypoint: "SOS/SAIOS/runtime/scheduler/run.ts",
    deprecation_reason: "Persistent scheduler ticks legacy production executor.",
    canonical_alternative: "SOS/SAIOS/core/first-production-cycle",
  },
  LEGACY_CONTROLLER: {
    id: "runtime.controller",
    status: "LEGACY" as const,
    role: "legacy_objective_intake_engine",
    entrypoint: "SOS/SAIOS/runtime/controller/ProductionController.ts",
    deprecation_reason:
      "Intake is valuable; session engine path is legacy. Not the canonical execution spine.",
    canonical_alternative: "SOS/SAIOS/core/first-production-cycle",
  },
} as const satisfies Record<string, EngineMeta>;

export function printEngineBanner(meta: EngineMeta): void {
  const lines = [
    "",
    "════════════════════════════════════════════════════════════",
    ` AIOS Architecture Version : ${AIOS_ARCHITECTURE_VERSION}`,
    ` Engine ID                 : ${meta.id}`,
    ` Engine Status             : ${meta.status}`,
    ` Execution Role            : ${meta.role}`,
    ` Entrypoint                : ${meta.entrypoint}`,
  ];
  if (meta.deprecation_reason) {
    lines.push(` Deprecation Reason        : ${meta.deprecation_reason}`);
  }
  if (meta.canonical_alternative) {
    lines.push(` Canonical Alternative     : ${meta.canonical_alternative}`);
  }
  lines.push("════════════════════════════════════════════════════════════", "");
  const msg = lines.join("\n");
  if (meta.status === "CANONICAL") {
    console.log(msg);
  } else {
    console.warn(msg);
  }
}

function isVerifyOrAllowedContext(): boolean {
  if (process.env.SOS_AIOS_ALLOW_LEGACY_ENGINE === "1") return true;
  if (process.env.SOS_AIOS_VERIFY === "1") return true;
  if (process.env.npm_lifecycle_event?.includes("verify")) return true;

  const stack = new Error().stack ?? "";
  if (
    /verify(-v\d+)?\.(ts|js|mjs|cjs)/i.test(stack) ||
    /\/verify\.(ts|js)/i.test(stack) ||
    /founder-gate-runtime\/verify/i.test(stack) ||
    /first-production-cycle\/verify/i.test(stack)
  ) {
    return true;
  }

  // Historical missions remain runnable (REFERENCE) without rewriting package.json scripts.
  if (/SOS\/SAIOS\/missions\//i.test(stack)) return true;

  const argv = process.argv.join(" ");
  if (/verify/i.test(argv)) return true;

  return false;
}

export function isLegacyCliBlocked(): boolean {
  return process.env.SOS_AIOS_ALLOW_LEGACY_ENGINE !== "1";
}

/**
 * Enforce runtime freeze for non-canonical engines.
 * CANONICAL always allowed.
 * LEGACY/ARCHIVED/REFERENCE allowed for verify, missions, or SOS_AIOS_ALLOW_LEGACY_ENGINE=1.
 */
export function enforceEngineAccess(
  meta: EngineMeta,
  opts?: { source?: "cli" | "library" },
): void {
  printEngineBanner(meta);

  if (meta.status === "CANONICAL") return;

  const source = opts?.source ?? "library";
  const allowed = isVerifyOrAllowedContext();

  if (allowed) {
    console.warn(
      `[AIOS RUNTIME FREEZE] ${meta.status} engine "${meta.id}" allowed (verify / mission / SOS_AIOS_ALLOW_LEGACY_ENGINE=1).`,
    );
    return;
  }

  // CLI: always hard-block without opt-in
  if (source === "cli") {
    throw new Error(
      [
        `AIOS RUNTIME FREEZE: blocked CLI launch of ${meta.status} engine "${meta.id}".`,
        meta.deprecation_reason ?? "",
        `Use canonical: ${meta.canonical_alternative ?? "SOS/SAIOS/core/first-production-cycle"}`,
        `Or set SOS_AIOS_ALLOW_LEGACY_ENGINE=1 to run legacy intentionally.`,
      ]
        .filter(Boolean)
        .join(" "),
    );
  }

  // Library: hard-block accidental production use (not verify/mission)
  throw new Error(
    [
      `AIOS RUNTIME FREEZE: blocked library call to ${meta.status} engine "${meta.id}".`,
      meta.deprecation_reason ?? "",
      `Canonical engine: ${meta.canonical_alternative ?? "core/first-production-cycle"}`,
      `Verify suites auto-allow. For intentional legacy runs set SOS_AIOS_ALLOW_LEGACY_ENGINE=1.`,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

/**
 * Optional single-flight lock. Enabled only when SOS_AIOS_EXECUTION_LOCK=1
 * to avoid breaking parallel verify suites by default.
 */
export function acquireExecutionLock(engineId: string): () => void {
  if (process.env.SOS_AIOS_EXECUTION_LOCK !== "1") {
    return () => undefined;
  }
  mkdirSync(LOCK_DIR, { recursive: true });
  if (existsSync(LOCK_FILE)) {
    try {
      const existing = JSON.parse(readFileSync(LOCK_FILE, "utf8")) as {
        engine_id?: string;
        pid?: number;
        depth?: number;
      };
      // Re-entrant for nested engine calls in the same process (e.g. unified → v3).
      if (existing.pid === process.pid) {
        const depth = (existing.depth ?? 1) + 1;
        writeFileSync(
          LOCK_FILE,
          JSON.stringify(
            {
              engine_id: existing.engine_id ?? engineId,
              nested_engine_id: engineId,
              pid: process.pid,
              depth,
              at: new Date().toISOString(),
            },
            null,
            2,
          ),
          "utf8",
        );
        return () => {
          try {
            if (!existsSync(LOCK_FILE)) return;
            const cur = JSON.parse(readFileSync(LOCK_FILE, "utf8")) as {
              depth?: number;
              engine_id?: string;
              pid?: number;
            };
            const next = (cur.depth ?? 1) - 1;
            if (next <= 0) unlinkSync(LOCK_FILE);
            else {
              writeFileSync(
                LOCK_FILE,
                JSON.stringify(
                  {
                    engine_id: cur.engine_id,
                    pid: cur.pid,
                    depth: next,
                    at: new Date().toISOString(),
                  },
                  null,
                  2,
                ),
                "utf8",
              );
            }
          } catch {
            /* ignore */
          }
        };
      }
      throw new Error(
        `AIOS RUNTIME FREEZE: parallel execution blocked. Lock held by ${existing.engine_id} (pid ${existing.pid}).`,
      );
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("AIOS RUNTIME FREEZE")) throw e;
      // corrupt lock — replace
    }
  }
  writeFileSync(
    LOCK_FILE,
    JSON.stringify(
      {
        engine_id: engineId,
        pid: process.pid,
        depth: 1,
        at: new Date().toISOString(),
      },
      null,
      2,
    ),
    "utf8",
  );
  return () => {
    try {
      if (!existsSync(LOCK_FILE)) return;
      const cur = JSON.parse(readFileSync(LOCK_FILE, "utf8")) as {
        depth?: number;
        pid?: number;
      };
      if (cur.pid !== process.pid) return;
      const next = (cur.depth ?? 1) - 1;
      if (next <= 0) unlinkSync(LOCK_FILE);
      else {
        writeFileSync(
          LOCK_FILE,
          JSON.stringify({ ...cur, depth: next, at: new Date().toISOString() }, null, 2),
          "utf8",
        );
      }
    } catch {
      /* ignore */
    }
  };
}
