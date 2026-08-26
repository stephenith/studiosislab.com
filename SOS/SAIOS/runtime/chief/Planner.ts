import { randomBytes } from "node:crypto";
import type { PlanId, Priority } from "../shared/types.js";
import type { DecisionResult, ExecutionPlan, FounderCommand, PlannedJob } from "./types.js";
import { DecisionEngine } from "./DecisionEngine.js";

function generatePlanId(): PlanId {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp =
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}-` +
    `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}` +
    `${pad(now.getUTCMilliseconds())}`;
  const suffix = randomBytes(2).toString("hex");
  return `PLAN-${stamp}-${suffix}`;
}

function uniqueCapabilities(jobs: PlannedJob[]): string[] {
  return [...new Set(jobs.map((j) => j.required_capability))];
}

export class Planner {
  private readonly decisionEngine: DecisionEngine;

  constructor(decisionEngine?: DecisionEngine) {
    this.decisionEngine = decisionEngine ?? new DecisionEngine();
  }

  buildPlan(command: FounderCommand, decision?: DecisionResult): ExecutionPlan {
    const resolved = decision ?? this.decisionEngine.analyze(command);
    const jobs: PlannedJob[] = [];
    const priority = resolved.priority;

    jobs.push({
      temp_key: "plan",
      title: "Plan work",
      description: `Plan execution for: ${resolved.goal}`,
      priority,
      required_capability: "plan",
      step: 1,
      metadata: { job_type: "plan" },
    });

    const implementKeys: string[] = [];
    for (let i = 1; i <= resolved.implement_steps; i++) {
      const key = `implement-${i}`;
      implementKeys.push(key);
      jobs.push({
        temp_key: key,
        title: `Implement step ${i}`,
        description: `Implementation step ${i} of ${resolved.implement_steps}: ${resolved.goal}`,
        priority,
        required_capability: "implement",
        step: 1 + i,
        depends_on: ["plan"],
        metadata: { job_type: "implement", step_index: i },
      });
    }

    if (resolved.include_verify) {
      jobs.push({
        temp_key: "verify",
        title: "Verify work",
        description: `Verify outcome for: ${resolved.goal}`,
        priority,
        required_capability: "verify",
        step: jobs.length + 1,
        depends_on: implementKeys.length > 0 ? [implementKeys[implementKeys.length - 1]!] : ["plan"],
        metadata: { job_type: "verify" },
      });
    }

    const capabilities = uniqueCapabilities(jobs);

    return {
      id: generatePlanId(),
      goal: resolved.goal,
      summary: resolved.summary,
      priority,
      jobs,
      estimated_workers: Math.min(capabilities.length, jobs.length),
      estimated_steps: jobs.length,
      estimated_duration: resolved.estimated_duration,
      created_at: new Date().toISOString(),
      founder_command: command,
    };
  }
}
