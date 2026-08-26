/**
 * Execution Controller dashboard plugin — Agent #179.
 * Scaffold review only. Never executes.
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
  dispatch_allowed: false,
  worker_spawn_allowed: false,
  queue_insert_allowed: false,
  provider_allowed: false,
  publishing_allowed: false,
  live_enabled: false,
  scheduler_allowed: false,
} as const;

export const executionControllerSnapshotSource: SnapshotSource = {
  id: "execution-controller",
  fields: [
    "execution_controller_status",
    "pending_execution_controller",
    "latest_execution_controller",
    "execution_controller_health",
  ],
  empty() {
    return {
      execution_controller_status: null,
      pending_execution_controller: false,
      latest_execution_controller: null,
      execution_controller_health: null,
    };
  },
  load(ctx) {
    const snap = ctx.readJson(
      "SOS/07_LOGS/saios/runtime/execution-controller/latest-execution-controller-snapshot.json",
    ) as {
      controller_status?: string | null;
      pending?: boolean;
      controller_id?: string | null;
      mission_id?: string | null;
      runtime_plan_id?: string | null;
      runtime_release_id?: string | null;
      system_readiness_id?: string | null;
      plan_checksum?: string | null;
      readiness_checksum?: string | null;
      next_safe_action?: string | null;
    } | null;
    const health = ctx.readJson(
      "SOS/07_LOGS/saios/runtime/execution-controller/execution-controller-health.json",
    ) as {
      pending_count?: number;
      ready_count?: number;
      blocked_count?: number;
      record_count?: number;
      status?: string;
      mode?: string;
    } | null;

    return {
      execution_controller_status: snap?.controller_status ?? null,
      pending_execution_controller: Boolean(snap?.pending),
      latest_execution_controller: snap
        ? {
            controller_id: snap.controller_id ?? null,
            controller_status: snap.controller_status ?? null,
            mission_id: snap.mission_id ?? null,
            runtime_plan_id: snap.runtime_plan_id ?? null,
            runtime_release_id: snap.runtime_release_id ?? null,
            system_readiness_id: snap.system_readiness_id ?? null,
            plan_checksum: snap.plan_checksum ?? null,
            readiness_checksum: snap.readiness_checksum ?? null,
            next_safe_action: snap.next_safe_action ?? null,
          }
        : null,
      execution_controller_health: health
        ? {
            pending_count: health.pending_count ?? 0,
            ready_count: health.ready_count ?? 0,
            blocked_count: health.blocked_count ?? 0,
            record_count: health.record_count ?? 0,
            status: health.status ?? "idle",
            mode: health.mode ?? "controller_scaffold_only",
            safety_flags: { ...SAFETY },
          }
        : {
            pending_count: 0,
            ready_count: 0,
            blocked_count: 0,
            record_count: 0,
            status: "idle",
            mode: "controller_scaffold_only",
            safety_flags: { ...SAFETY },
          },
    };
  },
};

async function handleControllerList(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: DashboardRouteContext,
): Promise<void> {
  try {
    const { ExecutionControllerRepository } = await import(
      "../../../runtime/execution-controller/ExecutionControllerRepository.js"
    );
    const store = new ExecutionControllerRepository(ctx.repoRoot);
    json(res, 200, {
      latest: store.loadLatest(),
      record: store.loadLatestRecord(),
      health: store.loadHealth(),
      ...SAFETY,
      live: false,
    });
  } catch (e) {
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
}

async function handleControllerMission(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: DashboardRouteContext,
  match: RouteMatch,
): Promise<void> {
  try {
    const { createExecutionController } = await import(
      "../../../runtime/execution-controller/ExecutionController.js"
    );
    const { ExecutionControllerRepository } = await import(
      "../../../runtime/execution-controller/ExecutionControllerRepository.js"
    );
    const { rejectForbiddenControllerPayload } = await import(
      "../../../runtime/execution-controller/ExecutionLifecycleValidator.js"
    );

    const missionId = match.params.mission_id!;
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const probe: Record<string, unknown> = {};
    for (const key of [
      "execute",
      "dispatch",
      "scheduler",
      "provider",
      "publish",
      "enable_live",
      "queue_insert",
      "spawn_worker",
      "worker_spawn",
    ]) {
      if (url.searchParams.has(key)) probe[key] = url.searchParams.get(key);
    }
    const forbidden = rejectForbiddenControllerPayload(probe);
    if (forbidden) {
      json(res, 400, { error: forbidden.message, code: forbidden.code });
      return;
    }

    const mgr = createExecutionController(ctx.repoRoot);
    const mission = mgr.registry.get(missionId);
    if (!mission || mission.fixture) {
      json(res, 404, { error: "mission not found" });
      return;
    }

    if (mission.status === "SYSTEM_READY") {
      mgr.openForAuthorization(missionId, { fixture: false });
    }

    const refreshed = mgr.registry.get(missionId);
    const record = mgr.getForMission(missionId);
    const store = new ExecutionControllerRepository(ctx.repoRoot);
    const history = store
      .listHistory()
      .filter((h) => h.mission_id === missionId)
      .slice(-20);

    json(res, 200, {
      record,
      mission_status: refreshed?.status ?? mission.status,
      controller_status: record?.controller_status ?? null,
      history,
      latest: store.loadLatest(),
      health: store.loadHealth(),
      ...SAFETY,
      live: false,
      error:
        !record && refreshed?.status !== "SYSTEM_READY"
          ? `Mission must be SYSTEM_READY (got ${refreshed?.status})`
          : undefined,
    });
  } catch (e) {
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
}

async function handleControllerReview(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: DashboardRouteContext,
): Promise<void> {
  if (process.env.SOS_AIOS_LIVE === "1") {
    json(res, 403, { error: "LIVE must be OFF" });
    return;
  }
  try {
    const { createExecutionController } = await import(
      "../../../runtime/execution-controller/ExecutionController.js"
    );
    const { EXECUTION_CONTROLLER_FOUNDER_ACTOR } = await import(
      "../../../runtime/execution-controller/ExecutionControllerTypes.js"
    );
    const { rejectForbiddenControllerPayload } = await import(
      "../../../runtime/execution-controller/ExecutionLifecycleValidator.js"
    );
    const raw = await ctx.readBody(req);
    const body = JSON.parse(raw) as Record<string, unknown>;
    const forbidden = rejectForbiddenControllerPayload(body);
    if (forbidden) {
      json(res, 400, { error: forbidden.message, code: forbidden.code });
      return;
    }
    const mgr = createExecutionController(ctx.repoRoot);
    const result = mgr.recordReview({
      mission_id: String(body.mission_id ?? ""),
      mission_version: Number(body.mission_version),
      controller_id: body.controller_id
        ? String(body.controller_id)
        : undefined,
      decision: body.decision as
        | "APPROVE_CONTROLLER_SCAFFOLD"
        | "BLOCK_CONTROLLER_SCAFFOLD"
        | "REQUEST_CONTROLLER_CHANGES",
      actor: String(body.actor ?? EXECUTION_CONTROLLER_FOUNDER_ACTOR),
      reason: body.reason ? String(body.reason) : undefined,
      notes: body.notes ? String(body.notes) : undefined,
      fixture: false,
    });
    json(res, result.ok ? 200 : 400, {
      ...result,
      ...SAFETY,
      live: false,
    });
  } catch (e) {
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
}

export const executionControllerRoutes: DashboardRouteHandler[] = [
  {
    id: "execution-controller.list",
    method: "GET",
    pathPattern: "/api/runtime/execution-controller",
    match: exactRoute("GET", "/api/runtime/execution-controller"),
    handle: (req, res, ctx) => handleControllerList(req, res, ctx),
  },
  {
    id: "execution-controller.mission",
    method: "GET",
    pathPattern: "/api/runtime/execution-controller/:mission_id",
    match: paramRoute(
      "GET",
      "/api/runtime/execution-controller",
      "mission_id",
      ["review"],
    ),
    handle: (req, res, ctx, match) =>
      handleControllerMission(req, res, ctx, match),
  },
  {
    id: "execution-controller.review",
    method: "POST",
    pathPattern: "/api/runtime/execution-controller/review",
    match: exactRoute("POST", "/api/runtime/execution-controller/review"),
    handle: (req, res, ctx) => handleControllerReview(req, res, ctx),
  },
];

export const executionControllerPlugin: DashboardPlugin = {
  id: "execution-controller",
  snapshot: executionControllerSnapshotSource,
  routes: executionControllerRoutes,
};
