/**
 * Canonical Founder Action Adapters — Agent #225.
 *
 * Validate · Authorize · Delegate · Audit.
 * Never owns production, scheduling, portfolio, strategy, or engineering logic.
 * Production always enters via ProductionController.runProduction.
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
import { AutonomousProductionService } from "../first-production-cycle/AutonomousProductionService.js";
import {
  coordinateFounderRun,
  coordinateRefresh,
  coordinateRetry,
  coordinateScheduledRun,
  coordinateSupervisedProduction,
  recordSystemStarted,
} from "../system-orchestrator/SystemOrchestrator.js";
import { readAutonomousStatusFile } from "../first-production-cycle/AutonomousProductionService.js";
import type { ProductionControllerOptions } from "../first-production-cycle/ProductionController.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const GUARD = join(REPO, "SOS/SAIOS/architecture/runtime-guard.ts");
const LOG_ROOT = join(REPO, "SOS/07_LOGS/saios/founder-action-adapters");
const HISTORY_ROOT = join(LOG_ROOT, "history");
const LATEST_PATH = join(LOG_ROOT, "latest-action.json");
const PREF_PATH = join(LOG_ROOT, "scheduling-preference.json");
const LOCK_PATH = join(LOG_ROOT, "in-flight.lock.json");

export const FOUNDER_ACTION_ADAPTER_VERSION = "1.0.0" as const;

export type FounderActionType =
  | "production.start"
  | "production.pause"
  | "production.resume"
  | "production.stop"
  | "production.run_single_cycle"
  | "production.retry_failed_cycle"
  | "production.supervised_first_run"
  | "scheduling.enable"
  | "scheduling.disable"
  | "scheduling.trigger_run"
  | "portfolio.refresh"
  | "strategy.refresh"
  | "engineering.refresh"
  | "operations.refresh_dashboard"
  | "operations.refresh_fcc_snapshot";

export type ActionOutcome = "Success" | "Failure" | "Warning" | "Rejected";

export type FounderActionAudit = {
  schema_version: 1;
  adapter_version: typeof FOUNDER_ACTION_ADAPTER_VERSION;
  action_id: string;
  timestamp: string;
  requested_by: string;
  action_type: FounderActionType;
  target_subsystem: string;
  validation_result: "pass" | "fail";
  validation_reasons: string[];
  delegated_to: string | null;
  result: ActionOutcome;
  reason: string;
  duration_ms: number;
  error: string | null;
  canonical_response: unknown;
  live: false;
  publication_allowed: false;
  openai_called: false;
  owns_production: false;
  owns_business_logic: false;
  runtime_guard_bypassed: false;
  production_controller_bypassed: false;
};

export type FounderActionResult = {
  outcome: ActionOutcome;
  reason: string;
  action: FounderActionAudit;
  execution_status: "Idle" | "Running" | "Completed" | "Failed" | "Busy" | "Disabled";
};

export type FounderActionSurface = {
  schema_version: 1;
  agent: "225";
  generated_at: string;
  execution_status: FounderActionResult["execution_status"];
  autonomous: ReturnType<typeof readAutonomousStatusFile>;
  scheduling_preference: { adaptive_enabled: boolean };
  recent_actions: FounderActionAudit[];
  in_flight: string | null;
  live: false;
  publication_allowed: false;
  founder_approval_required: true;
  production_entry: "ProductionController";
};

/** Process-local autonomous singleton for Founder UI delegation (never bypasses Controller). */
let autonomousSingleton: AutonomousProductionService | null = null;

function getAutonomous(): AutonomousProductionService {
  if (!autonomousSingleton) {
    autonomousSingleton = new AutonomousProductionService();
  }
  return autonomousSingleton;
}

function atomicWriteJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

function allocateActionId(now: Date): string {
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  return `faa-${stamp}-${Math.floor(Math.random() * 1e6).toString().padStart(6, "0")}`;
}

function targetFor(action: FounderActionType): string {
  if (action.startsWith("production.")) return "ProductionController / AutonomousProductionService";
  if (action.startsWith("scheduling.")) return "AdaptiveSchedulingPolicy";
  if (action === "portfolio.refresh") return "PortfolioPlanner";
  if (action === "strategy.refresh") return "ProductionStrategyEngine";
  if (action === "engineering.refresh") return "EngineeringIntelligence";
  if (action === "operations.refresh_dashboard") return "OperationsDashboard";
  if (action === "operations.refresh_fcc_snapshot") return "FounderCommandCenter";
  return "unknown";
}

function readSchedulingPref(): { adaptive_enabled: boolean } {
  if (!existsSync(PREF_PATH)) return { adaptive_enabled: true };
  try {
    const j = JSON.parse(readFileSync(PREF_PATH, "utf8")) as {
      adaptive_enabled?: boolean;
    };
    return { adaptive_enabled: j.adaptive_enabled !== false };
  } catch {
    return { adaptive_enabled: true };
  }
}

function writeSchedulingPref(adaptive_enabled: boolean): void {
  atomicWriteJson(PREF_PATH, {
    schema_version: 1,
    adaptive_enabled,
    updated_at: new Date().toISOString(),
    note: "Founder preference only — AdaptiveSchedulingPolicy remains owner",
  });
}

function setInFlight(action_id: string, action_type: string): void {
  atomicWriteJson(LOCK_PATH, {
    action_id,
    action_type,
    at: new Date().toISOString(),
  });
}

function clearInFlight(): void {
  if (existsSync(LOCK_PATH)) {
    try {
      unlinkSync(LOCK_PATH);
    } catch {
      /* ignore */
    }
  }
}

function readInFlight(): { action_id: string; action_type: string } | null {
  if (!existsSync(LOCK_PATH)) return null;
  try {
    const j = JSON.parse(readFileSync(LOCK_PATH, "utf8")) as {
      action_id?: string;
      action_type?: string;
    };
    if (!j?.action_id || !j?.action_type) return null;
    return { action_id: j.action_id, action_type: j.action_type };
  } catch {
    return null;
  }
}

function validateRequest(
  action_type: FounderActionType,
): { ok: true } | { ok: false; reasons: string[] } {
  const reasons: string[] = [];
  if (process.env.SOS_AIOS_LIVE === "1") {
    reasons.push("LIVE must be OFF");
  }
  if (!existsSync(GUARD) || !readFileSync(GUARD, "utf8").includes("ENGINES")) {
    reasons.push("Runtime Guard missing or invalid");
  }
  const inflight = readInFlight();
  if (inflight) {
    if (inflight.action_type === action_type) {
      reasons.push(
        `Duplicate request: ${action_type} already in flight (${inflight.action_id})`,
      );
    } else {
      reasons.push(`Busy: another action in flight (${inflight.action_type})`);
    }
  }
  // Production-mutating actions require controller path awareness
  if (action_type.startsWith("production.") || action_type === "scheduling.trigger_run") {
    // Health/Budget remain inside ProductionController — adapters must not bypass
  }
  if (reasons.length) return { ok: false, reasons };
  return { ok: true };
}

function persistAudit(audit: FounderActionAudit, repoRoot: string): string {
  const root = join(repoRoot, "SOS/07_LOGS/saios/founder-action-adapters");
  const hist = join(root, "history");
  mkdirSync(hist, { recursive: true });
  const path = join(hist, `${audit.action_id}.json`);
  atomicWriteJson(path, audit);
  atomicWriteJson(join(root, "latest-action.json"), audit);
  const jsonl = join(root, "actions.jsonl");
  writeFileSync(jsonl, `${JSON.stringify(audit)}\n`, { encoding: "utf8", flag: "a" });
  return relative(repoRoot, path).replace(/\\/g, "/");
}

function mapExecutionStatus(): FounderActionResult["execution_status"] {
  const st = readAutonomousStatusFile();
  if (!st) {
    const svc = autonomousSingleton?.status();
    if (!svc) return "Idle";
    if (svc.busy) return "Busy";
    if (svc.running) return "Running";
    if (svc.state === "stopped") return "Idle";
    return "Idle";
  }
  if (st.busy) return "Busy";
  if (st.running) return "Running";
  if (st.state === "stopped") return "Idle";
  return "Idle";
}

async function delegate(
  action_type: FounderActionType,
  production_opts?: ProductionControllerOptions,
): Promise<{ delegated_to: string; response: unknown; warning?: string }> {
  const pref = readSchedulingPref();
  const verificationOpts: ProductionControllerOptions | undefined =
    production_opts?.verification === true
      ? {
          ...production_opts,
          verification: true,
          verification_context:
            production_opts.verification_context ?? "aios-verify",
        }
      : production_opts;

  switch (action_type) {
    case "production.start": {
      const svc = getAutonomous();
      const st = svc.status();
      if (st.running) {
        return {
          delegated_to: "AutonomousProductionService.start",
          response: st,
          warning: "Already running",
        };
      }
      recordSystemStarted({
        initiator: "founder",
        detail: "Founder start → AutonomousProductionService",
      });
      const status = svc.start({
        force_mock: true,
        adaptive_scheduling_enabled: pref.adaptive_enabled,
        // Bound default start so UI cannot orphan an infinite loop without stop
        interval_ms: pref.adaptive_enabled ? undefined : 60_000,
      });
      return {
        delegated_to:
          "SystemOrchestrator → AutonomousProductionService.start → ProductionController",
        response: status,
      };
    }
    case "production.pause":
    case "production.stop": {
      const svc = getAutonomous();
      const status = await svc.stop();
      return {
        delegated_to: "AutonomousProductionService.stop",
        response: status,
      };
    }
    case "production.resume": {
      const svc = getAutonomous();
      if (svc.status().running) {
        return {
          delegated_to: "AutonomousProductionService.start",
          response: svc.status(),
          warning: "Already running",
        };
      }
      recordSystemStarted({
        initiator: "founder",
        detail: "Founder resume → AutonomousProductionService",
      });
      const status = svc.start({
        force_mock: true,
        adaptive_scheduling_enabled: pref.adaptive_enabled,
      });
      return {
        delegated_to:
          "SystemOrchestrator → AutonomousProductionService.start → ProductionController",
        response: status,
      };
    }
    case "production.run_single_cycle": {
      const orch = await coordinateFounderRun({
        initiator: "founder",
        production_opts: verificationOpts ?? { force_mock: true },
      });
      return {
        delegated_to:
          "SystemOrchestrator → ProductionController.runProduction",
        response: {
          orchestration_ok: orch.ok,
          blocked: orch.blocked,
          reason: orch.reason,
          production: orch.production,
          refresh: orch.refresh,
          events: orch.events.map((e) => e.event_type),
          production_entry: "ProductionController",
          entrypoint: "ProductionController",
        },
        warning: orch.blocked
          ? orch.reason
          : orch.ok
            ? undefined
            : orch.reason,
      };
    }
    case "production.supervised_first_run": {
      const capped: ProductionControllerOptions = {
        ...production_opts,
        batch_size: Math.min(5, Math.max(1, Math.floor(production_opts?.batch_size ?? 5))),
        max_openai_per_batch: Math.min(
          5,
          Math.max(0, Math.floor(production_opts?.max_openai_per_batch ?? 5)),
        ),
      };
      const orch = await coordinateSupervisedProduction({
        initiator: "founder",
        production_opts: {
          ...capped,
          ...(verificationOpts?.verification
            ? {
                verification: true,
                verification_context: verificationOpts.verification_context,
              }
            : {}),
        },
      });
      return {
        delegated_to:
          "SystemOrchestrator.coordinateSupervisedProduction → ProductionController.runProduction",
        response: {
          orchestration_ok: orch.ok,
          blocked: orch.blocked,
          reason: orch.reason,
          production: orch.production,
          refresh: orch.refresh,
          events: orch.events.map((e) => e.event_type),
          production_entry: "ProductionController",
          entrypoint: "ProductionController",
          batch_size: capped.batch_size ?? 5,
          max_openai_per_batch: capped.max_openai_per_batch ?? 5,
          publication_allowed: false,
          live: false,
        },
        warning: orch.blocked
          ? orch.reason
          : orch.ok
            ? undefined
            : orch.reason,
      };
    }
    case "production.retry_failed_cycle": {
      const orch = await coordinateRetry({ initiator: "founder" });
      return {
        delegated_to:
          "SystemOrchestrator.coordinateRetry → ProductionController",
        response: {
          orchestration_ok: orch.ok,
          blocked: orch.blocked,
          cancelled: orch.cancelled,
          reason: orch.reason,
          production: orch.production,
          refresh: orch.refresh,
          events: orch.events.map((e) => e.event_type),
          entrypoint: "ProductionController",
        },
        warning: orch.cancelled || orch.blocked || !orch.ok ? orch.reason : undefined,
      };
    }
    case "scheduling.enable": {
      writeSchedulingPref(true);
      return {
        delegated_to: "AdaptiveSchedulingPolicy (preference flag)",
        response: { adaptive_enabled: true },
      };
    }
    case "scheduling.disable": {
      writeSchedulingPref(false);
      return {
        delegated_to: "AdaptiveSchedulingPolicy (preference flag)",
        response: { adaptive_enabled: false },
      };
    }
    case "scheduling.trigger_run": {
      const orch = await coordinateScheduledRun({ initiator: "founder" });
      return {
        delegated_to:
          "SystemOrchestrator → AdaptiveScheduling → ProductionController",
        response: {
          orchestration_ok: orch.ok,
          blocked: orch.blocked,
          reason: orch.reason,
          production: orch.production,
          refresh: orch.refresh,
          events: orch.events.map((e) => e.event_type),
          entrypoint: "ProductionController",
        },
        warning: orch.blocked || !orch.ok ? orch.reason : undefined,
      };
    }
    case "portfolio.refresh": {
      const orch = await coordinateRefresh({
        kind: "portfolio",
        initiator: "founder",
      });
      return {
        delegated_to: "SystemOrchestrator → PortfolioPlanner",
        response: orch.refresh,
      };
    }
    case "strategy.refresh": {
      const orch = await coordinateRefresh({
        kind: "strategy",
        initiator: "founder",
      });
      return {
        delegated_to: "SystemOrchestrator → ProductionStrategyEngine",
        response: orch.refresh,
      };
    }
    case "engineering.refresh": {
      const orch = await coordinateRefresh({
        kind: "engineering",
        initiator: "founder",
      });
      return {
        delegated_to: "SystemOrchestrator → EngineeringIntelligence",
        response: orch.refresh,
      };
    }
    case "operations.refresh_dashboard": {
      const orch = await coordinateRefresh({
        kind: "dashboard",
        initiator: "founder",
      });
      return {
        delegated_to: "SystemOrchestrator → OperationsDashboard",
        response: orch.refresh,
      };
    }
    case "operations.refresh_fcc_snapshot": {
      const orch = await coordinateRefresh({
        kind: "mission_control",
        initiator: "founder",
      });
      return {
        delegated_to: "SystemOrchestrator → FounderCommandCenter",
        response: orch.refresh,
      };
    }
    default: {
      const _exhaustive: never = action_type;
      throw new Error(`Unhandled action: ${_exhaustive}`);
    }
  }
}

/**
 * Execute one Founder action through the adapter layer.
 */
export async function executeFounderAction(opts: {
  action_type: FounderActionType;
  requested_by?: string;
  repoRoot?: string;
  now?: Date;
  /** Used only by production.supervised_first_run — capped by adapter. */
  production_opts?: ProductionControllerOptions;
}): Promise<FounderActionResult> {
  const now = opts.now ?? new Date();
  const repoRoot = opts.repoRoot ?? REPO;
  const t0 = performance.now();
  const action_id = allocateActionId(now);
  const requested_by = opts.requested_by ?? "founder";
  const action_type = opts.action_type;

  const baseAudit = (): FounderActionAudit => ({
    schema_version: 1,
    adapter_version: FOUNDER_ACTION_ADAPTER_VERSION,
    action_id,
    timestamp: now.toISOString(),
    requested_by,
    action_type,
    target_subsystem: targetFor(action_type),
    validation_result: "pass",
    validation_reasons: [],
    delegated_to: null,
    result: "Failure",
    reason: "",
    duration_ms: 0,
    error: null,
    canonical_response: null,
    live: false,
    publication_allowed: false,
    openai_called: false,
    owns_production: false,
    owns_business_logic: false,
    runtime_guard_bypassed: false,
    production_controller_bypassed: false,
  });

  const validation = validateRequest(action_type);
  if (!validation.ok) {
    const audit = baseAudit();
    audit.validation_result = "fail";
    audit.validation_reasons = validation.reasons;
    audit.result = "Rejected";
    audit.reason = validation.reasons.join("; ");
    audit.duration_ms = Number((performance.now() - t0).toFixed(2));
    persistAudit(audit, repoRoot);
    return {
      outcome: "Rejected",
      reason: audit.reason,
      action: audit,
      execution_status: mapExecutionStatus(),
    };
  }

  setInFlight(action_id, action_type);
  try {
    const { delegated_to, response, warning } = await delegate(
      action_type,
      opts.production_opts,
    );
    const audit = baseAudit();
    audit.delegated_to = delegated_to;
    audit.canonical_response = response;
    audit.duration_ms = Number((performance.now() - t0).toFixed(2));
    if (warning) {
      audit.result = "Warning";
      audit.reason = warning;
    } else {
      audit.result = "Success";
      audit.reason = `Delegated to ${delegated_to}`;
    }
    // Ensure production path never claims bypass
    if (
      action_type.startsWith("production.") ||
      action_type === "scheduling.trigger_run"
    ) {
      audit.production_controller_bypassed = false;
      if (
        action_type.includes("run_single") ||
        action_type.includes("retry") ||
        action_type.includes("supervised_first_run") ||
        action_type === "scheduling.trigger_run"
      ) {
        const resp = response as { entrypoint?: string; production?: { entrypoint?: string } };
        const entry =
          resp.entrypoint ?? resp.production?.entrypoint ?? "ProductionController";
        if (entry !== "ProductionController" && !String(delegated_to).includes("ProductionController")) {
          audit.result = "Failure";
          audit.reason = "Production entry must be ProductionController";
          audit.error = audit.reason;
        }
      }
    }
    persistAudit(audit, repoRoot);
    return {
      outcome: audit.result,
      reason: audit.reason,
      action: audit,
      execution_status: mapExecutionStatus(),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const audit = baseAudit();
    audit.result = "Failure";
    audit.reason = msg;
    audit.error = msg;
    audit.duration_ms = Number((performance.now() - t0).toFixed(2));
    persistAudit(audit, repoRoot);
    return {
      outcome: "Failure",
      reason: msg,
      action: audit,
      execution_status: mapExecutionStatus(),
    };
  } finally {
    clearInFlight();
  }
}

export function loadFounderActionSurface(opts?: {
  repoRoot?: string;
  limit?: number;
}): FounderActionSurface {
  const repoRoot = opts?.repoRoot ?? REPO;
  const limit = opts?.limit ?? 20;
  const hist = join(
    repoRoot,
    "SOS/07_LOGS/saios/founder-action-adapters/history",
  );
  const recent: FounderActionAudit[] = [];
  if (existsSync(hist)) {
    const files = readdirSync(hist)
      .filter((n) => n.endsWith(".json"))
      .sort()
      .reverse()
      .slice(0, limit);
    for (const f of files) {
      try {
        recent.push(
          JSON.parse(readFileSync(join(hist, f), "utf8")) as FounderActionAudit,
        );
      } catch {
        /* skip */
      }
    }
  }
  const inflight = readInFlight();
  return {
    schema_version: 1,
    agent: "225",
    generated_at: new Date().toISOString(),
    execution_status: mapExecutionStatus(),
    autonomous: readAutonomousStatusFile(),
    scheduling_preference: readSchedulingPref(),
    recent_actions: recent,
    in_flight:
      inflight && inflight.action_type ? inflight.action_id : null,
    live: false,
    publication_allowed: false,
    founder_approval_required: true,
    production_entry: "ProductionController",
  };
}

export const ALL_FOUNDER_ACTION_TYPES: FounderActionType[] = [
  "production.start",
  "production.pause",
  "production.resume",
  "production.stop",
  "production.run_single_cycle",
  "production.retry_failed_cycle",
  "production.supervised_first_run",
  "scheduling.enable",
  "scheduling.disable",
  "scheduling.trigger_run",
  "portfolio.refresh",
  "strategy.refresh",
  "engineering.refresh",
  "operations.refresh_dashboard",
  "operations.refresh_fcc_snapshot",
];
