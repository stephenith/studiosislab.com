#!/usr/bin/env node
/**
 * Verify worker exit classification — expected vs crash.
 * Read-only unit checks + optional live Commander checks.
 */
import { classifyWorkerExit } from "../commander/worker-exit.js";
import { CRASH_ALERT_THRESHOLD } from "../commander/workers.js";

type Case = {
  name: string;
  code: number | null;
  signal: NodeJS.Signals | null;
  ctx: Parameters<typeof classifyWorkerExit>[2];
  expect: { expected: boolean; isCrash: boolean; shouldRestart: boolean };
};

const CASES: Case[] = [
  {
    name: "exit 0",
    code: 0,
    signal: null,
    ctx: { commanderStopping: false },
    expect: { expected: true, isCrash: false, shouldRestart: true },
  },
  {
    name: "SIGINT (130)",
    code: 130,
    signal: null,
    ctx: { commanderStopping: false },
    expect: { expected: true, isCrash: false, shouldRestart: true },
  },
  {
    name: "SIGTERM (143)",
    code: 143,
    signal: null,
    ctx: { commanderStopping: false },
    expect: { expected: true, isCrash: false, shouldRestart: true },
  },
  {
    name: "SIGTERM signal",
    code: null,
    signal: "SIGTERM",
    ctx: { commanderStopping: false },
    expect: { expected: true, isCrash: false, shouldRestart: true },
  },
  {
    name: "graceful shutdown",
    code: 0,
    signal: null,
    ctx: { commanderStopping: true },
    expect: { expected: true, isCrash: false, shouldRestart: false },
  },
  {
    name: "SIGKILL crash test",
    code: null,
    signal: "SIGKILL",
    ctx: { commanderStopping: false },
    expect: { expected: false, isCrash: true, shouldRestart: true },
  },
  {
    name: "heartbeat timeout",
    code: 143,
    signal: "SIGTERM",
    ctx: { commanderStopping: false, killReason: "stale_heartbeat" },
    expect: { expected: false, isCrash: true, shouldRestart: true },
  },
  {
    name: "unexpected exit 1",
    code: 1,
    signal: null,
    ctx: { commanderStopping: false },
    expect: { expected: false, isCrash: true, shouldRestart: true },
  },
];

function runUnitTests(): { passed: number; failed: string[] } {
  const failed: string[] = [];
  for (const c of CASES) {
    const r = classifyWorkerExit(c.code, c.signal, c.ctx);
    if (
      r.expected !== c.expect.expected
      || r.isCrash !== c.expect.isCrash
      || r.shouldRestart !== c.expect.shouldRestart
    ) {
      failed.push(
        `${c.name}: got expected=${r.expected} isCrash=${r.isCrash} shouldRestart=${r.shouldRestart}`,
      );
    }
  }
  return { passed: CASES.length - failed.length, failed };
}

async function main(): Promise<void> {
  const unit = runUnitTests();
  const report = {
    tested_at: new Date().toISOString(),
    unit_tests: {
      total: CASES.length,
      passed: unit.passed,
      failed: unit.failed,
    },
    crash_alert_threshold: CRASH_ALERT_THRESHOLD,
    expectations: {
      sigterm_143: "no alert (expected exit)",
      sigint_130: "no alert (expected exit)",
      exit_0: "no alert (expected exit)",
      sigkill: `alert after ${CRASH_ALERT_THRESHOLD} crashes`,
      unexpected_exception: "alert after threshold",
    },
    all_ok: unit.failed.length === 0,
  };

  console.log(JSON.stringify(report, null, 2));
  if (!report.all_ok) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
