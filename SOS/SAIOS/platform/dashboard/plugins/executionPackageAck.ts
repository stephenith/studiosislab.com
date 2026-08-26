/**
 * Execution Package Acknowledgement dashboard plugin — Agent #175.
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

export const executionPackageAckSnapshotSource: SnapshotSource = {
  id: "execution-package-ack",
  fields: [
    "execution_package_ack_status",
    "pending_execution_package_ack",
    "latest_execution_package_ack",
    "execution_package_ack_health",
  ],
  empty() {
    return {
      execution_package_ack_status: null,
      pending_execution_package_ack: false,
      latest_execution_package_ack: null,
      execution_package_ack_health: null,
    };
  },
  load(ctx) {
    const pkgAck = ctx.readJson(
      "SOS/07_LOGS/saios/company-brain/execution-package-ack/latest-execution-package-ack.json",
    ) as {
      ack_status?: string | null;
      pending?: boolean;
      latest_acknowledgement_id?: string | null;
      latest_decision?: string | null;
      package_id?: string | null;
      checksum?: string | null;
      next_safe_action?: string | null;
    } | null;
    const pkgAckHealth = ctx.readJson(
      "SOS/07_LOGS/saios/company-brain/execution-package-ack/execution-package-ack-health.json",
    ) as {
      pending_count?: number;
      acknowledged_count?: number;
      status?: string;
      mode?: string;
    } | null;

    return {
      execution_package_ack_status: pkgAck?.ack_status ?? null,
      pending_execution_package_ack: Boolean(pkgAck?.pending),
      latest_execution_package_ack: pkgAck
        ? {
            acknowledgement_id: pkgAck.latest_acknowledgement_id ?? null,
            decision: pkgAck.latest_decision ?? null,
            package_id: pkgAck.package_id ?? null,
            checksum: pkgAck.checksum ?? null,
            next_safe_action: pkgAck.next_safe_action ?? null,
          }
        : null,
      execution_package_ack_health: pkgAckHealth
        ? {
            pending_count: pkgAckHealth.pending_count ?? 0,
            acknowledged_count: pkgAckHealth.acknowledged_count ?? 0,
            status: pkgAckHealth.status ?? "idle",
            mode: pkgAckHealth.mode ?? "acknowledgement_only",
            execution_allowed: false,
            queue_enqueue_allowed: false,
            publishing_allowed: false,
          }
        : {
            pending_count: 0,
            acknowledged_count: 0,
            status: "idle",
            mode: "acknowledgement_only",
            execution_allowed: false,
            queue_enqueue_allowed: false,
            publishing_allowed: false,
          },
    };
  },
};

async function handleAckList(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: DashboardRouteContext,
): Promise<void> {
  try {
    const { ExecutionPackageAckRepository } = await import(
      "../../../core/company-brain/ExecutionPackageAckRepository.js"
    );
    const store = new ExecutionPackageAckRepository(ctx.repoRoot);
    json(res, 200, {
      latest: store.loadLatest(),
      pending: store.loadPending(),
      health: store.loadHealth(),
      execution_allowed: false,
      queue_enqueue_allowed: false,
      publishing_allowed: false,
      live: false,
    });
  } catch (e) {
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
}

async function handleAckMission(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: DashboardRouteContext,
  match: RouteMatch,
): Promise<void> {
  try {
    const { createExecutionPackageAckManager } = await import(
      "../../../core/company-brain/ExecutionPackageAckManager.js"
    );
    const { createExecutionPackageBuilder } = await import(
      "../../../core/company-brain/ExecutionPackageBuilder.js"
    );
    const { ExecutionPackageAckRepository } = await import(
      "../../../core/company-brain/ExecutionPackageAckRepository.js"
    );
    const missionId = match.params.mission_id!;
    const ackMgr = createExecutionPackageAckManager(ctx.repoRoot);
    const builder = createExecutionPackageBuilder(ctx.repoRoot);
    const mission = ackMgr.registry.get(missionId);
    if (!mission || mission.fixture) {
      json(res, 404, { error: "mission not found" });
      return;
    }

    if (
      mission.status === "READY_FOR_QUEUE" ||
      mission.status === "WAITING_PACKAGE_ACKNOWLEDGEMENT"
    ) {
      ackMgr.openForAcknowledgement(missionId, { fixture: false });
    }

    const pkg = builder.getForMission(missionId);
    const refreshed = ackMgr.registry.get(missionId);
    const store = new ExecutionPackageAckRepository(ctx.repoRoot);
    const latest = store.loadLatest();

    json(res, 200, {
      package: pkg,
      mission_status: refreshed?.status ?? mission.status,
      ack_status:
        refreshed?.status === "WAITING_PACKAGE_ACKNOWLEDGEMENT" ||
        refreshed?.status === "PACKAGE_ACKNOWLEDGED" ||
        refreshed?.status === "PACKAGE_CHANGES_REQUESTED" ||
        refreshed?.status === "PACKAGE_REJECTED"
          ? refreshed.status
          : (latest?.ack_status ?? null),
      latest_ack: latest,
      execution_allowed: false,
      queue_enqueue_allowed: false,
      publishing_allowed: false,
      live: false,
      error: !pkg
        ? `No execution package for mission (status ${refreshed?.status ?? mission.status})`
        : undefined,
    });
  } catch (e) {
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
}

async function handleAckDecision(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: DashboardRouteContext,
): Promise<void> {
  if (process.env.SOS_AIOS_LIVE === "1") {
    json(res, 403, { error: "LIVE must be OFF" });
    return;
  }
  try {
    const { createExecutionPackageAckManager } = await import(
      "../../../core/company-brain/ExecutionPackageAckManager.js"
    );
    const { PACKAGE_ACK_FOUNDER_ACTOR } = await import(
      "../../../core/company-brain/execution-package-ack-types.js"
    );
    const raw = await ctx.readBody(req);
    const body = JSON.parse(raw) as Record<string, unknown>;
    for (const key of [
      "execute",
      "run",
      "dispatch",
      "enqueue",
      "queue",
      "publish",
      "enable_live",
      "provider_call",
    ]) {
      if (key in body) {
        json(res, 400, {
          error: `Field '${key}' is forbidden`,
          code: "FORBIDDEN_SIDE_EFFECT",
        });
        return;
      }
    }
    const ackMgr = createExecutionPackageAckManager(ctx.repoRoot);
    const result = ackMgr.recordDecision({
      mission_id: String(body.mission_id ?? ""),
      mission_version: Number(body.mission_version),
      package_id: String(body.package_id ?? ""),
      execution_package_version: Number(body.execution_package_version),
      execution_package_checksum: String(
        body.execution_package_checksum ?? "",
      ),
      decision: body.decision as
        | "ACKNOWLEDGED"
        | "CHANGES_REQUESTED"
        | "REJECTED",
      actor: String(body.actor ?? PACKAGE_ACK_FOUNDER_ACTOR),
      reason: body.reason != null ? String(body.reason) : undefined,
      notes: body.notes != null ? String(body.notes) : undefined,
      fixture: false,
    });
    json(res, result.ok ? 200 : 400, {
      ok: result.ok,
      acknowledgement: result.acknowledgement,
      mission_status: result.mission_status,
      next_safe_action: result.next_safe_action,
      error: result.error ?? null,
      error_code: result.error_code ?? null,
      duplicate: result.duplicate === true,
      execution_allowed: false,
      queue_enqueue_allowed: false,
      publishing_allowed: false,
      live: false,
      message: result.ok
        ? "Package acknowledgement recorded · not execution approval · no enqueue"
        : result.error,
    });
  } catch (e) {
    json(res, 400, { error: e instanceof Error ? e.message : String(e) });
  }
}

export const executionPackageAckRoutes: DashboardRouteHandler[] = [
  {
    id: "execution-package-ack.list",
    method: "GET",
    pathPattern: "/api/company-brain/execution-package-ack",
    match: exactRoute("GET", "/api/company-brain/execution-package-ack"),
    handle: (req, res, ctx) => handleAckList(req, res, ctx),
  },
  {
    id: "execution-package-ack.mission",
    method: "GET",
    pathPattern: "/api/company-brain/execution-package-ack/:mission_id",
    match: paramRoute(
      "GET",
      "/api/company-brain/execution-package-ack",
      "mission_id",
    ),
    handle: (req, res, ctx, match) => handleAckMission(req, res, ctx, match),
  },
  {
    id: "execution-package-ack.decision",
    method: "POST",
    pathPattern: "/api/company-brain/execution-package-ack-decision",
    match: exactRoute(
      "POST",
      "/api/company-brain/execution-package-ack-decision",
    ),
    handle: (req, res, ctx) => handleAckDecision(req, res, ctx),
  },
];

export const executionPackageAckPlugin: DashboardPlugin = {
  id: "execution-package-ack",
  snapshot: executionPackageAckSnapshotSource,
  routes: executionPackageAckRoutes,
};
