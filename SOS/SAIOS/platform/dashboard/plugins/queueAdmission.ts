/**
 * Queue Admission dashboard plugin — Agent #175.
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

export const queueAdmissionSnapshotSource: SnapshotSource = {
  id: "queue-admission",
  fields: ["queue_admission"],
  empty() {
    return { queue_admission: null };
  },
  load(ctx) {
    const queueAdmission = ctx.readJson(
      "SOS/07_LOGS/saios/company-brain/queue-admission/latest-queue-admission.json",
    ) as {
      queue_status?: string | null;
      overall_score?: number | null;
      verdict?: string | null;
      pending?: boolean;
      execution_still_blocked_reason?: string;
    } | null;
    const queueReview = ctx.readJson(
      "SOS/07_LOGS/saios/company-brain/queue-admission/latest-queue-review.json",
    ) as { overall_score?: number; verdict?: string } | null;

    return {
      queue_admission: {
        queue_status: queueAdmission?.queue_status ?? null,
        overall_score:
          queueAdmission?.overall_score ?? queueReview?.overall_score ?? null,
        verdict: queueAdmission?.verdict ?? queueReview?.verdict ?? null,
        pending: Boolean(queueAdmission?.pending),
        execution_still_blocked_reason:
          queueAdmission?.execution_still_blocked_reason ??
          "READY_FOR_QUEUE does not enqueue or execute",
        execution_allowed: false,
        queue_enqueue_allowed: false,
        publishing_allowed: false,
      },
    };
  },
};

async function handleQueueReviewList(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: DashboardRouteContext,
): Promise<void> {
  try {
    const { createQueueAdmissionReview } = await import(
      "../../../core/company-brain/QueueAdmissionReview.js"
    );
    const { QueueAdmissionRepository } = await import(
      "../../../core/company-brain/QueueAdmissionRepository.js"
    );
    const qa = createQueueAdmissionReview(ctx.repoRoot);
    const latest = qa.getLatestReview(false);
    const store = new QueueAdmissionRepository(ctx.repoRoot);
    const snap = store.loadSnapshot();
    const health = store.loadHealth();
    json(res, 200, {
      latest_review: latest,
      snapshot: snap,
      health,
      execution_allowed: false,
      queue_enqueue_allowed: false,
      publishing_allowed: false,
      live: false,
    });
  } catch (e) {
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
}

async function handleQueueReviewMission(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: DashboardRouteContext,
  match: RouteMatch,
): Promise<void> {
  try {
    const { createQueueAdmissionReview } = await import(
      "../../../core/company-brain/QueueAdmissionReview.js"
    );
    const missionId = match.params.mission_id!;
    const qa = createQueueAdmissionReview(ctx.repoRoot);
    const mission = qa.registry.get(missionId);
    if (!mission || mission.fixture) {
      json(res, 404, { error: "mission not found" });
      return;
    }
    let review = qa.getReviewForMission(missionId);
    if (
      mission.status === "APPROVED" ||
      mission.status === "WAITING_QUEUE_REVIEW" ||
      mission.status === "QUEUE_BLOCKED"
    ) {
      const started = qa.startReview(missionId, { fixture: false });
      if (started.ok && started.review) review = started.review;
    }
    json(res, 200, {
      mission_id: missionId,
      mission_status: qa.registry.get(missionId)?.status ?? mission.status,
      review,
      execution_allowed: false,
      queue_enqueue_allowed: false,
      publishing_allowed: false,
      live: false,
      execution_still_blocked_reason:
        review?.execution_still_blocked_reason ??
        "READY_FOR_QUEUE does not execute",
    });
  } catch (e) {
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
}

async function handleQueueDecision(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: DashboardRouteContext,
): Promise<void> {
  if (process.env.SOS_AIOS_LIVE === "1") {
    json(res, 403, { error: "LIVE must be OFF" });
    return;
  }
  try {
    const { createQueueAdmissionReview } = await import(
      "../../../core/company-brain/QueueAdmissionReview.js"
    );
    const { QUEUE_FOUNDER_ACTOR } = await import(
      "../../../core/company-brain/queue-admission-types.js"
    );
    const raw = await ctx.readBody(req);
    const body = JSON.parse(raw) as Record<string, unknown>;
    for (const key of [
      "execute",
      "run",
      "dispatch",
      "enqueue",
      "publish",
      "enable_live",
      "execution_allowed",
      "queue_enqueue_allowed",
      "publishing_allowed",
    ]) {
      if (key in body) {
        json(res, 400, {
          error: `Field '${key}' is forbidden`,
          code: "FORBIDDEN_SIDE_EFFECT",
        });
        return;
      }
    }
    const qa = createQueueAdmissionReview(ctx.repoRoot);
    const result = qa.recordDecision({
      mission_id: String(body.mission_id ?? ""),
      mission_version: Number(body.mission_version),
      decision: body.decision as
        | "APPROVE_QUEUE_ADMISSION"
        | "REQUEST_CHANGES"
        | "REJECT_QUEUE_ADMISSION",
      actor: String(body.actor ?? QUEUE_FOUNDER_ACTOR),
      reason: body.reason != null ? String(body.reason) : undefined,
      feedback: body.feedback != null ? String(body.feedback) : undefined,
      review_id: body.review_id != null ? String(body.review_id) : undefined,
      fixture: false,
    });
    json(res, result.ok ? 200 : 400, {
      ok: result.ok,
      decision: result.decision,
      review: result.review,
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
        ? "Queue admission decision recorded · no enqueue · no execution · no publish"
        : result.error,
    });
  } catch (e) {
    json(res, 400, { error: e instanceof Error ? e.message : String(e) });
  }
}

export const queueAdmissionRoutes: DashboardRouteHandler[] = [
  {
    id: "queue-admission.list",
    method: "GET",
    pathPattern: "/api/company-brain/queue-review",
    match: exactRoute("GET", "/api/company-brain/queue-review"),
    handle: (req, res, ctx) => handleQueueReviewList(req, res, ctx),
  },
  {
    id: "queue-admission.mission",
    method: "GET",
    pathPattern: "/api/company-brain/queue-review/:mission_id",
    match: paramRoute("GET", "/api/company-brain/queue-review", "mission_id"),
    handle: (req, res, ctx, match) =>
      handleQueueReviewMission(req, res, ctx, match),
  },
  {
    id: "queue-admission.decision",
    method: "POST",
    pathPattern: "/api/company-brain/queue-decision",
    match: exactRoute("POST", "/api/company-brain/queue-decision"),
    handle: (req, res, ctx) => handleQueueDecision(req, res, ctx),
  },
];

export const queueAdmissionPlugin: DashboardPlugin = {
  id: "queue-admission",
  snapshot: queueAdmissionSnapshotSource,
  routes: queueAdmissionRoutes,
};
