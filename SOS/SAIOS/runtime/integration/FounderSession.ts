import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { JobId, PlanId } from "../shared/types.js";
import type { FounderSessionRecord } from "./types.js";

export class FounderSession {
  private readonly sessions = new Map<string, FounderSessionRecord>();
  private readonly persistPath: string | null;

  constructor(options?: { persistPath?: string }) {
    this.persistPath = options?.persistPath ?? null;
  }

  async load(): Promise<void> {
    if (!this.persistPath) return;
    try {
      const raw = await readFile(this.persistPath, "utf8");
      const data = JSON.parse(raw) as { sessions: FounderSessionRecord[] };
      for (const session of data.sessions) {
        this.sessions.set(session.chat_id, session);
      }
    } catch {
      // fresh sessions
    }
  }

  async save(): Promise<void> {
    if (!this.persistPath) return;
    await mkdir(dirname(this.persistPath), { recursive: true });
    await writeFile(
      this.persistPath,
      JSON.stringify({ sessions: [...this.sessions.values()] }, null, 2),
      "utf8",
    );
  }

  get(chatId: string): FounderSessionRecord | null {
    return this.sessions.get(chatId) ?? null;
  }

  recordPlan(
    chatId: string,
    planId: PlanId,
    jobIds: JobId[],
    goal: string,
    userId?: string,
  ): FounderSessionRecord {
    const now = new Date().toISOString();
    const existing = this.sessions.get(chatId);
    const record: FounderSessionRecord = existing ?? {
      chat_id: chatId,
      user_id: userId,
      plans: [],
      updated_at: now,
    };

    record.plans.push({
      plan_id: planId,
      job_ids: jobIds,
      goal,
      submitted_at: now,
      notified: false,
    });
    record.updated_at = now;
    if (userId) record.user_id = userId;
    this.sessions.set(chatId, record);
    return record;
  }

  listPendingNotifications(chatId: string): FounderSessionRecord["plans"] {
    const session = this.sessions.get(chatId);
    if (!session) return [];
    return session.plans.filter((p) => !p.notified);
  }

  markPlanNotified(chatId: string, planId: PlanId): void {
    const session = this.sessions.get(chatId);
    if (!session) return;
    for (const plan of session.plans) {
      if (plan.plan_id === planId) plan.notified = true;
    }
    session.updated_at = new Date().toISOString();
  }

  allSessions(): FounderSessionRecord[] {
    return [...this.sessions.values()];
  }
}
