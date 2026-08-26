/**
 * Mission Approval dashboard plugin — Agent #174.
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

export const missionApprovalSnapshotSource: SnapshotSource = {
  id: "mission-approval",
  fields: [
    "pending_mission_approval",
    "latest_mission_decision",
    "mission_approval_health",
  ],
  empty() {
    return {
      pending_mission_approval: false,
      latest_mission_decision: null,
      mission_approval_health: null,
    };
  },
  load(ctx) {
    const approval = ctx.readJson(
      "SOS/07_LOGS/saios/company-brain/mission-approvals/latest-mission-approval.json",
    ) as {
      mission_id?: string | null;
      latest_decision_id?: string | null;
      latest_decision?: string | null;
      next_safe_action?: string | null;
      pending?: boolean;
      mission_status?: string | null;
    } | null;
    const approvalHealth = ctx.readJson(
      "SOS/07_LOGS/saios/company-brain/mission-approvals/mission-approval-health.json",
    ) as {
      pending_count?: number;
      approved_count?: number;
      rejected_count?: number;
      changes_requested_count?: number;
      status?: string;
      mode?: string;
    } | null;
    const pendingDoc = ctx.readJson(
      "SOS/07_LOGS/saios/company-brain/mission-approvals/pending-mission-approvals.json",
    ) as { count?: number; pending?: unknown[] } | null;

    return {
      pending_mission_approval:
        Boolean(approval?.pending) ||
        ctx.missionStatus === "WAITING_FOUNDER" ||
        (typeof pendingDoc?.count === "number" && pendingDoc.count > 0),
      latest_mission_decision: approval
        ? {
            decision_id: approval.latest_decision_id ?? null,
            decision: approval.latest_decision ?? null,
            mission_id: approval.mission_id ?? null,
            actor: "stephen",
            created_at: null,
            next_safe_action: approval.next_safe_action ?? null,
          }
        : null,
      mission_approval_health: approvalHealth
        ? {
            pending_count: approvalHealth.pending_count ?? 0,
            approved_count: approvalHealth.approved_count ?? 0,
            rejected_count: approvalHealth.rejected_count ?? 0,
            changes_requested_count:
              approvalHealth.changes_requested_count ?? 0,
            status: approvalHealth.status ?? "idle",
            mode: approvalHealth.mode ?? "approval_only",
            execution_allowed: false,
            queue_admission_allowed: false,
            publishing_allowed: false,
          }
        : {
            pending_count: 0,
            approved_count: 0,
            rejected_count: 0,
            changes_requested_count: 0,
            status: "idle",
            mode: "approval_only",
            execution_allowed: false,
            queue_admission_allowed: false,
            publishing_allowed: false,
          },
    };
  },
};

async function handleMissionsList(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: DashboardRouteContext,
): Promise<void> {
  try {
    const { createMissionDecisionManager } = await import(
      "../../../core/company-brain/MissionDecisionManager.js"
    );
    const mgr = createMissionDecisionManager(ctx.repoRoot);
    const missions = mgr.listMissions().filter((m) => !m.fixture);
    json(res, 200, {
      count: missions.length,
      missions: missions.map((m) => ({
        mission_id: m.mission_id,
        mission_version: m.mission_version,
        mission_name: m.mission_name,
        status: m.status,
        priority: m.priority,
        risk_level: m.risk_level,
        founder_approval_required: true,
        execution_allowed: false,
        queue_admission_allowed: false,
        publishing_allowed: false,
        updated_at: m.updated_at,
      })),
      live: false,
    });
  } catch (e) {
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
}

async function handleMissionDetail(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: DashboardRouteContext,
  match: RouteMatch,
): Promise<void> {
  try {
    const { createMissionDecisionManager } = await import(
      "../../../core/company-brain/MissionDecisionManager.js"
    );
    const mgr = createMissionDecisionManager(ctx.repoRoot);
    const detail = mgr.getMissionDetail(match.params.mission_id!);
    if (!detail || detail.mission.fixture) {
      json(res, 404, { error: "mission not found" });
      return;
    }
    json(res, 200, {
      ...detail,
      execution_allowed: false,
      queue_admission_allowed: false,
      publishing_allowed: false,
      live: false,
    });
  } catch (e) {
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
}

async function handleMissionDecision(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: DashboardRouteContext,
): Promise<void> {
  if (process.env.SOS_AIOS_LIVE === "1") {
    json(res, 403, { error: "LIVE must be OFF" });
    return;
  }
  try {
    const { createMissionDecisionManager } = await import(
      "../../../core/company-brain/MissionDecisionManager.js"
    );
    const { MISSION_FOUNDER_ACTOR } = await import(
      "../../../core/company-brain/mission-decision-types.js"
    );
    const raw = await ctx.readBody(req);
    const body = JSON.parse(raw) as Record<string, unknown>;
    for (const key of [
      "execute",
      "enqueue",
      "publish",
      "enable_live",
      "execution_allowed",
      "queue_admission_allowed",
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
    const mgr = createMissionDecisionManager(ctx.repoRoot);
    const result = mgr.recordDecision({
      mission_id: String(body.mission_id ?? ""),
      mission_version: Number(body.mission_version),
      decision: body.decision as
        | "APPROVED"
        | "REJECTED"
        | "CHANGES_REQUESTED",
      actor: String(body.actor ?? MISSION_FOUNDER_ACTOR),
      reason: body.reason != null ? String(body.reason) : undefined,
      feedback: body.feedback != null ? String(body.feedback) : undefined,
      fixture: false,
    });
    json(res, result.ok ? 200 : 400, {
      ok: result.ok,
      decision: result.decision,
      mission_status: result.mission_status,
      next_safe_action: result.next_safe_action,
      error: result.error ?? null,
      error_code: result.error_code ?? null,
      duplicate: result.duplicate === true,
      execution_allowed: false,
      queue_admission_allowed: false,
      publishing_allowed: false,
      live: false,
      message: result.ok
        ? "Mission decision recorded · no execution · no queue · no publish"
        : result.error,
    });
  } catch (e) {
    json(res, 400, { error: e instanceof Error ? e.message : String(e) });
  }
}

export const missionApprovalRoutes: DashboardRouteHandler[] = [
  {
    id: "mission-approval.missions",
    method: "GET",
    pathPattern: "/api/company-brain/missions",
    match: exactRoute("GET", "/api/company-brain/missions"),
    handle: (req, res, ctx) => handleMissionsList(req, res, ctx),
  },
  {
    id: "mission-approval.mission-detail",
    method: "GET",
    pathPattern: "/api/company-brain/mission/:mission_id",
    match: paramRoute("GET", "/api/company-brain/mission", "mission_id"),
    handle: (req, res, ctx, match) =>
      handleMissionDetail(req, res, ctx, match),
  },
  {
    id: "mission-approval.mission-decision",
    method: "POST",
    pathPattern: "/api/company-brain/mission-decision",
    match: exactRoute("POST", "/api/company-brain/mission-decision"),
    handle: (req, res, ctx) => handleMissionDecision(req, res, ctx),
  },
];

export const missionApprovalPlugin: DashboardPlugin = {
  id: "mission-approval",
  snapshot: missionApprovalSnapshotSource,
  routes: missionApprovalRoutes,
};
