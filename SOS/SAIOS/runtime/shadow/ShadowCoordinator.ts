import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { QueueManager } from "../queue/QueueManager.js";
import { RegistryManager } from "../registry/RegistryManager.js";
import { ExecutiveOrchestrator } from "../chief/ExecutiveOrchestrator.js";
import { RuntimeLoop } from "../RuntimeLoop.js";
import { FounderCommandParser } from "../integration/FounderCommandParser.js";
import type { TelegramInboundLike } from "../integration/types.js";
import type { FounderCommand } from "../chief/types.js";
import { ShadowComparator } from "./ShadowComparator.js";
import { ShadowReport } from "./ShadowReport.js";
import { ShadowCursorExecutor } from "./ShadowCursorExecutor.js";
import { resolveShadowPaths } from "./paths.js";
import type {
  LegacyShadowHandler,
  LegacyShadowOutcome,
  SaiosShadowOutcome,
  ShadowCommandRecord,
} from "./types.js";

export type ShadowCoordinatorOptions = {
  runId: string;
  legacyHandler: LegacyShadowHandler;
  shadowRoot?: string;
  planWorkers?: number;
  implementWorkers?: number;
};

export type ShadowProcessResult = {
  legacy: LegacyShadowOutcome;
  saios: SaiosShadowOutcome | null;
  comparison: ShadowCommandRecord["comparison"];
  authoritative: "legacy";
};

/**
 * Shadow Mode coordinator — every founder command runs through BOTH pipelines.
 * Legacy Commander remains authoritative; SAIOS runs in parallel for observation.
 */
export class ShadowCoordinator {
  private readonly runId: string;
  private readonly legacyHandler: LegacyShadowHandler;
  private readonly parser: FounderCommandParser;
  private readonly comparator: ShadowComparator;
  private readonly report: ShadowReport;
  private readonly paths: ReturnType<typeof resolveShadowPaths>;

  private readonly queue: QueueManager;
  private readonly registry: RegistryManager;
  private readonly orchestrator: ExecutiveOrchestrator;
  private readonly runtimeLoop: RuntimeLoop;
  private initialized = false;

  constructor(options: ShadowCoordinatorOptions) {
    this.runId = options.runId;
    this.legacyHandler = options.legacyHandler;
    this.parser = new FounderCommandParser();
    this.comparator = new ShadowComparator();
    this.paths = resolveShadowPaths(options.runId, options.shadowRoot);

    const jobsDir = join(this.paths.shadowRoot, "saios", "jobs");
    const registryDir = join(this.paths.shadowRoot, "saios", "registry");
    const stateFile = join(this.paths.shadowRoot, "saios", "runtime", "state.json");

    this.queue = new QueueManager({
      jobsDir,
      eventsFile: join(jobsDir, "events.jsonl"),
    });
    this.registry = new RegistryManager({
      registryDir,
      eventsFile: join(registryDir, "events.jsonl"),
    });
    this.orchestrator = new ExecutiveOrchestrator({ queue: this.queue, registry: this.registry });
    this.runtimeLoop = new RuntimeLoop({
      queue: this.queue,
      registry: this.registry,
      orchestrator: this.orchestrator,
      cursorExecutor: new ShadowCursorExecutor({
        queue: this.queue,
        reportsDir: this.paths.reportsDir,
        workspaceDir: this.paths.workspaceDir,
        runId: this.runId,
      }),
      stateFile,
      cycleIntervalMs: 5,
    });

    this.report = new ShadowReport(this.runId, this.paths.comparisonDir);
    void options.planWorkers;
    void options.implementWorkers;
  }

  async initializeWorkers(planCount = 2, implementCount = 3): Promise<void> {
    if (this.initialized) return;
    await mkdir(this.paths.shadowRoot, { recursive: true });

    for (let i = 1; i <= planCount; i++) {
      const w = await this.registry.registerWorker({
        id: `WRK-SHADOW-PLAN-${this.runId}-${i}`.slice(0, 48),
        name: `Shadow Plan ${i}`,
        type: "planner",
        capabilities: ["plan"],
        version: "1.0.0",
        host: "shadow",
        metadata: { shadow: true, run_id: this.runId },
      });
      await this.registry.heartbeat(w.id);
    }

    for (let i = 1; i <= implementCount; i++) {
      const w = await this.registry.registerWorker({
        id: `WRK-SHADOW-DEV-${this.runId}-${i}`.slice(0, 48),
        name: `Shadow Dev ${i}`,
        type: "cursor-dev",
        capabilities: ["implement"],
        version: "1.0.0",
        host: "shadow",
        metadata: { shadow: true, run_id: this.runId },
      });
      await this.registry.heartbeat(w.id);
    }

    this.initialized = true;
  }

  /**
   * Process one founder Telegram message through legacy (authoritative) + SAIOS shadow.
   * Does NOT replace telegram-poll — intended to be called alongside existing pipeline.
   */
  async processFounderMessage(
    inbound: TelegramInboundLike,
    index: number,
  ): Promise<ShadowProcessResult> {
    await this.initializeWorkers();

    const legacy = await this.legacyHandler(inbound.text);
    const parsed = this.parser.parse(inbound);

    let saios: SaiosShadowOutcome | null = null;
    if (parsed.intent === "execute") {
      saios = await this.runSaiosShadow(parsed.founder_command);
    }

    const comparison = this.comparator.compare(legacy, saios);
    const record: ShadowCommandRecord = {
      index,
      inbound,
      founder_command: parsed.founder_command,
      legacy,
      saios,
      comparison,
      processed_at: new Date().toISOString(),
    };
    this.report.addRecord(record);

    return { legacy, saios, comparison, authoritative: "legacy" };
  }

  private async runSaiosShadow(command: FounderCommand): Promise<SaiosShadowOutcome> {
    const started = Date.now();
    const errors: string[] = [];

    try {
      const received = await this.orchestrator.receiveFounderCommand(command);
      if (!received.accepted) {
        return {
          ok: false,
          accepted: false,
          job_ids: [],
          jobs_completed: 0,
          jobs_failed: 0,
          duration_ms: Date.now() - started,
          worker_assignments: 0,
          errors: [received.reply],
        };
      }

      const jobIds = received.job_ids ?? [];
      const summary = await this.runtimeLoop.runUntilIdle({ maxCycles: 200 });

      const jobs = await this.queue.listJobs();
      const planJobs = jobs.filter((j) => j.metadata?.plan_id === received.plan_id);
      const jobsCompleted = planJobs.filter((j) => j.status === "COMPLETED").length;
      const jobsFailed = planJobs.filter((j) => j.status === "FAILED").length;
      const workerAssignments = planJobs.filter((j) => j.assigned_worker).length;

      return {
        ok: jobsFailed === 0 && jobsCompleted === jobIds.length,
        accepted: true,
        plan_id: received.plan_id,
        job_ids: jobIds,
        jobs_completed: jobsCompleted,
        jobs_failed: jobsFailed,
        duration_ms: Date.now() - started,
        worker_assignments: workerAssignments,
        errors: summary.errors,
      };
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
      return {
        ok: false,
        accepted: false,
        job_ids: [],
        jobs_completed: 0,
        jobs_failed: 0,
        duration_ms: Date.now() - started,
        worker_assignments: 0,
        errors,
      };
    }
  }

  async finalizeReport(): Promise<{ pass: boolean; path: string }> {
    const pass = this.report.allComparisonsPass();
    const path = await this.report.writeFinal(pass);
    return { pass, path };
  }

  getReport(): ShadowReport {
    return this.report;
  }

  getPaths() {
    return this.paths;
  }
}

export async function createLegacyShadowHandler(
  legacyLogsRoot: string,
): Promise<LegacyShadowHandler> {
  const { loadConfig } = await import("../../../runtime/src/config.js");
  const { routeInboxCommand } = await import(
    "../../../runtime/src/commander/inbox-ai/command-router.js"
  );

  const base = loadConfig();
  const shadowConfig = { ...base, logsRoot: legacyLogsRoot };

  return async (text: string): Promise<LegacyShadowOutcome> => {
    const started = Date.now();
    const { result, reply } = await routeInboxCommand(shadowConfig, text);
    return {
      ok: result.ok,
      runtime_action: result.runtime_action,
      work_order_id:
        typeof result.details?.work_order_id === "string"
          ? result.details.work_order_id
          : undefined,
      reply,
      duration_ms: Date.now() - started,
      error: result.error,
    };
  };
}
