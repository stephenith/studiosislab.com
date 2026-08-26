/**
 * System Readiness dashboard plugin — Agent #174.
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

export const systemReadinessSnapshotSource: SnapshotSource = {
  id: "system-readiness",
  fields: [
    "system_readiness_status",
    "latest_system_readiness",
    "system_readiness_health",
  ],
  empty() {
    return {
      system_readiness_status: null,
      latest_system_readiness: null,
      system_readiness_health: null,
    };
  },
  load(ctx) {
    const systemReadinessSnap = ctx.readJson(
      "SOS/07_LOGS/saios/runtime/system-readiness/latest-system-readiness-snapshot.json",
    ) as {
      certificate_status?: string | null;
      certificate_id?: string | null;
      readiness_score?: number | null;
      architecture_version?: string | null;
      governance_version?: string | null;
      next_safe_action?: string | null;
    } | null;
    const systemReadinessHealth = ctx.readJson(
      "SOS/07_LOGS/saios/runtime/system-readiness/system-readiness-health.json",
    ) as {
      certificate_count?: number;
      ready_count?: number;
      blocked_count?: number;
      status?: string;
      mode?: string;
    } | null;

    return {
      system_readiness_status:
        systemReadinessSnap?.certificate_status ?? null,
      latest_system_readiness: systemReadinessSnap
        ? {
            certificate_id: systemReadinessSnap.certificate_id ?? null,
            certificate_status:
              systemReadinessSnap.certificate_status ?? null,
            readiness_score: systemReadinessSnap.readiness_score ?? null,
            architecture_version:
              systemReadinessSnap.architecture_version ?? null,
            governance_version:
              systemReadinessSnap.governance_version ?? null,
            next_safe_action: systemReadinessSnap.next_safe_action ?? null,
          }
        : null,
      system_readiness_health: systemReadinessHealth
        ? {
            certificate_count: systemReadinessHealth.certificate_count ?? 0,
            ready_count: systemReadinessHealth.ready_count ?? 0,
            blocked_count: systemReadinessHealth.blocked_count ?? 0,
            status: systemReadinessHealth.status ?? "idle",
            mode: systemReadinessHealth.mode ?? "readiness_freeze_only",
            safety_flags: {
              execution_allowed: false,
              dispatch_allowed: false,
              scheduler_allowed: false,
              worker_execution_allowed: false,
              queue_insert_allowed: false,
              provider_allowed: false,
              publishing_allowed: false,
              live_enabled: false,
            },
          }
        : {
            certificate_count: 0,
            ready_count: 0,
            blocked_count: 0,
            status: "idle",
            mode: "readiness_freeze_only",
            safety_flags: {
              execution_allowed: false,
              dispatch_allowed: false,
              scheduler_allowed: false,
              worker_execution_allowed: false,
              queue_insert_allowed: false,
              provider_allowed: false,
              publishing_allowed: false,
              live_enabled: false,
            },
          },
    };
  },
};

async function handleReadinessList(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: DashboardRouteContext,
): Promise<void> {
  try {
    const { SystemReadinessRepository } = await import(
      "../../../runtime/system-readiness/SystemReadinessRepository.js"
    );
    const store = new SystemReadinessRepository(ctx.repoRoot);
    json(res, 200, {
      latest: store.loadLatest(),
      certificate: store.loadLatestCertificate(),
      health: store.loadHealth(),
      execution_allowed: false,
      dispatch_allowed: false,
      scheduler_allowed: false,
      worker_execution_allowed: false,
      queue_insert_allowed: false,
      provider_allowed: false,
      publishing_allowed: false,
      live: false,
    });
  } catch (e) {
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
}

async function handleReadinessMission(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: DashboardRouteContext,
  match: RouteMatch,
): Promise<void> {
  try {
    const { createSystemReadinessManager } = await import(
      "../../../runtime/system-readiness/SystemReadinessManager.js"
    );
    const { SystemReadinessRepository } = await import(
      "../../../runtime/system-readiness/SystemReadinessRepository.js"
    );
    const missionId = match.params.mission_id!;
    const mgr = createSystemReadinessManager(ctx.repoRoot);
    const mission = mgr.registry.get(missionId);
    if (!mission || mission.fixture) {
      json(res, 404, { error: "mission not found" });
      return;
    }

    if (mission.status === "RUNTIME_RELEASE_APPROVED") {
      mgr.certify(missionId, { fixture: false });
    }

    const refreshed = mgr.registry.get(missionId);
    const certificate = mgr.getForMission(missionId);
    const store = new SystemReadinessRepository(ctx.repoRoot);

    json(res, 200, {
      certificate,
      mission_status: refreshed?.status ?? mission.status,
      latest: store.loadLatest(),
      health: store.loadHealth(),
      execution_allowed: false,
      dispatch_allowed: false,
      scheduler_allowed: false,
      worker_execution_allowed: false,
      queue_insert_allowed: false,
      provider_allowed: false,
      publishing_allowed: false,
      live: false,
      error:
        !certificate && refreshed?.status !== "RUNTIME_RELEASE_APPROVED"
          ? `Mission must be RUNTIME_RELEASE_APPROVED or already certified (got ${refreshed?.status})`
          : undefined,
    });
  } catch (e) {
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
}

export const systemReadinessRoutes: DashboardRouteHandler[] = [
  {
    id: "system-readiness.list",
    method: "GET",
    pathPattern: "/api/runtime/system-readiness",
    match: exactRoute("GET", "/api/runtime/system-readiness"),
    handle: (req, res, ctx) => handleReadinessList(req, res, ctx),
  },
  {
    id: "system-readiness.mission",
    method: "GET",
    pathPattern: "/api/runtime/system-readiness/:mission_id",
    match: paramRoute(
      "GET",
      "/api/runtime/system-readiness",
      "mission_id",
    ),
    handle: (req, res, ctx, match) =>
      handleReadinessMission(req, res, ctx, match),
  },
];

export const systemReadinessPlugin: DashboardPlugin = {
  id: "system-readiness",
  snapshot: systemReadinessSnapshotSource,
  routes: systemReadinessRoutes,
};
