import { loadConfig } from "../config.js";
import { registerWorkerShutdown, isShutdownRequested } from "./shutdown.js";

export function installProductionWorkerShutdown(
  label: string,
  onDrain: () => Promise<void>,
): void {
  if (process.env.SOS_PRODUCTION_WORKER !== "true") return;

  const config = loadConfig();
  registerWorkerShutdown({
    logsRoot: config.logsRoot,
    label,
    canExit: () => isShutdownRequested(config.logsRoot),
    onDrain,
  });
}
