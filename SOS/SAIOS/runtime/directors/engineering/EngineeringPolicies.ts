import type { EngineeringWorkerTypeDefinition } from "./types.js";

/**
 * Supported engineering worker type definitions (registry metadata only — not implemented).
 */
export const ENGINEERING_WORKER_TYPES: EngineeringWorkerTypeDefinition[] = [
  {
    id: "resume-worker",
    name: "Resume Worker",
    capability: "resume",
    description: "ATS resume and CV template engineering",
  },
  {
    id: "invoice-worker",
    name: "Invoice Worker",
    capability: "invoice",
    description: "Invoice template and billing document engineering",
  },
  {
    id: "portfolio-worker",
    name: "Portfolio Worker",
    capability: "portfolio",
    description: "Portfolio and showcase template engineering",
  },
  {
    id: "cover-letter-worker",
    name: "Cover Letter Worker",
    capability: "cover-letter",
    description: "Cover letter template engineering",
  },
  {
    id: "pdf-worker",
    name: "PDF Worker",
    capability: "pdf",
    description: "PDF layout and export engineering",
  },
  {
    id: "firebase-worker",
    name: "Firebase Worker",
    capability: "firebase",
    description: "Firebase integration engineering",
  },
  {
    id: "authentication-worker",
    name: "Authentication Worker",
    capability: "authentication",
    description: "Authentication flow engineering",
  },
  {
    id: "seo-worker",
    name: "SEO Worker",
    capability: "seo",
    description: "SEO and metadata engineering",
  },
  {
    id: "ui-worker",
    name: "UI Worker",
    capability: "ui",
    description: "User interface engineering",
  },
  {
    id: "api-worker",
    name: "API Worker",
    capability: "api",
    description: "API and service contract engineering",
  },
  {
    id: "testing-worker",
    name: "Testing Worker",
    capability: "testing",
    description: "Verification and QA engineering",
  },
  {
    id: "documentation-worker",
    name: "Documentation Worker",
    capability: "documentation",
    description: "Technical documentation engineering",
  },
];

export const FORBIDDEN_DIRECTOR_ACTIONS = [
  "edit_code",
  "call_cursor",
  "modify_product",
  "run_shell",
  "spawn_cursor_agent",
] as const;

export type ForbiddenDirectorAction = (typeof FORBIDDEN_DIRECTOR_ACTIONS)[number];

export function getWorkerTypeById(id: string): EngineeringWorkerTypeDefinition | undefined {
  return ENGINEERING_WORKER_TYPES.find((w) => w.id === id);
}

export function getWorkerTypeByCapability(capability: string): EngineeringWorkerTypeDefinition | undefined {
  return ENGINEERING_WORKER_TYPES.find((w) => w.capability === capability);
}

/**
 * Engineering Director MUST NEVER perform forbidden actions.
 * Orchestration only.
 */
export function assertAllowedDirectorAction(action: string): void {
  if ((FORBIDDEN_DIRECTOR_ACTIONS as readonly string[]).includes(action)) {
    throw new Error(
      `EngineeringPolicies: director action "${action}" is forbidden — orchestration only`,
    );
  }
}

export function directorScopeNote(): string {
  return [
    "Engineering Director orchestrates only.",
    "Never edits code, calls Cursor, modifies product, or runs shell commands.",
  ].join(" ");
}
