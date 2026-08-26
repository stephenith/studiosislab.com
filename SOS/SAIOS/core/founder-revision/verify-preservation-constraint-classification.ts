/**
 * Deterministic verify: preservation / verification constraint classification
 * (revtask-1ae261a9-127 root-cause fix). No OpenAI. No production mutation.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildFeedbackCoverage } from "./FeedbackCoverage.js";
import {
  classifyRequestedChange,
  verificationCheckTypes,
} from "./RequestedChangeClassification.js";
import {
  runArchitecturePreservationCheck,
  runCollisionBoundsCheck,
  runContentPreservationCheck,
  runLayoutPreservationCheck,
  runPageFitCheck,
  runRevisionAcceptanceChecks,
} from "./RevisionAcceptanceChecks.js";
import { findUncoveredRequestedChanges } from "./RevisionPromptBuilder.js";
import type {
  CanvasOperation,
  RevisionPlan,
} from "./revision-task-types.js";
import type { FabricCanvasDoc } from "./CanvasInventory.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-preservation-constraint-classification.json",
);

type Check = { name: string; pass: boolean; detail: string };

function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: cond, detail };
}

function pageCanvas(extra: Record<string, unknown>[]): FabricCanvasDoc {
  return {
    version: "5.3.0",
    width: 794,
    height: 1123,
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
      ...extra,
    ],
  } as FabricCanvasDoc;
}

function textbox(
  id: string,
  text: string,
  left: number,
  top: number,
  section: string,
  extras: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    type: "textbox",
    id,
    text,
    left,
    top,
    width: 200,
    height: 20,
    data: { section, id },
    ...extras,
  };
}

const REV3_REQUESTED_CHANGES: string[] = [
  "Remove every visible text overlap and collision in the left sidebar, especially within the Skills, Projects, and Certifications sections, so every line is fully readable.",
  "Reflow the Skills content within the existing sidebar width so lines wrap naturally and no skill text overlaps, stacks on top of another line, clips, or intrudes into neighboring content.",
  "Treat Skills, Projects, Certifications, and Languages as a consistent sidebar section system and apply the same vertical layout rules, spacing logic, heading-to-content relationship, and section-to-section rhythm to all four sections.",
  "Ensure each sidebar section fully contains its own content before the next section begins; the next section heading must never overlap or intrude into the preceding section's text.",
  "Reflow the Projects section so each project title and its description are clearly separated, readable, and vertically stacked without any text collision between projects.",
  "Reflow the Certifications section so every certification line is individually readable with consistent line spacing and no collision with the Certifications heading, other certification lines, or the Languages section.",
  "Maintain a clear and consistent vertical gap between Skills → Projects, Projects → Certifications, and Certifications → Languages using the same spacing system rather than positioning each section independently.",
  "Align the sidebar section headings Skills, Projects, Certifications, and Languages to one consistent left anchor within the sidebar, and align their blue accent markers consistently relative to those headings.",
  "Preserve lane ownership: sidebar headings and markers must align only with other sidebar headings and markers; main-column headings and markers must remain aligned within the main column and must not be globally aligned across both columns.",
  "Use the Summary heading and its blue accent marker as a visual reference for a clean and consistent heading-marker relationship, while preserving the separate horizontal anchors of the sidebar and main column.",
  "Keep each section's heading, blue accent marker, and associated content visually grouped as one unit with consistent internal spacing.",
  "Reduce the excessive gap between the Education heading and the Education content so its heading-to-content spacing is visually consistent with the other main-column sections.",
  "Preserve the improved Summary → Experience spacing and the current Experience layout; do not undo the spacing corrections that are already visually satisfactory.",
  "Preserve the current dark header, two-column architecture, typography hierarchy, colors, sidebar background, and overall visual identity; fix the layout defects without redesigning the template.",
  "After all reflow and repositioning, verify the complete final canvas for zero text-to-text overlap, zero heading-to-content collision, zero section intrusion, zero clipping, and zero out-of-bounds content.",
  "Keep the entire resume on one page and do not remove, shorten, invent, or alter factual resume content merely to make the layout fit.",
];

function buildRev3PrimaryPlan(): RevisionPlan {
  const ops: CanvasOperation[] = [];
  for (let i = 0; i <= 11; i++) {
    if (i === 12 || i === 13 || i === 14 || i === 15) continue;
    ops.push({
      op: "set_position",
      target_id: `block-fix-${i}`,
      before_summary: "fixture",
      intended_change: "fixture op for coverage",
      values: { top: 100 + i },
      founder_feedback_item: REV3_REQUESTED_CHANGES[i]!,
      confidence: 0.9,
    });
  }
  return {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "rev3 primary replay fixture",
    notes: [],
    operations: ops,
  };
}

function twoColumnBeforeAfter(gapBefore: number, gapAfter: number): {
  before: FabricCanvasDoc;
  after: FabricCanvasDoc;
} {
  const sidebar = textbox("sb-skills", "Skill A", 48, 400, "skills");
  const mainBase = [
    textbox("sum-body", "Summary body text here.", 280, 200, "summary"),
    textbox("exp-h", "EXPERIENCE", 280, 200 + gapBefore, "experience", {
      role: "section-heading",
    }),
    textbox("sb-main", "Sidebar main", 48, 500, "skills"),
    {
      type: "rect",
      id: "header-band",
      left: 0,
      top: 0,
      width: 794,
      height: 80,
      fill: "#1f1f28",
    },
    sidebar,
  ];
  const afterMain = [
    textbox("sum-body", "Summary body text here.", 280, 200, "summary"),
    textbox("exp-h", "EXPERIENCE", 280, 200 + gapAfter, "experience", {
      role: "section-heading",
    }),
    textbox("sb-main", "Sidebar main", 48, 500, "skills"),
    {
      type: "rect",
      id: "header-band",
      left: 0,
      top: 0,
      width: 794,
      height: 80,
      fill: "#1f1f28",
    },
    sidebar,
  ];
  return {
    before: pageCanvas(mainBase),
    after: pageCanvas(afterMain),
  };
}

function main(): void {
  const checks: Check[] = [];

  // --- Classification A–H ---
  checks.push(
    assert(
      classifyRequestedChange(
        "Reflow the Skills content within the existing sidebar width so lines wrap naturally.",
      ).classification === "MUTATION_REQUIRED",
      "A_reflow_skills_mutation",
      "Reflow Skills → MUTATION_REQUIRED",
    ),
  );
  checks.push(
    assert(
      classifyRequestedChange("Improve Summary to Experience spacing")
        .classification === "MUTATION_REQUIRED",
      "B_improve_gap_mutation",
      "Improve gap → MUTATION_REQUIRED",
    ),
  );
  const c = classifyRequestedChange(
    "Preserve the improved Summary to Experience spacing; do not undo it",
  );
  checks.push(
    assert(
      c.classification === "VERIFICATION_ACCEPTANCE" &&
        verificationCheckTypes(c).includes("LAYOUT_PRESERVATION"),
      "C_preserve_gap_verification",
      JSON.stringify(c),
    ),
  );
  const d = classifyRequestedChange(
    "Preserve the two-column architecture and dark header without redesigning the template.",
  );
  checks.push(
    assert(
      d.classification === "VERIFICATION_ACCEPTANCE" &&
        verificationCheckTypes(d).includes("ARCHITECTURE_PRESERVATION"),
      "D_preserve_architecture",
      JSON.stringify(d),
    ),
  );
  const e = classifyRequestedChange(
    "After reflow, verify zero overlaps, clipping and OOB content on the final canvas.",
  );
  checks.push(
    assert(
      e.classification === "VERIFICATION_ACCEPTANCE" &&
        verificationCheckTypes(e).includes("COLLISION_BOUNDS"),
      "E_post_mutation_verify_collision",
      JSON.stringify(e),
    ),
  );
  const f = classifyRequestedChange("Keep entire resume on one page");
  checks.push(
    assert(
      f.classification === "VERIFICATION_ACCEPTANCE" &&
        verificationCheckTypes(f).includes("PAGE_FIT"),
      "F_one_page_fit",
      JSON.stringify(f),
    ),
  );
  const g = classifyRequestedChange(
    "Do not remove, shorten, invent or alter factual content",
  );
  checks.push(
    assert(
      g.classification === "VERIFICATION_ACCEPTANCE" &&
        verificationCheckTypes(g).includes("CONTENT_PRESERVATION"),
      "G_content_preservation",
      JSON.stringify(g),
    ),
  );
  const h = classifyRequestedChange(REV3_REQUESTED_CHANGES[15]!);
  checks.push(
    assert(
      h.classification === "VERIFICATION_ACCEPTANCE" &&
        verificationCheckTypes(h).includes("PAGE_FIT") &&
        verificationCheckTypes(h).includes("CONTENT_PRESERVATION"),
      "H_compound_page_and_content",
      JSON.stringify(h),
    ),
  );

  // --- Post-execution I–M ---
  const preserveItem = REV3_REQUESTED_CHANGES[12]!;
  const { before: gapBefore, after: gapAfterBad } = twoColumnBeforeAfter(40, 20);
  const layoutBad = runLayoutPreservationCheck({
    beforeCanvas: gapBefore,
    afterCanvas: gapAfterBad,
    requestedChange: preserveItem,
  });
  checks.push(
    assert(
      layoutBad.pass === false && layoutBad.evaluable === true,
      "I_layout_preservation_regression_fail",
      layoutBad.reason,
    ),
  );

  const twoLaneBefore = pageCanvas([
    textbox("l1", "Left", 48, 300, "skills"),
    textbox("r1", "Right", 320, 300, "experience"),
    {
      type: "rect",
      id: "header-band",
      left: 0,
      top: 0,
      width: 794,
      height: 80,
      fill: "#1f1f28",
    },
  ]);
  const oneLaneAfter = pageCanvas([
    textbox("l1", "Left", 48, 300, "skills"),
    textbox("r1", "Right", 120, 320, "experience"),
  ]);
  const archBad = runArchitecturePreservationCheck({
    beforeCanvas: twoLaneBefore,
    afterCanvas: oneLaneAfter,
    requestedChange: REV3_REQUESTED_CHANGES[13]!,
  });
  checks.push(
    assert(
      archBad.pass === false,
      "J_architecture_lane_collapse_fail",
      archBad.reason,
    ),
  );

  const collideAfter = pageCanvas([
    textbox("a", "Line A", 100, 100, "summary"),
    textbox("b", "Line B", 100, 105, "summary"),
  ]);
  const collide = runCollisionBoundsCheck(
    collideAfter,
    REV3_REQUESTED_CHANGES[14]!,
  );
  checks.push(
    assert(collide.pass === false, "K_collision_remain_fail", collide.reason),
  );

  const pageBad = runPageFitCheck({
    page_fit: {
      page_height: 1123,
      content_bottom_before_compaction: 1200,
      overflow_before: 77,
      total_reclaimable_slack: 0,
      pixels_reclaimed: 0,
      content_bottom_after_compaction: 1200,
      overflow_after: 77,
      fit_pass: false,
    },
    afterCanvas: pageCanvas([]),
    requestedChange: "Keep entire resume on one page",
  });
  checks.push(
    assert(pageBad.pass === false, "L_page_overflow_fail", pageBad.reason),
  );

  const contentBefore = pageCanvas([
    textbox("t1", "Original fact", 100, 100, "summary"),
  ]);
  const contentAfter = pageCanvas([
    textbox("t1", "Invented fact", 100, 100, "summary"),
  ]);
  const contentBad = runContentPreservationCheck({
    beforeCanvas: contentBefore,
    afterCanvas: contentAfter,
    requestedChange: "Do not invent factual content",
    plan: { schema_version: "founder-canvas-revision-plan-1.0.0", summary: "", notes: [], operations: [] },
    requested_changes: ["Do not invent factual content"],
  });
  checks.push(
    assert(contentBad.pass === false, "M_content_changed_fail", contentBad.reason),
  );

  // --- N: provider summary cannot satisfy coverage (deterministic check fails) ---
  const acceptanceBad = runRevisionAcceptanceChecks({
    beforeCanvas: gapBefore,
    afterCanvas: gapAfterBad,
    requested_changes: [preserveItem],
  });
  const coverageFail = buildFeedbackCoverage({
    requested_changes: [preserveItem],
    plan: buildRev3PrimaryPlan(),
    log: [],
    beforeCanvas: gapBefore,
    afterCanvas: gapAfterBad,
    acceptanceReport: acceptanceBad,
  });
  checks.push(
    assert(
      coverageFail.gate_pass === false &&
        coverageFail.items[0]?.status === "not_addressed",
      "N_summary_not_acceptance_proof",
      `${coverageFail.items[0]?.evidence?.notes} acceptance_pass=${acceptanceBad.all_verification_pass}`,
    ),
  );

  // --- O: mutation still requires attribution ---
  const mutationPlan: RevisionPlan = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "no attribution",
    notes: [],
    operations: [],
  };
  const uncoveredMutation = findUncoveredRequestedChanges(mutationPlan, [
    REV3_REQUESTED_CHANGES[0]!,
  ]);
  checks.push(
    assert(uncoveredMutation.length === 1, "O_mutation_requires_attribution", uncoveredMutation.map((u) => u.index).join(",")),
  );

  // --- P: coverage repair missing excludes verification ---
  const primary = buildRev3PrimaryPlan();
  const missing = findUncoveredRequestedChanges(
    primary,
    REV3_REQUESTED_CHANGES,
  );
  checks.push(
    assert(
      missing.every((m) => m.index <= 11) &&
        !missing.some((m) => [12, 13, 14, 15].includes(m.index)),
      "P_repair_missing_excludes_verification",
      missing.map((m) => m.index).join(","),
    ),
  );

  // --- Rev 3 full 16-item replay ---
  const replayRows: Array<{
    index: number;
    classification: string;
    check_types: string[];
  }> = [];
  for (let i = 0; i < REV3_REQUESTED_CHANGES.length; i++) {
    const cl = classifyRequestedChange(REV3_REQUESTED_CHANGES[i]!);
    replayRows.push({
      index: i,
      classification: cl.classification,
      check_types: verificationCheckTypes(cl),
    });
    if (i <= 11) {
      checks.push(
        assert(
          cl.classification === "MUTATION_REQUIRED",
          `REV3_item_${i}_mutation`,
          JSON.stringify(cl),
        ),
      );
    } else {
      checks.push(
        assert(
          cl.classification === "VERIFICATION_ACCEPTANCE",
          `REV3_item_${i}_verification`,
          JSON.stringify(cl),
        ),
      );
    }
  }

  const allPass = checks.every((c) => c.pass);
  const shaFiles = [
    "SOS/SAIOS/core/founder-revision/RequestedChangeClassification.ts",
    "SOS/SAIOS/core/founder-revision/RevisionAcceptanceChecks.ts",
    "SOS/SAIOS/core/founder-revision/FeedbackCoverage.ts",
    "SOS/SAIOS/core/founder-revision/FounderRevisionPipeline.ts",
    "SOS/SAIOS/core/founder-revision/RevisionPromptBuilder.ts",
    "SOS/SAIOS/core/founder-revision/verify-preservation-constraint-classification.ts",
  ];
  const shas: Record<string, string> = {};
  for (const rel of shaFiles) {
    const buf = readFileSync(join(REPO, rel));
    shas[rel] = createHash("sha256").update(buf).digest("hex");
  }

  const report = {
    ok: allPass,
    openai_calls: 0,
    verdict: allPass
      ? "REVISION_CONSTRAINT_CLASSIFICATION_LOCAL_READY_FOR_REVIEW"
      : "REVISION_CONSTRAINT_CLASSIFICATION_LOCAL_BLOCKED",
    checks,
    rev3_replay: replayRows,
    rev3_missing_after_primary: missing.map((m) => ({
      index: m.index,
      text: m.text.slice(0, 80),
    })),
    file_shas: shas,
  };

  mkdirSync(join(REPO, "SOS/07_LOGS/saios/founder-revision"), { recursive: true });
  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!allPass) {
    console.error("VERIFY_FAIL", checks.filter((c) => !c.pass));
    process.exit(1);
  }
}

main();
