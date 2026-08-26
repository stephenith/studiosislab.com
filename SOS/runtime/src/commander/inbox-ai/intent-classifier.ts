import type { ConversationState } from "./types.js";
import type { InboxIntent, StructuredAction } from "./types.js";
import { classifyExecuteNow } from "./execution-classifier.js";

export function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

function extractAfterVerb(text: string, verbs: string[]): string | null {
  const n = normalize(text);
  for (const verb of verbs) {
    const idx = n.indexOf(verb);
    if (idx === -1) continue;
    const rest = n.slice(idx + verb.length).trim();
    if (rest) return rest;
  }
  return null;
}

function looksLikeConfirm(text: string): boolean {
  const n = normalize(text);
  return n === "yes delete" || n === "yes" || n === "confirm" || n === "yes stop";
}

function classifyDestructive(text: string): boolean {
  const n = normalize(text);
  return /\bdelete\b/.test(n) && /\broadmap\b/.test(n);
}

export function classifyIntent(
  text: string,
  conversation: ConversationState,
): StructuredAction {
  const raw = text.trim();
  const n = normalize(raw);

  if (conversation.pending_confirmation && looksLikeConfirm(raw)) {
    return {
      intent: "CONFIRM",
      raw_text: raw,
      confidence: 0.95,
    };
  }

  if (classifyDestructive(raw)) {
    return {
      intent: "CREATE_ROADMAP",
      subject: "delete",
      destructive: true,
      raw_text: raw,
      confidence: 0.9,
    };
  }

  if (/^(help|commands|what can you do)\b/.test(n) || n === "?") {
    return { intent: "HELP", raw_text: raw, confidence: 0.95 };
  }

  if (
    /\b(status|what(?:'s| is) happening|what are you doing|current state)\b/.test(n)
    || n === "status"
  ) {
    return { intent: "STATUS", raw_text: raw, confidence: 0.9 };
  }

  if (/\b(what is developer|developer doing|dev status|show developer)\b/.test(n)) {
    return { intent: "SHOW_DEVELOPER", raw_text: raw, confidence: 0.9 };
  }

  if (/\b(what is qa|qa doing|qa status|show qa)\b/.test(n)) {
    return { intent: "SHOW_QA", raw_text: raw, confidence: 0.9 };
  }

  if (/\b(what is pm|pm doing|show pm)\b/.test(n)) {
    return { intent: "SHOW_PM", raw_text: raw, confidence: 0.9 };
  }

  if (
    /\b(show queue|show backlog|tasks left|how many tasks|what(?:'s| is) in the queue)\b/.test(n)
    || /\bqueue\b/.test(n)
  ) {
    return { intent: "SHOW_QUEUE", raw_text: raw, confidence: 0.85 };
  }

  if (/\b(show roadmap|roadmap status|roadmap %|roadmap progress)\b/.test(n) || n === "roadmap") {
    return { intent: "SHOW_ROADMAP", raw_text: raw, confidence: 0.9 };
  }

  if (
    /\b(what should we build next|next task|what to build|build next)\b/.test(n)
  ) {
    return { intent: "NEXT_TASK", raw_text: raw, confidence: 0.9 };
  }

  if (/\b(stop all|halt all|stop runtime|stop all runtime|emergency stop)\b/.test(n)) {
    return { intent: "STOP_ALL", raw_text: raw, confidence: 0.92 };
  }

  if (/\b(start all|resume runtime|start runtime|resume all workers)\b/.test(n)) {
    return { intent: "START_ALL", raw_text: raw, confidence: 0.9 };
  }

  if (/\b(generate (a )?new roadmap|create roadmap|refresh roadmap)\b/.test(n)) {
    return { intent: "CREATE_ROADMAP", raw_text: raw, confidence: 0.88 };
  }

  if (/\b(create epic|new epic)\b/.test(n)) {
    const subject = extractAfterVerb(raw, ["create epic", "new epic", "epic"]);
    return { intent: "CREATE_EPIC", subject, raw_text: raw, confidence: 0.85 };
  }

  const qtyMatch = n.match(/create (\d+)\s+(.+)/);
  if (qtyMatch && !classifyExecuteNow(raw)) {
    return {
      intent: "CREATE_TASK",
      quantity: parseInt(qtyMatch[1], 10),
      subject: qtyMatch[2],
      raw_text: raw,
      confidence: 0.88,
    };
  }

  if (classifyExecuteNow(raw)) {
    return {
      intent: "EXECUTE_NOW",
      subject: raw,
      raw_text: raw,
      confidence: 0.92,
    };
  }

  if (
    /\b(build|create|implement|add task|new task|improve)\b/.test(n)
    && !/\broadmap\b/.test(n)
  ) {
    const subject =
      extractAfterVerb(raw, ["build", "create", "implement", "add task", "new task", "improve"]) ?? raw;
    return { intent: "CREATE_TASK", subject, raw_text: raw, confidence: 0.82 };
  }

  if (/\bpause\b/.test(n)) {
    const subject = extractAfterVerb(raw, ["pause"]) ?? conversation.last_subject;
    return { intent: "PAUSE_TASK", subject, raw_text: raw, confidence: 0.85 };
  }

  if (/\bresume\b/.test(n)) {
    const subject = extractAfterVerb(raw, ["resume"]) ?? conversation.last_subject;
    return { intent: "RESUME_TASK", subject, raw_text: raw, confidence: 0.85 };
  }

  if (/\b(before|first|priority|finish .+ first|do .+ before)\b/.test(n)) {
    let subject: string | null = null;
    let before: string | null = null;
    const finishFirst = n.match(/finish (.+?) first/);
    const doBefore = n.match(/do (.+?) before (.+)/);
    const beforeMatch = n.match(/(.+?) before (.+)/);
    if (finishFirst) subject = finishFirst[1];
    else if (doBefore) {
      subject = doBefore[1];
      before = doBefore[2];
    } else if (beforeMatch) {
      subject = beforeMatch[1];
      before = beforeMatch[2];
    } else {
      subject = extractAfterVerb(raw, ["priority", "finish"]) ?? conversation.last_subject;
    }
    return {
      intent: "CHANGE_PRIORITY",
      subject,
      before,
      raw_text: raw,
      confidence: 0.8,
    };
  }

  if (
    /\b(do that|continue|not this one|move it|yes do it|go ahead)\b/.test(n)
    && conversation.last_intent
  ) {
    return {
      intent: conversation.last_intent,
      subject: conversation.last_subject,
      raw_text: raw,
      confidence: 0.75,
    };
  }

  return { intent: "UNKNOWN", raw_text: raw, confidence: 0.3 };
}

export function resolveSubjectFromConversation(
  action: StructuredAction,
  conversation: ConversationState,
): StructuredAction {
  if (action.subject) return action;
  if (conversation.last_subject) {
    return { ...action, subject: conversation.last_subject };
  }
  return action;
}
