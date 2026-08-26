import { mkdir, readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { jobFilePath, resolveQueuePaths } from "./paths.js";

export class QueueStorage {
  private readonly jobsDir: string;

  constructor(jobsDir?: string) {
    this.jobsDir = jobsDir ?? resolveQueuePaths().jobsDir;
  }

  getJobsDir(): string {
    return this.jobsDir;
  }

  async ensureJobsDir(): Promise<void> {
    await mkdir(this.jobsDir, { recursive: true });
  }

  jobPath(jobId: string): string {
    return jobFilePath(this.jobsDir, jobId);
  }

  async listJobIds(): Promise<string[]> {
    if (!existsSync(this.jobsDir)) return [];
    const files = await readdir(this.jobsDir);
    return files.filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
  }

  async readJobFile(jobId: string): Promise<string | null> {
    const path = this.jobPath(jobId);
    if (!existsSync(path)) return null;
    return readFile(path, "utf8");
  }

  async jobExists(jobId: string): Promise<boolean> {
    return existsSync(this.jobPath(jobId));
  }
}
