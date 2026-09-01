/**
 * Deterministic Founder requested-change classification.
 *
 * Default is MUTATION_REQUIRED (fail closed).
 * VERIFICATION_ACCEPTANCE is admitted for:
 * - exact canonical production forms, OR
 * - narrowly constrained final deterministic verification wording.
 *
 * Classification is derived solely from requested-change text.
 * Planner/provider fields cannot change classification.
 * Words like QA / review / check / verify / final alone never admit verification.
 */

export type RequestedChangeClass =
  | "MUTATION_REQUIRED"
  | "VERIFICATION_ACCEPTANCE";

export type VerificationCheckType =
  | "COLLISION_BOUNDS"
  | "VISUAL_CONSISTENCY"
  | "CONTENT_PRESERVATION"
  | "PAGE_FIT"
  | "LAYOUT_PRESERVATION"
  | "ARCHITECTURE_PRESERVATION";

/** Exact production form from revtask-05667cbb-641 requested_changes[11]. */
export const CANONICAL_COLLISION_BOUNDS_QA =
  "Perform a final collision and bounds QA pass across the entire page: no text or shape may overlap another section, no section heading may obscure body text, and all content must remain inside the page boundaries.";

/** Exact production form from revtask-05667cbb-641 requested_changes[12]. */
export const CANONICAL_VISUAL_CONSISTENCY_QA =
  "Perform a final visual-consistency QA pass so repeated components use identical typography, spacing, alignment, dimensions, and colors rather than being independently positioned or styled.";

/** Exact production form from revtask-5585617a-58a requested_changes[12]. */
export const CANONICAL_COLLISION_BOUNDS_QA_V2 =
  "Perform a final collision and page-bounds QA pass after all repositioning: no heading, text, bullet, background shape, or section may overlap another element or extend outside the page boundaries.";

/** Exact production form from revtask-5585617a-58a requested_changes[13]. */
export const CANONICAL_VISUAL_CONSISTENCY_QA_V2 =
  "Perform a final visual-consistency QA pass across the entire template so repeated headings, spacing intervals, alignment grids, typography, indentation, and column margins use a coherent and repeatable design system.";

/** Exact production form from revtask-5585617a-58a requested_changes[11]. */
export const CANONICAL_CONTENT_PRESERVATION =
  "Preserve all existing truthful resume information unless a formatting or structural change requires repositioning it. Do not fabricate skills, certifications, education, employment history, achievements, metrics, tools, or other credentials to increase visual density.";

function normalizeForClassification(s: string): string {
  return s
    .replace(/^\*+\s*/, "")
    .replace(/^\d+\.\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const CANONICAL_BY_CHECK: ReadonlyArray<{
  check_type: VerificationCheckType;
  canonical: string;
  normalized: string;
}> = [
  {
    check_type: "COLLISION_BOUNDS",
    canonical: CANONICAL_COLLISION_BOUNDS_QA,
    normalized: normalizeForClassification(CANONICAL_COLLISION_BOUNDS_QA),
  },
  {
    check_type: "COLLISION_BOUNDS",
    canonical: CANONICAL_COLLISION_BOUNDS_QA_V2,
    normalized: normalizeForClassification(CANONICAL_COLLISION_BOUNDS_QA_V2),
  },
  {
    check_type: "VISUAL_CONSISTENCY",
    canonical: CANONICAL_VISUAL_CONSISTENCY_QA,
    normalized: normalizeForClassification(CANONICAL_VISUAL_CONSISTENCY_QA),
  },
  {
    check_type: "VISUAL_CONSISTENCY",
    canonical: CANONICAL_VISUAL_CONSISTENCY_QA_V2,
    normalized: normalizeForClassification(CANONICAL_VISUAL_CONSISTENCY_QA_V2),
  },
  {
    check_type: "CONTENT_PRESERVATION",
    canonical: CANONICAL_CONTENT_PRESERVATION,
    normalized: normalizeForClassification(CANONICAL_CONTENT_PRESERVATION),
  },
];

export type ClassifiedRequestedChange = {
  classification: RequestedChangeClass;
  /** Primary check type (first required check). */
  check_type: VerificationCheckType | null;
  /** All deterministic checks required for this Founder line (compound-safe). */
  check_types: VerificationCheckType[];
  /** Canonical string when verification; otherwise null. */
  canonical_form: string | null;
};

export function verificationCheckTypes(
  classified: ClassifiedRequestedChange,
): VerificationCheckType[] {
  if (classified.check_types.length > 0) return classified.check_types;
  if (classified.check_type) return [classified.check_type];
  return [];
}

function verificationResult(
  check_types: VerificationCheckType[],
  canonical_form: string | null = null,
): ClassifiedRequestedChange {
  return {
    classification: "VERIFICATION_ACCEPTANCE",
    check_type: check_types[0] ?? null,
    check_types,
    canonical_form,
  };
}

/** Concrete mutation openers — never verification. */
function looksLikeConcreteMutation(n: string): boolean {
  if (
    /^(correct|move|resize|align|fix|reposition|standardize|improve|tighten|increase|reduce|extend|remove|rewrit|rework|restore|normalize|rebalance|refine|organize|keep the|preserve the existing)\b/.test(
      n,
    )
  ) {
    return true;
  }
  // "Check the X section after repositioning..." is a concrete follow-up mutation.
  if (/^check the\b/.test(n) && !/\bfinal\b/.test(n)) return true;
  // Explicit sizing/mutation instructions dressed as QA.
  if (
    /\b(by changing|change all|set all|move the|resize the|to \d+px)\b/.test(n)
  ) {
    return true;
  }
  return false;
}

function hasFinalVerificationShell(n: string): boolean {
  const hasFinalContext =
    /\bfinal\b/.test(n) ||
    /\bafter all (?:reflow(?:ing)? and )?(?:repositioning|mutations|changes)\b/.test(
      n,
    ) ||
    /\bpost[- ]?(mutation|execution|change|repositioning)\b/.test(n);
  const hasQaOrVerification =
    /\bqa\b/.test(n) ||
    /\bverification\b/.test(n) ||
    /\bacceptance\b/.test(n) ||
    /\bverify\b/.test(n);
  const hasPassOrCheck =
    /\bpass\b/.test(n) ||
    /\bcheck\b/.test(n) ||
    /\bqa pass\b/.test(n) ||
    /\bverify\b/.test(n);
  return hasFinalContext && hasQaOrVerification && hasPassOrCheck;
}

function isCollisionBoundsVerificationPattern(n: string): boolean {
  if (looksLikeConcreteMutation(n)) return false;
  if (isPostMutationVerifyCollisionPattern(n)) return true;
  if (isFinalZeroOverlapOutcomePattern(n)) return true;
  if (!hasFinalVerificationShell(n)) return false;

  const collisionOrBounds =
    /\b(collision|collisions|overlap|overlaps|overlapping)\b/.test(n) ||
    /\b(page[- ]?bounds?|page boundaries|bounds qa|out of bounds)\b/.test(n) ||
    /\b(outside the page|inside the page|within the page)\b/.test(n);

  const noOverlapOrInBounds =
    /\bno\b[\s\S]{0,120}\b(overlap|obscure|cover|extend outside|outside)\b/.test(
      n,
    ) ||
    /\b(must|may) (not|never)\b[\s\S]{0,80}\b(overlap|extend|obscure)\b/.test(
      n,
    ) ||
    /\bmust remain (inside|within)\b/.test(n) ||
    /\b(all content must remain|remain inside the page)\b/.test(n) ||
    /\bextend outside the page boundaries\b/.test(n) ||
    /\bzero\b[\s\S]{0,60}\b(overlap|collision|clipping|out-of-bounds|out of bounds)\b/.test(
      n,
    );

  return collisionOrBounds && noOverlapOrInBounds;
}

/**
 * Post-mutation explicit verify wording (e.g. revtask-1ae261a9-127 item 14).
 * Temporal reflow/repositioning preamble must not force MUTATION_REQUIRED.
 */
function isPostMutationVerifyCollisionPattern(n: string): boolean {
  if (looksLikeConcreteMutation(n)) return false;
  const postMutation =
    /\bafter all\b[\s\S]{0,48}\b(reflow(?:ing)?|repositioning|mutations|changes)\b/.test(
      n,
    ) || /\bafter (?:all )?reflow/.test(n);
  const verifyVerb = /\bverify\b/.test(n);
  const collisionTopics =
    /\b(zero|no)\b[\s\S]{0,100}\b(overlap|collision|collisions|clipping|intrusion|out-of-bounds|out of bounds)\b/.test(
      n,
    ) ||
    (/\b(overlap|collision|clipping)\b/.test(n) &&
      /\b(out[- ]of[- ]bounds|page boundaries)\b/.test(n));
  return postMutation && verifyVerb && collisionTopics;
}

/**
 * Final outcome language demanding zero overlap / readability / no intrusion
 * without a concrete mutation opener (e.g. "Final output must have zero text
 * overlap and all text must be fully readable").
 */
function isFinalZeroOverlapOutcomePattern(n: string): boolean {
  if (looksLikeConcreteMutation(n)) return false;
  if (isConcreteLayoutOrGeometryMutationRequest(n)) return false;

  const zeroOverlapOrIntrusion =
    /\bzero\b[\s\S]{0,80}\b(?:text[- ]?(?:to[- ]?text[- ]?)?)?(?:overlap|collision|clipping|intrusion)s?\b/.test(
      n,
    ) ||
    /\b(?:no|without)\b[\s\S]{0,48}\b(?:text[- ]?)?(?:overlap|section\s+intrusion)\b/.test(
      n,
    );
  const readableWithCollisionTopic =
    /\b(?:fully|completely)\s+readable\b/.test(n) &&
    /\b(?:overlap|collision|clipping|intrusion|text)\b/.test(n);
  const outcomeShell =
    /\bfinal\b/.test(n) ||
    /\bverify\b/.test(n) ||
    /\bmust (?:have|show|remain|ensure|be)\b/.test(n) ||
    /\bafter all\b/.test(n);
  return outcomeShell && (zeroOverlapOrIntrusion || readableWithCollisionTopic);
}

function isVisualConsistencyVerificationPattern(n: string): boolean {
  if (looksLikeConcreteMutation(n)) return false;
  if (!hasFinalVerificationShell(n)) return false;

  const consistency =
    /\bvisual[- ]consistency\b/.test(n) ||
    /\brepeated (components|headings)\b/.test(n) ||
    (/\b(coherent|repeatable|identical)\b/.test(n) &&
      /\b(design system|components|headings|typography)\b/.test(n));

  const attributes =
    /\b(typography|spacing|alignment|dimensions?|colors?|indentation|margins?|grids?)\b/.test(
      n,
    );

  return consistency && attributes;
}

/** True when verb appears only inside a prohibition (do not / never / not). */
function isProhibitedContentEditVerb(n: string, verbStem: string): boolean {
  if (
    new RegExp(
      `\\b(?:do not|don't|never|not to|without)\\b[\\s\\w,;/-]{0,56}?\\b${verbStem}\\b`,
    ).test(n)
  ) {
    return true;
  }
  return false;
}

/**
 * Resume-content truth / no-fabrication constraints only.
 * Must NOT match design/header preservation mutation requests.
 * Must NOT swallow concrete layout/geometry mutation requests that merely
 * mention preservation as a constraint.
 */
function isContentEditMutationRequest(n: string): boolean {
  const editVerbs: Array<{ stem: string; re: RegExp }> = [
    { stem: "rewrit", re: /\b(rewrit|reword|paraphras)\b/ },
    { stem: "shorten", re: /\bshorten\b/ },
    { stem: "clarify", re: /\bclarify\b/ },
    {
      stem: "improve wording",
      re: /\b(improve wording|improve the (summary|copy|text|bullets?))\b/,
    },
    { stem: "add missing", re: /\badd missing\b/ },
    { stem: "invent new", re: /\b(invent new|fabricate new)\b/ },
  ];
  for (const { stem, re } of editVerbs) {
    if (re.test(n) && !isProhibitedContentEditVerb(n, stem)) return true;
  }
  if (
    /\b(update|change|replace|revise)\b[\s\S]{0,40}\b(summary|bullet|job title|wording|copy|text|skills? list)\b/.test(
      n,
    ) &&
    !/\bdo not (?:remove|shorten|invent|alter|change|update|replace|revise)\b/.test(
      n,
    )
  ) {
    return true;
  }
  return false;
}

/**
 * Physical/layout action word families (base + gerund forms only).
 * Past-participle adjectives like "improved" must NOT match.
 */
const LAYOUT_ACTION_RE =
  /\b(?:mov(?:e|ing|ed)|shift(?:ing|ed)?|align(?:ing|ed)?|rebalanc(?:e|ing|ed)?|improv(?:e|ing)\b|balanc(?:e|ing|ed)|adjust(?:ing|ed)?|resiz(?:e|ing|ed)|extend(?:ing|ed)?|compress(?:ing|ed)?|tighten(?:ing|ed)?|expand(?:ing|ed)?|reorganiz(?:e|ing|ed)|reposition(?:ing|ed)?|redistribut(?:e|ing|ed)?|reflow(?:ing)?)\b/;

/**
 * Layout / visual / geometry targets and contexts that make a physical
 * action an actual mutation instruction (same Founder line).
 */
const LAYOUT_CONTEXT_RE =
  /\b(?:sidebars?|columns?|spacing|positions?|alignments?|layouts?|hierarch(?:y|ies)|visual\s+balance|vertical\s+balance|horizontal\s+balance|column\s+balance|whitespace|page\s+edges?|(?:left|right)\s+edges?|paddings?|gaps?|sections?|headers?|footers?|objects?|elements?|headings?|markers?|geometry|widths?|heights?|\d+\s*px|contact\s+lines?|vertical\s+(?:space|distribution|rhythm)|available\s+vertical\s+space|(?:left|right)\s+(?:sidebar|column|columns|margin|half)|left\s+and\s+right\s+columns?)\b/;

/** Resume section / band names used as layout targets with move/align/etc. */
const LAYOUT_SECTION_TARGET_RE =
  /\b(?:education|skills?|projects?|summary|certifications?|languages?|experience|employment|contact|work\s+experience)\b/;

/** Directional placement cues used with move/shift/reposition. */
const LAYOUT_DIRECTION_RE =
  /\b(?:up|down|upward|downward|leftward|rightward|higher|lower)\b/;

/** Move/shift/reposition family used with directional cues. */
const LAYOUT_MOVE_FAMILY_RE =
  /\b(?:mov(?:e|ing|ed)|shift(?:ing|ed)?|reposition(?:ing|ed)?)\b/;

function splitClassificationClauses(n: string): string[] {
  return n
    .split(/[.!?]+/)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

function maskPreserveStatementNarrative(n: string): string {
  return n.replace(
    /\bpreserv(?:e|ing)\b[^.!?]*?\b(?:factual\s+)?(?:statement|sentence)\b[^.!?]*/g,
    " ",
  );
}

/** Mask post-mutation verification preambles so reflow/repositioning is not a mutation. */
function maskPostMutationVerificationPreamble(n: string): string {
  return n.replace(
    /\bafter all\b[\s\S]{0,48}\b(?:reflow(?:ing)?(?: and repositioning)?|repositioning|mutations|changes)\b\s*,?\s*/gi,
    " ",
  );
}

function clauseHasLocalLayoutMutation(clause: string): boolean {
  if (!LAYOUT_ACTION_RE.test(clause)) return false;

  if (LAYOUT_CONTEXT_RE.test(clause)) return true;
  if (LAYOUT_SECTION_TARGET_RE.test(clause)) return true;

  if (LAYOUT_DIRECTION_RE.test(clause) && LAYOUT_MOVE_FAMILY_RE.test(clause)) {
    return true;
  }

  if (
    /\bsidebars?\b/.test(clause) &&
    /\b(?:fill|empty|unused|lower\s+half)\b/.test(clause)
  ) {
    return true;
  }

  return false;
}

function isConcreteLayoutOrGeometryMutationRequest(n: string): boolean {
  const masked = maskPostMutationVerificationPreamble(
    maskPreserveStatementNarrative(n),
  );
  for (const clause of splitClassificationClauses(masked)) {
    if (isLayoutPreservationVerificationPattern(clause)) continue;
    if (isArchitecturePreservationVerificationPattern(clause)) continue;
    if (isRemainderDesignPreservationPattern(clause)) continue;
    if (clauseHasLocalLayoutMutation(clause)) return true;
  }
  return false;
}

/** Preserve existing layout / do-not-undo spacing constraints. */
function isLayoutPreservationVerificationPattern(n: string): boolean {
  if (!/\bpreserv(?:e|ing)\b/.test(n)) return false;
  const noRegression =
    /\bdo not undo\b/.test(n) ||
    /\balready visually satisfactory\b/.test(n) ||
    /\bcurrent (?:experience )?layout\b/.test(n) ||
    (/\bpreserv(?:e|ing)\b/.test(n) &&
      /\bcurrent\b/.test(n) &&
      /\b(spacing|layout|gap)\b/.test(n));
  const sectionPair =
    /\bsummary\b/.test(n) &&
    /\bexperience\b/.test(n) &&
    /\b(spacing|layout|gap)\b/.test(n);
  return noRegression && sectionPair;
}

/**
 * "Preserve the rest of the design/layout/typography… looks good" —
 * non-mutation acceptance (Phase 5I/5O). Must not swallow "preserve X while move Y".
 */
function isRemainderDesignPreservationPattern(n: string): boolean {
  if (!/\bpreserv(?:e|ing)\b/.test(n)) return false;
  if (
    /\b(?:while|and then|then)\s+(?:align|mov|reposition|fix|extend|adjust|shift|raise|nudge)\b/.test(
      n,
    )
  ) {
    return false;
  }
  if (
    /\b(?:move|extend|adjust|reposition|resize|raise|shift|increase|reduce|tighten)\b/.test(
      n,
    ) &&
    /\b(?:header|contact|section|summary|sidebar|column)\b/.test(n)
  ) {
    return false;
  }
  const remainder =
    /\bthe rest\b/.test(n) ||
    /\bremaining\b/.test(n) ||
    /\brest of (?:the )?(?:resume|template|design)\b/.test(n);
  const designSignals =
    /\b(design|section layout|layout|spacing|typography)\b/.test(n);
  const satisfaction =
    /\blooks good\b/.test(n) ||
    /\balready (?:good|fine|satisfactory)\b/.test(n) ||
    /\bvisually satisfactory\b/.test(n) ||
    /\bunchanged\b/.test(n) ||
    remainder;
  return remainder && designSignals && satisfaction;
}

/** Explicit spacing improvement/imperative — remains MUTATION_REQUIRED. */
function isLayoutImprovementMutationRequest(n: string): boolean {
  if (/^(increase|improve|reduce|tighten|extend|adjust)\b/.test(n)) {
    if (
      /\b(summary|experience)\b/.test(n) &&
      /\b(gap|spacing|space)\b/.test(n)
    ) {
      return true;
    }
  }
  if (
    /\b(increase|improve|reduce)\b[\s\S]{0,40}\b(gap|spacing)\b[\s\S]{0,40}\b(summary|experience)\b/.test(
      n,
    )
  ) {
    return true;
  }
  return false;
}

/** Preserve architecture / visual identity without redesign. */
function isArchitecturePreservationVerificationPattern(n: string): boolean {
  if (
    /^(redesign|change the layout to|convert to one column|switch to one column)\b/.test(
      n,
    )
  ) {
    return false;
  }
  if (!/\bpreserv(?:e|ing)\b/.test(n)) return false;
  const archSignals =
    /\barchitecture\b/.test(n) ||
    /\btwo[- ]column\b/.test(n) ||
    /\bvisual identity\b/.test(n) ||
    (/\bdark\b/.test(n) && /\bheader\b/.test(n)) ||
    /\bsidebar background\b/.test(n) ||
    (/\btypography hierarchy\b/.test(n) && /\bcolors?\b/.test(n));
  const constraint =
    /\bwithout redesign/.test(n) ||
    /\bdo not redesign\b/.test(n) ||
    /\bfix the layout defects without redesign/.test(n);
  if (!archSignals || !constraint) return false;
  if (
    /\b(?:while|and then)\s+(?:align|mov|reposition|fix)\b/.test(n) &&
    /\bpreserv(?:e|ing)\b/.test(n)
  ) {
    return false;
  }
  return true;
}

function isPageFitVerificationPattern(n: string): boolean {
  return (
    (/\b(keep|maintain)\b/.test(n) &&
      /\b(entire resume|whole resume|full resume)\b/.test(n) &&
      /\bon one page\b/.test(n)) ||
    (/\b(keep|maintain)\b/.test(n) && /\bone[- ]page\b/.test(n)) ||
    /\bmust (?:fit|remain) on one page\b/.test(n)
  );
}

function isContentPreservationVerificationPattern(n: string): boolean {
  if (isContentEditMutationRequest(n)) return false;
  if (isConcreteLayoutOrGeometryMutationRequest(n)) return false;

  const preserveTruthfulContent =
    /\bpreserv(?:e|ing)\b/.test(n) &&
    (/\btruthful\b/.test(n) ||
      /\bfactual\b/.test(n) ||
      /\bresume information\b/.test(n) ||
      (/\bexisting\b/.test(n) &&
        /\b(resume )?(content|information)\b/.test(n)) ||
      /\b(statement|sentence)\b/.test(n));

  const noFabrication =
    /\b(do not|don't|never|not)\b/.test(n) &&
    /\b(fabricat\w*|invent\w*|alter\w*)\b/.test(n) &&
    (/\b(?:skills?|certifications?|certif(?:icate|ication)?s?|education|employment(?:\s+history)?|work\s+experience|job\s+history|experience|achievements?|metrics?|tools?|credentials?|qualifications?|titles?|job\s+titles?|compan(?:y|ies)|employers?|dates?|responsibilities?|projects?|languages?|information|content)\b/.test(
      n,
    ) ||
      /\bvisual density\b/.test(n) ||
      /\bfiller\b/.test(n) ||
      /\bfill space\b/.test(n) ||
      /\bfactual resume content\b/.test(n));

  const keepFactualUnchanged =
    /\b(keep|maintain)\b/.test(n) &&
    /\b(factual|truthful)\b/.test(n) &&
    /\b(unchanged|without (?:changing|altering|rewriting)|as[- ]is)\b/.test(n);

  const doNotAlterFactual =
    /\bdo not\b[\s\S]{0,40}\b(?:remove|shorten|invent|alter)\b[\s\S]{0,40}\bfactual\b/.test(
      n,
    );

  return (
    preserveTruthfulContent ||
    noFabrication ||
    keepFactualUnchanged ||
    doNotAlterFactual
  );
}

function compoundPageFitAndContentPreservation(n: string): boolean {
  return (
    isPageFitVerificationPattern(n) &&
    isContentPreservationVerificationPattern(n)
  );
}

/**
 * Classify a Founder requested change.
 * Exact canonical match first, then narrow final-verification patterns.
 * Fail closed: ambiguous text remains MUTATION_REQUIRED.
 */
export function classifyRequestedChange(
  requestedChange: string,
): ClassifiedRequestedChange {
  const n = normalizeForClassification(requestedChange);
  for (const entry of CANONICAL_BY_CHECK) {
    if (n === entry.normalized) {
      return verificationResult([entry.check_type], entry.canonical);
    }
  }

  if (isLayoutImprovementMutationRequest(n)) {
    return {
      classification: "MUTATION_REQUIRED",
      check_type: null,
      check_types: [],
      canonical_form: null,
    };
  }

  if (compoundPageFitAndContentPreservation(n)) {
    return verificationResult(["PAGE_FIT", "CONTENT_PRESERVATION"]);
  }

  if (isPostMutationVerifyCollisionPattern(n)) {
    return verificationResult(["COLLISION_BOUNDS"]);
  }

  if (isFinalZeroOverlapOutcomePattern(n)) {
    return verificationResult(["COLLISION_BOUNDS"]);
  }

  if (isLayoutPreservationVerificationPattern(n)) {
    return verificationResult(["LAYOUT_PRESERVATION"]);
  }

  if (isRemainderDesignPreservationPattern(n)) {
    return verificationResult(["COLLISION_BOUNDS", "LAYOUT_PRESERVATION"]);
  }

  if (isArchitecturePreservationVerificationPattern(n)) {
    return verificationResult(["ARCHITECTURE_PRESERVATION"]);
  }

  if (isCollisionBoundsVerificationPattern(n)) {
    return verificationResult(["COLLISION_BOUNDS"]);
  }
  if (isVisualConsistencyVerificationPattern(n)) {
    return verificationResult(["VISUAL_CONSISTENCY"]);
  }
  if (isPageFitVerificationPattern(n)) {
    return verificationResult(["PAGE_FIT"]);
  }
  if (isContentPreservationVerificationPattern(n)) {
    return verificationResult(["CONTENT_PRESERVATION"]);
  }

  return {
    classification: "MUTATION_REQUIRED",
    check_type: null,
    check_types: [],
    canonical_form: null,
  };
}

export function isVerificationAcceptance(requestedChange: string): boolean {
  return (
    classifyRequestedChange(requestedChange).classification ===
    "VERIFICATION_ACCEPTANCE"
  );
}
