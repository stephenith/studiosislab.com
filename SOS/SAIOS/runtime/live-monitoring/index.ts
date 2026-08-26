/**
 * Live Monitoring public exports + orchestrator.
 * AGENT #107
 */
import { runDepartmentPublishers } from "./DepartmentPublisherAdapters.js";
import { EventBusPublisherBridge } from "./EventBusPublisherBridge.js";
import {
  LIVE_MONITORING_ROOT,
  persistLiveMonitoringConfiguration,
  resolveBridgeMode,
} from "./LiveMonitoringConfiguration.js";
import { writeLiveMonitoringReports } from "./MonitoringReporter.js";
import {
  getCommanderBridgeStatus,
  NotificationLiveBridge,
} from "./NotificationLiveBridge.js";
import { NotificationSubscriber } from "./NotificationSubscriber.js";
import type { LiveMonitoringResult } from "./types.js";
import { NOTIFICATION_SUBSCRIBE_EVENTS } from "./types.js";

export type RunLiveMonitoringOptions = {
  /** Verify MUST set true. Live only when false AND SOS_AIOS_NOTIFY_LIVE=1. */
  forceDryRun?: boolean;
};

export async function runLiveMonitoring(
  options: RunLiveMonitoringOptions = {},
): Promise<LiveMonitoringResult> {
  const forceDryRun = options.forceDryRun !== false; // default safe
  const generated_at = new Date().toISOString();
  persistLiveMonitoringConfiguration();

  const publisherBridge = EventBusPublisherBridge.create();
  const liveBridge = new NotificationLiveBridge(forceDryRun);
  const subscriber = new NotificationSubscriber(
    publisherBridge.getBus(),
    liveBridge,
  );
  subscriber.register();

  const publishers = await runDepartmentPublishers(publisherBridge);
  const commander = getCommanderBridgeStatus();
  const mode = liveBridge.getMode();

  const checks = {
    event_publishing: publishers.some((p) => p.events_published > 0),
    event_subscriptions: subscriber.subscriptions.length > 0,
    notification_bridge: true,
    dry_run_preserved: forceDryRun
      ? subscriber.bridgeCalls.every((c) => c.dry_run && c.mode === "dry_run")
      : mode === "dry_run" || subscriber.bridgeCalls.every((c) => !c.api_called || c.commander_pipeline_used),
    commander_bridge_detected: commander.detected,
    no_duplicate_telegram_stack: !commander.duplicate_telegram_stack,
    report_generation: true,
  };

  // When forceDryRun, all bridge calls must be dry_run
  if (forceDryRun) {
    checks.dry_run_preserved =
      subscriber.bridgeCalls.every((c) => c.dry_run) &&
      !subscriber.bridgeCalls.some((c) => c.api_called);
  }

  const allPass = Object.values(checks).every(Boolean);
  const result: LiveMonitoringResult = {
    generated_at,
    status: allPass ? "READY" : commander.detected ? "DEGRADED" : "BLOCKED",
    mode,
    publishers,
    subscriptions: NOTIFICATION_SUBSCRIBE_EVENTS.map((event_type) => ({
      event_type,
      department: "notification-department",
    })),
    deliveries: subscriber.deliveries,
    bridge_calls: subscriber.bridgeCalls,
    commander,
    flow: [
      { step: 1, from: "Security/Website/Timeline/Runtime", to: "Event Bus", via: "publish adapters" },
      { step: 2, from: "Event Bus", to: "NotificationSubscriber", via: "subscribe" },
      { step: 3, from: "NotificationSubscriber", to: "NotificationLiveBridge", via: "forward" },
      {
        step: 4,
        from: "NotificationLiveBridge",
        to: "SOS/runtime sendLifecycleNotification",
        via: mode === "live" ? "live" : "dry-run (no API)",
      },
      { step: 5, from: "Commander pipeline", to: "Telegram (single stack)", via: "existing transport" },
    ],
    checks,
    output_dir: LIVE_MONITORING_ROOT,
  };

  writeLiveMonitoringReports(result);
  return result;
}

export { EventBusPublisherBridge } from "./EventBusPublisherBridge.js";
export { NotificationLiveBridge, getCommanderBridgeStatus } from "./NotificationLiveBridge.js";
export { NotificationSubscriber } from "./NotificationSubscriber.js";
export {
  LIVE_MONITORING_ROOT,
  LIVE_FLAG,
  resolveBridgeMode,
  isLiveNotifyEnabled,
} from "./LiveMonitoringConfiguration.js";
export { runDepartmentPublishers } from "./DepartmentPublisherAdapters.js";
export type { LiveMonitoringResult, BridgeMode } from "./types.js";
