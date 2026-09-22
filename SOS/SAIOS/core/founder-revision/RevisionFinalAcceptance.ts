/**
 * Phase 6L — one revision final-acceptance aggregator.
 *
 * Answers MAY_RETURN_TO_FOUNDER_REVIEW from already-computed owner verdicts.
 * Does not re-run generation role integrity, independent layout heuristics,
 * or a second overlap/OOB contract. Does not require generation resume JSON.
 */
import type { RevisionRoleTargetIntegrityResult } from "../role-integrity/RevisionRoleTargetIntegrity.js";
import type { CanonicalLayoutIntentEvidence } from "./CanonicalFinalStateLayoutProof.js";
import type { FeedbackCoverageReport } from "./revision-task-types.js";
import type { SectionReplacementCompletenessReport } from "./SectionReplacementCompleteness.js";

export const REVISION_FINAL_ACCEPTANCE_SCHEMA =
  "founder-revision-final-acceptance-1.0.0" as const;

export type RevisionOwnerName =
  | "plan_schema"
  | "authorization"
  | "section_replacement"
  | "content_execution"
  | "content_preservation"
  | "canonical_layout"
  | "final_geometry"
  | "page_fit"
  | "revision_role_integrity"
  | "feedback_coverage";

export type RevisionOwnerVerdict = {
  owner: RevisionOwnerName;
  pass: boolean;
  reason: string;
};

export type RevisionFinalAcceptance = {
  schema_version: typeof REVISION_FINAL_ACCEPTANCE_SCHEMA;
  evaluated_at: string;
  may_return_to_founder_review: boolean;
  overall: "PASS" | "FAIL";
  failed_owner: RevisionOwnerName | null;
  failure_code: string | null;
  failure_stage: string | null;
  failure_reason: string | null;
  owners: Record<RevisionOwnerName, RevisionOwnerVerdict>;
  provenance: {
    role_integrity: "revision_role_integrity";
    section_replacement: "section_replacement_completeness";
    layout_intent: "canonical_final_state_layout_proof";
    geometry: "final_rendered_geometry";
    page_fit: "revision_layout_normalization";
    feedback_coverage: "feedback_coverage";
    generation_role_integrity: "not_consumed";
  };
};

export type RevisionFinalAcceptanceInput = {
  plan_ok: boolean;
  plan_reason?: string | null;
  authorization_ok: boolean;
  authorization_reason?: string | null;
  section_replacement: Pick<SectionReplacementCompletenessReport, "ok" | "error">;
  content_execution_ok: boolean;
  content_execution_reason?: string | null;
  content_preservation_ok: boolean;
  content_preservation_reason?: string | null;
  canonical_layout_evidence?: CanonicalLayoutIntentEvidence[] | null;
  canonical_layout_ok?: boolean | null;
  text_overlap_count: number;
  page_oob_count: number;
  page_fit_ok: boolean;
  page_fit_reason?: string | null;
  revision_role: Pick<
    RevisionRoleTargetIntegrityResult,
    "pass" | "evaluable" | "match" | "reason"
  > | null;
  coverage: Pick<FeedbackCoverageReport, "gate_pass" | "all_addressed">;
};

function verdict(
  owner: RevisionOwnerName,
  pass: boolean,
  reason: string,
): RevisionOwnerVerdict {
  return { owner, pass, reason };
}

export function evaluateRevisionFinalAcceptance(
  input: RevisionFinalAcceptanceInput,
): RevisionFinalAcceptance {
  const layoutEvidence = input.canonical_layout_evidence ?? [];
  const layoutFromEvidence =
    layoutEvidence.length === 0
      ? input.canonical_layout_ok !== false
      : layoutEvidence.every((e) => e.pass);
  const layoutOk = input.canonical_layout_ok ?? layoutFromEvidence;
  const role = input.revision_role;
  const roleOk = Boolean(role && role.pass && role.evaluable);
  const geometryOk = input.text_overlap_count === 0 && input.page_oob_count === 0;

  const owners: Record<RevisionOwnerName, RevisionOwnerVerdict> = {
    plan_schema: verdict(
      "plan_schema",
      input.plan_ok,
      input.plan_ok ? "PASS" : input.plan_reason ?? "plan/schema failed",
    ),
    authorization: verdict(
      "authorization",
      input.authorization_ok,
      input.authorization_ok
        ? "PASS"
        : input.authorization_reason ?? "authorization failed",
    ),
    section_replacement: verdict(
      "section_replacement",
      input.section_replacement.ok,
      input.section_replacement.ok
        ? "PASS"
        : input.section_replacement.error ?? "section replacement incomplete",
    ),
    content_execution: verdict(
      "content_execution",
      input.content_execution_ok,
      input.content_execution_ok
        ? "PASS"
        : input.content_execution_reason ?? "content execution failed",
    ),
    content_preservation: verdict(
      "content_preservation",
      input.content_preservation_ok,
      input.content_preservation_ok
        ? "PASS"
        : input.content_preservation_reason ?? "content preservation failed",
    ),
    canonical_layout: verdict(
      "canonical_layout",
      layoutOk,
      layoutOk ? "PASS" : "canonical final-state layout intent unsatisfied",
    ),
    final_geometry: verdict(
      "final_geometry",
      geometryOk,
      geometryOk
        ? "PASS"
        : `text_overlaps=${input.text_overlap_count} page_oob=${input.page_oob_count}`,
    ),
    page_fit: verdict(
      "page_fit",
      input.page_fit_ok,
      input.page_fit_ok ? "PASS" : input.page_fit_reason ?? "page fit failed",
    ),
    revision_role_integrity: verdict(
      "revision_role_integrity",
      roleOk,
      roleOk
        ? "PASS"
        : role?.reason ?? "revision-native role evidence missing or failed",
    ),
    feedback_coverage: verdict(
      "feedback_coverage",
      input.coverage.gate_pass,
      input.coverage.gate_pass
        ? "PASS"
        : "feedback coverage gate failed",
    ),
  };

  const order: RevisionOwnerName[] = [
    "plan_schema",
    "authorization",
    "section_replacement",
    "content_execution",
    "content_preservation",
    "canonical_layout",
    "final_geometry",
    "page_fit",
    "revision_role_integrity",
    "feedback_coverage",
  ];
  const failed = order.find((k) => !owners[k].pass) ?? null;
  const pass = failed == null;

  const ownerToStatus: Record<
    RevisionOwnerName,
    { code: string; stage: string }
  > = {
    plan_schema: { code: "FAILED_PLAN", stage: "PLANNING" },
    authorization: { code: "FAILED_AUTHORIZATION", stage: "PLANNING" },
    section_replacement: {
      code: "FAILED_SECTION_COMPLETENESS",
      stage: "SECTION_REPLACEMENT",
    },
    content_execution: { code: "FAILED_EXECUTION", stage: "EXECUTING" },
    content_preservation: {
      code: "FAILED_PRESERVATION",
      stage: "ACCEPTANCE",
    },
    canonical_layout: { code: "FAILED_LAYOUT", stage: "LAYOUT" },
    final_geometry: { code: "FAILED_GEOMETRY", stage: "GEOMETRY" },
    page_fit: { code: "FAILED_PAGE_FIT", stage: "PAGE_FIT" },
    revision_role_integrity: { code: "FAILED_ROLE", stage: "REVISION_ROLE" },
    feedback_coverage: {
      code: "FAILED_FEEDBACK_COVERAGE",
      stage: "FEEDBACK_COVERAGE",
    },
  };

  return {
    schema_version: REVISION_FINAL_ACCEPTANCE_SCHEMA,
    evaluated_at: new Date().toISOString(),
    may_return_to_founder_review: pass,
    overall: pass ? "PASS" : "FAIL",
    failed_owner: failed,
    failure_code: failed ? ownerToStatus[failed].code : null,
    failure_stage: failed ? ownerToStatus[failed].stage : null,
    failure_reason: failed ? owners[failed].reason : null,
    owners,
    provenance: {
      role_integrity: "revision_role_integrity",
      section_replacement: "section_replacement_completeness",
      layout_intent: "canonical_final_state_layout_proof",
      geometry: "final_rendered_geometry",
      page_fit: "revision_layout_normalization",
      feedback_coverage: "feedback_coverage",
      generation_role_integrity: "not_consumed",
    },
  };
}

export function compatibilityStatusForOwner(
  owner: RevisionOwnerName | null,
):
  | "FAILED"
  | "FAILED_COVERAGE"
  | "FAILED_EXECUTION"
  | "FAILED_GATE" {
  if (owner === "plan_schema" || owner === "authorization") return "FAILED";
  if (owner === "content_execution") return "FAILED_EXECUTION";
  if (owner === "feedback_coverage" || owner === "content_preservation") {
    return "FAILED_COVERAGE";
  }
  return "FAILED_GATE";
}
