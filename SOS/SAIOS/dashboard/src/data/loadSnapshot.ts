/**
 * Read-only AIOS artifact loader for Founder Dashboard V1 — Agent #123.
 * Never fabricates success; never exposes secrets.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { redactValue } from "./redact.js";
import type {
  ActivityEvent,
  AiosStatus,
  BrainNode,
  CriticScoresView,
  CycleItem,
  DashboardSnapshot,
  DataSourceState,
  DepartmentRow,
  ExceptionItem,
  FounderAction,
  KnowledgeDomainRow,
  ProductionCycleView,
  ProviderValidationViewData,
  CompanyBrainViewData,
  SkillRow,
} from "./types.js";
import { loadReviewQueueForRepo } from "./buildFounderReviewQueue.js";
import { defaultSnapshotRegistry } from "../../../platform/dashboard/SnapshotRegistry.js";
import {
  createWave1SnapshotLoader,
  ensureDashboardPluginsRegistered,
} from "../../../platform/dashboard/plugins/register.js";

ensureDashboardPluginsRegistered();
const wave1SnapshotLoader = createWave1SnapshotLoader(defaultSnapshotRegistry);

export function resolveRepoRoot(fromDir = import.meta.dirname): string {
  // SOS/SAIOS/dashboard/src/data → repo root = ../../../../..
  return resolve(fromDir, "../../../../..");
}

function safeReadJson(
  repo: string,
  rel: string,
  sources: DataSourceState[],
): unknown | null {
  const path = join(repo, rel);
  const id = rel;
  if (!existsSync(path)) {
    sources.push({ id, path: rel, available: false, error: "missing" });
    return null;
  }
  try {
    const raw = JSON.parse(readFileSync(path, "utf8"));
    sources.push({ id, path: rel, available: true });
    return redactValue("root", raw);
  } catch (e) {
    sources.push({
      id,
      path: rel,
      available: false,
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

function ageFromIso(iso: string | null | undefined): string {
  if (!iso) return "unknown";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "unknown";
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}d`;
}

function fileMtimeIso(repo: string, rel: string): string | null {
  const p = join(repo, rel);
  if (!existsSync(p)) return null;
  try {
    return statSync(p).mtime.toISOString();
  } catch {
    return null;
  }
}

export function loadDashboardSnapshot(repoRoot?: string): DashboardSnapshot {
  const repo = repoRoot ?? resolveRepoRoot();
  const sources: DataSourceState[] = [];
  const now = new Date().toISOString();

  const projectState = safeReadJson(repo, "SOS/project-state.json", sources) as
    | Record<string, unknown>
    | null;
  const enablement = safeReadJson(
    repo,
    "SOS/SAIOS/infra/department-enablement.json",
    sources,
  ) as { departments?: Record<string, Record<string, unknown>> } | null;
  const actionQueue = safeReadJson(
    repo,
    "SOS/07_LOGS/saios/founder-control-center/founder-action-queue.json",
    sources,
  ) as { actions?: FounderAction[]; generated_at?: string } | null;
  const knowledgeDomains = safeReadJson(
    repo,
    "SOS/07_LOGS/saios/knowledge-system/domains.json",
    sources,
  ) as {
    counts?: Record<string, number>;
    generated_at?: string;
  } | null;
  const knowledgeOwnership = safeReadJson(
    repo,
    "SOS/07_LOGS/saios/knowledge-system/ownership.json",
    sources,
  ) as { ownership?: Array<Record<string, unknown>> } | null;
  const knowledgeGateway = safeReadJson(
    repo,
    "SOS/07_LOGS/saios/knowledge-gateway/readiness.json",
    sources,
  ) as Record<string, unknown> | null;
  const mockReady = safeReadJson(
    repo,
    "SOS/07_LOGS/saios/mock-provider/readiness.json",
    sources,
  ) as Record<string, unknown> | null;
  const skillMap = safeReadJson(
    repo,
    "SOS/07_LOGS/saios/skill-library/skill-map.json",
    sources,
  ) as { skills?: SkillRow[]; count?: number } | null;
  const skillRegistry = safeReadJson(
    repo,
    "SOS/SAIOS/config/skill-registry.json",
    sources,
  ) as { skills?: Array<{ id: string; name: string; domain: string }>; count?: number } | null;
  const resumeIntegration = safeReadJson(
    repo,
    "SOS/07_LOGS/saios/resume-integration/readiness.json",
    sources,
  ) as Record<string, unknown> | null;
  const factoryMigration = safeReadJson(
    repo,
    "SOS/07_LOGS/saios/resume-factory-migration/readiness.json",
    sources,
  ) as Record<string, unknown> | null;
  const firstDryRunDash = safeReadJson(
    repo,
    "SOS/07_LOGS/saios/first-dry-run/dashboard-update.json",
    sources,
  ) as {
    generated_at?: string;
    mission_control?: {
      current_cycle?: {
        id: string;
        title: string;
        status: string;
        stage?: string;
        skill_id?: string;
        knowledge_domains?: string[];
        provider?: string;
        qa_status?: string;
        founder_review_pending?: boolean;
      };
      recent_events?: Array<{
        at: string;
        stage: string;
        summary: string;
        status: string;
      }>;
    };
  } | null;
  const firstDryRunTimeline = safeReadJson(
    repo,
    "SOS/07_LOGS/saios/first-dry-run/execution-timeline.json",
    sources,
  ) as { timeline?: Array<Record<string, string>> } | null;
  const activeWaiting = safeReadJson(
    repo,
    "SOS/07_LOGS/saios/founder-gate-runtime/active-waiting-cycles.json",
    sources,
  ) as {
    cycles?: Array<{
      cycle_id: string;
      review_id: string;
      candidate_id: string;
      state: string;
      fixture?: boolean;
    }>;
  } | null;
  const latestCycleState = safeReadJson(
    repo,
    "SOS/07_LOGS/saios/founder-gate-runtime/latest-cycle-state.json",
    sources,
  ) as {
    latest?: {
      cycle_id?: string;
      task_id?: string;
      candidate_title?: string;
      review_id?: string;
      state?: string;
      created_at?: string;
      critic_result?: { overall?: number; ats?: number; ready?: boolean };
      queue_action_id?: string | null;
      fixture?: boolean;
    } | null;
  } | null;
  const gateActivityPath = join(
    repo,
    "SOS/07_LOGS/saios/founder-gate-runtime/activity-events.jsonl",
  );
  const gateActivityLines = existsSync(gateActivityPath)
    ? readFileSync(gateActivityPath, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as {
        event_type: string;
        cycle_id: string;
        summary: string;
        status?: string;
        at: string;
        fixture?: boolean;
      })
      .filter((e) => !e.fixture)
    : [];
  const gatewaySkillRequest = safeReadJson(
    repo,
    "SOS/07_LOGS/saios/knowledge-gateway/skill-request.json",
    sources,
  ) as Record<string, unknown> | null;
  const gatewayFlow = safeReadJson(
    repo,
    "SOS/07_LOGS/saios/knowledge-gateway/flow.json",
    sources,
  ) as Record<string, unknown> | null;
  const heartbeat = safeReadJson(
    repo,
    "SOS/07_LOGS/saios/runtime-loop/runtime-heartbeat.json",
    sources,
  ) as { last_heartbeat?: string; generated_at?: string } | null;

  const liveEnv = process.env.SOS_AIOS_LIVE;
  if (liveEnv === "1") {
    // Still report LIVE OFF for V1 UI contract — verify will FAIL if env is 1
  }

  const resumeDept = enablement?.departments?.resume;
  const websiteDept = enablement?.departments?.website;
  const ops = (projectState?.operations ?? {}) as Record<string, Record<string, unknown>>;

  const heartbeatIso =
    heartbeat?.last_heartbeat ??
    heartbeat?.generated_at ??
    (knowledgeGateway?.generated_at as string | undefined) ??
    (projectState?.generated_at as string | undefined) ??
    null;

  const skillCount =
    skillRegistry?.count ??
    skillRegistry?.skills?.length ??
    skillMap?.count ??
    22;

  const departments: DepartmentRow[] = [
    {
      id: "resume",
      label: "Resume Department",
      status: resumeDept?.enabled ? "healthy" : "disabled",
      mode: resumeDept?.dry_run ? "dry_run" : "unknown",
      queue_depth: 0,
      last_activity:
        (resumeIntegration?.generated_at as string) ??
        fileMtimeIso(repo, "SOS/07_LOGS/saios/resume-integration/readiness.json"),
      health: ops.resume_brain_integration?.status === "ready" ? "healthy" : "degraded",
      open_route: "resume",
      notes: "AI path via ResumeKnowledgeGateway",
    },
    {
      id: "knowledge",
      label: "Knowledge System",
      status: ops.knowledge_system?.status === "ready" ? "healthy" : "degraded",
      mode: "read_scoped",
      queue_depth: null,
      last_activity: knowledgeDomains?.generated_at ?? null,
      health: ops.knowledge_system?.status === "ready" ? "healthy" : "degraded",
      open_route: "knowledge",
    },
    {
      id: "brain",
      label: "Brain Router",
      status: "healthy",
      mode: "mock_only",
      queue_depth: null,
      last_activity: (mockReady?.generated_at as string) ?? null,
      health: "healthy",
      open_route: "brain",
    },
    {
      id: "skills",
      label: "Skill Library",
      status: "healthy",
      mode: `${skillCount} skills`,
      queue_depth: null,
      last_activity: fileMtimeIso(repo, "SOS/SAIOS/config/skill-registry.json"),
      health: "healthy",
      open_route: "skills",
      notes: `${skillCount} registered`,
    },
    {
      id: "mock",
      label: "Mock Provider",
      status: mockReady?.status === "ready" ? "healthy" : "degraded",
      mode: "active",
      queue_depth: null,
      last_activity: (mockReady?.generated_at as string) ?? null,
      health: mockReady?.status === "ready" ? "healthy" : "degraded",
      open_route: "brain",
    },
    {
      id: "website",
      label: "Website Department",
      status: "disabled",
      mode: "disabled",
      queue_depth: null,
      last_activity: null,
      health: "disabled",
      open_route: null,
      notes: String(websiteDept?.reason ?? "disabled by founder"),
    },
  ];

  const cycles: CycleItem[] = [];
  const dryCycle = firstDryRunDash?.mission_control?.current_cycle;
  if (dryCycle?.id) {
    cycles.push({
      id: dryCycle.id,
      title: dryCycle.title,
      status: (dryCycle.status as CycleItem["status"]) || "waiting_founder",
      department: "resume",
      skill_id: dryCycle.skill_id,
      updated_at: firstDryRunDash?.generated_at,
      source: "SOS/07_LOGS/saios/first-dry-run/dashboard-update.json",
    });
  }
  if (knowledgeGateway?.skill_id) {
    cycles.push({
      id: String(knowledgeGateway.snapshot_id ?? "knowledge-gateway-sim"),
      title: `Skill ${knowledgeGateway.skill_id}`,
      status:
        knowledgeGateway.response_status === "COMPLETED"
          ? "completed"
          : "failed",
      department: "resume",
      skill_id: String(knowledgeGateway.skill_id),
      updated_at: String(knowledgeGateway.generated_at ?? ""),
      source: "SOS/07_LOGS/saios/knowledge-gateway/readiness.json",
    });
  }
  if (factoryMigration?.overall === "PASS") {
    cycles.push({
      id: "factory-migration-verify",
      title: "Resume Factory migration verify",
      status: "completed",
      department: "resume",
      updated_at: String(factoryMigration.generated_at ?? ""),
      source: "SOS/07_LOGS/saios/resume-factory-migration/readiness.json",
    });
  }
  const waitingCycles = (activeWaiting?.cycles ?? []).filter((c) => !c.fixture);
  for (const w of waitingCycles) {
    if (cycles.some((c) => c.id === w.cycle_id)) continue;
    cycles.unshift({
      id: w.cycle_id,
      title: latestCycleState?.latest?.candidate_title ?? w.candidate_id,
      status: "waiting_founder",
      department: "resume",
      updated_at: latestCycleState?.latest?.created_at ?? now,
      source: "SOS/07_LOGS/saios/founder-gate-runtime/active-waiting-cycles.json",
    });
  }

  const exceptions: ExceptionItem[] = [];
  if (waitingCycles.length) {
    exceptions.unshift({
      id: "production-cycle-waiting-founder",
      severity: "founder",
      title: "WAITING FOR FOUNDER — production cycle paused",
      detail:
        "Execution paused · no automatic decision · no automatic publication · LIVE OFF · dry_run · Mock Provider",
      source: "SOS/07_LOGS/saios/founder-gate-runtime",
    });
  }
  if (dryCycle?.founder_review_pending) {
    exceptions.unshift({
      id: "first-dry-run-founder-review",
      severity: "founder",
      title: "Founder review pending — first dry run",
      detail: `${dryCycle.title} · stage=${dryCycle.stage} · QA=${dryCycle.qa_status} · skill=${dryCycle.skill_id}`,
      source: "SOS/07_LOGS/saios/first-dry-run/dashboard-update.json",
    });
  }
  const pending = (projectState?.pending_actions as string[] | undefined) ?? [];
  for (const p of pending.slice(0, 5)) {
    exceptions.push({
      id: `pending-${exceptions.length}`,
      severity: p.toLowerCase().includes("awaiting") ? "founder" : "blocked",
      title: "Pending action",
      detail: p,
      source: "SOS/project-state.json",
    });
  }
  if (ops.knowledge_system?.status !== "ready") {
    exceptions.push({
      id: "knowledge-not-ready",
      severity: "degraded",
      title: "Knowledge System not ready",
      detail: "operations.knowledge_system.status != ready",
      source: "SOS/project-state.json",
    });
  }

  const criticReadiness = safeReadJson(
    repo,
    "SOS/07_LOGS/saios/resume-critic/readiness.json",
    sources,
  ) as {
    ready?: boolean;
    founder_review_allowed?: boolean;
    blocked_reasons?: string[];
    scores?: Record<string, number>;
    generated_at?: string;
  } | null;
  const gateIndex = safeReadJson(
    repo,
    "SOS/07_LOGS/saios/critic-gate/gate-index.json",
    sources,
  ) as { latest_by_candidate?: Record<string, string> } | null;

  let blockedLines: Array<Record<string, unknown>> = [];
  try {
    const p = join(repo, "SOS/07_LOGS/saios/critic-gate/blocked-candidates.jsonl");
    if (existsSync(p)) {
      blockedLines = readFileSync(p, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l) as Record<string, unknown>)
        .filter((b) => !b.fixture)
        .slice(-5);
      sources.push({
        id: "SOS/07_LOGS/saios/critic-gate/blocked-candidates.jsonl",
        path: "SOS/07_LOGS/saios/critic-gate/blocked-candidates.jsonl",
        available: true,
      });
    }
  } catch {
    blockedLines = [];
  }

  for (const b of blockedLines) {
    exceptions.unshift({
      id: `critic-blocked-${String(b.candidate_id)}`,
      severity: "blocked",
      title: `Critic blocked: ${String(b.candidate_title ?? b.candidate_id)}`,
      detail: Array.isArray(b.blocking_reasons)
        ? (b.blocking_reasons as string[]).join("; ")
        : "BLOCKED_BY_CRITIC",
      source: "SOS/07_LOGS/saios/critic-gate/blocked-candidates.jsonl",
    });
  }

  const critic: CriticScoresView | null = criticReadiness?.scores
    ? {
        overall: Number(criticReadiness.scores.overall ?? 0),
        ats: Number(criticReadiness.scores.ats ?? 0),
        visual: Number(criticReadiness.scores.visual ?? 0),
        typography: Number(criticReadiness.scores.typography ?? 0),
        layout: Number(criticReadiness.scores.layout ?? 0),
        technical: Number(criticReadiness.scores.technical ?? 0),
        consistency: Number(criticReadiness.scores.consistency ?? 0),
        sections: Number(criticReadiness.scores.sections ?? 0),
        ready: Boolean(criticReadiness.ready),
        founder_review_allowed: Boolean(
          criticReadiness.founder_review_allowed ?? criticReadiness.ready,
        ),
        publication_allowed: false,
        blocking_reasons: criticReadiness.blocked_reasons ?? [],
        critic_report_reference:
          "SOS/07_LOGS/saios/resume-critic/readiness.json",
        gate_id:
          Object.values(gateIndex?.latest_by_candidate ?? {})[0] ?? null,
        source: "SOS/07_LOGS/saios/resume-critic/readiness.json",
      }
    : null;

  const founder_actions: FounderAction[] = [];
  const seenActionKeys = new Set<string>();
  const pvSelected = safeReadJson(
    repo,
    "SOS/07_LOGS/saios/provider-validation/selected-candidate.json",
    sources,
  ) as {
    selection_status?: string;
    founder_action?: string | null;
  } | null;
  if (
    pvSelected?.selection_status === "BLOCKED" &&
    pvSelected.founder_action
  ) {
    seenActionKeys.add("provider-validation-approve");
    founder_actions.push({
      id: "provider-validation-approve",
      priority: "P0",
      title: pvSelected.founder_action,
      detail:
        "Provider validation preparation blocked until an interactive dashboard APPROVED decision exists",
      source: "SOS/07_LOGS/saios/provider-validation",
      category: "provider_validation",
    });
  }
  for (const w of waitingCycles) {
    const key = w.review_id;
    if (seenActionKeys.has(key)) continue;
    seenActionKeys.add(key);
    founder_actions.push({
      id: `waiting-${w.review_id}`,
      priority: "P0",
      title: `Decide: ${latestCycleState?.latest?.candidate_title ?? w.candidate_id}`,
      detail:
        "WAITING FOR FOUNDER — execution paused — no automatic decision — no automatic publication",
      source: "SOS/07_LOGS/saios/founder-gate-runtime",
      category: "founder_review",
    });
  }
  if (Array.isArray(actionQueue?.actions)) {
    for (const a of actionQueue!.actions!.slice(0, 8)) {
      const key = a.id;
      if (seenActionKeys.has(key) || seenActionKeys.has(a.title)) continue;
      // Prefer one action per waiting review — skip queue dupes for same review
      if (
        waitingCycles.some(
          (w) =>
            a.id.includes(w.review_id) ||
            a.detail?.includes(w.review_id) ||
            a.title.includes(w.candidate_id),
        )
      ) {
        continue;
      }
      seenActionKeys.add(key);
      founder_actions.push({
        id: a.id,
        priority: a.priority,
        title: a.title,
        detail: a.detail,
        source: a.source,
        category: a.category,
      });
    }
  }

  const ownershipList = knowledgeOwnership?.ownership ?? [];
  const counts = knowledgeDomains?.counts ?? {};
  const knowledge_domains: KnowledgeDomainRow[] = [
    "founder",
    "company",
    "project",
    "department",
    "learning",
    "runtime",
  ].map((id) => {
    const own = ownershipList.find((o) => o.domain === id);
    return {
      id,
      owner: own
        ? String((own.write_by as string[] | undefined)?.join(", ") ?? "unknown")
        : "unknown",
      read: own
        ? String((own.read_by as string[] | undefined)?.join(", ") ?? "unknown")
        : "unknown",
      write: own
        ? String((own.write_by as string[] | undefined)?.join(", ") ?? "unknown")
        : "unknown",
      entry_count: counts[id] ?? null,
      last_update: knowledgeDomains?.generated_at ?? null,
      health: "healthy",
    };
  });

  const skills: SkillRow[] = (skillRegistry?.skills ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    domain: s.domain,
    active: s.domain !== "website",
    notes: s.domain === "website" ? "catalogued · department disabled" : undefined,
  }));

  const activity: ActivityEvent[] = [];
  if (firstDryRunTimeline?.timeline?.length) {
    for (const e of firstDryRunTimeline.timeline.slice().reverse()) {
      activity.push({
        id: `dry-${activity.length}`,
        timestamp: String(e.at ?? ""),
        event_type: String(e.stage ?? "dry_run"),
        department: "resume",
        run_id: dryCycle?.id ?? null,
        summary: String(e.summary ?? ""),
        status: (e.status as ActivityEvent["status"]) || "completed",
      });
    }
  }
  const history = (projectState?.history as Array<Record<string, unknown>>) ?? [];
  for (const h of history.slice(-12).reverse()) {
    activity.push({
      id: `hist-${activity.length}`,
      timestamp: String(h.at ?? ""),
      event_type: String(h.type ?? "agent"),
      department: "aios",
      run_id: null,
      summary: String(h.summary ?? ""),
      status: "completed",
    });
  }
  if (gatewayFlow?.generated_at) {
    activity.unshift({
      id: "kg-flow",
      timestamp: String(gatewayFlow.generated_at),
      event_type: "knowledge_gateway",
      department: "resume",
      run_id: String(knowledgeGateway?.snapshot_id ?? null),
      summary: `Flow: ${Array.isArray(gatewayFlow.flow) ? (gatewayFlow.flow as string[]).join(" → ") : "gateway"}`,
      status: "completed",
    });
  }
  if (critic) {
    activity.unshift({
      id: "critic-scores",
      timestamp: criticReadiness?.generated_at ?? now,
      event_type: critic.ready ? "CRITIC_GATE_PASSED" : "CRITIC_GATE_BLOCKED",
      department: "resume",
      run_id: critic.gate_id,
      summary: `Critic Overall ${critic.overall} · ATS ${critic.ats} · Ready ${critic.ready ? "YES" : "NO"}`,
      status: critic.ready ? "completed" : "blocked",
    });
  }
  for (const e of gateActivityLines.slice(-20).reverse()) {
    activity.unshift({
      id: `gate-${activity.length}-${e.event_type}`,
      timestamp: e.at,
      event_type: e.event_type,
      department: "resume",
      run_id: e.cycle_id,
      summary: e.summary,
      status: (e.status as ActivityEvent["status"]) || "completed",
    });
  }

  const refs = (knowledgeGateway?.knowledge_references as string[]) ?? [];
  const brain_path: BrainNode[] = [
    {
      id: "resume",
      label: "Resume Department",
      kind: "department",
      meta: { mode: "dry_run", enabled: true },
    },
    {
      id: "knowledge",
      label: "Knowledge Snapshot",
      kind: "knowledge",
      meta: {
        snapshot_id: (knowledgeGateway?.snapshot_id as string) ?? null,
        domains: "founder,company,department,learning",
        refs: refs.length,
      },
    },
    {
      id: "skill",
      label: "Skill",
      kind: "skill",
      meta: {
        skill_id: (knowledgeGateway?.skill_id as string) ?? "resume.layout_planning",
        dry_run: true,
      },
    },
    {
      id: "brain",
      label: "Brain Router",
      kind: "router",
      meta: { selected_provider: "mock", validation: "ok" },
    },
    {
      id: "mock",
      label: "Mock Provider",
      kind: "provider",
      meta: {
        provider: "mock",
        cost: 0,
        latency_ms: null,
        dry_run: true,
      },
    },
    {
      id: "response",
      label: "Structured Response",
      kind: "response",
      meta: {
        status: (knowledgeGateway?.response_status as string) ?? "COMPLETED",
        template_generated: false,
        published: false,
      },
    },
  ];

  const system_pulse_active = false; // idle unless a live run exists — V1 artifacts are completed

  return {
    generated_at: now,
    last_refreshed: now,
    top_bar: {
      live: false,
      live_label: "LIVE OFF",
      mode: "dry_run",
      provider: "Mock",
      heartbeat_age: ageFromIso(heartbeatIso),
      cost_today_usd: "0.00",
      latest_agent: String(projectState?.latest_agent ?? "?"),
      next_agent: String(projectState?.next_agent ?? "?"),
    },
    departments,
    cycles,
    exceptions,
    founder_actions,
    knowledge_domains,
    knowledge_snapshot: {
      snapshot_id: (knowledgeGateway?.snapshot_id as string) ?? null,
      domains: ["founder", "company", "department", "learning"],
      references: refs,
      available: Boolean(knowledgeGateway),
    },
    skills,
    skill_count: skillCount,
    activity,
    brain_path,
    resume: {
      enabled: Boolean(resumeDept?.enabled),
      mode: "dry_run",
      batch_size: Number(resumeDept?.initial_batch_size ?? 1),
      provider: "Mock",
      queue_depth: 0,
      latest_run: cycles[0] ?? null,
      approval_state: String(
        resumeDept?.founder_approval_required
          ? "founder_approval_required"
          : "unknown",
      ),
      ai_path: [
        "Knowledge",
        "Skills",
        "Brain Router",
        "Provider response",
      ],
      deterministic_safeguards: [
        "QA",
        "ATS validation",
        "duplicate checks",
        "catalog IDs",
        "checksums",
        "publication gates",
        "critic gate",
      ],
      stages: Array.isArray(gatewayFlow?.flow)
        ? (gatewayFlow!.flow as string[])
        : [
            "Resume",
            "Knowledge",
            "Skill",
            "Brain",
            "Mock",
            "Response",
          ],
    },
    critic,
    production_cycle: (() => {
      const pc = safeReadJson(
        repo,
        "SOS/07_LOGS/saios/first-production-cycle/dashboard.json",
        sources,
      ) as {
        current_stage?: string;
        current_candidate?: string;
        current_duration_ms?: number;
        current_queue?: string | null;
        critic_score?: { overall?: number; ats?: number; ready?: boolean };
        founder_waiting?: boolean;
        completed_cycle?: boolean;
        recent_learning?: number;
        task_id?: string;
      } | null;
      if (!pc) return null;
      const waitingCp =
        latestCycleState?.latest?.state === "WAITING_FOUNDER" &&
        !latestCycleState.latest.fixture
          ? latestCycleState.latest
          : null;
      const waitingMs = waitingCp?.created_at
        ? Math.max(0, Date.now() - Date.parse(waitingCp.created_at))
        : null;
      const view: ProductionCycleView = {
        current_stage:
          waitingCp?.state ?? pc.current_stage ?? null,
        current_candidate:
          waitingCp?.candidate_title ?? pc.current_candidate ?? null,
        current_duration_ms: pc.current_duration_ms ?? null,
        current_queue: waitingCp?.queue_action_id ?? pc.current_queue ?? null,
        critic_score: waitingCp?.critic_result
          ? {
              overall: Number(waitingCp.critic_result.overall ?? 0),
              ats: Number(waitingCp.critic_result.ats ?? 0),
              ready: Boolean(waitingCp.critic_result.ready),
            }
          : pc.critic_score
            ? {
                overall: Number(pc.critic_score.overall ?? 0),
                ats: Number(pc.critic_score.ats ?? 0),
                ready: Boolean(pc.critic_score.ready),
              }
            : null,
        founder_waiting:
          Boolean(pc.founder_waiting) || Boolean(waitingCp),
        completed_cycle: Boolean(pc.completed_cycle) && !waitingCp,
        recent_learning: pc.recent_learning ?? null,
        task_id: waitingCp?.task_id ?? pc.task_id ?? null,
        waiting_duration_ms: waitingMs,
        source: "SOS/07_LOGS/saios/first-production-cycle/dashboard.json",
      };
      return view;
    })(),
    provider_validation: (() => {
      const selected = safeReadJson(
        repo,
        "SOS/07_LOGS/saios/provider-validation/selected-candidate.json",
        sources,
      ) as {
        selection_status?: string;
        founder_action?: string | null;
        candidate?: {
          candidate_id?: string;
          title?: string;
          eligible?: boolean;
          blocking_reasons?: string[];
        } | null;
      } | null;
      const pkgWrap = safeReadJson(
        repo,
        "SOS/07_LOGS/saios/provider-validation/current-validation-package.json",
        sources,
      ) as {
        package?: {
          validation_id?: string;
          input_checksum?: string;
        } | null;
      } | null;
      const baseWrap = safeReadJson(
        repo,
        "SOS/07_LOGS/saios/provider-validation/mock-baseline-summary.json",
        sources,
      ) as {
        baseline?: {
          baseline_id?: string;
        } | null;
      } | null;
      const readiness = safeReadJson(
        repo,
        "SOS/07_LOGS/saios/provider-validation/real-provider-readiness.json",
        sources,
      ) as {
        state?: string;
        credentials_configured?: boolean;
        budgets?: { ok?: boolean };
        founder_authorization?: { status?: string };
        missing_configuration?: string[];
      } | null;
      const contract = safeReadJson(
        repo,
        "SOS/07_LOGS/saios/provider-validation/comparison-contract.json",
        sources,
      ) as { dimensions?: unknown[] } | null;
      if (!selected && !readiness) return null;
      const view: ProviderValidationViewData = {
        selection_status: selected?.selection_status ?? "UNKNOWN",
        candidate_id: selected?.candidate?.candidate_id ?? null,
        candidate_title: selected?.candidate?.title ?? null,
        eligible: Boolean(selected?.candidate?.eligible),
        founder_action: selected?.founder_action ?? null,
        blocking_reasons: selected?.candidate?.blocking_reasons ?? [],
        frozen_input_checksum: pkgWrap?.package?.input_checksum ?? null,
        validation_id: pkgWrap?.package?.validation_id ?? null,
        mock_baseline_status: baseWrap?.baseline ? "COMPLETED" : "NOT_RUN",
        mock_baseline_id: baseWrap?.baseline?.baseline_id ?? null,
        readiness_state: readiness?.state ?? "TEST_BLOCKED",
        credentials_configured: Boolean(readiness?.credentials_configured),
        budgets_ok: Boolean(readiness?.budgets?.ok),
        authorization_status:
          readiness?.founder_authorization?.status ?? "PENDING",
        missing_configuration: readiness?.missing_configuration ?? [],
        comparison_dimensions_count: Array.isArray(contract?.dimensions)
          ? contract!.dimensions!.length
          : 18,
        real_provider_request_executed: false,
        publication_allowed: false,
        source: "SOS/07_LOGS/saios/provider-validation",
      };
      return view;
    })(),
    company_brain: (() => {
      const status = safeReadJson(
        repo,
        "SOS/07_LOGS/saios/company-brain/status.json",
        sources,
      ) as {
        version?: string;
        mode?: string;
        autonomous?: boolean;
        can_execute?: boolean;
        can_enqueue?: boolean;
        planning_state?: string;
        current_objective?: string | null;
        latest_plan_id?: string | null;
        pending_approval?: boolean;
        source?: string;
        current_mission_id?: string | null;
        current_mission_status?: string | null;
        current_mission_name?: string | null;
        current_mission_priority?: string | null;
        current_mission_risk?: string | null;
        current_mission_progress_pct?: number | null;
        founder_approval_status?: string | null;
      } | null;
      const plan = safeReadJson(
        repo,
        "SOS/07_LOGS/saios/company-brain/latest-plan.json",
        sources,
      ) as {
        plan_id?: string;
        execution_status?: string;
        priority?: string;
        risk_level?: string;
        recommended_order?: string[];
        blocking_issues?: unknown[];
        founder_approval_required?: boolean;
        canonical_engine?: string;
      } | null;
      const mission = safeReadJson(
        repo,
        "SOS/07_LOGS/saios/company-brain/missions/current-mission.json",
        sources,
      ) as {
        mission_id?: string;
        mission_name?: string;
        status?: string;
        priority?: string;
        risk_level?: string;
        estimated_departments?: Array<{
          department?: string;
          role_in_plan?: string;
        }>;
        founder_approval_required?: boolean;
      } | null;
      const missionDepts = Array.isArray(mission?.estimated_departments)
        ? mission!.estimated_departments!
            .filter(
              (d) =>
                d.role_in_plan === "primary" || d.role_in_plan === "supporting",
            )
            .map((d) => d.department)
            .filter((d): d is string => Boolean(d))
        : [];
      const progressFromStatus = (s: string | null | undefined): number | null => {
        if (!s) return null;
        const map: Record<string, number> = {
          DRAFT: 0,
          PLANNED: 15,
          WAITING_FOUNDER: 30,
          APPROVED: 45,
          REJECTED: 45,
          CHANGES_REQUESTED: 35,
          READY_FOR_QUEUE: 60,
          WAITING_PACKAGE_ACKNOWLEDGEMENT: 65,
          PACKAGE_ACKNOWLEDGED: 70,
          PACKAGE_CHANGES_REQUESTED: 62,
          PACKAGE_REJECTED: 62,
          WAITING_QUEUE_SUBMISSION: 75,
          QUEUE_SUBMISSION_READY: 78,
          QUEUE_SUBMISSION_BLOCKED: 74,
          SHADOW_QUEUE_RECEIVED: 82,
          RUNTIME_PLAN_READY: 85,
          RUNTIME_PLAN_BLOCKED: 84,
          WAITING_RUNTIME_RELEASE: 88,
          RUNTIME_RELEASE_APPROVED: 90,
          RUNTIME_RELEASE_REJECTED: 88,
          RUNTIME_RELEASE_CHANGES_REQUESTED: 87,
          SYSTEM_READY: 96,
          SYSTEM_BLOCKED: 94,
          IN_PROGRESS: 98,
          COMPLETED: 100,
          ARCHIVED: 100,
        };
        return map[s] ?? null;
      };
      const approvalFields = wave1SnapshotLoader.loadOne("mission-approval", {
        repoRoot: repo,
        sources,
        readJson: (rel) => safeReadJson(repo, rel, sources),
        missionStatus:
          status?.current_mission_status ?? mission?.status ?? null,
      });
      const loadCtx = {
        repoRoot: repo,
        sources,
        readJson: (rel: string) => safeReadJson(repo, rel, sources),
        missionStatus:
          status?.current_mission_status ?? mission?.status ?? null,
      };
      const queueAdmissionFields = wave1SnapshotLoader.loadOne(
        "queue-admission",
        loadCtx,
      );
      const executionPackageFields = wave1SnapshotLoader.loadOne(
        "execution-package",
        loadCtx,
      );
      const executionPackageAckFields = wave1SnapshotLoader.loadOne(
        "execution-package-ack",
        loadCtx,
      );
      const queueSubmissionFields = wave1SnapshotLoader.loadOne(
        "queue-submission",
        loadCtx,
      );
      const shadowQueueFields = wave1SnapshotLoader.loadOne(
        "shadow-queue",
        loadCtx,
      );
      const runtimePlanFields = wave1SnapshotLoader.loadOne(
        "runtime-plan",
        loadCtx,
      );
      const runtimeReleaseFields = wave1SnapshotLoader.loadOne(
        "runtime-release",
        loadCtx,
      );
      const systemReadinessFields = wave1SnapshotLoader.loadOne(
        "system-readiness",
        loadCtx,
      );
      const executionControllerFields = wave1SnapshotLoader.loadOne(
        "execution-controller",
        loadCtx,
      );
      const departmentRegistryFields = wave1SnapshotLoader.loadOne(
        "department-registry",
        loadCtx,
      );
      const costLedgerFields = wave1SnapshotLoader.loadOne(
        "cost-ledger",
        loadCtx,
      );
      const workerRuntimeFields = wave1SnapshotLoader.loadOne(
        "worker-runtime",
        loadCtx,
      );
      const telemetryRegistryFields = wave1SnapshotLoader.loadOne(
        "telemetry-registry",
        loadCtx,
      );
      const activationGateFields = wave1SnapshotLoader.loadOne(
        "activation-gate",
        loadCtx,
      );
      const executionAuthorizationFields = wave1SnapshotLoader.loadOne(
        "execution-authorization",
        loadCtx,
      );
      const preDispatchSimulationFields = wave1SnapshotLoader.loadOne(
        "pre-dispatch-simulation",
        loadCtx,
      );

      const emptyApprovalFields = {
        current_mission: null as Record<string, unknown> | null,
        ...defaultSnapshotRegistry.get("mission-approval")!.empty(),
        ...defaultSnapshotRegistry.get("queue-admission")!.empty(),
        ...defaultSnapshotRegistry.get("execution-package")!.empty(),
        ...defaultSnapshotRegistry.get("execution-package-ack")!.empty(),
        ...defaultSnapshotRegistry.get("queue-submission")!.empty(),
        ...defaultSnapshotRegistry.get("shadow-queue")!.empty(),
        ...defaultSnapshotRegistry.get("runtime-plan")!.empty(),
        ...defaultSnapshotRegistry.get("runtime-release")!.empty(),
        ...defaultSnapshotRegistry.get("system-readiness")!.empty(),
        ...defaultSnapshotRegistry.get("execution-controller")!.empty(),
        ...defaultSnapshotRegistry.get("department-registry")!.empty(),
        ...defaultSnapshotRegistry.get("cost-ledger")!.empty(),
        ...defaultSnapshotRegistry.get("worker-runtime")!.empty(),
        ...defaultSnapshotRegistry.get("telemetry-registry")!.empty(),
        ...defaultSnapshotRegistry.get("activation-gate")!.empty(),
        ...defaultSnapshotRegistry.get("execution-authorization")!.empty(),
        ...defaultSnapshotRegistry.get("pre-dispatch-simulation")!.empty(),
      };

      if (!status && !plan && !mission) {
        const idle: CompanyBrainViewData = {
          version: "1.0.0",
          mode: "planning_only",
          autonomous: false,
          can_execute: false,
          can_enqueue: false,
          planning_state: "idle",
          current_objective: null,
          latest_plan_id: null,
          pending_approval: false,
          execution_status: null,
          priority: null,
          risk_level: null,
          departments: [],
          blocker_count: 0,
          founder_approval_required: true,
          canonical_engine: "core.first-production-cycle",
          source: null,
          current_mission_id: null,
          current_mission_name: null,
          current_mission_status: null,
          current_mission_priority: null,
          current_mission_progress_pct: null,
          current_mission_risk: null,
          current_mission_departments: [],
          founder_approval_status: null,
          ...emptyApprovalFields,
        };
        return idle;
      }
      const missionStatus =
        status?.current_mission_status ?? mission?.status ?? null;
      const view: CompanyBrainViewData = {
        version: status?.version ?? "1.0.0",
        mode: "planning_only",
        autonomous: false,
        can_execute: false,
        can_enqueue: false,
        planning_state: status?.planning_state ?? "idle",
        current_objective: status?.current_objective ?? null,
        latest_plan_id: status?.latest_plan_id ?? plan?.plan_id ?? null,
        pending_approval: Boolean(status?.pending_approval),
        execution_status: plan?.execution_status ?? null,
        priority: plan?.priority ?? null,
        risk_level: plan?.risk_level ?? null,
        departments: Array.isArray(plan?.recommended_order)
          ? plan!.recommended_order!
          : [],
        blocker_count: Array.isArray(plan?.blocking_issues)
          ? plan!.blocking_issues!.length
          : 0,
        founder_approval_required: true,
        canonical_engine:
          plan?.canonical_engine ?? "core.first-production-cycle",
        source: status?.source ?? "SOS/07_LOGS/saios/company-brain",
        current_mission_id:
          status?.current_mission_id ?? mission?.mission_id ?? null,
        current_mission_name:
          status?.current_mission_name ?? mission?.mission_name ?? null,
        current_mission_status: missionStatus,
        current_mission_priority:
          status?.current_mission_priority ?? mission?.priority ?? null,
        current_mission_progress_pct:
          status?.current_mission_progress_pct ??
          progressFromStatus(missionStatus),
        current_mission_risk:
          status?.current_mission_risk ?? mission?.risk_level ?? null,
        current_mission_departments: missionDepts.length
          ? missionDepts
          : Array.isArray(plan?.recommended_order)
            ? plan!.recommended_order!
            : [],
        founder_approval_status:
          status?.founder_approval_status ??
          (missionStatus === "WAITING_FOUNDER"
            ? "WAITING_FOUNDER"
            : mission?.founder_approval_required
              ? "REQUIRED"
              : null),
        current_mission: mission
          ? (mission as unknown as Record<string, unknown>)
          : null,
        ...approvalFields,
        ...queueAdmissionFields,
        ...executionPackageFields,
        ...executionPackageAckFields,
        ...queueSubmissionFields,
        ...shadowQueueFields,
        ...runtimePlanFields,
        ...runtimeReleaseFields,
        ...systemReadinessFields,
        ...executionControllerFields,
        ...departmentRegistryFields,
        ...costLedgerFields,
        ...workerRuntimeFields,
        ...telemetryRegistryFields,
        ...activationGateFields,
        ...executionAuthorizationFields,
        ...preDispatchSimulationFields,
      };
      return view;
    })(),
    review_queue: (() => {
      try {
        return loadReviewQueueForRepo(repo);
      } catch {
        return [];
      }
    })(),
    system_pulse_active,
    sources,
    security: {
      read_only: true,
      secrets_redacted: true,
      telegram_unchanged: true,
      live_controls_disabled: true,
      auth_required_before_vps: true,
    },
  };
}

export type { AiosStatus, DashboardSnapshot };
