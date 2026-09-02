/**
 * Phase 5W — rendered-layout truth: pairwise same-column overlap detection
 * and sequential effective-bottom gap proofs.
 *
 * Proves the production false-negative class where a right-column text
 * interleaved in Y-order between two overlapping left-column entries caused
 * consecutive-only overlap detection to report text_overlaps=0.
 *
 * No OpenAI. No production task mutation. Never retries historical tasks.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  requiresOverlapReadabilityGeometricProof,
  requiresSequentialRenderedBottomProof,
} from "./FeedbackCoverage.js";
import { normalizeFounderFeedbackItem } from "./RevisionPromptBuilder.js";
import {
  findSequentialRenderedTextGapFindings,
  findTextOverlapFindings,
  MIN_SEQUENTIAL_RENDERED_TEXT_GAP_PX,
} from "./RevisionAcceptanceChecks.js";
import {
  effectiveTextHeightScaled,
  estimateWrappedLineCount,
} from "./TextEffectiveHeight.js";
import { classifyRequestedChange } from "./RequestedChangeClassification.js";
import type { FabricCanvasDoc } from "./CanvasInventory.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-rendered-layout-truth-5w.json",
);

type Check = { name: string; pass: boolean; detail: string };

function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: !!cond, detail };
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
        data: { role: "pageBackground", system: true },
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
    fontSize?: number;
    lineHeight?: number;
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
    fontSize: opts.fontSize ?? 10.5,
    lineHeight: opts.lineHeight ?? 1.45,
    scaleX: 1,
    scaleY: 1,
    data: { section: opts.section },
  };
}

/** Production-shaped: wrapped cert entry overlaps next; right-column text
 * sits between them in global Y order (false-negative for consecutive-only). */
function interleavedFalseNegativeCanvas(): FabricCanvasDoc {
  const cert1 = textbox("block-certifications-6-t2", {
    left: 48,
    top: 552.8,
    width: 220,
    height: 16, // undersized vs wrap
    text: "• Certified Data Entry Specialist (CDES), National Data Management Institute, 2021",
    section: "certifications",
  });
  const rightInterleave = textbox("block-experience-2-t8", {
    left: 284,
    top: 558.8,
    width: 450,
    height: 16,
    text: "Junior Data Entry Operator — SynerTech Innovations",
    section: "experience",
  });
  const cert2 = textbox("block-certifications-6-t3", {
    left: 48,
    top: 571.47,
    width: 220,
    height: 16,
    text: "• Microsoft Office Specialist (Excel), 2022",
    section: "certifications",
  });
  return pageCanvas([
    textbox("block-certifications-6-t1", {
      left: 60,
      top: 530.8,
      width: 208,
      height: 14,
      text: "CERTIFICATIONS",
      section: "certifications",
      fontSize: 11,
      lineHeight: 1.2,
    }),
    cert1,
    rightInterleave,
    cert2,
    textbox("block-languages-7-t1", {
      left: 60,
      top: 640,
      width: 208,
      height: 14,
      text: "LANGUAGES",
      section: "languages",
      fontSize: 11,
      lineHeight: 1.2,
    }),
  ]);
}

function repairedSequentialCanvas(): FabricCanvasDoc {
  const cert1 = textbox("block-certifications-6-t2", {
    left: 48,
    top: 552.8,
    width: 220,
    height: 16,
    text: "• Certified Data Entry Specialist (CDES), National Data Management Institute, 2021",
    section: "certifications",
  });
  const eff = effectiveTextHeightScaled(cert1 as never);
  const cert2Top = 552.8 + eff + MIN_SEQUENTIAL_RENDERED_TEXT_GAP_PX + 1;
  return pageCanvas([
    textbox("block-certifications-6-t1", {
      left: 60,
      top: 530.8,
      width: 208,
      height: 14,
      text: "CERTIFICATIONS",
      section: "certifications",
      fontSize: 11,
      lineHeight: 1.2,
    }),
    cert1,
    textbox("block-experience-2-t8", {
      left: 284,
      top: 558.8,
      width: 450,
      height: 16,
      text: "Junior Data Entry Operator — SynerTech Innovations",
      section: "experience",
    }),
    textbox("block-certifications-6-t3", {
      left: 48,
      top: cert2Top,
      width: 220,
      height: 16,
      text: "• Microsoft Office Specialist (Excel), 2022",
      section: "certifications",
    }),
    textbox("block-languages-7-t1", {
      left: 60,
      top: cert2Top + 40,
      width: 208,
      height: 14,
      text: "LANGUAGES",
      section: "languages",
      fontSize: 11,
      lineHeight: 1.2,
    }),
    textbox("block-languages-7-t2", {
      left: 48,
      top: cert2Top + 60,
      width: 220,
      height: 16,
      text: "English (Native)",
      section: "languages",
    }),
  ]);
}

function main(): void {
  const checks: Check[] = [];

  const broken = interleavedFalseNegativeCanvas();
  const cert1 = broken.objects.find((o) => o.id === "block-certifications-6-t2")!;
  const cert2 = broken.objects.find((o) => o.id === "block-certifications-6-t3")!;
  const eff1 = effectiveTextHeightScaled(cert1 as never);
  const lines1 = estimateWrappedLineCount(cert1 as never);
  const rawBottom = Number(cert1.top) + Number(cert1.height);
  const effBottom = Number(cert1.top) + eff1;
  const gapRaw = Number(cert2.top) - rawBottom;
  const gapEff = Number(cert2.top) - effBottom;

  checks.push(
    assert(
      lines1 >= 2 && eff1 > Number(cert1.height),
      "wrapped_cert_effective_taller_than_raw",
      `lines=${lines1} rawH=${cert1.height} effH=${eff1}`,
    ),
  );
  checks.push(
    assert(
      gapRaw > 0 && gapEff < -1,
      "raw_gap_positive_but_effective_collides",
      `gapRaw=${gapRaw} gapEff=${gapEff}`,
    ),
  );

  const overlaps = findTextOverlapFindings(broken);
  const certPair = overlaps.some(
    (f) =>
      f.object_ids.includes("block-certifications-6-t2") &&
      f.object_ids.includes("block-certifications-6-t3"),
  );
  checks.push(
    assert(
      overlaps.length >= 1 && certPair,
      "pairwise_detects_interleaved_column_false_negative",
      JSON.stringify(overlaps.map((f) => f.object_ids)),
    ),
  );

  const seqBroken = findSequentialRenderedTextGapFindings(broken);
  checks.push(
    assert(
      seqBroken.some(
        (f) =>
          f.object_ids.includes("block-certifications-6-t2") &&
          f.object_ids.includes("block-certifications-6-t3"),
      ),
      "sequential_gap_detects_cert_stack",
      JSON.stringify(seqBroken.map((f) => f.message)),
    ),
  );

  // Exact touch with min gap > 0 → FAIL sequential
  const touching = pageCanvas([
    textbox("a", {
      left: 48,
      top: 100,
      width: 220,
      height: 20,
      text: "First entry short",
      section: "projects",
    }),
    textbox("b", {
      left: 48,
      top: 120,
      width: 220,
      height: 16,
      text: "Second entry",
      section: "projects",
    }),
  ]);
  checks.push(
    assert(
      findSequentialRenderedTextGapFindings(touching).length >= 1,
      "exact_touch_fails_positive_min_gap",
      String(findSequentialRenderedTextGapFindings(touching).length),
    ),
  );

  // Two-column no horizontal overlap → no findings
  const twoCol = pageCanvas([
    textbox("L1", {
      left: 40,
      top: 100,
      width: 200,
      height: 40,
      text: "Left wrapped text that is intentionally tall for the box",
      section: "skills",
    }),
    textbox("R1", {
      left: 300,
      top: 110,
      width: 400,
      height: 16,
      text: "Right column text interleaved in Y",
      section: "summary",
    }),
    textbox("L2", {
      left: 40,
      top: 130,
      width: 200,
      height: 16,
      text: "Left next",
      section: "skills",
    }),
  ]);
  // If L1 effective bottom > 130, pairwise should catch L1-L2
  const l1eff = effectiveTextHeightScaled(
    twoCol.objects.find((o) => o.id === "L1") as never,
  );
  if (100 + l1eff > 130 + 1) {
    checks.push(
      assert(
        findTextOverlapFindings(twoCol).some((f) =>
          f.object_ids.includes("L1") && f.object_ids.includes("L2"),
        ),
        "same_column_pair_despite_right_interleave",
        JSON.stringify(findTextOverlapFindings(twoCol)),
      ),
    );
  } else {
    checks.push(
      assert(true, "same_column_pair_despite_right_interleave", "skipped_no_eff_collision"),
    );
  }
  checks.push(
    assert(
      !findTextOverlapFindings(twoCol).some((f) =>
        f.object_ids.includes("R1") && f.object_ids.includes("L1"),
      ),
      "cross_column_not_flagged_without_h_overlap",
      "ok",
    ),
  );

  const repaired = repairedSequentialCanvas();
  checks.push(
    assert(
      findTextOverlapFindings(repaired).length === 0,
      "repaired_stack_zero_overlap",
      String(findTextOverlapFindings(repaired).length),
    ),
  );
  checks.push(
    assert(
      findSequentialRenderedTextGapFindings(repaired).length === 0,
      "repaired_stack_sequential_gaps_ok",
      String(findSequentialRenderedTextGapFindings(repaired).length),
    ),
  );

  // Coverage classifiers
  const seqLine =
    "Reflow only the Certifications content so every certification entry begins below the actual effective rendered bottom of the complete preceding certification entry.";
  const gapLine =
    "Maintain a clear positive vertical gap between individual certification entries and ensure there is zero text-on-text overlap within the Certifications section.";
  const preserveLine =
    "Preserve the corrected Projects layout, Skills layout, header, right-side Summary, Experience, Education, typography, colors, and column widths because those areas now look correct.";
  checks.push(
    assert(
      requiresSequentialRenderedBottomProof(normalizeFounderFeedbackItem(seqLine)),
      "sequential_proof_classifier_matches_begins_below",
      "ok",
    ),
  );
  checks.push(
    assert(
      requiresOverlapReadabilityGeometricProof(normalizeFounderFeedbackItem(gapLine)),
      "overlap_proof_classifier_matches_positive_gap_zero_overlap",
      "ok",
    ),
  );
  checks.push(
    assert(
      classifyRequestedChange(preserveLine).classification ===
        "VERIFICATION_ACCEPTANCE",
      "preserve_corrected_layout_is_verification",
      classifyRequestedChange(preserveLine).classification,
    ),
  );

  // OOB: object below page
  const oob = pageCanvas([
    textbox("oob", {
      left: 48,
      top: 1100,
      width: 220,
      height: 40,
      text: "Overflowing",
      section: "languages",
    }),
  ]);
  const oobBottom =
    Number(oob.objects.find((o) => o.id === "oob")!.top) +
    effectiveTextHeightScaled(oob.objects.find((o) => o.id === "oob") as never);
  checks.push(
    assert(oobBottom > 1123, "oob_fixture_extends_past_page", String(oobBottom)),
  );

  const failed = checks.filter((c) => !c.pass);
  const report = {
    schema_version: "verify-rendered-layout-truth-5w-1.0.0",
    ok: failed.length === 0,
    root_cause:
      "findTextOverlapFindings consecutive-Y-only missed same-column pairs when other-column texts interleaved",
    checks,
    failed: failed.map((c) => c.name),
    historical_tasks_retried: false,
  };
  mkdirSync(join(REPO, "SOS/07_LOGS/saios/founder-revision"), {
    recursive: true,
  });
  writeFileSync(OUT, JSON.stringify(report, null, 2));
  if (!report.ok) {
    console.error("FAIL verify-rendered-layout-truth-5w", failed);
    process.exit(1);
  }
  console.log("PASS verify-rendered-layout-truth-5w", { checks: checks.length });
}

main();
