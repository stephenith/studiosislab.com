/**
 * C1 fulfillment contracts — compiled once with the IR, evaluated on canvas.
 *
 * Downstream must not re-parse Founder English. It binds IR descriptors to
 * inventory and measures the stored predicates.
 */
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import type {
  FounderFeedbackAction,
  FounderFeedbackIR,
  FounderFeedbackIRItem,
} from "./FounderFeedbackIR.js";
import type { ContentSectionKey } from "./RevisionIntentScope.js";
import {
  compilePresentationSpec,
  inferPresentationFromTexts,
  presentationSatisfied,
  renderPresentation,
  sectionKeysFromLine,
  splitInlineItems,
  tokenizeSectionContent,
  type PresentationStructure,
} from "./PresentationIntent.js";

export const FOUNDER_FEEDBACK_FULFILLMENT_SCHEMA =
  "founder-feedback-fulfillment-1.0.0" as const;

export type ColorFamily =
  | "green"
  | "teal"
  | "blue"
  | "red"
  | "orange"
  | "yellow"
  | "purple"
  | "dark"
  | "light"
  | "any";

export type TargetDescriptor = {
  orientation?: "vertical" | "horizontal";
  side?: "left" | "right";
  shape?: "line" | "rect" | "text";
  color_family?: ColorFamily;
};

export type ExtentBound =
  | "page_bottom"
  | "page_top"
  | "page_left"
  | "page_right";

export type FulfillmentKind =
  | "CONTENT_ADD"
  | "CONTENT_REMOVE"
  | "CONTENT_REWRITE"
  | "GEOMETRY_EXTENT"
  | "PRESERVATION"
  | "PRESENTATION"
  | "VERIFICATION_CHECK";

export type FulfillmentPredicate = {
  kind: FulfillmentKind;
  required: boolean;
  section?: ContentSectionKey;
  target?: TargetDescriptor;
  extent?: ExtentBound;
  /** Compiled desired phrases. Downstream measures these; it does not re-parse English. */
  present_phrases?: string[];
  /** Compiled banned / removed phrases. */
  absent_phrases?: string[];
  presentation?: PresentationStructure;
  forbidden_presentation?: PresentationStructure[];
};

export type FulfillmentEvaluation = {
  schema_version: typeof FOUNDER_FEEDBACK_FULFILLMENT_SCHEMA;
  pass: boolean;
  already_satisfied_on_prior: boolean;
  bound_object_ids: string[];
  notes: string;
};

const COLOR_WORD: ReadonlyArray<readonly [ColorFamily, RegExp]> = [
  ["teal", /\b(?:teal|cyan|turquoise)\b/],
  ["green", /\b(?:green|emerald|mint|lime)\b/],
  ["blue", /\b(?:blue|navy|azure)\b/],
  ["red", /\b(?:red|crimson|scarlet)\b/],
  ["orange", /\b(?:orange|amber)\b/],
  ["yellow", /\b(?:yellow|gold)\b/],
  ["purple", /\b(?:purple|violet|magenta)\b/],
  ["dark", /\b(?:dark|black|charcoal)\b/],
  ["light", /\b(?:light|white|ivory)\b/],
];

export function compileTargetDescriptor(text: string): TargetDescriptor {
  const n = text.toLowerCase();
  const target: TargetDescriptor = {};
  if (/\b(?:vertical|upright)\b/.test(n) || /\b(?:line|rail|rule|divider)\b/.test(n)) {
    target.orientation = "vertical";
  } else if (/\bhorizontal\b/.test(n)) {
    target.orientation = "horizontal";
  }
  if (/\bleft\b/.test(n)) target.side = "left";
  else if (/\bright\b/.test(n)) target.side = "right";
  if (/\b(?:line|rail|rule|stroke|divider)\b/.test(n)) target.shape = "line";
  else if (/\b(?:box|rectangle|rect|bar|band)\b/.test(n)) target.shape = "rect";
  for (const [family, re] of COLOR_WORD) {
    if (re.test(n)) {
      target.color_family = family;
      break;
    }
  }
  return target;
}

/**
 * Extent is a desired-state / imperative reach request, not any mention of
 * top/bottom as a problem location ("compressed near the top").
 */
export function compileExtentBound(text: string): ExtentBound | undefined {
  const n = text.toLowerCase();
  const reach =
    /\b(?:till|until|reach(?:es|ing)?|extend(?:s|ed|ing)?|stretch(?:ed|ing)?|flush)\b/.test(
      n,
    ) ||
    (/\bshould be\b/.test(n) && /\b(?:till|until|to the|to)\b/.test(n));
  const bidirectionalReflow =
    /\bdown(?:ward)?\s+or\s+up(?:ward)?\b/.test(n) ||
    /\bup(?:ward)?\s+or\s+down(?:ward)?\b/.test(n);
  const downward =
    !bidirectionalReflow &&
    /\b(?:down(?:ward)?|taller|full height)\b/.test(n);
  if (/\b(?:move|shift|reposition)\b/.test(n) && !reach) return undefined;
  if (!reach && !downward) return undefined;
  if (
    /\b(?:bottom|foot|page end|page edge)\b/.test(n) ||
    (downward && !/\btop\b/.test(n))
  ) {
    return "page_bottom";
  }
  if (/\btop\b/.test(n) && !/\bbottom\b/.test(n)) return "page_top";
  if (/\bleft\b/.test(n) && /\b(?:edge|flush)\b/.test(n)) return "page_left";
  if (/\bright\b/.test(n) && /\b(?:edge|flush)\b/.test(n)) return "page_right";
  return undefined;
}

const STOP_PHRASE =
  /^(?:the|a|an|other|content|section|skills?|experience|summary|education|projects?|certifications?|details?|more)$/i;

function cleanPhrase(raw: string): string {
  return raw
    .replace(/\s+(?:unless|where appropriate|and other\b|etc\.?).*$/i, "")
    .replace(/[."“”]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitListedPhrases(chunk: string): string[] {
  return chunk
    .split(/\s*(?:,|;|\/|\band\b)\s*/)
    .map(cleanPhrase)
    .filter((p) => p.length >= 3 && !STOP_PHRASE.test(p));
}

/** Listed examples after such as / including / for example / colon. */
export function extractListedPhrases(text: string): string[] {
  const cue = text.match(
    /(?:such as|including|for example|e\.g\.|eg)[:\s]+(.+)$/i,
  );
  if (cue?.[1]) return splitListedPhrases(cue[1]);
  return [];
}

function isSectionNounPhrase(phrase: string): boolean {
  return /^(?:the\s+)?(?:skills?|experience|summary|education|projects?|certifications?|job title|professional title)(?:\s+section)?$/i.test(
    phrase,
  );
}

export function extractRemovalPhrases(text: string): string[] {
  const listed = extractListedPhrases(text);
  const lead = text.match(/^(?:remove|delete|drop|strip)\s+(.+?)(?:\.|$)/i);
  const raw = listed.length
    ? listed
    : lead?.[1]
      ? splitListedPhrases(lead[1])
      : [];
  return raw.filter((p) => !isSectionNounPhrase(p));
}

export function extractRewritePair(
  text: string,
): { from?: string; to?: string } {
  const fromTo = text.match(
    /\bfrom\s+(.+?)\s+to\s+(.+?)(?:\s+while|\s+and\b|\.|$)/i,
  );
  if (fromTo) {
    return { from: cleanPhrase(fromTo[1]!), to: cleanPhrase(fromTo[2]!) };
  }
  return {};
}

export function predicatesForItem(
  action: FounderFeedbackAction,
  clauseActions: FounderFeedbackAction[],
  contentSections: ContentSectionKey[],
  line: string,
): FulfillmentPredicate[] {
  const out: FulfillmentPredicate[] = [];
  const sections = contentSections.length ? contentSections : [undefined];
  if (action === "CONTENT_REMOVAL" || clauseActions.includes("CONTENT_REMOVAL")) {
    const absent = extractRemovalPhrases(line);
    for (const section of sections) {
      out.push({
        kind: "CONTENT_REMOVE",
        required: true,
        section,
        absent_phrases: absent.length ? absent : undefined,
      });
    }
  }
  if (action === "CONTENT_MUTATION" || clauseActions.includes("CONTENT_MUTATION")) {
    const additive =
      /\b(?:add|insert|expand|include|more content|additional)\b/i.test(line);
    const kind: FulfillmentKind = additive ? "CONTENT_ADD" : "CONTENT_REWRITE";
    const pair = extractRewritePair(line);
    for (const section of sections) {
      out.push({
        kind,
        required: true,
        section,
        present_phrases:
          !additive && pair.to ? [pair.to] : undefined,
        absent_phrases:
          !additive && pair.from ? [pair.from] : undefined,
      });
    }
  }
  const extent = compileExtentBound(line);
  if (extent) {
    out.push({
      kind: "GEOMETRY_EXTENT",
      required: true,
      target: compileTargetDescriptor(line),
      extent,
    });
  }
  if (action === "CONTENT_PRESERVATION" || action === "LAYOUT_PRESERVATION") {
    for (const section of contentSections) {
      out.push({ kind: "PRESERVATION", required: true, section });
    }
  }
  if (action === "VERIFICATION") {
    out.push({ kind: "VERIFICATION_CHECK", required: true });
  }
  if (
    action === "PRESENTATION_MUTATION" ||
    action === "PRESENTATION_PRESERVATION" ||
    clauseActions.includes("PRESENTATION_MUTATION") ||
    clauseActions.includes("PRESENTATION_PRESERVATION")
  ) {
    const spec = compilePresentationSpec(line);
    const sections =
      contentSections.length > 0
        ? contentSections
        : sectionKeysFromLine(line);
    for (const section of sections.length ? sections : [undefined]) {
      out.push({
        kind: "PRESENTATION",
        required: true,
        section,
        presentation: spec?.desired,
        forbidden_presentation: spec?.forbidden,
      });
    }
  }
  return out;
}

function parseHex(color: string | null | undefined): number[] | null {
  if (!color) return null;
  const m = String(color).trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let h = m[1]!;
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function hueFamily(rgb: number[]): ColorFamily | null {
  const [r, g, b] = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max < 40) return "dark";
  if (min > 210) return "light";
  const d = max - min;
  if (d < 18) return "dark";
  let hue = 0;
  if (max === r) hue = ((g - b) / d) % 6;
  else if (max === g) hue = (b - r) / d + 2;
  else hue = (r - g) / d + 4;
  hue *= 60;
  if (hue < 0) hue += 360;
  if (hue >= 70 && hue < 160) return "green";
  if (hue >= 160 && hue < 195) return "teal";
  if (hue >= 195 && hue < 260) return "blue";
  if (hue >= 260 && hue < 310) return "purple";
  if (hue >= 20 && hue < 50) return "orange";
  if (hue >= 50 && hue < 70) return "yellow";
  if (hue >= 310 || hue < 20) return "red";
  return null;
}

function colorMatches(family: ColorFamily | undefined, fill: string | null, stroke: string | null): boolean {
  if (!family || family === "any") return true;
  for (const c of [fill, stroke]) {
    const rgb = parseHex(c);
    if (!rgb) continue;
    const got = hueFamily(rgb);
    if (got === family) return true;
    if (family === "green" && got === "teal") return true;
    if (family === "teal" && got === "green") return true;
  }
  return false;
}

type CanvasObj = Record<string, unknown>;

function objectsOf(canvas: FabricCanvasDoc): CanvasObj[] {
  return Array.isArray(canvas.objects) ? (canvas.objects as CanvasObj[]) : [];
}

function objId(o: CanvasObj, i: number): string {
  if (typeof o.id === "string" && o.id.trim()) return o.id;
  const data = o.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const id = (data as { id?: unknown }).id;
    if (typeof id === "string" && id.trim()) return id;
  }
  return `obj-${i}`;
}

function objSection(o: CanvasObj): string {
  const data = o.data && typeof o.data === "object" && !Array.isArray(o.data)
    ? (o.data as { section?: unknown; role?: unknown })
    : {};
  return String(o.section ?? data.section ?? "").toLowerCase();
}

function objRole(o: CanvasObj): string {
  const data = o.data && typeof o.data === "object" && !Array.isArray(o.data)
    ? (o.data as { role?: unknown })
    : {};
  return String(o.role ?? data.role ?? "").toLowerCase();
}

function objText(o: CanvasObj): string {
  return typeof o.text === "string" ? o.text : "";
}

function objectMatchesSection(o: CanvasObj, section?: ContentSectionKey): boolean {
  if (!section) return true;
  const sec = objSection(o);
  if (sec === section) return true;
  if (section === "job_title") {
    const role = objRole(o);
    if (/\b(?:professional_title|job_title|^role$)\b/i.test(role)) return true;
    if (sec === "header" && objText(o)) return true;
  }
  return false;
}

function objBottom(o: CanvasObj): number {
  return Number(o.top ?? 0) + Number(o.height ?? 0);
}

export function bindTargetDescriptor(
  canvas: FabricCanvasDoc,
  target: TargetDescriptor | undefined,
): string[] {
  if (!target) return [];
  const pageW = Number(canvas.width ?? 794);
  const scored: Array<{ id: string; score: number }> = [];
  objectsOf(canvas).forEach((o, i) => {
    const role = objRole(o);
    if (role === "pagebackground" || role === "page-background") return;
    const data = o.data && typeof o.data === "object" && !Array.isArray(o.data)
      ? (o.data as { system?: unknown })
      : {};
    if (data.system === true) return;
    const w = Number(o.width ?? 0);
    const h = Number(o.height ?? 0);
    const left = Number(o.left ?? 0);
    const type = String(o.type ?? "").toLowerCase();
    let score = 0;
    if (target.orientation === "vertical" && w <= 16 && h >= 80) score += 3;
    if (target.orientation === "horizontal" && h <= 16 && w >= 80) score += 3;
    if (target.side === "left" && left < pageW / 3) score += 2;
    if (target.side === "right" && left > (pageW * 2) / 3) score += 2;
    if (target.shape === "line" && (type.includes("line") || (type.includes("rect") && w <= 16))) {
      score += 2;
    }
    if (target.shape === "rect" && type.includes("rect")) score += 1;
    if (
      colorMatches(
        target.color_family,
        typeof o.fill === "string" ? o.fill : null,
        typeof o.stroke === "string" ? o.stroke : null,
      )
    ) {
      score += target.color_family ? 2 : 0;
    }
    if (score >= 1) scored.push({ id: objId(o, i), score });
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map((s) => s.id);
}

function sectionCorpus(canvas: FabricCanvasDoc, section?: ContentSectionKey): { count: number; length: number; texts: string[] } {
  const texts: string[] = [];
  for (const o of objectsOf(canvas)) {
    if (!objectMatchesSection(o, section)) continue;
    const t = objText(o);
    if (t) texts.push(t);
  }
  return {
    count: texts.length,
    length: texts.reduce((n, t) => n + t.length, 0),
    texts,
  };
}

function corpusHasPhrase(corpus: { texts: string[] }, phrase: string): boolean {
  const n = corpus.texts.join("\n").toLowerCase();
  return n.includes(phrase.toLowerCase());
}

function evaluatePredicate(
  predicate: FulfillmentPredicate,
  before: FabricCanvasDoc,
  after: FabricCanvasDoc,
): { pass: boolean; ids: string[]; notes: string } {
  if (predicate.kind === "CONTENT_ADD") {
    const a = sectionCorpus(after, predicate.section);
    const b = sectionCorpus(before, predicate.section);
    const pass = a.length > b.length + 16 || a.count > b.count;
    return {
      pass,
      ids: [],
      notes: pass
        ? `content add ${predicate.section ?? "packet"} ${b.length}→${a.length}`
        : `content add unsatisfied ${predicate.section ?? "packet"} ${b.length}→${a.length}`,
    };
  }
  if (predicate.kind === "CONTENT_REMOVE") {
    const a = sectionCorpus(after, predicate.section);
    const b = sectionCorpus(before, predicate.section);
    const absent = predicate.absent_phrases ?? [];
    let pass: boolean;
    if (absent.length) {
      const remaining = absent.filter((p) => corpusHasPhrase(a, p));
      pass = remaining.length === 0;
      return {
        pass,
        ids: [],
        notes: pass
          ? `content remove ${predicate.section ?? "packet"} absent=${absent.length}`
          : `content remove unsatisfied ${predicate.section ?? "packet"} remaining=${remaining.join("|")}`,
      };
    }
    pass = a.length < b.length - 8 || a.count < b.count || (b.length > 0 && a.length === 0);
    return {
      pass,
      ids: [],
      notes: pass
        ? `content remove ${predicate.section ?? "packet"}`
        : `content remove unsatisfied ${predicate.section ?? "packet"}`,
    };
  }
  if (predicate.kind === "CONTENT_REWRITE") {
    const a = sectionCorpus(after, predicate.section);
    const b = sectionCorpus(before, predicate.section);
    const present = predicate.present_phrases ?? [];
    const absent = predicate.absent_phrases ?? [];
    if (present.length || absent.length) {
      const missing = present.filter((p) => !corpusHasPhrase(a, p));
      const leftover = absent.filter((p) => corpusHasPhrase(a, p));
      const pass = missing.length === 0 && leftover.length === 0;
      return {
        pass,
        ids: [],
        notes: pass
          ? `content rewrite ${predicate.section ?? "packet"} target present`
          : `content rewrite unsatisfied ${predicate.section ?? "packet"} missing=${missing.join("|")} leftover=${leftover.join("|")}`,
      };
    }
    const pass = a.texts.join("\n") !== b.texts.join("\n");
    return {
      pass,
      ids: [],
      notes: pass
        ? `content rewrite ${predicate.section ?? "packet"}`
        : `content rewrite unsatisfied ${predicate.section ?? "packet"}`,
    };
  }
  if (predicate.kind === "PRESENTATION") {
    const beforeBodies = presentationBodies(before, predicate.section);
    const afterBodies = presentationBodies(after, predicate.section);
    const actual = inferPresentationFromTexts(
      afterBodies.texts,
      afterBodies.boxes,
    );
    const spec = {
      desired: predicate.presentation ?? "vertical",
      forbidden: predicate.forbidden_presentation ?? [],
      preserve: false,
    };
    const structureOk = presentationSatisfied(actual, spec);
    const beforeTokens = new Set(beforeBodies.texts.flatMap(tokenizeSectionContent));
    const afterTokens = new Set(afterBodies.texts.flatMap(tokenizeSectionContent));
    const overlap = [...beforeTokens].filter((t) => afterTokens.has(t)).length;
    const contentOk =
      beforeTokens.size === 0 ||
      overlap / Math.max(beforeTokens.size, 1) >= 0.7;
    const pass = structureOk && contentOk;
    return {
      pass,
      ids: [],
      notes: pass
        ? `presentation ${predicate.section ?? "packet"} ${actual}`
        : `presentation unsatisfied ${predicate.section ?? "packet"} actual=${actual} desired=${spec.desired}`,
    };
  }
  if (predicate.kind === "PRESERVATION") {
    const a = sectionCorpus(after, predicate.section);
    const b = sectionCorpus(before, predicate.section);
    const pass = a.texts.join("\n") === b.texts.join("\n");
    return {
      pass,
      ids: [],
      notes: pass
        ? `preserved ${predicate.section ?? "packet"}`
        : `preservation broken ${predicate.section ?? "packet"}`,
    };
  }
  if (predicate.kind === "GEOMETRY_EXTENT") {
    const pageH = Number(after.height ?? 1123);
    const pageW = Number(after.width ?? 794);
    const ids = bindTargetDescriptor(after, predicate.target);
    const byId = new Map(
      objectsOf(after).map((o, i) => [objId(o, i), o] as const),
    );
    const bound =
      predicate.extent === "page_bottom"
        ? pageH - 8
        : predicate.extent === "page_top"
          ? 8
          : predicate.extent === "page_left"
            ? 8
            : pageW - 8;
    let pass = false;
    for (const id of ids) {
      const o = byId.get(id);
      if (!o) continue;
      if (predicate.extent === "page_bottom" && objBottom(o) >= bound) pass = true;
      if (predicate.extent === "page_top" && Number(o.top ?? 99) <= bound) pass = true;
      if (predicate.extent === "page_left" && Number(o.left ?? 99) <= bound) pass = true;
      if (
        predicate.extent === "page_right" &&
        Number(o.left ?? 0) + Number(o.width ?? 0) >= bound
      ) {
        pass = true;
      }
    }
    return {
      pass,
      ids,
      notes: pass
        ? `extent ${predicate.extent} satisfied on ${ids[0] ?? "target"}`
        : `extent ${predicate.extent} unsatisfied (bound=${bound}, ids=${ids.join(",") || "unbound"})`,
    };
  }
  return { pass: true, ids: [], notes: "verification check deferred to acceptance" };
}

export function evaluateItemFulfillment(input: {
  item: FounderFeedbackIRItem;
  beforeCanvas: FabricCanvasDoc;
  afterCanvas: FabricCanvasDoc;
}): FulfillmentEvaluation {
  const required = (input.item.fulfillment ?? []).filter((p) => p.required);
  if (required.length === 0) {
    return {
      schema_version: FOUNDER_FEEDBACK_FULFILLMENT_SCHEMA,
      pass: true,
      already_satisfied_on_prior: false,
      bound_object_ids: [],
      notes: "no required fulfillment predicate",
    };
  }
  const notes: string[] = [];
  const ids: string[] = [];
  let pass = true;
  for (const predicate of required) {
    const ev = evaluatePredicate(predicate, input.beforeCanvas, input.afterCanvas);
    notes.push(ev.notes);
    ids.push(...ev.ids);
    if (!ev.pass) pass = false;
  }
  const prior = evaluateItemFulfillmentOnCanvas(input.item, input.beforeCanvas);
  return {
    schema_version: FOUNDER_FEEDBACK_FULFILLMENT_SCHEMA,
    pass,
    already_satisfied_on_prior: prior,
    bound_object_ids: [...new Set(ids)],
    notes: notes.join("; "),
  };
}

function evaluateItemFulfillmentOnCanvas(
  item: FounderFeedbackIRItem,
  canvas: FabricCanvasDoc,
): boolean {
  const required = (item.fulfillment ?? []).filter((p) => p.required);
  if (required.length === 0) return false;
  return required.every((predicate) => {
    if (predicate.kind === "CONTENT_ADD" || predicate.kind === "CONTENT_REWRITE") {
      return false;
    }
    return evaluatePredicate(predicate, canvas, canvas).pass;
  });
}

export function applyAlreadySatisfiedProof(
  ir: FounderFeedbackIR,
  canvas: FabricCanvasDoc,
): FounderFeedbackIR {
  return {
    ...ir,
    items: ir.items.map((item) => {
      if (item.action === "VERIFICATION") {
        return item;
      }
      if (!evaluateItemFulfillmentOnCanvas(item, canvas)) return item;
      if (item.action !== "LAYOUT_MUTATION") return item;
      return {
        ...item,
        action: "ALREADY_SATISFIED" as const,
        coverage_mode: "VERIFICATION_ACCEPTANCE" as const,
      };
    }),
  };
}

export function itemRequiresMutationFulfillment(item: FounderFeedbackIRItem): boolean {
  return (item.fulfillment ?? []).some(
    (p) =>
      p.required &&
      (p.kind === "CONTENT_ADD" ||
        p.kind === "CONTENT_REMOVE" ||
        p.kind === "CONTENT_REWRITE" ||
        p.kind === "GEOMETRY_EXTENT" ||
        p.kind === "PRESENTATION"),
  );
}

function isSectionHeadingText(text: string): boolean {
  return /^(skills?|education|experience|summary|projects?|certifications?)$/i.test(
    text.trim(),
  );
}

function presentationBodies(
  canvas: FabricCanvasDoc,
  section?: ContentSectionKey,
): { texts: string[]; boxes: Array<{ left: number; top: number }> } {
  const texts: string[] = [];
  const boxes: Array<{ left: number; top: number }> = [];
  for (const o of objectsOf(canvas)) {
    if (!objectMatchesSection(o, section)) continue;
    const t = objText(o);
    if (!t || isSectionHeadingText(t)) continue;
    texts.push(t);
    boxes.push({ left: Number(o.left ?? 0), top: Number(o.top ?? 0) });
  }
  return { texts, boxes };
}

export function applyPresentationMutations(
  canvas: FabricCanvasDoc,
  ir: FounderFeedbackIR,
): FabricCanvasDoc {
  const clone = JSON.parse(JSON.stringify(canvas)) as FabricCanvasDoc;
  for (const item of ir.items) {
    for (const predicate of item.fulfillment ?? []) {
      if (predicate.kind !== "PRESENTATION" || !predicate.presentation) continue;
      if (
        predicate.presentation === "side_by_side" ||
        predicate.presentation === "columns"
      ) {
        continue;
      }
      for (const o of objectsOf(clone)) {
        if (!objectMatchesSection(o, predicate.section)) continue;
        const t = objText(o);
        if (!t || isSectionHeadingText(t)) continue;
        o.text = renderPresentation(splitInlineItems(t), predicate.presentation);
      }
    }
  }
  return clone;
}
