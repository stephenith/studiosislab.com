/**
 * Focused verify: truthful-content preservation classification +
 * deterministic content_preservation acceptance + FeedbackCoverage ownership.
 * No OpenAI. No production task/evidence mutation.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildFeedbackCoverage } from "./FeedbackCoverage.js";
import {
  CANONICAL_COLLISION_BOUNDS_QA,
  CANONICAL_CONTENT_PRESERVATION,
  CANONICAL_VISUAL_CONSISTENCY_QA,
  classifyRequestedChange,
} from "./RequestedChangeClassification.js";
import {
  findAcceptanceCheckForChange,
  runContentPreservationCheck,
  runRevisionAcceptanceChecks,
} from "./RevisionAcceptanceChecks.js";
import { findUncoveredRequestedChanges } from "./RevisionPromptBuilder.js";
import { listRevisionTasks } from "./RevisionTaskStore.js";
import type {
  CanvasOperation,
  OperationLogEntry,
  RevisionPlan,
} from "./revision-task-types.js";
import type { FabricCanvasDoc } from "./CanvasInventory.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-content-preservation.json",
);

type Check = { name: string; pass: boolean; detail: string };

function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: cond, detail };
}

const HEADER_PRESERVE =
  "Preserve the dark-navy header design while aligning the contact line.";
const REWRITE_SUMMARY =
  "Rewrite the summary while keeping facts truthful.";
const CONTENT_EDIT_SUMMARY =
  "Rewrite the summary to be more concise.";

function textObj(
  id: string,
  text: string,
  extras: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    type: "textbox",
    id,
    text,
    left: 48,
    top: 100,
    width: 200,
    height: 20,
    ...extras,
  };
}

function canvasOf(objects: Record<string, unknown>[]): FabricCanvasDoc {
  return {
    version: "5.3.0",
    objects: [
      {
        type: "rect",
        id: "page-root",
        left: 0,
        top: 0,
        width: 794,
        height: 1123,
        fill: "#ffffff",
        system: true,
        data: { role: "pageBackground", system: true },
      },
      ...objects,
    ],
  } as FabricCanvasDoc;
}

function emptyPlan(): RevisionPlan {
  return {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "geometry only",
    notes: [],
    operations: [],
  };
}

function main(): void {
  let openaiCalls = 0;
  const beforeFp = listRevisionTasks().map(
    (t) => `${t.task_id}:${t.status}:${t.updated_at}`,
  );
  const checks: Check[] = [];

  // Classification matrix — preservation vs contextual layout mutation
  type ClassCase = {
    name: string;
    text: string;
    expect: "CONTENT_PRESERVATION" | "MUTATION_REQUIRED";
  };
  const classMatrix: ClassCase[] = [
    {
      name: "M01_pure_truthful_preservation",
      text: "Preserve all existing truthful resume information and do not fabricate credentials.",
      expect: "CONTENT_PRESERVATION",
    },
    {
      name: "M02_preserve_content_improving_visual_balance",
      text: "Preserve existing content while improving the visual balance of the left and right columns.",
      expect: "MUTATION_REQUIRED",
    },
    {
      name: "M03_improve_visual_balance",
      text: "Improve the visual balance between the left and right columns.",
      expect: "MUTATION_REQUIRED",
    },
    {
      name: "M04_improving_visual_balance",
      text: "Improving the visual balance of the sidebar and main column.",
      expect: "MUTATION_REQUIRED",
    },
    {
      name: "M05_balance_the_columns",
      text: "Balance the columns.",
      expect: "MUTATION_REQUIRED",
    },
    {
      name: "M06_balancing_the_columns",
      text: "Balancing the columns for scanability.",
      expect: "MUTATION_REQUIRED",
    },
    {
      name: "M07_rebalance_sidebar",
      text: "Rebalance the left sidebar vertically.",
      expect: "MUTATION_REQUIRED",
    },
    {
      name: "M08_rebalancing_sidebar",
      text: "Rebalancing the sidebar to use vertical space.",
      expect: "MUTATION_REQUIRED",
    },
    {
      name: "M09_preserve_align_incentives_prose",
      text: "Preserve the factual statement that we align incentives across business units.",
      expect: "CONTENT_PRESERVATION",
    },
    {
      name: "M10_preserve_moved_from_sales_prose",
      text: "Preserve the sentence saying I moved from sales into operations.",
      expect: "CONTENT_PRESERVATION",
    },
    {
      name: "M11_do_not_fabricate_experience_vertical",
      text: "Do not fabricate experience with vertical SaaS companies.",
      expect: "CONTENT_PRESERVATION",
    },
    {
      name: "M12_preserve_horizontal_business_units",
      text: "Preserve the factual statement about horizontal business units.",
      expect: "CONTENT_PRESERVATION",
    },
    {
      name: "M13_do_not_invent_20px_microscopy",
      text: "Do not invent experience involving 20px microscopy measurements.",
      expect: "CONTENT_PRESERVATION",
    },
    {
      name: "M14_move_education_12px_no_fabrication",
      text: "Move Education down by 12px and do not invent any information.",
      expect: "MUTATION_REQUIRED",
    },
    {
      name: "M15_align_all_sidebar_headings",
      text: "Align all sidebar headings.",
      expect: "MUTATION_REQUIRED",
    },
    {
      name: "M16_adjust_skills_projects_spacing",
      text: "Adjust spacing between Skills and Projects while keeping factual content unchanged.",
      expect: "MUTATION_REQUIRED",
    },
    {
      name: "M17_rewrite_summary_preserve_facts",
      text: REWRITE_SUMMARY,
      expect: "MUTATION_REQUIRED",
    },
    {
      name: "M18_preserve_header_align_contact",
      text: HEADER_PRESERVE,
      expect: "MUTATION_REQUIRED",
    },
    // Clause-aware layout detection (Template B content-preservation scope bug)
    {
      name: "A_repositioning_plus_projects_languages_no_fabricate",
      text: "Preserve all existing truthful resume information unless a formatting or structural change requires repositioning it. Do not fabricate skills, certifications, education, employment history, achievements, metrics, tools, projects, languages, or other credentials to increase visual density.",
      expect: "CONTENT_PRESERVATION",
    },
    {
      name: "B_reposition_projects_languages_sidebar",
      text: "Reposition Projects and Languages to improve sidebar balance while preserving truthful resume information.",
      expect: "MUTATION_REQUIRED",
    },
    {
      name: "C_move_projects_section_lower",
      text: "Move the Projects section lower and keep all factual information unchanged.",
      expect: "MUTATION_REQUIRED",
    },
    {
      name: "D_reposition_education_12px",
      text: "Reposition the Education section by 12px. Do not fabricate credentials.",
      expect: "MUTATION_REQUIRED",
    },
    {
      name: "E_do_not_fabricate_projects_languages_fill",
      text: "Do not fabricate projects or languages to fill visual space.",
      expect: "CONTENT_PRESERVATION",
    },
    {
      name: "F_preserve_truthful_project_language_info",
      text: "Preserve truthful project and language information.",
      expect: "CONTENT_PRESERVATION",
    },
    {
      name: "G_improve_spacing_projects_languages",
      text: "Improve the spacing between Projects and Languages.",
      expect: "MUTATION_REQUIRED",
    },
    {
      name: "H_rebalance_projects_certs_languages_sidebar",
      text: "Rebalance Projects, Certifications, and Languages inside the sidebar.",
      expect: "MUTATION_REQUIRED",
    },
    {
      name: "I_preserve_statement_repositioned_projects_prose",
      text: "Preserve the factual statement that I repositioned projects between teams.",
      expect: "CONTENT_PRESERVATION",
    },
    {
      name: "J_preserve_sentence_moved_projects_prose",
      text: "Preserve the sentence saying I moved projects across departments.",
      expect: "CONTENT_PRESERVATION",
    },
    {
      name: "K_preserve_content_improving_sidebar_balance",
      text: "Preserve all existing content while improving the visual balance of the sidebar.",
      expect: "MUTATION_REQUIRED",
    },
    {
      name: "L_adjust_spacing_keep_factual_unchanged",
      text: "Adjust spacing while keeping factual resume information unchanged.",
      expect: "MUTATION_REQUIRED",
    },
    {
      name: "M_rewrite_projects_preserve_facts",
      text: "Rewrite the Projects description while preserving all facts.",
      expect: "MUTATION_REQUIRED",
    },
    {
      name: "N_do_not_invent_project_language",
      text: "Do not invent project experience or language proficiency.",
      expect: "CONTENT_PRESERVATION",
    },
    {
      name: "O_move_languages_below_certifications",
      text: "Move Languages below Certifications.",
      expect: "MUTATION_REQUIRED",
    },
    {
      name: "P_align_languages_heading_sidebar",
      text: "Align the Languages heading with the other sidebar headings.",
      expect: "MUTATION_REQUIRED",
    },
    {
      name: "Q_preserve_statement_projects_align_incentives",
      text: "Preserve the factual statement that our projects align incentives across teams.",
      expect: "CONTENT_PRESERVATION",
    },
    {
      name: "R_preserve_then_independent_reposition_sentence",
      text: "Preserve truthful information. Reposition Languages below Certifications.",
      expect: "MUTATION_REQUIRED",
    },
  ];
  for (const c of classMatrix) {
    const got = classifyRequestedChange(c.text);
    const pass =
      c.expect === "CONTENT_PRESERVATION"
        ? got.classification === "VERIFICATION_ACCEPTANCE" &&
          got.check_type === "CONTENT_PRESERVATION"
        : got.classification === "MUTATION_REQUIRED";
    checks.push(
      assert(
        pass,
        c.name,
        `expect=${c.expect} got=${JSON.stringify(got)} text=${c.text}`,
      ),
    );
  }

  // A — truthful-content / do-not-fabricate → VERIFICATION_ACCEPTANCE
  const a = classifyRequestedChange(CANONICAL_CONTENT_PRESERVATION);
  checks.push(
    assert(
      a.classification === "VERIFICATION_ACCEPTANCE" &&
        a.check_type === "CONTENT_PRESERVATION",
      "A_truthful_content_preservation_verification",
      JSON.stringify(a),
    ),
  );
  checks.push(
    assert(
      classifyRequestedChange(
        "Do not fabricate skills, certifications, or employment metrics to fill space.",
      ).classification === "VERIFICATION_ACCEPTANCE",
      "A2_no_fabricate_pattern",
      JSON.stringify(
        classifyRequestedChange(
          "Do not fabricate skills, certifications, or employment metrics to fill space.",
        ),
      ),
    ),
  );

  // Layout mutation + preservation constraint → MUTATION_REQUIRED (precedence)
  checks.push(
    assert(
      classifyRequestedChange(
        "Rebalance the left sidebar vertically while preserving all existing truthful information.",
      ).classification === "MUTATION_REQUIRED",
      "B_rebalance_sidebar_while_preserving_is_mutation",
      JSON.stringify(
        classifyRequestedChange(
          "Rebalance the left sidebar vertically while preserving all existing truthful information.",
        ),
      ),
    ),
  );
  checks.push(
    assert(
      classifyRequestedChange(
        "Adjust spacing while keeping factual content unchanged.",
      ).classification === "MUTATION_REQUIRED" &&
        classifyRequestedChange(
          "Keep factual content unchanged while repositioning for layout.",
        ).classification === "MUTATION_REQUIRED",
      "C_adjust_spacing_or_reposition_with_factual_constraint_is_mutation",
      "ok",
    ),
  );
  checks.push(
    assert(
      classifyRequestedChange(
        "Move Education down but do not fabricate anything.",
      ).classification === "MUTATION_REQUIRED",
      "D_move_education_do_not_fabricate_is_mutation",
      JSON.stringify(
        classifyRequestedChange(
          "Move Education down but do not fabricate anything.",
        ),
      ),
    ),
  );
  checks.push(
    assert(
      classifyRequestedChange("Do not invent credentials.").classification ===
        "VERIFICATION_ACCEPTANCE" &&
        classifyRequestedChange("Do not invent credentials.").check_type ===
          "CONTENT_PRESERVATION",
      "E_pure_do_not_invent_credentials_is_preservation",
      JSON.stringify(classifyRequestedChange("Do not invent credentials.")),
    ),
  );

  // F — design preserve while aligning stays MUTATION_REQUIRED
  checks.push(
    assert(
      classifyRequestedChange(HEADER_PRESERVE).classification ===
        "MUTATION_REQUIRED",
      "F_preserve_header_design_remains_mutation",
      JSON.stringify(classifyRequestedChange(HEADER_PRESERVE)),
    ),
  );

  // G — rewrite summary while keeping facts → content-edit mutation path
  checks.push(
    assert(
      classifyRequestedChange(REWRITE_SUMMARY).classification ===
        "MUTATION_REQUIRED",
      "G_rewrite_summary_not_pure_verification",
      JSON.stringify(classifyRequestedChange(REWRITE_SUMMARY)),
    ),
  );

  // Extra design/layout-preserve + mutation constraint cases
  checks.push(
    assert(
      classifyRequestedChange(
        "Preserve sidebar styling while extending it to the page edge.",
      ).classification === "MUTATION_REQUIRED" &&
        classifyRequestedChange(
          "Preserve layout while adjusting spacing.",
        ).classification === "MUTATION_REQUIRED" &&
        classifyRequestedChange(
          "Keep content unchanged while moving Education.",
        ).classification === "MUTATION_REQUIRED" &&
        classifyRequestedChange(
          "Keep factual information unchanged while reorganizing Skills.",
        ).classification === "MUTATION_REQUIRED" &&
        classifyRequestedChange(
          "Improve column balance while preserving existing content.",
        ).classification === "MUTATION_REQUIRED",
      "H_design_or_layout_preserve_with_mutation_stays_mutation",
      "ok",
    ),
  );

  // D — collision QA + visual consistency unchanged
  checks.push(
    assert(
      classifyRequestedChange(CANONICAL_COLLISION_BOUNDS_QA).check_type ===
        "COLLISION_BOUNDS" &&
        classifyRequestedChange(CANONICAL_VISUAL_CONSISTENCY_QA).check_type ===
          "VISUAL_CONSISTENCY" &&
        classifyRequestedChange(CANONICAL_COLLISION_BOUNDS_QA)
          .classification === "VERIFICATION_ACCEPTANCE" &&
        classifyRequestedChange(CANONICAL_VISUAL_CONSISTENCY_QA)
          .classification === "VERIFICATION_ACCEPTANCE",
      "D_collision_and_visual_qa_unchanged",
      "ok",
    ),
  );

  const skill = "Python, SQL, Tableau";
  const cert = "AWS Certified Solutions Architect";
  const metric = "Reduced cycle time by 32%";
  const edu = "B.S. Operations Research, State University";
  const before = canvasOf([
    textObj("t-skill", skill, { top: 200 }),
    textObj("t-cert", cert, { top: 240 }),
    textObj("t-metric", metric, { top: 280 }),
    textObj("t-edu", edu, { top: 320 }),
  ]);

  // E — geometry/style only; text unchanged → PASS
  const afterGeom = canvasOf([
    textObj("t-skill", skill, { top: 220, left: 60, fontSize: 12 }),
    textObj("t-cert", cert, { top: 260, fill: "#111111" }),
    textObj("t-metric", metric, { top: 300 }),
    textObj("t-edu", edu, { top: 340 }),
  ]);
  const e = runContentPreservationCheck({
    beforeCanvas: before,
    afterCanvas: afterGeom,
    requestedChange: CANONICAL_CONTENT_PRESERVATION,
    plan: emptyPlan(),
    requested_changes: [CANONICAL_CONTENT_PRESERVATION],
  });
  checks.push(
    assert(e.pass === true, "E_geometry_style_only_pass", e.reason),
  );

  // F — whitespace / line-break equivalent → PASS
  const afterWs = canvasOf([
    textObj("t-skill", "Python,  SQL,\nTableau", { top: 200 }),
    textObj("t-cert", cert, { top: 240 }),
    textObj("t-metric", metric, { top: 280 }),
    textObj("t-edu", edu, { top: 320 }),
  ]);
  const f = runContentPreservationCheck({
    beforeCanvas: before,
    afterCanvas: afterWs,
    requestedChange: CANONICAL_CONTENT_PRESERVATION,
    plan: emptyPlan(),
    requested_changes: [CANONICAL_CONTENT_PRESERVATION],
  });
  checks.push(
    assert(f.pass === true, "F_whitespace_linebreak_equivalent_pass", f.reason),
  );

  // G — invented skill without authorized content-edit → FAIL
  const afterInvent = canvasOf([
    textObj("t-skill", skill, { top: 200 }),
    textObj("t-cert", cert, { top: 240 }),
    textObj("t-metric", metric, { top: 280 }),
    textObj("t-edu", edu, { top: 320 }),
    textObj("t-new-skill", "Kubernetes Mastery Badge", { top: 360 }),
  ]);
  const g = runContentPreservationCheck({
    beforeCanvas: before,
    afterCanvas: afterInvent,
    requestedChange: CANONICAL_CONTENT_PRESERVATION,
    plan: emptyPlan(),
    requested_changes: [CANONICAL_CONTENT_PRESERVATION],
  });
  checks.push(
    assert(
      g.pass === false &&
        g.findings.some((x) => x.code === "ACC_CONTENT_INVENTED"),
      "G_invented_skill_fails",
      JSON.stringify(g.findings.map((x) => x.code)),
    ),
  );

  // H — certification replaced without authorization → FAIL
  const afterCert = canvasOf([
    textObj("t-skill", skill, { top: 200 }),
    textObj("t-cert", "Google Cloud Professional Architect", { top: 240 }),
    textObj("t-metric", metric, { top: 280 }),
    textObj("t-edu", edu, { top: 320 }),
  ]);
  const h = runContentPreservationCheck({
    beforeCanvas: before,
    afterCanvas: afterCert,
    requestedChange: CANONICAL_CONTENT_PRESERVATION,
    plan: emptyPlan(),
    requested_changes: [CANONICAL_CONTENT_PRESERVATION],
  });
  checks.push(
    assert(
      h.pass === false &&
        h.findings.some((x) => x.code === "ACC_CONTENT_REPLACED"),
      "H_cert_changed_unauthorized_fails",
      JSON.stringify(h.findings.map((x) => x.code)),
    ),
  );

  // I — employment metric altered without authorization → FAIL
  const afterMetric = canvasOf([
    textObj("t-skill", skill, { top: 200 }),
    textObj("t-cert", cert, { top: 240 }),
    textObj("t-metric", "Reduced cycle time by 75%", { top: 280 }),
    textObj("t-edu", edu, { top: 320 }),
  ]);
  const i = runContentPreservationCheck({
    beforeCanvas: before,
    afterCanvas: afterMetric,
    requestedChange: CANONICAL_CONTENT_PRESERVATION,
    plan: emptyPlan(),
    requested_changes: [CANONICAL_CONTENT_PRESERVATION],
  });
  checks.push(
    assert(
      i.pass === false &&
        i.findings.some((x) => x.code === "ACC_CONTENT_REPLACED"),
      "I_metric_altered_unauthorized_fails",
      JSON.stringify(i.findings.map((x) => x.code)),
    ),
  );

  // J — factual text removed without authorization → FAIL
  const afterDelete = canvasOf([
    textObj("t-skill", skill, { top: 200 }),
    textObj("t-cert", cert, { top: 240 }),
    textObj("t-metric", metric, { top: 280 }),
  ]);
  const j = runContentPreservationCheck({
    beforeCanvas: before,
    afterCanvas: afterDelete,
    requestedChange: CANONICAL_CONTENT_PRESERVATION,
    plan: emptyPlan(),
    requested_changes: [CANONICAL_CONTENT_PRESERVATION],
  });
  checks.push(
    assert(
      j.pass === false &&
        j.findings.some(
          (x) =>
            x.code === "ACC_CONTENT_DELETED" ||
            x.code === "ACC_CONTENT_MULTISET_LOSS",
        ),
      "J_factual_text_removed_fails",
      JSON.stringify(j.findings.map((x) => x.code)),
    ),
  );

  // K — text update attributable to genuine content-edit Founder item → allowed
  const afterRewrite = canvasOf([
    textObj("t-skill", skill, { top: 200 }),
    textObj("t-cert", cert, { top: 240 }),
    textObj("t-metric", metric, { top: 280 }),
    textObj("t-edu", edu, { top: 320 }),
    textObj("t-summary", "Concise rewritten summary for operations roles.", {
      top: 140,
    }),
  ]);
  const beforeWithSummary = canvasOf([
    textObj("t-skill", skill, { top: 200 }),
    textObj("t-cert", cert, { top: 240 }),
    textObj("t-metric", metric, { top: 280 }),
    textObj("t-edu", edu, { top: 320 }),
    textObj("t-summary", "Long-winded summary about many roles and tools.", {
      top: 140,
    }),
  ]);
  const contentEditOp: CanvasOperation = {
    op: "update_text",
    target_id: "t-summary",
    before_summary: "prior summary text",
    intended_change: "Rewrite summary to be more concise",
    values: { text: "Concise rewritten summary for operations roles." },
    founder_feedback_item: CONTENT_EDIT_SUMMARY,
    confidence: 0.91,
  };
  const authorizedPlan: RevisionPlan = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "authorized content edit",
    notes: [],
    operations: [contentEditOp],
  };
  const k = runContentPreservationCheck({
    beforeCanvas: beforeWithSummary,
    afterCanvas: afterRewrite,
    requestedChange: CANONICAL_CONTENT_PRESERVATION,
    plan: authorizedPlan,
    requested_changes: [CANONICAL_CONTENT_PRESERVATION, CONTENT_EDIT_SUMMARY],
  });
  checks.push(
    assert(
      k.pass === true,
      "K_authorized_content_edit_does_not_auto_fail",
      k.reason,
    ),
  );

  // L — truthful-preservation owned by acceptance; zero ops required
  const report = runRevisionAcceptanceChecks({
    beforeCanvas: afterGeom,
    afterCanvas: afterGeom,
    plan: emptyPlan(),
    requested_changes: [CANONICAL_CONTENT_PRESERVATION],
    task_id: "verify-content-preservation",
  });
  // Use geometry-only before/after that pass
  const reportPass = runRevisionAcceptanceChecks({
    beforeCanvas: before,
    afterCanvas: afterGeom,
    plan: emptyPlan(),
    requested_changes: [CANONICAL_CONTENT_PRESERVATION],
    task_id: "verify-content-preservation",
  });
  const check = findAcceptanceCheckForChange(
    reportPass,
    CANONICAL_CONTENT_PRESERVATION,
  );
  const coverage = buildFeedbackCoverage({
    requested_changes: [CANONICAL_CONTENT_PRESERVATION],
    plan: emptyPlan(),
    log: [] as OperationLogEntry[],
    beforeCanvas: before,
    afterCanvas: afterGeom,
    acceptanceReport: reportPass,
  });
  const uncovered = findUncoveredRequestedChanges(emptyPlan(), [
    CANONICAL_CONTENT_PRESERVATION,
  ]);
  checks.push(
    assert(
      reportPass.all_verification_pass === true &&
        check?.pass === true &&
        check.check_type === "CONTENT_PRESERVATION" &&
        coverage.items[0]?.status === "addressed" &&
        uncovered.length === 0 &&
        emptyPlan().operations.length === 0,
      "L_truthful_item_owned_by_acceptance_zero_ops",
      JSON.stringify({
        pass: check?.pass,
        coverage: coverage.items[0]?.status,
        uncovered,
        unused_report_checks: report.checks.length,
      }),
    ),
  );

  // Fail-closed FeedbackCoverage when preservation fails
  const failReport = runRevisionAcceptanceChecks({
    beforeCanvas: before,
    afterCanvas: afterInvent,
    plan: emptyPlan(),
    requested_changes: [CANONICAL_CONTENT_PRESERVATION],
  });
  const failCov = buildFeedbackCoverage({
    requested_changes: [CANONICAL_CONTENT_PRESERVATION],
    plan: emptyPlan(),
    log: [],
    beforeCanvas: before,
    afterCanvas: afterInvent,
    acceptanceReport: failReport,
  });
  checks.push(
    assert(
      failCov.items[0]?.status === "not_addressed",
      "L2_preservation_fail_not_addressed",
      failCov.items[0]?.evidence.notes ?? "missing",
    ),
  );

  checks.push(assert(openaiCalls === 0, "no_openai_calls", `n=${openaiCalls}`));
  const afterFp = listRevisionTasks().map(
    (t) => `${t.task_id}:${t.status}:${t.updated_at}`,
  );
  checks.push(
    assert(
      JSON.stringify(beforeFp) === JSON.stringify(afterFp),
      "production_tasks_untouched",
      `before=${beforeFp.length} after=${afterFp.length}`,
    ),
  );

  const failed = checks.filter((c) => !c.pass);
  const out = {
    ok: failed.length === 0,
    passed: checks.filter((c) => c.pass).length,
    total: checks.length,
    checks,
    at: new Date().toISOString(),
  };
  mkdirSync(join(OUT, ".."), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
  console.log(
    out.ok
      ? `OK ${out.passed}/${out.total}`
      : `FAIL ${failed.map((f) => f.name).join(", ")}`,
  );
  if (!out.ok) {
    console.error(JSON.stringify(failed, null, 2));
    process.exit(1);
  }
}

main();
