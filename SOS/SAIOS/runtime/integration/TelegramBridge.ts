import { FounderCommandParser } from "./FounderCommandParser.js";
import type { SaiosGateway } from "./SaiosGateway.js";
import type { TelegramAdapter, TelegramBridgeResult, TelegramInboundLike } from "./types.js";

export type TelegramBridgeOptions = {
  gateway: SaiosGateway;
  telegram: TelegramAdapter;
  parser?: FounderCommandParser;
};

/**
 * Receives Telegram messages and routes them to SAIOS.
 * Does NOT execute work — delegates to Executive Orchestrator via SaiosGateway.
 */
export class TelegramBridge {
  private readonly gateway: SaiosGateway;
  private readonly telegram: TelegramAdapter;
  private readonly parser: FounderCommandParser;

  constructor(options: TelegramBridgeOptions) {
    this.gateway = options.gateway;
    this.telegram = options.telegram;
    this.parser = options.parser ?? new FounderCommandParser();
  }

  async handleInbound(inbound: TelegramInboundLike): Promise<TelegramBridgeResult> {
    const parsed = this.parser.parse(inbound);

    if (parsed.intent === "list_running") {
      const running = await this.gateway.listRunningJobs();
      const reply =
        running.length === 0
          ? "No running SAIOS jobs."
          : `Running jobs (${running.length}):\n${running.map((j) => `• ${j.id} — ${j.title} [${j.status}]`).join("\n")}`;
      await this.telegram.sendInboxReply(inbound.chat_id, reply);
      return { handled: true, reply };
    }

    if (parsed.intent === "status") {
      if (!parsed.target_job_id) {
        const reply = "Usage: status JOB-<id>";
        await this.telegram.sendInboxReply(inbound.chat_id, reply);
        return { handled: true, reply };
      }
      const status = await this.gateway.getJobStatus(parsed.target_job_id);
      const reply = status
        ? `Job ${status.job_id}\n${status.title}\nStatus: ${status.status}\nWorker: ${status.assigned_worker ?? "none"}`
        : `Job not found: ${parsed.target_job_id}`;
      await this.telegram.sendInboxReply(inbound.chat_id, reply);
      return { handled: true, reply };
    }

    if (parsed.intent === "cancel") {
      if (!parsed.target_job_id) {
        const reply = "Usage: cancel job JOB-<id>";
        await this.telegram.sendInboxReply(inbound.chat_id, reply);
        return { handled: true, reply };
      }
      const cancelled = await this.gateway.cancelJob(parsed.target_job_id);
      const reply = cancelled
        ? `Cancelled ${parsed.target_job_id} (status: ${cancelled.status})`
        : `Job not found: ${parsed.target_job_id}`;
      await this.telegram.sendInboxReply(inbound.chat_id, reply);
      return { handled: true, reply };
    }

    const command = {
      ...parsed.founder_command,
      raw_text: parsed.goal === parsed.founder_command.raw_text
        ? parsed.founder_command.raw_text
        : parsed.founder_command.raw_text,
    };

    const result = await this.gateway.submitFounderCommand(command);
    const reply = result.accepted
      ? `✓ SAIOS accepted.\n${result.reply}`
      : `✗ SAIOS rejected.\n${result.reply}`;

    await this.telegram.sendInboxReply(inbound.chat_id, reply);

    return {
      handled: true,
      reply,
      plan_id: result.plan_id,
      job_ids: result.job_ids,
    };
  }
}
