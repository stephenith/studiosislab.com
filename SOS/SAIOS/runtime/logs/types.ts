/**
 * SAIOS runtime logs module — types
 */

import type { IsoTimestamp } from "../shared/types.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogEntry = {
  level: LogLevel;
  module: string;
  message: string;
  data?: Record<string, unknown>;
  at: IsoTimestamp;
};

export type LogPaths = {
  root: string;
  jobs: string;
  registry: string;
  prompts: string;
  reports: string;
  memory: string;
  chief: string;
  runtime: string;
};

export interface LogService {
  paths(): LogPaths;
  write(entry: LogEntry): Promise<void>;
}
