/**
 * Offline verify: cost ledger append + spend gate blocks when over daily limit.
 * LIVE OFF. No OpenAI. No network.
 */
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  appendCostLedgerEntry,
  evaluateSpendAgainstBudget,
  costLedgerPath,
} from "./CostLedger.js";
import {
  canUseFounderOpenAIBounded,
  isFounderOpenAIBoundedEnabled,
} from "../resume-integration/FounderOpenAIOneTest.js";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const TMP = join(HERE, "../../../07_LOGS/saios/cost/.verify-tmp");
const REPO = join(HERE, "../../../../");

function assert(cond: boolean, name: string, detail?: string): void {
  if (!cond) throw new Error(`FAIL ${name}${detail ? `: ${detail}` : ""}`);
  console.log(`PASS ${name}`);
}

async function main(): Promise<void> {
  const ledgerDir = join(REPO, "SOS/07_LOGS/saios/cost");
  mkdirSync(ledgerDir, { recursive: true });
  const path = costLedgerPath(REPO);
  const backup = existsSync(path)
    ? join(TMP, `ledger-backup-${Date.now()}.jsonl`)
    : null;
  mkdirSync(TMP, { recursive: true });
  if (backup && existsSync(path)) {
    const { copyFileSync } = await import("node:fs");
    copyFileSync(path, backup);
  }

  // Isolate: write to a temp ledger by swapping via env... CostLedger uses fixed path.
  // Instead append test rows with distinctive purpose and evaluate with high spend injection.
  appendCostLedgerEntry(
    {
      usd: 4.9,
      provider: "mock",
      purpose: "verify-cost-ledger-daily",
      meta: { verify: true },
    },
    REPO,
  );

  const spendNear = evaluateSpendAgainstBudget({
    daily_limit_usd: 5,
    monthly_budget_usd: 20,
    auto_pause_threshold_pct: 80,
    repoRoot: REPO,
  });
  assert(spendNear.daily_usd >= 4.9, "daily_sum_includes_append");

  appendCostLedgerEntry(
    {
      usd: 1.0,
      provider: "mock",
      purpose: "verify-cost-ledger-over",
      meta: { verify: true },
    },
    REPO,
  );
  const spendOver = evaluateSpendAgainstBudget({
    daily_limit_usd: 5,
    monthly_budget_usd: 20,
    auto_pause_threshold_pct: 80,
    repoRoot: REPO,
  });
  assert(!spendOver.ok, "over_daily_not_ok", spendOver.reason ?? "");
  assert(spendOver.reason === "daily_limit_reached" || spendOver.reason === "auto_pause_threshold", "reason_set");

  const prevLive = process.env.SOS_AIOS_LIVE;
  const prevB = process.env.SOS_AI_FOUNDER_OPENAI_BOUNDED;
  const prevO = process.env.SOS_AI_FOUNDER_OPENAI_ONE_TEST;
  const prevKey = process.env.OPENAI_API_KEY;
  process.env.SOS_AIOS_LIVE = "0";
  process.env.SOS_AI_FOUNDER_OPENAI_BOUNDED = "1";
  process.env.SOS_AI_FOUNDER_OPENAI_ONE_TEST = "0";
  process.env.OPENAI_API_KEY = "sk-test-not-real";
  process.env.SOS_AI_MONTHLY_BUDGET_USD = "20";
  process.env.SOS_AI_DAILY_LIMIT_USD = "5";
  process.env.SOS_AI_PER_TASK_TOKEN_LIMIT = "50000";
  process.env.SOS_AI_AUTO_PAUSE_THRESHOLD_PCT = "80";
  process.env.SOS_AI_FOUNDER_ALERT_THRESHOLD_PCT = "70";

  assert(isFounderOpenAIBoundedEnabled(), "bounded_flag_on");
  assert(
    !canUseFounderOpenAIBounded("INTERNAL"),
    "gate_blocks_when_spend_over",
  );

  process.env.SOS_AI_FOUNDER_OPENAI_BOUNDED = "0";
  process.env.SOS_AI_FOUNDER_OPENAI_ONE_TEST = "1";
  assert(isFounderOpenAIBoundedEnabled(), "legacy_one_test_alias");

  process.env.SOS_AIOS_LIVE = "1";
  assert(!isFounderOpenAIBoundedEnabled(), "live_blocks");

  if (prevLive === undefined) delete process.env.SOS_AIOS_LIVE;
  else process.env.SOS_AIOS_LIVE = prevLive;
  if (prevB === undefined) delete process.env.SOS_AI_FOUNDER_OPENAI_BOUNDED;
  else process.env.SOS_AI_FOUNDER_OPENAI_BOUNDED = prevB;
  if (prevO === undefined) delete process.env.SOS_AI_FOUNDER_OPENAI_ONE_TEST;
  else process.env.SOS_AI_FOUNDER_OPENAI_ONE_TEST = prevO;
  if (prevKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = prevKey;

  writeFileSync(
    join(ledgerDir, "verify-cost-ledger.json"),
    JSON.stringify(
      { ok: true, spendNear, spendOver, at: new Date().toISOString() },
      null,
      2,
    ),
  );
  console.log("VERIFY_COST_LEDGER_OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
