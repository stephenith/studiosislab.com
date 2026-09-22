/**
 * Phase 6M — one canonical revision-intent / content-vs-layout scope owner.
 *
 * RevisionRoleTargetIntegrity, SectionReplacementCompleteness,
 * RevisionAcceptanceChecks, FeedbackCoverage, and the planner must consume
 * this resolver instead of independently compiling section nouns + verbs.
 *
 * Generation RoleTargetIntegrity is intentionally not imported.
 */
import {
  classifyRequestedChange,
  resolveIntentClauses,
  type RequestedChangeClass,
} from "./RequestedChangeClassification.js";
export type ContentSectionKey =
  | "job_title"
  | "summary"
  | "experience"
  | "skills"
  | "projects"
  | "certifications"
  | "education";

export type RevisionIntentClass =
  | "CONTENT_REPLACEMENT"
  | "CONTENT_REMOVAL"
  | "LAYOUT_MUTATION"
  | "CONTENT_PRESERVATION"
  | "LAYOUT_PRESERVATION"
  | "VERIFICATION";

export type RevisionIntentClause = {
  text: string;
  positive: boolean;
  intent_class: RevisionIntentClass;
  target_sections: ContentSectionKey[];
  content_scope: ContentSectionKey[];
  layout_scope: ContentSectionKey[];
  preservation_scope: ContentSectionKey[];
  verification_scope: string[];
};

export type ResolvedRevisionIntentItem = {
  founder_feedback_item: string;
  classification: RequestedChangeClass;
  clauses: RevisionIntentClause[];
};

export type RevisionIntentScope = {
  schema_version: "revision-intent-scope-1.0.0";
  items: ResolvedRevisionIntentItem[];
  content_replacement_sections: ContentSectionKey[];
  content_removal_sections: ContentSectionKey[];
  content_mutation_sections: ContentSectionKey[];
  layout_sections: ContentSectionKey[];
  content_preservation_sections: ContentSectionKey[];
  layout_preservation_sections: ContentSectionKey[];
};

const SECTION_NOUNS: ReadonlyArray<readonly [ContentSectionKey, RegExp]> = [
  [
    "job_title",
    /\b(professional title|job title|professional identity|role title|title in the header)\b/i,
  ],
  ["summary", /\b(summary|professional summary)\b/i],
  ["experience", /\b(experience|employment history|work history)\b/i],
  ["skills", /\bskills?\b/i],
  ["projects", /\bprojects?\b/i],
  ["certifications", /\b(certifications?|credentials?)\b/i],
  ["education", /\b(education|qualifications?)\b/i],
];

const CONTENT_REWRITE_VERB =
  /\b(replace|rewrite|rewrit|reword|revise|update|swap|rework|refresh|correct|change)\b/i;
const CONTENT_REMOVE_VERB = /\b(remove|delete|drop|strip)\b/i;
const LAYOUT_OBJECT_RE =
  /\b(blank|whitespace|white space|gap|gaps|area|space|spacing|overlap|overlapp|collid|collision|margin|padding|position|reposition|rhythm|geometry|overflow|clip|wrap|alignment|bounds)\b/i;
const LAYOUT_MUTATION_RE =
  /\b(move|shift|reposition|rebalance|separate|separat(?:e|ion)|increase|reduce|close|tighten|normalize|standardize|reflow|fix the visible overlap|fix the overlap)\b/i;
const PRESERVATION_RE =
  /\b(preserv(?:e|ing|ation)?|retain(?:ing)?|keep(?:ing)?|maintain(?:ing)?|unchanged|untouched|intact|as-is|as is|do not (?:rewrite|replace|change|alter|modify|invent))\b/i;
const NAMED_PROFESSIONAL_IDENTITY_RE =
  /\b(?:marketing manager|graphic designer|product manager|hr manager|human resources|software engineer|data scientist|operations analyst)\b/i;
const SPECIFIC_CONTENT_ITEM_RE =
  /\b(?:google analytics|abm(?:\s+project)?|[\"“][^\"”]{2,}[\"”])\b/i;

function mentionedSections(text: string): ContentSectionKey[] {
  const out: ContentSectionKey[] = [];
  const n = text.toLowerCase();
  for (const [key, re] of SECTION_NOUNS) {
    if (re.test(n)) out.push(key);
  }
  return out;
}

function uniqueSections(values: ContentSectionKey[]): ContentSectionKey[] {
  return [...new Set(values)];
}

function isLayoutObjectClause(text: string): boolean {
  return LAYOUT_OBJECT_RE.test(text) || LAYOUT_MUTATION_RE.test(text);
}

function isContentRemovalClause(text: string): boolean {
  if (!CONTENT_REMOVE_VERB.test(text)) return false;
  if (isLayoutObjectClause(text) && !NAMED_PROFESSIONAL_IDENTITY_RE.test(text) && !SPECIFIC_CONTENT_ITEM_RE.test(text)) {
    return false;
  }
  return (
    mentionedSections(text).length > 0 ||
    NAMED_PROFESSIONAL_IDENTITY_RE.test(text) ||
    SPECIFIC_CONTENT_ITEM_RE.test(text)
  );
}

function isContentReplacementClause(text: string): boolean {
  if (!CONTENT_REWRITE_VERB.test(text)) return false;
  if (isLayoutObjectClause(text) && !NAMED_PROFESSIONAL_IDENTITY_RE.test(text)) {
    return false;
  }
  return mentionedSections(text).length > 0;
}

function classifyClause(
  text: string,
  positive: boolean,
  lineClass: RequestedChangeClass,
): RevisionIntentClass {
  if (!positive || PRESERVATION_RE.test(text)) {
    if (LAYOUT_OBJECT_RE.test(text) && !CONTENT_REWRITE_VERB.test(text) && !isContentRemovalClause(text)) {
      return "LAYOUT_PRESERVATION";
    }
    return "CONTENT_PRESERVATION";
  }
  if (isContentRemovalClause(text)) return "CONTENT_REMOVAL";
  if (isContentReplacementClause(text)) return "CONTENT_REPLACEMENT";
  if (isLayoutObjectClause(text) || LAYOUT_MUTATION_RE.test(text)) {
    return "LAYOUT_MUTATION";
  }
  if (lineClass === "VERIFICATION_ACCEPTANCE") return "VERIFICATION";
  if (lineClass === "PRESERVATION_CONSTRAINT") {
    return LAYOUT_OBJECT_RE.test(text) ? "LAYOUT_PRESERVATION" : "CONTENT_PRESERVATION";
  }
  if (LAYOUT_MUTATION_RE.test(text) || LAYOUT_OBJECT_RE.test(text)) {
    return "LAYOUT_MUTATION";
  }
  return lineClass === "MUTATION_REQUIRED" ? "LAYOUT_MUTATION" : "VERIFICATION";
}

export function resolveRevisionIntentForChange(
  requestedChange: string,
): ResolvedRevisionIntentItem {
  const classification = classifyRequestedChange(requestedChange);
  const rawClauses = resolveIntentClauses(requestedChange.toLowerCase());
  const sourceClauses =
    rawClauses.length > 0
      ? rawClauses
      : [{ text: requestedChange.toLowerCase(), positive: true }];
  const clauses = sourceClauses.map((clause) => {
    const intent_class = classifyClause(
      clause.text,
      clause.positive,
      classification.classification,
    );
    const sections = mentionedSections(clause.text);
    const content_scope =
      intent_class === "CONTENT_REPLACEMENT" || intent_class === "CONTENT_REMOVAL"
        ? sections
        : [];
    const layout_scope = intent_class === "LAYOUT_MUTATION" ? sections : [];
    const preservation_scope =
      intent_class === "CONTENT_PRESERVATION" || intent_class === "LAYOUT_PRESERVATION"
        ? sections
        : [];
    const verification_scope = intent_class === "VERIFICATION" ? sections : [];
    return {
      text: clause.text,
      positive: clause.positive,
      intent_class,
      target_sections: sections,
      content_scope,
      layout_scope,
      preservation_scope,
      verification_scope,
    };
  });
  if (
    classification.classification === "PRESERVATION_CONSTRAINT" ||
    PRESERVATION_RE.test(requestedChange)
  ) {
    const named = mentionedSections(requestedChange);
    const already = new Set(clauses.flatMap((c) => c.preservation_scope));
    for (const section of named) {
      if (already.has(section)) continue;
      clauses.push({
        text: requestedChange.toLowerCase(),
        positive: false,
        intent_class: "CONTENT_PRESERVATION",
        target_sections: [section],
        content_scope: [],
        layout_scope: [],
        preservation_scope: [section],
        verification_scope: [],
      });
    }
  }
  return {
    founder_feedback_item: requestedChange,
    classification: classification.classification,
    clauses,
  };
}

/**
 * Conflict precedence: an explicit content mutation for a section wins over
 * preservation of that same section. Layout never creates content scope.
 */
export function resolveRevisionIntentScope(
  requested_changes: string[],
): RevisionIntentScope {
  const items = requested_changes.map((c) => resolveRevisionIntentForChange(c));
  const contentReplacement = new Set<ContentSectionKey>();
  const contentRemoval = new Set<ContentSectionKey>();
  const layout = new Set<ContentSectionKey>();
  const contentPreserve = new Set<ContentSectionKey>();
  const layoutPreserve = new Set<ContentSectionKey>();

  for (const item of items) {
    for (const clause of item.clauses) {
      for (const s of clause.content_scope) {
        if (clause.intent_class === "CONTENT_REMOVAL") contentRemoval.add(s);
        else contentReplacement.add(s);
      }
      for (const s of clause.layout_scope) layout.add(s);
      for (const s of clause.preservation_scope) {
        if (clause.intent_class === "LAYOUT_PRESERVATION") layoutPreserve.add(s);
        else contentPreserve.add(s);
      }
    }
  }

  const mutation = new Set<ContentSectionKey>([
    ...contentReplacement,
    ...contentRemoval,
  ]);
  for (const s of mutation) contentPreserve.delete(s);

  return {
    schema_version: "revision-intent-scope-1.0.0",
    items,
    content_replacement_sections: [...contentReplacement],
    content_removal_sections: [...contentRemoval],
    content_mutation_sections: [...mutation],
    layout_sections: [...layout],
    content_preservation_sections: [...contentPreserve],
    layout_preservation_sections: [...layoutPreserve],
  };
}

export function resolveRequestedContentMutationSections(
  requestedChange: string,
): Set<ContentSectionKey> {
  const item = resolveRevisionIntentForChange(requestedChange);
  const out = new Set<ContentSectionKey>();
  for (const clause of item.clauses) {
    for (const s of clause.content_scope) out.add(s);
  }
  return out;
}

export function isCollisionOrReadableGapLayoutRequest(requestedChange: string): boolean {
  const n = requestedChange.toLowerCase();
  if (
    /\b(verify|after the changes|return the same|do not solve|do not delete|do not rewrite|preserve|keep the current)\b/.test(
      n,
    )
  ) {
    return false;
  }
  return (
    /\b(fix|ensure|separate|separat(?:e|ion)|remove the (?:visible )?overlap|readable|line spacing|bullet-to-bullet)\b/.test(
      n,
    ) &&
    /\b(overlap|overlapp|collid|collision|touch(?:es|ing)?|visually merg|separate|gap|spacing)\b/.test(
      n,
    ) &&
    /\b(skills?|bullets?|entries|lines?|section)\b/.test(n)
  );
}

export function isLayoutOnlyIntentChange(requestedChange: string): boolean {
  const classification = classifyRequestedChange(requestedChange).classification;
  if (
    classification === "VERIFICATION_ACCEPTANCE" ||
    classification === "PRESERVATION_CONSTRAINT"
  ) {
    return false;
  }
  const item = resolveRevisionIntentForChange(requestedChange);
  const hasContent = item.clauses.some((c) => c.content_scope.length > 0);
  if (hasContent) return false;
  return item.clauses.some((c) => c.intent_class === "LAYOUT_MUTATION");
}

export function isExcessiveSectionGapLayoutRequest(requestedChange: string): boolean {
  const n = requestedChange.toLowerCase();
  if (
    /\b(do not create|do not anchor|do not push|verify|after the changes|return the same|preserve|keep)\b/.test(
      n,
    )
  ) {
    return false;
  }
  return (
    /\b(blank|whitespace|white space|excessive|unexplained|large)\b/.test(n) &&
    /\b(area|space|gap|vertical)\b/.test(n)
  ) || (
    /\b(move|shift|reposition)\b/.test(n) &&
    /\b(education|section)\b/.test(n) &&
    /\b(up|upward|follow)\b/.test(n)
  );
}
