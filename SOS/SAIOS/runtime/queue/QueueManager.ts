import type { JobId, Priority, WorkerId } from "../shared/types.js";
import type { CreateJobInput, JobStatusUpdate, SaiosJob } from "./types.js";
import {
  TERMINAL_JOB_STATUSES,
  VALID_STATUS_TRANSITIONS,
  type QueueJobStatus,
} from "./job-status.js";
import { QueueStorage } from "./QueueStorage.js";
import { QueuePersistence } from "./QueuePersistence.js";
import { QueueEvents } from "./QueueEvents.js";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function generateJobId(title: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp =
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}-` +
    `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
  const slug = slugify(title) || "job";
  return `JOB-${stamp}-${slug}`;
}

function isTerminal(status: QueueJobStatus): boolean {
  return (TERMINAL_JOB_STATUSES as readonly string[]).includes(status);
}

export class QueueManager {
  private readonly storage: QueueStorage;
  private readonly persistence: QueuePersistence;
  private readonly events: QueueEvents;

  constructor(options?: { jobsDir?: string; eventsFile?: string }) {
    this.storage = new QueueStorage(options?.jobsDir);
    const eventsFile = options?.eventsFile;
    this.persistence = new QueuePersistence(this.storage);
    this.events = new QueueEvents(eventsFile);
  }

  getStorage(): QueueStorage {
    return this.storage;
  }

  getEvents(): QueueEvents {
    return this.events;
  }

  async createJob(input: CreateJobInput): Promise<SaiosJob> {
    const now = new Date().toISOString();
    let id = input.id ?? generateJobId(input.title);
    let attempt = 0;
    while ((await this.persistence.loadJob(id)) && attempt < 5) {
      await new Promise((r) => setTimeout(r, 5));
      id = generateJobId(input.title);
      attempt++;
    }
    if (await this.persistence.loadJob(id)) {
      throw new Error(`QueueManager: could not allocate unique job id for "${input.title}"`);
    }

    const parentJob = input.parent_job ?? null;
    if (parentJob) {
      const parent = await this.loadJob(parentJob);
      if (!parent) {
        throw new Error(`QueueManager: parent job not found: ${parentJob}`);
      }
    }

    for (const depId of input.dependencies ?? []) {
      const dep = await this.loadJob(depId);
      if (!dep) {
        throw new Error(`QueueManager: dependency job not found: ${depId}`);
      }
    }

    const job: SaiosJob = {
      id,
      title: input.title,
      description: input.description,
      priority: input.priority ?? "P2",
      creator: input.creator ?? "system",
      assigned_worker: input.assigned_worker ?? null,
      status: input.status ?? "QUEUED",
      parent_job: parentJob,
      child_jobs: [],
      dependencies: input.dependencies ?? [],
      created_at: now,
      updated_at: now,
      started_at: null,
      completed_at: null,
      report_path: input.report_path ?? null,
      artifacts: input.artifacts ?? [],
      metadata: input.metadata ?? {},
    };

    const saved = await this.persistence.saveJob(job);
    await this.events.appendCreated(saved, saved.creator);

    if (parentJob) {
      const parent = await this.loadJob(parentJob);
      if (parent && !parent.child_jobs.includes(saved.id)) {
        parent.child_jobs = [...parent.child_jobs, saved.id];
        parent.updated_at = new Date().toISOString();
        await this.persistence.saveJob(parent);
      }
    }

    return this.loadJob(saved.id) as Promise<SaiosJob>;
  }

  async loadJob(jobId: JobId): Promise<SaiosJob | null> {
    return this.persistence.loadJob(jobId);
  }

  async saveJob(job: SaiosJob): Promise<SaiosJob> {
    const existing = await this.loadJob(job.id);
    if (!existing) {
      throw new Error(`QueueManager: cannot save unknown job ${job.id}`);
    }
    job.updated_at = new Date().toISOString();
    return this.persistence.saveJob(job);
  }

  async updateStatus(
    jobId: JobId,
    update: JobStatusUpdate,
    actor = "queue",
  ): Promise<SaiosJob> {
    const job = await this.loadJob(jobId);
    if (!job) {
      throw new Error(`QueueManager: job not found: ${jobId}`);
    }

    const from = job.status;
    const to = update.status;

    if (from === to) {
      if (update.report_path !== undefined) job.report_path = update.report_path;
      if (update.artifacts) job.artifacts = [...job.artifacts, ...update.artifacts];
      if (update.note) {
        job.metadata = { ...job.metadata, last_note: update.note };
      }
      job.updated_at = new Date().toISOString();
      return this.persistence.saveJob(job);
    }

    if (isTerminal(from)) {
      throw new Error(`QueueManager: cannot transition from terminal status ${from}`);
    }

    const allowed = VALID_STATUS_TRANSITIONS[from];
    if (!allowed.includes(to)) {
      throw new Error(`QueueManager: invalid transition ${from} → ${to}`);
    }

    if (to === "RUNNING" && !job.started_at) {
      job.started_at = new Date().toISOString();
    }

    if (isTerminal(to)) {
      job.completed_at = new Date().toISOString();
    }

    if (update.report_path !== undefined) {
      job.report_path = update.report_path;
    }
    if (update.artifacts?.length) {
      job.artifacts = [...job.artifacts, ...update.artifacts];
    }

    job.status = to;
    job.updated_at = new Date().toISOString();
    if (update.note) {
      job.metadata = { ...job.metadata, last_note: update.note };
    }

    const saved = await this.persistence.saveJob(job);
    await this.events.appendTransition(saved, from, to, { actor, note: update.note });
    return this.loadJob(saved.id) as Promise<SaiosJob>;
  }

  async assignWorker(jobId: JobId, workerId: WorkerId): Promise<SaiosJob> {
    const job = await this.loadJob(jobId);
    if (!job) {
      throw new Error(`QueueManager: job not found: ${jobId}`);
    }
    if (isTerminal(job.status)) {
      throw new Error(`QueueManager: cannot assign worker to terminal job ${jobId}`);
    }
    job.assigned_worker = workerId;
    job.updated_at = new Date().toISOString();
    return this.persistence.saveJob(job);
  }

  async listJobs(filter?: { status?: QueueJobStatus }): Promise<SaiosJob[]> {
    const all = await this.persistence.loadAllJobs();
    if (!filter?.status) return all.sort((a, b) => a.created_at.localeCompare(b.created_at));
    return all.filter((j) => j.status === filter.status).sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  async listRunningJobs(): Promise<SaiosJob[]> {
    const all = await this.persistence.loadAllJobs();
    return all
      .filter((j) => j.status === "RUNNING" || j.status === "PLANNING" || j.status === "WAITING_QA")
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  async listQueuedJobs(): Promise<SaiosJob[]> {
    return this.listJobs({ status: "QUEUED" });
  }

  async cancelJob(jobId: JobId, reason: string): Promise<SaiosJob> {
    return this.updateStatus(jobId, { status: "CANCELLED", note: reason }, "chief-ai");
  }

  async completeJob(jobId: JobId, reportPath?: string): Promise<SaiosJob> {
    let job = await this.loadJob(jobId);
    if (!job) {
      throw new Error(`QueueManager: job not found: ${jobId}`);
    }

    if (job.status === "RUNNING") {
      job = await this.updateStatus(jobId, { status: "WAITING_QA", note: "ready for qa" });
    }

    if (job.status !== "WAITING_QA") {
      throw new Error(`QueueManager: cannot complete job in status ${job.status}`);
    }

    return this.updateStatus(
      jobId,
      {
        status: "COMPLETED",
        report_path: reportPath ?? job.report_path,
        note: "completed",
      },
      "qa-runner",
    );
  }

  async failJob(jobId: JobId, reason: string, reportPath?: string): Promise<SaiosJob> {
    const job = await this.loadJob(jobId);
    if (!job) {
      throw new Error(`QueueManager: job not found: ${jobId}`);
    }

    if (job.status === "QUEUED" || job.status === "PLANNING") {
      throw new Error(`QueueManager: use cancelJob() for status ${job.status}`);
    }

    return this.updateStatus(
      jobId,
      { status: "FAILED", report_path: reportPath ?? job.report_path, note: reason },
      "qa-runner",
    );
  }

  /** Skeleton-compatible helpers */
  async enqueue(input: CreateJobInput): Promise<SaiosJob> {
    return this.createJob(input);
  }
}

export function comparePriority(a: Priority, b: Priority): number {
  const order: Record<Priority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
  return order[a] - order[b];
}
