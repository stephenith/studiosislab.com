/**
 * Enablement / verification-only policy for Website Department.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { WebsiteDepartmentOptions } from "./types.js";

export type WebsiteEnablement = {
  enabled: boolean;
  reason: string | null;
  source: "project-state" | "force" | "default";
};

export function readWebsiteEnablement(input: {
  repo_root: string;
  project_state_path?: string | null;
  force_enabled?: boolean | null;
}): WebsiteEnablement {
  if (typeof input.force_enabled === "boolean") {
    return {
      enabled: input.force_enabled,
      reason: input.force_enabled ? null : "forced_disabled_for_test",
      source: "force",
    };
  }

  const statePath =
    input.project_state_path === undefined
      ? join(input.repo_root, "SOS/project-state.json")
      : input.project_state_path;

  if (!statePath || !existsSync(statePath)) {
    return {
      enabled: false,
      reason: "project_state_missing_fail_closed",
      source: "default",
    };
  }

  try {
    const raw = JSON.parse(readFileSync(statePath, "utf8")) as {
      operations?: { website_department?: { enabled?: boolean; reason?: string } };
    };
    const web = raw.operations?.website_department;
    const enabled = web?.enabled === true;
    return {
      enabled,
      reason: enabled ? null : String(web?.reason ?? "website_department_disabled"),
      source: "project-state",
    };
  } catch {
    return {
      enabled: false,
      reason: "project_state_unreadable_fail_closed",
      source: "default",
    };
  }
}

/**
 * Verification-only is allowed while disabled only when all constraints hold.
 */
export function assertVerificationOnlyConstraints(options: WebsiteDepartmentOptions): void {
  if (options.verification_only !== true) return;

  if (options.persist === true) {
    throw new Error("verification_only forbids persist: true");
  }
  if (options.allow_network === true) {
    throw new Error("verification_only forbids allow_network: true");
  }
  if (options.mode === "live" || options.mode === "auto") {
    // auto is coerced to static under verification_only; live is forbidden
    if (options.mode === "live") {
      throw new Error("verification_only forbids mode: live");
    }
  }
  if (options.project_state_path) {
    throw new Error("verification_only forbids project_state_path writes/targets");
  }
}

export function resolveExecutionGate(input: {
  enablement: WebsiteEnablement;
  options: WebsiteDepartmentOptions;
}): {
  allowed: boolean;
  verification_only: boolean;
  persist: boolean;
  allow_network: boolean;
  mode: "static" | "live" | "auto";
  detail: string;
} {
  const verification_only = input.options.verification_only === true;

  if (verification_only) {
    assertVerificationOnlyConstraints(input.options);
    return {
      allowed: true,
      verification_only: true,
      persist: false,
      allow_network: false,
      mode: "static",
      detail: "verification_only_static_no_persist_no_network",
    };
  }

  if (!input.enablement.enabled) {
    return {
      allowed: false,
      verification_only: false,
      persist: false,
      allow_network: false,
      mode: input.options.mode ?? "static",
      detail: `website_department_disabled: ${input.enablement.reason ?? "no_reason"}`,
    };
  }

  return {
    allowed: true,
    verification_only: false,
    persist: input.options.persist !== false,
    allow_network: input.options.allow_network !== false,
    mode: input.options.mode ?? "auto",
    detail: "enabled_operational",
  };
}
