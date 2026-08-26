/**
 * Read-only system state for Company Brain planning.
 * Never mutates runtime. Never calls providers.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { DepartmentId, PlanBlocker } from "./types.js";

export type SystemStateSnapshot = {
  enablement: {
    resume_enabled: boolean;
    website_enabled: boolean;
    future_departments_enabled: boolean;
  };
  knowledge: {
    available: boolean;
    snapshot_id: string | null;
    domains: string[];
  };
  queue: {
    available: boolean;
    job_count: number | null;
    note: string;
  };
  runtime_health: {
    label: string;
    live: false;
    heartbeat_age: string | null;
  };
  provider_validation: {
    status: string;
    eligible: boolean;
    readiness_state: string | null;
  };
  pending_founder_reviews: number;
  founder_actions_count: number;
  waiting_founder_cycles: number;
  critic_ready: boolean | null;
  canonical_engine: string;
  departments: Array<{
    id: DepartmentId;
    label: string;
    enabled: boolean;
    informational_only: boolean;
  }>;
};

function safeJson(path: string): unknown | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function countJsonl(path: string): number {
  if (!existsSync(path)) return 0;
  return readFileSync(path, "utf8").split("\n").filter(Boolean).length;
}

export function readSystemState(repoRoot: string): SystemStateSnapshot {
  const enablement = safeJson(
    join(repoRoot, "SOS/SAIOS/infra/department-enablement.json"),
  ) as {
    defaults?: { future_departments_enabled?: boolean };
    departments?: {
      resume?: { enabled?: boolean };
      website?: { enabled?: boolean };
    };
  } | null;

  const knowledgeDomains = safeJson(
    join(repoRoot, "SOS/07_LOGS/saios/knowledge-system/domains.json"),
  ) as { counts?: Record<string, number> } | null;
  const knowledgeGateway = safeJson(
    join(repoRoot, "SOS/07_LOGS/saios/knowledge-gateway/readiness.json"),
  ) as { snapshot_id?: string; domains?: string[] } | null;

  const jobsDir = join(repoRoot, "SOS/07_LOGS/saios/jobs");
  let jobCount: number | null = null;
  let queueAvailable = false;
  if (existsSync(jobsDir)) {
    try {
      jobCount = readdirSync(jobsDir).filter((f) => f.endsWith(".json")).length;
      queueAvailable = true;
    } catch {
      queueAvailable = false;
    }
  }

  const heartbeat = safeJson(
    join(repoRoot, "SOS/07_LOGS/saios/runtime-loop/runtime-heartbeat.json"),
  ) as { last_heartbeat?: string; generated_at?: string } | null;

  const pv = safeJson(
    join(repoRoot, "SOS/07_LOGS/saios/provider-validation/selected-candidate.json"),
  ) as {
    selection_status?: string;
    eligible?: boolean;
  } | null;
  const pvReady = safeJson(
    join(repoRoot, "SOS/07_LOGS/saios/provider-validation/readiness.json"),
  ) as { readiness_state?: string } | null;

  const activeWaiting = safeJson(
    join(
      repoRoot,
      "SOS/07_LOGS/saios/founder-gate-runtime/active-waiting-cycles.json",
    ),
  ) as { cycles?: Array<{ fixture?: boolean }> } | null;
  const waiting = (activeWaiting?.cycles ?? []).filter((c) => !c.fixture).length;

  const actionQueue = safeJson(
    join(
      repoRoot,
      "SOS/07_LOGS/saios/founder-control-center/founder-action-queue.json",
    ),
  ) as { actions?: unknown[] } | null;

  const critic = safeJson(
    join(repoRoot, "SOS/07_LOGS/saios/resume-critic/readiness.json"),
  ) as { ready?: boolean } | null;

  const decisionsPath = join(
    repoRoot,
    "SOS/07_LOGS/saios/founder-decisions/decisions.jsonl",
  );
  void countJsonl(decisionsPath);

  const resumeEnabled = Boolean(enablement?.departments?.resume?.enabled);
  const websiteEnabled = Boolean(enablement?.departments?.website?.enabled);
  const future = Boolean(enablement?.defaults?.future_departments_enabled);

  const catalog: SystemStateSnapshot["departments"] = [
    {
      id: "resume",
      label: "Resume Department",
      enabled: resumeEnabled,
      informational_only: false,
    },
    {
      id: "website",
      label: "Website Department",
      enabled: websiteEnabled,
      informational_only: !websiteEnabled,
    },
    {
      id: "seo",
      label: "SEO Department",
      enabled: false,
      informational_only: true,
    },
    {
      id: "marketing",
      label: "Marketing",
      enabled: false,
      informational_only: true,
    },
    {
      id: "publisher",
      label: "Publisher Operations",
      enabled: false,
      informational_only: true,
    },
    {
      id: "finance",
      label: "Finance",
      enabled: false,
      informational_only: true,
    },
    {
      id: "support",
      label: "Support",
      enabled: false,
      informational_only: true,
    },
  ];

  const hb =
    heartbeat?.last_heartbeat ?? heartbeat?.generated_at ?? null;

  return {
    enablement: {
      resume_enabled: resumeEnabled,
      website_enabled: websiteEnabled,
      future_departments_enabled: future,
    },
    knowledge: {
      available: Boolean(knowledgeDomains || knowledgeGateway),
      snapshot_id: knowledgeGateway?.snapshot_id ?? null,
      domains: knowledgeGateway?.domains ??
        (knowledgeDomains?.counts ? Object.keys(knowledgeDomains.counts) : []),
    },
    queue: {
      available: queueAvailable,
      job_count: jobCount,
      note: queueAvailable
        ? "Queue substrate present (orchestration). Company Brain V1 does not enqueue."
        : "Queue directory missing or unreadable — reported as warning; V1 does not enqueue anyway.",
    },
    runtime_health: {
      label: hb ? "heartbeat_present" : "heartbeat_unknown",
      live: false,
      heartbeat_age: hb,
    },
    provider_validation: {
      status: pv?.selection_status ?? "UNKNOWN",
      eligible: Boolean(pv?.eligible),
      readiness_state: pvReady?.readiness_state ?? null,
    },
    pending_founder_reviews: waiting,
    founder_actions_count: Array.isArray(actionQueue?.actions)
      ? actionQueue!.actions!.length
      : 0,
    waiting_founder_cycles: waiting,
    critic_ready: critic?.ready ?? null,
    canonical_engine: "core.first-production-cycle",
    departments: catalog,
  };
}

export function detectBlockers(state: SystemStateSnapshot): PlanBlocker[] {
  const blockers: PlanBlocker[] = [];

  if (!state.enablement.resume_enabled) {
    blockers.push({
      id: "blk-resume-disabled",
      severity: "blocker",
      code: "RESUME_DEPARTMENT_DISABLED",
      message: "Resume Department is disabled in department-enablement.json",
      source: "SOS/SAIOS/infra/department-enablement.json",
    });
  }

  if (state.waiting_founder_cycles > 0) {
    blockers.push({
      id: "blk-waiting-founder",
      severity: "blocker",
      code: "WAITING_FOUNDER_REVIEW",
      message: `${state.waiting_founder_cycles} cycle(s) waiting for founder decision — new execution must not start until resolved`,
      source: "SOS/07_LOGS/saios/founder-gate-runtime/active-waiting-cycles.json",
    });
  }

  if (state.provider_validation.status === "BLOCKED") {
    blockers.push({
      id: "blk-provider-validation",
      severity: "warning",
      code: "PROVIDER_VALIDATION_BLOCKED",
      message:
        "Provider Validation preparation is BLOCKED — real providers remain unavailable (expected in dry-run)",
      source: "SOS/07_LOGS/saios/provider-validation",
    });
  }

  if (!state.knowledge.available) {
    blockers.push({
      id: "blk-knowledge",
      severity: "warning",
      code: "KNOWLEDGE_UNAVAILABLE",
      message: "Knowledge system artifacts not found — plan may lack context",
      source: "SOS/07_LOGS/saios/knowledge-system",
    });
  }

  if (!state.queue.available) {
    blockers.push({
      id: "blk-queue",
      severity: "warning",
      code: "QUEUE_UNAVAILABLE",
      message:
        "Queue substrate unavailable — V1 does not enqueue; future V2 would be blocked",
      source: "SOS/07_LOGS/saios/jobs",
    });
  }

  if (state.runtime_health.label === "heartbeat_unknown") {
    blockers.push({
      id: "blk-runtime-health",
      severity: "warning",
      code: "RUNTIME_HEARTBEAT_UNKNOWN",
      message: "Runtime heartbeat artifact missing",
      source: "SOS/07_LOGS/saios/runtime-loop/runtime-heartbeat.json",
    });
  }

  if (state.critic_ready === false) {
    blockers.push({
      id: "blk-critic",
      severity: "warning",
      code: "CRITIC_NOT_READY",
      message: "Latest critic readiness is Ready=NO",
      source: "SOS/07_LOGS/saios/resume-critic/readiness.json",
    });
  }

  // Disabled departments referenced only as informational — not blockers unless objective requires them
  return blockers;
}
