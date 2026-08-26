/**
 * Runtime Plan dashboard plugin — Agent #175.
 * Snapshot + routes extracted from loadSnapshot/server without behavior change.
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

function json(
  res: ServerResponse,
  status: number,
  body: unknown,
  cache = false,
): void {
  res.writeHead(status, {
    "Content-Type": "application/json",
    ...(cache ? {} : { "Cache-Control": "no-store" }),
  });
  res.end(JSON.stringify(body));
}

export const runtimePlanSnapshotSource: SnapshotSource = {
  id: "runtime-plan",
  fields: [
    "runtime_plan_status",
    "latest_runtime_plan",
    "runtime_plan_health",
  ],
  empty() {
    return {
      runtime_plan_status: null,
      latest_runtime_plan: null,
      runtime_plan_health: null,
    };
  },
  load(ctx) {
    const runtimePlanSnap = ctx.readJson(
      "SOS/07_LOGS/saios/runtime/runtime-plan/latest-runtime-plan-snapshot.json",
    ) as {
      plan_status?: string | null;
      runtime_plan_id?: string | null;
      shadow_queue_id?: string | null;
      plan_checksum?: string | null;
      next_safe_action?: string | null;
    } | null;
    const runtimePlanHealth = ctx.readJson(
      "SOS/07_LOGS/saios/runtime/runtime-plan/runtime-plan-health.json",
    ) as {
      plan_count?: number;
      ready_count?: number;
      blocked_count?: number;
      status?: string;
      mode?: string;
    } | null;

    return {
      runtime_plan_status: runtimePlanSnap?.plan_status ?? null,
      latest_runtime_plan: runtimePlanSnap
        ? {
            runtime_plan_id: runtimePlanSnap.runtime_plan_id ?? null,
            shadow_queue_id: runtimePlanSnap.shadow_queue_id ?? null,
            plan_checksum: runtimePlanSnap.plan_checksum ?? null,
            plan_status: runtimePlanSnap.plan_status ?? null,
            next_safe_action: runtimePlanSnap.next_safe_action ?? null,
          }
        : null,
      runtime_plan_health: runtimePlanHealth
        ? {
            plan_count: runtimePlanHealth.plan_count ?? 0,
            ready_count: runtimePlanHealth.ready_count ?? 0,
            blocked_count: runtimePlanHealth.blocked_count ?? 0,
            status: runtimePlanHealth.status ?? "idle",
            mode: runtimePlanHealth.mode ?? "planning_only",
            planning_only: true,
            dispatch_allowed: false,
            execution_allowed: false,
            publishing_allowed: false,
          }
        : {
            plan_count: 0,
            ready_count: 0,
            blocked_count: 0,
            status: "idle",
            mode: "planning_only",
            planning_only: true,
            dispatch_allowed: false,
            execution_allowed: false,
            publishing_allowed: false,
          },
    };
  },
};

async function handlePlanList(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: DashboardRouteContext,
): Promise<void> {
  try {
    const { RuntimePlanRepository } = await import(
      "../../../runtime/planner/RuntimePlanRepository.js"
    );
    const store = new RuntimePlanRepository(ctx.repoRoot);
    json(res, 200, {
      latest: store.loadLatest(),
      plan: store.loadLatestPlan(),
      health: store.loadHealth(),
      planning_only: true,
      dispatch_allowed: false,
      execution_allowed: false,
      publishing_allowed: false,
      live: false,
    });
  } catch (e) {
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
}

async function handlePlanMission(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: DashboardRouteContext,
  match: RouteMatch,
): Promise<void> {
  try {
    const { createRuntimePlanner } = await import(
      "../../../runtime/planner/RuntimePlanner.js"
    );
    const { rejectForbiddenRuntimePlanPayload } = await import(
      "../../../runtime/planner/RuntimePlanValidator.js"
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
    ]) {
      if (url.searchParams.has(key)) probe[key] = url.searchParams.get(key);
    }
    const forbidden = rejectForbiddenRuntimePlanPayload(probe);
    if (forbidden) {
      json(res, 400, { error: forbidden.message, code: forbidden.code });
      return;
    }

    const planner = createRuntimePlanner(ctx.repoRoot);
    const mission = planner.registry.get(missionId);
    if (!mission || mission.fixture) {
      json(res, 404, { error: "mission not found" });
      return;
    }

    let plan = planner.getForMission(missionId);
    if (!plan && mission.status === "SHADOW_QUEUE_RECEIVED") {
      const built = planner.buildForMission(missionId, { fixture: false });
      if (!built.ok) {
        json(res, 400, {
          error: built.error,
          error_code: built.error_code,
          plan: null,
          mission_status: mission.status,
        });
        return;
      }
      plan = built.plan;
    }

    const refreshed = planner.registry.get(missionId);
    json(res, 200, {
      plan,
      mission_status: refreshed?.status ?? mission.status,
      planning_only: true,
      dispatch_allowed: false,
      execution_allowed: false,
      publishing_allowed: false,
      live: false,
      error:
        !plan &&
        refreshed?.status !== "SHADOW_QUEUE_RECEIVED" &&
        refreshed?.status !== "RUNTIME_PLAN_READY" &&
        refreshed?.status !== "RUNTIME_PLAN_BLOCKED"
          ? `Mission must be SHADOW_QUEUE_RECEIVED (got ${refreshed?.status})`
          : undefined,
    });
  } catch (e) {
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
}

export const runtimePlanRoutes: DashboardRouteHandler[] = [
  {
    id: "runtime-plan.list",
    method: "GET",
    pathPattern: "/api/runtime/runtime-plan",
    match: exactRoute("GET", "/api/runtime/runtime-plan"),
    handle: (req, res, ctx) => handlePlanList(req, res, ctx),
  },
  {
    id: "runtime-plan.mission",
    method: "GET",
    pathPattern: "/api/runtime/runtime-plan/:mission_id",
    match: paramRoute("GET", "/api/runtime/runtime-plan", "mission_id"),
    handle: (req, res, ctx, match) => handlePlanMission(req, res, ctx, match),
  },
];

export const runtimePlanPlugin: DashboardPlugin = {
  id: "runtime-plan",
  snapshot: runtimePlanSnapshotSource,
  routes: runtimePlanRoutes,
};
