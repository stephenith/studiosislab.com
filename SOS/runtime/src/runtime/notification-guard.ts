import { isCommanderRunning } from "../commander/supervisor.js";
import { getCommanderPaths } from "../commander/paths.js";
import { loadConfig } from "../config.js";

const GUARD_MESSAGE = "Mock notification transport cannot run in production Commander.";

export async function assertCommanderProductionNotifications(): Promise<void> {
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.SOS_NOTIFICATION_MODE !== "mock") return;

  const config = loadConfig();
  const paths = getCommanderPaths(config);
  const { running } = await isCommanderRunning(paths);
  if (running) {
    throw new Error(GUARD_MESSAGE);
  }
}

export function assertCommanderProductionNotificationsSync(): void {
  if (process.env.NODE_ENV === "production" && process.env.SOS_NOTIFICATION_MODE === "mock") {
    const argv = process.argv.join(" ");
    if (argv.includes("commander-start") || argv.includes("commander:start")) {
      throw new Error(GUARD_MESSAGE);
    }
  }
}
