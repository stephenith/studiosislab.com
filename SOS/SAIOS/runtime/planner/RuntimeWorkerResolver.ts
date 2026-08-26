/**
 * RuntimeWorkerResolver — Director→Manager→Workers→Skills→Models→Tools (Agent #169).
 * Resolves inventory only. Never invokes.
 */
import type { QueueSubmissionPackage } from "../../core/company-brain/queue-submission-types.js";
import type { ShadowQueueRecord } from "../queue/shadow-queue-types.js";
import type { RuntimeWorkerResolution } from "./runtime-plan-types.js";

/** Known informational inventory for resume production spine (never invoked). */
const KNOWN = {
  directors: ["director-company-brain"],
  managers: ["manager-resume"],
  workers: [
    "worker-designbrief",
    "worker-renderer",
    "worker-critic",
    "worker-editor-compatibility",
    "designbrief",
    "resume-renderer",
    "resume-critic",
  ],
  skills: [
    "resume.layout_planning",
    "resume.critic",
    "resume.render",
    "resume.editor_compatibility",
    "company-brain.planning",
  ],
  models: ["mock-provider"],
  tools: ["brain-router", "firecrawl"],
} as const;

const ALIAS: Record<string, string> = {
  designbrief: "worker-designbrief",
  "resume-renderer": "worker-renderer",
  "resume-critic": "worker-critic",
};

function uniq(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}

function canonicalize(id: string): string {
  return ALIAS[id] ?? id;
}

function missing(required: string[], known: readonly string[]): string[] {
  return required.filter((x) => {
    const c = canonicalize(x);
    return !known.includes(x) && !known.includes(c);
  });
}

export function resolveRuntimeWorkers(
  shadow: ShadowQueueRecord,
  submission: QueueSubmissionPackage,
): RuntimeWorkerResolution {
  const workers = uniq([
    ...KNOWN.workers.filter((w) => w.startsWith("worker-")),
    ...submission.worker_inventory.map(canonicalize),
    ...(submission.worker_graph?.nodes
      .filter((n) => n.kind === "worker")
      .map((n) => canonicalize(n.id)) ?? []),
  ]);
  const skills = uniq([
    ...KNOWN.skills,
    ...submission.skill_inventory,
    ...(submission.worker_graph?.nodes
      .filter((n) => n.kind === "skill")
      .map((n) => n.id) ?? []),
  ]);
  const models = uniq([
    ...KNOWN.models,
    ...submission.provider_inventory,
    ...(submission.worker_graph?.nodes
      .filter((n) => n.kind === "model")
      .map((n) => n.id) ?? []),
  ]);
  const tools = uniq([
    ...KNOWN.tools,
    ...submission.tool_inventory,
    ...(submission.worker_graph?.nodes
      .filter((n) => n.kind === "tool")
      .map((n) => n.id) ?? []),
  ]);

  const directors = [...KNOWN.directors];
  const managers = [...KNOWN.managers];

  const missing_workers = missing(submission.worker_inventory, KNOWN.workers);
  const missing_skills = missing(submission.skill_inventory, KNOWN.skills);
  const missing_models = missing(submission.provider_inventory, KNOWN.models);
  const missing_tools = missing(submission.tool_inventory, KNOWN.tools);

  const worker_order = [
    ...directors,
    ...managers,
    ...workers,
    ...skills,
    ...models,
    ...tools,
  ];

  void shadow;

  return {
    director: directors,
    managers,
    workers,
    skills,
    models,
    tools,
    worker_order,
    missing_workers,
    missing_skills,
    missing_models,
    missing_tools,
    note: `Resolved for ${submission.department} · never invoked · planning only`,
  };
}
