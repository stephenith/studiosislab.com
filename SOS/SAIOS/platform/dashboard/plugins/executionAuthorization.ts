/**
 * Execution Authorization dashboard plugin — Agent #186.
 * Read-only. No POST. Intent display only. Never enables execution.
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
  authorization_enables_execution: false,
  overrides_activation_gate: false,
} as const;

export const executionAuthorizationSnapshotSource: SnapshotSource = {
  id: "execution-authorization",
  fields: [
    "execution_authorization_status",
    "execution_authorization",
    "execution_authorization_health",
  ],
  empty() {
    return {
      execution_authorization_status: null,
      execution_authorization: null,
      execution_authorization_health: null,
    };
  },
  load(ctx) {
    const snap = ctx.readJson(
      "SOS/07_LOGS/saios/runtime/execution-authorization/latest-execution-authorization-snapshot.json",
    ) as {
      authorization_count?: number;
      waiting_count?: number;
      authorized_count?: number;
      rejected_count?: number;
      certificate_count?: number;
      latest_authorization_id?: string | null;
      latest_mission_id?: string | null;
      latest_status?: string | null;
      next_safe_action?: string | null;
    } | null;
    const health = ctx.readJson(
      "SOS/07_LOGS/saios/runtime/execution-authorization/execution-authorization-health.json",
    ) as {
      authorization_count?: number;
      waiting_count?: number;
      authorized_count?: number;
      rejected_count?: number;
      certificate_count?: number;
      status?: string;
      mode?: string;
    } | null;

    return {
      execution_authorization_status: snap
        ? `auth=${snap.authorization_count ?? 0} · authorized=${snap.authorized_count ?? 0}`
        : null,
      execution_authorization: snap
        ? {
            authorization_count: snap.authorization_count ?? 0,
            waiting_count: snap.waiting_count ?? 0,
            authorized_count: snap.authorized_count ?? 0,
            rejected_count: snap.rejected_count ?? 0,
            certificate_count: snap.certificate_count ?? 0,
            latest_authorization_id: snap.latest_authorization_id ?? null,
            latest_mission_id: snap.latest_mission_id ?? null,
            latest_status: snap.latest_status ?? null,
            next_safe_action: snap.next_safe_action ?? null,
          }
        : null,
      execution_authorization_health: health
        ? {
            authorization_count: health.authorization_count ?? 0,
            waiting_count: health.waiting_count ?? 0,
            authorized_count: health.authorized_count ?? 0,
            rejected_count: health.rejected_count ?? 0,
            certificate_count: health.certificate_count ?? 0,
            status: health.status ?? "idle",
            mode: health.mode ?? "founder_intent_only",
            safety_flags: { ...SAFETY },
          }
        : {
            authorization_count: 0,
            waiting_count: 0,
            authorized_count: 0,
            rejected_count: 0,
            certificate_count: 0,
            status: "idle",
            mode: "founder_intent_only",
            safety_flags: { ...SAFETY },
          },
    };
  },
};

async function getAuth(repoRoot: string) {
  const { createExecutionAuthorization } = await import(
    "../../../runtime/execution-authorization/ExecutionAuthorization.js"
  );
  const auth = createExecutionAuthorization(repoRoot);
  auth.ensureBootstrapped();
  auth.repository.persist();
  auth.reporter.writeMarkdown(auth.repository);
  return auth;
}

async function handleList(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: DashboardRouteContext,
): Promise<void> {
  const auth = await getAuth(ctx.repoRoot);
  json(res, 200, {
    authorizations: auth.list(),
    certificates: auth.repository.listCertificates().map((c) => ({
      certificate_id: c.certificate_id,
      authorization_id: c.authorization_id,
      mission_id: c.mission_id,
      status: c.status,
      execution_permissions: false,
      activation_reference: c.activation_reference,
    })),
    safety_flags: { ...SAFETY },
    mode: "founder_intent_only",
    banners: [
      "AUTHORIZATION IS NOT EXECUTION",
      "EXECUTION DISABLED",
      "LIVE OFF",
    ],
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
  const auth = await getAuth(ctx.repoRoot);
  const record = auth.loadByMission(missionId);
  if (!record) {
    json(res, 404, { error: "authorization not found for mission" });
    return;
  }
  json(res, 200, {
    authorization: record,
    request: auth.repository.findRequestByMission(missionId),
    decision: auth.repository.findDecisionByMission(missionId),
    safety_flags: { ...SAFETY },
  });
}

async function handleCertificate(
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
  const auth = await getAuth(ctx.repoRoot);
  const cert = auth.loadCertificateByMission(missionId);
  if (!cert) {
    json(res, 404, { error: "certificate not found for mission" });
    return;
  }
  json(res, 200, {
    certificate: cert,
    safety_flags: { ...SAFETY },
  });
}

export const executionAuthorizationRoutes: DashboardRouteHandler[] = [
  {
    id: "execution-authorization.list",
    method: "GET",
    pathPattern: "/api/runtime/execution-authorization",
    match: exactRoute("GET", "/api/runtime/execution-authorization"),
    handle: (req, res, ctx) => handleList(req, res, ctx),
  },
  {
    id: "execution-authorization.certificate",
    method: "GET",
    pathPattern:
      "/api/runtime/execution-authorization/certificate/:mission_id",
    match: paramRoute(
      "GET",
      "/api/runtime/execution-authorization/certificate",
      "mission_id",
    ),
    handle: (req, res, ctx, match) =>
      handleCertificate(req, res, ctx, match),
  },
  {
    id: "execution-authorization.one",
    method: "GET",
    pathPattern: "/api/runtime/execution-authorization/:mission_id",
    match: paramRoute(
      "GET",
      "/api/runtime/execution-authorization",
      "mission_id",
      ["certificate"],
    ),
    handle: (req, res, ctx, match) => handleMission(req, res, ctx, match),
  },
];

export const executionAuthorizationPlugin: DashboardPlugin = {
  id: "execution-authorization",
  snapshot: executionAuthorizationSnapshotSource,
  routes: executionAuthorizationRoutes,
};
