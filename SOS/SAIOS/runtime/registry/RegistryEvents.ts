import { randomUUID } from "node:crypto";
import type { RegistryEventRecord, SaiosWorker } from "./types.js";
import type { RegistryWorkerStatus } from "./worker-status.js";
import { appendRegistryJsonl } from "./RegistryPersistence.js";
import { resolveRegistryPaths } from "./paths.js";

export class RegistryEvents {
  private readonly eventsFile: string;

  constructor(eventsFile?: string) {
    this.eventsFile = eventsFile ?? resolveRegistryPaths().eventsFile;
  }

  getEventsFile(): string {
    return this.eventsFile;
  }

  async append(
    worker: SaiosWorker,
    action: string,
    options?: {
      from_status?: RegistryWorkerStatus | null;
      to_status?: RegistryWorkerStatus | null;
      actor?: string;
      note?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<RegistryEventRecord> {
    const record: RegistryEventRecord = {
      event_id: `REG-EVT-${randomUUID()}`,
      worker_id: worker.id,
      action,
      from_status: options?.from_status ?? null,
      to_status: options?.to_status ?? worker.status,
      at: new Date().toISOString(),
      actor: options?.actor ?? "registry",
      note: options?.note,
      metadata: options?.metadata,
    };
    await appendRegistryJsonl(this.eventsFile, record);
    return record;
  }

  async appendRegistered(worker: SaiosWorker): Promise<RegistryEventRecord> {
    return this.append(worker, "worker_registered", {
      to_status: worker.status,
      note: "worker_registered",
      metadata: { type: worker.type, capabilities: worker.capabilities },
    });
  }

  async appendStatusChange(
    worker: SaiosWorker,
    from: RegistryWorkerStatus,
    to: RegistryWorkerStatus,
    note?: string,
  ): Promise<RegistryEventRecord> {
    return this.append(worker, "status_change", {
      from_status: from,
      to_status: to,
      note,
    });
  }
}
