/**
 * PlanningEngine — single planning authority for Company Brain V1.
 * Never executes, enqueues, renders, publishes, or calls providers/models/Cursor.
 */
import { randomUUID } from "node:crypto";
import type {
  CompanyExecutionPlan,
  DepartmentId,
  DepartmentPlanRole,
  PlanDependency,
  PlanPriority,
  PlanRiskLevel,
  PlanningInput,
  RequiredWorker,
} from "./types.js";
import {
  detectBlockers,
  readSystemState,
  type SystemStateSnapshot,
} from "./SystemStateReader.js";
import { PlanRepository, resolveRepoRoot } from "./PlanRepository.js";

function inferPriority(objective: string, blockers: { severity: string }[]): PlanPriority {
  const o = objective.toLowerCase();
  if (blockers.some((b) => b.severity === "blocker")) return "P0";
  if (/urgent|critical|p0|asap/.test(o)) return "P0";
  if (/batch|publish|release/.test(o)) return "P1";
  if (/improve|optimize|seo|marketing/.test(o)) return "P2";
  return "P2";
}

function inferDepartments(
  objective: string,
  state: SystemStateSnapshot,
): { involved: DepartmentPlanRole[]; order: DepartmentId[] } {
  const o = objective.toLowerCase();
  const byId = new Map(state.departments.map((d) => [d.id, d]));

  const wants = (id: DepartmentId, keywords: RegExp): boolean => keywords.test(o);

  const selected: DepartmentId[] = [];
  if (
    wants("resume", /resume|template|ats|designbrief|critic|portfolio/) ||
    !/website|seo|marketing|invoice|finance|support|publish/.test(o)
  ) {
    selected.push("resume");
  }
  if (wants("website", /website|site|landing|web\b/)) selected.push("website");
  if (wants("seo", /seo|search\s*engine|serp/)) selected.push("seo");
  if (wants("marketing", /marketing|campaign|growth/)) selected.push("marketing");
  if (wants("publisher", /publish|catalog|release|manifest/)) selected.push("publisher");
  if (wants("finance", /finance|invoice|billing|cost/)) selected.push("finance");
  if (wants("support", /support|ticket|customer\s*care/)) selected.push("support");

  if (selected.length === 0) selected.push("resume");

  const involved: DepartmentPlanRole[] = selected.map((id, idx) => {
    const d = byId.get(id)!;
    let role: DepartmentPlanRole["role_in_plan"] = idx === 0 ? "primary" : "supporting";
    if (!d.enabled) role = d.informational_only ? "informational" : "blocked";
    return {
      department: id,
      label: d.label,
      enabled: d.enabled,
      role_in_plan: role,
      notes: d.enabled
        ? "Eligible for planning (execution still requires founder approval + canonical engine)."
        : "Disabled — informational only. No execution path in V1.",
    };
  });

  // Add informational disabled departments mentioned but not primary
  for (const d of state.departments) {
    if (involved.some((x) => x.department === d.id)) continue;
    if (!d.enabled) {
      involved.push({
        department: d.id,
        label: d.label,
        enabled: false,
        role_in_plan: "informational",
        notes: "Catalogued for multi-department roadmap — not part of this plan's execution scope.",
      });
    }
  }

  const order = involved
    .filter((d) => d.role_in_plan === "primary" || d.role_in_plan === "supporting")
    .filter((d) => d.enabled)
    .map((d) => d.department);

  return { involved, order: order.length ? order : ["resume"] };
}

function workersFor(order: DepartmentId[]): RequiredWorker[] {
  const workers: RequiredWorker[] = [];
  if (order.includes("resume")) {
    workers.push(
      {
        worker_type: "designbrief",
        capability: "resume.spec",
        department: "resume",
        count: 1,
        notes: "DesignBrief Engine (canonical)",
      },
      {
        worker_type: "resume-renderer",
        capability: "resume.render",
        department: "resume",
        count: 1,
        notes: "Resume Renderer (canonical)",
      },
      {
        worker_type: "resume-critic",
        capability: "resume.evaluate",
        department: "resume",
        count: 1,
        notes: "Resume Critic + Critic Gate (canonical)",
      },
    );
  }
  if (order.includes("website") || order.includes("seo")) {
    workers.push({
      worker_type: "website-department",
      capability: "website.plan",
      department: order.includes("website") ? "website" : "seo",
      count: 0,
      notes: "Department disabled — worker listed for planning completeness only",
    });
  }
  return workers;
}

function dependencies(
  state: SystemStateSnapshot,
  order: DepartmentId[],
): PlanDependency[] {
  return [
    {
      id: "dep-canonical-engine",
      kind: "module",
      description: "Canonical execution spine core/first-production-cycle",
      satisfied: true,
    },
    {
      id: "dep-knowledge",
      kind: "artifact",
      description: "Knowledge snapshot available",
      satisfied: state.knowledge.available,
    },
    {
      id: "dep-founder-approval",
      kind: "approval",
      description: "Founder approval required before any execution",
      satisfied: false,
    },
    {
      id: "dep-queue",
      kind: "queue",
      description: "Queue substrate (V1 does not enqueue)",
      satisfied: state.queue.available,
    },
    {
      id: "dep-provider-validation",
      kind: "provider",
      description: "Provider Validation gate (Mock-only until cleared)",
      satisfied: true, // dry-run Mock path is always the V1 planning assumption
    },
    {
      id: "dep-resume-dept",
      kind: "department",
      description: "Resume Department enabled",
      satisfied: state.enablement.resume_enabled && order.includes("resume")
        ? true
        : !order.includes("resume"),
    },
  ];
}

function riskLevel(
  blockers: { severity: string }[],
  waiting: number,
): PlanRiskLevel {
  if (blockers.some((b) => b.severity === "blocker")) return "high";
  if (waiting > 0) return "high";
  if (blockers.length >= 3) return "medium";
  if (blockers.length > 0) return "medium";
  return "low";
}

export class PlanningEngine {
  readonly repo: PlanRepository;

  constructor(repoRoot?: string) {
    this.repo = new PlanRepository(repoRoot ?? resolveRepoRoot());
  }

  plan(input: PlanningInput): CompanyExecutionPlan {
    if (process.env.SOS_AIOS_LIVE === "1") {
      throw new Error("Company Brain PlanningEngine refuses SOS_AIOS_LIVE=1");
    }

    const objective = input.founder_objective.trim();
    if (!objective) {
      throw new Error("Founder objective is required");
    }

    const state = readSystemState(this.repo.root);
    const blockers = detectBlockers(state);
    const { involved, order } = inferDepartments(objective, state);

    // Objective naming disabled departments as primary → blocker
    for (const d of involved) {
      if (
        (d.role_in_plan === "primary" || d.role_in_plan === "supporting") &&
        !d.enabled
      ) {
        blockers.push({
          id: `blk-dept-${d.department}`,
          severity: "blocker",
          code: "DEPARTMENT_DISABLED",
          message: `${d.label} is required by the objective but is disabled`,
          source: "SOS/SAIOS/infra/department-enablement.json",
        });
        d.role_in_plan = "blocked";
      }
    }

    const hasHardBlock = blockers.some((b) => b.severity === "blocker");
    const priority = inferPriority(objective, blockers);
    const required_workers = workersFor(order);
    const estimated_dependencies = dependencies(state, order);
    const risk_level = riskLevel(blockers, state.waiting_founder_cycles);

    const plan_id = `cb-plan-${randomUUID().slice(0, 8)}`;
    const mission_id = `mission-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 6)}`;

    const plan: CompanyExecutionPlan = {
      schema_version: "company-brain-plan-1.0.0",
      mission_id,
      plan_id,
      objective,
      priority,
      departments_involved: involved,
      recommended_order: order,
      required_workers,
      estimated_dependencies,
      blocking_issues: blockers,
      risk_level,
      founder_approval_required: true,
      execution_status: hasHardBlock ? "BLOCKED" : "PLANNED",
      execution_allowed: false,
      queue_enqueue_allowed: false,
      canonical_engine: "core.first-production-cycle",
      created_at: new Date().toISOString(),
      planning_notes: [
        "Company Brain V1 is planning-only.",
        "This plan must not be executed automatically.",
        "Founder approval is mandatory before any future execution agent may proceed.",
        "Canonical engine remains core/first-production-cycle under runtime freeze.",
        "ExecutiveOrchestrator is not replaced — Company Brain does not enqueue jobs.",
        ...(input.fixture ? ["fixture: true — verify artifact"] : []),
      ],
      inputs_used: {
        founder_objective: objective,
        dashboard_snapshot_available: true,
        knowledge_available: state.knowledge.available,
        queue_summary_available: state.queue.available,
        provider_validation_status: state.provider_validation.status,
        pending_founder_reviews: state.pending_founder_reviews,
        runtime_health: state.runtime_health.label,
      },
    };

    return plan;
  }
}
