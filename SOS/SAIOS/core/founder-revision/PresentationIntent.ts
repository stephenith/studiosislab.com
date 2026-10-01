/**
 * C1 implementation detail: content-preserving presentation structure.
 * Not a second public semantic owner — compileFounderFeedbackIR remains public.
 *
 * PresentationSpec is a multi-constraint contract. Compatible constraints
 * survive together. Approximate or axis-ambiguous grouping is represented
 * but is not silently promoted into a unique invented grid.
 */
import type { ContentSectionKey } from "./RevisionIntentScope.js";

export type PresentationStructure =
  | "inline"
  | "vertical"
  | "bullets"
  | "stacked"
  | "side_by_side"
  | "columns";

export type PresentationArrangement =
  | "inline"
  | "vertical"
  | "side_by_side"
  | "columns";

export type PresentationMarkers = "none" | "bullets";

export type PresentationConstraintStrength =
  | "required"
  | "approximate"
  | "context";

export type PresentationGroupingAxis = "row" | "column";

export type PresentationGroupingSpec = {
  items_per_group?: number;
  column_count?: number;
  axis?: PresentationGroupingAxis;
  continue_beside?: boolean;
  strength: PresentationConstraintStrength;
  executable: boolean;
  ambiguity?: string;
};

export type PresentationCompactnessSpec = {
  strength: PresentationConstraintStrength;
};

export type PresentationSpec = {
  arrangement?: PresentationArrangement;
  markers?: PresentationMarkers;
  grouping?: PresentationGroupingSpec;
  compactness?: PresentationCompactnessSpec;
  forbidden_arrangements: PresentationArrangement[];
  forbidden_markers: PresentationMarkers[];
  preserve: boolean;
  executable: boolean;
  ambiguity?: string;
  /** Categorical projection for existing consumers. */
  desired: PresentationStructure;
  forbidden: PresentationStructure[];
};

const STRUCTURE_RE =
  /\b(?:pointers?|bullet(?:s| points?)?|list(?:ing)?|stacked|stack(?:ing)?|one below another|one after another|separate lines?|side by side|two columns?|columns?|inline|vertical(?:ly)?|horizontal(?:ly)?|in a row|per row|per column|beside(?: it)?)\b/i;

const PRESENTATION_ARRANGE_RE =
  /\b(?:display|show|arrange|format|present|put each|put these|put them|keep these|keep them|make this a|make them|want it to be)\b/i;

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
    /\b(?:replac(?:e|ing)|rewrit(?:e|ing)|reword|from\s+.+\s+to\s+)\b/i.test(
      text,
    )
  ) {
    return false;
  }
  return (
    PRESENTATION_ARRANGE_RE.test(text) ||
    /\b(?:one below another|one after another|separate lines?|side by side|stack(?:ed|ing)?|pointers?|in a row|per row|per column|beside(?: it)?)\b/i.test(
      text,
    )
  );
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function collectArrangements(text: string): PresentationArrangement[] {
  const out: PresentationArrangement[] = [];
  if (/\b(?:side by side|side-by-side)\b/i.test(text)) out.push("side_by_side");
  if (
    /\b(?:two columns?|columns?)\b/i.test(text) &&
    !/\b(?:one column)\b/i.test(text)
  ) {
    out.push("columns");
  }
  if (
    /\b(?:one below another|separate lines?|vertical(?:ly)?|stack(?:ed|ing)?)\b/i.test(
      text,
    )
  ) {
    out.push("vertical");
  }
  if (/\b(?:one after another|inline|horizontal(?:ly)?)\b/i.test(text)) {
    out.push("inline");
  }
  if (/\blist(?:ing)?\b/i.test(text) && !/\b(?:pointers?|bullet)/i.test(text)) {
    out.push("vertical");
  }
  return unique(out);
}

function collectMarkers(text: string): PresentationMarkers[] {
  if (/\b(?:pointers?|bullet(?:s| points?)?)\b/i.test(text)) return ["bullets"];
  return [];
}

function leaveStateSpan(line: string): string {
  const m = line.match(
    /\b(?:currently|right now|as of now).{0,160}?(?=\bbut\b|\bwant\b|\.|$)/i,
  );
  return m?.[0] ?? "";
}

function stripNegationAndLeave(line: string): string {
  return line
    .replace(/\b(?:currently|right now|as of now).{0,160}?(?=\bbut\b|\bwant\b|\.|$)/gi, " ")
    .replace(/\b(?:not|do not|don't|never)\s+[^.;]+/gi, " ");
}

function compileGrouping(line: string): PresentationGroupingSpec | undefined {
  const approx = /\b(?:may be|maybe|perhaps|around|about|roughly|approximately)\b/i.test(
    line,
  );
  const exact = /\b(?:exactly|precisely)\b/i.test(line);
  const twoCols = /\b(?:two columns?|in two columns?)\b/i.test(line);
  const nMatch =
    line.match(
      /\b(?:may be|maybe|exactly|precisely|around|about|roughly|approximately)?\s*(\d+)\s+(?:pointers?|items?|skills?|entries|bullets?)?\s*(?:in a row|per row|per column|per (?:group|line))\b/i,
    ) ??
    line.match(
      /\b(\d+)\s+(?:pointers?|items?|skills?|entries|bullets?)\s+in a row\b/i,
    ) ??
    line.match(/\b(\d+)\s+per\s+(?:row|column|group|line)\b/i);
  const inRow = /\b(?:in a row|per row)\b/i.test(line);
  const perCol = /\bper column\b/i.test(line);
  const beside =
    /\bbeside(?: it)?\b/i.test(line) ||
    /\bcontinue(?: it)? beside\b/i.test(line);
  if (!nMatch && !beside && !inRow && !perCol && !twoCols) return undefined;

  const n = nMatch ? Number(nMatch[1]) : undefined;
  let axis: PresentationGroupingAxis | undefined;
  if (twoCols && !inRow) axis = "column";
  else if (perCol && !inRow) axis = "column";
  else if (inRow && !beside && !perCol) axis = "row";
  else if (beside && !inRow) axis = "column";
  else if (inRow && beside) axis = undefined;

  const strength: PresentationConstraintStrength =
    exact || (twoCols && !approx) || (typeof n === "number" && !approx && axis != null)
      ? "required"
      : "approximate";

  const column_count = twoCols ? 2 : undefined;
  const executable =
    strength === "required" &&
    ((axis === "row" && typeof n === "number") ||
      (axis === "column" && (typeof n === "number" || column_count === 2)));
  let ambiguity: string | undefined;
  if (!executable) {
    if (axis == null && inRow && beside) ambiguity = "row_and_beside_axis_unresolved";
    else if (strength === "approximate") ambiguity = "cardinality_approximate";
    else ambiguity = "grouping_underspecified";
  }
  return {
    items_per_group: n,
    column_count,
    axis,
    continue_beside: beside || twoCols,
    strength,
    executable,
    ambiguity,
  };
}

function compileCompactness(line: string): PresentationCompactnessSpec | undefined {
  if (
    /\bso that\b.{0,100}\b(?:empty|space|bottom|compact|footprint)\b/i.test(line) ||
    /\b(?:looks empty|more space|empty space|footprint)\b/i.test(line)
  ) {
    return { strength: "context" };
  }
  return undefined;
}

function projectDesired(spec: {
  arrangement?: PresentationArrangement;
  markers?: PresentationMarkers;
}): PresentationStructure {
  if (spec.arrangement === "side_by_side") return "side_by_side";
  if (spec.arrangement === "columns") return "columns";
  if (spec.markers === "bullets") return "bullets";
  if (spec.arrangement === "vertical") return "vertical";
  if (spec.arrangement === "inline") return "inline";
  return "vertical";
}

function projectForbidden(
  arrangements: PresentationArrangement[],
  markers: PresentationMarkers[],
): PresentationStructure[] {
  const out: PresentationStructure[] = [];
  for (const a of arrangements) out.push(a);
  if (markers.includes("bullets")) out.push("bullets");
  return unique(out);
}

export function compilePresentationSpec(line: string): PresentationSpec | null {
  if (!hasPresentationIntent(line)) return null;
  const leave = leaveStateSpan(line);
  const desiredSpan = stripNegationAndLeave(line);
  const forbidden: PresentationStructure[] = [];
  const forbidden_arrangements: PresentationArrangement[] = [];
  const forbidden_markers: PresentationMarkers[] = [];
  const prohibit = line.match(/\b(?:not|do not|don't|never)\s+([^.;]+)/gi) ?? [];
  for (const chunk of prohibit) {
    forbidden_arrangements.push(...collectArrangements(chunk));
    forbidden_markers.push(...collectMarkers(chunk));
  }
  forbidden_arrangements.push(...collectArrangements(leave));
  const arrangements = collectArrangements(desiredSpan).filter(
    (a) => !forbidden_arrangements.includes(a),
  );
  const markers = collectMarkers(desiredSpan).filter(
    (m) => !forbidden_markers.includes(m),
  );
  const grouping = compileGrouping(desiredSpan);
  const compactness = compileCompactness(line);
  const preserve =
    /\b(?:keep|preserve|retain|maintain)\b/i.test(line) &&
    !/\b(?:display|show|arrange|format|put each|make|want)\b/i.test(line);

  let arrangement: PresentationArrangement | undefined;
  let ambiguity: string | undefined;
  if (arrangements.includes("side_by_side")) arrangement = "side_by_side";
  else if (arrangements.includes("columns")) arrangement = "columns";
  else if (arrangements.includes("vertical") && arrangements.includes("inline")) {
    ambiguity = "arrangement_conflict";
  } else if (arrangements.includes("vertical")) arrangement = "vertical";
  else if (arrangements.includes("inline")) arrangement = "inline";
  else if (forbidden_arrangements.includes("inline")) arrangement = "vertical";

  const marker = markers.includes("bullets") ? "bullets" : undefined;
  const hardLayout = Boolean(arrangement || marker);
  const groupingBlocks =
    grouping != null &&
    grouping.strength === "required" &&
    grouping.executable === false;
  const executable =
    !groupingBlocks &&
    ambiguity !== "arrangement_conflict" &&
    (hardLayout || Boolean(grouping?.executable) || preserve);

  if (
    !arrangement &&
    !marker &&
    !grouping &&
    forbidden_arrangements.length === 0 &&
    !preserve
  ) {
    return null;
  }

  if (!executable) {
    ambiguity =
      ambiguity ??
      grouping?.ambiguity ??
      (hardLayout ? undefined : "structured_presentation_underspecified");
  }

  const desired = projectDesired({ arrangement, markers: marker });
  return {
    arrangement,
    markers: marker,
    grouping,
    compactness,
    forbidden_arrangements: unique(forbidden_arrangements),
    forbidden_markers: unique(forbidden_markers),
    preserve,
    executable,
    ambiguity,
    desired,
    forbidden: unique([
      ...forbidden,
      ...projectForbidden(forbidden_arrangements, forbidden_markers),
    ]),
  };
}

const STRONG_LIST_SEP = /\s*(?:·|•|\|)\s*/;

export function tokenizeSectionContent(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[•·|,/]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ""))
    .filter((w) => w.length > 1);
}

function closeFor(ch: string): string | null {
  if (ch === "(") return ")";
  if (ch === "[") return "]";
  if (ch === "{") return "}";
  if (ch === '"') return '"';
  if (ch === "'") return "'";
  return null;
}

function splitNestAware(text: string, delimiter: string): string[] {
  const items: string[] = [];
  let buf = "";
  const stack: string[] = [];
  for (const ch of text) {
    const closer = closeFor(ch);
    const top = stack[stack.length - 1];
    if (top && ch === top) {
      stack.pop();
      buf += ch;
      continue;
    }
    if (closer && (ch === "(" || ch === "[" || ch === "{" || top !== '"' && top !== "'")) {
      if (ch === '"' || ch === "'") {
        stack.push(closer);
        buf += ch;
        continue;
      }
      if (!top || (top !== '"' && top !== "'")) {
        stack.push(closer);
        buf += ch;
        continue;
      }
    }
    if (stack.length === 0 && ch === delimiter) {
      const t = buf.trim();
      if (t) items.push(t);
      buf = "";
      continue;
    }
    buf += ch;
  }
  const tail = buf.trim();
  if (tail) items.push(tail);
  return items;
}

function splitLineItems(line: string): string[] {
  const stripped = line.replace(/^[•·\-–—*]\s+/, "").trim();
  if (!stripped) return [];
  if (STRONG_LIST_SEP.test(stripped)) {
    return stripped
      .split(STRONG_LIST_SEP)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (/,/.test(stripped)) {
    return splitNestAware(stripped, ",").map((s) => s.trim()).filter(Boolean);
  }
  return [stripped];
}

export function splitLogicalItems(text: string): string[] {
  const byLine = text.split(/\n/).map((s) => s.trim()).filter(Boolean);
  if (byLine.length > 1) {
    return byLine.flatMap(splitLineItems);
  }
  return splitLineItems(text);
}

export function splitInlineItems(text: string): string[] {
  return splitLogicalItems(text);
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
    const anyVertical = bodies.some((t) => /\n/.test(t));
    if (uniqueLeftBands.size >= 2 && (topSpan > 24 || anyVertical)) {
      return "columns";
    }
    if (leftSpan > 40 && topSpan < 16) return "side_by_side";
    if (topSpan > 12) return "stacked";
  }
  const joined = bodies.join("\n");
  if (/\n/.test(joined)) {
    const lines = joined.split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.some((l) => /^[•·\-–—*]\s+/.test(l))) return "bullets";
    return "vertical";
  }
  if (STRONG_LIST_SEP.test(joined) && bodies.length <= 1) return "inline";
  if (/,\s+/.test(joined) && bodies.length <= 1) return "inline";
  return "inline";
}

export function inferPresentationMarkers(texts: string[]): PresentationMarkers {
  const joined = texts.join("\n");
  if (/(?:^|\n)\s*[•·\-–—*]\s+/.test(joined)) return "bullets";
  return "none";
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

function arrangementSatisfied(
  actual: PresentationStructure,
  desired?: PresentationArrangement,
): boolean {
  if (!desired) return true;
  if (desired === actual) return true;
  if (desired === "vertical" && (actual === "stacked" || actual === "bullets")) {
    return true;
  }
  if (desired === "columns" && actual === "columns") return true;
  if (desired === "side_by_side" && actual === "side_by_side") return true;
  if (desired === "inline" && actual === "inline") return true;
  return false;
}

function countItemsOnLines(texts: string[]): number[] {
  return texts.flatMap((t) =>
    t
      .split(/\n/)
      .map((l) => splitLogicalItems(l).length)
      .filter((n) => n > 0),
  );
}

export function presentationContractSatisfied(input: {
  actual: PresentationStructure;
  texts: string[];
  boxes: Array<{ left: number; top: number }>;
  spec: PresentationSpec;
}): boolean {
  const spec = input.spec;
  if (!spec.executable && !spec.preserve) return false;
  if (spec.forbidden.includes(input.actual)) return false;
  if (spec.forbidden_arrangements.includes(input.actual as PresentationArrangement)) {
    return false;
  }
  if (!arrangementSatisfied(input.actual, spec.arrangement)) return false;
  if (spec.markers === "bullets" && inferPresentationMarkers(input.texts) !== "bullets") {
    return false;
  }
  const grouping = spec.grouping;
  if (grouping?.executable && grouping.strength === "required") {
    if (grouping.axis === "row" && grouping.items_per_group) {
      const counts = countItemsOnLines(input.texts);
      if (counts.length === 0) return false;
      const n = grouping.items_per_group;
      const head = counts.slice(0, -1);
      const last = counts[counts.length - 1]!;
      if (head.some((c) => c !== n)) return false;
      if (last > n) return false;
    }
    if (
      (grouping.axis === "column" || spec.arrangement === "columns") &&
      (grouping.column_count === 2 || spec.arrangement === "columns")
    ) {
      if (input.actual !== "columns" && input.actual !== "side_by_side") {
        return false;
      }
      if (input.boxes.length < 2) return false;
    }
  }
  if (spec.arrangement || spec.markers || grouping?.executable) return true;
  return presentationSatisfied(input.actual, spec);
}

export function renderPresentation(
  items: string[],
  desired: PresentationStructure,
  markers?: PresentationMarkers,
): string {
  const clean = items
    .map((s) => s.replace(/^[•·\-–—*]\s+/, "").trim())
    .filter(Boolean);
  const useBullets = markers === "bullets" || desired === "bullets";
  if (desired === "inline" && !useBullets) return clean.join("  ·  ");
  if (useBullets) return clean.map((s) => `• ${s}`).join("\n");
  return clean.join("\n");
}

export function renderRowGroups(
  items: string[],
  perRow: number,
  markers?: PresentationMarkers,
): string {
  const clean = items
    .map((s) => s.replace(/^[•·\-–—*]\s+/, "").trim())
    .filter(Boolean);
  const rows: string[] = [];
  for (let i = 0; i < clean.length; i += perRow) {
    const chunk = clean.slice(i, i + perRow);
    const inner = chunk.join("  ·  ");
    rows.push(markers === "bullets" ? `• ${inner}` : inner);
  }
  return rows.join("\n");
}

export function sectionKeysFromLine(text: string): ContentSectionKey[] {
  const out: ContentSectionKey[] = [];
  if (/\bskills?\b/i.test(text)) out.push("skills");
  if (/\beducation\b/i.test(text)) out.push("education");
  if (/\bsummary\b/i.test(text)) out.push("summary");
  if (/\bexperience\b/i.test(text)) out.push("experience");
  if (/\bprojects?\b/i.test(text)) out.push("projects");
  if (/\bcertifications?\b/i.test(text)) out.push("certifications");
  if (/\blanguages?\b/i.test(text)) out.push("languages");
  return [...new Set(out)];
}
