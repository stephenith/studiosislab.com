/**
 * Validate deployment plan, dependencies, folders, and core departments.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./DeploymentConfiguration.js";
import type {
  DeploymentPlan,
  EnvironmentCheck,
  ValidationCheck,
} from "./types.js";

const REQUIRED_FOLDERS = [
  "SOS",
  "SOS/SAIOS/runtime",
  "SOS/07_LOGS/saios",
  "SOS/SAIOS/runtime/runtime-manager",
  "SOS/SAIOS/runtime/security-department",
  "SOS/SAIOS/runtime/timeline-department",
  "SOS/SAIOS/runtime/notification-department",
  "SOS/SAIOS/runtime/website-department",
  "SOS/SAIOS/runtime/event-bus",
];

const REQUIRED_REPORTS: Array<{ id: string; path: string }> = [
  {
    id: "runtime-state",
    path: "SOS/07_LOGS/saios/runtime-manager/runtime-state.json",
  },
  {
    id: "security-health",
    path: "SOS/07_LOGS/saios/security-department/security-health.json",
  },
  {
    id: "event-registry",
    path: "SOS/07_LOGS/saios/event-bus/event-registry.json",
  },
  {
    id: "timeline-state",
    path: "SOS/07_LOGS/saios/timeline-department/timeline-state.json",
  },
  {
    id: "notification-report",
    path: "SOS/07_LOGS/saios/notification-department/notification-report.md",
  },
  {
    id: "website-health",
    path: "SOS/07_LOGS/saios/website-department/website-health.json",
  },
];

const CORE_DEPARTMENTS = [
  "event-bus",
  "runtime-manager",
  "security-department",
  "notification-department",
  "timeline-department",
  "website-department",
] as const;

export function validateDeployment(input: {
  plan: DeploymentPlan;
  environment: EnvironmentCheck;
}): ValidationCheck[] {
  const { plan, environment } = input;
  const checks: ValidationCheck[] = [];

  const orderComplete =
    plan.startup_order.length === plan.departments.length &&
    plan.startup_order[0] === "event-bus";
  checks.push({
    id: "startup-order",
    label: "startup order",
    pass: orderComplete,
    detail: plan.startup_order.join(" → "),
  });

  const depsOk = plan.departments.every((d) =>
    d.depends_on.every((dep) => plan.departments.some((x) => x.id === dep)),
  );
  checks.push({
    id: "runtime-dependencies",
    label: "runtime dependencies",
    pass: depsOk,
    detail: `${plan.departments.length} departments with resolved depends_on`,
  });

  const missingFolders = REQUIRED_FOLDERS.filter(
    (rel) => !existsSync(join(REPO_ROOT, rel)),
  );
  checks.push({
    id: "required-folders",
    label: "required folders",
    pass: missingFolders.length === 0,
    detail:
      missingFolders.length === 0
        ? `${REQUIRED_FOLDERS.length} folders present`
        : `missing: ${missingFolders.join(", ")}`,
  });

  const missingReports = REQUIRED_REPORTS.filter(
    (r) => !existsSync(join(REPO_ROOT, r.path)),
  );
  checks.push({
    id: "required-reports",
    label: "required reports",
    pass: missingReports.length === 0,
    detail:
      missingReports.length === 0
        ? `${REQUIRED_REPORTS.length} reports present`
        : `missing: ${missingReports.map((r) => r.id).join(", ")}`,
  });

  const configPaths = [
    "SOS/project-state.json",
    "SOS/SAIOS/runtime/event-bus/package.json",
    "SOS/SAIOS/runtime/runtime-manager/package.json",
  ];
  const missingConfigs = configPaths.filter(
    (rel) => !existsSync(join(REPO_ROOT, rel)),
  );
  checks.push({
    id: "required-configs",
    label: "required configs",
    pass: missingConfigs.length === 0,
    detail:
      missingConfigs.length === 0
        ? "project-state + core package.json present"
        : `missing: ${missingConfigs.join(", ")}`,
  });

  checks.push({
    id: "node-version",
    label: "Node version",
    pass: environment.node_ok,
    detail: environment.node_version,
  });

  for (const id of CORE_DEPARTMENTS) {
    const dept = plan.departments.find((d) => d.id === id);
    checks.push({
      id: id,
      label: id.replace(/-/g, " "),
      pass: Boolean(dept?.available),
      detail: dept?.module_path ?? "not in plan",
    });
  }

  return checks;
}
