/**
 * NotificationLiveBridge — forwards Event Bus notifications to Commander pipeline.
 * Reuses SOS/runtime sendLifecycleNotification. Never duplicates Telegram.
 * Verify must pass forceDryRun=true.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { BusEvent, EventType } from "../event-bus/types.js";
import {
  defaultLiveMonitoringConfiguration,
  LIVE_FLAG,
  REPO_ROOT,
  resolveBridgeMode,
} from "./LiveMonitoringConfiguration.js";
import type { BridgeCallResult, BridgeMode, CommanderBridgeStatus } from "./types.js";

function detectCommanderBridge(): CommanderBridgeStatus {
  const cfg = defaultLiveMonitoringConfiguration();
  const pipeline = join(REPO_ROOT, cfg.commander_pipeline);
  const telegram = join(REPO_ROOT, cfg.commander_telegram);
  const email = join(REPO_ROOT, cfg.commander_email);
  const transport = join(REPO_ROOT, cfg.commander_transport);

  // Duplicate = a second sendMessage implementation under SAIOS (should not exist)
  const saiosTelegramImpl = join(
    REPO_ROOT,
    "SOS/SAIOS/runtime/notification-department/TelegramNotificationAdapter.ts",
  );
  // Adapter exists but must not implement Bot API — we only flag duplicate if
  // a second services/telegram.ts appears under SAIOS.
  const saiosTelegramService = join(
    REPO_ROOT,
    "SOS/SAIOS/runtime/services/telegram.ts",
  );

  return {
    detected:
      existsSync(pipeline) &&
      existsSync(telegram) &&
      existsSync(email) &&
      existsSync(transport),
    pipeline_path: cfg.commander_pipeline,
    telegram_path: cfg.commander_telegram,
    email_path: cfg.commander_email,
    transport_path: cfg.commander_transport,
    duplicate_telegram_stack: existsSync(saiosTelegramService),
    live_flag: LIVE_FLAG,
    live_enabled: resolveBridgeMode(false) === "live",
    verify_forces_dry_run: true,
  };
}

export function getCommanderBridgeStatus(): CommanderBridgeStatus {
  return detectCommanderBridge();
}

function priorityForEvent(type: EventType): "P0" | "P1" | "P2" {
  if (type.includes("CRITICAL")) return "P0";
  if (type.includes("WARNING") || type === "FOUNDER_REVIEW_PENDING") return "P1";
  return "P2";
}

export class NotificationLiveBridge {
  constructor(private readonly forceDryRun: boolean) {}

  getMode(): BridgeMode {
    return resolveBridgeMode(this.forceDryRun);
  }

  async forward(event: BusEvent): Promise<BridgeCallResult> {
    const mode = this.getMode();
    const title = String(
      event.payload.title ??
        event.payload.overall ??
        `${event.type} from ${event.source}`,
    );
    const body = String(
      event.payload.message ??
        event.payload.detail ??
        JSON.stringify(event.payload).slice(0, 500),
    );

    if (mode === "dry_run") {
      return {
        mode,
        ok: true,
        dry_run: true,
        event_type: event.type,
        title,
        delivery_status: "dry_run",
        message_id: null,
        error: null,
        commander_pipeline_used: false,
        api_called: false,
      };
    }

    // Live path — reuse Commander pipeline only
    try {
      const configUrl = pathToFileURL(
        join(REPO_ROOT, "SOS/runtime/src/config.ts"),
      ).href;
      const pipelineUrl = pathToFileURL(
        join(REPO_ROOT, "SOS/runtime/src/services/notification-pipeline.ts"),
      ).href;

      const { loadConfig } = await import(configUrl);
      const { sendLifecycleNotification } = await import(pipelineUrl);
      const config = loadConfig();

      const delivery = await sendLifecycleNotification(config, null, {
        correlation_id: event.correlation_id ?? event.id,
        source: `aios:${event.source}`,
        caller: "NotificationLiveBridge",
        title: `[AI OS] ${title}`,
        body,
        type: "info",
        priority: priorityForEvent(event.type),
        metadata: {
          aios_event_id: event.id,
          aios_event_type: event.type,
          aios_bridge: true,
        },
      });

      return {
        mode: "live",
        ok: delivery.telegram_ok || delivery.delivery_status === "sent",
        dry_run: false,
        event_type: event.type,
        title,
        delivery_status: delivery.delivery_status,
        message_id: delivery.message_id,
        error: delivery.error,
        commander_pipeline_used: true,
        api_called: delivery.api_called,
      };
    } catch (e) {
      return {
        mode: "live",
        ok: false,
        dry_run: false,
        event_type: event.type,
        title,
        delivery_status: "failed",
        message_id: null,
        error: e instanceof Error ? e.message : String(e),
        commander_pipeline_used: true,
        api_called: false,
      };
    }
  }
}
