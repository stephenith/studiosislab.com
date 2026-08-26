/**
 * Pre-Dispatch Simulation dashboard plugin — Agent #187.
 * Read-only. No POST. Simulation metadata only.
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
  queue_insert_allowed: false,
  worker_spawn_allowed: false,
  provider_allowed: false,
  publishing_allowed: false,
  billing_allowed: false,
  live_enabled: false,
  simulation_only: true,
} as const;

export const preDispatchSimulationSnapshotSource: SnapshotSource = {
  id: "pre-dispatch-simulation",
  fields: [
    "pre_dispatch_simulation_status",
    "pre_dispatch_simulation",
    "pre_dispatch_simulation_health",
  ],
  empty() {
    return {
      pre_dispatch_simulation_status: null,
      pre_dispatch_simulation: null,
      pre_dispatch_simulation_health: null,
    };
  },
  load(ctx) {
    const snap = ctx.readJson(
      "SOS/07_LOGS/saios/runtime/pre-dispatch-simulation/latest-pre-dispatch-simulation-snapshot.json",
    ) as {
      simulation_count?: number;
      complete_count?: number;
      blocked_count?: number;
      certificate_count?: number;
      latest_simulation_id?: string | null;
      latest_mission_id?: string | null;
      latest_status?: string | null;
      overall_readiness?: number | null;
      next_safe_action?: string | null;
    } | null;
    const health = ctx.readJson(
      "SOS/07_LOGS/saios/runtime/pre-dispatch-simulation/pre-dispatch-simulation-health.json",
    ) as {
      simulation_count?: number;
      complete_count?: number;
      blocked_count?: number;
      certificate_count?: number;
      status?: string;
      mode?: string;
    } | null;

    return {
      pre_dispatch_simulation_status: snap
        ? `sims=${snap.simulation_count ?? 0} · readiness=${snap.overall_readiness ?? "n/a"}`
        : null,
      pre_dispatch_simulation: snap
        ? {
            simulation_count: snap.simulation_count ?? 0,
            complete_count: snap.complete_count ?? 0,
            blocked_count: snap.blocked_count ?? 0,
            certificate_count: snap.certificate_count ?? 0,
            latest_simulation_id: snap.latest_simulation_id ?? null,
            latest_mission_id: snap.latest_mission_id ?? null,
            latest_status: snap.latest_status ?? null,
            overall_readiness: snap.overall_readiness ?? null,
            next_safe_action: snap.next_safe_action ?? null,
          }
        : null,
      pre_dispatch_simulation_health: health
        ? {
            simulation_count: health.simulation_count ?? 0,
            complete_count: health.complete_count ?? 0,
            blocked_count: health.blocked_count ?? 0,
            certificate_count: health.certificate_count ?? 0,
            status: health.status ?? "idle",
            mode: health.mode ?? "pre_dispatch_simulation_only",
            safety_flags: { ...SAFETY },
          }
        : {
            simulation_count: 0,
            complete_count: 0,
            blocked_count: 0,
            certificate_count: 0,
            status: "idle",
            mode: "pre_dispatch_simulation_only",
            safety_flags: { ...SAFETY },
          },
    };
  },
};

async function getEngine(repoRoot: string) {
  const { createPreDispatchSimulation } = await import(
    "../../../runtime/pre-dispatch-simulation/PreDispatchSimulation.js"
  );
  const engine = createPreDispatchSimulation(repoRoot);
  engine.ensureBootstrapped();
  engine.repository.persist();
  engine.reporter.writeMarkdown(engine.repository);
  return engine;
}

async function handleList(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: DashboardRouteContext,
): Promise<void> {
  const engine = await getEngine(ctx.repoRoot);
  json(res, 200, {
    simulations: engine.list(),
    certificates: engine.repository.listCertificates().map((c) => ({
      certificate_id: c.certificate_id,
      simulation_id: c.simulation_id,
      mission_id: c.mission_id,
      scores: c.scores,
      execution_permissions: false,
    })),
    safety_flags: { ...SAFETY },
    mode: "pre_dispatch_simulation_only",
    banners: ["SIMULATION ONLY", "EXECUTION DISABLED", "LIVE OFF"],
  });
}

async function handleMission(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: DashboardRouteContext,
  match: RouteMatch,
): Promise<void> {
  const missionId = match.params.mission_id;
  if (!missionId) {
    json(res, 400, { error: "mission_id required" });
    return;
  }
  const engine = await getEngine(ctx.repoRoot);
  const simulation = engine.loadByMission(missionId);
  if (!simulation) {
    json(res, 404, { error: "simulation not found for mission" });
    return;
  }
  json(res, 200, {
    simulation,
    certificate: engine.repository.findCertificateByMission(missionId),
    safety_flags: { ...SAFETY },
  });
}

export const preDispatchSimulationRoutes: DashboardRouteHandler[] = [
  {
    id: "pre-dispatch-simulation.list",
    method: "GET",
    pathPattern: "/api/runtime/pre-dispatch-simulation",
    match: exactRoute("GET", "/api/runtime/pre-dispatch-simulation"),
    handle: (req, res, ctx) => handleList(req, res, ctx),
  },
  {
    id: "pre-dispatch-simulation.one",
    method: "GET",
    pathPattern: "/api/runtime/pre-dispatch-simulation/:mission_id",
    match: paramRoute(
      "GET",
      "/api/runtime/pre-dispatch-simulation",
      "mission_id",
    ),
    handle: (req, res, ctx, match) => handleMission(req, res, ctx, match),
  },
];

export const preDispatchSimulationPlugin: DashboardPlugin = {
  id: "pre-dispatch-simulation",
  snapshot: preDispatchSimulationSnapshotSource,
  routes: preDispatchSimulationRoutes,
};
