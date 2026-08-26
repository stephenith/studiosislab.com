import { mkdir, appendFile, rename, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import type { SaiosJob } from "./types.js";
import { QueueStorage } from "./QueueStorage.js";

export async function appendJsonlLine(filePath: string, record: unknown): Promise<void> {
  const dir = filePath.replace(/\/[^/]+$/, "");
  await mkdir(dir, { recursive: true });
  await appendFile(filePath, `${JSON.stringify(record)}\n`, "utf8");
}

export class QueuePersistence {
  private readonly storage: QueueStorage;

  constructor(storage: QueueStorage) {
    this.storage = storage;
  }

  getStorage(): QueueStorage {
    return this.storage;
  }

  async loadJob(jobId: string): Promise<SaiosJob | null> {
    const raw = await this.storage.readJobFile(jobId);
    if (!raw) return null;
    return JSON.parse(raw) as SaiosJob;
  }

  async saveJob(job: SaiosJob): Promise<SaiosJob> {
    await this.storage.ensureJobsDir();
    const path = this.storage.jobPath(job.id);
    const tmp = `${path}.tmp.${process.pid}.${Date.now()}`;
    const body = JSON.stringify(job, null, 2);
    await writeFile(tmp, body, "utf8");
    await rename(tmp, path);
    const reloaded = await this.loadJob(job.id);
    if (!reloaded) {
      throw new Error(`QueuePersistence: failed to reload job ${job.id} after save`);
    }
    return reloaded;
  }

  async deleteJob(jobId: string): Promise<void> {
    const path = this.storage.jobPath(jobId);
    if (existsSync(path)) {
      await unlink(path);
    }
  }

  async loadAllJobs(): Promise<SaiosJob[]> {
    const ids = await this.storage.listJobIds();
    const jobs: SaiosJob[] = [];
    for (const id of ids) {
      const job = await this.loadJob(id);
      if (job) jobs.push(job);
    }
    return jobs;
  }
}
