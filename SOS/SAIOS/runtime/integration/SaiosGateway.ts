import type { JobId, PlanId } from "../shared/types.js";
import type { QueueManager } from "../queue/QueueManager.js";
import type { RegistryManager } from "../registry/RegistryManager.js";
import type { ExecutiveOrchestrator } from "../chief/ExecutiveOrchestrator.js";
import type { RuntimeLoop } from "../RuntimeLoop.js";
import type { FounderCommand } from "../chief/types.js";
import type { SaiosJob } from "../queue/types.js";
import { FounderSession } from "./FounderSession.js";
import type {
  CompletionNotificationRecord,
  JobStatusSummary,
  SubmitFounderCommandResult,
  TelegramAdapter,
} from "./types.js";

export type SaiosGatewayOptions = {
  queue: QueueManager;
  registry: RegistryManager;
  orchestrator: ExecutiveOrchestrator;
  session?: FounderSession;
  telegram?: TelegramAdapter;
  runtimeLoop?: RuntimeLoop;
};

/**
 * Single public API for SAIOS founder intake and job queries.
 */
export class SaiosGateway {
  private readonly queue: QueueManager;
  private readonly registry: RegistryManager;
  private readonly orchestrator: ExecutiveOrchestrator;
  private readonly session: FounderSession;
  private readonly telegram: TelegramAdapter | null;
  private readonly runtimeLoop: RuntimeLoop | null;
  private readonly completionLog: CompletionNotificationRecord[] = [];

  constructor(options: SaiosGatewayOptions) {
    this.queue = options.queue;
    this.registry = options.registry;
    this.orchestrator = options.orchestrator;
    this.session = options.session ?? new FounderSession();
    this.telegram = options.telegram ?? null;
    this.runtimeLoop = options.runtimeLoop ?? null;
  }

  getSession(): FounderSession {
    return this.session;
  }

  getCompletionNotifications(): CompletionNotificationRecord[] {
    return [...this.completionLog];
  }

  async submitFounderCommand(command: FounderCommand): Promise<SubmitFounderCommandResult> {
    const result = await this.orchestrator.receiveFounderCommand(command);

    if (result.accepted && result.plan_id && result.job_ids && command.chat_id) {
      this.session.recordPlan(
        command.chat_id,
        result.plan_id,
        result.job_ids,
        command.raw_text,
        command.user_id,
      );
      await this.session.save();
    }

    return {
      accepted: result.accepted,
      reply: result.reply,
      plan_id: result.plan_id,
      job_ids: result.job_ids,
    };
  }

  async getJobStatus(jobId: JobId): Promise<JobStatusSummary | null> {
    const job = await this.queue.loadJob(jobId);
    if (!job) return null;
    return {
      job_id: job.id,
      title: job.title,
      status: job.status,
      assigned_worker: job.assigned_worker,
      report_path: job.report_path,
    };
  }

  async cancelJob(jobId: JobId, reason = "cancelled by founder"): Promise<SaiosJob | null> {
    const job = await this.queue.loadJob(jobId);
    if (!job) return null;
    if (job.status === "COMPLETED" || job.status === "FAILED" || job.status === "CANCELLED") {
      return job;
    }

    const cancelled = await this.queue.cancelJob(jobId, reason);
    if (cancelled.assigned_worker) {
      try {
        await this.registry.releaseJob(cancelled.assigned_worker, reason);
      } catch {
        // worker may already be idle
      }
    }
    return cancelled;
  }

  async listRunningJobs(): Promise<SaiosJob[]> {
    return this.queue.listRunningJobs();
  }

  /**
   * Send Telegram completion notifications for finished plans (no QA runtime yet).
   */
  async notifyCompletedPlans(chatId?: string): Promise<CompletionNotificationRecord[]> {
    if (!this.telegram) return [];

    const sent: CompletionNotificationRecord[] = [];
    const sessions = chatId
      ? [this.session.get(chatId)].filter(Boolean)
      : this.session.allSessions();

    for (const session of sessions) {
      if (!session) continue;
      for (const plan of session.plans) {
        if (plan.notified) continue;

        const jobs = await Promise.all(plan.job_ids.map((id) => this.queue.loadJob(id)));
        const valid = jobs.filter(Boolean) as SaiosJob[];
        if (valid.length === 0) continue;

        const allDone = valid.every(
          (j) => j.status === "COMPLETED" || j.status === "FAILED" || j.status === "CANCELLED",
        );
        if (!allDone) continue;

        const failed = valid.filter((j) => j.status === "FAILED").length;
        const completed = valid.filter((j) => j.status === "COMPLETED").length;
        const title = failed > 0 ? "SAIOS execution finished (with failures)" : "SAIOS execution complete";
        const body = [
          `Plan: ${plan.plan_id}`,
          `Goal: ${plan.goal}`,
          `Jobs: ${completed} completed, ${failed} failed, ${valid.length} total`,
        ].join("\n");

        const delivery = await this.telegram.sendCompletionNotification({
          correlation_id: plan.plan_id,
          title,
          body,
          chat_id: session.chat_id,
          plan_id: plan.plan_id,
          metadata: { job_ids: plan.job_ids },
        });

        const record: CompletionNotificationRecord = {
          plan_id: plan.plan_id,
          chat_id: session.chat_id,
          title,
          body,
          sent_at: new Date().toISOString(),
          ok: delivery.ok,
        };
        sent.push(record);
        this.completionLog.push(record);
        this.session.markPlanNotified(session.chat_id, plan.plan_id);
      }
    }

    await this.session.save();
    return sent;
  }
}
