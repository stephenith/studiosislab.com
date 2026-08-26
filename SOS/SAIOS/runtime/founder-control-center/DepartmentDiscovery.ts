/**
 * Discover AI OS departments for the Founder Control Center (read-only).
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./FounderControlConfiguration.js";
import { readJsonSafe } from "./fcc-utils.js";
import type { DiscoveredDepartment } from "./types.js";

type CatalogEntry = Omit<DiscoveredDepartment, "available" | "status">;

const CATALOG: CatalogEntry[] = [
  {
    id: "runtime-manager",
    label: "Runtime Manager",
    module_path: "SOS/SAIOS/runtime/runtime-manager",
    log_dir: "SOS/07_LOGS/saios/runtime-manager",
  },
  {
    id: "security-department",
    label: "Security Department",
    module_path: "SOS/SAIOS/runtime/security-department",
    log_dir: "SOS/07_LOGS/saios/security-department",
  },
  {
    id: "website-department",
    label: "Website Department",
    module_path: "SOS/SAIOS/runtime/website-department",
    log_dir: "SOS/07_LOGS/saios/website-department",
  },
  {
    id: "timeline-department",
    label: "Timeline Department",
    module_path: "SOS/SAIOS/runtime/timeline-department",
    log_dir: "SOS/07_LOGS/saios/timeline-department",
  },
  {
    id: "notification-department",
    label: "Notification Department",
    module_path: "SOS/SAIOS/runtime/notification-department",
    log_dir: "SOS/07_LOGS/saios/notification-department",
  },
  {
    id: "event-bus",
    label: "Event Bus",
    module_path: "SOS/SAIOS/runtime/event-bus",
    log_dir: "SOS/07_LOGS/saios/event-bus",
  },
  {
    id: "production-dashboard",
    label: "Production Dashboard",
    module_path: "SOS/SAIOS/runtime/production-dashboard",
    log_dir: "SOS/07_LOGS/saios/production-dashboard",
  },
  {
    id: "factory-state",
    label: "Factory State",
    module_path: "SOS/SAIOS/runtime/factory-state",
    log_dir: null,
  },
  {
    id: "resume-factory",
    label: "Resume Factory",
    module_path: "SOS/SAIOS/runtime/unified-production",
    log_dir: null,
  },
  {
    id: "scheduler",
    label: "Scheduler",
    module_path: "SOS/SAIOS/runtime/scheduler",
    log_dir: "SOS/07_LOGS/saios/scheduler",
  },
  {
    id: "founder-dashboard",
    label: "Founder Dashboard",
    module_path: "SOS/SAIOS/runtime/founder-dashboard",
    log_dir: null,
  },
  {
    id: "release-manager",
    label: "Release Manager",
    module_path: "SOS/SAIOS/runtime/publication",
    log_dir: "SOS/07_LOGS/saios/publication",
  },
  {
    id: "catalog-integrity",
    label: "Catalog Integrity",
    module_path: "SOS/SAIOS/runtime/catalog-integrity",
    log_dir: "SOS/07_LOGS/saios/catalog-integrity",
  },
  {
    id: "batch-release",
    label: "Batch Release",
    module_path: "SOS/SAIOS/runtime/batch-release",
    log_dir: "SOS/07_LOGS/saios/batch-release",
  },
  {
    id: "deployment-manager",
    label: "Deployment Manager",
    module_path: "SOS/SAIOS/runtime/deployment-manager",
    log_dir: "SOS/07_LOGS/saios/deployment-manager",
  },
];

function statusFromOps(id: string): string {
  const state = readJsonSafe<{
    operations?: Record<string, { status?: string; health?: string }>;
    factory_v1?: { status?: string };
  }>("SOS/project-state.json");
  const ops = state.data?.operations ?? {};
  const map: Record<string, string | undefined> = {
    "runtime-manager": ops.runtime_manager?.status ?? ops.runtime_manager?.health,
    "security-department": ops.security_department?.status,
    "website-department": ops.website_department?.status,
    "timeline-department": ops.timeline_department?.status,
    "notification-department": ops.notification_department?.status,
    "event-bus": ops.event_bus?.status,
    "deployment-manager": ops.deployment_manager?.status,
    "production-dashboard": ops.production_dashboard?.status,
    "catalog-integrity": ops.catalog_integrity?.safe_to_publish ? "READY" : undefined,
    "batch-release": ops.batch_release?.mode,
    "factory-state": state.data?.factory_v1?.status,
    "resume-factory": state.data?.factory_v1?.status,
  };
  return map[id] ?? (existsSync(join(REPO_ROOT, CATALOG.find((c) => c.id === id)?.module_path ?? "")) ? "AVAILABLE" : "MISSING");
}

export function discoverDepartments(): DiscoveredDepartment[] {
  return CATALOG.map((entry) => ({
    ...entry,
    available: existsSync(join(REPO_ROOT, entry.module_path)),
    status: statusFromOps(entry.id),
  }));
}
