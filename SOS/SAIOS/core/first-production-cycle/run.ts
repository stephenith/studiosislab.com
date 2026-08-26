#!/usr/bin/env tsx
/**
 * Canonical AIOS execution CLI — Agent #160 / #204.
 * Official entrypoint for the Pipeline A spine (LIVE OFF; Mock or Founder one-test OpenAI).
 */
import { resolve } from "node:path";
import dotenv from "dotenv";
dotenv.config({
  path: resolve(process.cwd(), ".env.local"),
});
import {
  ENGINES,
  acquireExecutionLock,
  enforceEngineAccess,
} from "../../architecture/runtime-guard.js";
import { runFirstProductionCycle } from "./runFirstProductionCycle.js";

async function main(): Promise<void> {
  enforceEngineAccess(ENGINES.CANONICAL_FIRST_PRODUCTION_CYCLE);
  const releaseLock = acquireExecutionLock(ENGINES.CANONICAL_FIRST_PRODUCTION_CYCLE.id);
  try {
    const result = await runFirstProductionCycle({
      pause_for_founder: true,
      select_target: true,
    });
    console.log(
      JSON.stringify(
        {
          overall: result.overall,
          state: result.state,
          task_id: result.task_id,
          cycle_id: result.cycle_id,
          paused: result.paused,
          publication_allowed: result.publication_allowed,
          production_target: result.production_target,
          architecture_status: "CANONICAL",
        },
        null,
        2,
      ),
    );
    if (result.overall !== "PASS") process.exit(1);
  } finally {
    releaseLock();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
