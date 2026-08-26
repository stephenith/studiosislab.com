/**
 * Discovers and registers AI OS departments — register only, never modify.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./RuntimeConfiguration.js";
import type { DepartmentId, RegisteredDepartment } from "./types.js";

const CATALOG: Array<Omit<RegisteredDepartment, "available" | "registered">> = [
  {
    id: "factory-state",
    label: "Factory State",
    module_path: "SOS/SAIOS/runtime/factory-state",
    verify_command: "factory-state:verify",
    depends_on: [],
  },
  {
    id: "timeline-department",
    label: "Timeline Department",
    module_path: "SOS/SAIOS/runtime/timeline-department",
    verify_command: "timeline-department:verify",
    depends_on: ["factory-state"],
  },
  {
    id: "notification-department",
    label: "Notification Department",
    module_path: "SOS/SAIOS/runtime/notification-department",
    verify_command: "notification-department:verify",
    depends_on: ["timeline-department"],
  },
  {
    id: "website-department",
    label: "Website Department",
    module_path: "SOS/SAIOS/runtime/website-department",
    verify_command: "website-department:verify",
    depends_on: ["notification-department"],
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
    depends_on: ["resume-factory", "factory-state"],
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
  },
  {
    id: "batch-release",
    label: "Batch Release",
    module_path: "SOS/SAIOS/runtime/batch-release",
    verify_command: "batch-release:verify",
    depends_on: ["release-manager", "catalog-integrity"],
  },
  {
    id: "catalog-integrity",
    label: "Catalog Integrity",
    module_path: "SOS/SAIOS/runtime/catalog-integrity",
    verify_command: "catalog-integrity:verify",
    depends_on: ["production-dashboard"],
  },
];

export function discoverAndRegisterDepartments(): RegisteredDepartment[] {
  return CATALOG.map((dept) => ({
    ...dept,
    available: existsSync(join(REPO_ROOT, dept.module_path)),
    registered: true as const,
  }));
}

export function listDepartmentIds(departments = discoverAndRegisterDepartments()): DepartmentId[] {
  return departments.map((d) => d.id);
}
