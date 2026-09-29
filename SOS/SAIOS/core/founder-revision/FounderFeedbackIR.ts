/**
 * C1 — one canonical Founder Request Changes compiler.
 *
 * Downstream revision stages consume this IR instead of independently
 * re-parsing Founder language. Clause classifiers remain implementation
 * details of this module's callees; they are not a second public semantic path.
 *
 * Does not write Founder Memory. Does not change generation admission (C2).
 */
import { createRequire } from "node:module";
import {
  classifyRequestedChange,
  type RequestedChangeClass,
  type VerificationCheckType,
} from "./RequestedChangeClassification.js";
import {
  assembleRevisionIntentScope,
  resolveRevisionIntentForChange,
  type ContentSectionKey,
  type RevisionIntentClass,
  type RevisionIntentScope,
  type ResolvedRevisionIntentItem,
} from "./RevisionIntentScope.js";

/**
 * Layout-ownership predicates live in DeterministicSpacingPlan. Require lazily
 * so this module does not create a load cycle through completeness/acceptance.
 */
const require = createRequire(import.meta.url);
function layoutOwnership(): {
  isCanonicalLayoutOwnedItem: (requestedChange: string) => boolean;
  isValidationOnlyRequestedChange: (requestedChange: string) => boolean;
} {
  return require("./DeterministicSpacingPlan.js") as typeof import("./DeterministicSpacingPlan.js");
}

export type FeedbackCoverageMode =
  | "MUTATION_REQUIRED"
  | "VERIFICATION_ACCEPTANCE"
  | "PRESERVATION_CONSTRAINT"
  | "VALIDATION_ONLY"
  | "DETERMINISTIC_LAYOUT_OWNED";

export const FOUNDER_FEEDBACK_IR_SCHEMA = "founder-feedback-ir-1.0.0" as const;

/** Public semantic interpretation paths after C1. */
export const NUMBER_OF_SEMANTIC_INTERPRETATION_PATHS = 1;

export type FounderFeedbackAction =
  | "CONTENT_MUTATION"
  | "CONTENT_REMOVAL"
  | "LAYOUT_MUTATION"
  | "CONTENT_PRESERVATION"
  | "LAYOUT_PRESERVATION"
  | "VERIFICATION"
  | "ALREADY_SATISFIED";

export type FounderFeedbackIRItem = {
  founder_feedback_item: string;
  action: FounderFeedbackAction;
  clause_actions: FounderFeedbackAction[];
  coverage_mode: FeedbackCoverageMode;
  layout_owned: boolean;
  classification: RequestedChangeClass;
  check_types: VerificationCheckType[];
  content_sections: ContentSectionKey[];
  layout_sections: ContentSectionKey[];
  preservation_sections: ContentSectionKey[];
  completeness_required: boolean;
  intent: ResolvedRevisionIntentItem;
};

export type FounderFeedbackIR = {
  schema_version: typeof FOUNDER_FEEDBACK_IR_SCHEMA;
  items: FounderFeedbackIRItem[];
  content_mutation_sections: ContentSectionKey[];
  content_replacement_sections: ContentSectionKey[];
  content_removal_sections: ContentSectionKey[];
  layout_mutation_sections: ContentSectionKey[];
  content_preservation_sections: ContentSectionKey[];
  layout_preservation_sections: ContentSectionKey[];
  /** Whole-section replacement ledger. Mutation only — never preservation. */
  completeness_sections: ContentSectionKey[];
  intent_scope: RevisionIntentScope;
};

function actionFromIntentClass(
  intent_class: RevisionIntentClass,
): FounderFeedbackAction {
  switch (intent_class) {
    case "CONTENT_REPLACEMENT":
      return "CONTENT_MUTATION";
    case "CONTENT_REMOVAL":
      return "CONTENT_REMOVAL";
    case "LAYOUT_MUTATION":
      return "LAYOUT_MUTATION";
    case "CONTENT_PRESERVATION":
      return "CONTENT_PRESERVATION";
    case "LAYOUT_PRESERVATION":
      return "LAYOUT_PRESERVATION";
    case "VERIFICATION":
      return "VERIFICATION";
  }
}

function dominantAction(
  item: ResolvedRevisionIntentItem,
  classification: RequestedChangeClass,
): FounderFeedbackAction {
  const clause_actions = item.clauses.map((c) =>
    actionFromIntentClass(c.intent_class),
  );
  if (clause_actions.includes("CONTENT_REMOVAL")) return "CONTENT_REMOVAL";
  if (clause_actions.includes("CONTENT_MUTATION")) return "CONTENT_MUTATION";
  if (clause_actions.includes("CONTENT_PRESERVATION")) {
    return "CONTENT_PRESERVATION";
  }
  if (clause_actions.includes("LAYOUT_PRESERVATION")) {
    return "LAYOUT_PRESERVATION";
  }
  if (classification === "VERIFICATION_ACCEPTANCE") return "ALREADY_SATISFIED";
  if (clause_actions.includes("LAYOUT_MUTATION")) return "LAYOUT_MUTATION";
  if (clause_actions.includes("VERIFICATION")) return "VERIFICATION";
  if (classification === "PRESERVATION_CONSTRAINT") {
    return "CONTENT_PRESERVATION";
  }
  return "VERIFICATION";
}

function coverageModeForLine(
  line: string,
  classification: RequestedChangeClass,
  layout_owned: boolean,
  clause_actions: FounderFeedbackAction[],
): FeedbackCoverageMode {
  if (
    clause_actions.includes("CONTENT_REMOVAL") ||
    clause_actions.includes("CONTENT_MUTATION")
  ) {
    return "MUTATION_REQUIRED";
  }
  if (classification === "MUTATION_REQUIRED") {
    if (layoutOwnership().isValidationOnlyRequestedChange(line)) {
      return "VALIDATION_ONLY";
    }
    if (layout_owned) return "DETERMINISTIC_LAYOUT_OWNED";
    return "MUTATION_REQUIRED";
  }
  if (clause_actions.includes("CONTENT_PRESERVATION") && !layout_owned) {
    return "PRESERVATION_CONSTRAINT";
  }
  if (classification === "VERIFICATION_ACCEPTANCE") {
    return "VERIFICATION_ACCEPTANCE";
  }
  if (classification === "PRESERVATION_CONSTRAINT") {
    return "PRESERVATION_CONSTRAINT";
  }
  if (layoutOwnership().isValidationOnlyRequestedChange(line)) {
    return "VALIDATION_ONLY";
  }
  if (layout_owned) return "DETERMINISTIC_LAYOUT_OWNED";
  return "MUTATION_REQUIRED";
}

/**
 * Compile one Founder Request Changes packet into the canonical IR.
 * Call this once per revision run; pass the result downstream.
 */
export function compileFounderFeedbackIR(
  requested_changes: string[],
): FounderFeedbackIR {
  const intentItems = requested_changes.map((c) =>
    resolveRevisionIntentForChange(c),
  );
  const intent_scope = assembleRevisionIntentScope(intentItems);
  const items: FounderFeedbackIRItem[] = intentItems.map((intent) => {
    const classified = classifyRequestedChange(intent.founder_feedback_item);
    const layout_owned = layoutOwnership().isCanonicalLayoutOwnedItem(
      intent.founder_feedback_item,
    );
    const content_sections = [
      ...new Set(intent.clauses.flatMap((c) => c.content_scope)),
    ];
    const layout_sections = [
      ...new Set(intent.clauses.flatMap((c) => c.layout_scope)),
    ];
    const preservation_sections = [
      ...new Set(intent.clauses.flatMap((c) => c.preservation_scope)),
    ];
    const clause_actions = intent.clauses.map((c) =>
      actionFromIntentClass(c.intent_class),
    );
    return {
      founder_feedback_item: intent.founder_feedback_item,
      action: dominantAction(intent, classified.classification),
      clause_actions,
      coverage_mode: coverageModeForLine(
        intent.founder_feedback_item,
        classified.classification,
        layout_owned,
        clause_actions,
      ),
      layout_owned,
      classification: classified.classification,
      check_types: classified.check_types ?? [],
      content_sections,
      layout_sections,
      preservation_sections,
      completeness_required: content_sections.length > 0,
      intent,
    };
  });

  return {
    schema_version: FOUNDER_FEEDBACK_IR_SCHEMA,
    items,
    content_mutation_sections: intent_scope.content_mutation_sections,
    content_replacement_sections: intent_scope.content_replacement_sections,
    content_removal_sections: intent_scope.content_removal_sections,
    layout_mutation_sections: intent_scope.layout_sections,
    content_preservation_sections: intent_scope.content_preservation_sections,
    layout_preservation_sections: intent_scope.layout_preservation_sections,
    completeness_sections: intent_scope.content_mutation_sections,
    intent_scope,
  };
}

export function founderFeedbackIRItem(
  ir: FounderFeedbackIR,
  founder_feedback_item: string,
): FounderFeedbackIRItem | undefined {
  return ir.items.find((i) => i.founder_feedback_item === founder_feedback_item);
}
