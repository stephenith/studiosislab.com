/**
 * AIOS Founder Dashboard local server — Agent #123/#125.
 * Snapshot + founder decision APIs. Localhost only. No PM2.
 */
import { createServer } from "node:http";
import { readFileSync, existsSync, createReadStream, statSync } from "node:fs";
import { join, extname, resolve, normalize } from "node:path";
import { createRequire } from "node:module";
import { createServer as createViteServer } from "vite";
import { loadDashboardSnapshot } from "./src/data/loadSnapshot.js";
import { loadReviewQueueForRepo } from "./src/data/buildFounderReviewQueue.js";
import { buildFounderCommandCenterSnapshot } from "../core/first-production-cycle/FounderCommandCenter.js";
import {
  loadEngineeringReviewProjection,
  updateFounderEngReviewStatus,
  type FounderEngReviewStatus,
} from "../core/engineering-intelligence/FounderEngineeringReviewOverlay.js";
import {
  ALL_FOUNDER_ACTION_TYPES,
  executeFounderAction,
  loadFounderActionSurface,
  type FounderActionType,
} from "../core/founder-action-adapters/FounderActionAdapters.js";
import { loadOrchestrationSurface } from "../core/system-orchestrator/SystemOrchestrator.js";
import {
  loadProductionValidationSurface,
  runEndToEndProductionValidation,
} from "../core/production-validation/EndToEndProductionValidation.js";
import {
  buildProductionReadinessAudit,
  loadProductionReadinessSurface,
} from "../core/production-readiness/ProductionReadinessAudit.js";
import {
  loadProductionBootstrapSurface,
  runProductionBootstrap,
} from "../core/production-bootstrap/ProductionBootstrap.js";
import {
  approveAndStartSupervisedRun,
  cancelSupervisedRun,
  loadSupervisedRunSurface,
  prepareSupervisedRun,
} from "../core/supervised-production-runner/FounderSupervisedProductionRunner.js";
import { FounderDecisionManager } from "../core/founder-decisions/FounderDecisionManager.js";
import { createRevisionTaskFromDecision } from "../core/founder-revision/createRevisionTaskFromDecision.js";
import {
  startRevisionTaskDispatcher,
  stopRevisionTaskDispatcher,
} from "../core/founder-revision/RevisionTaskDispatcher.js";
import { FounderReviewRepository } from "../core/founder-decisions/FounderReviewRepository.js";
import { CriticResultLoader } from "../core/critic-gate/CriticResultLoader.js";
import { FounderReviewGatekeeper } from "../core/critic-gate/FounderReviewGatekeeper.js";
import { validateScoresForGate } from "../core/critic-gate/CriticGateValidator.js";
import type { CriticGateResult } from "../core/critic-gate/types.js";
import { createFounderGateRuntime } from "../core/founder-gate-runtime/FounderGateRuntime.js";
import { FOUNDER_ACTOR } from "../core/founder-gate-runtime/types.js";
import {
  getStagingStatus,
  listApprovedForStaging,
  recordFounderLifecycleDecision,
  stageApprovedCandidate,
} from "../core/staging/StagingService.js";
import {
  getCandidatePublicationStatus,
  findActivePlanForCandidate,
} from "../core/publication-workflow/index.js";
import {
  approveAndExecuteRelease,
  buildPublicationPlan,
  getReleaseDryRunPath,
  getReleaseStatus,
  listReadyForRelease,
  requestRelease,
} from "../core/founder-release/FounderReleaseController.js";
import { defaultRouteRegistry } from "../platform/dashboard/RouteRegistry.js";
import { ensureDashboardPluginsRegistered } from "../platform/dashboard/plugins/register.js";

ensureDashboardPluginsRegistered();

const PORT = Number(process.env.AIOS_DASHBOARD_PORT ?? 4310);
const ROOT = resolve(import.meta.dirname);
const REPO = resolve(ROOT, "../../..");

try {
  const dotenv = createRequire(import.meta.url)("dotenv") as {
    config: (opts?: { path?: string }) => unknown;
  };
  dotenv.config({ path: resolve(REPO, ".env.local") });
} catch {
  /* optional when env already injected */
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

function readJson(rel: string): unknown | null {
  const p = join(REPO, rel);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8"));
}

async function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const vite = await createViteServer({
    root: ROOT,
    server: { middlewareMode: true },
    appType: "custom",
  });

  const server = createServer(async (req, res) => {
    const url = req.url ?? "/";
    const pathOnly = url.split("?")[0];

    if (pathOnly === "/api/snapshot") {
      try {
        // Pass REPO explicitly; always serialize review_queue at the root
        // so a stale/cached loadSnapshot module cannot omit the field.
        const snap = loadDashboardSnapshot(REPO);
        const review_queue = loadReviewQueueForRepo(REPO);
        const payload = {
          ...snap,
          review_queue,
          review_queue_count: review_queue.length,
        };
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        });
        res.end(JSON.stringify(payload));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: e instanceof Error ? e.message : String(e),
          }),
        );
      }
      return;
    }

    /** Review-only queue — same loader as snapshot, no Mission Control payload. */
    if (pathOnly === "/api/review-queue" && req.method === "GET") {
      try {
        const review_queue = loadReviewQueueForRepo(REPO);
        const waiting_founder_count = review_queue.filter(
          (r) => r.status === "waiting_founder",
        ).length;
        const payload = {
          generated_at: new Date().toISOString(),
          review_queue,
          review_queue_count: review_queue.length,
          waiting_founder_count,
          publication_allowed: false as const,
          live: false as const,
        };
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        });
        res.end(JSON.stringify(payload));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: e instanceof Error ? e.message : String(e),
          }),
        );
      }
      return;
    }

    if (pathOnly === "/api/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ok: true,
          live: false,
          port: PORT,
          read_only_except_founder_decisions: true,
          service: "aios-dashboard",
        }),
      );
      return;
    }

    /** 24/7 ops snapshot — queue, revision, spend, gates (read-only). */
    if (pathOnly === "/api/ops-24-7" && req.method === "GET") {
      try {
        const { countFounderReviewWaiting } = await import(
          "../core/founder-review/FounderReviewProjection.js"
        );
        const { listRevisionTasks } = await import(
          "../core/founder-revision/RevisionTaskStore.js"
        );
        const { evaluateSpendAgainstBudget } = await import(
          "../core/ai-brain/CostLedger.js"
        );
        const { readBudgetFromEnv } = await import(
          "../core/ai-brain/BudgetPolicy.js"
        );
        const {
          isFounderOpenAIBoundedEnabled,
        } = await import("../core/resume-integration/FounderOpenAIOneTest.js");
        const review_queue = loadReviewQueueForRepo(REPO);
        const waiting_founder = countFounderReviewWaiting(REPO);
        const tasks = listRevisionTasks();
        const byStatus: Record<string, number> = {};
        for (const t of tasks) {
          byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
        }
        const policy = readBudgetFromEnv();
        const spend = evaluateSpendAgainstBudget({
          daily_limit_usd: policy.values.daily_limit_usd,
          monthly_budget_usd: policy.values.monthly_budget_usd,
          auto_pause_threshold_pct: policy.values.auto_pause_threshold_pct,
          repoRoot: REPO,
        });
        const payload = {
          generated_at: new Date().toISOString(),
          live: process.env.SOS_AIOS_LIVE === "1",
          openai_bounded_enabled: isFounderOpenAIBoundedEnabled(),
          notify_live: process.env.SOS_AIOS_NOTIFY_LIVE === "1",
          publication_auto_apply:
            process.env.SOS_AIOS_PUBLICATION_AUTO_APPLY === "1",
          waiting_founder,
          queue_max_default: 20,
          review_queue_count: review_queue.length,
          revision_task_counts: byStatus,
          revision_pending: byStatus.PENDING ?? 0,
          revision_failed_coverage: byStatus.FAILED_COVERAGE ?? 0,
          spend,
          schedule: {
            morning_ist: "08:50 Asia/Kolkata",
            evening_ist: "17:50 Asia/Kolkata",
            batch_size: 5,
          },
        };
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        });
        res.end(JSON.stringify(payload));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: e instanceof Error ? e.message : String(e),
          }),
        );
      }
      return;
    }

    // Founder Command Center — Agent #222A. Read-only aggregation only.
    if (
      pathOnly === "/api/founder-command-center" &&
      (req.method === "GET" || req.method === "HEAD")
    ) {
      try {
        const fcc = buildFounderCommandCenterSnapshot({ repoRoot: REPO });
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        });
        res.end(JSON.stringify(fcc));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: e instanceof Error ? e.message : String(e),
          }),
        );
      }
      return;
    }

    // Engineering Review — Agent #224. Reuses #223 report + status overlay only.
    if (
      pathOnly === "/api/engineering-review" &&
      (req.method === "GET" || req.method === "HEAD")
    ) {
      try {
        const projection = loadEngineeringReviewProjection({ repoRoot: REPO });
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        });
        res.end(JSON.stringify(projection));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: e instanceof Error ? e.message : String(e),
          }),
        );
      }
      return;
    }

    if (pathOnly === "/api/engineering-review-status" && req.method === "POST") {
      if (process.env.SOS_AIOS_LIVE === "1") {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "LIVE must be OFF" }));
        return;
      }
      try {
        const raw = await readBody(req);
        const body = JSON.parse(raw) as {
          recommendation_id?: string;
          status?: FounderEngReviewStatus;
          note?: string;
          execute?: unknown;
          cleanup?: unknown;
          refactor?: unknown;
        };
        if (
          "execute" in body ||
          "cleanup" in body ||
          "refactor" in body ||
          "publish" in body ||
          "enable_live" in body
        ) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: "execution/cleanup/publish controls forbidden",
            }),
          );
          return;
        }
        if (!body.recommendation_id || !body.status) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({ error: "recommendation_id and status required" }),
          );
          return;
        }
        const result = updateFounderEngReviewStatus({
          recommendation_id: body.recommendation_id,
          status: body.status,
          note: body.note,
          repoRoot: REPO,
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            ...result,
            live: false,
            publication_allowed: false,
            openai_called: false,
            production_triggered: false,
          }),
        );
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: e instanceof Error ? e.message : String(e),
          }),
        );
      }
      return;
    }

    // Founder Supervised Production Runner — Agent #230. Founder approval required.
    if (
      pathOnly === "/api/supervised-production-run" &&
      (req.method === "GET" || req.method === "HEAD")
    ) {
      try {
        const surface = loadSupervisedRunSurface({ repoRoot: REPO });
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        });
        res.end(JSON.stringify(surface));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: e instanceof Error ? e.message : String(e),
          }),
        );
      }
      return;
    }

    if (pathOnly === "/api/supervised-production-run" && req.method === "POST") {
      if (process.env.SOS_AIOS_LIVE === "1") {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "LIVE must be OFF" }));
        return;
      }
      try {
        const raw = await readBody(req);
        const body = (raw ? JSON.parse(raw) : {}) as {
          prepare?: unknown;
          approve?: unknown;
          cancel?: unknown;
          simulation_mode?: unknown;
          publish?: unknown;
          enable_live?: unknown;
        };
        if ("publish" in body || "enable_live" in body) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: "publish/enable_live forbidden on supervised runner",
            }),
          );
          return;
        }
        const simulation_mode = body.simulation_mode !== false;
        if (body.cancel) {
          const report = await cancelSupervisedRun({
            repoRoot: REPO,
            requested_by: "founder",
          });
          const surface = loadSupervisedRunSurface({ repoRoot: REPO });
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ...surface, last_run: report }));
          return;
        }
        if (body.approve) {
          const report = await approveAndStartSupervisedRun({
            repoRoot: REPO,
            requested_by: "founder",
            simulation_mode,
          });
          const surface = loadSupervisedRunSurface({ repoRoot: REPO });
          if (report.batch_status === "BLOCKED") {
            res.writeHead(409, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                ...surface,
                last_run: report,
                blocker: report.preflight_blocker ?? report.errors[0] ?? "Blocked",
                error: report.preflight_blocker ?? report.errors[0] ?? "Blocked",
              }),
            );
            return;
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              ...surface,
              last_run: report,
              live: false,
              publication_allowed: false,
            }),
          );
          return;
        }
        // default: prepare
        const report = prepareSupervisedRun({
          repoRoot: REPO,
          simulation_mode,
        });
        const surface = loadSupervisedRunSurface({ repoRoot: REPO });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            ...surface,
            last_run: report,
            live: false,
            publication_allowed: false,
          }),
        );
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: e instanceof Error ? e.message : String(e),
          }),
        );
      }
      return;
    }

    // Production Bootstrap — Agent #229. Prepare only; never executes production.
    if (
      pathOnly === "/api/production-bootstrap" &&
      (req.method === "GET" || req.method === "HEAD")
    ) {
      try {
        const surface = loadProductionBootstrapSurface({ repoRoot: REPO });
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        });
        res.end(JSON.stringify(surface));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: e instanceof Error ? e.message : String(e),
          }),
        );
      }
      return;
    }

    if (pathOnly === "/api/production-bootstrap" && req.method === "POST") {
      if (process.env.SOS_AIOS_LIVE === "1") {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "LIVE must be OFF" }));
        return;
      }
      try {
        const raw = await readBody(req);
        const body = (raw ? JSON.parse(raw) : {}) as {
          bootstrap?: unknown;
          execute?: unknown;
          produce?: unknown;
          publish?: unknown;
          enable_live?: unknown;
          generate?: unknown;
        };
        if (
          "execute" in body ||
          "produce" in body ||
          "publish" in body ||
          "enable_live" in body ||
          "generate" in body
        ) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: "execute/produce/publish/live/generate controls forbidden",
            }),
          );
          return;
        }
        const report = runProductionBootstrap({ repoRoot: REPO });
        const surface = loadProductionBootstrapSurface({ repoRoot: REPO });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            ...surface,
            last_run: report,
            live: false,
            publication_allowed: false,
            openai_called: false,
            executes_production: false,
          }),
        );
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: e instanceof Error ? e.message : String(e),
          }),
        );
      }
      return;
    }

    // Production Readiness Audit — Agent #228. Audit only; never executes production.
    if (
      pathOnly === "/api/production-readiness" &&
      (req.method === "GET" || req.method === "HEAD")
    ) {
      try {
        const surface = loadProductionReadinessSurface({ repoRoot: REPO });
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        });
        res.end(JSON.stringify(surface));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: e instanceof Error ? e.message : String(e),
          }),
        );
      }
      return;
    }

    if (pathOnly === "/api/production-readiness" && req.method === "POST") {
      if (process.env.SOS_AIOS_LIVE === "1") {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "LIVE must be OFF" }));
        return;
      }
      try {
        const raw = await readBody(req);
        const body = (raw ? JSON.parse(raw) : {}) as {
          audit?: unknown;
          fix?: unknown;
          repair?: unknown;
          execute?: unknown;
          publish?: unknown;
          enable_live?: unknown;
        };
        if (
          "fix" in body ||
          "repair" in body ||
          "execute" in body ||
          "publish" in body ||
          "enable_live" in body
        ) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: "fix/repair/execute/publish/live controls forbidden",
            }),
          );
          return;
        }
        const report = buildProductionReadinessAudit({ repoRoot: REPO });
        const surface = loadProductionReadinessSurface({ repoRoot: REPO });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            ...surface,
            last_run: report,
            live: false,
            publication_allowed: false,
            openai_called: false,
          }),
        );
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: e instanceof Error ? e.message : String(e),
          }),
        );
      }
      return;
    }

    // Production Validation — Agent #227. Validation only; never modifies production.
    if (
      pathOnly === "/api/production-validation" &&
      (req.method === "GET" || req.method === "HEAD")
    ) {
      try {
        const surface = loadProductionValidationSurface({ repoRoot: REPO });
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        });
        res.end(JSON.stringify(surface));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: e instanceof Error ? e.message : String(e),
          }),
        );
      }
      return;
    }

    if (pathOnly === "/api/production-validation" && req.method === "POST") {
      if (process.env.SOS_AIOS_LIVE === "1") {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "LIVE must be OFF" }));
        return;
      }
      try {
        const raw = await readBody(req);
        const body = (raw ? JSON.parse(raw) : {}) as {
          run?: unknown;
          fix?: unknown;
          repair?: unknown;
          cleanup?: unknown;
          publish?: unknown;
          enable_live?: unknown;
        };
        if (
          "fix" in body ||
          "repair" in body ||
          "cleanup" in body ||
          "publish" in body ||
          "enable_live" in body
        ) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: "fix/repair/cleanup/publish/live controls forbidden",
            }),
          );
          return;
        }
        const report = await runEndToEndProductionValidation({
          repoRoot: REPO,
        });
        const surface = loadProductionValidationSurface({ repoRoot: REPO });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            ...surface,
            last_run: report,
            live: false,
            publication_allowed: false,
            openai_called: false,
          }),
        );
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: e instanceof Error ? e.message : String(e),
          }),
        );
      }
      return;
    }

    // System Orchestrator — Agent #226. Coordination surface only.
    if (
      pathOnly === "/api/system-orchestrator" &&
      (req.method === "GET" || req.method === "HEAD")
    ) {
      try {
        const surface = loadOrchestrationSurface({ repoRoot: REPO });
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        });
        res.end(JSON.stringify(surface));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: e instanceof Error ? e.message : String(e),
          }),
        );
      }
      return;
    }

    // Founder Action Adapters — Agent #225. Validate → Authorize → Delegate → Audit.
    if (
      pathOnly === "/api/founder-actions" &&
      (req.method === "GET" || req.method === "HEAD")
    ) {
      try {
        const surface = loadFounderActionSurface({ repoRoot: REPO });
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        });
        res.end(JSON.stringify(surface));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: e instanceof Error ? e.message : String(e),
          }),
        );
      }
      return;
    }

    if (pathOnly === "/api/founder-action" && req.method === "POST") {
      if (process.env.SOS_AIOS_LIVE === "1") {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "LIVE must be OFF" }));
        return;
      }
      try {
        const raw = await readBody(req);
        const body = JSON.parse(raw) as {
          action_type?: string;
          requested_by?: string;
          cleanup?: unknown;
          refactor?: unknown;
          publish?: unknown;
          enable_live?: unknown;
          modify_code?: unknown;
        };
        if (
          "cleanup" in body ||
          "refactor" in body ||
          "publish" in body ||
          "enable_live" in body ||
          "modify_code" in body
        ) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: "cleanup/refactor/publish/live/code controls forbidden",
            }),
          );
          return;
        }
        if (
          !body.action_type ||
          !(ALL_FOUNDER_ACTION_TYPES as string[]).includes(body.action_type)
        ) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "valid action_type required" }));
          return;
        }
        const result = await executeFounderAction({
          action_type: body.action_type as FounderActionType,
          requested_by: body.requested_by ?? "founder",
          repoRoot: REPO,
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            ...result,
            live: false,
            publication_allowed: false,
            openai_called: false,
          }),
        );
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: e instanceof Error ? e.message : String(e),
          }),
        );
      }
      return;
    }

    // Dashboard plugins (Wave-1 + Wave-2) — Founder Review remains inline below
    if (
      await defaultRouteRegistry.tryHandle(req, res, pathOnly, {
        repoRoot: REPO,
        readBody,
      })
    ) {
      return;
    }

    // Static existing preview/thumbnail PNGs under SOS/07_LOGS only.
    // Does not alter /api/founder-review or /api/founder-decision.
    if (pathOnly.startsWith("/artifacts/") && req.method === "GET") {
      const rel = decodeURIComponent(pathOnly.slice("/artifacts/".length));
      const logsRoot = resolve(REPO, "SOS/07_LOGS");
      const abs = resolve(REPO, normalize(rel));
      if (
        !abs.startsWith(logsRoot + "/") &&
        abs !== logsRoot
      ) {
        res.writeHead(403, { "Content-Type": "text/plain" });
        res.end("forbidden");
        return;
      }
      const ext = extname(abs).toLowerCase();
      if (![".png", ".webp", ".jpg", ".jpeg"].includes(ext)) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("not found");
        return;
      }
      if (!existsSync(abs) || !statSync(abs).isFile()) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("not found");
        return;
      }
      const st = statSync(abs);
      // mtime+size ETag so replaced artifacts invalidate; short private cache over SSH tunnel.
      const etag = `W/"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
      const cacheHeaders = {
        ETag: etag,
        "Last-Modified": st.mtime.toUTCString(),
        "Cache-Control": "private, max-age=60, must-revalidate",
      };
      const inm = req.headers["if-none-match"];
      if (typeof inm === "string" && inm === etag) {
        res.writeHead(304, cacheHeaders);
        res.end();
        return;
      }
      res.writeHead(200, {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        ...cacheHeaders,
      });
      createReadStream(abs).pipe(res);
      return;
    }

    if (pathOnly === "/api/founder-review" && req.method === "GET") {
      const prodReview = readJson(
        "SOS/07_LOGS/saios/first-production-cycle/review.json",
      ) as {
        review_id?: string;
        task_id?: string;
        cycle_id?: string;
        candidate_id?: string;
        status?: string;
        auto_decision?: boolean;
      } | null;
      const gateRuntime = createFounderGateRuntime();
      const waiting =
        gateRuntime.listWaiting(false).find(
          (c) =>
            c.review_id === prodReview?.review_id ||
            c.cycle_id === prodReview?.cycle_id,
        ) ?? gateRuntime.listWaiting(false)[0] ?? null;

      const useProduction =
        Boolean(waiting) ||
        prodReview?.status === "waiting_founder" ||
        prodReview?.auto_decision === false;

      const review = useProduction && prodReview
        ? {
            id: prodReview.review_id,
            task_id: prodReview.task_id,
            cycle_id: prodReview.cycle_id ?? waiting?.cycle_id,
            candidate_id: prodReview.candidate_id,
            status: waiting ? "waiting_founder" : prodReview.status,
            title: waiting?.candidate_title ?? "Production cycle resume template",
            detail:
              "WAITING FOR FOUNDER — execution paused — no automatic decision — no automatic publication · LIVE OFF · dry_run · Mock Provider",
            skill_id: "resume.layout_planning",
            source: "SOS/07_LOGS/saios/first-production-cycle",
          }
        : (readJson(
            "SOS/07_LOGS/saios/first-dry-run/founder-review.json",
          ) as Record<string, unknown> | null);

      const provider = useProduction
        ? readJson("SOS/07_LOGS/saios/first-production-cycle/designbrief.json") ??
          readJson("SOS/07_LOGS/saios/first-dry-run/provider-response.json")
        : readJson("SOS/07_LOGS/saios/first-dry-run/provider-response.json");
      const qa = useProduction
        ? readJson("SOS/07_LOGS/saios/first-production-cycle/critic.json") ??
          readJson("SOS/07_LOGS/saios/first-dry-run/qa-summary.json")
        : readJson("SOS/07_LOGS/saios/first-dry-run/qa-summary.json");
      const timeline = (
        useProduction
          ? readJson("SOS/07_LOGS/saios/first-production-cycle/pipeline.json")
          : readJson("SOS/07_LOGS/saios/first-dry-run/execution-timeline.json")
      ) as { timeline?: unknown[]; objective?: string; stages?: unknown[] } | null;
      const knowledge = readJson(
        "SOS/07_LOGS/saios/first-dry-run/knowledge-used.json",
      ) as { domains?: string[] } | null;
      const skill = readJson(
        "SOS/07_LOGS/saios/first-dry-run/skill-used.json",
      ) as { skill_id?: string } | null;

      if (!review) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "founder review artifact missing" }));
        return;
      }

      const repo = new FounderReviewRepository(REPO);
      const existing = repo.latestForReview(String(review.id), false);
      const consumedForCycle = waiting
        ? gateRuntime.repo
            .listConsumptions()
            .some((c) => c.cycle_id === waiting.cycle_id && !c.fixture)
        : false;
      // Historical Agent #132 auto-decision may exist; interactive waiting cycle still needs a decision
      const undecided =
        Boolean(waiting) && !consumedForCycle
          ? true
          : !existing && Boolean(waiting || !useProduction);

      const loader = new CriticResultLoader(REPO);
      const scores = loader.loadScores();
      let criticPayload: Record<string, unknown> | null = null;
      let founder_review_allowed = true;
      if (scores) {
        const verdict = validateScoresForGate(scores);
        criticPayload = {
          ...scores,
          ready: verdict.ready,
          founder_review_allowed: verdict.ready,
          publication_allowed: false,
          blocking_reasons: verdict.blocking_reasons,
          critic_report_reference: loader.defaultReportReference(),
          gate_id: null,
          source: loader.defaultReportReference(),
        };
        founder_review_allowed = verdict.ready;
      }

      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(
        JSON.stringify({
          review,
          objective:
            timeline?.objective ??
            "Create a planning response for an ATS-friendly Marketing Manager template",
          knowledge_domains: knowledge?.domains ?? [
            "founder",
            "company",
            "department",
            "learning",
          ],
          skill_id: skill?.skill_id ?? String(review.skill_id ?? ""),
          provider: "Mock",
          structured_response: provider,
          qa,
          timeline:
            timeline?.timeline ??
            (Array.isArray(timeline?.stages)
              ? (timeline!.stages as unknown[]).map((s) => {
                  const st = s as { stage?: string; status?: string };
                  return {
                    stage: st.stage,
                    summary: st.status ?? "completed",
                  };
                })
              : []),
          warnings: [
            waiting
              ? "WAITING FOR FOUNDER — execution paused"
              : "DRY RUN — Mock Provider output only",
            "NO PUBLICATION — approval never publishes",
            "LIVE OFF",
            "dry_run",
            "Mock Provider",
            "no automatic decision",
            "no automatic publication",
            founder_review_allowed
              ? "CRITIC Ready=YES — review permitted"
              : "CRITIC Ready=NO — review controls blocked",
          ],
          undecided,
          existing_decision_id: existing?.decision_id ?? null,
          historical_decision_note:
            existing && undecided
              ? "Prior decision exists in immutable history; interactive gate requires a fresh dashboard decision (will supersede)."
              : null,
          critic: criticPayload,
          founder_review_allowed,
          founder_waiting: Boolean(waiting),
          paused: Boolean(waiting),
          cycle_id:
            String(
              (review as { cycle_id?: string }).cycle_id ??
                waiting?.cycle_id ??
                "",
            ) || null,
          waiting_banner:
            "WAITING FOR FOUNDER — execution paused — no automatic decision — no automatic publication · LIVE OFF · dry_run · Mock Provider",
        }),
      );
      return;
    }

    if (pathOnly === "/api/founder-decision" && req.method === "POST") {
      if (process.env.SOS_AIOS_LIVE === "1") {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "LIVE must be OFF" }));
        return;
      }
      try {
        const raw = await readBody(req);
        const body = JSON.parse(raw) as {
          review_id: string;
          task_id: string;
          cycle_id: string;
          candidate_id?: string;
          decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
          reason: string;
          requested_changes?: string[];
        };
        // Forbid publish-related fields
        if ("publish" in (body as object) || "enable_live" in (body as object)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "publication/live controls forbidden" }));
          return;
        }

        // Critic gate enforcement for new decision submissions
        const loader = new CriticResultLoader(REPO);
        const scores = loader.loadScores();
        if (scores) {
          const verdict = validateScoresForGate(scores);
          const gate: CriticGateResult = {
            gate_id: "dashboard-live-check",
            task_id: body.task_id,
            cycle_id: body.cycle_id,
            candidate_id: body.review_id,
            candidate_title: body.review_id,
            critic_report_reference: loader.defaultReportReference(),
            overall_score: scores.overall,
            ats_score: scores.ats,
            visual_score: scores.visual,
            typography_score: scores.typography,
            layout_score: scores.layout,
            technical_score: scores.technical,
            consistency_score: scores.consistency,
            section_score: scores.sections,
            ready: verdict.ready,
            blocking_reasons: verdict.blocking_reasons,
            warnings: verdict.warnings,
            evaluated_at: new Date().toISOString(),
            dry_run: true,
            founder_review_allowed: verdict.ready,
            publication_allowed: false,
          };
          const gk = new FounderReviewGatekeeper();
          const allowed = gk.canSubmitFounderDecision(gate);
          if (!allowed.allowed) {
            res.writeHead(403, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: allowed.reason, publication_allowed: false }));
            return;
          }
        }

        const gateRuntime = createFounderGateRuntime();
        const waiting =
          gateRuntime.listWaiting(false).find(
            (c) =>
              c.cycle_id === body.cycle_id ||
              c.review_id === body.review_id ||
              c.task_id === body.task_id,
          ) ?? null;
        const resolvedCycleId = waiting?.cycle_id ?? body.cycle_id;
        const resolvedReviewId = waiting?.review_id ?? body.review_id;
        const resolvedTaskId = waiting?.task_id ?? body.task_id;

        const mgr = new FounderDecisionManager();
        const prior = new FounderReviewRepository(REPO).latestForReview(
          resolvedReviewId,
          false,
        );
        const result = mgr.recordDecision({
          review_id: resolvedReviewId,
          task_id: resolvedTaskId,
          cycle_id: resolvedCycleId,
          decision: body.decision,
          reason: body.reason,
          requested_changes: body.requested_changes,
          fixture: false,
          structured_feedback: body.candidate_id
            ? { candidate_id: body.candidate_id }
            : undefined,
          // Preserve Agent #132 history; supersede when re-deciding a waiting cycle
          supersedes:
            waiting && prior ? prior.decision_id : undefined,
        });

        // Founder feedback revision task (durable) — PENDING claimed by
        // RevisionTaskDispatcher → runFounderFeedbackRevision (not in-request).
        let revision_task: {
          task_id: string;
          created: boolean;
          status: string;
        } | null = null;
        if (body.decision === "CHANGES_REQUESTED") {
          const rt = createRevisionTaskFromDecision({
            decision_id: result.decision.decision_id,
            review_id: result.decision.review_id,
            decision: result.decision.decision,
            reason: result.decision.reason,
            requested_changes: result.decision.requested_changes,
            structured_feedback: body.candidate_id
              ? { candidate_id: body.candidate_id }
              : result.decision.structured_feedback,
            task_id: result.decision.task_id,
            cycle_id: result.decision.cycle_id,
          });
          if (rt.task) {
            revision_task = {
              task_id: rt.task.task_id,
              created: rt.created,
              status: rt.task.status,
            };
          }
        }

        // Agent #242 — lifecycle projection (approval ≠ staging ≠ publish)
        const lifecycleCandidateId =
          body.candidate_id ||
          waiting?.candidate_id ||
          null;
        let lifecycle_recorded = false;
        if (lifecycleCandidateId) {
          try {
            recordFounderLifecycleDecision({
              candidate_id: lifecycleCandidateId,
              decision: body.decision,
              decision_id: result.decision.decision_id,
              actor: FOUNDER_ACTOR,
            });
            lifecycle_recorded = true;
          } catch (lifeErr) {
            // Decision is immutable; surface lifecycle error without rolling back history
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                decision: result.decision,
                learning_count: result.learning.length,
                queue: result.queue,
                publication_allowed: false,
                lifecycle_recorded: false,
                lifecycle_error:
                  lifeErr instanceof Error ? lifeErr.message : String(lifeErr),
                message:
                  "Decision recorded · lifecycle update failed · staging blocked until corrected · no publication",
              }),
            );
            return;
          }
        }

        let resume: ReturnType<typeof gateRuntime.consumeDashboardDecision> | null =
          null;
        if (waiting) {
          resume = gateRuntime.consumeDashboardDecision({
            decision_id: result.decision.decision_id,
            review_id: result.decision.review_id,
            task_id: result.decision.task_id,
            cycle_id: result.decision.cycle_id,
            decision: result.decision.decision,
            founder_actor: result.decision.founder_actor || FOUNDER_ACTOR,
            reason: result.decision.reason,
            requested_changes: result.decision.requested_changes,
            publication_allowed: false,
            dry_run: true,
          });
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            decision: result.decision,
            learning_count: result.learning.length,
            queue: result.queue,
            publication_allowed: false,
            lifecycle_recorded,
            candidate_id: lifecycleCandidateId,
            cycle_resumed: resume?.ok === true,
            cycle_state: resume?.state ?? (waiting ? "WAITING_FOUNDER" : null),
            cycle_duplicate: resume?.duplicate === true,
            next_action: resume?.next_action ?? result.decision.next_action,
            revision_task,
            message: resume?.ok
              ? resume.duplicate
                ? "Decision already consumed — no duplicate resume"
                : "Cycle resumed · learning write-back complete · no publication · staging not automatic"
              : waiting
                ? resume?.error ?? "Resume failed"
                : body.decision === "APPROVED"
                  ? "Approved · Stage for StudiosisLab available · publication_allowed=false"
                  : revision_task
                    ? `Decision recorded · revision task ${revision_task.task_id} ${revision_task.created ? "created" : "exists"} · publication_allowed=false`
                    : "Decision recorded (no waiting cycle)",
          }),
        );
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: e instanceof Error ? e.message : String(e),
          }),
        );
      }
      return;
    }

    // Agent #246 — Founder release APIs (explicit approval only; no auto-publish)
    if (pathOnly === "/api/release/ready" && req.method === "GET") {
      if (process.env.SOS_AIOS_LIVE === "1") {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "LIVE must be OFF for dashboard release APIs" }));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ready: listReadyForRelease(),
          auto_publish: false,
          live: false,
        }),
      );
      return;
    }

    if (pathOnly === "/api/release/status" && req.method === "GET") {
      const u = new URL(url, "http://127.0.0.1");
      const exportPackageId = u.searchParams.get("export_package_id") ?? undefined;
      const candidateId = u.searchParams.get("candidate_id") ?? undefined;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify(
          getReleaseStatus({
            export_package_id: exportPackageId,
            candidate_id: candidateId,
          }),
        ),
      );
      return;
    }

    if (pathOnly === "/api/release/plan" && req.method === "GET") {
      try {
        const u = new URL(url, "http://127.0.0.1");
        const plan = buildPublicationPlan({
          export_package_id: u.searchParams.get("export_package_id") ?? undefined,
          candidate_id: u.searchParams.get("candidate_id") ?? undefined,
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(plan));
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: e instanceof Error ? e.message : String(e),
          }),
        );
      }
      return;
    }

    if (pathOnly === "/api/release/dry-run" && req.method === "GET") {
      const u = new URL(url, "http://127.0.0.1");
      const exportPackageId = u.searchParams.get("export_package_id");
      if (!exportPackageId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "export_package_id required" }));
        return;
      }
      const p = getReleaseDryRunPath(exportPackageId);
      if (!p || !existsSync(p)) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "dry-run report not found" }));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(readFileSync(p, "utf8"));
      return;
    }

    if (pathOnly === "/api/release/request" && req.method === "POST") {
      if (process.env.SOS_AIOS_LIVE === "1") {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "LIVE must be OFF" }));
        return;
      }
      try {
        const raw = await readBody(req);
        const body = JSON.parse(raw) as {
          export_package_id?: string;
          candidate_id?: string;
        };
        const result = requestRelease({
          export_package_id: body.export_package_id,
          candidate_id: body.candidate_id,
          actor: FOUNDER_ACTOR,
        });
        res.writeHead(result.ok ? 200 : 409, {
          "Content-Type": "application/json",
        });
        res.end(JSON.stringify({ ...result, auto_publish: false, live: false }));
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: e instanceof Error ? e.message : String(e),
          }),
        );
      }
      return;
    }

    if (pathOnly === "/api/release/approve" && req.method === "POST") {
      if (process.env.SOS_AIOS_LIVE === "1") {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "LIVE must be OFF" }));
        return;
      }
      try {
        const raw = await readBody(req);
        const body = JSON.parse(raw) as {
          export_package_id?: string;
          candidate_id?: string;
          explicit_approval?: boolean;
          confirm_phrase?: string;
          confirm_dialog?: boolean;
          founder_name?: string;
        };
        if (body.explicit_approval !== true || body.confirm_dialog !== true) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error:
                "explicit_approval and confirm_dialog required — never inferred",
              auto_publish: false,
            }),
          );
          return;
        }
        const result = await approveAndExecuteRelease({
          export_package_id: body.export_package_id,
          candidate_id: body.candidate_id,
          explicit_approval: true,
          confirm_phrase: body.confirm_phrase ?? "",
          confirm_dialog: true,
          founder_name: body.founder_name ?? "Stephen",
          actor: FOUNDER_ACTOR,
        });
        res.writeHead(result.ok ? 200 : 409, {
          "Content-Type": "application/json",
        });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: e instanceof Error ? e.message : String(e),
            auto_publish: false,
          }),
        );
      }
      return;
    }

    // Agent #242 — staging APIs (localhost founder-only; never publishes)
    if (pathOnly === "/api/staging/approved" && req.method === "GET") {
      if (process.env.SOS_AIOS_LIVE === "1") {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "LIVE must be OFF" }));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          approved: listApprovedForStaging(),
          publication_allowed: false,
          live: false,
        }),
      );
      return;
    }

    if (pathOnly === "/api/staging/status" && req.method === "GET") {
      const candidateId = new URL(url, "http://127.0.0.1").searchParams.get(
        "candidate_id",
      );
      if (!candidateId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "candidate_id required" }));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(getStagingStatus(candidateId)));
      return;
    }

    if (pathOnly === "/api/publication/status" && req.method === "GET") {
      const candidateId = new URL(url, "http://127.0.0.1").searchParams.get(
        "candidate_id",
      );
      if (!candidateId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "candidate_id required" }));
        return;
      }
      const status = getCandidatePublicationStatus(candidateId);
      const activePlan = findActivePlanForCandidate(candidateId);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ...status,
          active_plan_id: activePlan?.plan_id ?? null,
          publication_allowed: false,
          live: false,
        }),
      );
      return;
    }

    if (pathOnly === "/api/staging/validation" && req.method === "GET") {
      const candidateId = new URL(url, "http://127.0.0.1").searchParams.get(
        "candidate_id",
      );
      if (!candidateId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "candidate_id required" }));
        return;
      }
      const status = getStagingStatus(candidateId);
      let report = status.validation;
      if (!report && status.staging_path) {
        const vr = join(REPO, status.staging_path, "validation-report.json");
        if (existsSync(vr)) {
          report = JSON.parse(readFileSync(vr, "utf8"));
        }
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          candidate_id: candidateId,
          validation: report,
          publication_allowed: false,
        }),
      );
      return;
    }

    if (
      (pathOnly === "/api/staging/request" ||
        pathOnly === "/api/staging/retry") &&
      req.method === "POST"
    ) {
      if (process.env.SOS_AIOS_LIVE === "1") {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "LIVE must be OFF" }));
        return;
      }
      try {
        const raw = await readBody(req);
        const body = JSON.parse(raw) as {
          candidate_id?: string;
          decision_id?: string;
        };
        if ("publish" in (body as object) || "catalogue_id" in (body as object)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: "publication/catalogue controls forbidden on staging",
            }),
          );
          return;
        }
        if (!body.candidate_id) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "candidate_id required" }));
          return;
        }
        const result = await stageApprovedCandidate({
          candidate_id: body.candidate_id,
          decision_id: body.decision_id ?? null,
          actor: FOUNDER_ACTOR,
        });
        res.writeHead(result.ok ? 200 : 409, {
          "Content-Type": "application/json",
        });
        res.end(
          JSON.stringify({
            ...result,
            publication_allowed: false,
            release_manager_invoked: false,
            website_files_written: false,
          }),
        );
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: e instanceof Error ? e.message : String(e),
            publication_allowed: false,
          }),
        );
      }
      return;
    }

    const dist = join(ROOT, "dist");
    if (process.env.AIOS_DASHBOARD_STATIC === "1" && existsSync(dist)) {
      const filePath =
        pathOnly === "/" ? join(dist, "index.html") : join(dist, pathOnly);
      if (existsSync(filePath) && statSync(filePath).isFile()) {
        res.writeHead(200, {
          "Content-Type": MIME[extname(filePath)] ?? "application/octet-stream",
        });
        createReadStream(filePath).pipe(res);
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(readFileSync(join(dist, "index.html")));
      return;
    }

    vite.middlewares(req, res, async () => {
      try {
        const template = readFileSync(join(ROOT, "index.html"), "utf8");
        const html = await vite.transformIndexHtml(url, template);
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(html);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        res.writeHead(500);
        res.end(String(e));
      }
    });
  });

  server.listen(PORT, "127.0.0.1", () => {
    console.log(`AIOS Founder Dashboard (local) http://127.0.0.1:${PORT}`);
    console.log("LIVE OFF · dry_run · founder decisions allowed · no publish");
    // Background PENDING→EXECUTING revision dispatcher (systemd-persistent process).
    // Idempotent per process (Vite HMR safe). Does not block HTTP.
    startRevisionTaskDispatcher();
  });

  const shutdown = (signal: string) => {
    console.log(`[dashboard] ${signal} — stopping revision dispatcher`);
    stopRevisionTaskDispatcher();
    server.close(() => process.exit(0));
    // Failsafe exit if close hangs
    setTimeout(() => process.exit(0), 5_000).unref();
  };
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
