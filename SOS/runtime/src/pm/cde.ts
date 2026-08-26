import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Priority } from "../types.js";
import type { BacklogItem, DeveloperReport, Task } from "./types.js";

export type CdeConfig = {
  cde_version: string;
  confidence: {
    proceed_autonomous: number;
    proceed_with_qa_optional: number;
    delegate_qa: number;
  };
  budgets: {
    approvals_per_day: number;
    blockers_per_day: number;
    p0_notifications_per_day: number;
    total_interruptions_per_day: number;
  };
  limits: { max_files_changed: number; max_tasks_in_flight: number; max_runtime_hours: number };
  hard_gate_patterns: Array<{ id: string; pattern: string; description: string }>;
  qa_required_patterns: string[];
  priority_weights: Record<string, number>;
};

const __dirname = dirname(fileURLToPath(import.meta.url));

export function loadCdeConfig(): CdeConfig {
  const path = join(__dirname, "../../cde.config.json");
  return JSON.parse(readFileSync(path, "utf8")) as CdeConfig;
}

export type CdeEvaluation = {
  commander_required: boolean;
  hard_gate_ids: string[];
  qa_required: boolean;
  confidence: number;
  reason: string;
  priority: Priority;
};

function backlogToSosPriority(p: BacklogItem["priority"]): Priority {
  if (p === "Critical") return "P0";
  if (p === "High") return "P1";
  if (p === "Medium") return "P2";
  return "P3";
}

export function detectHardGates(text: string, config: CdeConfig): string[] {
  const combined = text.toLowerCase();
  const hits: string[] = [];
  for (const gate of config.hard_gate_patterns) {
    const re = new RegExp(gate.pattern, "i");
    if (re.test(combined)) hits.push(gate.id);
  }
  return hits;
}

export function requiresQa(task: Task, config: CdeConfig, devReport?: DeveloperReport): boolean {
  if (task.qa_required) return true;
  const text = `${task.title} ${task.description} ${task.evidence.join(" ")}`.toLowerCase();
  if (config.qa_required_patterns.some((p) => text.includes(p.toLowerCase()))) return true;
  if (devReport) {
    if (devReport.files_changed.some((f) => f.startsWith("src/"))) return true;
    if (devReport.confidence < config.confidence.proceed_autonomous) return true;
    if (!devReport.build_passed) return true;
  }
  return false;
}

export function evaluateTaskForApproval(
  task: Task,
  config: CdeConfig,
  devReport?: DeveloperReport,
): CdeEvaluation {
  const text = `${task.title} ${task.description} ${task.evidence.join(" ")}`;
  const hardGates = detectHardGates(text, config);
  const priority = backlogToSosPriority(task.backlog_priority);

  if (hardGates.length > 0) {
    return {
      commander_required: true,
      hard_gate_ids: hardGates,
      qa_required: requiresQa(task, config, devReport),
      confidence: Math.min(task.confidence, 40),
      reason: `Hard gate(s): ${hardGates.join(", ")}`,
      priority: priority === "P3" ? "P1" : priority,
    };
  }

  if (task.backlog_priority === "Critical" && task.backlog_id.startsWith("BL-3-")) {
    return {
      commander_required: true,
      hard_gate_ids: ["H10"],
      qa_required: requiresQa(task, config, devReport),
      confidence: 45,
      reason: "Critical blocked backlog item requires Commander routing decision",
      priority: "P1",
    };
  }

  if (devReport?.blocker) {
    return {
      commander_required: true,
      hard_gate_ids: [],
      qa_required: false,
      confidence: 30,
      reason: `Developer blocker: ${devReport.blocker_reason ?? "unspecified"}`,
      priority: "P1",
    };
  }

  const confidence = devReport?.confidence ?? task.confidence;

  if (confidence < config.confidence.delegate_qa) {
    return {
      commander_required: true,
      hard_gate_ids: [],
      qa_required: false,
      confidence,
      reason: `Confidence ${confidence}% below delegate threshold`,
      priority: "P1",
    };
  }

  if (devReport && devReport.files_changed.length > config.limits.max_files_changed) {
    return {
      commander_required: true,
      hard_gate_ids: ["H17"],
      qa_required: requiresQa(task, config, devReport),
      confidence,
      reason: `Files changed (${devReport.files_changed.length}) exceeds limit`,
      priority: "P1",
    };
  }

  return {
    commander_required: false,
    hard_gate_ids: [],
    qa_required: requiresQa(task, config, devReport),
    confidence,
    reason: "Within PM autonomous authority",
    priority,
  };
}

export function canSendApproval(budget: {
  approvals_sent: number;
  total_sent: number;
}, config: CdeConfig, priority: Priority): boolean {
  if (priority === "P0") return true;
  if (budget.approvals_sent >= config.budgets.approvals_per_day) return false;
  if (budget.total_sent >= config.budgets.total_interruptions_per_day) return false;
  return true;
}
