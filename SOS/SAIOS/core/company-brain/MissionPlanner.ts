/**
 * MissionPlanner — builds Mission Contracts and derives ExecutionPlans (Agent #162).
 * Never executes, enqueues, or calls providers.
 */
import { randomUUID } from "node:crypto";
import { PlanningEngine } from "./PlanningEngine.js";
import { PlanRepository, resolveRepoRoot } from "./PlanRepository.js";
import { MissionRegistry } from "./MissionRegistry.js";
import { validateMissionContract } from "./MissionValidator.js";
import { detectBlockers, readSystemState } from "./SystemStateReader.js";
import type {
  CompanyExecutionPlan,
  DepartmentId,
  PlanRiskLevel,
} from "./types.js";
import type {
  MissionContract,
  MissionCreateInput,
  MissionCreateResult,
  MissionDependencyGraph,
  MissionSuccessKpi,
  MissionType,
} from "./mission-types.js";
import { MISSION_SCHEMA_VERSION } from "./mission-types.js";

function inferMissionType(objective: string): MissionType {
  const o = objective.toLowerCase();
  const hits: MissionType[] = [];
  if (/resume|template|ats|designbrief|critic/.test(o)) hits.push("resume_production");
  if (/website|site|landing/.test(o)) hits.push("website_improvement");
  if (/seo|serp|search\s*engine/.test(o)) hits.push("seo_campaign");
  if (/marketing|campaign|growth/.test(o)) hits.push("marketing");
  if (/publish|catalog|release|manifest/.test(o)) hits.push("publisher_ops");
  if (/finance|invoice|billing/.test(o)) hits.push("finance");
  if (/support|ticket|customer/.test(o)) hits.push("support");
  if (hits.length > 1) return "multi_department";
  return hits[0] ?? "general";
}

function inferName(objective: string, type: MissionType): string {
  const short = objective.trim().slice(0, 72);
  const prefix =
    type === "resume_production"
      ? "Resume"
      : type === "website_improvement"
        ? "Website"
        : type === "seo_campaign"
          ? "SEO"
          : type === "multi_department"
            ? "Multi-Dept"
            : "Mission";
  return `${prefix}: ${short}${objective.trim().length > 72 ? "…" : ""}`;
}

function buildKpis(
  type: MissionType,
  objective: string,
): MissionSuccessKpi[] {
  const kpis: MissionSuccessKpi[] = [
    {
      id: "kpi-founder-approval",
      label: "Founder approval obtained",
      target: "APPROVED",
      required: true,
    },
    {
      id: "kpi-no-auto-execute",
      label: "No autonomous execution occurred",
      target: "true",
      required: true,
    },
  ];
  if (type === "resume_production" || type === "multi_department" || type === "general") {
    kpis.push({
      id: "kpi-canonical-engine",
      label: "Uses canonical first-production-cycle when executed (future)",
      target: "core.first-production-cycle",
      required: true,
    });
    kpis.push({
      id: "kpi-critic-ready",
      label: "Critic Ready=YES before founder review (future execution)",
      target: "ready",
      required: false,
    });
  }
  if (type === "website_improvement" || type === "seo_campaign") {
    kpis.push({
      id: "kpi-dept-enabled",
      label: "Target department enabled before execution",
      target: "enabled",
      required: true,
    });
  }
  if (/batch|10|25|50|100/.test(objective)) {
    kpis.push({
      id: "kpi-batch-scope",
      label: "Batch scope documented in plan",
      target: "documented",
      required: false,
    });
  }
  return kpis;
}

function buildDependencyGraph(
  order: DepartmentId[],
  departments: MissionContract["estimated_departments"],
): MissionDependencyGraph {
  const enabled = order.filter((id) =>
    departments.some((d) => d.department === id && d.enabled),
  );
  const nodes = Array.from(
    new Set([
      ...enabled,
      ...departments.map((d) => d.department),
    ]),
  );

  const edges: MissionDependencyGraph["edges"] = [];
  for (let i = 0; i < enabled.length - 1; i++) {
    edges.push({
      id: `dep-seq-${enabled[i]}-${enabled[i + 1]}`,
      from: enabled[i],
      to: enabled[i + 1],
      kind: "sequential",
      description: `${enabled[i]} before ${enabled[i + 1]} (recommended order)`,
    });
  }

  // Publisher always after resume when both present (prerequisite, not executed)
  if (nodes.includes("resume") && nodes.includes("publisher")) {
    const exists = edges.some(
      (e) => e.from === "resume" && e.to === "publisher",
    );
    if (!exists) {
      edges.push({
        id: "dep-prereq-resume-publisher",
        from: "resume",
        to: "publisher",
        kind: "prerequisite",
        description: "Publisher Ops requires Resume outputs (planning only)",
      });
    }
  }

  // Parallel groups are recorded without directed edges (avoids false dependency loops).
  const parallel_groups: DepartmentId[][] = [];
  if (nodes.includes("website") && nodes.includes("seo")) {
    parallel_groups.push(["website", "seo"]);
    // Drop sequential edge between parallel peers if present
    const drop = edges.findIndex(
      (e) =>
        (e.from === "website" && e.to === "seo") ||
        (e.from === "seo" && e.to === "website"),
    );
    if (drop >= 0) edges.splice(drop, 1);
  }

  const blocking_departments = departments
    .filter((d) => d.role_in_plan === "blocked" || (!d.enabled && d.role_in_plan !== "informational"))
    .map((d) => d.department);

  const critical_path = enabled.length ? enabled : nodes.slice(0, 1);

  return {
    nodes,
    edges,
    critical_path,
    parallel_groups,
    blocking_departments,
    notes: [
      "Dependency graph is planning-only.",
      "No scheduling or execution is performed by MissionPlanner V1.",
    ],
  };
}

function estimateDuration(
  deptCount: number,
  risk: PlanRiskLevel,
): string {
  const base = Math.max(1, deptCount) * 30;
  const factor = risk === "critical" || risk === "high" ? 2 : risk === "medium" ? 1.5 : 1;
  const mins = Math.round(base * factor);
  if (mins < 60) return `~${mins}m (estimate only)`;
  return `~${(mins / 60).toFixed(1)}h (estimate only)`;
}

function tagsFor(type: MissionType, objective: string): string[] {
  const tags = ["company-brain", "mission-contract-v1", "planning-only", type];
  if (/dry.?run|mock/i.test(objective)) tags.push("dry_run");
  if (/ats/i.test(objective)) tags.push("ats");
  return Array.from(new Set(tags));
}

export class MissionPlanner {
  readonly engine: PlanningEngine;
  readonly planRepo: PlanRepository;
  readonly registry: MissionRegistry;

  constructor(repoRoot?: string) {
    const root = repoRoot ?? resolveRepoRoot();
    this.engine = new PlanningEngine(root);
    this.planRepo = new PlanRepository(root);
    this.registry = new MissionRegistry(root);
  }

  /**
   * Convert founder objective → Mission Contract + derived ExecutionPlan.
   * Does not enqueue or execute.
   */
  createMission(input: MissionCreateInput): MissionCreateResult {
    if (process.env.SOS_AIOS_LIVE === "1") {
      throw new Error("MissionPlanner refuses SOS_AIOS_LIVE=1");
    }

    const objective = input.founder_objective.trim();
    if (!objective) throw new Error("Founder objective is required");

    // Derive temporary execution plan first (provides departments/workers/blockers)
    const plan = this.engine.plan({
      founder_objective: objective,
      fixture: input.fixture,
    });

    const state = readSystemState(this.planRepo.root);
    const systemBlockers = detectBlockers(state);
    const type = inferMissionType(objective);
    const now = new Date().toISOString();
    const mission_id = `mission-${now.slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8)}`;

    const hardBlock = [...plan.blocking_issues, ...systemBlockers].some(
      (b) => b.severity === "blocker",
    );

    // V1 active statuses only
    let status: MissionContract["status"] = "PLANNED";
    if (input.await_founder || (!hardBlock && plan.founder_approval_required)) {
      status = "WAITING_FOUNDER";
    }
    // If hard-blocked, stay PLANNED with blockers (WAITING_FOUNDER still valid for approval UX)
    if (hardBlock && state.waiting_founder_cycles > 0) {
      status = "WAITING_FOUNDER";
    }

    const dependency_graph = buildDependencyGraph(
      plan.recommended_order,
      plan.departments_involved,
    );

    const mission: MissionContract = {
      schema_version: MISSION_SCHEMA_VERSION,
      mission_id,
      mission_version: 1,
      mission_name: input.mission_name?.trim() || inferName(objective, type),
      mission_type: type,
      founder_objective: objective,
      mission_description: `Company Brain Mission Contract for: ${objective}`,
      business_goal:
        type === "resume_production"
          ? "Produce founder-governed resume artifacts via the canonical dry-run engine when approved."
          : "Advance StudiosisLab departmental work under founder governance (planning only in V1).",
      priority: plan.priority,
      status,
      created_at: now,
      updated_at: now,
      owner: "company_brain",
      founder_approval_required: true,
      execution_allowed: false,
      queue_admission_allowed: false,
      publishing_allowed: false,
      learning_enabled: true,
      risk_level: plan.risk_level,
      estimated_duration: estimateDuration(
        plan.recommended_order.length,
        plan.risk_level,
      ),
      estimated_departments: plan.departments_involved,
      mission_tags: tagsFor(type, objective),
      success_kpis: buildKpis(type, objective),
      current_stage: status,
      dependency_graph,
      linked_plan_id: null,
      canonical_engine: "core.first-production-cycle",
      blocking_issues: plan.blocking_issues,
      planning_notes: [
        "Mission Contract is the canonical business object.",
        "ExecutionPlan is derived from this Mission and is temporary.",
        "V1 statuses: PLANNED | WAITING_FOUNDER only.",
        "Later lifecycle stages are placeholders — not activated.",
        "No Queue admission. No worker dispatch. No publishing.",
        ...(input.fixture ? ["fixture: true"] : []),
      ],
      supersedes_mission_id: null,
      fixture: input.fixture,
    };

    const validation = validateMissionContract(mission, {
      known_ids: this.registry.listKnownIds(),
      is_update: false,
    });

    // Link plan to mission (rewrite mission_id on plan)
    const linkedPlan: CompanyExecutionPlan = {
      ...plan,
      mission_id: mission.mission_id,
      planning_notes: [
        ...plan.planning_notes,
        `Derived from Mission Contract ${mission.mission_id}`,
      ],
    };

    mission.linked_plan_id = linkedPlan.plan_id;

    const artifact_paths: string[] = [];
    if (validation.ok) {
      artifact_paths.push(...this.registry.save(mission, { set_current: true }));
      // Fixture missions must not overwrite real plan/status snapshots
      if (!input.fixture) {
        const planning_state =
          mission.status === "WAITING_FOUNDER"
            ? ("awaiting_founder" as const)
            : hardBlock
              ? ("blocked" as const)
              : ("planned" as const);
        const progress =
          mission.status === "WAITING_FOUNDER"
            ? 30
            : mission.status === "PLANNED"
              ? 15
              : 0;
        artifact_paths.push(
          ...this.planRepo.persist(linkedPlan, {
            module: "company-brain",
            version: "1.0.0",
            mode: "planning_only",
            autonomous: false,
            can_execute: false,
            can_enqueue: false,
            can_call_providers: false,
            can_publish: false,
            planning_state,
            current_objective: mission.founder_objective,
            latest_plan_id: linkedPlan.plan_id,
            pending_approval:
              mission.status === "WAITING_FOUNDER" ||
              mission.status === "PLANNED",
            latest_plan: linkedPlan,
            generated_at: now,
            source: "SOS/07_LOGS/saios/company-brain/status.json",
            current_mission_id: mission.mission_id,
            current_mission_status: mission.status,
            current_mission_name: mission.mission_name,
            current_mission_priority: mission.priority,
            current_mission_risk: mission.risk_level,
            current_mission_progress_pct: progress,
            founder_approval_status:
              mission.status === "WAITING_FOUNDER"
                ? "WAITING_FOUNDER"
                : "REQUIRED",
          }),
        );
      }
    }

    return {
      overall: validation.ok ? "PASS" : "FAIL",
      mission,
      plan_id: validation.ok ? linkedPlan.plan_id : null,
      validation,
      artifact_paths,
    };
  }
}

export function createMissionPlanner(repoRoot?: string): MissionPlanner {
  return new MissionPlanner(repoRoot);
}
