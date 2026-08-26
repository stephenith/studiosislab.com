/**
 * SAIOS Telegram integration — public exports
 */

export { TelegramBridge } from "./TelegramBridge.js";
export type { TelegramBridgeOptions } from "./TelegramBridge.js";
export { FounderCommandParser } from "./FounderCommandParser.js";
export { FounderSession } from "./FounderSession.js";
export { SaiosGateway } from "./SaiosGateway.js";
export type { SaiosGatewayOptions } from "./SaiosGateway.js";
export { LegacyTelegramAdapter, RecordingTelegramAdapter } from "./LegacyTelegramAdapter.js";

export type {
  ParsedFounderCommand,
  TelegramInboundLike,
  TelegramBridgeResult,
  FounderSessionRecord,
  JobStatusSummary,
  SubmitFounderCommandResult,
  CompletionNotificationRecord,
  TelegramAdapter,
} from "./types.js";
