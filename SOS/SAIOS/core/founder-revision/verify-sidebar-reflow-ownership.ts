/**
 * Offline verify: Phase 5I deterministic sidebar reflow ownership +
 * Founder-authoritative direction binding.
 * No OpenAI. No production task mutation.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  buildCanvasInventory,
  type FabricCanvasDoc,
} from "./CanvasInventory.js";
import {
  buildPlanWithDeterministicSpacingOwnership,
  deterministicSpacingAttributionLines,
  isDeterministicLayoutNormalizerOwnedChange,
  isValidationOnlyRequestedChange,
  isVerticalSpacingRhythmHeavyFeedback,
} from "./DeterministicSpacingPlan.js";
import { validatePlanGeometrySafety } from "./PlanGeometrySafety.js";
import {
  parseExplicitMoveDirections,
  validatePlanVerticalDirections,
} from "./PositionOpCanonicalization.js";
import {
  isVerificationAcceptance,
} from "./RequestedChangeClassification.js";
import {
  isPlanCoverageExemptRequestedChange,
  validateRevisionPlan,
} from "./RevisionPromptBuilder.js";
import type { RevisionPlan } from "./revision-task-types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-sidebar-reflow-ownership.json",
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
        data: { role: "pageBackground", system: true, kind: "page-bg" },
      },
      ...extra,
    ],
  };
}

function textbox(
  id: string,
  opts: {
    left: number;
    top: number;
    width: number;
    height: number;
    text: string;
    section: string;
    role?: string;
  },
): Record<string, unknown> {
  return {
    type: "textbox",
    id,
    left: opts.left,
    top: opts.top,
    width: opts.width,
    height: opts.height,
    text: opts.text,
    fontSize: 11,
    data: { section: opts.section, role: opts.role ?? "body" },
  };
}

function rect(
  id: string,
  opts: {
    left: number;
    top: number;
    width: number;
    height: number;
    section: string;
    role?: string;
    fill?: string;
  },
): Record<string, unknown> {
  return {
    type: "rect",
    id,
    left: opts.left,
    top: opts.top,
    width: opts.width,
    height: opts.height,
    fill: opts.fill ?? "#111111",
    data: { section: opts.section, role: opts.role ?? "marker" },
  };
}

/** Generalized Marketing-Manager-class sidebar feedback (no production IDs). */
const SIDEBAR_FEEDBACK = [
  "Redesign and reflow the entire left sidebar so every section has its own clearly separated vertical space with no text, heading, or content overlap.",
  "Fix the Projects section so both project entries and their descriptions appear sequentially from top to bottom with consistent line spacing and without any text collision.",
  "Move the Certifications section below the complete Projects section and maintain a clear, consistent vertical gap between the two sections.",
  "Ensure the Certifications heading and every certification entry remain fully contained within the Certifications section and do not overlap any Project content.",
  "Reformat the Skills section into a cleaner sequential structure using consistent separators, bullets, or evenly spaced inline items rather than irregular wrapping and large empty gaps.",
  "Remove the excessive vertical gaps inside the Skills section and maintain consistent spacing between skill groups and individual skill items.",
  "Correct the horizontal and vertical alignment of all Skills content so every line follows the same left margin and spacing system.",
  "Maintain consistent spacing between Skills, Projects, Certifications, and Languages so the left sidebar follows one clear vertical rhythm from top to bottom.",
  "Ensure every left-sidebar section heading has consistent spacing above and below it and that its corresponding content begins at a predictable distance beneath the heading.",
  "Do not allow any text object, section heading, project description, certification entry, or skill entry to overlap another object.",
  "Preserve the existing header design, colors, overall two-column structure, Summary, Experience, Education, and other right-side content that is already visually correct.",
  "After reflowing the sidebar, rebalance the available vertical space so the column feels compact and intentional rather than leaving large unnecessary blank areas between sections.",
  "Validate the final layout for text overlap, section collision, clipping, and inconsistent spacing before returning the revised Resume Template to Founder Review.",
];

const PRESERVE_LINE = SIDEBAR_FEEDBACK[10]!;
const VALIDATE_LINE = SIDEBAR_FEEDBACK[12]!;
const MOVE_CERTS_LINE = SIDEBAR_FEEDBACK[2]!;
const REMOVE_GAPS_LINE = SIDEBAR_FEEDBACK[5]!;

function crowdedSidebarCanvas(): FabricCanvasDoc {
  // Left column crowded / overlapping; right column + header intentionally clean.
  return pageCanvas([
    rect("block-header-0-r0", {
      left: 36,
      top: 36,
      width: 722,
      height: 72,
      section: "header",
      role: "header-band",
      fill: "#1e293b",
    }),
    textbox("block-header-0-t1", {
      left: 48,
      top: 48,
      width: 400,
      height: 22,
      text: "Alex Rivera",
      section: "header",
      role: "name",
    }),
    textbox("block-header-0-t2", {
      left: 48,
      top: 72,
      width: 400,
      height: 16,
      text: "Marketing Manager",
      section: "header",
      role: "role",
    }),
    // Skills (left) — large gaps / uneven
    rect("block-skills-4-r0", {
      left: 48,
      top: 140,
      width: 4,
      height: 14,
      section: "skills",
    }),
    textbox("block-skills-4-t1", {
      left: 56,
      top: 138,
      width: 200,
      height: 14,
      text: "SKILLS",
      section: "skills",
      role: "heading",
    }),
    textbox("block-skills-4-t2", {
      left: 48,
      top: 173,
      width: 220,
      height: 92,
      text: "Digital Marketing · Campaign Management · Data Analytics · SEO & SEM · Content Strategy · Lead Generation",
      section: "skills",
    }),
    textbox("block-skills-4-t3", {
      left: 48,
      top: 310,
      width: 220,
      height: 46,
      text: "Tools · HubSpot · Google Ads · Tableau",
      section: "skills",
    }),
    // Projects then Certifications with large irregular gaps (no intentional collision)
    textbox("block-projects-5-t1", {
      left: 56,
      top: 390,
      width: 200,
      height: 14,
      text: "PROJECTS",
      section: "projects",
      role: "heading",
    }),
    textbox("block-projects-5-t2", {
      left: 48,
      top: 420,
      width: 220,
      height: 16,
      text: "Brand Relaunch Program",
      section: "projects",
    }),
    textbox("block-projects-5-t3", {
      left: 48,
      top: 445,
      width: 220,
      height: 40,
      text: "Led cross-channel relaunch increasing qualified pipeline by 28% across two regions.",
      section: "projects",
    }),
    textbox("block-projects-5-t4", {
      left: 48,
      top: 510,
      width: 220,
      height: 16,
      text: "Lifecycle Nurture System",
      section: "projects",
    }),
    textbox("block-projects-5-t5", {
      left: 48,
      top: 535,
      width: 220,
      height: 40,
      text: "Built automated nurture tracks that reduced CAC while protecting conversion quality.",
      section: "projects",
    }),
    textbox("block-certifications-6-t1", {
      left: 56,
      top: 620,
      width: 200,
      height: 14,
      text: "CERTIFICATIONS",
      section: "certifications",
      role: "heading",
    }),
    textbox("block-certifications-6-t2", {
      left: 48,
      top: 650,
      width: 220,
      height: 16,
      text: "Google Analytics Professional",
      section: "certifications",
    }),
    textbox("block-certifications-6-t3", {
      left: 48,
      top: 680,
      width: 220,
      height: 16,
      text: "HubSpot Inbound Certificate",
      section: "certifications",
    }),
    textbox("block-languages-7-t1", {
      left: 56,
      top: 760,
      width: 200,
      height: 14,
      text: "LANGUAGES",
      section: "languages",
      role: "heading",
    }),
    textbox("block-languages-7-t2", {
      left: 48,
      top: 790,
      width: 220,
      height: 16,
      text: "English · Spanish",
      section: "languages",
    }),
    // Right column — should remain untouched by ownership intent
    textbox("block-summary-1-t1", {
      left: 300,
      top: 140,
      width: 440,
      height: 14,
      text: "SUMMARY",
      section: "summary",
      role: "heading",
    }),
    textbox("block-summary-1-t2", {
      left: 292,
      top: 160,
      width: 450,
      height: 60,
      text: "Marketing leader focused on pipeline quality, brand systems, and measurable growth.",
      section: "summary",
    }),
    textbox("block-experience-2-t1", {
      left: 300,
      top: 250,
      width: 440,
      height: 14,
      text: "EXPERIENCE",
      section: "experience",
      role: "heading",
    }),
    textbox("block-experience-2-t2", {
      left: 292,
      top: 270,
      width: 450,
      height: 70,
      text: "Marketing Manager — Northwind Labs. Owned multi-channel campaigns and partner enablement.",
      section: "experience",
    }),
    textbox("block-education-3-t1", {
      left: 300,
      top: 370,
      width: 440,
      height: 14,
      text: "EDUCATION",
      section: "education",
      role: "heading",
    }),
    textbox("block-education-3-t2", {
      left: 292,
      top: 390,
      width: 450,
      height: 40,
      text: "B.A. Communications — State University",
      section: "education",
    }),
  ]);
}

function emptyAiPlan(): RevisionPlan {
  return {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "AI placeholder plan with invented UP rationale",
    operations: [
      {
        op: "set_position",
        target_id: "block-skills-4-t2",
        before_summary: "Skills body at top=173",
        intended_change:
          "Move Skills content textbox up to reduce excessive vertical gaps and align left margin consistently within Skills section",
        values: { top: 178 },
        founder_feedback_item: REMOVE_GAPS_LINE,
        confidence: 0.9,
      },
    ],
    notes: ["ai_placeholder"],
  };
}

function main(): void {
  const checks: Check[] = [];

  // --- VERIFICATION_ACCEPTANCE / validate-only regressions ---
  checks.push(
    assert(
      isVerificationAcceptance(PRESERVE_LINE) === true &&
        isDeterministicLayoutNormalizerOwnedChange(PRESERVE_LINE) === false,
      "preserve_is_va_not_spacing_owned",
      `va=${isVerificationAcceptance(PRESERVE_LINE)} owned=${isDeterministicLayoutNormalizerOwnedChange(PRESERVE_LINE)}`,
    ),
  );
  checks.push(
    assert(
      isValidationOnlyRequestedChange(VALIDATE_LINE) === true &&
        isDeterministicLayoutNormalizerOwnedChange(VALIDATE_LINE) === false &&
        isPlanCoverageExemptRequestedChange(VALIDATE_LINE) === true,
      "validate_is_validation_only_exempt",
      `valOnly=${isValidationOnlyRequestedChange(VALIDATE_LINE)} owned=${isDeterministicLayoutNormalizerOwnedChange(VALIDATE_LINE)}`,
    ),
  );
  checks.push(
    assert(
      isDeterministicLayoutNormalizerOwnedChange(MOVE_CERTS_LINE) === true &&
        isVerificationAcceptance(MOVE_CERTS_LINE) === false,
      "move_certs_below_still_owned_not_exempted",
      "ok",
    ),
  );
  checks.push(
    assert(
      isDeterministicLayoutNormalizerOwnedChange(REMOVE_GAPS_LINE) === true,
      "remove_excessive_gaps_still_owned",
      "ok",
    ),
  );

  const attrs = deterministicSpacingAttributionLines(SIDEBAR_FEEDBACK);
  checks.push(
    assert(
      !attrs.includes(PRESERVE_LINE) && !attrs.includes(VALIDATE_LINE),
      "preserve_validate_not_in_attribution",
      `attrs=${attrs.length}`,
    ),
  );
  checks.push(
    assert(
      attrs.includes(MOVE_CERTS_LINE) && attrs.includes(REMOVE_GAPS_LINE),
      "substantive_lines_remain_in_attribution",
      "ok",
    ),
  );

  // --- Direction parser regressions (descriptive) ---
  for (const [name, text] of [
    ["spacing_above_below", "Ensure every heading has consistent spacing above and below it."],
    ["top_to_bottom", "Appear sequentially from top to bottom with consistent line spacing."],
    ["beneath_heading", "Content begins at a predictable distance beneath the heading."],
  ] as const) {
    checks.push(
      assert(
        parseExplicitMoveDirections(text).size === 0,
        `no_direction_${name}`,
        [...parseExplicitMoveDirections(text)].join(",") || "NONE",
      ),
    );
  }

  // --- Direction source hardening ---
  const contactInv = buildCanvasInventory(
    pageCanvas([
      textbox("block-header-0-t3", {
        left: 48,
        top: 100,
        width: 400,
        height: 14,
        text: "a@b.com · 555",
        section: "header",
        role: "contact",
      }),
    ]),
  );
  const founderUpPass = validatePlanVerticalDirections({
    inventory: contactInv,
    requested_changes: ["Move the contact row upward inside the header."],
    plan: {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "up ok",
      operations: [
        {
          op: "set_position",
          target_id: "block-header-0-t3",
          values: { top: 90 },
          before_summary: "contact top=100",
          intended_change: "Move contact upward",
          founder_feedback_item: "Move the contact row upward inside the header.",
          confidence: 1,
        },
      ],
    },
  });
  checks.push(
    assert(founderUpPass.ok, "founder_up_geometry_up_pass", founderUpPass.errors.join("; ") || "ok"),
  );

  const founderUpFail = validatePlanVerticalDirections({
    inventory: contactInv,
    requested_changes: ["Move the contact row upward inside the header."],
    plan: {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "up fail",
      operations: [
        {
          op: "set_position",
          target_id: "block-header-0-t3",
          values: { top: 110 },
          before_summary: "contact top=100",
          intended_change: "Move contact upward",
          founder_feedback_item: "Move the contact row upward inside the header.",
          confidence: 1,
        },
      ],
    },
  });
  checks.push(
    assert(
      !founderUpFail.ok &&
        founderUpFail.errors.some((e) => e.includes("upward") && e.includes("downward")),
      "founder_up_geometry_down_fail",
      founderUpFail.errors.join("; "),
    ),
  );

  const langsInv = buildCanvasInventory(
    pageCanvas([
      textbox("block-languages-7-t2", {
        left: 48,
        top: 700,
        width: 220,
        height: 16,
        text: "English",
        section: "languages",
      }),
    ]),
  );
  const founderDownPass = validatePlanVerticalDirections({
    inventory: langsInv,
    requested_changes: ["Move the Languages section downward for bottom margin."],
    plan: {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "down ok",
      operations: [
        {
          op: "set_position",
          target_id: "block-languages-7-t2",
          values: { top: 720 },
          before_summary: "languages top=700",
          intended_change: "Move Languages downward",
          founder_feedback_item: "Move the Languages section downward for bottom margin.",
          confidence: 1,
        },
      ],
    },
  });
  checks.push(
    assert(
      founderDownPass.ok,
      "founder_down_geometry_down_pass",
      founderDownPass.errors.join("; ") || "ok",
    ),
  );
  const founderDownFail = validatePlanVerticalDirections({
    inventory: langsInv,
    requested_changes: ["Move the Languages section downward for bottom margin."],
    plan: {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "down fail",
      operations: [
        {
          op: "set_position",
          target_id: "block-languages-7-t2",
          values: { top: 680 },
          before_summary: "languages top=700",
          intended_change: "Move Languages downward",
          founder_feedback_item: "Move the Languages section downward for bottom margin.",
          confidence: 1,
        },
      ],
    },
  });
  checks.push(
    assert(
      !founderDownFail.ok &&
        founderDownFail.errors.some((e) => e.includes("downward") && e.includes("upward")),
      "founder_down_geometry_up_fail",
      founderDownFail.errors.join("; "),
    ),
  );

  const aiInventedUp = validatePlanVerticalDirections({
    inventory: buildCanvasInventory(
      pageCanvas([
        textbox("block-skills-4-t2", {
          left: 48,
          top: 173,
          width: 220,
          height: 40,
          text: "Skills body",
          section: "skills",
        }),
      ]),
    ),
    requested_changes: [REMOVE_GAPS_LINE],
    plan: emptyAiPlan(),
  });
  checks.push(
    assert(
      aiInventedUp.ok === true,
      "ai_intended_up_without_founder_up_not_required",
      aiInventedUp.errors.join("; ") || "ok",
    ),
  );

  const aiInventedDown = validatePlanVerticalDirections({
    inventory: langsInv,
    requested_changes: ["Remove excessive vertical gaps inside the Languages section."],
    plan: {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "ai invented down",
      operations: [
        {
          op: "set_position",
          target_id: "block-languages-7-t2",
          values: { top: 680 },
          before_summary: "languages top=700",
          intended_change: "Move Languages section down to tighten spacing",
          founder_feedback_item:
            "Remove excessive vertical gaps inside the Languages section.",
          confidence: 0.9,
        },
      ],
    },
  });
  checks.push(
    assert(
      aiInventedDown.ok === true,
      "ai_intended_down_without_founder_down_not_required",
      aiInventedDown.errors.join("; ") || "ok",
    ),
  );

  // Cross-change / section-scope leak smoke: Skills op must not inherit Languages UP.
  const leakGate = validatePlanVerticalDirections({
    inventory: buildCanvasInventory(
      pageCanvas([
        textbox("block-skills-4-t2", {
          left: 48,
          top: 173,
          width: 220,
          height: 40,
          text: "Skills",
          section: "skills",
        }),
        textbox("block-languages-7-t2", {
          left: 48,
          top: 700,
          width: 220,
          height: 16,
          text: "English",
          section: "languages",
        }),
      ]),
    ),
    requested_changes: [
      "Move the Languages section upward for bottom margin balance.",
      REMOVE_GAPS_LINE,
    ],
    plan: {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "no leak",
      operations: [
        {
          op: "set_position",
          target_id: "block-skills-4-t2",
          values: { top: 178 },
          before_summary: "skills 173",
          intended_change: "Tighten skills spacing",
          founder_feedback_item: REMOVE_GAPS_LINE,
          confidence: 1,
        },
      ],
    },
  });
  checks.push(
    assert(leakGate.ok, "cross_change_direction_does_not_leak", leakGate.errors.join("; ") || "ok"),
  );

  // --- Sidebar ownership activation replay ---
  checks.push(
    assert(
      isVerticalSpacingRhythmHeavyFeedback(SIDEBAR_FEEDBACK),
      "sidebar_feedback_rhythm_heavy",
      `owned=${SIDEBAR_FEEDBACK.filter((c) => isDeterministicLayoutNormalizerOwnedChange(c)).length}`,
    ),
  );

  const prior = crowdedSidebarCanvas();
  const aiPlan = emptyAiPlan();
  const det = buildPlanWithDeterministicSpacingOwnership({
    priorCanvas: prior,
    requested_changes: SIDEBAR_FEEDBACK,
    aiPlan,
  });
  checks.push(
    assert(det.ok === true && det.plan != null, "deterministic_plan_created", det.error ?? "ok"),
  );
  checks.push(
    assert(
      det.replaced_ai_position_ops >= 1,
      "ai_position_ops_replaced",
      `replaced=${det.replaced_ai_position_ops} preserved=${det.preserved_ai_ops}`,
    ),
  );

  const revalidated = validateRevisionPlan(det.plan, {
    requested_changes: SIDEBAR_FEEDBACK,
    allowEmptyOperations: false,
  });
  checks.push(
    assert(
      revalidated.ok === true && revalidated.plan != null,
      "deterministic_revalidation_pass",
      revalidated.errors.join("; ") || "ok",
    ),
  );

  const active = revalidated.plan!;
  const hasAiInventedPhrase = active.operations.some((op) =>
    String(op.intended_change ?? "").includes("Move Skills content textbox up"),
  );
  checks.push(
    assert(
      !hasAiInventedPhrase,
      "active_plan_not_stale_ai_up_rationale",
      "ok",
    ),
  );
  checks.push(
    assert(
      active.operations.every((op) => {
        const items = [
          String(op.founder_feedback_item ?? ""),
          ...((op.founder_feedback_items as string[] | undefined) ?? []),
        ];
        return !items.includes(PRESERVE_LINE) && !items.includes(VALIDATE_LINE);
      }),
      "active_plan_no_va_or_validate_attribution",
      "ok",
    ),
  );

  const inventory = buildCanvasInventory(prior);
  const dirGate = validatePlanVerticalDirections({
    plan: active,
    inventory,
    requested_changes: SIDEBAR_FEEDBACK,
  });
  checks.push(
    assert(
      dirGate.ok,
      "direction_gate_pass_on_deterministic_active_plan",
      dirGate.errors.join("; ") || "ok",
    ),
  );

  const geo = validatePlanGeometrySafety({
    plan: active,
    canvas: prior,
  });
  checks.push(
    assert(
      geo.ok === true && geo.text_overlaps === 0 && geo.page_oob === 0,
      "plan_geometry_clear",
      `ok=${geo.ok} overlaps=${geo.text_overlaps} oob=${geo.page_oob} err=${geo.error ?? ""}`,
    ),
  );

  // Right/header preservation smoke: no ops targeting summary/experience/education/header name.
  const forbidden = active.operations.filter((op) => {
    const id = String(op.target_id ?? "");
    return /block-(summary|experience|education|header)-/.test(id);
  });
  // Deterministic normalizer may still nudge right-column rhythm; allow only if
  // intended_change is the deterministic template (not AI redesign of right column).
  checks.push(
    assert(
      forbidden.every((op) =>
        String(op.intended_change ?? "").startsWith(
          "Apply deterministic layout-normalized",
        ),
      ),
      "right_header_changes_only_via_normalizer_if_any",
      `count=${forbidden.length}`,
    ),
  );

  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.filter((c) => !c.pass).length;
  const report = {
    schema_version: "verify-sidebar-reflow-ownership-1.0.0",
    ok: failed === 0,
    passed,
    failed,
    total: checks.length,
    checks,
    DETERMINISTIC_OWNERSHIP: isVerticalSpacingRhythmHeavyFeedback(SIDEBAR_FEEDBACK)
      ? "YES"
      : "NO",
    DETERMINISTIC_PLAN_CREATED: det.ok && det.plan ? "YES" : "NO",
    REVALIDATION: revalidated.ok ? "PASS" : "FAIL",
    ACTIVE_PLAN: revalidated.ok ? "DETERMINISTIC" : "AI_RETAINED",
    AI_POSITION_OPS_REPLACED: det.replaced_ai_position_ops >= 1 ? "YES" : "NO",
  };

  mkdirSync(join(REPO, "SOS/07_LOGS/saios/founder-revision"), { recursive: true });
  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: report.ok, passed, failed, total: checks.length, out: OUT }, null, 2));
  if (failed > 0) {
    for (const c of checks.filter((x) => !x.pass)) {
      console.error(`FAIL ${c.name}: ${c.detail}`);
    }
    process.exit(1);
  }
}

main();
