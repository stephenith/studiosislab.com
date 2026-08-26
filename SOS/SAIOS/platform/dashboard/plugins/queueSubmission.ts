/**
 * Queue Submission dashboard plugin — Agent #175.
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

export const queueSubmissionSnapshotSource: SnapshotSource = {
  id: "queue-submission",
  fields: [
    "queue_submission_status",
    "pending_queue_submission",
    "latest_queue_submission",
    "queue_submission_health",
  ],
  empty() {
    return {
      queue_submission_status: null,
      pending_queue_submission: false,
      latest_queue_submission: null,
      queue_submission_health: null,
    };
  },
  load(ctx) {
    const qsubSnap = ctx.readJson(
      "SOS/07_LOGS/saios/company-brain/queue-submission/latest-queue-submission-snapshot.json",
    ) as {
      submission_status?: string | null;
      pending?: boolean;
      submission_id?: string | null;
      submission_checksum?: string | null;
      execution_package_id?: string | null;
      acknowledgement_id?: string | null;
      next_safe_action?: string | null;
    } | null;
    const qsubHealth = ctx.readJson(
      "SOS/07_LOGS/saios/company-brain/queue-submission/queue-submission-health.json",
    ) as {
      pending_count?: number;
      ready_count?: number;
      blocked_count?: number;
      status?: string;
      mode?: string;
    } | null;

    return {
      queue_submission_status: qsubSnap?.submission_status ?? null,
      pending_queue_submission: Boolean(qsubSnap?.pending),
      latest_queue_submission: qsubSnap
        ? {
            submission_id: qsubSnap.submission_id ?? null,
            submission_checksum: qsubSnap.submission_checksum ?? null,
            execution_package_id: qsubSnap.execution_package_id ?? null,
            acknowledgement_id: qsubSnap.acknowledgement_id ?? null,
            next_safe_action: qsubSnap.next_safe_action ?? null,
          }
        : null,
      queue_submission_health: qsubHealth
        ? {
            pending_count: qsubHealth.pending_count ?? 0,
            ready_count: qsubHealth.ready_count ?? 0,
            blocked_count: qsubHealth.blocked_count ?? 0,
            status: qsubHealth.status ?? "idle",
            mode: qsubHealth.mode ?? "shadow_submission_only",
            dry_run: true,
            submission_allowed: false,
            queue_insert_allowed: false,
            execution_allowed: false,
            publishing_allowed: false,
          }
        : {
            pending_count: 0,
            ready_count: 0,
            blocked_count: 0,
            status: "idle",
            mode: "shadow_submission_only",
            dry_run: true,
            submission_allowed: false,
            queue_insert_allowed: false,
            execution_allowed: false,
            publishing_allowed: false,
          },
    };
  },
};

async function handleSubmissionList(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: DashboardRouteContext,
): Promise<void> {
  try {
    const { QueueSubmissionRepository } = await import(
      "../../../core/company-brain/QueueSubmissionRepository.js"
    );
    const store = new QueueSubmissionRepository(ctx.repoRoot);
    json(res, 200, {
      latest: store.loadLatest(),
      package: store.loadLatestPackage(),
      pending: store.loadPending(),
      health: store.loadHealth(),
      dry_run: true,
      submission_allowed: false,
      queue_insert_allowed: false,
      execution_allowed: false,
      publishing_allowed: false,
      live: false,
    });
  } catch (e) {
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
}

async function handleSubmissionMission(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: DashboardRouteContext,
  match: RouteMatch,
): Promise<void> {
  try {
    const { createQueueSubmissionBuilder } = await import(
      "../../../core/company-brain/QueueSubmissionBuilder.js"
    );
    const { rejectForbiddenSubmissionPayload } = await import(
      "../../../core/company-brain/QueueSubmissionValidator.js"
    );
    const missionId = match.params.mission_id!;
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const probe: Record<string, unknown> = {};
    for (const key of [
      "enqueue",
      "queue",
      "dispatch",
      "execute",
      "publish",
      "enable_live",
      "provider_call",
    ]) {
      if (url.searchParams.has(key)) probe[key] = url.searchParams.get(key);
    }
    const forbidden = rejectForbiddenSubmissionPayload(probe);
    if (forbidden) {
      json(res, 400, { error: forbidden.message, code: forbidden.code });
      return;
    }

    const builder = createQueueSubmissionBuilder(ctx.repoRoot);
    const mission = builder.registry.get(missionId);
    if (!mission || mission.fixture) {
      json(res, 404, { error: "mission not found" });
      return;
    }

    let pkg = builder.getForMission(missionId);
    if (!pkg && mission.status === "PACKAGE_ACKNOWLEDGED") {
      const built = builder.buildForMission(missionId, { fixture: false });
      if (!built.ok) {
        json(res, 400, {
          error: built.error,
          error_code: built.error_code,
          package: null,
          mission_status: mission.status,
          submission_status: mission.status,
        });
        return;
      }
      pkg = built.package;
    }

    const refreshed = builder.registry.get(missionId);
    json(res, 200, {
      package: pkg,
      mission_status: refreshed?.status ?? mission.status,
      submission_status: refreshed?.status ?? mission.status,
      dry_run: true,
      submission_allowed: false,
      queue_insert_allowed: false,
      execution_allowed: false,
      publishing_allowed: false,
      live: false,
      error:
        !pkg &&
        refreshed?.status !== "PACKAGE_ACKNOWLEDGED" &&
        refreshed?.status !== "WAITING_QUEUE_SUBMISSION" &&
        refreshed?.status !== "QUEUE_SUBMISSION_READY" &&
        refreshed?.status !== "QUEUE_SUBMISSION_BLOCKED"
          ? `Mission must be PACKAGE_ACKNOWLEDGED (got ${refreshed?.status})`
          : undefined,
    });
  } catch (e) {
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
}

async function handleSubmissionReview(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: DashboardRouteContext,
): Promise<void> {
  if (process.env.SOS_AIOS_LIVE === "1") {
    json(res, 403, { error: "LIVE must be OFF" });
    return;
  }
  try {
    const { createQueueSubmissionBuilder } = await import(
      "../../../core/company-brain/QueueSubmissionBuilder.js"
    );
    const { QUEUE_SUBMISSION_FOUNDER_ACTOR } = await import(
      "../../../core/company-brain/queue-submission-types.js"
    );
    const { rejectForbiddenSubmissionPayload } = await import(
      "../../../core/company-brain/QueueSubmissionValidator.js"
    );
    const raw = await ctx.readBody(req);
    const body = JSON.parse(raw) as Record<string, unknown>;
    const forbidden = rejectForbiddenSubmissionPayload(body);
    if (forbidden) {
      json(res, 400, { error: forbidden.message, code: forbidden.code });
      return;
    }
    const builder = createQueueSubmissionBuilder(ctx.repoRoot);
    const result = builder.recordReview({
      mission_id: String(body.mission_id ?? ""),
      mission_version: Number(body.mission_version),
      submission_id: String(body.submission_id ?? ""),
      submission_checksum: String(body.submission_checksum ?? ""),
      decision: body.decision as
        | "CONFIRM_SHADOW_PACKAGE"
        | "BLOCK_SUBMISSION",
      actor: String(body.actor ?? QUEUE_SUBMISSION_FOUNDER_ACTOR),
      reason: body.reason != null ? String(body.reason) : undefined,
      notes: body.notes != null ? String(body.notes) : undefined,
      fixture: false,
    });
    json(res, result.ok ? 200 : 400, {
      ok: result.ok,
      package: result.package,
      mission_status: result.mission_status,
      next_safe_action: result.next_safe_action,
      error: result.error ?? null,
      error_code: result.error_code ?? null,
      dry_run: true,
      submission_allowed: false,
      queue_insert_allowed: false,
      execution_allowed: false,
      publishing_allowed: false,
      live: false,
      message: result.ok
        ? "Shadow submission review recorded · runtime Queue untouched · no enqueue"
        : result.error,
    });
  } catch (e) {
    json(res, 400, { error: e instanceof Error ? e.message : String(e) });
  }
}

export const queueSubmissionRoutes: DashboardRouteHandler[] = [
  {
    id: "queue-submission.list",
    method: "GET",
    pathPattern: "/api/company-brain/queue-submission",
    match: exactRoute("GET", "/api/company-brain/queue-submission"),
    handle: (req, res, ctx) => handleSubmissionList(req, res, ctx),
  },
  {
    id: "queue-submission.mission",
    method: "GET",
    pathPattern: "/api/company-brain/queue-submission/:mission_id",
    match: paramRoute(
      "GET",
      "/api/company-brain/queue-submission",
      "mission_id",
    ),
    handle: (req, res, ctx, match) =>
      handleSubmissionMission(req, res, ctx, match),
  },
  {
    id: "queue-submission.review",
    method: "POST",
    pathPattern: "/api/company-brain/queue-submission-review",
    match: exactRoute("POST", "/api/company-brain/queue-submission-review"),
    handle: (req, res, ctx) => handleSubmissionReview(req, res, ctx),
  },
];

export const queueSubmissionPlugin: DashboardPlugin = {
  id: "queue-submission",
  snapshot: queueSubmissionSnapshotSource,
  routes: queueSubmissionRoutes,
};
