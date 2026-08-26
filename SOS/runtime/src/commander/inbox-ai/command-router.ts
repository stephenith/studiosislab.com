import type { RuntimeConfig } from "../../config.js";
import { getPmPaths } from "../../pm/paths.js";
import { loadState, saveState } from "../../pm/state.js";
import { writeShutdownFlag, clearShutdownFlag } from "../../runtime/shutdown.js";
import {
  loadConversation,
  saveConversation,
  rememberSubject,
} from "./conversation.js";
import { classifyIntent, resolveSubjectFromConversation } from "./intent-classifier.js";
import {
  loadPlatformStatus,
  loadQueueSummary,
  loadNextTaskRecommendation,
} from "./status.js";
import {
  pauseTaskByReference,
  resumeTaskByReference,
  prioritizeTaskByReference,
} from "./task-router.js";
import {
  createTaskFromInbox,
  createEpicFromInbox,
  refreshRoadmapFromInbox,
  executeNowFromInbox,
} from "./planner.js";
import {
  buildHelpReply,
  buildStatusReply,
  buildDeveloperReply,
  buildQaReply,
  buildPmReply,
  buildQueueReply,
  buildRoadmapReply,
  buildNextTaskReply,
  buildResultReply,
  buildUnknownReply,
  buildConfirmationPrompt,
} from "./reply-builder.js";
import type { InboxCommandResult, StructuredAction } from "./types.js";
import {
  tryHandleWorkOrderCommand,
  shouldCaptureAsWorkOrder,
  createWorkOrderFromMessage,
} from "../work-orders/router.js";

async function executeIntent(
  config: RuntimeConfig,
  action: StructuredAction,
): Promise<{ result: InboxCommandResult; replyBody: string }> {
  const paths = getPmPaths(config);
  const state = await loadState(paths);
  const base = (runtime_action: string): InboxCommandResult => ({
    ok: false,
    intent: action.intent,
    action,
    runtime_action,
    error: null,
  });

  switch (action.intent) {
    case "HELP":
      return {
        result: { ...base("help"), ok: true },
        replyBody: buildHelpReply(),
      };

    case "STATUS": {
      const status = await loadPlatformStatus(config);
      return {
        result: { ...base("getPmStatus+getDeveloperStatus+getQaStatus"), ok: true, details: { queue: status.queue_count } },
        replyBody: buildStatusReply(status),
      };
    }

    case "SHOW_DEVELOPER": {
      const status = await loadPlatformStatus(config);
      return {
        result: { ...base("getDeveloperStatus"), ok: true },
        replyBody: buildDeveloperReply(status),
      };
    }

    case "SHOW_QA": {
      const status = await loadPlatformStatus(config);
      return {
        result: { ...base("getQaStatus"), ok: true },
        replyBody: buildQaReply(status),
      };
    }

    case "SHOW_PM": {
      const status = await loadPlatformStatus(config);
      return {
        result: { ...base("getPmStatus"), ok: true },
        replyBody: buildPmReply(status),
      };
    }

    case "SHOW_QUEUE": {
      const items = await loadQueueSummary(config);
      return {
        result: { ...base("loadQueueSummary"), ok: true, details: { count: items.length } },
        replyBody: buildQueueReply(items),
      };
    }

    case "SHOW_ROADMAP": {
      const status = await loadPlatformStatus(config);
      return {
        result: { ...base("buildRoadmapStatus"), ok: true },
        replyBody: buildRoadmapReply(status.roadmap),
      };
    }

    case "NEXT_TASK": {
      const next = await loadNextTaskRecommendation(config);
      return {
        result: { ...base("reloadPlanningContext"), ok: true, details: next as unknown as Record<string, unknown> },
        replyBody: buildNextTaskReply(next),
      };
    }

    case "PAUSE_TASK": {
      const subject = action.subject ?? "current task";
      const out = await pauseTaskByReference(config, paths, state, subject);
      return {
        result: {
          ...base("pauseTaskByReference"),
          ok: out.ok,
          details: out.details,
          error: out.ok ? null : out.message,
        },
        replyBody: out.message,
      };
    }

    case "RESUME_TASK": {
      const subject = action.subject ?? "paused task";
      const out = await resumeTaskByReference(config, paths, state, subject);
      return {
        result: {
          ...base("resumeTaskByReference"),
          ok: out.ok,
          details: out.details,
          error: out.ok ? null : out.message,
        },
        replyBody: out.message,
      };
    }

    case "CHANGE_PRIORITY": {
      const subject = action.subject ?? action.target ?? "next task";
      const out = await prioritizeTaskByReference(config, paths, state, subject);
      return {
        result: {
          ...base("prioritizeTaskByReference"),
          ok: out.ok,
          details: out.details,
          error: out.ok ? null : out.message,
        },
        replyBody: out.message,
      };
    }

    case "EXECUTE_NOW": {
      const instruction = action.subject ?? action.raw_text;
      const out = await executeNowFromInbox(config, instruction);
      return {
        result: {
          ...base("executeNowFromInbox+assignDeveloper"),
          ok: out.ok,
          details: out.details,
          error: out.ok ? null : out.message,
        },
        replyBody: out.message,
      };
    }

    case "CREATE_TASK": {
      const title = action.subject ?? "New task";
      const out = await createTaskFromInbox(config, title, action.quantity ?? 1);
      return {
        result: {
          ...base("createTaskFromInbox+maintainRoadmap+planNextTask"),
          ok: out.ok,
          details: out.details,
          error: out.ok ? null : out.message,
        },
        replyBody: out.message,
      };
    }

    case "CREATE_EPIC": {
      const out = await createEpicFromInbox(config, action.subject ?? "New epic");
      return {
        result: {
          ...base("createEpicFromInbox"),
          ok: out.ok,
          details: out.details,
        },
        replyBody: out.message,
      };
    }

    case "CREATE_ROADMAP": {
      if (action.destructive) {
        return {
          result: { ...base("pending_confirmation"), ok: false },
          replyBody: buildConfirmationPrompt("This will remove the roadmap."),
        };
      }
      const out = await refreshRoadmapFromInbox(config);
      return {
        result: {
          ...base("maintainRoadmap"),
          ok: out.ok,
          details: out.details,
        },
        replyBody: out.message,
      };
    }

    case "STOP_ALL": {
      await writeShutdownFlag(config.logsRoot, "commander_inbox_stop_all", "commander");
      const pmState = await loadState(paths);
      pmState.loop_status = "stopped";
      await saveState(paths, pmState);
      return {
        result: { ...base("writeShutdownFlag"), ok: true },
        replyBody: "Runtime stop requested. Workers will drain and exit gracefully.",
      };
    }

    case "START_ALL": {
      await clearShutdownFlag(config.logsRoot);
      const pmState = await loadState(paths);
      pmState.loop_status = "running";
      await saveState(paths, pmState);
      return {
        result: { ...base("clearShutdownFlag"), ok: true },
        replyBody: "Runtime resumed. PM loop set to running — restart Commander if workers are stopped.",
      };
    }

    case "UNKNOWN":
    default:
      return {
        result: { ...base("none"), ok: false, error: "unknown_intent" },
        replyBody: buildUnknownReply(),
      };
  }
}

export async function routeInboxCommand(
  config: RuntimeConfig,
  userMessage: string,
): Promise<{ result: InboxCommandResult; reply: string; conversationUpdated: boolean }> {
  const workOrderCmd = await tryHandleWorkOrderCommand(config, userMessage);
  if (workOrderCmd) {
    return { ...workOrderCmd, conversationUpdated: false };
  }

  let conversation = await loadConversation(config);
  let action = classifyIntent(userMessage, conversation);

  if (action.intent === "CONFIRM" && conversation.pending_confirmation) {
    const pending = conversation.pending_confirmation;
    conversation.pending_confirmation = null;
    if (userMessage.toUpperCase().includes("DELETE")) {
      const paths = getPmPaths(config);
      const state = await loadState(paths);
      state.roadmap = undefined;
      await saveState(paths, state);
      await saveConversation(config, conversation);
      return {
        result: {
          ok: true,
          intent: "CONFIRM",
          action: { intent: "CONFIRM", raw_text: userMessage, confidence: 1 },
          runtime_action: "clearRoadmapState",
        },
        reply: "Roadmap state cleared. Run \"Generate a new roadmap\" to rebuild from backlog.",
        conversationUpdated: true,
      };
    }
    await saveConversation(config, conversation);
    return {
      result: {
        ok: false,
        intent: "CONFIRM",
        action: { intent: "CONFIRM", raw_text: userMessage, confidence: 1 },
        runtime_action: "confirmation_cancelled",
      },
      reply: "Cancelled.",
      conversationUpdated: true,
    };
  }

  if (action.destructive) {
    conversation.pending_confirmation = {
      action: "delete_roadmap",
      intent: action.intent,
      payload: {},
      created_at: new Date().toISOString(),
    };
    await saveConversation(config, conversation);
    return {
      result: {
        ok: false,
        intent: action.intent,
        action,
        runtime_action: "await_confirmation",
      },
      reply: buildConfirmationPrompt("This will remove the roadmap."),
      conversationUpdated: true,
    };
  }

  action = resolveSubjectFromConversation(action, conversation);

  if (shouldCaptureAsWorkOrder(action)) {
    const captured = await createWorkOrderFromMessage(config, userMessage, action);
    await saveConversation(config, conversation);
    return {
      result: captured.result,
      reply: captured.reply,
      conversationUpdated: false,
    };
  }

  const { result, replyBody } = await executeIntent(config, action);
  const reply = buildResultReply(result, replyBody);

  if (result.ok && action.subject) {
    rememberSubject(conversation, {
      intent: action.intent,
      subject: action.subject,
      task_id: typeof result.details?.task_id === "string" ? result.details.task_id : null,
      backlog_id: typeof result.details?.backlog_id === "string" ? result.details.backlog_id : null,
    });
    await saveConversation(config, conversation);
    return { result, reply, conversationUpdated: true };
  }

  await saveConversation(config, conversation);
  return { result, reply, conversationUpdated: false };
}
