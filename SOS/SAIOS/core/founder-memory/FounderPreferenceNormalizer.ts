/**
 * Deterministic Founder preference normalization — no LLM.
 */

export type IssueType =
  | "SPACING"
  | "HIERARCHY"
  | "UNIQUENESS"
  | "TYPOGRAPHY"
  | "LAYOUT_BALANCE"
  | "CONTENT_INTEGRITY"
  | "OTHER";

const MAX_RULE_CHARS = 160;

export function classifyIssueType(text: string): IssueType {
  const t = text.toLowerCase();
  if (
    /\b(fabricat|invent|truthful|factual|credential|fake\s+metric|made[- ]up)\b/.test(
      t,
    )
  ) {
    return "CONTENT_INTEGRITY";
  }
  if (/\b(spacing|gap|whitespace|white\s*space|rhythm|margin|padding)\b/.test(t)) {
    return "SPACING";
  }
  if (/\b(hierarchy|header|heading|title\s*size|name\s*size)\b/.test(t)) {
    return "HIERARCHY";
  }
  if (
    /\b(generic|similar|same\s+look|unique|distinct|repetitive|clone|cookie[- ]cutter)\b/.test(
      t,
    )
  ) {
    return "UNIQUENESS";
  }
  if (/\b(font|typeface|typography|type\s*scale|letter[- ]spacing)\b/.test(t)) {
    return "TYPOGRAPHY";
  }
  if (
    /\b(balance|sidebar|column|empty\s+space|lower[- ]page|uneven|sparse)\b/.test(
      t,
    )
  ) {
    return "LAYOUT_BALANCE";
  }
  return "OTHER";
}

/** Clean whitespace; preserve meaning; max 160 chars. Never broaden to GLOBAL wording. */
export function normalizeRuleText(raw: string): string {
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  if (cleaned.length <= MAX_RULE_CHARS) return cleaned;
  return `${cleaned.slice(0, MAX_RULE_CHARS - 1).trimEnd()}…`;
}

export function isMeaningfulFeedback(text: string): boolean {
  const t = normalizeRuleText(text);
  if (t.length < 8) return false;
  const lower = t.toLowerCase();
  if (
    /^(ok|fine|no|yes|lgtm|approved|reject(ed)?|n\/a|none|test)\.?$/.test(lower)
  ) {
    return false;
  }
  if (
    /founder decision from templates ready for review/i.test(t) ||
    /^approve(d)?\.?$/i.test(t)
  ) {
    return false;
  }
  return true;
}

export function isGenericRejection(text: string): boolean {
  const t = normalizeRuleText(text).toLowerCase();
  if (!t) return true;
  return (
    /^(i\s+don'?t\s+like\s+it|don'?t\s+like\s+it|not\s+good|bad|no|reject(ed)?|dislike)\.?$/.test(
      t,
    ) || t.length < 12
  );
}

export function signalTypeForChangeRequest(issue: IssueType): "CONSTRAINT" | "PREFERENCE" {
  if (issue === "CONTENT_INTEGRITY" || issue === "SPACING" || issue === "LAYOUT_BALANCE") {
    return "CONSTRAINT";
  }
  return "PREFERENCE";
}
