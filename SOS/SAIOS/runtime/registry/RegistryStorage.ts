import { mkdir, readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { workerFilePath, resolveRegistryPaths } from "./paths.js";

export class RegistryStorage {
  private readonly registryDir: string;

  constructor(registryDir?: string) {
    this.registryDir = registryDir ?? resolveRegistryPaths().registryDir;
  }

  getRegistryDir(): string {
    return this.registryDir;
  }

  async ensureRegistryDir(): Promise<void> {
    await mkdir(this.registryDir, { recursive: true });
  }

  workerPath(workerId: string): string {
    return workerFilePath(this.registryDir, workerId);
  }

  async listWorkerIds(): Promise<string[]> {
    if (!existsSync(this.registryDir)) return [];
    const files = await readdir(this.registryDir);
    return files.filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
  }

  async readWorkerFile(workerId: string): Promise<string | null> {
    const path = this.workerPath(workerId);
    if (!existsSync(path)) return null;
    return readFile(path, "utf8");
  }

  async workerExists(workerId: string): Promise<boolean> {
    return existsSync(this.workerPath(workerId));
  }
}
