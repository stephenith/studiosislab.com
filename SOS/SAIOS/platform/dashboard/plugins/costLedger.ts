/**
 * Cost Ledger dashboard plugin — Agent #181.
 * Read-only. No POST. Never bills. Never executes.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { SnapshotSource } from "../SnapshotSource.js";
import type {
  DashboardRouteContext,
  DashboardRouteHandler,
  RouteMatch,
} from "../RouteRegistry.js";
import { exactRoute, paramRoute } from "../RouteRegistry.js";
import type { DashboardPlugin } from "../DashboardPlugin.js";

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

const SAFETY = {
  execution_allowed: false,
  billing_allowed: false,
  provider_allowed: false,
  publishing_allowed: false,
  live_enabled: false,
} as const;

export const costLedgerSnapshotSource: SnapshotSource = {
  id: "cost-ledger",
  fields: ["cost_ledger_status", "cost_ledger", "cost_ledger_health"],
  empty() {
    return {
      cost_ledger_status: null,
      cost_ledger: null,
      cost_ledger_health: null,
    };
  },
  load(ctx) {
    const snap = ctx.readJson(
      "SOS/07_LOGS/saios/platform/cost-ledger/latest-cost-ledger-snapshot.json",
    ) as {
      budget_count?: number;
      session_count?: number;
      ready_budget_count?: number;
      open_session_count?: number;
      latest_session_id?: string | null;
      latest_budget_id?: string | null;
      next_safe_action?: string | null;
    } | null;
    const health = ctx.readJson(
      "SOS/07_LOGS/saios/platform/cost-ledger/cost-ledger-health.json",
    ) as {
      budget_count?: number;
      session_count?: number;
      status?: string;
      mode?: string;
      billing?: boolean;
    } | null;

    return {
      cost_ledger_status: snap
        ? `budgets=${snap.budget_count ?? 0};sessions=${snap.session_count ?? 0}`
        : null,
      cost_ledger: snap
        ? {
            budget_count: snap.budget_count ?? 0,
            session_count: snap.session_count ?? 0,
            ready_budget_count: snap.ready_budget_count ?? 0,
            open_session_count: snap.open_session_count ?? 0,
            latest_session_id: snap.latest_session_id ?? null,
            latest_budget_id: snap.latest_budget_id ?? null,
            next_safe_action: snap.next_safe_action ?? null,
          }
        : null,
      cost_ledger_health: health
        ? {
            budget_count: health.budget_count ?? 0,
            session_count: health.session_count ?? 0,
            status: health.status ?? "idle",
            mode: health.mode ?? "cost_ledger_contracts_only",
            billing: false,
            safety_flags: { ...SAFETY },
          }
        : {
            budget_count: 0,
            session_count: 0,
            status: "idle",
            mode: "cost_ledger_contracts_only",
            billing: false,
            safety_flags: { ...SAFETY },
          },
    };
  },
};

async function getLedger(repoRoot: string) {
  const { createCostLedger } = await import("../../cost-ledger/CostLedger.js");
  const ledger = createCostLedger(repoRoot);
  ledger.ensureBootstrapped();
  ledger.repository.persist();
  ledger.reporter.writeMarkdown(ledger.repository);
  return ledger;
}

async function handleList(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: DashboardRouteContext,
): Promise<void> {
  try {
    const ledger = await getLedger(ctx.repoRoot);
    json(res, 200, {
      snapshot: ledger.repository.buildSnapshot(),
      health: ledger.repository.buildHealth(),
      sessions: ledger.listSessions(),
      budgets: ledger.listBudgets(),
      ...SAFETY,
      live: false,
    });
  } catch (e) {
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
}

async function handleBudgets(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: DashboardRouteContext,
): Promise<void> {
  try {
    const ledger = await getLedger(ctx.repoRoot);
    json(res, 200, {
      budgets: ledger.listBudgets(),
      ...SAFETY,
      live: false,
    });
  } catch (e) {
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
}

async function handleSession(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: DashboardRouteContext,
  match: RouteMatch,
): Promise<void> {
  try {
    const { rejectForbiddenBudgetPayload } = await import(
      "../../cost-ledger/BudgetValidator.js"
    );
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const probe: Record<string, unknown> = {};
    for (const key of [
      "execute",
      "bill",
      "charge",
      "provider",
      "publish",
      "enable_live",
    ]) {
      if (url.searchParams.has(key)) probe[key] = url.searchParams.get(key);
    }
    const forbidden = rejectForbiddenBudgetPayload(probe);
    if (forbidden) {
      json(res, 400, { error: forbidden.message, code: forbidden.code });
      return;
    }

    const ledger = await getLedger(ctx.repoRoot);
    const id = match.params.session!;
    const session = ledger.loadSession(id);
    if (!session) {
      json(res, 404, { error: "session not found" });
      return;
    }
    json(res, 200, {
      session,
      ...SAFETY,
      live: false,
    });
  } catch (e) {
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
}

export const costLedgerRoutes: DashboardRouteHandler[] = [
  {
    id: "cost-ledger.list",
    method: "GET",
    pathPattern: "/api/platform/cost-ledger",
    match: exactRoute("GET", "/api/platform/cost-ledger"),
    handle: (req, res, ctx) => handleList(req, res, ctx),
  },
  {
    id: "cost-ledger.budgets",
    method: "GET",
    pathPattern: "/api/platform/cost-ledger/budgets",
    match: exactRoute("GET", "/api/platform/cost-ledger/budgets"),
    handle: (req, res, ctx) => handleBudgets(req, res, ctx),
  },
  {
    id: "cost-ledger.session",
    method: "GET",
    pathPattern: "/api/platform/cost-ledger/:session",
    match: paramRoute("GET", "/api/platform/cost-ledger", "session", [
      "budgets",
    ]),
    handle: (req, res, ctx, match) => handleSession(req, res, ctx, match),
  },
];

export const costLedgerPlugin: DashboardPlugin = {
  id: "cost-ledger",
  snapshot: costLedgerSnapshotSource,
  routes: costLedgerRoutes,
};
