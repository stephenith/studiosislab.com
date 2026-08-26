/**
 * Production session — in-memory session lifecycle and persistence helpers.
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type {
  InterpretedCommand,
  ObjectivePlan,
  ProductionSessionRecord,
  SessionPhase,
} from "./types.js";

const SOS_ROOT = resolve(import.meta.dirname, "../../..");
export const CONTROLLER_ROOT = join(SOS_ROOT, "07_LOGS/saios/controller");
export const SESSIONS_ROOT = join(CONTROLLER_ROOT, "sessions");

export function allocateProductionSessionId(date = new Date()): string {
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, "");
  mkdirSync(SESSIONS_ROOT, { recursive: true });
  const prefix = `production-${ymd}-`;
  const existing = existsSync(SESSIONS_ROOT) ? readdirSync(SESSIONS_ROOT) : [];
  const seq = existing.filter((n) => n.startsWith(prefix)).length + 1;
  return `${prefix}${String(seq).padStart(3, "0")}`;
}

export function createProductionSession(input: {
  session_id: string;
  objective: string;
  command: InterpretedCommand;
  plan: ObjectivePlan;
}): ProductionSessionRecord {
  const session_dir = join(SESSIONS_ROOT, input.session_id);
  mkdirSync(session_dir, { recursive: true });

  return {
    session_id: input.session_id,
    session_dir,
    objective: input.objective,
    command: input.command,
    plan: input.plan,
    phase: "interpreted",
    started_at: new Date().toISOString(),
    completed_at: null,
    duration_ms: null,
    research_session_id: null,
    research_dir: null,
    pipeline_run_id: null,
    pipeline_dir: null,
    jobs_total: input.plan.job_count,
    jobs_completed: 0,
    qa_pass: null,
    founder_decision: null,
    learning_applied: false,
    templates_generated: 0,
    confidence: null,
    final_report_path: null,
    pass: false,
    error: null,
  };
}

export function updateSessionPhase(
  session: ProductionSessionRecord,
  phase: SessionPhase,
): ProductionSessionRecord {
  return { ...session, phase };
}

export function persistSession(session: ProductionSessionRecord): string {
  const path = join(session.session_dir, "session.json");
  writeFileSync(path, JSON.stringify(session, null, 2));
  return path;
}

export function writeSessionReport(session: ProductionSessionRecord, markdown: string): string {
  const path = join(session.session_dir, "final-report.md");
  writeFileSync(path, markdown);
  return path;
}
