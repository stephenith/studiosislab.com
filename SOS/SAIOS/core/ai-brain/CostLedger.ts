/**
 * Append-only AIOS cost ledger — daily/monthly spend enforcement for bounded OpenAI.
 * Path: SOS/07_LOGS/saios/cost/ledger.jsonl (never commit production data).
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
/** Repo root: SOS/SAIOS/core/ai-brain → ../../../../ */
export const REPO_ROOT = join(HERE, "../../../../");
export const COST_LEDGER_REL = "SOS/07_LOGS/saios/cost/ledger.jsonl";

export type CostLedgerEntry = {
  schema_version: "aios-cost-ledger-1.0.0";
  at: string;
  usd: number;
  provider: string;
  purpose: string;
  task_id?: string;
  tokens_in?: number;
  tokens_out?: number;
  meta?: Record<string, unknown>;
};

export function costLedgerPath(repoRoot: string = REPO_ROOT): string {
  return join(repoRoot, COST_LEDGER_REL);
}

export function appendCostLedgerEntry(
  entry: Omit<CostLedgerEntry, "schema_version" | "at"> & {
    at?: string;
  },
  repoRoot: string = REPO_ROOT,
): void {
  const path = costLedgerPath(repoRoot);
  mkdirSync(dirname(path), { recursive: true });
  const row: CostLedgerEntry = {
    schema_version: "aios-cost-ledger-1.0.0",
    at: entry.at ?? new Date().toISOString(),
    usd: Number(entry.usd) || 0,
    provider: entry.provider,
    purpose: entry.purpose,
    ...(entry.task_id ? { task_id: entry.task_id } : {}),
    ...(entry.tokens_in != null ? { tokens_in: entry.tokens_in } : {}),
    ...(entry.tokens_out != null ? { tokens_out: entry.tokens_out } : {}),
    ...(entry.meta ? { meta: entry.meta } : {}),
  };
  appendFileSync(path, `${JSON.stringify(row)}\n`, "utf8");
}

export function readCostLedgerEntries(
  repoRoot: string = REPO_ROOT,
): CostLedgerEntry[] {
  const path = costLedgerPath(repoRoot);
  if (!existsSync(path)) return [];
  const out: CostLedgerEntry[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      const row = JSON.parse(t) as CostLedgerEntry;
      if (typeof row.usd === "number" && row.at) out.push(row);
    } catch {
      /* skip corrupt line */
    }
  }
  return out;
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function startOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function sumSpendUsd(
  entries: CostLedgerEntry[],
  since: Date,
  until: Date = new Date(),
): number {
  let sum = 0;
  for (const e of entries) {
    const t = Date.parse(e.at);
    if (!Number.isFinite(t)) continue;
    if (t < since.getTime() || t > until.getTime()) continue;
    sum += Number(e.usd) || 0;
  }
  return sum;
}

export type SpendSnapshot = {
  daily_usd: number;
  monthly_usd: number;
  daily_limit_usd: number | null;
  monthly_budget_usd: number | null;
  auto_pause_threshold_pct: number | null;
  within_daily: boolean;
  within_monthly: boolean;
  below_auto_pause: boolean;
  ok: boolean;
  reason: string | null;
};

export function evaluateSpendAgainstBudget(
  opts: {
    daily_limit_usd: number | null;
    monthly_budget_usd: number | null;
    auto_pause_threshold_pct: number | null;
    now?: Date;
    repoRoot?: string;
  },
): SpendSnapshot {
  const now = opts.now ?? new Date();
  const entries = readCostLedgerEntries(opts.repoRoot);
  const daily_usd = sumSpendUsd(entries, startOfUtcDay(now), now);
  const monthly_usd = sumSpendUsd(entries, startOfUtcMonth(now), now);
  const daily_limit_usd = opts.daily_limit_usd;
  const monthly_budget_usd = opts.monthly_budget_usd;
  const auto_pause_threshold_pct = opts.auto_pause_threshold_pct;

  const within_daily =
    daily_limit_usd == null || daily_usd < daily_limit_usd;
  const within_monthly =
    monthly_budget_usd == null || monthly_usd < monthly_budget_usd;

  let below_auto_pause = true;
  if (
    auto_pause_threshold_pct != null &&
    daily_limit_usd != null &&
    daily_limit_usd > 0
  ) {
    const pct = (daily_usd / daily_limit_usd) * 100;
    below_auto_pause = pct < auto_pause_threshold_pct;
  }

  let reason: string | null = null;
  if (!within_daily) reason = "daily_limit_reached";
  else if (!within_monthly) reason = "monthly_budget_reached";
  else if (!below_auto_pause) reason = "auto_pause_threshold";

  return {
    daily_usd,
    monthly_usd,
    daily_limit_usd,
    monthly_budget_usd,
    auto_pause_threshold_pct,
    within_daily,
    within_monthly,
    below_auto_pause,
    ok: within_daily && within_monthly && below_auto_pause,
    reason,
  };
}

/** Rough USD from token counts using internal OpenAIEstimate rates ($0.4/$1.6 per 1M). */
export function estimateUsdFromTokens(
  tokensIn: number,
  tokensOut: number,
): number {
  return (tokensIn / 1e6) * 0.4 + (tokensOut / 1e6) * 1.6;
}
