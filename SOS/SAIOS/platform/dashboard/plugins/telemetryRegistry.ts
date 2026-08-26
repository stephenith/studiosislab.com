/**
 * Telemetry Registry dashboard plugin — Agent #183.
 * Read-only. No POST. No collection. No emission.
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
  collection_allowed: false,
  emission_allowed: false,
  provider_allowed: false,
  publishing_allowed: false,
  live_enabled: false,
} as const;

export const telemetryRegistrySnapshotSource: SnapshotSource = {
  id: "telemetry-registry",
  fields: [
    "telemetry_registry_status",
    "telemetry_registry",
    "telemetry_registry_health",
  ],
  empty() {
    return {
      telemetry_registry_status: null,
      telemetry_registry: null,
      telemetry_registry_health: null,
    };
  },
  load(ctx) {
    const snap = ctx.readJson(
      "SOS/07_LOGS/saios/platform/telemetry/latest-telemetry-registry-snapshot.json",
    ) as {
      session_count?: number;
      timeline_count?: number;
      correlation_count?: number;
      snapshot_count?: number;
      event_catalogue_count?: number;
      latest_session_id?: string | null;
      next_safe_action?: string | null;
    } | null;
    const health = ctx.readJson(
      "SOS/07_LOGS/saios/platform/telemetry/telemetry-health.json",
    ) as {
      session_count?: number;
      timeline_count?: number;
      correlation_count?: number;
      status?: string;
      mode?: string;
      collection?: boolean;
      emission?: boolean;
    } | null;

    return {
      telemetry_registry_status: snap
        ? `sessions=${snap.session_count ?? 0}`
        : null,
      telemetry_registry: snap
        ? {
            session_count: snap.session_count ?? 0,
            timeline_count: snap.timeline_count ?? 0,
            correlation_count: snap.correlation_count ?? 0,
            snapshot_count: snap.snapshot_count ?? 0,
            event_catalogue_count: snap.event_catalogue_count ?? 0,
            latest_session_id: snap.latest_session_id ?? null,
            next_safe_action: snap.next_safe_action ?? null,
          }
        : null,
      telemetry_registry_health: health
        ? {
            session_count: health.session_count ?? 0,
            timeline_count: health.timeline_count ?? 0,
            correlation_count: health.correlation_count ?? 0,
            status: health.status ?? "idle",
            mode: health.mode ?? "telemetry_contracts_only",
            collection: false,
            emission: false,
            safety_flags: { ...SAFETY },
          }
        : {
            session_count: 0,
            timeline_count: 0,
            correlation_count: 0,
            status: "idle",
            mode: "telemetry_contracts_only",
            collection: false,
            emission: false,
            safety_flags: { ...SAFETY },
          },
    };
  },
};

async function getRegistry(repoRoot: string) {
  const { createTelemetryRegistry } = await import(
    "../../telemetry/TelemetryRegistry.js"
  );
  const reg = createTelemetryRegistry(repoRoot);
  reg.ensureBootstrapped();
  reg.repository.persist();
  reg.reporter.writeMarkdown(reg.repository);
  return reg;
}

async function handleList(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: DashboardRouteContext,
): Promise<void> {
  try {
    const reg = await getRegistry(ctx.repoRoot);
    json(res, 200, {
      snapshot: reg.repository.buildSnapshot(),
      health: reg.repository.buildHealth(),
      sessions: reg.listSessions(),
      timelines: reg.repository.listTimelines(),
      correlations: reg.repository.listCorrelations(),
      snapshots: reg.repository.listSnapshots(),
      ...SAFETY,
      live: false,
    });
  } catch (e) {
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
}

async function handleEvents(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: DashboardRouteContext,
): Promise<void> {
  try {
    const reg = await getRegistry(ctx.repoRoot);
    json(res, 200, {
      events: reg.listEvents(),
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
    const { rejectForbiddenTelemetryPayload } = await import(
      "../../telemetry/TelemetryValidator.js"
    );
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const probe: Record<string, unknown> = {};
    for (const key of [
      "execute",
      "collect",
      "emit",
      "provider",
      "publish",
      "enable_live",
    ]) {
      if (url.searchParams.has(key)) probe[key] = url.searchParams.get(key);
    }
    const forbidden = rejectForbiddenTelemetryPayload(probe);
    if (forbidden) {
      json(res, 400, { error: forbidden.message, code: forbidden.code });
      return;
    }

    const reg = await getRegistry(ctx.repoRoot);
    const id = match.params.session!;
    const session = reg.loadSession(id);
    if (!session) {
      json(res, 404, { error: "telemetry session not found" });
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

export const telemetryRegistryRoutes: DashboardRouteHandler[] = [
  {
    id: "telemetry-registry.list",
    method: "GET",
    pathPattern: "/api/platform/telemetry",
    match: exactRoute("GET", "/api/platform/telemetry"),
    handle: (req, res, ctx) => handleList(req, res, ctx),
  },
  {
    id: "telemetry-registry.events",
    method: "GET",
    pathPattern: "/api/platform/telemetry/events",
    match: exactRoute("GET", "/api/platform/telemetry/events"),
    handle: (req, res, ctx) => handleEvents(req, res, ctx),
  },
  {
    id: "telemetry-registry.one",
    method: "GET",
    pathPattern: "/api/platform/telemetry/:session",
    match: paramRoute("GET", "/api/platform/telemetry", "session", [
      "events",
    ]),
    handle: (req, res, ctx, match) => handleOne(req, res, ctx, match),
  },
];

export const telemetryRegistryPlugin: DashboardPlugin = {
  id: "telemetry-registry",
  snapshot: telemetryRegistrySnapshotSource,
  routes: telemetryRegistryRoutes,
};
