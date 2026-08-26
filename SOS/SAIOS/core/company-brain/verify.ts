#!/usr/bin/env tsx
/**
 * Company Brain + Mission Contract V1 verify — Agents #161/#162.
 * Planning only. Never executes, enqueues, or calls providers.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createCompanyBrain, COMPANY_BRAIN } from "./CompanyBrain.js";
import { companyBrainLogDir } from "./PlanRepository.js";
import { missionLogDir } from "./MissionRegistry.js";
import {
  canTransition,
  detectDependencyLoops,
  validateMissionContract,
  V1_ACTIVE_STATUSES,
} from "./MissionValidator.js";
import { MISSION_SCHEMA_VERSION } from "./mission-types.js";

const REPO = resolve(import.meta.dirname, "../../../..");

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function pkgHasOpenai(): boolean {
  try {
    const pkg = JSON.parse(
      readFileSync(join(import.meta.dirname, "package.json"), "utf8"),
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    return "openai" in deps || "@anthropic-ai/sdk" in deps;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE must be OFF");
  assert(COMPANY_BRAIN.mode === "planning_only", "planning_only");
  assert(COMPANY_BRAIN.autonomous === false, "not autonomous");
  assert(COMPANY_BRAIN.replaces_executive_orchestrator === false, "does not replace EO");
  assert(COMPANY_BRAIN.mission_contract === MISSION_SCHEMA_VERSION, "mission schema");
  assert(!pkgHasOpenai(), "no openai sdk");

  const brain = createCompanyBrain(REPO);

  // --- Planning Engine V1 (preserved) ---
  const result = brain.createPlan({
    founder_objective:
      "Create a dry-run plan for an ATS Marketing Manager resume via the canonical engine",
    fixture: true,
  });

  assert(result.plan.schema_version === "company-brain-plan-1.0.0", "schema version");
  assert(result.plan.founder_approval_required === true, "founder approval required");
  assert(result.plan.execution_allowed === false, "execution_allowed false");
  assert(result.plan.queue_enqueue_allowed === false, "queue_enqueue_allowed false");
  assert(
    result.plan.execution_status === "PLANNED" || result.plan.execution_status === "BLOCKED",
    "status planned or blocked",
  );
  assert(result.plan.canonical_engine === "core.first-production-cycle", "canonical engine");
  assert(result.plan.departments_involved.length > 0, "departments");
  assert(result.plan.required_workers.length > 0, "workers listed");
  assert(Array.isArray(result.plan.blocking_issues), "blockers array");
  assert(result.persisted, "persisted");

  const logDir = companyBrainLogDir(REPO);
  assert(existsSync(join(logDir, "latest-plan.json")), "latest-plan.json");
  assert(existsSync(join(logDir, "status.json")), "status.json");

  const status = brain.getStatus();
  assert(status.can_execute === false, "status cannot execute");
  assert(status.can_enqueue === false, "status cannot enqueue");
  assert(status.can_call_providers === false, "status cannot call providers");
  assert(status.can_publish === false, "status cannot publish");
  assert(status.latest_plan_id === result.plan.plan_id, "latest plan id");

  const web = brain.createPlan({
    founder_objective: "Improve the public website homepage SEO copy",
    fixture: true,
  });
  assert(
    web.plan.departments_involved.some(
      (d) => d.department === "website" || d.department === "seo",
    ),
    "website/seo considered",
  );
  assert(web.plan.execution_allowed === false, "web plan no execute");

  // --- Mission Contract V1 ---
  assert(V1_ACTIVE_STATUSES.includes("PLANNED"), "v1 planned");
  assert(V1_ACTIVE_STATUSES.includes("WAITING_FOUNDER"), "v1 waiting");
  assert(canTransition("PLANNED", "WAITING_FOUNDER"), "transition planned→waiting");
  assert(!canTransition("PLANNED", "IN_PROGRESS"), "no skip to in_progress");
  assert(
    detectDependencyLoops([
      { from: "a", to: "b" },
      { from: "b", to: "a" },
    ]) !== null,
    "loop detector works",
  );

  const missionResult = brain.createMission({
    founder_objective:
      "Mission Contract dry-run: ATS Marketing Manager resume via canonical engine",
    fixture: false,
    await_founder: true,
  });

  assert(missionResult.overall === "PASS", `mission pass: ${JSON.stringify(missionResult.validation.errors)}`);
  assert(missionResult.mission.schema_version === MISSION_SCHEMA_VERSION, "mission schema");
  assert(missionResult.mission.execution_allowed === false, "mission no execute");
  assert(missionResult.mission.queue_admission_allowed === false, "mission no queue");
  assert(missionResult.mission.publishing_allowed === false, "mission no publish");
  assert(missionResult.mission.founder_approval_required === true, "mission founder required");
  assert(
    missionResult.mission.status === "PLANNED" ||
      missionResult.mission.status === "WAITING_FOUNDER",
    "v1 status only",
  );
  assert(missionResult.mission.success_kpis.length > 0, "kpis present");
  assert(missionResult.mission.estimated_departments.length > 0, "dept estimate");
  assert(missionResult.mission.dependency_graph.nodes.length > 0, "dep graph");
  assert(missionResult.plan_id !== null, "linked plan");
  assert(missionResult.mission.linked_plan_id === missionResult.plan_id, "plan link");

  const revalidate = validateMissionContract(missionResult.mission, {
    known_ids: new Set(),
    is_update: true,
  });
  assert(revalidate.ok, "revalidate mission");

  const mdir = missionLogDir(REPO);
  assert(existsSync(join(mdir, "current-mission.json")), "current-mission.json");
  assert(existsSync(join(mdir, "index.json")), "mission index");
  assert(existsSync(join(mdir, `${missionResult.mission.mission_id}.json`)), "mission file");

  const current = brain.getCurrentMission();
  assert(current?.mission_id === missionResult.mission.mission_id, "current mission");
  assert(
    brain.missions.search("Marketing").some(
      (m) => m.mission_id === missionResult.mission.mission_id,
    ),
    "mission search",
  );

  // Invalid lifecycle must report error (no mutation)
  const bad = {
    ...missionResult.mission,
    mission_id: "mission-verify-bad-lifecycle",
    status: "IN_PROGRESS" as const,
    current_stage: "IN_PROGRESS" as const,
  };
  const badVal = validateMissionContract(bad, { known_ids: new Set() });
  assert(!badVal.ok, "invalid lifecycle fails");
  assert(
    badVal.errors.some((e) => e.code === "INVALID_LIFECYCLE_V1"),
    "invalid lifecycle code",
  );

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "company-brain-mission-contract-v1",
        checks: {
          planning_only: true,
          no_execution: true,
          no_enqueue: true,
          no_openai: true,
          founder_approval_required: true,
          does_not_replace_executive_orchestrator: true,
          artifacts_persisted: true,
          mission_contract: true,
          mission_registry: true,
          mission_validation: true,
          live_off: true,
        },
        plan_id: result.plan.plan_id,
        mission_id: missionResult.mission.mission_id,
        mission_status: missionResult.mission.status,
        linked_plan_id: missionResult.plan_id,
        execution_status: result.plan.execution_status,
        overall: "PASS",
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
