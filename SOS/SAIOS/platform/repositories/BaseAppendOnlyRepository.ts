/**
 * BaseAppendOnlyRepository — Agent #173.
 * Generic append-only JSONL + atomic latest/health persistence.
 * No domain logic.
 */
import { join } from "node:path";
import {
  appendJsonlLine,
  atomicWriteJson,
  ensureDirectory,
  loadJsonFile,
  readJsonlFile,
} from "../shared/fs.js";

export type BaseAppendOnlyRepositoryOptions = {
  /** Absolute monorepo root. */
  repoRoot: string;
  /**
   * Log directory relative to repo root, without trailing fixtures/.
   * Example: "SOS/07_LOGS/saios/runtime/system-readiness"
   */
  logRelativePath: string;
  fixture?: boolean;
  /** When true, malformed JSONL lines are skipped instead of throwing. */
  lenientJsonl?: boolean;
};

export class BaseAppendOnlyRepository {
  readonly root: string;
  readonly dir: string;
  readonly fixture: boolean;
  /** Relative path including fixtures/ when fixture=true. */
  readonly relativeLogDir: string;
  protected readonly lenientJsonl: boolean;

  constructor(opts: BaseAppendOnlyRepositoryOptions) {
    this.root = opts.repoRoot;
    this.fixture = Boolean(opts.fixture);
    this.lenientJsonl = Boolean(opts.lenientJsonl);
    const base = join(opts.repoRoot, opts.logRelativePath);
    this.dir = this.fixture ? join(base, "fixtures") : base;
    this.relativeLogDir = this.fixture
      ? `${opts.logRelativePath}/fixtures`
      : opts.logRelativePath;
  }

  ensureDir(): void {
    ensureDirectory(this.dir);
  }

  protected appendJsonl(filename: string, record: unknown): void {
    this.ensureDir();
    appendJsonlLine(join(this.dir, filename), record);
  }

  protected readJsonl<T>(filename: string): T[] {
    return readJsonlFile<T>(join(this.dir, filename), {
      lenient: this.lenientJsonl,
    });
  }

  protected atomicWrite(filename: string, data: unknown): void {
    this.ensureDir();
    atomicWriteJson(join(this.dir, filename), data);
  }

  protected loadJson<T>(filename: string): T | null {
    return loadJsonFile<T>(join(this.dir, filename));
  }

  /**
   * Persist an artifact as: {id}.json + latestName + append jsonlName.
   * Returns relative artifact paths (identical layout to prior governance repos).
   */
  protected saveNamedArtifact(
    id: string,
    data: unknown,
    latestName: string,
    jsonlName: string,
  ): string[] {
    this.ensureDir();
    const paths: string[] = [];
    this.atomicWrite(`${id}.json`, data);
    paths.push(`${this.relativeLogDir}/${id}.json`);
    this.atomicWrite(latestName, data);
    paths.push(`${this.relativeLogDir}/${latestName}`);
    this.appendJsonl(jsonlName, data);
    paths.push(`${this.relativeLogDir}/${jsonlName}`);
    return paths;
  }
}
