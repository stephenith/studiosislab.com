/**
 * Runtime Release dashboard plugin — Agent #174.
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

export const runtimeReleaseSnapshotSource: SnapshotSource = {
  id: "runtime-release",
  fields: [
    "runtime_release_status",
    "pending_runtime_release",
    "latest_runtime_release",
    "runtime_release_health",
  ],
  empty() {
    return {
      runtime_release_status: null,
      pending_runtime_release: false,
      latest_runtime_release: null,
      runtime_release_health: null,
    };
  },
  load(ctx) {
    const runtimeReleaseSnap = ctx.readJson(
      "SOS/07_LOGS/saios/runtime/runtime-release/latest-runtime-release.json",
    ) as {
      release_status?: string | null;
      pending?: boolean;
      latest_release_id?: string | null;
      latest_decision?: string | null;
      runtime_plan_id?: string | null;
      plan_checksum?: string | null;
      next_safe_action?: string | null;
    } | null;
    const runtimeReleaseHealth = ctx.readJson(
      "SOS/07_LOGS/saios/runtime/runtime-release/runtime-release-health.json",
    ) as {
      pending_count?: number;
      approved_count?: number;
      rejected_count?: number;
      status?: string;
      mode?: string;
    } | null;

    return {
      runtime_release_status: runtimeReleaseSnap?.release_status ?? null,
      pending_runtime_release: Boolean(runtimeReleaseSnap?.pending),
      latest_runtime_release: runtimeReleaseSnap
        ? {
            release_id: runtimeReleaseSnap.latest_release_id ?? null,
            decision: runtimeReleaseSnap.latest_decision ?? null,
            runtime_plan_id: runtimeReleaseSnap.runtime_plan_id ?? null,
            plan_checksum: runtimeReleaseSnap.plan_checksum ?? null,
            next_safe_action: runtimeReleaseSnap.next_safe_action ?? null,
          }
        : null,
      runtime_release_health: runtimeReleaseHealth
        ? {
            pending_count: runtimeReleaseHealth.pending_count ?? 0,
            approved_count: runtimeReleaseHealth.approved_count ?? 0,
            rejected_count: runtimeReleaseHealth.rejected_count ?? 0,
            status: runtimeReleaseHealth.status ?? "idle",
            mode: runtimeReleaseHealth.mode ?? "release_gate_only",
            execution_allowed: false,
            dispatch_allowed: false,
            publishing_allowed: false,
          }
        : {
            pending_count: 0,
            approved_count: 0,
            rejected_count: 0,
            status: "idle",
            mode: "release_gate_only",
            execution_allowed: false,
            dispatch_allowed: false,
            publishing_allowed: false,
          },
    };
  },
};

async function handleReleaseList(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: DashboardRouteContext,
): Promise<void> {
  try {
    const { RuntimeReleaseRepository } = await import(
      "../../../runtime/runtime-release/RuntimeReleaseRepository.js"
    );
    const store = new RuntimeReleaseRepository(ctx.repoRoot);
    json(res, 200, {
      latest: store.loadLatest(),
      pending: store.loadPending(),
      health: store.loadHealth(),
      execution_allowed: false,
      dispatch_allowed: false,
      scheduler_allowed: false,
      queue_insert_allowed: false,
      publishing_allowed: false,
      live: false,
    });
  } catch (e) {
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
}

async function handleReleaseMission(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: DashboardRouteContext,
  match: RouteMatch,
): Promise<void> {
  try {
    const { createRuntimeReleaseManager } = await import(
      "../../../runtime/runtime-release/RuntimeReleaseManager.js"
    );
    const { RuntimeReleaseRepository } = await import(
      "../../../runtime/runtime-release/RuntimeReleaseRepository.js"
    );
    const { RuntimePlanRepository } = await import(
      "../../../runtime/planner/RuntimePlanRepository.js"
    );
    const { rejectForbiddenReleasePayload } = await import(
      "../../../runtime/runtime-release/RuntimeReleaseValidator.js"
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
    ]) {
      if (url.searchParams.has(key)) probe[key] = url.searchParams.get(key);
    }
    const forbidden = rejectForbiddenReleasePayload(probe);
    if (forbidden) {
      json(res, 400, { error: forbidden.message, code: forbidden.code });
      return;
    }

    const mgr = createRuntimeReleaseManager(ctx.repoRoot);
    const mission = mgr.registry.get(missionId);
    if (!mission || mission.fixture) {
      json(res, 404, { error: "mission not found" });
      return;
    }

    if (
      mission.status === "RUNTIME_PLAN_READY" ||
      mission.status === "WAITING_RUNTIME_RELEASE"
    ) {
      mgr.openForRelease(missionId, { fixture: false });
    }

    const refreshed = mgr.registry.get(missionId);
    const plan = new RuntimePlanRepository(ctx.repoRoot).getForMission(
      missionId,
    );
    const store = new RuntimeReleaseRepository(ctx.repoRoot);
    const decisions = store
      .listDecisions()
      .filter((d) => d.mission_id === missionId && d.status === "CONSUMED");
    const latest = decisions.length ? decisions[decisions.length - 1]! : null;
    const history = store
      .listHistory()
      .filter((h) => h.mission_id === missionId)
      .slice(-20);

    json(res, 200, {
      plan,
      release_status: refreshed?.status ?? mission.status,
      mission_status: refreshed?.status ?? mission.status,
      latest_release: latest
        ? {
            release_id: latest.release_id,
            decision: latest.decision,
            reason: latest.reason,
            created_at: latest.created_at,
          }
        : null,
      history,
      execution_allowed: false,
      dispatch_allowed: false,
      scheduler_allowed: false,
      queue_insert_allowed: false,
      publishing_allowed: false,
      live: false,
      error: !plan
        ? `Mission must have a runtime plan (got ${refreshed?.status})`
        : undefined,
    });
  } catch (e) {
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
}

async function handleReleaseReview(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: DashboardRouteContext,
): Promise<void> {
  if (process.env.SOS_AIOS_LIVE === "1") {
    json(res, 403, { error: "LIVE must be OFF" });
    return;
  }
  try {
    const { createRuntimeReleaseManager } = await import(
      "../../../runtime/runtime-release/RuntimeReleaseManager.js"
    );
    const { RUNTIME_RELEASE_FOUNDER_ACTOR } = await import(
      "../../../runtime/runtime-release/runtime-release-types.js"
    );
    const { rejectForbiddenReleasePayload } = await import(
      "../../../runtime/runtime-release/RuntimeReleaseValidator.js"
    );
    const raw = await ctx.readBody(req);
    const body = JSON.parse(raw) as Record<string, unknown>;
    const forbidden = rejectForbiddenReleasePayload(body);
    if (forbidden) {
      json(res, 400, { error: forbidden.message, code: forbidden.code });
      return;
    }
    const mgr = createRuntimeReleaseManager(ctx.repoRoot);
    const result = mgr.recordDecision({
      mission_id: String(body.mission_id ?? ""),
      mission_version: Number(body.mission_version),
      runtime_plan_id: String(body.runtime_plan_id ?? ""),
      plan_checksum: String(body.plan_checksum ?? ""),
      decision: body.decision as
        | "APPROVED"
        | "REJECTED"
        | "CHANGES_REQUESTED",
      actor: String(body.actor ?? RUNTIME_RELEASE_FOUNDER_ACTOR),
      reason: body.reason != null ? String(body.reason) : undefined,
      notes: body.notes != null ? String(body.notes) : undefined,
      fixture: false,
    });
    json(res, result.ok ? 200 : 400, {
      ok: result.ok,
      release: result.release,
      mission_status: result.mission_status,
      next_safe_action: result.next_safe_action,
      error: result.error ?? null,
      error_code: result.error_code ?? null,
      duplicate: result.duplicate === true,
      execution_allowed: false,
      dispatch_allowed: false,
      scheduler_allowed: false,
      queue_insert_allowed: false,
      publishing_allowed: false,
      live: false,
      message: result.ok
        ? "Runtime release decision recorded · not execution authorization"
        : result.error,
    });
  } catch (e) {
    json(res, 400, { error: e instanceof Error ? e.message : String(e) });
  }
}

export const runtimeReleaseRoutes: DashboardRouteHandler[] = [
  {
    id: "runtime-release.list",
    method: "GET",
    pathPattern: "/api/runtime/runtime-release",
    match: exactRoute("GET", "/api/runtime/runtime-release"),
    handle: (req, res, ctx) => handleReleaseList(req, res, ctx),
  },
  {
    id: "runtime-release.mission",
    method: "GET",
    pathPattern: "/api/runtime/runtime-release/:mission_id",
    match: paramRoute(
      "GET",
      "/api/runtime/runtime-release",
      "mission_id",
      ["review"],
    ),
    handle: (req, res, ctx, match) =>
      handleReleaseMission(req, res, ctx, match),
  },
  {
    id: "runtime-release.review",
    method: "POST",
    pathPattern: "/api/runtime/runtime-release/review",
    match: exactRoute("POST", "/api/runtime/runtime-release/review"),
    handle: (req, res, ctx) => handleReleaseReview(req, res, ctx),
  },
];

export const runtimeReleasePlugin: DashboardPlugin = {
  id: "runtime-release",
  snapshot: runtimeReleaseSnapshotSource,
  routes: runtimeReleaseRoutes,
};
