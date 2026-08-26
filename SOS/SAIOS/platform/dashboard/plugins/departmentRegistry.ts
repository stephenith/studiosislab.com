/**
 * Department Registry dashboard plugin — Agent #180.
 * Read-only. No POST. Never executes.
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
  provider_allowed: false,
  publishing_allowed: false,
  live_enabled: false,
} as const;

export const departmentRegistrySnapshotSource: SnapshotSource = {
  id: "department-registry",
  fields: [
    "department_registry_status",
    "department_registry",
    "department_registry_health",
  ],
  empty() {
    return {
      department_registry_status: null,
      department_registry: null,
      department_registry_health: null,
    };
  },
  load(ctx) {
    const snap = ctx.readJson(
      "SOS/07_LOGS/saios/platform/department-sdk/latest-department-registry-snapshot.json",
    ) as {
      department_count?: number;
      ready_count?: number;
      placeholder_count?: number;
      reference_department_id?: string | null;
      department_ids?: string[];
      next_safe_action?: string | null;
    } | null;
    const health = ctx.readJson(
      "SOS/07_LOGS/saios/platform/department-sdk/department-registry-health.json",
    ) as {
      registered_count?: number;
      validated_count?: number;
      ready_count?: number;
      status?: string;
      mode?: string;
    } | null;

    return {
      department_registry_status: snap
        ? `departments=${snap.department_count ?? 0}`
        : null,
      department_registry: snap
        ? {
            department_count: snap.department_count ?? 0,
            ready_count: snap.ready_count ?? 0,
            placeholder_count: snap.placeholder_count ?? 0,
            reference_department_id: snap.reference_department_id ?? null,
            department_ids: snap.department_ids ?? [],
            next_safe_action: snap.next_safe_action ?? null,
          }
        : null,
      department_registry_health: health
        ? {
            registered_count: health.registered_count ?? 0,
            validated_count: health.validated_count ?? 0,
            ready_count: health.ready_count ?? 0,
            status: health.status ?? "idle",
            mode: health.mode ?? "department_sdk_contracts_only",
            safety_flags: { ...SAFETY },
          }
        : {
            registered_count: 0,
            validated_count: 0,
            ready_count: 0,
            status: "idle",
            mode: "department_sdk_contracts_only",
            safety_flags: { ...SAFETY },
          },
    };
  },
};

async function getSdk(repoRoot: string) {
  const { createDepartmentSDK } = await import(
    "../../department-sdk/DepartmentSDK.js"
  );
  const sdk = createDepartmentSDK(repoRoot);
  sdk.ensureBootstrapped();
  // Also persist to non-fixture path for dashboard reads
  sdk.registry.persist();
  sdk.reporter.writeMarkdown(sdk.registry);
  return sdk;
}

async function handleList(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: DashboardRouteContext,
): Promise<void> {
  try {
    const sdk = await getSdk(ctx.repoRoot);
    json(res, 200, {
      departments: sdk.listDepartments(),
      ...SAFETY,
      live: false,
    });
  } catch (e) {
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
}

async function handleRegistry(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: DashboardRouteContext,
): Promise<void> {
  try {
    const sdk = await getSdk(ctx.repoRoot);
    json(res, 200, {
      snapshot: sdk.registry.buildSnapshot(),
      health: sdk.registry.buildHealth(),
      departments: sdk.listDepartments(),
      ...SAFETY,
      live: false,
    });
  } catch (e) {
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
}

async function handleOne(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: DashboardRouteContext,
  match: RouteMatch,
): Promise<void> {
  try {
    const { rejectForbiddenDepartmentPayload } = await import(
      "../../department-sdk/DepartmentValidator.js"
    );
    const url = new URL(_req.url ?? "/", "http://127.0.0.1");
    const probe: Record<string, unknown> = {};
    for (const key of [
      "execute",
      "dispatch",
      "scheduler",
      "provider",
      "publish",
      "enable_live",
    ]) {
      if (url.searchParams.has(key)) probe[key] = url.searchParams.get(key);
    }
    const forbidden = rejectForbiddenDepartmentPayload(probe);
    if (forbidden) {
      json(res, 400, { error: forbidden.message, code: forbidden.code });
      return;
    }

    const sdk = await getSdk(ctx.repoRoot);
    const id = match.params.department!;
    const dept = sdk.registry.find(id);
    if (!dept) {
      json(res, 404, { error: "department not found" });
      return;
    }
    const validation = sdk.validateDepartmentContract(dept);
    json(res, 200, {
      department: dept,
      validation,
      director: dept.director,
      managers: dept.managers,
      workers: dept.workers,
      capabilities: dept.capabilities,
      ...SAFETY,
      live: false,
    });
  } catch (e) {
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
}

export const departmentRegistryRoutes: DashboardRouteHandler[] = [
  {
    id: "department-registry.list",
    method: "GET",
    pathPattern: "/api/platform/departments",
    match: exactRoute("GET", "/api/platform/departments"),
    handle: (req, res, ctx) => handleList(req, res, ctx),
  },
  {
    id: "department-registry.registry",
    method: "GET",
    pathPattern: "/api/platform/departments/registry",
    match: exactRoute("GET", "/api/platform/departments/registry"),
    handle: (req, res, ctx) => handleRegistry(req, res, ctx),
  },
  {
    id: "department-registry.one",
    method: "GET",
    pathPattern: "/api/platform/departments/:department",
    match: paramRoute("GET", "/api/platform/departments", "department", [
      "registry",
    ]),
    handle: (req, res, ctx, match) => handleOne(req, res, ctx, match),
  },
];

export const departmentRegistryPlugin: DashboardPlugin = {
  id: "department-registry",
  snapshot: departmentRegistrySnapshotSource,
  routes: departmentRegistryRoutes,
};
