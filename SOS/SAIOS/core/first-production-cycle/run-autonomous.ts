#!/usr/bin/env tsx
/**
 * Canonical Autonomous Production Service CLI — Agent #214.
 *
 * Usage:
 *   npm run aios:autonomous:run -- --mock
 *   npm run aios:autonomous:run -- --interval-ms 60000 --size 3 --mock
 *   npm run aios:autonomous:status
 */
import { resolve } from "node:path";
import dotenv from "dotenv";
dotenv.config({ path: resolve(process.cwd(), ".env.local") });
import {
  DEFAULT_BATCH_SIZE,
  DEFAULT_MAX_OPENAI_PER_BATCH,
  DEFAULT_QUEUE_MAX,
} from "./BatchRunner.js";
import {
  AutonomousProductionService,
  DEFAULT_AUTONOMOUS_INTERVAL_MS,
  readAutonomousStatusFile,
} from "./AutonomousProductionService.js";

function parseArgs(argv: string[]): {
  cmd: "run" | "status" | "help";
  intervalMs: number | null;
  size: number;
  queueMax: number;
  maxOpenai: number;
  mock: boolean;
  maxIterations: number | null;
  adaptive: boolean | null;
} {
  let cmd: "run" | "status" | "help" = "run";
  let intervalMs: number | null = null;
  let size = DEFAULT_BATCH_SIZE;
  let queueMax = DEFAULT_QUEUE_MAX;
  let maxOpenai = DEFAULT_MAX_OPENAI_PER_BATCH;
  let mock = false;
  let maxIterations: number | null = null;
  let adaptive: boolean | null = null;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "status" || a === "--status") cmd = "status";
    else if (a === "help" || a === "--help" || a === "-h") cmd = "help";
    else if (a === "--interval-ms") intervalMs = Number(argv[++i]);
    else if (a === "--interval-min") {
      intervalMs = Number(argv[++i]) * 60 * 1000;
    } else if (a === "--size" || a === "--batch-size") {
      size = Number(argv[++i]);
    } else if (a === "--queue-max") queueMax = Number(argv[++i]);
    else if (a === "--max-openai") maxOpenai = Number(argv[++i]);
    else if (a === "--mock") mock = true;
    else if (a === "--max-iterations") maxIterations = Number(argv[++i]);
    else if (a === "--adaptive") adaptive = true;
    else if (a === "--no-adaptive") adaptive = false;
  }

  if (intervalMs != null && (!Number.isFinite(intervalMs) || intervalMs < 1)) {
    intervalMs = DEFAULT_AUTONOMOUS_INTERVAL_MS;
  }
  if (!Number.isFinite(size) || size < 1) size = DEFAULT_BATCH_SIZE;
  if (!Number.isFinite(queueMax) || queueMax < 1) queueMax = DEFAULT_QUEUE_MAX;
  if (!Number.isFinite(maxOpenai) || maxOpenai < 0) {
    maxOpenai = DEFAULT_MAX_OPENAI_PER_BATCH;
  }
  if (maxIterations != null && (!Number.isFinite(maxIterations) || maxIterations < 1)) {
    maxIterations = null;
  }

  return { cmd, intervalMs, size, queueMax, maxOpenai, mock, maxIterations, adaptive };
}

async function main(): Promise<void> {
  if (process.env.SOS_AIOS_LIVE === "1") {
    console.error("LIVE must be OFF");
    process.exit(1);
  }

  const args = parseArgs(process.argv.slice(2));
  if (args.cmd === "help") {
    console.log(
      `Usage:
  aios:autonomous:run [--interval-ms N|--interval-min N] [--adaptive|--no-adaptive] [--size N] [--queue-max N] [--max-openai N] [--mock] [--max-iterations N]
  aios:autonomous:status

Adaptive scheduling (Agent #220):
  Default ON when --interval-* is omitted; OFF when an explicit interval is set.
  --adaptive forces policy-driven sleep; --no-adaptive forces fixed interval.`,
    );
    process.exit(0);
  }

  if (args.cmd === "status") {
    const st = readAutonomousStatusFile();
    console.log(JSON.stringify(st ?? { state: "stopped", note: "no status file" }, null, 2));
    return;
  }

  const service = new AutonomousProductionService();
  const started = service.start({
    interval_ms: args.intervalMs ?? undefined,
    adaptive_scheduling_enabled: args.adaptive ?? undefined,
    batch_size: args.size,
    queue_max: args.queueMax,
    max_openai_per_batch: args.maxOpenai,
    force_mock: args.mock,
    max_iterations: args.maxIterations ?? undefined,
  });
  console.log(
    JSON.stringify(
      {
        event: "started",
        session_id: started.session_id,
        interval_ms: started.interval_ms,
        adaptive_scheduling_enabled: started.adaptive_scheduling_enabled,
        publication_allowed: false,
        live: false,
      },
      null,
      2,
    ),
  );

  const shutdown = async () => {
    console.error("Stopping autonomous service (graceful)…");
    const st = await service.stop();
    console.log(
      JSON.stringify(
        {
          event: "stopped",
          session_id: st.session_id,
          iterations: st.iterations,
          last_execution_id: st.last_execution_id,
        },
        null,
        2,
      ),
    );
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });

  // Foreground wait until loop ends (max_iterations or stop)
  while (service.status().running || service.status().busy) {
    await new Promise((r) => setTimeout(r, 200));
  }
  const final = service.status();
  console.log(
    JSON.stringify(
      {
        event: "session_ended",
        session_id: final.session_id,
        iterations: final.iterations,
        last_execution_id: final.last_execution_id,
        publication_allowed: false,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
