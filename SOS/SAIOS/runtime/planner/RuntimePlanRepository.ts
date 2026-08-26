/**
 * RuntimePlanRepository — append-only persistence (Agent #169).
 * Platform consolidation (Agent #173): extends BaseAppendOnlyRepository.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { BaseAppendOnlyRepository } from "../../platform/repositories/BaseAppendOnlyRepository.js";
import type {
  RuntimeExecutionPlan,
  RuntimePlanEvent,
  RuntimePlanHealth,
  RuntimePlanSnapshot,
} from "./runtime-plan-types.js";

const LOG_REL = "SOS/07_LOGS/saios/runtime/runtime-plan";

function resolveRepoRoot(fromDir = import.meta.dirname): string {
  return resolve(fromDir, "../../../..");
}

export function runtimePlanLogDir(
  repoRoot?: string,
  fixture = false,
): string {
  const base = join(repoRoot ?? resolveRepoRoot(), LOG_REL);
  return fixture ? join(base, "fixtures") : base;
}

export class RuntimePlanRepository extends BaseAppendOnlyRepository {
  constructor(repoRoot?: string, opts?: { fixture?: boolean }) {
    super({
      repoRoot: repoRoot ?? resolveRepoRoot(),
      logRelativePath: LOG_REL,
      fixture: Boolean(opts?.fixture),
    });
  }

  save(plan: RuntimeExecutionPlan): string[] {
    return this.saveNamedArtifact(
      plan.runtime_plan_id,
      plan,
      "latest-runtime-plan.json",
      "runtime-plans.jsonl",
    );
  }

  appendEvent(e: RuntimePlanEvent): void {
    this.appendJsonl("runtime-plan-events.jsonl", e);
  }

  list(): RuntimeExecutionPlan[] {
    return this.readJsonl("runtime-plans.jsonl");
  }

  listEvents(): RuntimePlanEvent[] {
    return this.readJsonl("runtime-plan-events.jsonl");
  }

  get(planId: string): RuntimeExecutionPlan | null {
    const p = join(this.dir, `${planId}.json`);
    if (!existsSync(p)) {
      return (
        this.list()
          .reverse()
          .find((x) => x.runtime_plan_id === planId) ?? null
      );
    }
    return JSON.parse(readFileSync(p, "utf8")) as RuntimeExecutionPlan;
  }

  getForMission(missionId: string): RuntimeExecutionPlan | null {
    const all = this.list().filter((p) => p.mission_id === missionId);
    return all.length ? all[all.length - 1]! : null;
  }

  hasPlanForShadow(missionId: string, shadowQueueId: string): boolean {
    return this.list().some(
      (p) =>
        p.mission_id === missionId && p.shadow_queue_id === shadowQueueId,
    );
  }

  writeLatest(snapshot: RuntimePlanSnapshot): void {
    this.atomicWrite("latest-runtime-plan-snapshot.json", snapshot);
  }

  writeHealth(health: RuntimePlanHealth): void {
    this.atomicWrite("runtime-plan-health.json", health);
  }

  loadLatestPlan(): RuntimeExecutionPlan | null {
    return this.loadJson("latest-runtime-plan.json");
  }

  loadLatest(): RuntimePlanSnapshot | null {
    return this.loadJson("latest-runtime-plan-snapshot.json");
  }

  loadHealth(): RuntimePlanHealth | null {
    return this.loadJson("runtime-plan-health.json");
  }
}
