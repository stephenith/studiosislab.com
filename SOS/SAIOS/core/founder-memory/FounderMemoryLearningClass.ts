/**
 * C3 — read-side Founder Memory learning class.
 * Does not rewrite historical JSONL. Classifies stored text so selection can
 * exclude task-specific instructions and deterministic safety from reusable
 * preference retrieval.
 */
import { classifyIssueType } from "./FounderPreferenceNormalizer.js";
import type { FounderPreferenceMemoryRecord } from "./FounderPreferenceMemoryTypes.js";

const LAYOUT_ISSUE_TYPES = new Set([
  "SPACING",
  "HIERARCHY",
  "TYPOGRAPHY",
  "LAYOUT_BALANCE",
  "UNIQUENESS",
]);

function looksLikeLayoutPreference(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const issue = classifyIssueType(t);
  if (issue === "CONTENT_INTEGRITY") return false;
  if (LAYOUT_ISSUE_TYPES.has(issue)) return true;
  return /\b(spacing|gap|padding|margin|align|hierarchy|typography|font|layout|sidebar|column|rhythm|whitespace|balance|compact)\b/i.test(
    t,
  );
}

export const FOUNDER_MEMORY_LEARNING_CLASS_SCHEMA =
  "founder-memory-learning-class-1.0.0" as const;

export type MemoryLearningClass =
  | "DETERMINISTIC_SAFETY"
  | "TASK_SPECIFIC"
  | "LEARNED_PREFERENCE"
  | "DESIGN_FAMILY_PREFERENCE"
  | "ROLE_VOICE"
  | "NEGATIVE"
  | "UNCLASSIFIED";

const PAGE_FIT_RE =
  /\b(page[- ]fit|fit (on|to) one page|one[- ]page fit|overflow(s)? (the )?page|content (below|outside|past) the page)\b/i;

const TASK_TITLE_CHANGE_RE =
  /\b(professional title|job title|role title|header title|the title)\b[\s\S]{0,80}\b(from|to)\b/i;

const TASK_ROLE_SWAP_RE =
  /\b(marketing manager|operations analyst|graphic designer|hr manager|human resources)\b[\s\S]{0,100}\b(operations analyst|marketing manager|hr manager|human resources|graphic designer)\b/i;

const TASK_CHANGE_TITLE_TO_RE =
  /\bchange\b[\s\S]{0,80}\b(title|role|profession)\b[\s\S]{0,60}\bto\b/i;

const ROLE_VOICE_RE =
  /\b(writing voice|tone of voice|do not mention|never mention|banned (phrase|title|role)|source[- ]role residue|role voice)\b/i;

const UNIVERSAL_LAYOUT_INVARIANT_RE =
  /\b(must not|never|no|avoid|prevent|without|ensure no|do not)\b[\s\S]{0,40}\b(overlap|overlapp|collide|collision|clip|clipped|clipping|truncat|cut off|out[- ]of[- ]bounds|off[- ]page|outside the page|exceed(s)? (its|the) (text ?box|bounds|page))\b/i;

const POSITIVE_SEPARATION_RE =
  /\b(maintain|keep|ensure|preserve|require)\b[\s\S]{0,40}\b(positive (separation|spacing|gap)|non-?overlapping|minimum (separation|spacing|gap)|clear separation)\b/i;

export function isDeterministicSafetyText(text: string): boolean {
  const t = String(text ?? "").trim();
  if (!t) return false;
  if (UNIVERSAL_LAYOUT_INVARIANT_RE.test(t) || POSITIVE_SEPARATION_RE.test(t)) {
    return true;
  }
  return PAGE_FIT_RE.test(t);
}

export function isTaskSpecificInstruction(text: string): boolean {
  const t = String(text ?? "").trim();
  if (!t) return false;
  if (TASK_TITLE_CHANGE_RE.test(t)) return true;
  if (TASK_CHANGE_TITLE_TO_RE.test(t)) return true;
  if (TASK_ROLE_SWAP_RE.test(t)) return true;
  return false;
}

export function classifyMemoryLearningClass(
  text: string,
  rec?: Pick<
    FounderPreferenceMemoryRecord,
    "status" | "acceptance_result" | "signal_type" | "scope" | "positive_or_negative"
  > | null,
): MemoryLearningClass {
  const t = String(text ?? "").trim();
  if (
    rec?.status === "REJECTED" ||
    rec?.acceptance_result === "rejected" ||
    rec?.positive_or_negative === "negative" && rec.signal_type === "NEGATIVE_EXEMPLAR"
  ) {
    if (rec.status === "REJECTED" || rec.acceptance_result === "rejected") {
      return "NEGATIVE";
    }
  }

  if (isDeterministicSafetyText(t)) return "DETERMINISTIC_SAFETY";
  if (isTaskSpecificInstruction(t)) return "TASK_SPECIFIC";
  if (ROLE_VOICE_RE.test(t)) return "ROLE_VOICE";

  if (looksLikeLayoutPreference(t)) {
    if (rec?.scope === "DESIGN_FAMILY" || rec?.scope === "ARCHITECTURE") {
      return "DESIGN_FAMILY_PREFERENCE";
    }
    return "LEARNED_PREFERENCE";
  }

  return "UNCLASSIFIED";
}

export function isReusableLearningClass(
  cls: MemoryLearningClass,
): boolean {
  return (
    cls === "LEARNED_PREFERENCE" ||
    cls === "DESIGN_FAMILY_PREFERENCE" ||
    cls === "ROLE_VOICE"
  );
}

export function isLayoutOnlyFeedbackIR(ir: {
  completeness_sections?: string[] | null;
  items?: Array<{ action?: string }> | null;
} | null | undefined): boolean {
  if (!ir) return false;
  const completeness = ir.completeness_sections ?? [];
  if (completeness.length > 0) return false;
  const items = ir.items ?? [];
  return !items.some(
    (i) =>
      i.action === "CONTENT_MUTATION" || i.action === "CONTENT_REMOVAL",
  );
}
