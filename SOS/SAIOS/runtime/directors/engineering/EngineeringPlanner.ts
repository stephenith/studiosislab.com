import { randomBytes } from "node:crypto";
import type { Priority } from "../../shared/types.js";
import {
  getWorkerTypeByCapability,
  getWorkerTypeById,
} from "./EngineeringPolicies.js";
import type {
  EngineeringDependency,
  EngineeringObjective,
  EngineeringPlan,
  EngineeringTask,
} from "./types.js";

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
};

function generatePlanId(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp =
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}-` +
    `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}` +
    `${pad(now.getUTCMilliseconds())}`;
  return `ENG-PLAN-${stamp}-${randomBytes(2).toString("hex")}`;
}

function detectPriority(text: string): Priority {
  if (/\b(urgent|asap|p0|critical)\b/i.test(text)) return "P0";
  if (/\b(important|p1|high)\b/i.test(text)) return "P1";
  if (/\b(low|p3|minor)\b/i.test(text)) return "P3";
  return "P2";
}

function parseQuantity(text: string): number {
  const digit = text.match(/\b(\d+)\b/);
  if (digit) return Math.max(1, Math.min(20, parseInt(digit[1]!, 10)));
  for (const [word, n] of Object.entries(WORD_NUMBERS)) {
    if (new RegExp(`\\b${word}\\b`, "i").test(text)) return n;
  }
  return 1;
}

function detectPrimaryWorkerType(text: string): string {
  const lower = text.toLowerCase();
  if (/\b(resume|cv|ats)\b/.test(lower)) return "resume-worker";
  if (/\b(invoice|billing)\b/.test(lower)) return "invoice-worker";
  if (/\b(portfolio)\b/.test(lower)) return "portfolio-worker";
  if (/\b(cover letter)\b/.test(lower)) return "cover-letter-worker";
  if (/\b(pdf)\b/.test(lower)) return "pdf-worker";
  if (/\b(firebase)\b/.test(lower)) return "firebase-worker";
  if (/\b(auth|authentication|login)\b/.test(lower)) return "authentication-worker";
  if (/\b(seo)\b/.test(lower)) return "seo-worker";
  if (/\b(ui|interface|design)\b/.test(lower)) return "ui-worker";
  if (/\b(api|endpoint)\b/.test(lower)) return "api-worker";
  return "resume-worker";
}

/**
 * Deterministic engineering planning — no AI, no Cursor.
 */
export class EngineeringPlanner {
  buildPlan(objective: EngineeringObjective): EngineeringPlan {
    const goal = objective.raw_text.trim();
    const priority = detectPriority(goal);
    const quantity = parseQuantity(goal);
    const primaryTypeId = detectPrimaryWorkerType(goal);
    const primary = getWorkerTypeById(primaryTypeId) ?? getWorkerTypeByCapability("resume")!;

    const tasks: EngineeringTask[] = [];
    const dependencies: EngineeringDependency[] = [];
    const primaryKeys: string[] = [];

    for (let i = 1; i <= quantity; i++) {
      const key = `${primary.id}-${i}`;
      primaryKeys.push(key);
      tasks.push({
        temp_key: key,
        title: `${primary.name} task ${i}`,
        description: `${goal} — deliverable ${i} of ${quantity}`,
        worker_type: primary.id,
        capability: primary.capability,
        priority,
        step: i,
      });
    }

    const testingType = getWorkerTypeById("testing-worker")!;
    const docsType = getWorkerTypeById("documentation-worker")!;

    tasks.push({
      temp_key: "testing",
      title: "Verify engineering deliverables",
      description: `Run testing verification for: ${goal}`,
      worker_type: testingType.id,
      capability: testingType.capability,
      priority,
      step: quantity + 1,
      depends_on: primaryKeys,
    });

    tasks.push({
      temp_key: "documentation",
      title: "Document engineering outcome",
      description: `Produce documentation for: ${goal}`,
      worker_type: docsType.id,
      capability: docsType.capability,
      priority,
      step: quantity + 2,
      depends_on: ["testing"],
    });

    for (const key of primaryKeys) {
      dependencies.push({ from: key, to: "testing", kind: "qa" });
    }
    dependencies.push({ from: "testing", to: "documentation", kind: "docs" });

    const worker_types = [...new Set(tasks.map((t) => t.worker_type))];
    const minutesPerJob = priority === "P0" ? 15 : priority === "P1" ? 20 : 30;

    return {
      id: generatePlanId(),
      goal,
      priority,
      worker_types,
      tasks,
      estimated_workers: worker_types.length,
      estimated_jobs: tasks.length,
      estimated_duration: `${tasks.length * minutesPerJob}m`,
      dependencies,
      created_at: new Date().toISOString(),
      objective,
    };
  }
}
