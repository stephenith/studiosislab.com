import { randomBytes } from "node:crypto";
import type { JobId, WorkerId } from "../shared/types.js";
import type { RegisterWorkerInput, SaiosWorker, WorkerFilter } from "./types.js";
import {
  isTerminalWorkerStatus,
  VALID_WORKER_STATUS_TRANSITIONS,
  type RegistryWorkerStatus,
} from "./worker-status.js";
import { RegistryStorage } from "./RegistryStorage.js";
import { RegistryPersistence } from "./RegistryPersistence.js";
import { RegistryEvents } from "./RegistryEvents.js";

function generateWorkerId(type: string): WorkerId {
  const slug = type.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 24);
  const suffix = randomBytes(3).toString("hex");
  return `WRK-${slug}-${suffix}`;
}

export class RegistryManager {
  private readonly storage: RegistryStorage;
  private readonly persistence: RegistryPersistence;
  private readonly events: RegistryEvents;

  constructor(options?: { registryDir?: string; eventsFile?: string }) {
    this.storage = new RegistryStorage(options?.registryDir);
    this.persistence = new RegistryPersistence(this.storage);
    this.events = new RegistryEvents(options?.eventsFile);
  }

  getStorage(): RegistryStorage {
    return this.storage;
  }

  getEvents(): RegistryEvents {
    return this.events;
  }

  private async transitionStatus(
    worker: SaiosWorker,
    to: RegistryWorkerStatus,
    note?: string,
    actor = "registry",
  ): Promise<SaiosWorker> {
    const from = worker.status;
    if (from === to) {
      worker.updated_at = new Date().toISOString();
      return this.persistence.saveWorker(worker);
    }

    if (isTerminalWorkerStatus(from)) {
      throw new Error(`RegistryManager: cannot transition from terminal status ${from}`);
    }

    const allowed = VALID_WORKER_STATUS_TRANSITIONS[from];
    if (!allowed.includes(to)) {
      throw new Error(`RegistryManager: invalid transition ${from} → ${to}`);
    }

    worker.status = to;
    worker.updated_at = new Date().toISOString();
    const saved = await this.persistence.saveWorker(worker);
    await this.events.appendStatusChange(saved, from, to, note);
    return this.getWorker(saved.id) as Promise<SaiosWorker>;
  }

  async registerWorker(input: RegisterWorkerInput): Promise<SaiosWorker> {
    let id = input.id ?? generateWorkerId(input.type);
    let attempt = 0;
    while ((await this.persistence.loadWorker(id)) && attempt < 5) {
      id = generateWorkerId(input.type);
      attempt++;
    }
    if (await this.persistence.loadWorker(id)) {
      throw new Error(`RegistryManager: could not allocate unique worker id for type ${input.type}`);
    }

    const parentWorker = input.parent_worker ?? null;
    if (parentWorker) {
      const parent = await this.getWorker(parentWorker);
      if (!parent) {
        throw new Error(`RegistryManager: parent worker not found: ${parentWorker}`);
      }
      if (isTerminalWorkerStatus(parent.status)) {
        throw new Error(`RegistryManager: cannot attach child to retired parent ${parentWorker}`);
      }
    }

    const now = new Date().toISOString();
    const worker: SaiosWorker = {
      id,
      name: input.name,
      type: input.type,
      version: input.version,
      status: input.status ?? "REGISTERED",
      capabilities: [...input.capabilities],
      current_job: null,
      parent_worker: parentWorker,
      child_workers: [],
      created_at: now,
      updated_at: now,
      last_heartbeat: now,
      host: input.host ?? "unknown",
      runtime: input.runtime ?? "saios-v1",
      metadata: input.metadata ?? {},
    };

    const saved = await this.persistence.saveWorker(worker);
    await this.events.appendRegistered(saved);

    if (parentWorker) {
      const parent = await this.getWorker(parentWorker);
      if (parent && !parent.child_workers.includes(saved.id)) {
        parent.child_workers = [...parent.child_workers, saved.id];
        parent.updated_at = new Date().toISOString();
        await this.persistence.saveWorker(parent);
        await this.events.append(parent, "child_registered", {
          note: `child ${saved.id} registered`,
          metadata: { child_id: saved.id },
        });
      }
    }

    return this.getWorker(saved.id) as Promise<SaiosWorker>;
  }

  async getWorker(workerId: WorkerId): Promise<SaiosWorker | null> {
    return this.persistence.loadWorker(workerId);
  }

  async retireWorker(workerId: WorkerId, reason = "retired"): Promise<SaiosWorker> {
    const worker = await this.getWorker(workerId);
    if (!worker) {
      throw new Error(`RegistryManager: worker not found: ${workerId}`);
    }
    if (worker.current_job) {
      throw new Error(`RegistryManager: cannot retire worker ${workerId} while assigned to ${worker.current_job}`);
    }
    worker.current_job = null;
    return this.transitionStatus(worker, "RETIRED", reason, "chief-ai");
  }

  async pauseWorker(workerId: WorkerId, reason = "paused"): Promise<SaiosWorker> {
    const worker = await this.getWorker(workerId);
    if (!worker) {
      throw new Error(`RegistryManager: worker not found: ${workerId}`);
    }
    return this.transitionStatus(worker, "PAUSED", reason);
  }

  async resumeWorker(workerId: WorkerId, note = "resumed"): Promise<SaiosWorker> {
    const worker = await this.getWorker(workerId);
    if (!worker) {
      throw new Error(`RegistryManager: worker not found: ${workerId}`);
    }
    if (worker.status === "REGISTERED") {
      return this.transitionStatus(worker, "IDLE", note);
    }
    if (worker.status !== "PAUSED" && worker.status !== "OFFLINE" && worker.status !== "ERROR") {
      throw new Error(`RegistryManager: cannot resume worker in status ${worker.status}`);
    }
    return this.transitionStatus(worker, "IDLE", note);
  }

  async heartbeat(
    workerId: WorkerId,
    metadata?: Record<string, unknown>,
  ): Promise<SaiosWorker> {
    const worker = await this.getWorker(workerId);
    if (!worker) {
      throw new Error(`RegistryManager: worker not found: ${workerId}`);
    }
    if (isTerminalWorkerStatus(worker.status)) {
      throw new Error(`RegistryManager: cannot heartbeat retired worker ${workerId}`);
    }

    const prev = worker.status;
    worker.last_heartbeat = new Date().toISOString();
    worker.updated_at = worker.last_heartbeat;
    if (metadata) {
      worker.metadata = { ...worker.metadata, ...metadata, last_heartbeat_meta: metadata };
    }

    if (prev === "REGISTERED" || prev === "OFFLINE" || prev === "ERROR") {
      worker.status = "IDLE";
    }

    const saved = await this.persistence.saveWorker(worker);
    await this.events.append(saved, "heartbeat", {
      from_status: prev !== saved.status ? prev : null,
      to_status: saved.status,
      metadata,
    });
    return this.getWorker(saved.id) as Promise<SaiosWorker>;
  }

  async assignJob(workerId: WorkerId, jobId: JobId): Promise<SaiosWorker> {
    const worker = await this.getWorker(workerId);
    if (!worker) {
      throw new Error(`RegistryManager: worker not found: ${workerId}`);
    }
    if (worker.status !== "IDLE") {
      throw new Error(`RegistryManager: worker ${workerId} not idle (status=${worker.status})`);
    }
    if (worker.current_job) {
      throw new Error(`RegistryManager: worker ${workerId} already has job ${worker.current_job}`);
    }

    worker.current_job = jobId;
    const withJob = await this.transitionStatus(worker, "BUSY", `assigned ${jobId}`);
    await this.events.append(withJob, "job_assigned", {
      metadata: { job_id: jobId },
    });
    return this.getWorker(withJob.id) as Promise<SaiosWorker>;
  }

  async releaseJob(workerId: WorkerId, note = "job released"): Promise<SaiosWorker> {
    const worker = await this.getWorker(workerId);
    if (!worker) {
      throw new Error(`RegistryManager: worker not found: ${workerId}`);
    }
    if (!worker.current_job) {
      throw new Error(`RegistryManager: worker ${workerId} has no assigned job`);
    }
    if (worker.status !== "BUSY" && worker.status !== "PAUSED" && worker.status !== "IDLE") {
      throw new Error(`RegistryManager: cannot release job for worker in status ${worker.status}`);
    }

    const releasedJob = worker.current_job;
    worker.current_job = null;
    if (worker.status === "BUSY" || worker.status === "PAUSED") {
      const saved = await this.transitionStatus(worker, "IDLE", note);
      await this.events.append(saved, "job_released", {
        metadata: { job_id: releasedJob },
      });
      return this.getWorker(saved.id) as Promise<SaiosWorker>;
    }

    worker.updated_at = new Date().toISOString();
    const saved = await this.persistence.saveWorker(worker);
    await this.events.append(saved, "job_released", {
      metadata: { job_id: releasedJob },
    });
    return this.getWorker(saved.id) as Promise<SaiosWorker>;
  }

  async listWorkers(filter?: WorkerFilter): Promise<SaiosWorker[]> {
    const all = await this.persistence.loadAllWorkers();
    const filtered = all.filter((w) => {
      if (filter?.status && w.status !== filter.status) return false;
      if (filter?.type && w.type !== filter.type) return false;
      if (filter?.capability && !w.capabilities.includes(filter.capability)) return false;
      return true;
    });
    return filtered.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  async listIdleWorkers(): Promise<SaiosWorker[]> {
    return this.listWorkers({ status: "IDLE" });
  }

  async listBusyWorkers(): Promise<SaiosWorker[]> {
    return this.listWorkers({ status: "BUSY" });
  }

  async listByCapability(capability: string): Promise<SaiosWorker[]> {
    return this.listWorkers({ capability });
  }

  async findWorker(filter: WorkerFilter): Promise<SaiosWorker | null> {
    const list = await this.listWorkers(filter);
    return list[0] ?? null;
  }
}
