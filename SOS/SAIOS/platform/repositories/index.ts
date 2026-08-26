/**
 * BaseArtifactRepository — Agent #173.
 * Thin specialization for id+latest+jsonl artifact stores.
 */
import { BaseAppendOnlyRepository } from "./BaseAppendOnlyRepository.js";

export class BaseArtifactRepository extends BaseAppendOnlyRepository {
  saveArtifact(
    id: string,
    data: unknown,
    latestName: string,
    jsonlName: string,
  ): string[] {
    return this.saveNamedArtifact(id, data, latestName, jsonlName);
  }

  writeSnapshot(filename: string, snapshot: unknown): void {
    this.atomicWrite(filename, snapshot);
  }

  writeHealthFile(filename: string, health: unknown): void {
    this.atomicWrite(filename, health);
  }

  loadSnapshot<T>(filename: string): T | null {
    return this.loadJson<T>(filename);
  }

  loadHealthFile<T>(filename: string): T | null {
    return this.loadJson<T>(filename);
  }
}

export { BaseAppendOnlyRepository } from "./BaseAppendOnlyRepository.js";
export type { BaseAppendOnlyRepositoryOptions } from "./BaseAppendOnlyRepository.js";
