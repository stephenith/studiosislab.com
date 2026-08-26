import type { EventEnvelope } from "./types.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const AGENTS = new Set([
  "pm",
  "developer",
  "qa",
  "documentation",
  "deploy",
  "research",
  "seo",
  "marketing",
  "dispatcher",
  "system",
]);

const TYPES = new Set([
  "task_request",
  "task_assigned",
  "task_progress",
  "task_complete",
  "blocker",
  "failure",
  "approval_request",
  "approval_response",
  "escalation",
  "info",
]);

const PRIORITIES = new Set(["P0", "P1", "P2", "P3"]);

const APPROVAL_STATUSES = new Set([
  "not_required",
  "pending",
  "approved",
  "rejected",
  "deferred",
]);

export class EventValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EventValidationError";
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function parseEventLine(line: string, lineNumber: number): EventEnvelope {
  const trimmed = line.trim();
  if (!trimmed) {
    throw new EventValidationError(`Line ${lineNumber}: empty line`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new EventValidationError(`Line ${lineNumber}: invalid JSON`);
  }

  return validateEvent(parsed, lineNumber);
}

export function validateEvent(raw: unknown, context = 0): EventEnvelope {
  if (!isRecord(raw)) {
    throw new EventValidationError(`Line ${context}: event must be an object`);
  }

  const required = [
    "event_id",
    "timestamp",
    "tenant_id",
    "repo_id",
    "agent",
    "type",
    "priority",
    "title",
    "body",
    "correlation_id",
    "requires_approval",
    "approval_status",
  ] as const;

  for (const field of required) {
    if (!(field in raw)) {
      throw new EventValidationError(`Line ${context}: missing field '${field}'`);
    }
  }

  const event_id = String(raw.event_id);
  const correlation_id = String(raw.correlation_id);
  if (!UUID_RE.test(event_id)) {
    throw new EventValidationError(`Line ${context}: invalid event_id UUID`);
  }
  if (!UUID_RE.test(correlation_id)) {
    throw new EventValidationError(`Line ${context}: invalid correlation_id UUID`);
  }

  const timestamp = String(raw.timestamp);
  if (Number.isNaN(Date.parse(timestamp))) {
    throw new EventValidationError(`Line ${context}: invalid timestamp`);
  }

  const agent = String(raw.agent);
  const type = String(raw.type);
  const priority = String(raw.priority);
  const approval_status = String(raw.approval_status);

  if (!AGENTS.has(agent)) {
    throw new EventValidationError(`Line ${context}: invalid agent '${agent}'`);
  }
  if (!TYPES.has(type)) {
    throw new EventValidationError(`Line ${context}: invalid type '${type}'`);
  }
  if (!PRIORITIES.has(priority)) {
    throw new EventValidationError(`Line ${context}: invalid priority '${priority}'`);
  }
  if (!APPROVAL_STATUSES.has(approval_status)) {
    throw new EventValidationError(
      `Line ${context}: invalid approval_status '${approval_status}'`,
    );
  }

  const title = String(raw.title);
  if (title.length === 0 || title.length > 200) {
    throw new EventValidationError(`Line ${context}: title must be 1–200 chars`);
  }

  const body = String(raw.body);
  if (body.length === 0) {
    throw new EventValidationError(`Line ${context}: body is required`);
  }

  const requires_approval = Boolean(raw.requires_approval);
  if (requires_approval && approval_status === "not_required") {
    throw new EventValidationError(
      `Line ${context}: requires_approval true but approval_status is not_required`,
    );
  }

  const envelope: EventEnvelope = {
    event_id,
    timestamp,
    tenant_id: String(raw.tenant_id),
    repo_id: String(raw.repo_id),
    agent: agent as EventEnvelope["agent"],
    type: type as EventEnvelope["type"],
    priority: priority as EventEnvelope["priority"],
    title,
    body,
    correlation_id,
    requires_approval,
    approval_status: approval_status as EventEnvelope["approval_status"],
  };

  if (raw.project_id !== undefined) {
    envelope.project_id = String(raw.project_id);
  }

  if (raw.evidence !== undefined) {
    if (!Array.isArray(raw.evidence)) {
      throw new EventValidationError(`Line ${context}: evidence must be an array`);
    }
    envelope.evidence = raw.evidence.map(String);
  }

  if (raw.metadata !== undefined) {
    if (!isRecord(raw.metadata)) {
      throw new EventValidationError(`Line ${context}: metadata must be an object`);
    }
    envelope.metadata = raw.metadata;
  }

  return envelope;
}
