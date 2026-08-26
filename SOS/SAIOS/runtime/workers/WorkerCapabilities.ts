import type { Priority } from "../shared/types.js";
import type { WorkerDefinitionRecord } from "./WorkerDefinition.js";

/**
 * Built-in worker type catalog (definitions only — no business logic).
 */
export const BUILTIN_WORKER_DEFINITIONS: WorkerDefinitionRecord[] = [
  {
    worker_type: "resume-worker",
    display_name: "Resume Worker",
    default_capabilities: ["resume", "templates"],
    default_priority: "P2",
    description: "ATS resume and CV template engineering",
    parent_director: "engineering-director",
  },
  {
    worker_type: "invoice-worker",
    display_name: "Invoice Worker",
    default_capabilities: ["invoice", "templates"],
    default_priority: "P2",
    description: "Invoice template engineering",
    parent_director: "engineering-director",
  },
  {
    worker_type: "portfolio-worker",
    display_name: "Portfolio Worker",
    default_capabilities: ["portfolio", "templates"],
    default_priority: "P2",
    description: "Portfolio template engineering",
    parent_director: "engineering-director",
  },
  {
    worker_type: "seo-worker",
    display_name: "SEO Worker",
    default_capabilities: ["seo", "metadata"],
    default_priority: "P2",
    description: "SEO and metadata engineering",
    parent_director: "engineering-director",
  },
  {
    worker_type: "ui-worker",
    display_name: "UI Worker",
    default_capabilities: ["ui", "design"],
    default_priority: "P2",
    description: "User interface engineering",
    parent_director: "engineering-director",
  },
  {
    worker_type: "api-worker",
    display_name: "API Worker",
    default_capabilities: ["api", "integration"],
    default_priority: "P2",
    description: "API engineering",
    parent_director: "engineering-director",
  },
  {
    worker_type: "firebase-worker",
    display_name: "Firebase Worker",
    default_capabilities: ["firebase", "backend"],
    default_priority: "P2",
    description: "Firebase integration engineering",
    parent_director: "engineering-director",
  },
  {
    worker_type: "testing-worker",
    display_name: "Testing Worker",
    default_capabilities: ["testing", "verify"],
    default_priority: "P1",
    description: "Verification and QA engineering",
    parent_director: "engineering-director",
  },
  {
    worker_type: "documentation-worker",
    display_name: "Documentation Worker",
    default_capabilities: ["documentation", "writing"],
    default_priority: "P2",
    description: "Technical documentation engineering",
    parent_director: "engineering-director",
  },
  {
    worker_type: "marketing-worker",
    display_name: "Marketing Worker",
    default_capabilities: ["marketing", "content"],
    default_priority: "P3",
    description: "Marketing content engineering",
    parent_director: "engineering-director",
  },
  {
    worker_type: "research-worker",
    display_name: "Research Worker",
    default_capabilities: ["research", "analysis"],
    default_priority: "P2",
    description: "Research and discovery engineering",
    parent_director: "engineering-director",
  },
  {
    worker_type: "analytics-worker",
    display_name: "Analytics Worker",
    default_capabilities: ["analytics", "metrics"],
    default_priority: "P2",
    description: "Analytics and metrics engineering",
    parent_director: "engineering-director",
  },
];

export function getWorkerDefinition(workerType: string): WorkerDefinitionRecord | undefined {
  return BUILTIN_WORKER_DEFINITIONS.find((d) => d.worker_type === workerType);
}

export function listWorkerDefinitions(): WorkerDefinitionRecord[] {
  return [...BUILTIN_WORKER_DEFINITIONS];
}

export function resolveCapabilities(
  workerType: string,
  override?: string[],
): string[] {
  if (override && override.length > 0) return [...override];
  const def = getWorkerDefinition(workerType);
  return def ? [...def.default_capabilities] : ["general"];
}

export function resolvePriority(workerType: string, override?: Priority): Priority {
  if (override) return override;
  return getWorkerDefinition(workerType)?.default_priority ?? "P2";
}

export function resolveDisplayName(workerType: string, override?: string): string {
  if (override) return override;
  return getWorkerDefinition(workerType)?.display_name ?? workerType;
}

export function resolveParentDirector(workerType: string, override?: string | null): string {
  if (override !== undefined && override !== null) return override;
  return getWorkerDefinition(workerType)?.parent_director ?? "engineering-director";
}
