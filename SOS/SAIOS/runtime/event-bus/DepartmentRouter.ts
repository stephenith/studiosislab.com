/**
 * Discover and register AI OS departments for event routing.
 * Read-only discovery — does not modify department modules.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./EventConfiguration.js";
import type { DepartmentId, EventType, RegisteredDepartment } from "./types.js";

type CatalogEntry = Omit<RegisteredDepartment, "available" | "registered">;

const CATALOG: CatalogEntry[] = [
  {
    id: "runtime-manager",
    label: "Runtime Manager",
    module_path: "SOS/SAIOS/runtime/runtime-manager",
    subscribed_events: [
      "SYSTEM_START",
      "SYSTEM_STOP",
      "SYSTEM_HEALTHY",
      "SYSTEM_WARNING",
      "SYSTEM_CRITICAL",
      "RUNTIME_RESTART",
    ],
  },
  {
    id: "security-department",
    label: "Security Department",
    module_path: "SOS/SAIOS/runtime/security-department",
    subscribed_events: [
      "SECURITY_WARNING",
      "SECURITY_CRITICAL",
      "SYSTEM_WARNING",
      "SYSTEM_CRITICAL",
    ],
  },
  {
    id: "timeline-department",
    label: "Timeline Department",
    module_path: "SOS/SAIOS/runtime/timeline-department",
    subscribed_events: [
      "TIMELINE_REMINDER",
      "FOUNDER_REVIEW_PENDING",
      "SECURITY_WARNING",
      "SECURITY_CRITICAL",
    ],
  },
  {
    id: "notification-department",
    label: "Notification Department",
    module_path: "SOS/SAIOS/runtime/notification-department",
    subscribed_events: [
      "NOTIFICATION_READY",
      "SECURITY_WARNING",
      "SECURITY_CRITICAL",
      "WEBSITE_WARNING",
      "SYSTEM_WARNING",
      "SYSTEM_CRITICAL",
      "FOUNDER_REVIEW_PENDING",
      "PUBLICATION_RELEASED",
      "TIMELINE_REMINDER",
    ],
  },
  {
    id: "website-department",
    label: "Website Department",
    module_path: "SOS/SAIOS/runtime/website-department",
    subscribed_events: ["WEBSITE_WARNING", "WEBSITE_HEALTHY"],
  },
  {
    id: "resume-factory",
    label: "Resume Factory",
    module_path: "SOS/SAIOS/runtime/unified-production",
    subscribed_events: ["PUBLICATION_READY", "BATCH_COMPLETED"],
  },
  {
    id: "scheduler",
    label: "Scheduler",
    module_path: "SOS/SAIOS/runtime/scheduler",
    subscribed_events: ["SYSTEM_START", "BATCH_COMPLETED", "TIMELINE_REMINDER"],
  },
  {
    id: "production-dashboard",
    label: "Production Dashboard",
    module_path: "SOS/SAIOS/runtime/production-dashboard",
    subscribed_events: [
      "SYSTEM_HEALTHY",
      "SYSTEM_WARNING",
      "SECURITY_WARNING",
      "PUBLICATION_RELEASED",
      "BATCH_COMPLETED",
      "*",
    ] as Array<EventType | "*">,
  },
  {
    id: "founder-dashboard",
    label: "Founder Dashboard",
    module_path: "SOS/SAIOS/runtime/founder-dashboard",
    subscribed_events: [
      "FOUNDER_REVIEW_PENDING",
      "PUBLICATION_READY",
      "PUBLICATION_RELEASED",
      "SYSTEM_CRITICAL",
    ],
  },
  {
    id: "catalog-integrity",
    label: "Catalog Integrity",
    module_path: "SOS/SAIOS/runtime/catalog-integrity",
    subscribed_events: ["PUBLICATION_READY", "PUBLICATION_RELEASED"],
  },
  {
    id: "batch-release",
    label: "Batch Release",
    module_path: "SOS/SAIOS/runtime/batch-release",
    subscribed_events: ["BATCH_COMPLETED", "PUBLICATION_READY"],
  },
];

export function discoverDepartments(): RegisteredDepartment[] {
  return CATALOG.map((dept) => ({
    ...dept,
    available: existsSync(join(REPO_ROOT, dept.module_path)),
    registered: true as const,
  }));
}

export function listDepartmentIds(
  departments = discoverDepartments(),
): DepartmentId[] {
  return departments.map((d) => d.id);
}

export function departmentRoutingDocument(
  departments: RegisteredDepartment[],
  generatedAt: string,
) {
  return {
    generated_at: generatedAt,
    department_count: departments.length,
    available_count: departments.filter((d) => d.available).length,
    routing: departments.map((d) => ({
      id: d.id,
      label: d.label,
      module_path: d.module_path,
      available: d.available,
      subscribed_events: d.subscribed_events,
    })),
  };
}
