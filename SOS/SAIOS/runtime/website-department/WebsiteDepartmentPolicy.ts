/**
 * Enablement / verification-only / test-bypass policy for Website Department.
 * Single policy surface — operational execution must go through runWebsiteDepartment.
 * Persist authorization is minted only here (assertPersistSafety).
 */
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  canonicalizePath,
  defaultWebsiteDepartmentRoot,
  isSameOrInsidePath,
} from "./WebsitePaths.js";
import type { WebsiteDepartmentOptions } from "./types.js";

export const TEST_BYPASS_ENV = "SOS_WEBSITE_DEPT_TEST_BYPASS";

const PERSIST_AUTH_BRAND = Symbol.for("saios.website.persistAuthorization");

export type WebsitePersistAuthorization = {
  readonly [PERSIST_AUTH_BRAND]: true;
  readonly output_root: string;
  readonly update_root_projections: boolean;
  readonly is_production_root: boolean;
};

export function isWebsitePersistAuthorization(
  value: unknown,
): value is WebsitePersistAuthorization {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { [PERSIST_AUTH_BRAND]?: unknown })[PERSIST_AUTH_BRAND] === true &&
    typeof (value as WebsitePersistAuthorization).output_root === "string"
  );
}

function mintPersistAuthorization(input: {
  output_root: string;
  update_root_projections: boolean;
  is_production_root: boolean;
}): WebsitePersistAuthorization {
  return Object.freeze({
    [PERSIST_AUTH_BRAND]: true as const,
    output_root: input.output_root,
    update_root_projections: input.update_root_projections,
    is_production_root: input.is_production_root,
  });
}

export type WebsiteEnablement = {
  enabled: boolean;
  reason: string | null;
  source: "project-state" | "test_bypass" | "default";
};

export function isTestBypassEnvEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env[TEST_BYPASS_ENV] === "1";
}

export function isAllowedTestOutputRoot(
  outputRoot: string,
  productionRoot: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (isSameOrInsidePath(outputRoot, productionRoot)) return false;

  const resolved = canonicalizePath(outputRoot);
  const tmp = canonicalizePath(tmpdir());
  if (resolved === tmp || resolved.startsWith(tmp + "/")) return true;

  const allow = env.SOS_WEBSITE_DEPT_TEST_OUTPUT_ROOT;
  if (allow) {
    const allowed = canonicalizePath(allow);
    if (resolved === allowed || resolved.startsWith(allowed + "/")) {
      // Symlink under allow that lands in production is still rejected above.
      return !isSameOrInsidePath(outputRoot, productionRoot);
    }
  }
  return false;
}

export function readWebsiteEnablement(input: {
  repo_root: string;
  project_state_path?: string | null;
  force_enabled?: boolean | null;
  env?: NodeJS.ProcessEnv;
}): WebsiteEnablement {
  if (typeof input.force_enabled === "boolean") {
    if (input.force_enabled === true) {
      if (!isTestBypassEnvEnabled(input.env)) {
        throw new Error(
          `force_enabled:true requires ${TEST_BYPASS_ENV}=1 (test bypass only)`,
        );
      }
      return {
        enabled: true,
        reason: "test_bypass_force_enabled",
        source: "test_bypass",
      };
    }
    return {
      enabled: false,
      reason: "forced_disabled_for_test",
      source: "test_bypass",
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

export function assertVerificationOnlyConstraints(options: WebsiteDepartmentOptions): void {
  if (options.verification_only !== true) return;

  if (options.persist === true) {
    throw new Error("verification_only forbids persist: true");
  }
  if (options.allow_network === true) {
    throw new Error("verification_only forbids allow_network: true");
  }
  if (options.mode === "live") {
    throw new Error("verification_only forbids mode: live");
  }
  if (options.project_state_path) {
    throw new Error("verification_only forbids project_state_path writes/targets");
  }
  if (options.allow_production_evidence === true) {
    throw new Error("verification_only forbids allow_production_evidence");
  }
  if (options.force_enabled === true) {
    throw new Error("verification_only forbids force_enabled: true");
  }
}

/**
 * Validates persist target and returns a capability required by persistWebsiteReports.
 * Only this function mints WebsitePersistAuthorization.
 */
export function assertPersistSafety(input: {
  options: WebsiteDepartmentOptions;
  repo_root: string;
  enablement: WebsiteEnablement;
}): WebsitePersistAuthorization {
  const productionRoot = defaultWebsiteDepartmentRoot(input.repo_root);
  const outputRoot = input.options.output_root;
  if (!outputRoot) {
    throw new Error(
      "Persisted Website Department runs require an explicit output_root",
    );
  }

  const isProductionRoot = isSameOrInsidePath(outputRoot, productionRoot);

  if (input.enablement.source === "test_bypass") {
    if (input.options.allow_network === true) {
      throw new Error("test bypass forbids allow_network: true");
    }
    if (input.options.allow_production_evidence === true) {
      throw new Error("test bypass forbids allow_production_evidence");
    }
    if (isProductionRoot || !isAllowedTestOutputRoot(outputRoot, productionRoot)) {
      throw new Error(
        "test bypass forbids production Website Department evidence root; inject a temporary output_root",
      );
    }
    return mintPersistAuthorization({
      output_root: canonicalizePath(outputRoot),
      update_root_projections: true,
      is_production_root: false,
    });
  }

  if (isProductionRoot) {
    if (!input.enablement.enabled || input.enablement.source !== "project-state") {
      throw new Error(
        "Production evidence root requires department enabled via project-state",
      );
    }
    if (input.options.allow_production_evidence !== true) {
      throw new Error(
        "Production evidence root requires allow_production_evidence: true",
      );
    }
    return mintPersistAuthorization({
      output_root: canonicalizePath(outputRoot),
      update_root_projections: true,
      is_production_root: true,
    });
  }

  return mintPersistAuthorization({
    output_root: canonicalizePath(outputRoot),
    update_root_projections: true,
    is_production_root: false,
  });
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
  test_bypass: boolean;
} {
  const verification_only = input.options.verification_only === true;
  const test_bypass = input.enablement.source === "test_bypass" && input.enablement.enabled;

  if (verification_only) {
    assertVerificationOnlyConstraints(input.options);
    return {
      allowed: true,
      verification_only: true,
      persist: false,
      allow_network: false,
      mode: "static",
      detail: "verification_only_static_no_persist_no_network",
      test_bypass: false,
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
      test_bypass: false,
    };
  }

  if (test_bypass) {
    return {
      allowed: true,
      verification_only: false,
      persist: input.options.persist === true,
      allow_network: false,
      mode: "static",
      detail: "test_bypass_static_no_network",
      test_bypass: true,
    };
  }

  return {
    allowed: true,
    verification_only: false,
    persist: input.options.persist !== false,
    allow_network: input.options.allow_network !== false,
    mode: input.options.mode ?? "auto",
    detail: "enabled_operational",
    test_bypass: false,
  };
}
