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
import {
  sectionNounHits,
  type ContentSectionKey,
} from "./RevisionIntentScope.js";
import { createRequire } from "node:module";
import {
  compilePresentationSpec,
  inferPresentationFromTexts,
  presentationContractSatisfied,
  renderPresentation,
  renderRowGroups,
  sectionKeysFromLine,
  splitLogicalItems,
  type PresentationSpec,
  type PresentationStructure,
} from "./PresentationIntent.js";
import { inspectRevisionSectionGroups, normalizeRevisionLayout } from "./RevisionLayoutNormalizer.js";
import type { CanvasOperation } from "./revision-task-types.js";
import { isFounderMeasurableSpacingIntent } from "./FounderSpacingIntent.js";
import {
  extractIndependentGapBeforeNeedles,
  isNamedSpacingPairRequest,
  resolveFounderSpacingRelation,
} from "./FounderSpacingRelation.js";
import { evaluateCanonicalFinalStateLayoutProof } from "./CanonicalFinalStateLayoutProof.js";

const require = createRequire(import.meta.url);

function intraBoxOverflow(canvas: FabricCanvasDoc) {
  return (
    require("./RevisionAcceptanceChecks.js") as typeof import("./RevisionAcceptanceChecks.js")
  ).findIntraBoxTextOverflowFindings(canvas);
}

function syncPresentationTextHeights(canvas: FabricCanvasDoc): void {
  (
    require("./PostContentReflow.js") as typeof import("./PostContentReflow.js")
  ).syncStoredTextHeightsToVisual(canvas);
}

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
  quoted_text?: string;
  role?: string;
  section?: ContentSectionKey | "header";
};

export type ExtentBound =
  | "page_bottom"
  | "page_top"
  | "page_left"
  | "page_right";

export type RangeAnchor =
  | { kind: "section"; section: ContentSectionKey; inclusive: boolean }
  | { kind: "header"; inclusive: boolean }
  | { kind: "document_end" };

export type SectionRangeSpec = {
  start: RangeAnchor;
  end: RangeAnchor;
};

export type ReferenceSpec =
  | { kind: "header_name" }
  | { kind: "header_name_only" }
  | { kind: "section"; section: ContentSectionKey }
  | { kind: "body_content" }
  | { kind: "visual"; descriptor: TargetDescriptor }
  | { kind: "explicit_objects"; descriptors: TargetDescriptor[] };

export type RelationalAlignmentSpec = {
  axis: "horizontal" | "vertical";
  edge: "left" | "right" | "center" | "top" | "bottom";
  relation?: "align" | "below" | "above" | "beside";
  tolerance_px: number;
  /** Extra space beyond flush below/above when Founder asked for a clean gap. */
  clearance_px?: number;
};

export const RELATIONAL_ALIGNMENT_TOLERANCE_PX = 2;

export type FulfillmentKind =
  | "CONTENT_ADD"
  | "CONTENT_REMOVE"
  | "CONTENT_REWRITE"
  | "GEOMETRY_EXTENT"
  | "RELATIONAL_ALIGNMENT"
  | "PRESERVATION"
  | "PRESENTATION"
  | "STYLE"
  | "SPACING_PAIR"
  | "VERIFICATION_CHECK";

export type StyleMutationSpec = {
  target: TargetDescriptor;
  fontWeight: "bold";
};

export type FulfillmentPredicate = {
  kind: FulfillmentKind;
  required: boolean;
  section?: ContentSectionKey;
  target?: TargetDescriptor;
  extent?: ExtentBound;
  range?: SectionRangeSpec;
  reference?: ReferenceSpec;
  alignment?: RelationalAlignmentSpec;
  /** Multiple related targets for one relational contract (name + title + contact). */
  targets?: TargetDescriptor[];
  /** Compiled desired phrases. Downstream measures these; it does not re-parse English. */
  present_phrases?: string[];
  /** Compiled banned / removed phrases. */
  absent_phrases?: string[];
  presentation?: PresentationStructure;
  forbidden_presentation?: PresentationStructure[];
  presentation_spec?: PresentationSpec;
  preserve?: ReferenceSpec;
  style?: StyleMutationSpec;
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

function cleanQuotedPhrase(raw: string): string {
  return raw.trim().replace(/[,.;:]+$/g, "").trim();
}

function isContactRowLanguage(n: string): boolean {
  if (/\b(?:rail|rule|divider|vertical\s+line|upright\s+line)\b/.test(n)) {
    return false;
  }
  return (
    /\bcontact(?:[-\s]details?)?\s+(?:line|row)\b/.test(n) ||
    (/\bcontact(?:[-\s]details?)\b/.test(n) &&
      /\b(?:line|row)\b/.test(n) &&
      /\b(?:email|phone|address|containing)\b/.test(n))
  );
}

function isHeaderBandLanguage(n: string): boolean {
  return (
    (/\b(?:background|header)\b/.test(n) &&
      /\b(?:rectangle|rect|box|band)\b/.test(n)) ||
    /\bheader-?band\b/.test(n)
  );
}

function isGraphicalLineLanguage(n: string): boolean {
  if (isContactRowLanguage(n)) return false;
  return (
    /\b(?:rail|rule|divider|stroke)\b/.test(n) ||
    /\b(?:vertical|upright)\s+line\b/.test(n) ||
    (/\bline\b/.test(n) &&
      (/\b(?:vertical|upright|left|right|green|blue|teal|navy)\b/.test(n) ||
        /\b(?:rail|rule|divider)\b/.test(n)))
  );
}

export function compileTargetDescriptor(text: string): TargetDescriptor {
  const n = text.toLowerCase();
  const target: TargetDescriptor = {};
  const quoted = text.match(/["“]([^"”]{1,80})["”]/);
  if (quoted?.[1]) {
    target.quoted_text = cleanQuotedPhrase(quoted[1]);
    target.shape = "text";
  }
  if (isContactRowLanguage(n)) {
    target.role = "contact";
    target.shape = "text";
    target.section = "header";
  }
  if (/\b(?:professional title|job title|position)\b/.test(n)) {
    target.role = "professional_title";
    target.shape = target.shape ?? "text";
  }
  if (/\bheader\b/.test(n) || isHeaderBandLanguage(n)) target.section = "header";
  if (isHeaderBandLanguage(n)) {
    target.shape = "rect";
    target.role = target.role ?? "header_band";
    target.section = "header";
  }
  if (isGraphicalLineLanguage(n)) {
    target.orientation = "vertical";
    target.shape = "line";
  } else if (/\bhorizontal\b/.test(n) && !/\bfrom the current horizontal\b/.test(n)) {
    target.orientation = "horizontal";
  }
  if (/\bleft\b/.test(n)) target.side = "left";
  else if (/\bright\b/.test(n)) target.side = "right";
  if (!target.shape && /\b(?:box|rectangle|rect|bar|band)\b/.test(n)) {
    target.shape = "rect";
  }
  const hasHue =
    /\b(?:blue|navy|azure|green|teal|cyan|red|orange|yellow|purple|violet)\b/.test(
      n,
    );
  if (/\blight[-\s]?blue\b/.test(n) || /\bdark[-\s]?blue\b/.test(n)) {
    target.color_family = "blue";
  } else if (target.role === "header_band" && !hasHue) {
    /* luminance-only "light background" is not a hue family */
  } else {
    for (const [family, re] of COLOR_WORD) {
      if (re.test(n)) {
        target.color_family = family;
        break;
      }
    }
  }
  return target;
}

function hasVisualExtentObject(text: string): boolean {
  return /\b(?:lines?|rails?|bars?|rules?|strokes?|dividers?)\b/i.test(text);
}

export function compileSectionRange(text: string): SectionRangeSpec | undefined {
  const n = text.toLowerCase();
  const hits = sectionNounHits(n);
  const headerCue = /\b(?:header|name section|top name)\b/.test(n);
  if (/\bthrough\b/.test(n) && hits.length >= 2) {
    return {
      start: { kind: "section", section: hits[0]!.key, inclusive: true },
      end: { kind: "section", section: hits[1]!.key, inclusive: true },
    };
  }
  if (/\bbetween\b/.test(n) && hits.length >= 2) {
    return {
      start: { kind: "section", section: hits[0]!.key, inclusive: false },
      end: { kind: "section", section: hits[1]!.key, inclusive: false },
    };
  }
  if (/\b(?:everything\s+)?below\b/.test(n) && !/\bfrom\b/.test(n)) {
    if (headerCue && hits.length === 0) {
      return {
        start: { kind: "header", inclusive: false },
        end: { kind: "document_end" },
      };
    }
    if (hits[0]) {
      return {
        start: { kind: "section", section: hits[0].key, inclusive: false },
        end: { kind: "document_end" },
      };
    }
  }
  if (
    hits[0] &&
    (/\bsections from\b/.test(n) ||
      (/\bfrom\b/.test(n) &&
        /\b(?:down(?:ward)?|below|till|until|through)\b/.test(n)))
  ) {
    return {
      start: { kind: "section", section: hits[0].key, inclusive: true },
      end: { kind: "document_end" },
    };
  }
  if (/\b(?:whole\s+body|(?:that|the)\s+body)\b/.test(n)) {
    if (hits[0]) {
      return {
        start: { kind: "section", section: hits[0].key, inclusive: true },
        end: { kind: "document_end" },
      };
    }
    if (headerCue) {
      return {
        start: { kind: "header", inclusive: false },
        end: { kind: "document_end" },
      };
    }
  }
  return undefined;
}

export function compileReferenceSpec(text: string): ReferenceSpec | undefined {
  const n = text.toLowerCase();
  if (
    /\b(?:as|like|match(?:ing)?|with)\b[\s\S]{0,96}?\b(?:main\s+)?(?:resume\s+)?body(?:\s+content)?\b/.test(
      n,
    ) ||
    /\b(?:as|like|match(?:ing)?|with)\b[\s\S]{0,96}?\b(?:main|body)\s+content\b/.test(
      n,
    )
  ) {
    return { kind: "body_content" };
  }
  if (
    /\b(?:as|like|match(?:ing)?|with)\b/.test(n) &&
    /\b(?:top\s+name|name\s+section|heading at the top)\b/.test(n)
  ) {
    return { kind: "header_name" };
  }
  const asIdx = n.search(/\b(?:as|like|to match|matching|with)\b/);
  if (asIdx < 0) return undefined;
  const afterText = n.slice(asIdx);
  if (/\bheader\b/.test(afterText) && !/\bheader content\b/.test(afterText)) {
    return { kind: "header_name" };
  }
  const after = sectionNounHits(n).filter((h) => h.index >= asIdx);
  if (after[0]) return { kind: "section", section: after[0].key };
  return undefined;
}

function compileProtectedVisual(text: string): ReferenceSpec | undefined {
  const n = text.toLowerCase();
  if (!/\b(?:keep(?:ing)?|preserv(?:e|ing)|retain(?:ing)?)\b/.test(n)) {
    return undefined;
  }
  if (/\b(?:vertical\s+)?(?:line|rail|rule|divider)\b/.test(n)) {
    return {
      kind: "visual",
      descriptor: { shape: "line", orientation: "vertical" },
    };
  }
  return undefined;
}

function compileAlignmentTargets(text: string): TargetDescriptor[] {
  const n = text.toLowerCase();
  const out: TargetDescriptor[] = [];
  const nameIsReferenceOnly =
    /\b(?:name section|name placement|top name)\b/.test(n) &&
    !/\bthe name\b/.test(n) &&
    !/\bname,/.test(n);
  if (
    !nameIsReferenceOnly &&
    (/\bthe name\b/.test(n) ||
      /\bname,/.test(n) ||
      (/\bname\b/.test(n) &&
        /\b(?:job title|contact|header content)\b/.test(n)))
  ) {
    out.push({ role: "name", shape: "text", section: "header" });
  }
  if (/\b(?:job title|professional title|position title|role title)\b/.test(n)) {
    out.push({ role: "professional_title", shape: "text" });
  }
  if (/\bcontact\b/.test(n)) {
    out.push({ role: "contact", shape: "text", section: "header" });
  }
  if (out.length === 0 && /\bheader content\b/.test(n)) {
    out.push(
      { role: "name", shape: "text", section: "header" },
      { role: "professional_title", shape: "text" },
      { role: "contact", shape: "text", section: "header" },
    );
  }
  return out;
}

/**
 * Group move / align-to-reference / keep-protected-object.
 * Does not own below/above/beside visual placement.
 */
export function compileGroupAlignment(text: string):
  | {
      alignment: RelationalAlignmentSpec;
      reference: ReferenceSpec;
      targets: TargetDescriptor[];
      preserve?: ReferenceSpec;
    }
  | undefined {
  if (compileRelativePlacement(text)) return undefined;
  const n = text.toLowerCase();
  const hasMove = /\b(?:move|place|put|position|shift|reposition)\b/.test(n);
  const hasAlign = /\balign(?:s|ing|ed)?\b/.test(n);
  if (
    !hasAlign &&
    !(hasMove && /\b(?:to the right|to the left|rightward|leftward)\b/.test(n))
  ) {
    return undefined;
  }
  const targets = compileAlignmentTargets(text);
  if (targets.length === 0) return undefined;
  const reference = compileReferenceSpec(text);
  if (!reference) return undefined;
  let edge: RelationalAlignmentSpec["edge"] = "left";
  if (/\bright(?:-align)?\b/.test(n) && !/\bleft\b/.test(n)) edge = "right";
  else if (/\bleft\b/.test(n)) edge = "left";
  return {
    targets,
    reference,
    preserve: compileProtectedVisual(text),
    alignment: {
      axis: "horizontal",
      edge,
      relation: "align",
      tolerance_px: RELATIONAL_ALIGNMENT_TOLERANCE_PX,
    },
  };
}

function inferredSingletonRange(
  text: string,
  reference: ReferenceSpec,
): SectionRangeSpec | undefined {
  const hits = sectionNounHits(text).filter(
    (h) => !(reference.kind === "section" && h.key === reference.section),
  );
  if (!hits[0]) return undefined;
  return {
    start: { kind: "section", section: hits[0].key, inclusive: true },
    end: { kind: "section", section: hits[0].key, inclusive: true },
  };
}

export function compileRelationalAlignment(
  text: string,
):
  | { alignment: RelationalAlignmentSpec; reference: ReferenceSpec }
  | undefined {
  if (
    !/\balign(?:ing|ed)?\b/i.test(text) &&
    !/\b(?:left|right)-align/i.test(text)
  ) {
    return undefined;
  }
  const reference = compileReferenceSpec(text);
  if (!reference) return undefined;
  const n = text.toLowerCase();
  let edge: RelationalAlignmentSpec["edge"] = "left";
  if (/\bcent(?:er|re)(?:ed|ing)?\b/.test(n)) edge = "center";
  else if (/\bright(?:-align)?\b/.test(n) && !/\bleft\b/.test(n)) edge = "right";
  else if (/\bleft(?:-align)?\b/.test(n)) edge = "left";
  return {
    alignment: {
      axis: "horizontal",
      edge,
      relation: "align",
      tolerance_px: RELATIONAL_ALIGNMENT_TOLERANCE_PX,
    },
    reference,
  };
}

function isPresentationBesideLanguage(text: string): boolean {
  return (
    /\b(?:column|pointers?|vertical(?:ly)?|horizontal(?:ly)?|inline|list)\b/i.test(
      text,
    ) && !/\b(?:rectangle|rect|box|bar|band|header|shape)\b/i.test(text)
  );
}

export function compileRelativePlacement(text: string):
  | {
      alignment: RelationalAlignmentSpec;
      reference: ReferenceSpec;
      target: TargetDescriptor;
      preserve?: ReferenceSpec;
    }
  | undefined {
  const n = text.toLowerCase();
  if (!/\b(?:move|place|put|position|shift|reposition)\b/.test(n)) return undefined;
  if (/\bone below another\b/.test(n) && !/\bbelow the\b/.test(n)) return undefined;
  if (isPresentationBesideLanguage(text) && !/\bbelow the\b/.test(n) && !/\babove the\b/.test(n)) {
    return undefined;
  }
  const below = /\b(?:completely\s+)?below\b/.test(n);
  const above = /\b(?:completely\s+)?above\b/.test(n) && !/\bbelow\b/.test(n);
  const beside =
    /\bbeside\b/.test(n) &&
    !/\bcontinue(?: it)? beside\b/.test(n) &&
    !/\bnext column\b/.test(n);
  if (!below && !above && !beside) return undefined;
  const targetSpan = text.split(/\b(?:below|above|beside)\b/i)[0] ?? text;
  const target = compileTargetDescriptor(targetSpan);
  const afterRel = text.split(/\b(?:below|above|beside)\b/i)[1] ?? "";
  const refSpan =
    afterRel.split(
      /\b(?:so that|such that|and make|and then|while|keep|keeping|, and)\b/i,
    )[0] ?? afterRel;
  const refDesc = compileTargetDescriptor(refSpan || text);
  if (
    (target.role === "professional_title" || target.section === "header") &&
    !refDesc.section
  ) {
    refDesc.section = "header";
  }
  const hasVisualRef =
    Boolean(refDesc.shape) ||
    Boolean(refDesc.color_family) ||
    Boolean(refDesc.section) ||
    Boolean(refDesc.quoted_text);
  if (!hasVisualRef && !refDesc.role) return undefined;
  const preserve = compileExplicitPreserve(text);
  const clearance =
    /\b(?:small clean gap|clean gap|clearly below|clearly above)\b/.test(n)
      ? 8
      : undefined;
  return {
    target,
    reference: { kind: "visual", descriptor: refDesc },
    preserve,
    alignment: {
      axis: below || above ? "vertical" : "horizontal",
      edge: below ? "bottom" : above ? "top" : "right",
      relation: below ? "below" : above ? "above" : "beside",
      tolerance_px: RELATIONAL_ALIGNMENT_TOLERANCE_PX,
      clearance_px: clearance,
    },
  };
}

function explicitPreserveSpans(text: string): string {
  return text
    .split(/\b(?:keep(?:ing)?|preserv(?:e|ing)|retain(?:ing)?)\b/i)
    .slice(1)
    .map((chunk) => {
      const cut = chunk.split(
        /\b(?:and\s+(?:then\s+)?move|then\s+move|, and move|only if needed|move the)\b/i,
      )[0];
      return (cut ?? chunk).trim();
    })
    .filter(Boolean)
    .join(" ");
}

export function compileExplicitPreserve(text: string): ReferenceSpec | undefined {
  const n = text.toLowerCase();
  if (!/\b(?:keep(?:ing)?|preserv(?:e|ing)|retain(?:ing)?)\b/.test(n)) {
    return undefined;
  }
  const afterKeep = explicitPreserveSpans(text);
  const descriptors: TargetDescriptor[] = [];
  const quoted = [...afterKeep.matchAll(/[“"]([^”"]{1,80})[”"]/g)].map((m) =>
    cleanQuotedPhrase(m[1] ?? ""),
  );
  for (const q of quoted) {
    if (q.length < 2) continue;
    descriptors.push({ quoted_text: q, shape: "text" });
  }
  if (
    /\b(?:job\s+)?title\b/i.test(afterKeep) &&
    !/\b(?:below|above|under|beneath)\s+(?:the\s+)?(?:job\s+)?title\b/i.test(
      afterKeep,
    ) &&
    !quoted.some((q) => /title/i.test(q))
  ) {
    const titled = descriptors.find((d) => d.quoted_text && d.quoted_text.length > 2);
    if (titled && descriptors.length > 1) {
      descriptors[descriptors.length - 1] = {
        ...descriptors[descriptors.length - 1]!,
        role: "professional_title",
      };
    } else if (!descriptors.some((d) => d.role === "professional_title")) {
      descriptors.push({
        role: "professional_title",
        shape: "text",
        section: "header",
      });
    }
  }
  if (/\b(?:rectangle|rect|box|band)\b/i.test(afterKeep)) {
    const rectDesc = compileTargetDescriptor(afterKeep);
    if (rectDesc.shape === "rect" || rectDesc.role === "header_band") {
      descriptors.push({
        shape: "rect",
        section: "header",
        role: rectDesc.role === "header_band" ? "header_band" : rectDesc.role,
        color_family: rectDesc.color_family,
      });
    } else {
      descriptors.push({ shape: "rect", section: "header", role: "header_band" });
    }
  }
  if (descriptors.length >= 2) {
    return { kind: "explicit_objects", descriptors };
  }
  if (descriptors.length === 1) {
    return { kind: "visual", descriptor: descriptors[0]! };
  }
  if (/\b(?:name|placement)\b/.test(n)) {
    return { kind: "header_name_only" };
  }
  return undefined;
}

/**
 * Extent is a desired-state / imperative reach request, not any mention of
 * top/bottom as a problem location ("compressed near the top").
 */
export function compileExtentBound(text: string): ExtentBound | undefined {
  if (
    !hasVisualExtentObject(text) &&
    (compileRelationalAlignment(text) || compileSectionRange(text))
  ) {
    return undefined;
  }
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

export function compileStyleMutation(text: string): StyleMutationSpec | undefined {
  const makeBold = text.match(
    /\b(?:make|set|render)\s+((?:the\s+)?(?:job\s+|professional\s+)?title|["“][^"”]{1,80}["”])\s+bold\b/i,
  );
  if (!makeBold) return undefined;
  const span = makeBold[1]!.trim();
  const target = compileTargetDescriptor(span);
  if (/\b(?:job\s+title|professional\s+title|title)\b/i.test(span)) {
    target.role = "professional_title";
    target.shape = target.shape ?? "text";
    target.section = target.section ?? "header";
  }
  return { target, fontWeight: "bold" };
}

function isFontWeightBold(value: unknown): boolean {
  if (value == null) return false;
  const n = Number(value);
  if (Number.isFinite(n) && n >= 700) return true;
  const s = String(value).trim().toLowerCase();
  return s === "bold" || s === "700" || s === "800" || s === "900";
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
  const relative = compileRelativePlacement(line);
  const group = compileGroupAlignment(line);
  const relational = relative ?? group ?? compileRelationalAlignment(line);
  if (relational) {
    out.push({
      kind: "RELATIONAL_ALIGNMENT",
      required: true,
      target: "target" in relational ? relational.target : undefined,
      targets: "targets" in relational ? relational.targets : undefined,
      range:
        relative || group
          ? undefined
          : compileSectionRange(line) ??
            inferredSingletonRange(line, relational.reference),
      reference: relational.reference,
      alignment: relational.alignment,
      preserve: "preserve" in relational ? relational.preserve : undefined,
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
        presentation_spec: spec ?? undefined,
      });
    }
  }
  const style = compileStyleMutation(line);
  if (style) {
    out.push({
      kind: "STYLE",
      required: true,
      target: style.target,
      style,
    });
  }
  const hasPresentation = out.some((p) => p.kind === "PRESENTATION");
  if (
    isFounderMeasurableSpacingIntent(line) &&
    isNamedSpacingPairRequest(line) &&
    !hasPresentation
  ) {
    const gapNeedles = extractIndependentGapBeforeNeedles(line);
    if (gapNeedles.length >= 2) {
      for (const needle of gapNeedles) {
        out.push({
          kind: "SPACING_PAIR",
          required: true,
          section: contentSections[0],
          present_phrases: [needle],
        });
      }
    } else {
      out.push({
        kind: "SPACING_PAIR",
        required: true,
        section: contentSections[0],
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
    if (min > 210) {
      const dLight = max - min;
      if (dLight >= 8) {
        /* pastel: fall through to hue */
      } else {
        return "light";
      }
    }
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

function isLightFill(fill: string | null | undefined): boolean {
  const rgb = parseHex(fill);
  return Boolean(rgb && Math.min(...rgb) > 200);
}

function isDarkFill(fill: string | null | undefined): boolean {
  const rgb = parseHex(fill);
  return Boolean(rgb && Math.max(...rgb) < 40);
}

function colorMatches(family: ColorFamily | undefined, fill: string | null, stroke: string | null): boolean {
  if (!family || family === "any") return true;
  if (family === "light") {
    return isLightFill(fill) || isLightFill(stroke);
  }
  if (family === "dark") {
    return isDarkFill(fill) || isDarkFill(stroke);
  }
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

function isContactText(text: string): boolean {
  return /@|\d{3}[-.\s]?\d{3}|linkedin|\.com|https?:/i.test(text);
}

function bindHeaderGroupRole(
  canvas: FabricCanvasDoc,
  role: "name" | "contact" | "professional_title",
): string[] {
  const rows: Array<{ id: string; top: number; text: string; role: string }> =
    [];
  objectsOf(canvas).forEach((o, i) => {
    if (isLockedSystemObject(o)) return;
    const type = String(o.type ?? "").toLowerCase();
    if (!type.includes("text")) return;
    const sec = objSection(o);
    if (sec && sec !== "header") return;
    if (!sec && objectTop(o) > 200) return;
    const text = objText(o);
    if (!text) return;
    rows.push({
      id: objId(o, i),
      top: objectTop(o),
      text,
      role: objRole(o),
    });
  });
  rows.sort((a, b) => a.top - b.top);
  const contacts = rows.filter(
    (r) => r.role === "contact" || isContactText(r.text),
  );
  const rest = rows.filter((r) => !contacts.includes(r));
  if (role === "contact") return contacts.map((r) => r.id);
  if (role === "name") {
    const named = rest.find((r) => r.role === "name");
    return named ? [named.id] : rest[0] ? [rest[0].id] : [];
  }
  const titled = rest.find((r) =>
    /\b(?:professional_title|job_title)\b/.test(r.role),
  );
  if (titled) return [titled.id];
  return rest[1] ? [rest[1].id] : [];
}

function bindHeaderBand(
  canvas: FabricCanvasDoc,
  target: TargetDescriptor,
): string[] {
  const pageW = Number(canvas.width ?? 794);
  const scored: Array<{ id: string; score: number }> = [];
  objectsOf(canvas).forEach((o, i) => {
    if (isLockedSystemObject(o)) return;
    const type = String(o.type ?? "").toLowerCase();
    if (!type.includes("rect") && !type.includes("polygon")) return;
    const id = objId(o, i);
    if (id === "page-root" || /^page[-_]?bg/i.test(id)) return;
    const role = objRole(o).toLowerCase();
    const w = Number(o.width ?? 0) * Number(o.scaleX ?? 1);
    const top = Number(o.top ?? 0);
    let score = 0;
    if (/\bheader[-_]?band\b/.test(role)) score += 6;
    if (objSection(o) === "header") score += 3;
    if (w >= pageW * 0.5) score += 3;
    if (top < 80) score += 1;
    if (target.color_family === "light" && isLightFill(typeof o.fill === "string" ? o.fill : null)) {
      score += 2;
    } else if (
      target.color_family &&
      target.color_family !== "light" &&
      colorMatches(
        target.color_family,
        typeof o.fill === "string" ? o.fill : null,
        typeof o.stroke === "string" ? o.stroke : null,
      )
    ) {
      score += 2;
    } else if (!target.color_family && isLightFill(typeof o.fill === "string" ? o.fill : null)) {
      score += 1;
    }
    if (score >= 3) scored.push({ id, score });
  });
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0]?.score ?? 0;
  const winners = scored.filter((s) => s.score === best).map((s) => s.id);
  if (winners.length !== 1) return [];
  return winners;
}

export function bindTargetDescriptor(
  canvas: FabricCanvasDoc,
  target: TargetDescriptor | undefined,
): string[] {
  if (!target) return [];
  if (target.role === "header_band") {
    return bindHeaderBand(canvas, target);
  }
  if (
    target.role === "name" ||
    target.role === "contact" ||
    target.role === "professional_title"
  ) {
    return bindHeaderGroupRole(canvas, target.role);
  }
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
    if (target.quoted_text) {
      const t = objText(o).toLowerCase();
      if (t && t.includes(target.quoted_text.toLowerCase())) score += 6;
      else return;
    }
    if (target.shape === "rect" && !type.includes("rect") && !type.includes("polygon")) {
      return;
    }
    if (target.shape === "line" && !(type.includes("line") || (type.includes("rect") && w <= 16))) {
      return;
    }
    if (target.shape === "text" && !type.includes("text")) {
      return;
    }
    if (
      target.color_family &&
      target.color_family !== "any" &&
      !colorMatches(
        target.color_family,
        typeof o.fill === "string" ? o.fill : null,
        typeof o.stroke === "string" ? o.stroke : null,
      )
    ) {
      return;
    }
    if (target.role) {
      const want = target.role.toLowerCase();
      const aliases =
        want === "professional_title"
          ? ["professional_title", "job_title", "role"]
          : [want];
      if (aliases.includes(role)) score += 4;
    }
    if (target.section && objSection(o) === target.section) score += 2;
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
  const best = scored[0]?.score ?? 0;
  return scored.filter((s) => s.score === best).map((s) => s.id);
}

function isLockedSystemObject(o: CanvasObj): boolean {
  const role = objRole(o);
  if (role === "pagebackground" || role === "page-background") return true;
  const data =
    o.data && typeof o.data === "object" && !Array.isArray(o.data)
      ? (o.data as { system?: unknown; kind?: unknown })
      : {};
  return data.system === true || data.kind === "page-bg";
}

function canvasSectionOrder(canvas: FabricCanvasDoc): string[] {
  const firstTop = new Map<string, number>();
  objectsOf(canvas).forEach((o) => {
    if (isLockedSystemObject(o)) return;
    const sec = objSection(o);
    if (!sec) return;
    const top = Number(o.top ?? 0);
    firstTop.set(sec, Math.min(firstTop.get(sec) ?? Number.POSITIVE_INFINITY, top));
  });
  return [...firstTop.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([sec]) => sec);
}

function rangeStartIndex(order: string[], start: RangeAnchor): number {
  if (start.kind === "document_end") return order.length;
  if (start.kind === "header") {
    const i = order.indexOf("header");
    if (i < 0) return start.inclusive ? 0 : 0;
    return start.inclusive ? i : i + 1;
  }
  const i = order.indexOf(start.section);
  if (i < 0) return -1;
  return start.inclusive ? i : i + 1;
}

function rangeEndIndex(order: string[], end: RangeAnchor): number {
  if (end.kind === "document_end") return order.length - 1;
  if (end.kind === "header") {
    const i = order.indexOf("header");
    return end.inclusive ? i : i - 1;
  }
  const i = order.indexOf(end.section);
  if (i < 0) return -1;
  return end.inclusive ? i : i - 1;
}

export function bindRangeTargetIds(
  canvas: FabricCanvasDoc,
  range: SectionRangeSpec | undefined,
  reference?: ReferenceSpec,
): string[] {
  const order = canvasSectionOrder(canvas);
  const allowed = new Set<string>();
  if (!range) return [];
  const start = rangeStartIndex(order, range.start);
  const end = rangeEndIndex(order, range.end);
  if (start < 0 || end < 0 || start > end) return [];
  for (let i = start; i <= end; i++) {
    const sec = order[i]!;
    if (sec === "header" && range.start.kind !== "header") continue;
    allowed.add(sec);
  }
  if (reference?.kind === "header_name") allowed.delete("header");
  if (reference?.kind === "section") allowed.delete(reference.section);
  const ids: string[] = [];
  objectsOf(canvas).forEach((o, i) => {
    if (isLockedSystemObject(o)) return;
    const sec = objSection(o);
    if (!allowed.has(sec)) return;
    ids.push(objId(o, i));
  });
  return ids;
}

export function bindReferenceIds(
  canvas: FabricCanvasDoc,
  reference: ReferenceSpec | undefined,
): string[] {
  if (!reference) return [];
  if (reference.kind === "visual") {
    return bindTargetDescriptor(canvas, reference.descriptor);
  }
  if (reference.kind === "explicit_objects") {
    const groups = reference.descriptors.map((d) => bindTargetDescriptor(canvas, d));
    if (groups.some((g) => g.length === 0)) return [];
    return [...new Set(groups.flat())];
  }
  if (reference.kind === "body_content") {
    const ids: string[] = [];
    objectsOf(canvas).forEach((o, i) => {
      if (isLockedSystemObject(o)) return;
      const type = String(o.type ?? "").toLowerCase();
      if (!type.includes("text")) return;
      const sec = objSection(o);
      if (!sec || sec === "header") return;
      ids.push(objId(o, i));
    });
    return ids;
  }
  const ids: string[] = [];
  objectsOf(canvas).forEach((o, i) => {
    if (isLockedSystemObject(o)) return;
    const sec = objSection(o);
    const role = objRole(o);
    if (reference.kind === "header_name") {
      if (
        sec === "header" ||
        /\b(?:professional_title|job_title|name)\b/.test(role)
      ) {
        ids.push(objId(o, i));
      }
      return;
    }
    if (reference.kind === "header_name_only") {
      if (
        sec === "header" &&
        String(o.type ?? "").toLowerCase().includes("text") &&
        !/\b(?:professional_title|job_title)\b/.test(role)
      ) {
        const t = objText(o);
        if (/@|\d{3}|linkedin|\.com|http/i.test(t)) return;
        ids.push(objId(o, i));
      }
      return;
    }
    if (sec === reference.section) ids.push(objId(o, i));
  });
  return ids;
}

function bindRelativeTargetIds(
  canvas: FabricCanvasDoc,
  predicate: FulfillmentPredicate,
): string[] {
  if (predicate.targets && predicate.targets.length > 0) {
    const groups = predicate.targets.map((t) => bindTargetDescriptor(canvas, t));
    if (groups.some((g) => g.length === 0)) return [];
    return [...new Set(groups.flat())];
  }
  if (
    predicate.target &&
    (predicate.target.quoted_text ||
      predicate.target.role ||
      predicate.target.shape === "text" ||
      predicate.target.shape === "line" ||
      predicate.target.shape === "rect")
  ) {
    return bindTargetDescriptor(canvas, predicate.target);
  }
  return bindRangeTargetIds(canvas, predicate.range, predicate.reference);
}

function objectLeft(o: CanvasObj): number {
  return Number(o.left ?? 0);
}

function objectTop(o: CanvasObj): number {
  return Number(o.top ?? 0);
}

function edgeValue(
  objects: CanvasObj[],
  edge: RelationalAlignmentSpec["edge"],
): number | null {
  if (objects.length === 0) return null;
  if (edge === "top") return Math.min(...objects.map(objectTop));
  if (edge === "bottom") return Math.max(...objects.map(objBottom));
  const lefts = objects.map(objectLeft);
  const widths = objects.map((o) => Number(o.width ?? 0) * Number(o.scaleX ?? 1));
  if (edge === "left") return Math.min(...lefts);
  if (edge === "right") {
    return Math.max(...lefts.map((l, i) => l + (widths[i] ?? 0)));
  }
  const centers = lefts.map((l, i) => l + (widths[i] ?? 0) / 2);
  return centers.reduce((a, b) => a + b, 0) / centers.length;
}

function targetBaselineObjects(
  canvas: FabricCanvasDoc,
  targetIds: string[],
): CanvasObj[] {
  const byId = new Map(objectsOf(canvas).map((o, i) => [objId(o, i), o] as const));
  const heading = new Set<string>();
  for (const g of inspectRevisionSectionGroups(canvas)) {
    if (g.heading_text_id) heading.add(g.heading_text_id);
  }
  const baseline = targetIds
    .map((id) => byId.get(id))
    .filter((o): o is CanvasObj => Boolean(o) && !heading.has(String(o.id ?? "")));
  if (baseline.length > 0) return baseline;
  return targetIds
    .map((id) => byId.get(id))
    .filter((o): o is CanvasObj => Boolean(o));
}

function relativeLeftSignature(
  canvas: FabricCanvasDoc,
  ids: string[],
): number[] {
  const byId = new Map(objectsOf(canvas).map((o, i) => [objId(o, i), o] as const));
  const lefts = ids
    .map((id) => byId.get(id))
    .filter((o): o is CanvasObj => Boolean(o))
    .map(objectLeft);
  if (lefts.length === 0) return [];
  const origin = Math.min(...lefts);
  return lefts.map((l) => Number((l - origin).toFixed(2)));
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
  line = "",
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
    const spec: PresentationSpec = predicate.presentation_spec ?? {
      desired: predicate.presentation ?? "vertical",
      forbidden: predicate.forbidden_presentation ?? [],
      forbidden_arrangements: [],
      forbidden_markers: [],
      preserve: false,
      executable: true,
    };
    const structureOk = presentationContractSatisfied({
      actual,
      texts: afterBodies.texts,
      boxes: afterBodies.boxes,
      spec,
    });
    const beforeItems = logicalItemsFromTexts(beforeBodies.texts);
    const afterItems = logicalItemsFromTexts(afterBodies.texts);
    const itemsOk =
      beforeItems.length === afterItems.length &&
      beforeItems.every(
        (item, i) => normalizeLogicalItem(item) === normalizeLogicalItem(afterItems[i] ?? ""),
      );
    const clipFindings = intraBoxOverflow(after).filter((f) => {
      const stored = Number(f.metrics?.stored_height ?? 0);
      return stored > 1;
    });
    const clipOk = clipFindings.length === 0;
    const pass = structureOk && itemsOk && clipOk;
    return {
      pass,
      ids: [],
      notes: pass
        ? `presentation ${predicate.section ?? "packet"} ${actual} items=${afterItems.length}`
        : `presentation unsatisfied ${predicate.section ?? "packet"} actual=${actual} desired=${spec.desired} structure=${structureOk} items=${itemsOk} clip=${clipOk} executable=${spec.executable}`,
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
  if (predicate.kind === "RELATIONAL_ALIGNMENT") {
    const alignment = predicate.alignment;
    if (!alignment || !predicate.reference) {
      return { pass: false, ids: [], notes: "relational alignment unbound" };
    }
    const targetIds = bindRelativeTargetIds(after, predicate);
    const referenceIds = bindReferenceIds(after, predicate.reference);
    const preserveIds = (
      predicate.preserve ? bindReferenceIds(after, predicate.preserve) : []
    ).filter((id) => !targetIds.includes(id));
    if (targetIds.length === 0 || referenceIds.length === 0) {
      return {
        pass: false,
        ids: [...targetIds, ...referenceIds],
        notes: `relational alignment unbound (targets=${targetIds.length} refs=${referenceIds.length})`,
      };
    }
    if (
      predicate.preserve &&
      (predicate.preserve.kind === "explicit_objects" ||
        predicate.preserve.kind === "visual") &&
      preserveIds.length === 0
    ) {
      return {
        pass: false,
        ids: [],
        notes: "relational preservation unbound",
      };
    }
    const beforeBy = new Map(
      objectsOf(before).map((o, i) => [objId(o, i), o] as const),
    );
    const afterBy = new Map(
      objectsOf(after).map((o, i) => [objId(o, i), o] as const),
    );
    const referenceMoved =
      predicate.reference.kind === "body_content"
        ? (() => {
            const beforeRefs = bindReferenceIds(before, predicate.reference)
              .map((id) => beforeBy.get(id))
              .filter((o): o is CanvasObj => Boolean(o));
            const afterRefs = referenceIds
              .map((id) => afterBy.get(id))
              .filter((o): o is CanvasObj => Boolean(o));
            const beforeEdge = edgeValue(beforeRefs, alignment.edge);
            const afterEdge = edgeValue(afterRefs, alignment.edge);
            return (
              beforeEdge != null &&
              afterEdge != null &&
              Math.abs(beforeEdge - afterEdge) > 0.51
            );
          })()
        : referenceIds
            .filter((id) => beforeBy.has(id))
            .some((id) => {
              const a = afterBy.get(id);
              const b = beforeBy.get(id);
              if (!a || !b) return true;
              return (
                objectLeft(a) !== objectLeft(b) || objectTop(a) !== objectTop(b)
              );
            });
    if (referenceMoved) {
      return {
        pass: false,
        ids: referenceIds,
        notes: "relational alignment mutated reference",
      };
    }
    const preserveMoved = preserveIds.some((id) => {
      const a = afterBy.get(id);
      const b = beforeBy.get(id);
      if (!a || !b) return true;
      return objectLeft(a) !== objectLeft(b) || objectTop(a) !== objectTop(b);
    });
    if (preserveMoved) {
      return {
        pass: false,
        ids: preserveIds,
        notes: "relational placement moved preserved object",
      };
    }
    const contentChanged = targetIds.some((id) => {
      const a = afterBy.get(id);
      const b = beforeBy.get(id);
      return !a || !b || objText(a) !== objText(b);
    });
    if (contentChanged) {
      return {
        pass: false,
        ids: targetIds,
        notes: "relational alignment changed target content",
      };
    }
    const relation = alignment.relation ?? "align";
    if (relation === "below" || relation === "above" || relation === "beside") {
      const targetObjs = targetIds
        .map((id) => afterBy.get(id))
        .filter((o): o is CanvasObj => Boolean(o));
      const refObjs = referenceIds
        .map((id) => afterBy.get(id))
        .filter((o): o is CanvasObj => Boolean(o));
      if (targetObjs.length === 0 || refObjs.length === 0) {
        return { pass: false, ids: targetIds, notes: "relative placement unbound" };
      }
      let pass = false;
      if (relation === "below") {
        const targetTop = Math.min(...targetObjs.map(objectTop));
        const refBottom = Math.max(...refObjs.map(objBottom));
        const need = refBottom + (alignment.clearance_px ?? 0);
        pass = targetTop >= need - 0.51;
        return {
          pass,
          ids: targetIds,
          notes: pass
            ? `relative below satisfied targetTop=${targetTop} refBottom=${refBottom}`
            : `relative below unsatisfied targetTop=${targetTop} refBottom=${refBottom}`,
        };
      }
      if (relation === "above") {
        const targetBottom = Math.max(...targetObjs.map(objBottom));
        const refTop = Math.min(...refObjs.map(objectTop));
        const need = refTop - (alignment.clearance_px ?? 0);
        pass = targetBottom <= need + 0.51;
        return {
          pass,
          ids: targetIds,
          notes: pass
            ? `relative above satisfied targetBottom=${targetBottom} refTop=${refTop}`
            : `relative above unsatisfied targetBottom=${targetBottom} refTop=${refTop}`,
        };
      }
      const targetLeft = Math.min(...targetObjs.map(objectLeft));
      const refRight = Math.max(
        ...refObjs.map((o) => objectLeft(o) + Number(o.width ?? 0)),
      );
      pass = targetLeft >= refRight - 0.51;
      return {
        pass,
        ids: targetIds,
        notes: pass
          ? `relative beside satisfied targetLeft=${targetLeft} refRight=${refRight}`
          : `relative beside unsatisfied targetLeft=${targetLeft} refRight=${refRight}`,
      };
    }
    const topsChanged = targetIds.some((id) => {
      const a = afterBy.get(id);
      const b = beforeBy.get(id);
      return !a || !b || objectTop(a) !== objectTop(b);
    });
    if (alignment.axis === "horizontal" && topsChanged) {
      return {
        pass: false,
        ids: targetIds,
        notes: "relational alignment changed vertical structure",
      };
    }
    const grouped = Boolean(predicate.targets && predicate.targets.length > 0);
    if (!grouped) {
      const beforeSig = relativeLeftSignature(before, targetIds);
      const afterSig = relativeLeftSignature(after, targetIds);
      const offsetsPreserved =
        beforeSig.length === afterSig.length &&
        beforeSig.every((v, i) => Math.abs(v - (afterSig[i] ?? 99)) <= 0.51);
      if (!offsetsPreserved) {
        return {
          pass: false,
          ids: targetIds,
          notes: "relational alignment flattened internal offsets",
        };
      }
    }
    const targetObjs = targetBaselineObjects(after, targetIds);
    const refObjs = referenceIds
      .map((id) => afterBy.get(id))
      .filter((o): o is CanvasObj => Boolean(o));
    const refEdge = edgeValue(refObjs, alignment.edge);
    if (refEdge == null) {
      return { pass: false, ids: targetIds, notes: "relational alignment edges unbound" };
    }
    if (grouped) {
      const misses = targetObjs.filter((o) => {
        const edge = edgeValue([o], alignment.edge);
        return edge == null || Math.abs(edge - refEdge) > alignment.tolerance_px;
      });
      const pass = targetObjs.length === targetIds.length && misses.length === 0;
      return {
        pass,
        ids: targetIds,
        notes: pass
          ? `relational ${alignment.edge} group aligned ref=${refEdge}`
          : `relational ${alignment.edge} group unsatisfied misses=${misses.length} ref=${refEdge}`,
      };
    }
    const targetEdge = edgeValue(targetObjs, alignment.edge);
    if (targetEdge == null) {
      return { pass: false, ids: targetIds, notes: "relational alignment edges unbound" };
    }
    const pass = Math.abs(targetEdge - refEdge) <= alignment.tolerance_px;
    return {
      pass,
      ids: targetIds,
      notes: pass
        ? `relational ${alignment.edge} aligned target=${targetEdge} ref=${refEdge}`
        : `relational ${alignment.edge} unsatisfied target=${targetEdge} ref=${refEdge}`,
    };
  }
  if (predicate.kind === "STYLE") {
    const ids = bindTargetDescriptor(after, predicate.target ?? predicate.style?.target);
    if (ids.length === 0) {
      return { pass: false, ids: [], notes: "style target unbound" };
    }
    const byId = new Map(objectsOf(after).map((o, i) => [objId(o, i), o] as const));
    const wantBold = (predicate.style?.fontWeight ?? "bold") === "bold";
    const misses = ids.filter((id) => {
      const o = byId.get(id);
      if (!o) return true;
      return wantBold ? !isFontWeightBold(o.fontWeight) : isFontWeightBold(o.fontWeight);
    });
    const pass = misses.length === 0;
    return {
      pass,
      ids,
      notes: pass
        ? `style bold satisfied on ${ids.join(",")}`
        : `style bold unsatisfied ids=${ids.join(",")}`,
    };
  }
  if (predicate.kind === "SPACING_PAIR") {
    if (!line.trim()) {
      return { pass: false, ids: [], notes: "spacing pair missing source item" };
    }
    const resolved = resolveFounderSpacingRelation({
      requestedChange: line,
      canvas: after,
      needle: predicate.present_phrases?.[0],
    });
    if (resolved.kind !== "NAMED_PAIR" || !resolved.upper_id || !resolved.lower_id) {
      return {
        pass: false,
        ids: [resolved.upper_id, resolved.lower_id].filter(Boolean),
        notes: `spacing pair unbound kind=${resolved.kind} ${resolved.notes}`,
      };
    }
    const proof = evaluateCanonicalFinalStateLayoutProof({
      requestedChange: line,
      beforeCanvas: before,
      afterCanvas: after,
      resolved_relation: resolved,
    });
    return {
      pass: proof.pass,
      ids: [resolved.upper_id, resolved.lower_id],
      notes: `canonical_final_state_layout_proof spacing intent ${proof.reason}: ${proof.final_condition}`,
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
    const ev = evaluatePredicate(
      predicate,
      input.beforeCanvas,
      input.afterCanvas,
      input.item.founder_feedback_item,
    );
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
    return evaluatePredicate(
      predicate,
      canvas,
      canvas,
      item.founder_feedback_item,
    ).pass;
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
        p.kind === "RELATIONAL_ALIGNMENT" ||
        p.kind === "PRESENTATION" ||
        p.kind === "STYLE" ||
        p.kind === "SPACING_PAIR"),
  );
}

function isSectionHeadingText(text: string): boolean {
  return /^(skills?|education|experience|summary|projects?|certifications?)$/i.test(
    text.trim(),
  );
}

function normalizeLogicalItem(text: string): string {
  return text.replace(/^[•·\-–—*]\s+/, "").replace(/\s+/g, " ").trim();
}

function logicalItemsFromTexts(texts: string[]): string[] {
  return texts.flatMap((t) => splitLogicalItems(t)).map(normalizeLogicalItem).filter(Boolean);
}

function partitionItems<T>(items: T[], parts: number): T[][] {
  const n = Math.max(1, parts);
  const per = Math.ceil(items.length / n);
  const out: T[][] = [];
  for (let i = 0; i < n; i++) {
    const chunk = items.slice(i * per, (i + 1) * per);
    if (chunk.length) out.push(chunk);
  }
  return out;
}

function removeSectionBodies(
  canvas: FabricCanvasDoc,
  keep: CanvasObj[],
  section?: ContentSectionKey,
): void {
  const keepSet = new Set(keep);
  canvas.objects = objectsOf(canvas).filter((o) => {
    if (!objectMatchesSection(o, section)) return true;
    const t = objText(o);
    if (!t || isSectionHeadingText(t)) return true;
    return keepSet.has(o);
  });
}

function cloneBody(source: CanvasObj, id: string): CanvasObj {
  return { ...JSON.parse(JSON.stringify(source)), id } as CanvasObj;
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

export function applyRelationalAlignment(
  canvas: FabricCanvasDoc,
  ir: FounderFeedbackIR,
): FabricCanvasDoc {
  const clone = JSON.parse(JSON.stringify(canvas)) as FabricCanvasDoc;
  for (const item of ir.items) {
    for (const predicate of item.fulfillment ?? []) {
      if (predicate.kind !== "RELATIONAL_ALIGNMENT") continue;
      const alignment = predicate.alignment;
      if (!alignment || !predicate.reference) continue;
      const targetIds = bindRelativeTargetIds(clone, predicate);
      const referenceIds = bindReferenceIds(clone, predicate.reference);
      const preserveIds = new Set(
        (predicate.preserve ? bindReferenceIds(clone, predicate.preserve) : []).filter(
          (id) => !targetIds.includes(id),
        ),
      );
      const byId = new Map(
        objectsOf(clone).map((o, i) => [objId(o, i), o] as const),
      );
      const movable = targetIds.filter((id) => !preserveIds.has(id));
      if (movable.length === 0 || referenceIds.length === 0) continue;
      const relation = alignment.relation ?? "align";
      const targetObjs = movable
        .map((id) => byId.get(id))
        .filter((o): o is CanvasObj => Boolean(o));
      const refObjs = referenceIds
        .map((id) => byId.get(id))
        .filter((o): o is CanvasObj => Boolean(o));
      if (targetObjs.length === 0 || refObjs.length === 0) continue;
      if (relation === "below") {
        const targetTop = Math.min(...targetObjs.map(objectTop));
        const refBottom = Math.max(...refObjs.map(objBottom));
        const delta = Number(
          (refBottom + (alignment.clearance_px ?? 0) - targetTop).toFixed(2),
        );
        if (delta <= 0.01) continue;
        for (const id of movable) {
          const obj = byId.get(id);
          if (!obj) continue;
          obj.top = Number((objectTop(obj) + delta).toFixed(2));
        }
        continue;
      }
      if (relation === "above") {
        const targetBottom = Math.max(...targetObjs.map(objBottom));
        const refTop = Math.min(...refObjs.map(objectTop));
        const delta = Number(
          (refTop - (alignment.clearance_px ?? 0) - targetBottom).toFixed(2),
        );
        if (delta >= -0.01) continue;
        for (const id of movable) {
          const obj = byId.get(id);
          if (!obj) continue;
          obj.top = Number((objectTop(obj) + delta).toFixed(2));
        }
        continue;
      }
      if (relation === "beside") {
        const targetLeft = Math.min(...targetObjs.map(objectLeft));
        const refRight = Math.max(
          ...refObjs.map((o) => objectLeft(o) + Number(o.width ?? 0)),
        );
        const delta = Number((refRight - targetLeft).toFixed(2));
        if (delta <= 0.01) continue;
        for (const id of movable) {
          const obj = byId.get(id);
          if (!obj) continue;
          obj.left = Number((objectLeft(obj) + delta).toFixed(2));
        }
        continue;
      }
      if (alignment.axis !== "horizontal") continue;
      const refEdge = edgeValue(refObjs, alignment.edge);
      if (refEdge == null) continue;
      if (predicate.targets && predicate.targets.length > 0) {
        for (const id of movable) {
          const obj = byId.get(id);
          if (!obj) continue;
          const objEdge = edgeValue([obj], alignment.edge);
          if (objEdge == null) continue;
          const delta = Number((refEdge - objEdge).toFixed(2));
          if (Math.abs(delta) < 0.01) continue;
          obj.left = Number((objectLeft(obj) + delta).toFixed(2));
        }
        continue;
      }
      const targetEdge = edgeValue(
        targetBaselineObjects(clone, targetIds),
        alignment.edge,
      );
      if (targetEdge == null) continue;
      const delta = Number((refEdge - targetEdge).toFixed(2));
      if (Math.abs(delta) < 0.01) continue;
      for (const id of movable) {
        const obj = byId.get(id);
        if (!obj) continue;
        obj.left = Number((objectLeft(obj) + delta).toFixed(2));
      }
    }
  }
  return clone;
}

export function dropProviderGeometryWhenRelationalOwned(input: {
  plan: {
    schema_version: string;
    summary?: string;
    operations: CanvasOperation[];
    notes?: string[];
  };
  ir: FounderFeedbackIR;
}): {
  plan: {
    schema_version: string;
    summary?: string;
    operations: CanvasOperation[];
    notes?: string[];
  };
  dropped: CanvasOperation[];
} {
  const relational = input.ir.items.some((item) =>
    (item.fulfillment ?? []).some((p) => p.kind === "RELATIONAL_ALIGNMENT"),
  );
  if (!relational) return { plan: input.plan, dropped: [] };
  const dropped = input.plan.operations.filter((op) => {
    switch (op.op) {
      case "set_position":
      case "move_object":
      case "align_objects":
      case "adjust_spacing":
        return true;
      default:
        return false;
    }
  });
  if (dropped.length === 0) return { plan: input.plan, dropped: [] };
  return {
    plan: {
      ...input.plan,
      operations: input.plan.operations.filter((op) => !dropped.includes(op)),
      notes: [
        ...(input.plan.notes ?? []),
        `dropped_provider_geometry_relational_owned=${dropped.length}`,
      ],
    },
    dropped,
  };
}

export function applyPresentationMutations(
  canvas: FabricCanvasDoc,
  ir: FounderFeedbackIR,
): FabricCanvasDoc {
  const clone = JSON.parse(JSON.stringify(canvas)) as FabricCanvasDoc;
  for (const item of ir.items) {
    for (const predicate of item.fulfillment ?? []) {
      if (predicate.kind !== "PRESENTATION") continue;
      const spec = predicate.presentation_spec;
      if (!spec || spec.preserve || !spec.executable) continue;
      const bodies = objectsOf(clone).filter((o) => {
        if (!objectMatchesSection(o, predicate.section)) return false;
        const t = objText(o);
        return Boolean(t) && !isSectionHeadingText(t);
      });
      if (bodies.length === 0) continue;
      const items = logicalItemsFromTexts(bodies.map((o) => objText(o)));
      if (items.length === 0) continue;
      const primary = bodies[0]!;
      const grouping = spec.grouping;
      if (spec.arrangement === "side_by_side") {
        const cols = partitionItems(items, 2);
        const gap = 16;
        const totalW = Math.max(80, Number(primary.width ?? 400));
        const colW = Math.max(60, (totalW - gap) / Math.max(1, cols.length));
        const next: CanvasObj[] = [];
        for (let i = 0; i < cols.length; i++) {
          const box = i === 0 ? primary : cloneBody(primary, `${objId(primary, 0)}-col${i + 1}`);
          box.width = colW;
          box.left = Number(primary.left ?? 0) + i * (colW + gap);
          box.top = Number(primary.top ?? 0);
          box.text = renderPresentation(cols[i]!, "inline", spec.markers);
          next.push(box);
          if (i > 0) objectsOf(clone).push(box);
        }
        removeSectionBodies(clone, next, predicate.section);
      } else if (
        spec.arrangement === "columns" ||
        (grouping?.executable &&
          grouping.axis === "column" &&
          (grouping.column_count ?? 0) >= 2)
      ) {
        const colCount = grouping?.column_count ?? 2;
        const cols = partitionItems(items, colCount);
        const gap = 16;
        const totalW = Math.max(80, Number(primary.width ?? 400));
        const colW = Math.max(60, (totalW - gap * (cols.length - 1)) / cols.length);
        const next: CanvasObj[] = [];
        for (let i = 0; i < cols.length; i++) {
          const box = i === 0 ? primary : cloneBody(primary, `${objId(primary, 0)}-col${i + 1}`);
          box.width = colW;
          box.left = Number(primary.left ?? 0) + i * (colW + gap);
          box.top = Number(primary.top ?? 0);
          box.text = renderPresentation(
            cols[i]!,
            spec.markers === "bullets" ? "bullets" : "vertical",
            spec.markers,
          );
          next.push(box);
          if (i > 0) objectsOf(clone).push(box);
        }
        removeSectionBodies(clone, next, predicate.section);
      } else if (
        grouping?.executable &&
        grouping.axis === "row" &&
        grouping.items_per_group
      ) {
        primary.text = renderRowGroups(
          items,
          grouping.items_per_group,
          spec.markers,
        );
        removeSectionBodies(clone, [primary], predicate.section);
      } else {
        primary.text = renderPresentation(
          items,
          spec.desired,
          spec.markers,
        );
        removeSectionBodies(clone, [primary], predicate.section);
      }
    }
  }
  syncPresentationTextHeights(clone);
  return clone;
}

export function applyStyleMutations(
  canvas: FabricCanvasDoc,
  ir: FounderFeedbackIR,
): FabricCanvasDoc {
  const clone = JSON.parse(JSON.stringify(canvas)) as FabricCanvasDoc;
  for (const item of ir.items) {
    for (const predicate of item.fulfillment ?? []) {
      if (predicate.kind !== "STYLE") continue;
      const spec = predicate.style;
      if (!spec || spec.fontWeight !== "bold") continue;
      const ids = bindTargetDescriptor(clone, spec.target ?? predicate.target);
      const byId = new Map(
        objectsOf(clone).map((o, i) => [objId(o, i), o] as const),
      );
      for (const id of ids) {
        const obj = byId.get(id);
        if (!obj) continue;
        obj.fontWeight = "700";
      }
    }
  }
  return clone;
}

export function applyPostExecutionLayoutWorld(input: {
  canvas: FabricCanvasDoc;
  ir: FounderFeedbackIR;
  requested_changes?: string[];
  prior_canvas?: FabricCanvasDoc;
}): {
  canvas: FabricCanvasDoc;
  vertical: {
    canvas: FabricCanvasDoc;
    report: {
      ok: boolean;
      error: string | null;
      skipped?: boolean;
    };
  };
  normalized: ReturnType<typeof normalizeRevisionLayout>;
} {
  let canvas = applyPresentationMutations(input.canvas, input.ir);
  canvas = applyRelationalAlignment(canvas, input.ir);
  canvas = applyStyleMutations(canvas, input.ir);
  const verticalMod = require("./SectionUnitVerticalSafety.js") as typeof import("./SectionUnitVerticalSafety.js");
  const vertical = verticalMod.applySectionUnitVerticalSafety({
    priorCanvas: input.prior_canvas ?? input.canvas,
    afterCanvas: canvas,
    requested_changes: input.requested_changes ?? [],
  });
  const normalized = normalizeRevisionLayout({
    canvas: vertical.canvas,
    requested_changes: input.requested_changes ?? [],
    prior_canvas: input.prior_canvas,
  });
  return { canvas: normalized.canvas, vertical, normalized };
}
