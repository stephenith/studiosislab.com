/**
 * C1 implementation detail: content-preserving presentation structure.
 * Not a second public semantic owner — compileFounderFeedbackIR remains public.
 */
import type { ContentSectionKey } from "./RevisionIntentScope.js";

export type PresentationStructure =
  | "inline"
  | "vertical"
  | "bullets"
  | "stacked"
  | "side_by_side"
  | "columns";

export type PresentationSpec = {
  desired: PresentationStructure;
  forbidden: PresentationStructure[];
  preserve: boolean;
};

const STRUCTURE_RE =
  /\b(?:pointers?|bullet(?:s| points?)?|list(?:ing)?|stacked|stack(?:ing)?|one below another|one after another|separate lines?|side by side|two columns?|columns?|inline|vertical(?:ly)?|horizontal(?:ly)?)\b/i;

const PRESENTATION_ARRANGE_RE =
  /\b(?:display|show|arrange|format|present|put each|put these|put them|keep these|keep them|make this a|make them)\b/i;

export function hasPresentationStructureLanguage(text: string): boolean {
  return STRUCTURE_RE.test(text);
}

export function hasPresentationIntent(text: string): boolean {
  if (!hasPresentationStructureLanguage(text)) return false;
  if (
    /\b(?:add(?:ing)?|insert(?:ing)?|expand(?:ing)?|more content|additional content)\b/i.test(
      text,
    ) &&
    !PRESENTATION_ARRANGE_RE.test(text)
  ) {
    return false;
  }
  if (
    /\b(?:replac(?:e|ing)|rewrit(?:e|ing)|reword|from\s+.+\s+to\s+)\b/i.test(text)
  ) {
    return false;
  }
  return (
    PRESENTATION_ARRANGE_RE.test(text) ||
    /\b(?:one below another|one after another|separate lines?|side by side|stack(?:ed|ing)?|pointers?)\b/i.test(
      text,
    )
  );
}

function structureFromPhrase(text: string): PresentationStructure | null {
  if (/\b(?:side by side|side-by-side)\b/i.test(text)) return "side_by_side";
  if (/\b(?:two columns?|columns?)\b/i.test(text) && !/\b(?:one column)\b/i.test(text)) {
    return "columns";
  }
  if (/\b(?:pointers?|bullet(?:s| points?)?)\b/i.test(text)) return "bullets";
  if (/\b(?:one below another|separate lines?|vertical(?:ly)?)\b/i.test(text)) {
    return "vertical";
  }
  if (/\bstack(?:ed|ing)?\b/i.test(text)) return "stacked";
  if (/\b(?:one after another|inline|horizontal(?:ly)?)\b/i.test(text)) {
    return "inline";
  }
  if (/\blist(?:ing)?\b/i.test(text)) return "vertical";
  return null;
}

export function compilePresentationSpec(line: string): PresentationSpec | null {
  if (!hasPresentationIntent(line)) return null;
  const forbidden: PresentationStructure[] = [];
  const prohibit =
    line.match(
      /\b(?:not|do not|don't|never)\s+([^.;]+)/gi,
    ) ?? [];
  for (const chunk of prohibit) {
    const s = structureFromPhrase(chunk);
    if (s) forbidden.push(s);
  }
  const desired =
    structureFromPhrase(line.replace(/\b(?:not|do not|don't|never)\s+[^.;]+/gi, " ")) ??
    (forbidden.includes("inline") ? "vertical" : null);
  if (!desired && forbidden.length === 0) return null;
  const preserve = /\b(?:keep|preserve|retain|maintain)\b/i.test(line) &&
    !/\b(?:display|show|arrange|format|put each|make)\b/i.test(line);
  return {
    desired: desired ?? "vertical",
    forbidden: [...new Set(forbidden)],
    preserve,
  };
}

const INLINE_SEP = /\s*(?:·|•|,|\||\/)\s*/;

export function tokenizeSectionContent(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[•·|,/]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ""))
    .filter((w) => w.length > 1);
}

export function inferPresentationFromTexts(
  texts: string[],
  boxes: Array<{ left: number; top: number }>,
): PresentationStructure {
  const bodies = texts.filter((t) => t.trim().length > 0);
  if (boxes.length >= 2) {
    const tops = boxes.map((b) => b.top);
    const lefts = boxes.map((b) => b.left);
    const topSpan = Math.max(...tops) - Math.min(...tops);
    const leftSpan = Math.max(...lefts) - Math.min(...lefts);
    const uniqueLeftBands = new Set(lefts.map((l) => Math.round(l / 40)));
    if (uniqueLeftBands.size >= 2 && topSpan > 24) return "columns";
    if (leftSpan > 40 && topSpan < 16) return "side_by_side";
    if (topSpan > 12) return "stacked";
  }
  const joined = bodies.join("\n");
  if (/\n/.test(joined)) {
    const lines = joined.split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.some((l) => /^[•·\-–—*]\s+/.test(l))) return "bullets";
    return "vertical";
  }
  if (INLINE_SEP.test(joined) && bodies.length <= 1) return "inline";
  return "inline";
}

export function presentationSatisfied(
  actual: PresentationStructure,
  spec: PresentationSpec,
): boolean {
  if (spec.forbidden.includes(actual)) return false;
  if (spec.preserve) return true;
  if (spec.desired === actual) return true;
  if (
    spec.desired === "vertical" &&
    (actual === "stacked" || actual === "bullets")
  ) {
    return true;
  }
  if (spec.desired === "stacked" && (actual === "vertical" || actual === "bullets")) {
    return true;
  }
  if (spec.desired === "bullets" && (actual === "vertical" || actual === "stacked")) {
    return true;
  }
  return false;
}

export function splitInlineItems(text: string): string[] {
  const byLine = text.split(/\n/).map((s) => s.trim()).filter(Boolean);
  if (byLine.length > 1) {
    return byLine.map((l) => l.replace(/^[•·\-–—*]\s+/, "").trim());
  }
  return text
    .split(INLINE_SEP)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function renderPresentation(
  items: string[],
  desired: PresentationStructure,
): string {
  const clean = items.map((s) => s.replace(/^[•·\-–—*]\s+/, "").trim()).filter(Boolean);
  if (desired === "inline") return clean.join("  ·  ");
  if (desired === "bullets") return clean.map((s) => `• ${s}`).join("\n");
  return clean.join("\n");
}

export function sectionKeysFromLine(text: string): ContentSectionKey[] {
  const out: ContentSectionKey[] = [];
  if (/\bskills?\b/i.test(text)) out.push("skills");
  if (/\beducation\b/i.test(text)) out.push("education");
  if (/\bsummary\b/i.test(text)) out.push("summary");
  if (/\bexperience\b/i.test(text)) out.push("experience");
  if (/\bprojects?\b/i.test(text)) out.push("projects");
  if (/\bcertifications?\b/i.test(text)) out.push("certifications");
  return [...new Set(out)];
}
