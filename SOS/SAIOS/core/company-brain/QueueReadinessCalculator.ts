/**
 * QueueReadinessCalculator — evaluate only (Agent #164).
 * Never mutates runtime. Never calls providers.
 */
import { randomUUID } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { MissionContract } from "./mission-types.js";
import { readSystemState } from "./SystemStateReader.js";
import { MissionRegistry } from "./MissionRegistry.js";
import type {
  QueueReadinessIssue,
  QueueReadinessReport,
  ReadinessCategoryScore,
} from "./queue-admission-types.js";
import {
  QUEUE_ADMISSION_SCHEMA_VERSION,
  READINESS_WEIGHTS,
  READY_SCORE_THRESHOLD,
} from "./queue-admission-types.js";

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export class QueueReadinessCalculator {
  constructor(private readonly repoRoot: string) {}

  calculate(
    mission: MissionContract,
    opts?: { fixture?: boolean },
  ): QueueReadinessReport {
    const state = readSystemState(this.repoRoot);
    const registry = new MissionRegistry(this.repoRoot);
    const all = registry.listAll(true).filter((m) =>
      opts?.fixture ? Boolean(m.fixture) : !m.fixture,
    );

    const issues: QueueReadinessIssue[] = [];
    const warnings: string[] = [];
    const risks: string[] = [];

    // --- Mission ---
    let missionScore = 100;
    const missionNotes: string[] = [];
    if (
      mission.status !== "APPROVED" &&
      mission.status !== "WAITING_QUEUE_REVIEW" &&
      mission.status !== "READY_FOR_QUEUE" &&
      mission.status !== "QUEUE_BLOCKED"
    ) {
      missionScore = 20;
      issues.push({
        id: "iss-mission-not-approved",
        severity: "blocker",
        code: "MISSION_NOT_APPROVED",
        message: `Mission status is ${mission.status}; queue review requires APPROVED+`,
        category: "mission",
      });
    } else {
      missionNotes.push(`Mission ${mission.status}`);
    }
    if (!mission.success_kpis?.length) {
      missionScore -= 20;
      issues.push({
        id: "iss-no-kpis",
        severity: "warning",
        code: "MISSING_KPIS",
        message: "Mission has no success KPIs",
        category: "mission",
      });
    }
    if (mission.execution_allowed !== false) {
      missionScore = 0;
      issues.push({
        id: "iss-exec-flag",
        severity: "blocker",
        code: "EXECUTION_FLAG_TRUE",
        message: "execution_allowed must remain false",
        category: "security",
      });
    }

    // --- Departments ---
    const primary = mission.estimated_departments.filter(
      (d) => d.role_in_plan === "primary" || d.role_in_plan === "supporting",
    );
    let deptScore = primary.length ? 100 : 0;
    const deptNotes: string[] = [];
    if (!primary.length) {
      issues.push({
        id: "iss-no-dept",
        severity: "blocker",
        code: "MISSING_DEPARTMENTS",
        message: "No primary/supporting departments",
        category: "departments",
      });
    }
    for (const d of primary) {
      const live = state.departments.find((x) => x.id === d.department);
      if (!d.enabled || !live?.enabled) {
        deptScore -= 25;
        deptNotes.push(`${d.department} disabled`);
        if (d.role_in_plan === "primary") {
          issues.push({
            id: `iss-dept-${d.department}`,
            severity: "blocker",
            code: "DEPARTMENT_DISABLED",
            message: `Primary department ${d.department} is disabled`,
            category: "departments",
          });
        } else {
          warnings.push(`Supporting department ${d.department} disabled`);
        }
      }
    }
    deptScore = clamp(deptScore);

    // --- Knowledge ---
    let knowledgeScore = state.knowledge.available ? 90 : 40;
    if (!state.knowledge.available) {
      issues.push({
        id: "iss-knowledge",
        severity: "warning",
        code: "KNOWLEDGE_UNAVAILABLE",
        message: "Knowledge snapshot not available",
        category: "knowledge",
      });
    }

    // --- Skills ---
    const skillsDir = join(this.repoRoot, "SOS/SAIOS/skills");
    let skillCount = 0;
    if (existsSync(skillsDir)) {
      try {
        skillCount = readdirSync(skillsDir, { withFileTypes: true }).filter(
          (d) => d.isDirectory() || d.name.endsWith(".md"),
        ).length;
      } catch {
        skillCount = 0;
      }
    }
    const skillsScore = skillCount > 0 ? 85 : 45;
    const skillsList =
      skillCount > 0
        ? ["resume.layout_planning", "resume.critic", "company-brain.planning"]
        : [];
    if (skillCount === 0) {
      warnings.push("Skills catalog thin or missing");
    }

    // --- Workers ---
    const workerNames = [
      "designbrief",
      "resume-renderer",
      "resume-critic",
    ];
    let workersScore = 80;
    const workersDir = join(
      this.repoRoot,
      "SOS/SAIOS/runtime/workers/resume-production",
    );
    if (!existsSync(workersDir)) {
      workersScore = 30;
      issues.push({
        id: "iss-workers",
        severity: "warning",
        code: "WORKERS_PATH_MISSING",
        message: "Resume production workers path missing",
        category: "workers",
      });
    }

    // --- Dependencies ---
    let depScore = 90;
    const graph = mission.dependency_graph;
    if (!graph?.nodes?.length) {
      depScore = 50;
      warnings.push("Empty dependency graph");
    }
    if (graph?.blocking_departments?.length) {
      depScore -= 15;
      risks.push(
        `Blocking departments: ${graph.blocking_departments.join(", ")}`,
      );
    }

    // Duplicate / conflict missions
    const duplicates = all.filter(
      (m) =>
        m.mission_id !== mission.mission_id &&
        m.founder_objective === mission.founder_objective &&
        (m.status === "WAITING_QUEUE_REVIEW" ||
          m.status === "READY_FOR_QUEUE" ||
          m.status === "APPROVED"),
    );
    if (duplicates.length) {
      depScore -= 20;
      issues.push({
        id: "iss-dup-mission",
        severity: "warning",
        code: "DUPLICATE_MISSION",
        message: `Similar active mission(s): ${duplicates.map((d) => d.mission_id).join(", ")}`,
        category: "dependencies",
      });
    }
    depScore = clamp(depScore);

    // --- Infrastructure ---
    let infraScore = 85;
    if (state.canonical_engine !== "core.first-production-cycle") {
      infraScore -= 20;
    }
    if (!state.queue.available) {
      infraScore -= 10;
      warnings.push("Queue substrate artifacts not present (review-only; no enqueue)");
    }
    if (state.runtime_health.live !== false) {
      infraScore = 0;
      issues.push({
        id: "iss-live",
        severity: "blocker",
        code: "LIVE_ON",
        message: "LIVE must be OFF",
        category: "infrastructure",
      });
    }

    // --- Security ---
    let securityScore = 90;
    if (mission.publishing_allowed !== false) {
      securityScore = 0;
      issues.push({
        id: "iss-publish-flag",
        severity: "blocker",
        code: "PUBLISH_FLAG_TRUE",
        message: "publishing_allowed must remain false",
        category: "security",
      });
    }
    if (mission.queue_admission_allowed !== false) {
      // Mission contract flag is always false in V1; queue admission review does not flip it
      securityScore -= 10;
      warnings.push(
        "Mission.queue_admission_allowed remains false — READY_FOR_QUEUE ≠ enqueue",
      );
    }

    // --- Providers (availability only — never execute) ---
    let providerScore = 70;
    const pv = state.provider_validation;
    if (pv.readiness_state) {
      providerScore = pv.eligible ? 80 : 55;
      if (!pv.eligible) {
        warnings.push(`Provider validation: ${pv.status} (not executed)`);
      }
    } else {
      providerScore = 60;
      warnings.push("Provider validation snapshot absent — Mock assumed");
    }

    // --- Publishing — always NOT READY ---
    const publishingScore = 0;
    issues.push({
      id: "iss-publishing",
      severity: "warning",
      code: "PUBLISHING_NOT_READY",
      message: "Publishing readiness always NOT READY",
      category: "publishing",
    });

    const categories: ReadinessCategoryScore[] = [
      cat("mission", "Mission", missionScore, missionNotes),
      cat("departments", "Departments", deptScore, deptNotes),
      cat("knowledge", "Knowledge", knowledgeScore, [
        state.knowledge.available ? "available" : "missing",
      ]),
      cat("skills", "Skills", skillsScore, [`${skillCount} catalog entries`]),
      cat("workers", "Workers", workersScore, workerNames),
      cat("dependencies", "Dependencies", depScore, [
        `${graph?.edges?.length ?? 0} edges`,
      ]),
      cat("infrastructure", "Infrastructure", infraScore, [
        state.canonical_engine,
      ]),
      cat("security", "Security", securityScore, ["LIVE OFF", "no publish"]),
      cat("providers", "Providers", providerScore, [
        "availability only — not executed",
      ]),
      cat("publishing", "Publishing", publishingScore, ["ALWAYS NOT READY"]),
    ];

    const overall = clamp(
      categories.reduce((s, c) => s + c.weighted, 0),
    );

    const hasBlocker = issues.some((i) => i.severity === "blocker");
    const verdict =
      !hasBlocker && overall >= READY_SCORE_THRESHOLD
        ? ("READY_FOR_QUEUE" as const)
        : ("NOT_READY" as const);

    const stages = [
      "designbrief",
      "render",
      "critic",
      "founder_review",
      "(future) queue_admit",
    ];
    const estimated_duration =
      mission.estimated_duration || "~1.0h (estimate only)";
    const estimated_cost_usd = null;
    const estimated_cost_note =
      "Placeholder — no provider billing; dry_run / Mock assumed";

    risks.push(
      `Mission risk_level=${mission.risk_level}`,
      "Queue admission approval does not enqueue or execute",
    );
    if (mission.blocking_issues?.length) {
      for (const b of mission.blocking_issues.slice(0, 5)) {
        risks.push(b.message);
      }
    }

    const queue_status =
      mission.status === "WAITING_QUEUE_REVIEW" ||
      mission.status === "READY_FOR_QUEUE" ||
      mission.status === "QUEUE_BLOCKED"
        ? mission.status
        : ("NOT_STARTED" as const);

    return {
      schema_version: QUEUE_ADMISSION_SCHEMA_VERSION,
      review_id: `qrev-${randomUUID().slice(0, 8)}`,
      mission_id: mission.mission_id,
      mission_version: mission.mission_version,
      mission_status: mission.status,
      generated_at: new Date().toISOString(),
      categories,
      overall_score: overall,
      verdict,
      queue_status,
      issues,
      warnings,
      risks,
      departments: primary.map((d) => d.department),
      workers: workerNames,
      skills: skillsList,
      models: ["mock-provider (no live models)"],
      tools: ["Brain Router (gateway only)", "Firecrawl (research tool)"],
      dependency_graph: {
        nodes: graph?.nodes ?? [],
        edges: (graph?.edges ?? []).map((e) => ({
          from: e.from,
          to: e.to,
          kind: e.kind,
        })),
        critical_path: graph?.critical_path ?? [],
      },
      estimated_cost_usd,
      estimated_cost_note,
      estimated_duration,
      estimated_stages: stages,
      expected_outputs: [
        "designbrief.json",
        "resume artifacts",
        "critic scores",
        "(future) queue job — not created by this review",
      ],
      risk_level: mission.risk_level,
      publishing_ready: false,
      execution_allowed: false,
      queue_enqueue_allowed: false,
      execution_still_blocked_reason:
        "READY_FOR_QUEUE is a governance milestone only. Execution, worker dispatch, provider calls, and publishing remain disabled until a future unlock agent.",
      fixture: opts?.fixture ?? mission.fixture,
    };
  }
}

function cat(
  id: ReadinessCategoryScore["id"],
  label: string,
  score: number,
  notes: string[],
): ReadinessCategoryScore {
  const weight = READINESS_WEIGHTS[id];
  const s = clamp(score);
  return {
    id,
    label,
    weight,
    score: s,
    weighted: Math.round((s * weight) / 100),
    status: s >= 80 ? "ok" : s >= 50 ? "warn" : "fail",
    notes,
  };
}

export function createQueueReadinessCalculator(
  repoRoot: string,
): QueueReadinessCalculator {
  return new QueueReadinessCalculator(repoRoot);
}
