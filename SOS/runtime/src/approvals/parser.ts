import type { CommanderCommandType, ParsedCommanderDecision } from "./types.js";

function normalizeLine(raw: string): string {
  const line = raw
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith(">"));
  if (!line) return "";
  return line.toUpperCase().replace(/\s+/g, " ").trim();
}

export function parseCommanderDecision(raw: string): ParsedCommanderDecision | null {
  const upper = normalizeLine(raw);
  if (!upper) return null;

  let m = upper.match(/^APPROVE ([A-Z])(?: WITH NOTES (.+))?$/);
  if (m) {
    return {
      command: "APPROVE",
      option_key: m[1],
      notes: m[2]?.trim(),
      raw: raw.trim(),
    };
  }

  m = upper.match(/^REJECT(?: (.+))?$/);
  if (m) {
    return { command: "REJECT", notes: m[1]?.trim(), raw: raw.trim() };
  }

  m = upper.match(/^DEFER(?: (\d+)H)?$/);
  if (m) {
    return {
      command: "DEFER",
      defer_hours: m[1] ? parseInt(m[1], 10) : 24,
      raw: raw.trim(),
    };
  }

  if (upper === "ESTOP ALL" || upper === "ESTOP") {
    return { command: "ESTOP", raw: raw.trim() };
  }

  m = upper.match(/^PRIORITY (P[0-3])$/);
  if (m) {
    return {
      command: "PRIORITY",
      priority_level: m[1] as ParsedCommanderDecision["priority_level"],
      raw: raw.trim(),
    };
  }

  if (upper === "CANCEL") {
    return { command: "CANCEL", raw: raw.trim() };
  }

  m = upper.match(/^DELEGATE ([A-Z_]+)$/);
  if (m) {
    return {
      command: "DELEGATE",
      delegate_target: m[1].toLowerCase(),
      raw: raw.trim(),
    };
  }

  if (upper === "ACK") {
    return { command: "APPROVE", option_key: "A", notes: "ACK", raw: raw.trim() };
  }

  return null;
}

export function toPmResponseCommand(decision: ParsedCommanderDecision): string {
  switch (decision.command) {
    case "APPROVE":
      return decision.notes
        ? `APPROVE ${decision.option_key ?? "A"} WITH NOTES ${decision.notes}`
        : `APPROVE ${decision.option_key ?? "A"}`;
    case "REJECT":
      return decision.notes ? `REJECT ${decision.notes}` : "REJECT";
    case "DEFER":
      return `DEFER ${decision.defer_hours ?? 24}H`;
    case "CANCEL":
      return "REJECT";
    case "DELEGATE":
      return `APPROVE A WITH NOTES DELEGATED to ${decision.delegate_target ?? "developer"}`;
    default:
      return decision.raw;
  }
}

export function isPmResolvableCommand(command: CommanderCommandType): boolean {
  return (
    command === "APPROVE"
    || command === "REJECT"
    || command === "DEFER"
    || command === "CANCEL"
    || command === "DELEGATE"
  );
}
