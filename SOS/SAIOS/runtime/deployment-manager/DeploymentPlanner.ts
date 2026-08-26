/**
 * Discover deployable AI OS departments and compute startup order.
 * Read-only — does not modify department modules.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./DeploymentConfiguration.js";
import type { DepartmentId, DeployableDepartment, DeploymentPlan } from "./types.js";

type CatalogEntry = Omit<DeployableDepartment, "available">;

const CATALOG: CatalogEntry[] = [
  {
    id: "event-bus",
    label: "Event Bus",
    module_path: "SOS/SAIOS/runtime/event-bus",
    verify_command: "event-bus:verify",
    depends_on: [],
    log_dir: "SOS/07_LOGS/saios/event-bus",
  },
  {
    id: "runtime-manager",
    label: "Runtime Manager",
    module_path: "SOS/SAIOS/runtime/runtime-manager",
    verify_command: "runtime-manager:verify",
    depends_on: ["event-bus"],
    log_dir: "SOS/07_LOGS/saios/runtime-manager",
  },
  {
    id: "security-department",
    label: "Security Department",
    module_path: "SOS/SAIOS/runtime/security-department",
    verify_command: "security-department:verify",
    depends_on: ["runtime-manager", "event-bus"],
    log_dir: "SOS/07_LOGS/saios/security-department",
  },
  {
    id: "timeline-department",
    label: "Timeline Department",
    module_path: "SOS/SAIOS/runtime/timeline-department",
    verify_command: "timeline-department:verify",
    depends_on: ["event-bus"],
    log_dir: "SOS/07_LOGS/saios/timeline-department",
  },
  {
    id: "notification-department",
    label: "Notification Department",
    module_path: "SOS/SAIOS/runtime/notification-department",
    verify_command: "notification-department:verify",
    depends_on: ["timeline-department", "event-bus"],
    log_dir: "SOS/07_LOGS/saios/notification-department",
  },
  {
    id: "website-department",
    label: "Website Department",
    module_path: "SOS/SAIOS/runtime/website-department",
    verify_command: "website-department:verify",
    depends_on: ["notification-department"],
    log_dir: "SOS/07_LOGS/saios/website-department",
  },
  {
    id: "scheduler",
    label: "Scheduler",
    module_path: "SOS/SAIOS/runtime/scheduler",
    verify_command: "scheduler:verify",
    depends_on: ["website-department"],
  },
  {
    id: "resume-factory",
    label: "Resume Factory",
    module_path: "SOS/SAIOS/runtime/unified-production",
    verify_command: "unified-production:verify",
    depends_on: ["scheduler"],
  },
  {
    id: "production-dashboard",
    label: "Production Dashboard",
    module_path: "SOS/SAIOS/runtime/production-dashboard",
    verify_command: "production-dashboard:verify",
    depends_on: ["resume-factory"],
    log_dir: "SOS/07_LOGS/saios/production-dashboard",
  },
  {
    id: "founder-dashboard",
    label: "Founder Dashboard",
    module_path: "SOS/SAIOS/runtime/founder-dashboard",
    verify_command: "founder-dashboard:verify",
    depends_on: ["production-dashboard"],
  },
  {
    id: "release-manager",
    label: "Release Manager",
    module_path: "SOS/SAIOS/runtime/publication",
    verify_command: "release-manager:verify",
    depends_on: ["founder-dashboard"],
    log_dir: "SOS/07_LOGS/saios/publication",
  },
  {
    id: "catalog-integrity",
    label: "Catalog Integrity",
    module_path: "SOS/SAIOS/runtime/catalog-integrity",
    verify_command: "catalog-integrity:verify",
    depends_on: ["production-dashboard"],
    log_dir: "SOS/07_LOGS/saios/catalog-integrity",
  },
  {
    id: "batch-release",
    label: "Batch Release",
    module_path: "SOS/SAIOS/runtime/batch-release",
    verify_command: "batch-release:verify",
    depends_on: ["release-manager", "catalog-integrity"],
    log_dir: "SOS/07_LOGS/saios/batch-release",
  },
];

export function discoverDepartments(): DeployableDepartment[] {
  return CATALOG.map((dept) => ({
    ...dept,
    available: existsSync(join(REPO_ROOT, dept.module_path)),
  }));
}

export function resolveStartupOrder(
  departments: DeployableDepartment[],
): DepartmentId[] {
  const byId = new Map(departments.map((d) => [d.id, d]));
  const visited = new Set<DepartmentId>();
  const visiting = new Set<DepartmentId>();
  const order: DepartmentId[] = [];

  function visit(id: DepartmentId): void {
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      throw new Error(`Circular dependency involving ${id}`);
    }
    visiting.add(id);
    const dept = byId.get(id);
    if (dept) {
      for (const dep of dept.depends_on) {
        if (byId.has(dep)) visit(dep);
      }
    }
    visiting.delete(id);
    visited.add(id);
    order.push(id);
  }

  for (const dept of departments) {
    visit(dept.id);
  }
  return order;
}

export function buildDeploymentPlan(
  version: string,
  generatedAt: string,
): DeploymentPlan {
  const departments = discoverDepartments();
  const startup_order = resolveStartupOrder(departments);
  const shutdown_order = [...startup_order].reverse();

  return {
    generated_at: generatedAt,
    version,
    department_count: departments.length,
    available_count: departments.filter((d) => d.available).length,
    startup_order,
    shutdown_order,
    departments,
    notes: [
      "No Docker / VPS provisioning in this phase",
      "Scripts invoke npm verify/run targets only — no business logic changes",
      "Event Bus starts first; Batch Release last",
    ],
  };
}
