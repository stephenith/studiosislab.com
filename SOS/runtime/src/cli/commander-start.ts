#!/usr/bin/env node
import { CommanderSupervisor } from "../commander/supervisor.js";
import { assertCommanderProductionNotificationsSync } from "../runtime/notification-guard.js";

async function main(): Promise<void> {
  assertCommanderProductionNotificationsSync();
  const supervisor = new CommanderSupervisor();
  await supervisor.start();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
