/**
 * Shadow Queue dashboard plugin — Agent #175.
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

export const shadowQueueSnapshotSource: SnapshotSource = {
  id: "shadow-queue",
  fields: [
    "shadow_queue_status",
    "latest_shadow_queue",
    "shadow_queue_health",
  ],
  empty() {
    return {
      shadow_queue_status: null,
      latest_shadow_queue: null,
      shadow_queue_health: null,
    };
  },
  load(ctx) {
    const shadowSnap = ctx.readJson(
      "SOS/07_LOGS/saios/runtime/shadow-queue/latest-shadow-queue-snapshot.json",
    ) as {
      status?: string | null;
      shadow_queue_id?: string | null;
      submission_id?: string | null;
      submission_checksum?: string | null;
      next_safe_action?: string | null;
    } | null;
    const shadowLatest = ctx.readJson(
      "SOS/07_LOGS/saios/runtime/shadow-queue/latest-shadow-queue.json",
    ) as {
      received_timestamp?: string | null;
      shadow_queue_id?: string | null;
      submission_id?: string | null;
      submission_checksum?: string | null;
      next_safe_action?: string | null;
      status?: string | null;
    } | null;
    const shadowHealth = ctx.readJson(
      "SOS/07_LOGS/saios/runtime/shadow-queue/shadow-queue-health.json",
    ) as {
      received_count?: number;
      status?: string;
      mode?: string;
    } | null;

    return {
      shadow_queue_status: shadowSnap?.status ?? shadowLatest?.status ?? null,
      latest_shadow_queue:
        shadowLatest || shadowSnap
          ? {
              shadow_queue_id:
                shadowLatest?.shadow_queue_id ??
                shadowSnap?.shadow_queue_id ??
                null,
              submission_id:
                shadowLatest?.submission_id ??
                shadowSnap?.submission_id ??
                null,
              submission_checksum:
                shadowLatest?.submission_checksum ??
                shadowSnap?.submission_checksum ??
                null,
              received_timestamp: shadowLatest?.received_timestamp ?? null,
              next_safe_action:
                shadowLatest?.next_safe_action ??
                shadowSnap?.next_safe_action ??
                null,
            }
          : null,
      shadow_queue_health: shadowHealth
        ? {
            received_count: shadowHealth.received_count ?? 0,
            status: shadowHealth.status ?? "idle",
            mode: shadowHealth.mode ?? "shadow_receive_only",
            shadow: true,
            dispatch_allowed: false,
            execution_allowed: false,
            publishing_allowed: false,
          }
        : {
            received_count: 0,
            status: "idle",
            mode: "shadow_receive_only",
            shadow: true,
            dispatch_allowed: false,
            execution_allowed: false,
            publishing_allowed: false,
          },
    };
  },
};

async function handleShadowList(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: DashboardRouteContext,
): Promise<void> {
  try {
    const { ShadowQueueRepository } = await import(
      "../../../runtime/queue/ShadowQueueRepository.js"
    );
    const store = new ShadowQueueRepository(ctx.repoRoot);
    json(res, 200, {
      latest: store.loadLatest(),
      record: store.loadLatestRecord(),
      health: store.loadHealth(),
      shadow: true,
      dispatch_allowed: false,
      execution_allowed: false,
      publishing_allowed: false,
      live: false,
    });
  } catch (e) {
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
}

async function handleShadowMission(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: DashboardRouteContext,
  match: RouteMatch,
): Promise<void> {
  try {
    const { createShadowQueueReceiver } = await import(
      "../../../runtime/queue/ShadowQueueReceiver.js"
    );
    const { QueueSubmissionRepository } = await import(
      "../../../core/company-brain/QueueSubmissionRepository.js"
    );
    const { rejectForbiddenShadowPayload } = await import(
      "../../../runtime/queue/ShadowQueueValidator.js"
    );
    const missionId = match.params.mission_id!;
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const probe: Record<string, unknown> = {};
    for (const key of [
      "execute",
      "dispatch",
      "queue",
      "scheduler",
      "publish",
      "provider",
    ]) {
      if (url.searchParams.has(key)) probe[key] = url.searchParams.get(key);
    }
    const forbidden = rejectForbiddenShadowPayload(probe);
    if (forbidden) {
      json(res, 400, { error: forbidden.message, code: forbidden.code });
      return;
    }

    const receiver = createShadowQueueReceiver(ctx.repoRoot);
    const mission = receiver.registry.get(missionId);
    if (!mission || mission.fixture) {
      json(res, 404, { error: "mission not found" });
      return;
    }

    const record = receiver.getForMission(missionId);
    const submission = new QueueSubmissionRepository(ctx.repoRoot).getForMission(
      missionId,
    );

    json(res, 200, {
      record,
      submission: submission
        ? {
            submission_id: submission.submission_id,
            mission_id: submission.mission_id,
            mission_version: submission.mission_version,
            submission_checksum: submission.submission_checksum,
            department: submission.department,
            priority: submission.priority,
            execution_package_checksum: submission.execution_package_checksum,
            acknowledgement_checksum: submission.acknowledgement_checksum,
          }
        : null,
      mission_status: mission.status,
      shadow: true,
      dispatch_allowed: false,
      execution_allowed: false,
      publishing_allowed: false,
      live: false,
      error:
        !record &&
        mission.status !== "QUEUE_SUBMISSION_READY" &&
        mission.status !== "SHADOW_QUEUE_RECEIVED"
          ? `Mission must be QUEUE_SUBMISSION_READY (got ${mission.status})`
          : undefined,
    });
  } catch (e) {
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
}

async function handleShadowReview(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: DashboardRouteContext,
): Promise<void> {
  if (process.env.SOS_AIOS_LIVE === "1") {
    json(res, 403, { error: "LIVE must be OFF" });
    return;
  }
  try {
    const { createShadowQueueReceiver } = await import(
      "../../../runtime/queue/ShadowQueueReceiver.js"
    );
    const { SHADOW_QUEUE_FOUNDER_ACTOR } = await import(
      "../../../runtime/queue/shadow-queue-types.js"
    );
    const { rejectForbiddenShadowPayload } = await import(
      "../../../runtime/queue/ShadowQueueValidator.js"
    );
    const raw = await ctx.readBody(req);
    const body = JSON.parse(raw) as Record<string, unknown>;
    const forbidden = rejectForbiddenShadowPayload(body);
    if (forbidden) {
      json(res, 400, { error: forbidden.message, code: forbidden.code });
      return;
    }
    const receiver = createShadowQueueReceiver(ctx.repoRoot);
    const result = receiver.receive({
      mission_id: String(body.mission_id ?? ""),
      mission_version: Number(body.mission_version),
      submission_id: String(body.submission_id ?? ""),
      submission_checksum: String(body.submission_checksum ?? ""),
      actor: String(body.actor ?? SHADOW_QUEUE_FOUNDER_ACTOR),
      reason: body.reason != null ? String(body.reason) : undefined,
      notes: body.notes != null ? String(body.notes) : undefined,
      fixture: false,
    });
    json(res, result.ok ? 200 : 400, {
      ok: result.ok,
      record: result.record,
      mission_status: result.mission_status,
      next_safe_action: result.next_safe_action,
      error: result.error ?? null,
      error_code: result.error_code ?? null,
      duplicate: result.duplicate === true,
      shadow: true,
      dispatch_allowed: false,
      execution_allowed: false,
      publishing_allowed: false,
      live: false,
      message: result.ok
        ? "Accepted into Shadow Queue · never dispatched · LIVE OFF"
        : result.error,
    });
  } catch (e) {
    json(res, 400, { error: e instanceof Error ? e.message : String(e) });
  }
}

export const shadowQueueRoutes: DashboardRouteHandler[] = [
  {
    id: "shadow-queue.list",
    method: "GET",
    pathPattern: "/api/runtime/shadow-queue",
    match: exactRoute("GET", "/api/runtime/shadow-queue"),
    handle: (req, res, ctx) => handleShadowList(req, res, ctx),
  },
  {
    id: "shadow-queue.mission",
    method: "GET",
    pathPattern: "/api/runtime/shadow-queue/:mission_id",
    match: paramRoute("GET", "/api/runtime/shadow-queue", "mission_id", [
      "review",
    ]),
    handle: (req, res, ctx, match) =>
      handleShadowMission(req, res, ctx, match),
  },
  {
    id: "shadow-queue.review",
    method: "POST",
    pathPattern: "/api/runtime/shadow-queue/review",
    match: exactRoute("POST", "/api/runtime/shadow-queue/review"),
    handle: (req, res, ctx) => handleShadowReview(req, res, ctx),
  },
];

export const shadowQueuePlugin: DashboardPlugin = {
  id: "shadow-queue",
  snapshot: shadowQueueSnapshotSource,
  routes: shadowQueueRoutes,
};
