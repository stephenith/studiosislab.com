/**
 * Activation Gate dashboard plugin — Agent #185.
 * Read-only. No POST. Eligibility display only. Never enables execution.
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
  activation_enables_execution: false,
} as const;

export const activationGateSnapshotSource: SnapshotSource = {
  id: "activation-gate",
  fields: [
    "activation_gate_status",
    "activation_gate",
    "activation_gate_health",
  ],
  empty() {
    return {
      activation_gate_status: null,
      activation_gate: null,
      activation_gate_health: null,
    };
  },
  load(ctx) {
    const snap = ctx.readJson(
      "SOS/07_LOGS/saios/runtime/activation-gate/latest-activation-gate-snapshot.json",
    ) as {
      activation_count?: number;
      eligible_count?: number;
      blocked_count?: number;
      certificate_count?: number;
      latest_activation_id?: string | null;
      latest_mission_id?: string | null;
      latest_status?: string | null;
      overall_score?: number | null;
      next_safe_action?: string | null;
    } | null;
    const health = ctx.readJson(
      "SOS/07_LOGS/saios/runtime/activation-gate/activation-gate-health.json",
    ) as {
      activation_count?: number;
      eligible_count?: number;
      blocked_count?: number;
      certificate_count?: number;
      status?: string;
      mode?: string;
    } | null;

    return {
      activation_gate_status: snap
        ? `activations=${snap.activation_count ?? 0} · blocked=${snap.blocked_count ?? 0}`
        : null,
      activation_gate: snap
        ? {
            activation_count: snap.activation_count ?? 0,
            eligible_count: snap.eligible_count ?? 0,
            blocked_count: snap.blocked_count ?? 0,
            certificate_count: snap.certificate_count ?? 0,
            latest_activation_id: snap.latest_activation_id ?? null,
            latest_mission_id: snap.latest_mission_id ?? null,
            latest_status: snap.latest_status ?? null,
            overall_score: snap.overall_score ?? null,
            next_safe_action: snap.next_safe_action ?? null,
          }
        : null,
      activation_gate_health: health
        ? {
            activation_count: health.activation_count ?? 0,
            eligible_count: health.eligible_count ?? 0,
            blocked_count: health.blocked_count ?? 0,
            certificate_count: health.certificate_count ?? 0,
            status: health.status ?? "idle",
            mode: health.mode ?? "activation_eligibility_only",
            safety_flags: { ...SAFETY },
          }
        : {
            activation_count: 0,
            eligible_count: 0,
            blocked_count: 0,
            certificate_count: 0,
            status: "idle",
            mode: "activation_eligibility_only",
            safety_flags: { ...SAFETY },
          },
    };
  },
};

async function getGate(repoRoot: string) {
  const { createActivationGate } = await import(
    "../../../runtime/activation-gate/ActivationGate.js"
  );
  const gate = createActivationGate(repoRoot);
  gate.ensureBootstrapped();
  gate.repository.persist();
  gate.reporter.writeMarkdown(gate.repository);
  return gate;
}

async function handleList(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: DashboardRouteContext,
): Promise<void> {
  const gate = await getGate(ctx.repoRoot);
  const activations = gate.list();
  const certificates = gate.repository.listCertificates().map((c) => ({
    certificate_id: c.certificate_id,
    activation_id: c.activation_id,
    mission_id: c.mission_id,
    overall_score: c.overall_score,
    status: c.status,
    execution_permissions: false,
  }));
  json(res, 200, {
    activations,
    certificates,
    safety_flags: { ...SAFETY },
    mode: "activation_eligibility_only",
    banners: [
      "EXECUTION DISABLED",
      "ACTIVATION DOES NOT EXECUTE",
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
  const gate = await getGate(ctx.repoRoot);
  const record = gate.loadByMission(missionId);
  if (!record) {
    json(res, 404, { error: "activation not found for mission" });
    return;
  }
  json(res, 200, {
    eligibility: record,
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
  const gate = await getGate(ctx.repoRoot);
  const cert = gate.loadCertificateByMission(missionId);
  if (!cert) {
    json(res, 404, { error: "certificate not found for mission" });
    return;
  }
  json(res, 200, {
    certificate: cert,
    safety_flags: { ...SAFETY },
  });
}

export const activationGateRoutes: DashboardRouteHandler[] = [
  {
    id: "activation-gate.list",
    method: "GET",
    pathPattern: "/api/runtime/activation-gate",
    match: exactRoute("GET", "/api/runtime/activation-gate"),
    handle: (req, res, ctx) => handleList(req, res, ctx),
  },
  {
    id: "activation-gate.certificate",
    method: "GET",
    pathPattern: "/api/runtime/activation-gate/certificate/:mission_id",
    match: paramRoute(
      "GET",
      "/api/runtime/activation-gate/certificate",
      "mission_id",
    ),
    handle: (req, res, ctx, match) =>
      handleCertificate(req, res, ctx, match),
  },
  {
    id: "activation-gate.one",
    method: "GET",
    pathPattern: "/api/runtime/activation-gate/:mission_id",
    match: paramRoute("GET", "/api/runtime/activation-gate", "mission_id", [
      "certificate",
    ]),
    handle: (req, res, ctx, match) => handleMission(req, res, ctx, match),
  },
];

export const activationGatePlugin: DashboardPlugin = {
  id: "activation-gate",
  snapshot: activationGateSnapshotSource,
  routes: activationGateRoutes,
};
