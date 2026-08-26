import { join } from "node:path";
import type { RuntimeConfig } from "../config.js";

export type CommanderPaths = {
  root: string;
  health: string;
  pid: string;
  logs: string;
  state: string;
};

export function getCommanderPaths(config: RuntimeConfig): CommanderPaths {
  const root = join(config.logsRoot, "commander");
  return {
    root,
    health: join(root, "health.json"),
    pid: join(root, "commander.pid"),
    logs: join(root, "logs"),
    state: join(root, "state.json"),
  };
}
