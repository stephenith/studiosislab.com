/**
 * Worker Runtime dashboard plugin — Agent #182.
 * Read-only. No POST. Never spawns. Never executes.
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
  worker_spawn_allowed: false,
  child_process_allowed: false,
  provider_allowed: false,
  publishing_allowed: false,
  live_enabled: false,
} as const;

export const workerRuntimeSnapshotSource: SnapshotSource = {
  id: "worker-runtime",
  fields: [
    "worker_runtime_status",
    "worker_runtime",
    "worker_runtime_health",
  ],
  empty() {
    return {
      worker_runtime_status: null,
      worker_runtime: null,
      worker_runtime_health: null,
    };
  },
  load(ctx) {
    const snap = ctx.readJson(
      "SOS/07_LOGS/saios/runtime/worker-runtime/latest-worker-runtime-snapshot.json",
    ) as {
      runtime_count?: number;
      assignment_count?: number;
      session_count?: number;
      authorized_count?: number;
      latest_runtime_id?: string | null;
      next_safe_action?: string | null;
    } | null;
    const health = ctx.readJson(
      "SOS/07_LOGS/saios/runtime/worker-runtime/worker-runtime-health.json",
    ) as {
      runtime_count?: number;
      assignment_count?: number;
      session_count?: number;
      status?: string;
      mode?: string;
      worker_spawn?: boolean;
    } | null;

    return {
      worker_runtime_status: snap
        ? `runtimes=${snap.runtime_count ?? 0}`
        : null,
      worker_runtime: snap
        ? {
            runtime_count: snap.runtime_count ?? 0,
            assignment_count: snap.assignment_count ?? 0,
            session_count: snap.session_count ?? 0,
            authorized_count: snap.authorized_count ?? 0,
            latest_runtime_id: snap.latest_runtime_id ?? null,
            next_safe_action: snap.next_safe_action ?? null,
          }
        : null,
      worker_runtime_health: health
        ? {
            runtime_count: health.runtime_count ?? 0,
            assignment_count: health.assignment_count ?? 0,
            session_count: health.session_count ?? 0,
            status: health.status ?? "idle",
            mode: health.mode ?? "worker_runtime_contracts_only",
            worker_spawn: false,
            safety_flags: { ...SAFETY },
          }
        : {
            runtime_count: 0,
            assignment_count: 0,
            session_count: 0,
            status: "idle",
            mode: "worker_runtime_contracts_only",
            worker_spawn: false,
            safety_flags: { ...SAFETY },
          },
    };
  },
};

async function getSystem(repoRoot: string) {
  const { createWorkerRuntimeSystem } = await import(
    "../../../runtime/worker-runtime/WorkerRuntime.js"
  );
  const sys = createWorkerRuntimeSystem(repoRoot);
  sys.ensureBootstrapped();
  sys.repository.persist();
  sys.reporter.writeMarkdown(sys.repository);
  return sys;
}

async function handleList(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: DashboardRouteContext,
): Promise<void> {
  try {
    const sys = await getSystem(ctx.repoRoot);
    json(res, 200, {
      snapshot: sys.repository.buildSnapshot(),
      health: sys.repository.buildHealth(),
      runtimes: sys.repository.discover(),
      sessions: sys.repository.listSessions(),
      capabilities: sys.capabilities.list(),
      ...SAFETY,
      live: false,
    });
  } catch (e) {
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
}

async function handleAssignments(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: DashboardRouteContext,
): Promise<void> {
  try {
    const sys = await getSystem(ctx.repoRoot);
    json(res, 200, {
      assignments: sys.repository.listAssignments(),
      ...SAFETY,
      live: false,
    });
  } catch (e) {
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
}

async function handleOne(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: DashboardRouteContext,
  match: RouteMatch,
): Promise<void> {
  try {
    const { rejectForbiddenWorkerRuntimePayload } = await import(
      "../../../runtime/worker-runtime/WorkerRuntimeValidator.js"
    );
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const probe: Record<string, unknown> = {};
    for (const key of [
      "execute",
      "spawn",
      "dispatch",
      "provider",
      "publish",
      "enable_live",
    ]) {
      if (url.searchParams.has(key)) probe[key] = url.searchParams.get(key);
    }
    const forbidden = rejectForbiddenWorkerRuntimePayload(probe);
    if (forbidden) {
      json(res, 400, { error: forbidden.message, code: forbidden.code });
      return;
    }

    const sys = await getSystem(ctx.repoRoot);
    const id = match.params.worker!;
    const runtime = sys.repository.findRuntime(id);
    if (!runtime) {
      json(res, 404, { error: "worker runtime not found" });
      return;
    }
    const deps = sys.dependencies.resolve(runtime.dependencies);
    json(res, 200, {
      runtime,
      dependencies: deps,
      capabilities: sys.capabilities.resolve(runtime.capabilities),
      ...SAFETY,
      live: false,
    });
  } catch (e) {
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
}

export const workerRuntimeRoutes: DashboardRouteHandler[] = [
  {
    id: "worker-runtime.list",
    method: "GET",
    pathPattern: "/api/runtime/worker-runtime",
    match: exactRoute("GET", "/api/runtime/worker-runtime"),
    handle: (req, res, ctx) => handleList(req, res, ctx),
  },
  {
    id: "worker-runtime.assignments",
    method: "GET",
    pathPattern: "/api/runtime/worker-runtime/assignments",
    match: exactRoute("GET", "/api/runtime/worker-runtime/assignments"),
    handle: (req, res, ctx) => handleAssignments(req, res, ctx),
  },
  {
    id: "worker-runtime.one",
    method: "GET",
    pathPattern: "/api/runtime/worker-runtime/:worker",
    match: paramRoute("GET", "/api/runtime/worker-runtime", "worker", [
      "assignments",
    ]),
    handle: (req, res, ctx, match) => handleOne(req, res, ctx, match),
  },
];

export const workerRuntimePlugin: DashboardPlugin = {
  id: "worker-runtime",
  snapshot: workerRuntimeSnapshotSource,
  routes: workerRuntimeRoutes,
};
