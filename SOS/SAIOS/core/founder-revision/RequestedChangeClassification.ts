/**
 * Deterministic Founder requested-change classification.
 *
 * Classification is derived solely from requested-change text.
 * Planner/provider fields cannot change classification.
 * Words like QA / review / check / verify / final alone never admit verification.
 *
 * Fail-closed semantics (Phase 6G):
 *   "fail closed" means DO NOT REQUIRE A MUTATION we cannot establish — it does
 *   NOT mean unknown Founder wording becomes MUTATION_REQUIRED. A line is
 *   MUTATION_REQUIRED only when an explicit mutation verb is paired with a
 *   concrete, changeable target in a non-prohibited clause. Everything else is
 *   verification, preservation, or general acceptance, all of which require
 *   ZERO AI operations and are proven by deterministic post-execution evidence.
 *
 * Resolution order:
 *   1. exact canonical production forms (compatibility fast path)
 *   2. historical narrow verification/preservation patterns (compatibility)
 *   3. durable clause-scoped intent resolution (resolveRequestedChangeIntent)
 */

export type RequestedChangeClass =
  | "MUTATION_REQUIRED"
  | "VERIFICATION_ACCEPTANCE"
  | "PRESERVATION_CONSTRAINT";

export type VerificationCheckType =
  | "COLLISION_BOUNDS"
  | "VISUAL_CONSISTENCY"
  | "CONTENT_PRESERVATION"
  | "PAGE_FIT"
  | "LAYOUT_PRESERVATION"
  | "ARCHITECTURE_PRESERVATION"
  | "ROLE_TARGET_INTEGRITY"
  /**
   * No concrete mutation, named verification topic, or preservation target was
   * resolvable. Requires zero operations and is certified by final-geometry
   * cleanliness (no text overlap, no out-of-bounds content).
   */
  | "GENERAL_ACCEPTANCE";

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
    /\brest of (?:the )?(?:resume|template|design)\b/.test(n) ||
    // "Preserve the corrected/existing X, Y, Z … because those areas look correct"
    (/\bpreserv(?:e|ing)\b/.test(n) &&
      /\b(header|right[- ]side|summary|experience|education|typography|column)\b/.test(
        n,
      ) &&
      (/\balready look(?:s)? correct\b/.test(n) ||
        /\bnow look(?:s)? correct\b/.test(n) ||
        /\balready (?:good|fine|satisfactory|correct)\b/.test(n) ||
        /\blooks? correct\b/.test(n)));
  const designSignals =
    /\b(design|section layout|layout|spacing|typography|header|summary|experience|education|column)\b/.test(
      n,
    );
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

/* ===================================================================== */
/* Phase 6G — durable clause-scoped intent resolution                    */
/* ===================================================================== */

/**
 * One requested-action scope inside a Founder line.
 *
 * Founder lines routinely combine a mutation demand with preservation and
 * verification demands ("Change the professional title … while preserving the
 * current header design, candidate name, contact layout, colors, and
 * typography."). Intent must therefore be resolved per clause: a preservation
 * clause must never suppress the mutation clause, and a mutation verb sitting
 * inside a prohibition must never create a mutation requirement.
 */
export type IntentClause = {
  text: string;
  /** False when the clause forbids its action ("do not change the name"). */
  positive: boolean;
};

/**
 * Clause boundaries: sentences, semicolons/colons, and subordinators.
 *
 * A coordinating "and"/"," also ends a clause when a preservation verb follows
 * it, so "Move the Projects section lower and keep all factual information
 * unchanged" splits into its mutation clause and its preservation clause
 * instead of letting the preservation half suppress the request.
 */
const COORDINATED_PRESERVATION_LOOKAHEAD =
  "(?=\\s*(?:preserv(?:e|ing)|retain(?:ing)?|keep(?:ing)?|maintain(?:ing)?|leav(?:e|ing))\\b)";
/** "… and ensure there are zero text collisions" starts an acceptance clause. */
const COORDINATED_VERIFICATION_LOOKAHEAD =
  "(?=\\s*(?:ensur(?:e|ing)|verif(?:y|ying)|check(?:ing)?|confirm(?:ing)?|validat(?:e|ing)|make sure|guarantee)\\b)";
const CLAUSE_BOUNDARY_RE = new RegExp(
  `(?:[.!?;:]+|\\bwhile\\b|\\bwhilst\\b|\\bwhereas\\b|\\bbut\\b|\\bhowever\\b|\\brather than\\b|\\binstead of\\b|\\bbecause\\b|\\bso that\\b|\\band\\b${COORDINATED_PRESERVATION_LOOKAHEAD}|,${COORDINATED_PRESERVATION_LOOKAHEAD}|\\band\\b${COORDINATED_VERIFICATION_LOOKAHEAD}|,${COORDINATED_VERIFICATION_LOOKAHEAD})`,
);

/** Markers that flip the remainder of a clause segment to forbidden. */
const PROHIBITION_BOUNDARY_RE =
  /\b(?:do not|does not|don't|doesn't|never|must not|may not|should not|cannot|can't|avoid|refrain from|without)\b/;

/**
 * Exception markers. Text after them states a permitted fallback, not a
 * Founder demand ("… unless a small positioning adjustment is required"), so it
 * must never create a mutation requirement.
 */
const EXCEPTION_BOUNDARY_RE = /\b(?:unless|except|as long as|only if)\b/;

/**
 * Split a normalized Founder line into polarity-tagged intent clauses.
 *
 * `positive` marks a clause that actually demands something. A prohibition
 * marker forbids everything after it within its clause, which is how
 * coordinated prohibitions ("does not clip, overflow, overlap, or extend into
 * another section") are handled without enumerating each verb.
 */
export function resolveIntentClauses(normalized: string): IntentClause[] {
  const out: IntentClause[] = [];
  for (const raw of normalized.split(CLAUSE_BOUNDARY_RE)) {
    const clause = raw.trim();
    if (!clause) continue;
    // Everything after an exception marker is a permitted fallback, not a demand.
    const exceptionParts = clause.split(EXCEPTION_BOUNDARY_RE);
    exceptionParts.forEach((part, exceptionIndex) => {
      const scope = part.trim();
      if (!scope) return;
      const demanding = exceptionIndex === 0;
      scope.split(PROHIBITION_BOUNDARY_RE).forEach((segment, index) => {
        const text = segment.trim();
        if (!text) return;
        out.push({ text, positive: demanding && index === 0 });
      });
    });
    // Keep the whole clause as a non-demanding scope when it prohibits, so
    // preservation targets inside the prohibition remain matchable.
    if (PROHIBITION_BOUNDARY_RE.test(clause)) {
      out.push({ text: clause, positive: false });
    }
  }
  return out;
}

/**
 * Explicit mutation verbs. Preservation and inspection verbs are absent.
 *
 * Past participles are admitted only for content-mutation verbs, where they
 * unambiguously demand an end-state ("with the role content and sidebar
 * geometry fully corrected"). Geometry participles are excluded because they
 * appear constantly in QA prose ("appears intentionally aligned").
 */
const MUTATION_VERB_RE =
  /\b(?:chang(?:e|ing)|replac(?:e|ing|ed)|rewrit(?:e|ing|ten)|rewor(?:d|ding|ded)|revis(?:e|ing|ed)|updat(?:e|ing|ed)|correct(?:ing|ed)?|fix(?:ing|ed)?|remov(?:e|ing|ed)|delet(?:e|ing|ed)|swap(?:ping)?|shorten(?:ing)?|expand(?:ing)?|clarif(?:y|ying)|add(?:ing)?|insert(?:ing)?|set(?:ting)?|mov(?:e|ing)|shift(?:ing)?|reposition(?:ing)?|resiz(?:e|ing)|align(?:ing)?|extend(?:ing)?|increas(?:e|ing)|reduc(?:e|ing)|tighten(?:ing)?|compress(?:ing)?|rais(?:e|ing)|lower(?:ing)?|nudg(?:e|ing)|adjust(?:ing)?|standardiz(?:e|ing)|normaliz(?:e|ing)|rebalanc(?:e|ing)|redistribut(?:e|ing)|reflow(?:ing)?|reorganiz(?:e|ing)|reorder(?:ing)?|reformat(?:ting)?|restructur(?:e|ing)|restor(?:e|ing)|rework(?:ing)?|refin(?:e|ing)|improv(?:e|ing)|balanc(?:e|ing)|cent(?:er|re|ering|ring)|plac(?:e|ing)|stack(?:ing)?|recomput(?:e|ing)|recalculat(?:e|ing)|calculat(?:e|ing)|cascad(?:e|ing)|position(?:ing)?|mak(?:e|ing)(?!\s+sure)|restyl(?:e|ing)|recolou?r(?:ing)?|italici[sz](?:e|ing)|capitali[sz](?:e|ing)|indent(?:ing)?|outdent(?:ing)?|widen(?:ing)?|enlarg(?:e|ing)|truncat(?:e|ing)|condens(?:e|ing)|merg(?:e|ing)|ungroup(?:ing)?|renam(?:e|ing)|appl(?:y|ying)|enforc(?:e|ing)|convert(?:ing)?|unif(?:y|ying)|harmoni[sz](?:e|ing)|distribut(?:e|ing))\b/;

/** Concrete, changeable targets: sections, objects, and mutable properties. */
const MUTATION_TARGET_RE =
  /\b(?:professional title|job title|role title|title|headline|summary|experience|employment history|work history|skills?|projects?|certifications?|credentials?|education|languages?|header|footer|sidebar|side bar|contact|candidate name|name|bullets?|bullet points?|content|copy|wording|text|textbox|text box|object|objects|element|elements|section|sections|heading|headings|marker|markers|column|columns|lane|page|page space|line height|line spacing|font size|font|typography|spacing|separation|gap|gaps|margin|margins|padding|position|positions|width|height|dimensions?|geometry|layout|whitespace|vertical space|available space|\d+\s*px)\b/;

/**
 * Requirement modality: the Founder states a required end-state rather than an
 * imperative action ("Summary, Experience … must all represent Operations
 * Analyst", "Ensure all Experience bullets focus on …").
 */
const REQUIREMENT_MODALITY_RE =
  /\b(?:must|should|need(?:s)? to|has to|have to|ensure|ensuring|make sure|required to|shall)\b/;

/** Nouns that make a clause a resume-content requirement rather than layout. */
const CONTENT_DOMAIN_TARGET_RE =
  /\b(?:professional title|job title|role title|summary|experience|employment history|work history|skills?|projects?|certifications?|credentials?|education|languages?|bullets?|responsibilities|achievements?|metrics?|tools?|content|copy|wording|context)\b/;

/**
 * Deterministic verification topics. Each maps to a post-execution check that
 * already owns the requirement, so these never need an AI operation.
 */
const VERIFICATION_TOPICS: ReadonlyArray<
  readonly [VerificationCheckType, RegExp]
> = [
  [
    "COLLISION_BOUNDS",
    /\b(?:overlap|overlaps|overlapping|non[- ]overlapping|collision|collisions|collide|collides|clip|clips|clipped|clipping|out[- ]of[- ]bounds|out of bounds|page boundaries|page bounds|overflow|overflows|touches|touching|visually merges|merges with|obscure|obscures|intrud(?:e|es|ing)|intrusion|encroach\w*|duplicate text|duplication|readable|readability|legible)\b/,
  ],
  [
    "PAGE_FIT",
    /\b(?:one[- ]page|single page|fits? on one page|page fit|within the page height|page length)\b/,
  ],
  [
    "ROLE_TARGET_INTEGRITY",
    /\b(?:target role|role target|role[- ]target|role consistency|role mismatch|match(?:es|ing)? the (?:target )?role|represent the (?:target )?role|consistently represent|consistently describe)\b/,
  ],
  // A design domain on its own is not a checkable end-state — the check proves
  // sameness of repeated elements, so the line must frame it as sameness.
  // "Review overall typography against the approved templates" names no
  // provable predicate and stays a mutation requirement.
  [
    "VISUAL_CONSISTENCY",
    /\b(?:design system|repeated components|repeated headings|coherent and repeatable|visual qa)\b|\b(?:identical|same|uniform|consistent|matching|share (?:one|the same))\b[^.;]{0,48}\b(?:typograph\w+|fonts?|font size|type size|heading style)\b|\b(?:typograph\w+|fonts?|heading style)\b[^.;]{0,48}\b(?:identical|uniform|consistent|matching|share (?:one|the same))\b/,
  ],
  [
    "CONTENT_PRESERVATION",
    /\b(?:fabricat\w*|invent\w*|truthful|factual)\b/,
  ],
  [
    "ARCHITECTURE_PRESERVATION",
    /\b(?:two[- ]column|column architecture|visual identity|overall architecture)\b/,
  ],
];

/** Verbs that request inspection of an end-state rather than a mutation. */
const VERIFICATION_VERB_RE =
  /\b(?:verify|verifying|check|checking|confirm|confirming|validat(?:e|ing)|review(?:ing)?|audit(?:ing)?|inspect(?:ing)?|qa|ensure|ensuring|make sure|guarantee)\b/;

/**
 * Outcome assertions. The Founder states a required property of the result
 * without an inspection verb ("Return a clean one-page Resume Template with no
 * overlapping text…", "prevent any text or heading collisions"). These are
 * acceptance requirements, not mutation instructions.
 */
const OUTCOME_ASSERTION_RE =
  /\b(?:no|zero|never|without|free of|prevent|prevents|avoid|avoids|eliminate|eliminates|remain|remains|stay|stays|keep|keeps|clean)\b/;

/** Preservation verbs and prohibition forms. */
const PRESERVATION_VERB_RE =
  /\b(?:preserv(?:e|ing)|retain(?:ing)?|keep(?:ing)?|maintain(?:ing)?|leave(?:\s+\w+)? (?:unchanged|as[- ]is|alone)|unchanged|untouched|intact|as[- ]is)\b/;

/** A clause opening with a preservation verb: the whole clause forbids change. */
const LEADING_PRESERVATION_VERB_RE =
  /^(?:preserv(?:e|ing)|retain(?:ing)?|keep(?:ing)?|maintain(?:ing)?|leav(?:e|ing))\b/;

/** Preservation of the state that already exists — nothing to change. */
const PRESERVE_EXISTING_STATE_RE =
  /\b(?:existing|current|present|already|unchanged|untouched|intact|as[- ]is)\b/;

/**
 * Protected things a preservation clause can name. Deliberately excludes
 * spacing / gap / rhythm / alignment as primary signals: "maintain consistent
 * vertical spacing" is a layout requirement the deterministic normalizer owns,
 * not a preservation constraint.
 */
const PRESERVATION_TARGETS: ReadonlyArray<
  readonly [VerificationCheckType, RegExp]
> = [
  [
    "CONTENT_PRESERVATION",
    /\b(?:candidate name|candidate's name|the name|job title|role title|contact information|contact[- ]information|contact details|contact data|personal details|factual|truthful|resume information|existing content|employment dates|dates|employer names|credentials|skills?)\b/,
  ],
  [
    "ARCHITECTURE_PRESERVATION",
    /\b(?:architecture|two[- ]column|column structure|visual identity|visual style|sidebar background|section markers?|(?:header|overall|visual|existing|current)\s+design|design (?:language|system)|colors?|colours?|palette|navy|typography|typographic hierarchy|visual hierarchy|fonts?|styling|brand)\b/,
  ],
  [
    "LAYOUT_PRESERVATION",
    /\b(?:current layout|existing layout|contact layout|header layout|layout|structure|section order|composition|unrelated|other|remaining|rest of|sections?|elements?|resume template|template|anchors?|relationship)\b/,
  ],
];

function mutationResult(): ClassifiedRequestedChange {
  return {
    classification: "MUTATION_REQUIRED",
    check_type: null,
    check_types: [],
    canonical_form: null,
  };
}

function preservationResult(
  check_types: VerificationCheckType[],
): ClassifiedRequestedChange {
  return {
    classification: "PRESERVATION_CONSTRAINT",
    check_type: check_types[0] ?? null,
    check_types,
    canonical_form: null,
  };
}

/**
 * Explicit mutation intent: mutation verb + concrete target, not forbidden.
 *
 * "Preserve the current positioning and hierarchy of the name" names a mutable
 * property but demands no mutation, so preserve-existing-state clauses are
 * excluded even when they contain a mutation-verb form.
 */
function clauseHasConcreteMutationIntent(clause: IntentClause): boolean {
  if (!clause.positive) return false;
  // A clause that opens with a preservation verb demands no change, whatever
  // mutable nouns follow it ("Preserve the narrow sidebar architecture").
  if (LEADING_PRESERVATION_VERB_RE.test(clause.text)) return false;
  if (
    PRESERVATION_VERB_RE.test(clause.text) &&
    PRESERVE_EXISTING_STATE_RE.test(clause.text)
  ) {
    return false;
  }
  if (!MUTATION_VERB_RE.test(clause.text)) return false;
  return MUTATION_TARGET_RE.test(clause.text);
}

/** Measurable geometric relationships between objects. */
const LAYOUT_RELATION_RE =
  /\b(?:spacing|separation|rhythm|gaps?|margins?|padding|line height|line spacing|baseline|align|aligned|alignment|balanced|cent(?:er|re)ed|inside|within|contained|page space|available space|whitespace|visually distinct|relationships?|visual reference)\b/;

/** Objects a geometric relationship can be asserted between. */
const LAYOUT_RELATION_TARGET_RE =
  /\b(?:sections?|headings?|content|columns?|sidebar|side bar|page|header|footer|entries|entry|body|blocks?|titles?|descriptions?|markers?|summary|experience|education|skills?|projects?|certifications?|languages?|contact|name|text|objects?)\b/;

/**
 * A geometric outcome the Founder demands ("maintain a clear and consistent
 * vertical gap between Skills → Projects …", "keep the name, role title, and
 * contact row together inside the header rectangle").
 *
 * These are real geometry requirements even when their verb is a preservation
 * verb. The deterministic layout normalizer owns the geometry, so the
 * requirement stays MUTATION_REQUIRED and draws its coverage from that
 * ownership rather than from a preservation exemption.
 *
 * Evaluated only after verification topics, so overlap / clipping / bounds
 * outcomes go to the collision check that actually proves them.
 */
function clauseIsLayoutOutcomeRequirement(clause: IntentClause): boolean {
  if (!clause.positive) return false;
  // Only an explicit reference to the state that already exists rules this out.
  // "Keep each section's heading, marker, and content visually grouped as one
  // unit with consistent internal spacing" is a geometry requirement, not a
  // freeze, even though it opens with a preservation verb.
  if (
    PRESERVATION_VERB_RE.test(clause.text) &&
    PRESERVE_EXISTING_STATE_RE.test(clause.text)
  ) {
    return false;
  }
  if (!LAYOUT_RELATION_RE.test(clause.text)) return false;
  return LAYOUT_RELATION_TARGET_RE.test(clause.text);
}

/** Verbs that edit text content rather than move or size an object. */
const CONTENT_MUTATION_VERB_RE =
  /\b(?:chang(?:e|ing)|replac(?:e|ing)|rewrit(?:e|ing)|rewor(?:d|ding)|revis(?:e|ing)|updat(?:e|ing)|remov(?:e|ing)|delet(?:e|ing)|swap(?:ping)?|shorten(?:ing)?|clarif(?:y|ying)|add(?:ing)?|insert(?:ing)?|set(?:ting)?)\b/;

/** Geometry properties that mark a clause as layout rather than content work. */
const GEOMETRY_PROPERTY_RE =
  /\b(?:line height|line spacing|text box height|box height|height|width|dimensions?|position(?:s|ing)?|spacing|separation|gaps?|margins?|padding|whitespace|vertical space|available space|page space|wrapping|wrap|baseline|align\w*|balanc\w*|\d+\s*px)\b/;

/**
 * True when any clause explicitly asks for a resume-content edit ("Change the
 * professional title from Marketing Manager to Operations Analyst …").
 * Clause-scoped, so a trailing preservation clause that mentions header
 * design or contact layout cannot mask the content request.
 *
 * Deterministic layout owners use this to stay out of content ownership: the
 * AI planner owns text content, the normalizer owns geometry. A geometry verb
 * ("Move the Education heading down 20px") or a geometry property ("correct
 * line height inside Certifications") keeps the clause with the normalizer.
 */
export function hasConcreteContentMutationClause(
  requestedChange: string,
): boolean {
  const normalized = normalizeForClassification(requestedChange);
  if (!normalized) return false;
  return resolveIntentClauses(normalized).some((clause) => {
    if (!clause.positive) return false;
    if (
      PRESERVATION_VERB_RE.test(clause.text) &&
      PRESERVE_EXISTING_STATE_RE.test(clause.text)
    ) {
      return false;
    }
    if (!CONTENT_MUTATION_VERB_RE.test(clause.text)) return false;
    if (GEOMETRY_PROPERTY_RE.test(clause.text)) return false;
    return CONTENT_DOMAIN_TARGET_RE.test(clause.text);
  });
}

/** Mutable design domains an executable operation can actually change. */
const DESIGN_DOMAIN_TARGET_RE =
  /\b(?:typograph\w+|fonts?|font sizes?|type sizes?|font weights?|colou?rs?|palette|styling|visual hierarchy|typographic hierarchy|capitali[sz]ation|casing)\b/;

/**
 * A standard the Founder wants the design brought up to, rather than a
 * property value. No deterministic check can prove "matches our best
 * templates", so the requirement belongs to the AI planner.
 */
const QUALITY_STANDARD_RE =
  /\b(?:against|compared (?:to|with)|in line with|to match|benchmark\w*|approved templates?|reference templates?|highest[- ]quality|best[- ]in[- ]class|previously approved)\b/;

/**
 * Design-standard mutation requirement: an inspection verb aimed at a mutable
 * design domain measured against an external standard ("Review overall
 * typography against the highest-quality previously approved templates").
 *
 * Evaluated after verification so sameness-framed lines ("all headings must
 * share one font size") still go to the VISUAL_CONSISTENCY check.
 */
function clauseIsDesignStandardMutationRequirement(
  clause: IntentClause,
): boolean {
  if (!clause.positive) return false;
  if (
    PRESERVATION_VERB_RE.test(clause.text) &&
    PRESERVE_EXISTING_STATE_RE.test(clause.text)
  ) {
    return false;
  }
  if (!DESIGN_DOMAIN_TARGET_RE.test(clause.text)) return false;
  return QUALITY_STANDARD_RE.test(clause.text);
}

/**
 * Declarative mutation requirement: no imperative verb, but the Founder states
 * a required end-state for concrete resume content ("Summary, Experience …
 * context must all consistently represent Operations Analyst"). Evaluated only
 * after verification and preservation, so acceptance-owned outcomes win.
 */
function clauseHasDeclarativeMutationRequirement(clause: IntentClause): boolean {
  if (!clause.positive) return false;
  if (!REQUIREMENT_MODALITY_RE.test(clause.text)) return false;
  return CONTENT_DOMAIN_TARGET_RE.test(clause.text);
}

function clauseVerificationChecks(clause: IntentClause): VerificationCheckType[] {
  const out: VerificationCheckType[] = [];
  for (const [checkType, topic] of VERIFICATION_TOPICS) {
    if (topic.test(clause.text)) out.push(checkType);
  }
  return out;
}

function clausePreservationChecks(clause: IntentClause): VerificationCheckType[] {
  const out: VerificationCheckType[] = [];
  for (const [checkType, target] of PRESERVATION_TARGETS) {
    if (target.test(clause.text)) out.push(checkType);
  }
  return out;
}

function dedupeChecks(
  checks: VerificationCheckType[],
): VerificationCheckType[] {
  return [...new Set(checks)];
}

/**
 * Durable requested-change intent resolution.
 *
 * Replaces the former `return MUTATION_REQUIRED` default. Resolution order is
 * the contract:
 *   1. explicit mutation — verb + concrete target in a demanding clause
 *   2. design standard — a mutable design domain measured against a standard
 *   3. geometric outcome — the deterministic layout normalizer owns it
 *   3b. deterministic verification outcome — a post-execution check owns it
 *   4. preservation constraint — nothing may change
 *   5. declarative content requirement — a required content end-state
 *   6. general acceptance — no owner resolvable; still zero operations
 */
export function resolveRequestedChangeIntent(
  normalized: string,
): ClassifiedRequestedChange {
  const clauses = resolveIntentClauses(normalized);
  if (clauses.length === 0) return verificationResult(["GENERAL_ACCEPTANCE"]);

  if (clauses.some((c) => clauseHasConcreteMutationIntent(c))) {
    return mutationResult();
  }

  // A bare topic mention is not a verification demand on its own: the line must
  // ask for inspection, assert a requirement, assert an outcome, or prohibit.
  const demandsVerification =
    VERIFICATION_VERB_RE.test(normalized) ||
    REQUIREMENT_MODALITY_RE.test(normalized) ||
    OUTCOME_ASSERTION_RE.test(normalized);
  const verificationChecks: VerificationCheckType[] = [];
  const verificationClauses = new Set<IntentClause>();
  for (const clause of clauses) {
    const checks = clauseVerificationChecks(clause);
    if (checks.length === 0) continue;
    if (demandsVerification || !clause.positive) {
      verificationChecks.push(...checks);
      verificationClauses.add(clause);
    }
  }

  // A geometry demand outranks an acceptance clause sitting beside it:
  // "Maintain a consistent positive vertical gap between each sidebar section
  // and ensure there are zero text collisions" must still produce the gap.
  // Only a clause that is NOT itself the acceptance clause can do this, so
  // "Ensure the Certifications section has sufficient spacing so no text
  // overlaps" stays with the collision check that actually proves it.
  const mutationClauses = clauses.filter((c) => !verificationClauses.has(c));

  if (mutationClauses.some((c) => clauseIsDesignStandardMutationRequirement(c))) {
    return mutationResult();
  }

  if (mutationClauses.some((c) => clauseIsLayoutOutcomeRequirement(c))) {
    return mutationResult();
  }

  if (verificationChecks.length > 0) {
    return verificationResult(dedupeChecks(verificationChecks));
  }

  const preservationChecks: VerificationCheckType[] = [];
  const preserves =
    PRESERVATION_VERB_RE.test(normalized) || clauses.some((c) => !c.positive);
  if (preserves) {
    for (const clause of clauses) {
      if (clause.positive && !PRESERVATION_VERB_RE.test(clause.text)) continue;
      preservationChecks.push(...clausePreservationChecks(clause));
    }
  }
  if (preservationChecks.length > 0) {
    return preservationResult(dedupeChecks(preservationChecks));
  }

  if (clauses.some((c) => clauseHasDeclarativeMutationRequirement(c))) {
    return mutationResult();
  }

  return verificationResult(["GENERAL_ACCEPTANCE"]);
}

/**
 * Classify a Founder requested change.
 * Exact canonical match first, then the historical narrow verification
 * patterns (compatibility fast paths), then durable intent resolution.
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

  return resolveRequestedChangeIntent(n);
}

export function isVerificationAcceptance(requestedChange: string): boolean {
  return (
    classifyRequestedChange(requestedChange).classification ===
    "VERIFICATION_ACCEPTANCE"
  );
}

/** True when the Founder line forbids change rather than requesting one. */
export function isPreservationConstraint(requestedChange: string): boolean {
  return (
    classifyRequestedChange(requestedChange).classification ===
    "PRESERVATION_CONSTRAINT"
  );
}

/**
 * True when the Founder line requires ZERO AI operations.
 *
 * Verification and preservation requirements are proven by deterministic
 * post-execution evidence. Creating an operation to carry their attribution is
 * forbidden — that is exactly what produced the empty-values placeholder
 * operations in revtask-9441fe34-4ba.
 */
export function requiresZeroOperations(requestedChange: string): boolean {
  const c = classifyRequestedChange(requestedChange).classification;
  return c === "VERIFICATION_ACCEPTANCE" || c === "PRESERVATION_CONSTRAINT";
}
