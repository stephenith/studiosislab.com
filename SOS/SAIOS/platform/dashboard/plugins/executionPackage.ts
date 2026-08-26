/**
 * Execution Package dashboard plugin — Agent #175.
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

export const executionPackageSnapshotSource: SnapshotSource = {
  id: "execution-package",
  fields: ["execution_package"],
  empty() {
    return { execution_package: null };
  },
  load(ctx) {
    const execPkg = ctx.readJson(
      "SOS/07_LOGS/saios/company-brain/execution-packages/latest-execution-package.json",
    ) as {
      package_id?: string;
      execution_id?: string;
      dry_run?: boolean;
      execution_allowed?: boolean;
    } | null;

    return {
      execution_package: {
        package_id: execPkg?.package_id ?? null,
        execution_id: execPkg?.execution_id ?? null,
        dry_run: true,
        execution_allowed: false,
        available: Boolean(execPkg?.package_id),
      },
    };
  },
};

async function handlePackageList(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: DashboardRouteContext,
): Promise<void> {
  try {
    const { ExecutionPackageRepository } = await import(
      "../../../core/company-brain/ExecutionPackageRepository.js"
    );
    const store = new ExecutionPackageRepository(ctx.repoRoot);
    const latest = store.loadLatest();
    const index = store.loadSnapshot();
    json(res, 200, {
      package: latest,
      index,
      dry_run: true,
      execution_allowed: false,
      queue_enqueue_allowed: false,
      publishing_allowed: false,
      live: false,
    });
  } catch (e) {
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
}

async function handlePackageMission(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: DashboardRouteContext,
  match: RouteMatch,
): Promise<void> {
  try {
    const { createExecutionPackageBuilder } = await import(
      "../../../core/company-brain/ExecutionPackageBuilder.js"
    );
    const { rejectForbiddenPayload } = await import(
      "../../../core/company-brain/ExecutionPackageValidator.js"
    );
    const missionId = match.params.mission_id!;
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const probe: Record<string, unknown> = {};
    for (const key of [
      "execute",
      "dispatch",
      "enqueue",
      "publish",
      "enable_live",
    ]) {
      if (url.searchParams.has(key)) probe[key] = url.searchParams.get(key);
    }
    const forbidden = rejectForbiddenPayload(probe);
    if (forbidden) {
      json(res, 400, { error: forbidden.message, code: forbidden.code });
      return;
    }

    const builder = createExecutionPackageBuilder(ctx.repoRoot);
    const mission = builder.registry.get(missionId);
    if (!mission || mission.fixture) {
      json(res, 404, { error: "mission not found" });
      return;
    }

    let pkg = builder.getForMission(missionId);
    if (!pkg && mission.status === "READY_FOR_QUEUE") {
      const built = builder.buildForMission(missionId, { fixture: false });
      if (!built.ok) {
        json(res, 400, {
          error: built.error,
          error_code: built.error_code,
          package: null,
        });
        return;
      }
      pkg = built.package;
    }

    json(res, 200, {
      package: pkg,
      mission_status: mission.status,
      dry_run: true,
      execution_allowed: false,
      queue_enqueue_allowed: false,
      publishing_allowed: false,
      live: false,
      error:
        !pkg && mission.status !== "READY_FOR_QUEUE"
          ? `Mission must be READY_FOR_QUEUE (got ${mission.status})`
          : undefined,
    });
  } catch (e) {
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
}

export const executionPackageRoutes: DashboardRouteHandler[] = [
  {
    id: "execution-package.list",
    method: "GET",
    pathPattern: "/api/company-brain/execution-package",
    match: exactRoute("GET", "/api/company-brain/execution-package"),
    handle: (req, res, ctx) => handlePackageList(req, res, ctx),
  },
  {
    id: "execution-package.mission",
    method: "GET",
    pathPattern: "/api/company-brain/execution-package/:mission_id",
    match: paramRoute(
      "GET",
      "/api/company-brain/execution-package",
      "mission_id",
    ),
    handle: (req, res, ctx, match) =>
      handlePackageMission(req, res, ctx, match),
  },
];

export const executionPackagePlugin: DashboardPlugin = {
  id: "execution-package",
  snapshot: executionPackageSnapshotSource,
  routes: executionPackageRoutes,
};
