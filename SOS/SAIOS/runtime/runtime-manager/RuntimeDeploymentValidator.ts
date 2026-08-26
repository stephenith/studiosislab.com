/**
 * Deployment readiness validator — no Docker / VPS provisioning.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./RuntimeConfiguration.js";
import { inspectRuntimeEnvironment, nodeVersionOk } from "./RuntimeEnvironment.js";
import type { DeploymentReadiness, RegisteredDepartment } from "./types.js";

export function validateDeploymentReadiness(input: {
  departments: RegisteredDepartment[];
  startup_order: string[];
}): DeploymentReadiness {
  const env = inspectRuntimeEnvironment();
  const missing: string[] = [];
  const notes: string[] = [];

  const checks: Record<string, boolean> = {
    node_version_gte_20: nodeVersionOk(env.node_version),
    project_state_present: env.has_project_state,
    saios_runtime_present: env.has_saios_runtime,
    folder_structure: existsSync(join(REPO_ROOT, "SOS/SAIOS/runtime")),
    required_modules_available: input.departments.every((d) => d.available),
    startup_order_complete:
      input.startup_order.length === input.departments.length && input.startup_order.length > 0,
    environment_placeholders_documented: env.placeholders.length > 0,
    sos_runtime_env_optional: true,
  };

  if (!checks.node_version_gte_20) missing.push(`Node ${env.node_version} < 20`);
  if (!checks.project_state_present) missing.push("SOS/project-state.json");
  if (!checks.saios_runtime_present) missing.push("SOS/SAIOS/runtime");
  for (const d of input.departments.filter((x) => !x.available)) {
    missing.push(d.module_path);
  }

  if (!env.has_sos_runtime_env) {
    notes.push("SOS/runtime/.env missing — live Telegram/email remain dry-run");
  }
  notes.push("No Docker / VPS provisioning in this phase — readiness only");
  notes.push(`Placeholders: ${env.placeholders.join(", ")}`);

  const ready = Object.entries(checks)
    .filter(([k]) => k !== "sos_runtime_env_optional")
    .every(([, v]) => v);

  return {
    generated_at: new Date().toISOString(),
    ready,
    checks,
    node_version: env.node_version,
    missing,
    notes,
  };
}
