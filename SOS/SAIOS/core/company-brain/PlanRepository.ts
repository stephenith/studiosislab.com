/**
 * Plan repository — append-only persistence under 07_LOGS.
 * Never executes. Never touches Queue.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { CompanyBrainStatus, CompanyExecutionPlan } from "./types.js";

export function resolveRepoRoot(fromDir = import.meta.dirname): string {
  return resolve(fromDir, "../../../..");
}

export function companyBrainLogDir(repoRoot?: string): string {
  return join(repoRoot ?? resolveRepoRoot(), "SOS/07_LOGS/saios/company-brain");
}

export class PlanRepository {
  readonly root: string;
  readonly logDir: string;

  constructor(repoRoot?: string) {
    this.root = repoRoot ?? resolveRepoRoot();
    this.logDir = companyBrainLogDir(this.root);
  }

  ensureDir(): void {
    mkdirSync(this.logDir, { recursive: true });
  }

  persist(plan: CompanyExecutionPlan, status: CompanyBrainStatus): string[] {
    this.ensureDir();
    const planPath = join(this.logDir, "latest-plan.json");
    const statusPath = join(this.logDir, "status.json");
    const indexPath = join(this.logDir, "plan-index.json");
    const historyPath = join(this.logDir, "plans.jsonl");

    writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
    writeFileSync(statusPath, `${JSON.stringify(status, null, 2)}\n`, "utf8");

    writeFileSync(historyPath, `${JSON.stringify(plan)}\n`, {
      flag: "a",
      encoding: "utf8",
    });

    const index = {
      latest_plan_id: plan.plan_id,
      mission_id: plan.mission_id,
      updated_at: plan.created_at,
      execution_status: plan.execution_status,
      founder_approval_required: true,
      execution_allowed: false,
    };
    writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");

    return [
      "SOS/07_LOGS/saios/company-brain/latest-plan.json",
      "SOS/07_LOGS/saios/company-brain/status.json",
      "SOS/07_LOGS/saios/company-brain/plan-index.json",
      "SOS/07_LOGS/saios/company-brain/plans.jsonl",
    ];
  }

  loadLatestPlan(): CompanyExecutionPlan | null {
    const p = join(this.logDir, "latest-plan.json");
    if (!existsSync(p)) return null;
    try {
      return JSON.parse(readFileSync(p, "utf8")) as CompanyExecutionPlan;
    } catch {
      return null;
    }
  }

  loadStatus(): CompanyBrainStatus | null {
    const p = join(this.logDir, "status.json");
    if (!existsSync(p)) return null;
    try {
      return JSON.parse(readFileSync(p, "utf8")) as CompanyBrainStatus;
    } catch {
      return null;
    }
  }
}
