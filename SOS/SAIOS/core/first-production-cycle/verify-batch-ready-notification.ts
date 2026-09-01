/**
 * Offline verify: Phase 5J batch-ready Telegram notifications.
 * No real Telegram. No OpenAI. No production mutation of live ledgers
 * (uses temp ledger path).
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  classifyBatchReadyState,
  formatBatchReadyMessage,
  formatBatchReadyTitle,
  humanizeStopReason,
  notifyBatchReady,
  resolveGenerationSlot,
  type BatchReadyNotifyInput,
} from "./BatchReadyNotification.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/first-production-cycle/verify-batch-ready-notification.json",
);

type Check = { name: string; pass: boolean; detail: string };

function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: cond, detail };
}

function baseInput(
  over: Partial<BatchReadyNotifyInput> &
    Pick<
      BatchReadyNotifyInput,
      "accepted_count" | "requested_count" | "execution_id" | "batch_id"
    >,
): BatchReadyNotifyInput {
  return {
    slot: "evening",
    failure_count: 0,
    queue_waiting: 20,
    queue_max: 20,
    stop_reason: "completed",
    stop_detail: null,
    titles: [],
    ...over,
  };
}

async function main(): Promise<void> {
  const checks: Check[] = [];
  const tmp = mkdtempSync(join(tmpdir(), "aios-batch-ready-"));
  const ledgerPath = join(tmp, "batch-ready-notifications.json");
  const sent: Array<{ title: string; message: string; severity?: string }> = [];

  const emitAlert = async (input: {
    title: string;
    message: string;
    severity?: "P0" | "P1" | "P2";
  }) => {
    sent.push({
      title: input.title,
      message: input.message,
      severity: input.severity,
    });
    return { ok: true, dry_run: true };
  };

  // Slot resolution
  checks.push(
    assert(
      resolveGenerationSlot(new Date("2026-09-01T03:20:00Z")) === "morning",
      "slot_morning_0850_ist",
      resolveGenerationSlot(new Date("2026-09-01T03:20:00Z")),
    ),
  );
  checks.push(
    assert(
      resolveGenerationSlot(new Date("2026-09-01T12:20:00Z")) === "evening",
      "slot_evening_1750_ist",
      resolveGenerationSlot(new Date("2026-09-01T12:20:00Z")),
    ),
  );
  checks.push(
    assert(
      resolveGenerationSlot(new Date("2026-09-01T06:00:00Z")) === "manual",
      "slot_manual_off_window",
      resolveGenerationSlot(new Date("2026-09-01T06:00:00Z")),
    ),
  );
  checks.push(
    assert(
      formatBatchReadyTitle("manual", "full") === "Generation Batch Ready",
      "manual_title_not_morning_evening",
      formatBatchReadyTitle("manual", "full"),
    ),
  );

  // FULL 5/5 evening
  const fullTitles = [
    "Program Coordinator",
    "HR Generalist",
    "Executive Assistant",
    "Office Manager",
    "Customer Success Associate",
  ];
  const fullIn = baseInput({
    execution_id: "exec-full-001",
    batch_id: "batch-full-001",
    accepted_count: 5,
    requested_count: 5,
    queue_waiting: 20,
    queue_max: 20,
    titles: fullTitles,
    slot: "evening",
  });
  checks.push(
    assert(
      classifyBatchReadyState(fullIn) === "full",
      "full_state",
      classifyBatchReadyState(fullIn),
    ),
  );
  const fullFmt = formatBatchReadyMessage(fullIn);
  checks.push(
    assert(
      fullFmt.title === "Evening Batch Ready",
      "full_title",
      fullFmt.title,
    ),
  );
  checks.push(
    assert(
      fullFmt.message.includes("5 Resume Templates ready for Founder Review") &&
        fullFmt.message.includes("Generated: 5/5") &&
        fullTitles.every((t) => fullFmt.message.includes(t)) &&
        fullFmt.message.includes("https://founder.studiosislab.com") &&
        !/\bcandidate\b/i.test(fullFmt.message),
      "full_message_content",
      fullFmt.message.slice(0, 200),
    ),
  );

  sent.length = 0;
  const full1 = await notifyBatchReady(fullIn, { emitAlert, ledgerPath });
  const full2 = await notifyBatchReady(fullIn, { emitAlert, ledgerPath });
  checks.push(
    assert(
      full1.sent === true &&
        full1.deduped === false &&
        sent.length === 1 &&
        sent[0]!.title === "Evening Batch Ready",
      "full_fixture_one_notification",
      `sent=${sent.length} title=${sent[0]?.title}`,
    ),
  );
  checks.push(
    assert(
      full2.deduped === true && sent.length === 1,
      "dedupe_same_batch_id",
      `deduped=${full2.deduped} count=${sent.length}`,
    ),
  );

  // PARTIAL queue_capacity 3/5
  const partialIn = baseInput({
    execution_id: "exec-partial-001",
    batch_id: "batch-partial-001",
    accepted_count: 3,
    requested_count: 5,
    stop_reason: "queue_capacity",
    titles: ["A", "B", "C"],
    slot: "evening",
  });
  const partialFmt = formatBatchReadyMessage(partialIn);
  checks.push(
    assert(
      partialFmt.title === "Evening Batch Partial" &&
        partialFmt.message.includes("Generated: 3/5") &&
        partialFmt.message.includes(
          humanizeStopReason("queue_capacity"),
        ) &&
        !partialFmt.message.includes("5 Resume Templates ready"),
      "partial_fixture",
      partialFmt.title,
    ),
  );
  sent.length = 0;
  await notifyBatchReady(partialIn, { emitAlert, ledgerPath });
  checks.push(
    assert(
      sent.length === 1 && sent[0]!.title === "Evening Batch Partial",
      "partial_sent",
      sent[0]?.title ?? "none",
    ),
  );

  // Target exhaustion partial 1/5
  const exhIn = baseInput({
    execution_id: "exec-exh-001",
    batch_id: "batch-exh-001",
    accepted_count: 1,
    requested_count: 5,
    stop_reason: "no_eligible_targets",
    titles: ["Only One"],
    slot: "evening",
  });
  const exhFmt = formatBatchReadyMessage(exhIn);
  checks.push(
    assert(
      exhFmt.title === "Evening Batch Partial" &&
        exhFmt.message.includes("Generated: 1/5") &&
        exhFmt.message.includes("No eligible production targets") &&
        !exhFmt.message.includes("5 Resume Templates ready"),
      "exhaustion_partial_fixture",
      exhFmt.title,
    ),
  );

  // ZERO
  const zeroIn = baseInput({
    execution_id: "exec-zero-001",
    batch_id: "batch-zero-001",
    accepted_count: 0,
    requested_count: 5,
    stop_reason: "no_eligible_targets",
    titles: [],
    slot: "morning",
  });
  const zeroFmt = formatBatchReadyMessage(zeroIn);
  checks.push(
    assert(
      zeroFmt.title === "Morning Batch Needs Attention" &&
        zeroFmt.message.includes("Generated: 0/5") &&
        zeroFmt.message.includes("No eligible production targets"),
      "zero_fixture",
      zeroFmt.title,
    ),
  );

  // Notifier failure isolation
  sent.length = 0;
  const failEmit = async () => {
    throw new Error("telegram_down");
  };
  const failRes = await notifyBatchReady(
    baseInput({
      execution_id: "exec-fail-notify",
      batch_id: "batch-fail-notify",
      accepted_count: 5,
      requested_count: 5,
      titles: fullTitles,
    }),
    { emitAlert: failEmit, ledgerPath },
  );
  checks.push(
    assert(
      failRes.sent === false &&
        failRes.error?.includes("telegram_down") === true &&
        failRes.state === "full",
      "notifier_failure_isolated",
      failRes.error ?? "ok",
    ),
  );

  // Descriptive language still not in this module — revision path unchanged
  // (smoke: FAILED_GATE title convention preserved in dispatcher source)
  const dispatcherSrc = await import("node:fs").then((fs) =>
    fs.readFileSync(
      join(
        REPO,
        "SOS/SAIOS/core/founder-revision/RevisionTaskDispatcher.ts",
      ),
      "utf8",
    ),
  );
  checks.push(
    assert(
      dispatcherSrc.includes('title: `Revision ${result.task.status}`') &&
        dispatcherSrc.includes("emitAiosOpsAlert"),
      "revision_failed_gate_path_unchanged",
      "ok",
    ),
  );

  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.filter((c) => !c.pass).length;
  const report = {
    schema_version: "verify-batch-ready-notification-1.0.0",
    ok: failed === 0,
    passed,
    failed,
    total: checks.length,
    checks,
    notify_live_respected: true,
    real_telegram: false,
  };
  mkdirSync(join(REPO, "SOS/07_LOGS/saios/first-production-cycle"), {
    recursive: true,
  });
  writeFileSync(OUT, JSON.stringify(report, null, 2));
  try {
    rmSync(tmp, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  console.log(
    JSON.stringify(
      { ok: report.ok, passed, failed, total: checks.length, out: OUT },
      null,
      2,
    ),
  );
  if (failed > 0) {
    for (const c of checks.filter((x) => !x.pass)) {
      console.error(`FAIL ${c.name}: ${c.detail}`);
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
