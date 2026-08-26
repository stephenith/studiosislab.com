import { randomUUID } from "node:crypto";
import type { JobEventRecord, SaiosJob } from "./types.js";
import type { QueueJobStatus } from "./job-status.js";
import { appendJsonlLine } from "./QueuePersistence.js";
import { resolveQueuePaths } from "./paths.js";

export class QueueEvents {
  private readonly eventsFile: string;

  constructor(eventsFile?: string) {
    this.eventsFile = eventsFile ?? resolveQueuePaths().eventsFile;
  }

  getEventsFile(): string {
    return this.eventsFile;
  }

  async appendTransition(
    job: SaiosJob,
    fromStatus: QueueJobStatus | null,
    toStatus: QueueJobStatus,
    options?: { actor?: string; note?: string; metadata?: Record<string, unknown> },
  ): Promise<JobEventRecord> {
    const record: JobEventRecord = {
      event_id: `EVT-${randomUUID()}`,
      job_id: job.id,
      from_status: fromStatus,
      to_status: toStatus,
      at: new Date().toISOString(),
      actor: options?.actor ?? "queue",
      note: options?.note,
      metadata: options?.metadata,
    };
    await appendJsonlLine(this.eventsFile, record);
    return record;
  }

  async appendCreated(job: SaiosJob, actor = "queue"): Promise<JobEventRecord> {
    return this.appendTransition(job, null, job.status, {
      actor,
      note: "job_created",
      metadata: { title: job.title },
    });
  }
}
