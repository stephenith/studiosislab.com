import { randomBytes } from "node:crypto";
import type { Priority, WorkerId } from "../shared/types.js";
import type { CreateWorkerInput, FactoryWorker } from "./WorkerDefinition.js";
import {
  resolveCapabilities,
  resolveDisplayName,
  resolveParentDirector,
  resolvePriority,
  getWorkerDefinition,
} from "./WorkerCapabilities.js";
import type { FactoryWorkerStatus } from "./WorkerLifecycle.js";

export type WorkerTemplate = {
  worker_type: string;
  display_name: string;
  capabilities: string[];
  priority: Priority;
  parent_director: string;
  metadata: Record<string, unknown>;
};

function generateFactoryWorkerId(workerType: string): WorkerId {
  const slug = workerType.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 20);
  const suffix = randomBytes(3).toString("hex");
  return `WRK-FACT-${slug}-${suffix}`;
}

export function buildWorkerTemplate(input: CreateWorkerInput): WorkerTemplate {
  const def = getWorkerDefinition(input.worker_type);
  if (!def && !input.capabilities?.length) {
    throw new Error(`WorkerTemplate: unknown worker_type "${input.worker_type}"`);
  }

  return {
    worker_type: input.worker_type,
    display_name: resolveDisplayName(input.worker_type, input.display_name),
    capabilities: resolveCapabilities(input.worker_type, input.capabilities),
    priority: resolvePriority(input.worker_type, input.priority),
    parent_director: resolveParentDirector(input.worker_type, input.parent_director),
    metadata: {
      factory: true,
      definition: def?.description ?? "custom worker",
      ...input.metadata,
    },
  };
}

export function materializeWorker(
  template: WorkerTemplate,
  options?: { worker_id?: WorkerId; status?: FactoryWorkerStatus },
): FactoryWorker {
  const now = new Date().toISOString();
  return {
    worker_id: options?.worker_id ?? generateFactoryWorkerId(template.worker_type),
    worker_type: template.worker_type,
    display_name: template.display_name,
    status: options?.status ?? "CREATED",
    capabilities: [...template.capabilities],
    priority: template.priority,
    parent_director: template.parent_director,
    created_at: now,
    updated_at: now,
    heartbeat: null,
    current_job: null,
    metadata: { ...template.metadata },
  };
}

export function cloneTemplateFromWorker(worker: FactoryWorker): WorkerTemplate {
  return {
    worker_type: worker.worker_type,
    display_name: `${worker.display_name} (clone)`,
    capabilities: [...worker.capabilities],
    priority: worker.priority,
    parent_director: worker.parent_director,
    metadata: { ...worker.metadata, cloned_from: worker.worker_id },
  };
}
