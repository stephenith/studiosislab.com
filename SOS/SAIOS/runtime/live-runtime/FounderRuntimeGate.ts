/**
 * Founder Runtime Gate — LIVE admission control (read-only checks).
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { isLiveFlagEnabled, LIVE_FLAG } from "./RuntimeModeManager.js";
import type { FounderGateResult, GateCheck } from "./types.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");

function readJson<T>(rel: string): T | null {
  const path = join(REPO_ROOT, rel);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

export function evaluateFounderRuntimeGate(): FounderGateResult {
  const checks: GateCheck[] = [];
  const live_flag = isLiveFlagEnabled();

  const supervisor = readJson<{ status?: string }>(
    "SOS/07_LOGS/saios/runtime-supervisor/supervisor-health.json",
  );
  checks.push({
    id: "runtime_supervisor",
    label: "Runtime Supervisor healthy",
    pass: String(supervisor?.status).toUpperCase() === "READY",
    detail: supervisor?.status ?? "missing",
  });

  const loop = readJson<{ status?: string }>(
    "SOS/07_LOGS/saios/runtime-loop/runtime-loop.json",
  );
  checks.push({
    id: "runtime_loop",
    label: "Runtime Loop healthy",
    pass: String(loop?.status).toUpperCase() === "READY",
    detail: loop?.status ?? "missing",
  });

  const website = readJson<{ status?: string }>(
    "SOS/07_LOGS/saios/website-department/website-health.json",
  );
  const web = String(website?.status ?? "").toUpperCase();
  checks.push({
    id: "website",
    label: "Website healthy",
    pass: web === "HEALTHY" || web === "READY",
    detail: website?.status ?? "missing",
  });

  const security = readJson<{ security_level?: string; status?: string }>(
    "SOS/07_LOGS/saios/security-department/security-health.json",
  );
  const sec = String(security?.security_level ?? "").toUpperCase();
  checks.push({
    id: "security",
    label: "Security not RED",
    pass: sec !== "RED" && sec !== "CRITICAL",
    detail: security?.security_level ?? security?.status ?? "missing",
  });

  const state = readJson<{
    factory_v1?: { status?: string };
    operations?: {
      event_bus?: { status?: string };
      deployment_manager?: { validation_pass?: boolean; status?: string };
      live_monitoring?: { commander_bridge_detected?: boolean };
    };
  }>("SOS/project-state.json");

  checks.push({
    id: "factory_state",
    label: "Factory State healthy",
    pass: String(state?.factory_v1?.status).toUpperCase() === "STABLE",
    detail: state?.factory_v1?.status ?? "missing",
  });

  checks.push({
    id: "event_bus",
    label: "Event Bus healthy",
    pass: String(state?.operations?.event_bus?.status).toUpperCase() === "READY",
    detail: state?.operations?.event_bus?.status ?? "missing",
  });

  const bridge =
    state?.operations?.live_monitoring?.commander_bridge_detected === true ||
    existsSync(
      join(REPO_ROOT, "SOS/runtime/src/services/notification-pipeline.ts"),
    );
  checks.push({
    id: "notification_bridge",
    label: "Notification bridge available",
    pass: bridge,
    detail: bridge ? "commander pipeline detected" : "missing",
  });

  const deployOk =
    state?.operations?.deployment_manager?.validation_pass === true ||
    String(state?.operations?.deployment_manager?.status).toUpperCase() ===
      "READY";
  checks.push({
    id: "deployment_validation",
    label: "Deployment validation passed",
    pass: deployOk,
    detail: String(
      state?.operations?.deployment_manager?.status ??
        state?.operations?.deployment_manager?.validation_pass ??
        "missing",
    ),
  });

  const approved = checks.every((c) => c.pass) && live_flag;
  const failed = checks.filter((c) => !c.pass).map((c) => c.id);

  return {
    approved,
    live_flag,
    checks,
    reason: !live_flag
      ? `${LIVE_FLAG} not set — LIVE denied`
      : approved
        ? "All gate checks passed — LIVE allowed"
        : `Gate failed: ${failed.join(", ")}`,
  };
}
