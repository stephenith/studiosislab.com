import { mkdir, appendFile, rename, writeFile } from "node:fs/promises";
import type { SaiosWorker } from "./types.js";
import { RegistryStorage } from "./RegistryStorage.js";

export async function appendRegistryJsonl(filePath: string, record: unknown): Promise<void> {
  const dir = filePath.replace(/\/[^/]+$/, "");
  await mkdir(dir, { recursive: true });
  await appendFile(filePath, `${JSON.stringify(record)}\n`, "utf8");
}

export class RegistryPersistence {
  private readonly storage: RegistryStorage;

  constructor(storage: RegistryStorage) {
    this.storage = storage;
  }

  getStorage(): RegistryStorage {
    return this.storage;
  }

  async loadWorker(workerId: string): Promise<SaiosWorker | null> {
    const raw = await this.storage.readWorkerFile(workerId);
    if (!raw) return null;
    return JSON.parse(raw) as SaiosWorker;
  }

  async saveWorker(worker: SaiosWorker): Promise<SaiosWorker> {
    await this.storage.ensureRegistryDir();
    const path = this.storage.workerPath(worker.id);
    const tmp = `${path}.tmp.${process.pid}.${Date.now()}`;
    const body = JSON.stringify(worker, null, 2);
    await writeFile(tmp, body, "utf8");
    await rename(tmp, path);
    const reloaded = await this.loadWorker(worker.id);
    if (!reloaded) {
      throw new Error(`RegistryPersistence: failed to reload worker ${worker.id} after save`);
    }
    return reloaded;
  }

  async loadAllWorkers(): Promise<SaiosWorker[]> {
    const ids = await this.storage.listWorkerIds();
    const workers: SaiosWorker[] = [];
    for (const id of ids) {
      const worker = await this.loadWorker(id);
      if (worker) workers.push(worker);
    }
    return workers;
  }
}
