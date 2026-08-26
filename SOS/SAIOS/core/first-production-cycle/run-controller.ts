#!/usr/bin/env tsx
/**
 * Canonical Production Controller CLI — Agent #213.
 * Single entry for production. LIVE OFF. No publication.
 *
 * Usage:
 *   npm run aios:controller:run
 *   npm run aios:controller:run -- --size 3 --mock
 *   npm run aios:batch:run -- --size 5 --mock   (delegates here)
 */
import { resolve } from "node:path";
import dotenv from "dotenv";
dotenv.config({
  path: resolve(process.cwd(), ".env.local"),
});
import {
  DEFAULT_BATCH_SIZE,
  DEFAULT_MAX_OPENAI_PER_BATCH,
  DEFAULT_QUEUE_MAX,
} from "./BatchRunner.js";
import { runProduction } from "./ProductionController.js";

function parseArgs(argv: string[]): {
  size: number;
  queueMax: number;
  maxOpenai: number;
  mock: boolean;
} {
  let size = DEFAULT_BATCH_SIZE;
  let queueMax = DEFAULT_QUEUE_MAX;
  let maxOpenai = DEFAULT_MAX_OPENAI_PER_BATCH;
  let mock = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--size" || a === "--batch-size") {
      size = Number(argv[++i]);
    } else if (a === "--queue-max") {
      queueMax = Number(argv[++i]);
    } else if (a === "--max-openai") {
      maxOpenai = Number(argv[++i]);
    } else if (a === "--mock") {
      mock = true;
    } else if (a === "--help" || a === "-h") {
      console.log(
        `Usage: aios:controller:run [--size N] [--queue-max N] [--max-openai N] [--mock]`,
      );
      process.exit(0);
    }
  }
  if (!Number.isFinite(size) || size < 1) size = DEFAULT_BATCH_SIZE;
  if (!Number.isFinite(queueMax) || queueMax < 1) queueMax = DEFAULT_QUEUE_MAX;
  if (!Number.isFinite(maxOpenai) || maxOpenai < 0) {
    maxOpenai = DEFAULT_MAX_OPENAI_PER_BATCH;
  }
  return { size, queueMax, maxOpenai, mock };
}

async function main(): Promise<void> {
  if (process.env.SOS_AIOS_LIVE === "1") {
    console.error("LIVE must be OFF");
    process.exit(1);
  }
  const args = parseArgs(process.argv.slice(2));
  const result = await runProduction({
    batch_size: args.size,
    queue_max: args.queueMax,
    max_openai_per_batch: args.maxOpenai,
    force_mock: args.mock,
    select_target: true,
  });
  console.log(
    JSON.stringify(
      {
        execution_id: result.execution_id,
        stop_reason: result.stop_reason,
        stop_detail: result.stop_detail,
        health: result.health.status,
        candidate_count: result.candidate_count,
        failure_count: result.failure_count,
        batch_id: result.batch?.batch_id ?? null,
        publication_allowed: result.publication_allowed,
        report_path: result.report_path,
        entrypoint: result.entrypoint,
      },
      null,
      2,
    ),
  );
  if (
    result.stop_reason === "fatal_error" ||
    result.stop_reason === "live_refused"
  ) {
    process.exit(1);
  }
  if (result.stop_reason === "health_unhealthy") {
    process.exit(2);
  }
  if (result.stop_reason === "budget_denied") {
    process.exit(3);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
