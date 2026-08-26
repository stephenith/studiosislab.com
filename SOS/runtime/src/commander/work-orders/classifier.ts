import type { WorkOrderClassification, WorkOrderPriority } from "./types.js";

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function classifyWorkOrder(rawMessage: string): WorkOrderClassification {
  const n = normalize(rawMessage);

  if (/\b(cursor agent|create (the )?(first )?agent|new agent|agent for)\b/.test(n)) {
    return "create_agent";
  }
  if (/\b(runtime bug|commander bug|pm loop|developer runtime|worker crash)\b/.test(n)) {
    return "runtime_bug";
  }
  if (/\b(bug|fix|broken|regression|fails?|error)\b/.test(n)) {
    return "bug_fix";
  }
  if (/\b(qa|verify|test coverage|verification)\b/.test(n)) {
    return "qa_task";
  }
  if (/\b(research|investigate|audit|analyze|spike)\b/.test(n)) {
    return "research_task";
  }
  if (/\b(roadmap|epic|milestone|backlog)\b/.test(n)) {
    return "roadmap_task";
  }
  if (/\b(status|what(?:'s| is) happening|how are things)\b/.test(n)) {
    return "status_question";
  }
  if (
    /\b(build|create|implement|add|feature|mobile|editor|invoice|generator|hub|dashboard)\b/.test(n)
  ) {
    return "product_feature";
  }

  return "unknown";
}

export function inferWorkOrderPriority(
  classification: WorkOrderClassification,
  rawMessage: string,
): WorkOrderPriority {
  const n = normalize(rawMessage);
  if (/\b(urgent|critical|asap|p0|immediately)\b/.test(n)) return "P0";
  if (classification === "runtime_bug" || classification === "bug_fix") return "P1";
  if (classification === "create_agent" || classification === "product_feature") return "P1";
  if (classification === "qa_task") return "P2";
  if (classification === "research_task" || classification === "roadmap_task") return "P2";
  return "P2";
}

export function suggestedNextAction(classification: WorkOrderClassification): string {
  switch (classification) {
    case "create_agent":
      return "Open the Cursor prompt on the laptop and run the agent in Composer or Cloud.";
    case "runtime_bug":
      return "Run the agent prompt against SOS/runtime only — do not change src/ until verified.";
    case "bug_fix":
      return "Review the prompt, then execute in Cursor with scoped file changes.";
    case "qa_task":
      return "Use the prompt to drive QA verification or add regression coverage.";
    case "research_task":
      return "Run as an Ask/Plan agent first; save findings to SOS/09_REPORTS/.";
    case "roadmap_task":
      return "Review prompt output, then add to backlog via PM if approved.";
    case "product_feature":
      return "Execute the Cursor prompt on the laptop when online; keep Commander running.";
    case "status_question":
      return "Use STATUS on Telegram for live runtime state; this order is for Cursor follow-up.";
    default:
      return "Review the generated prompt and run it in Cursor when the laptop is online.";
  }
}
