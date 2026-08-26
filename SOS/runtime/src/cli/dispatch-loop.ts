#!/usr/bin/env node
import { loadConfig } from "../config.js";
import { dispatchEvents, processRetryQueue } from "../dispatcher.js";
import { isShutdownRequested } from "../runtime/shutdown.js";
import { acquireRuntimeInstanceLock } from "../runtime/single-instance.js";
import { startWorkerHeartbeat } from "../runtime/worker-heartbeat.js";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  const config = loadConfig();
  const lock = await acquireRuntimeInstanceLock(config, "dispatcher");
  const heartbeat = startWorkerHeartbeat(config, "dispatcher", { initialPhase: "loop" });
  try {
    const intervalMs = parseInt(process.env.SOS_DISPATCH_LOOP_MS ?? "30000", 10);

    console.log(`SOS dispatch loop starting (interval ${intervalMs}ms)...`);

    while (!isShutdownRequested(config.logsRoot)) {
      try {
        heartbeat.setBusy("dispatch");
        const dispatched = await dispatchEvents(config);
        if (dispatched.length > 0) {
          console.log(`[dispatch-loop] processed ${dispatched.length} event(s)`);
        }

        heartbeat.setBusy("retry");
        const retried = await processRetryQueue(config);
        if (retried.length > 0) {
          console.log(`[dispatch-loop] retried ${retried.length} entry(ies)`);
        }
        heartbeat.clearBusy();
      } catch (e) {
        heartbeat.clearBusy();
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[dispatch-loop] error: ${msg}`);
      }

      heartbeat.setPhase("idle");
      await sleep(intervalMs);
    }

    console.log("[dispatch-loop] shutdown flag detected — exiting");
  } finally {
    await heartbeat.stop();
    await lock.release();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
