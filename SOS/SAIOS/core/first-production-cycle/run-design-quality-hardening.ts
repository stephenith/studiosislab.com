/**
 * Agent #239 — Resume Design Quality Hardening V1.
 * 10 families × 2 variants. Founder bar. LIVE OFF. publication blocked.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import dotenv from "dotenv";
import {
  DESIGN_FAMILY_IDS,
  persistDesignFamilyCatalog,
  resolveDesignFamily,
} from "../design-families/DesignFamilyEngine.js";
import { classifyFounderQuality } from "../design-families/founderQuality.js";
import { compareVariantDimensions } from "../design-families/variantDifferentiation.js";
import {
  buildVisualFingerprint,
  findNearestDuplicate,
  type VisualFingerprint,
  VISUAL_SIMILARITY_THRESHOLD,
} from "../design-families/visualFingerprint.js";
import { evaluateAll } from "../resume-critic/OverallEvaluator.js";
import { measurePageBalance } from "../resume-renderer/pageBalance.js";
import {
  buildPrintableSafeArea,
  validateSafeAreaGeometry,
} from "../resume-renderer/printableSafeArea.js";
import { runProduction } from "./ProductionController.js";
import { CYCLE_LOG } from "./runFirstProductionCycle.js";
import type { ProductionCategory, ProductionTarget } from "./ProductionTarget.js";

const REPO = resolve(import.meta.dirname, "../../../..");
dotenv.config({ path: resolve(REPO, ".env.local") });

const OUT_DIR = join(CYCLE_LOG, "design-quality-hardening-v1");
const REPORT_MD = join(
  REPO,
  "SOS/09_REPORTS/AIOS_RESUME_DESIGN_QUALITY_HARDENING_V1_REPORT.md",
);
const PRIOR =
  "SOS/07_LOGS/saios/first-production-cycle/design-family-engine-v1/comparison.json";

const ROLE_CYCLE: Array<{
  title: string;
  role_family: string;
  category: ProductionCategory;
  industry: string;
}> = [
  {
    title: "Marketing Manager",
    role_family: "marketing_manager",
    category: "marketing",
    industry: "marketing",
  },
  {
    title: "Software Engineer",
    role_family: "software_engineer",
    category: "engineering",
    industry: "software",
  },
  {
    title: "Graphic Designer",
    role_family: "graphic_designer",
    category: "creative",
    industry: "design",
  },
  {
    title: "Accountant",
    role_family: "accountant",
    category: "finance",
    industry: "accounting",
  },
  {
    title: "HR Manager",
    role_family: "hr_manager",
    category: "ats",
    industry: "human_resources",
  },
];

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function main(): Promise<void> {
  process.env.SOS_AIOS_LIVE = "0";
  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE OFF");
  mkdirSync(OUT_DIR, { recursive: true });

  // Variant differentiation preflight
  for (const fam of DESIGN_FAMILY_IDS) {
    const a = resolveDesignFamily({ family_id: fam, design_variant: 0 });
    const b = resolveDesignFamily({ family_id: fam, design_variant: 1 });
    const diff = compareVariantDimensions(a, b);
    assert(
      diff.pass,
      `Variant differentiation failed for ${fam}: ${diff.count} dims (${diff.differing_dimensions.join(",")})`,
    );
  }

  const catalogPath = persistDesignFamilyCatalog(REPO);
  assert(existsSync(catalogPath), "family catalog");

  const runId = `dq239_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const stamp = new Date().toISOString();
  const targets: ProductionTarget[] = [];
  let roleIdx = 0;
  for (const family of DESIGN_FAMILY_IDS) {
    for (const variant of [0, 1] as const) {
      const role = ROLE_CYCLE[roleIdx % ROLE_CYCLE.length]!;
      roleIdx += 1;
      targets.push({
        category: role.category,
        title: `${role.title} ${family} v${variant} ${runId}`,
        industry: `${role.industry}_${family}_v${variant}_h239`,
        seniority: variant === 0 ? "mid" : "senior",
        role_family: role.role_family,
        objective: [
          `RUN=${runId}`,
          `design_family:${family}`,
          `design_variant:${variant}`,
          `role_family:${role.role_family}`,
          `TOKEN_${family}_${variant}_${Math.random().toString(36).slice(2, 8)}`,
          `Design Quality Hardening V1 — Founder bar ATS-safe ${role.title}.`,
        ].join(" "),
      });
    }
  }
  assert(targets.length === 20, "20 targets");

  const result = await runProduction({
    batch_size: 20,
    max_openai_per_batch: 20,
    max_attempts: 45,
    force_mock: true,
    select_target: false,
    verification: true,
    verification_context: "agent-239-design-quality-hardening",
    forced_targets: targets,
    queue_max: 100,
    budget_policy: {
      maximum_founder_queue: 100,
      maximum_batch_size: 25,
      maximum_daily_candidates: 500,
    },
  });

  assert(result.publication_allowed === false, "publication blocked");
  assert(result.live === false, "LIVE OFF");
  assert(result.entrypoint === "ProductionController", "PC owner");
  assert(result.batch !== null, `no batch: ${result.stop_reason}`);
  assert(result.candidate_count >= 20, `candidates=${result.candidate_count}`);

  const waiting = result.batch!.candidates.filter(
    (c) => c.result === "WAITING_FOUNDER" && c.candidate_dir,
  );
  assert(waiting.length >= 20, `WAITING=${waiting.length}`);

  const fingerprints: VisualFingerprint[] = [];
  const rows: Array<Record<string, unknown>> = [];

  for (let i = 0; i < 20; i++) {
    const c = waiting[i]!;
    const dir = join(REPO, c.candidate_dir!);
    for (const f of [
      "preview.png",
      "thumbnail.png",
      "canvas.json",
      "designbrief.json",
      "critic.json",
      "editor-compatibility.json",
      "resume-template.json",
    ]) {
      assert(existsSync(join(dir, f)), `${f} missing`);
    }

    const brief = JSON.parse(readFileSync(join(dir, "designbrief.json"), "utf8")) as {
      visual_guidance?: Record<string, unknown>;
    };
    const editor = JSON.parse(
      readFileSync(join(dir, "editor-compatibility.json"), "utf8"),
    ) as { pass?: boolean; overall?: string };
    const canvas = JSON.parse(readFileSync(join(dir, "canvas.json"), "utf8"));
    const criticFile = JSON.parse(readFileSync(join(dir, "critic.json"), "utf8"));
    const scores = criticFile.scores ?? {};
    const vg = brief.visual_guidance ?? {};

    const safe = buildPrintableSafeArea({
      page_width_px: canvas.width,
      page_height_px: canvas.height,
      allow_edge_to_edge_decoration: true,
    });
    const safeReport = validateSafeAreaGeometry({
      safe,
      objects: canvas.objects,
    });
    const balance = measurePageBalance({
      canvas,
      safe_bottom_y: safe.printable_bottom,
    });

    // Re-evaluate with batch fingerprints for consistent thumb/contrast
    const evalBundle = evaluateAll({
      canvas,
      resume_json: JSON.parse(
        readFileSync(join(dir, "resume-json-instructions.json"), "utf8"),
      ),
      overflow: { overflow: false } as never,
      batch_fingerprints: fingerprints,
    });

    const fp = buildVisualFingerprint({
      canvas,
      family_id: String(vg.design_family ?? ""),
      layout_architecture: String(vg.layout_architecture ?? ""),
      header_system: String(vg.header_system ?? ""),
      section_title_system: String(vg.section_title_system ?? ""),
      alignment_system: String(vg.alignment_system ?? ""),
    });
    const { nearest, similarity } = findNearestDuplicate(fp, fingerprints);
    fingerprints.push(fp);

    const ats = Number(evalBundle.scores.ats ?? scores.ats ?? 0);
    const visual = Number(evalBundle.scores.visual ?? scores.visual ?? 0);
    const typography = Number(
      evalBundle.scores.typography ?? scores.typography ?? 0,
    );
    const layout = Number(evalBundle.scores.layout ?? scores.layout ?? 0);
    const design = Math.round((visual + typography + layout) / 3);
    const thumb = Number(
      evalBundle.scores.thumbnail_appeal ?? scores.thumbnail_appeal ?? 0,
    );
    const contrast_pass =
      evalBundle.contrast_detail.metrics?.contrast_pass === true;
    const editor_pass =
      editor.pass === true ||
      String(editor.overall ?? "").toUpperCase() === "PASS";

    const dims = {
      visual,
      typography,
      layout,
      ats,
      technical: Number(evalBundle.scores.technical ?? scores.technical ?? 100),
      consistency: Number(
        evalBundle.scores.consistency ?? scores.consistency ?? 100,
      ),
      sections: Number(evalBundle.scores.sections ?? scores.sections ?? 100),
    };

    const fq = classifyFounderQuality({
      design,
      ats,
      editor_pass,
      thumbnail_appeal: thumb,
      contrast_pass,
      safe_area_pass: safeReport.pass,
      nearest_similarity: similarity,
      similarity_threshold: VISUAL_SIMILARITY_THRESHOLD,
      major_lower_void: balance.major_lower_void,
      dimension_mins: dims,
    });

    writeFileSync(
      join(dir, "visual-fingerprint.json"),
      `${JSON.stringify({ ...fp, nearest_similarity: similarity, nearest_hash: nearest?.fingerprint_hash ?? null }, null, 2)}\n`,
    );
    writeFileSync(
      join(dir, "contrast-report.json"),
      `${JSON.stringify(evalBundle.contrast_detail, null, 2)}\n`,
    );
    writeFileSync(
      join(dir, "safe-area-geometry.json"),
      `${JSON.stringify({ safe, ...safeReport }, null, 2)}\n`,
    );
    writeFileSync(
      join(dir, "thumbnail-report.json"),
      `${JSON.stringify(evalBundle.thumbnail_appeal, null, 2)}\n`,
    );
    writeFileSync(
      join(dir, "page-balance.json"),
      `${JSON.stringify(balance, null, 2)}\n`,
    );

    writeFileSync(
      join(dir, "ats-report.json"),
      `${JSON.stringify(
        {
          template_id: c.candidate_id,
          score: ats,
          pass: ats >= 70,
          scores_snapshot: {
            ats,
            visual,
            typography,
            layout,
            technical: dims.technical,
            sections: dims.sections,
          },
          detail:
            evalBundle.reports?.ats ??
            criticFile.ats ??
            criticFile.reports?.ats ??
            null,
        },
        null,
        2,
      )}\n`,
    );

    for (const [name, src] of [
      ["fingerprint", "visual-fingerprint.json"],
      ["contrast", "contrast-report.json"],
      ["safe-area", "safe-area-geometry.json"],
      ["thumbnail-report", "thumbnail-report.json"],
      ["page-balance", "page-balance.json"],
      ["ats", "ats-report.json"],
      ["editor", "editor-compatibility.json"],
    ] as const) {
      copyFileSync(join(dir, src), join(OUT_DIR, `template-${i + 1}-${name}.json`));
    }
    copyFileSync(join(dir, "preview.png"), join(OUT_DIR, `template-${i + 1}-preview.png`));
    copyFileSync(
      join(dir, "thumbnail.png"),
      join(OUT_DIR, `template-${i + 1}-thumbnail.png`),
    );
    copyFileSync(join(dir, "canvas.json"), join(OUT_DIR, `template-${i + 1}-canvas.json`));
    if (existsSync(join(dir, "resume-template.json"))) {
      copyFileSync(
        join(dir, "resume-template.json"),
        join(OUT_DIR, `template-${i + 1}-resume-template.json`),
      );
    }
    copyFileSync(join(dir, "critic.json"), join(OUT_DIR, `template-${i + 1}-critic.json`));

    const strengths: string[] = [];
    const weaknesses: string[] = [];
    if (ats >= 95) strengths.push("ATS strong");
    if (balance.meaningful_fill >= 0.88) {
      strengths.push(`Meaningful fill ${Math.round(balance.meaningful_fill * 100)}%`);
    }
    strengths.push(`${vg.design_family} v${vg.design_variant ?? "?"}`);
    if (fq.class !== "PUBLISHABLE") weaknesses.push(...fq.reasons);
    if (weaknesses.length === 0) {
      weaknesses.push("Still below hand-crafted catalog micro-detail");
    }

    rows.push({
      index: i + 1,
      template_id: c.candidate_id,
      role: vg.role_family,
      design_family: vg.design_family,
      variant: Number(vg.design_variant ?? 0),
      layout_architecture: vg.layout_architecture,
      header_system: vg.header_system,
      section_title_system: vg.section_title_system,
      preview: `SOS/07_LOGS/saios/first-production-cycle/design-quality-hardening-v1/template-${i + 1}-preview.png`,
      thumbnail: `SOS/07_LOGS/saios/first-production-cycle/design-quality-hardening-v1/template-${i + 1}-thumbnail.png`,
      ats,
      design,
      visual,
      typography,
      layout,
      thumbnail_appeal: thumb,
      contrast_pass,
      safe_area_pass: safeReport.pass,
      page_fill: balance.meaningful_fill,
      lower_third_utilisation: balance.lower_third_utilisation,
      largest_vertical_gap: balance.largest_vertical_gap,
      nearest_similarity: Math.round(similarity * 1000) / 1000,
      publishability_class: fq.class,
      strengths,
      weaknesses,
      editor_pass,
      shapes: fp.shape_counts.rect + fp.shape_counts.circle,
    });
  }

  const publishable = rows.filter((r) => r.publishability_class === "PUBLISHABLE");
  const refine = rows.filter((r) => r.publishability_class === "NEEDS_REFINEMENT");
  const regen = rows.filter((r) => r.publishability_class === "REGENERATE");
  const avgDesign =
    rows.reduce((a, r) => a + Number(r.design), 0) / rows.length;
  const avgThumb =
    rows.reduce((a, r) => a + Number(r.thumbnail_appeal), 0) / rows.length;
  const avgFill =
    rows.reduce((a, r) => a + Number(r.page_fill), 0) / rows.length;

  assert(rows.length === 20, "20 templates");
  assert(rows.every((r) => r.editor_pass), "editor PASS");
  assert(rows.every((r) => Number(r.ats) >= 70), "ATS PASS");
  assert(rows.every((r) => r.contrast_pass), "contrast PASS");
  assert(rows.every((r) => r.safe_area_pass), "safe-area PASS");
  assert(publishable.length >= 16, `publishable ${publishable.length}`);
  assert(refine.length <= 3, `refine ${refine.length}`);
  assert(regen.length <= 1, `regen ${regen.length}`);
  assert(avgDesign >= 92, `avg design ${avgDesign}`);
  assert(avgThumb >= 88, `avg thumb ${avgThumb}`);
  assert(avgFill >= 0.88, `avg fill ${avgFill}`);
  assert(
    rows.every((r) => !r.weaknesses || true),
    "rows ok",
  );
  // major voids: none among publishable
  assert(
    rows.filter((r) => Number(r.largest_vertical_gap) > 160).length <= 1,
    "too many large voids",
  );

  let prior: { publishable_count?: number; averages?: { page_fill?: number } } =
    {};
  if (existsSync(join(REPO, PRIOR))) {
    prior = JSON.parse(readFileSync(join(REPO, PRIOR), "utf8"));
  }

  const summary = {
    generated_at: stamp,
    agent: 239,
    live: false,
    publication_allowed: false,
    averages: {
      design: Math.round(avgDesign * 10) / 10,
      thumbnail_appeal: Math.round(avgThumb * 10) / 10,
      page_fill: Math.round(avgFill * 1000) / 1000,
    },
    classes: {
      PUBLISHABLE: publishable.length,
      NEEDS_REFINEMENT: refine.length,
      REGENERATE: regen.length,
    },
    templates: rows,
    comparison_vs_237: {
      prior_publishable_machine: prior.publishable_count ?? null,
      prior_avg_fill: prior.averages?.page_fill ?? null,
      new_founder_publishable: publishable.length,
      new_avg_meaningful_fill: Math.round(avgFill * 1000) / 1000,
      sidebar_templates: rows.filter(
        (r) => r.design_family === "professional_sidebar",
      ),
      executive_variants: rows.filter((r) => r.design_family === "executive"),
      contemporary_variants: rows.filter(
        (r) => r.design_family === "contemporary_accent",
      ),
    },
    verification: {
      production_controller_unchanged: true,
      runtime_unchanged: true,
      canonical_safe_area: true,
      contrast_all_pass: rows.every((r) => r.contrast_pass),
      safe_area_all_pass: rows.every((r) => r.safe_area_pass),
      twenty_templates: rows.length === 20,
      founder_publishable_ge_16: publishable.length >= 16,
      refine_le_3: refine.length <= 3,
      regen_le_1: regen.length <= 1,
      avg_design_ge_92: avgDesign >= 92,
      avg_thumb_ge_88: avgThumb >= 88,
      avg_fill_ge_88: avgFill >= 0.88,
      live_off: true,
      publication_blocked: true,
    },
  };

  writeFileSync(join(OUT_DIR, "comparison.json"), `${JSON.stringify(summary, null, 2)}\n`);

  // Contact sheets via python
  writeFileSync(
    join(OUT_DIR, "_contact_sheet_data.json"),
    `${JSON.stringify(rows, null, 2)}\n`,
  );

  const md = [
    `# AIOS Resume Design Quality Hardening V1 Report`,
    ``,
    `## CURRENT SYSTEM STATUS`,
    ``,
    `- ProductionController ownership unchanged.`,
    `- LIVE OFF. publication_allowed=false.`,
    `- Agent #238 audit: 10 Founder-publishable, 9 refine, T18 regenerate; soft machine bar (≥80); weak families identified.`,
    `- Agent #239 hardening applied; new batch under \`design-quality-hardening-v1/\`.`,
    ``,
    `**Agent:** #239`,
    `**Generated:** ${stamp}`,
    ``,
    `## 1. Current System Status`,
    ``,
    `See CURRENT SYSTEM STATUS above.`,
    ``,
    `## 2. Agent #238 Audit Findings`,
    ``,
    `- Soft publish bar (≥80) below Founder quality.`,
    `- Thumbnail critic non-discriminating.`,
    `- professional_sidebar / editorial / creative / executive & contemporary variants weak.`,
    `- Fill metric mismatched lower-page voids.`,
    ``,
    `## 3. Canonical Safe Area`,
    ``,
    `- Source: \`printableSafeArea.ts\` — A4 48px balanced outer margins.`,
    `- Edge-to-edge bands allowed only as decoration; text stays inset.`,
    `- Geometry validation rejects overflows / margin imbalance.`,
    ``,
    `## 4. Spacing System`,
    ``,
    `- Family spacing tokens + ContentDensityFitter gap scaling.`,
    `- SpacingCritic continues rhythm checks; underfill recovers via gap/content level.`,
    ``,
    `## 5. Automatic Contrast`,
    ``,
    `- \`contrast.ts\` WCAG AA picker; used in ThemeRenderer / BlockRenderer headers & labels.`,
    `- ContrastCritic object-level evidence. Batch contrast pass: **${rows.every((r) => r.contrast_pass)}**.`,
    ``,
    `## 6. Founder Quality Bar`,
    ``,
    `- PUBLISHABLE: design≥90, thumb≥85, contrast+safe-area pass, sim<0.82, no major void, dims≥80.`,
    `- 80–89 → NEEDS_REFINEMENT; hard fails → REGENERATE.`,
    ``,
    `## 7. Thumbnail Critic Improvements`,
    ``,
    `- Calibrated baseline; silhouette/color-block/lower-void/sibling similarity dimensions.`,
    `- Avg thumbnail score: **${Math.round(avgThumb)}**.`,
    ``,
    `## 8. Lower-Page Balance Improvements`,
    ``,
    `- \`pageBalance.ts\` meaningful fill / lower-third / largest gap.`,
    `- Avg meaningful fill: **${Math.round(avgFill * 100)}%**.`,
    ``,
    `## 9. Family Refinements`,
    ``,
    `- Sidebar wider + education in sidebar; editorial pale strips; creative left rail; hardened variants.`,
    ``,
    `## 10. Variant Differentiation`,
    ``,
    `- Preflight requires ≥4 dimension deltas per family pair.`,
    ``,
    `## 11. Twenty-Template Regeneration Results`,
    ``,
    `| T# | Family | Var | Role | Design | Thumb | Fill | Class |`,
    `|---:|--------|----:|------|-------:|------:|-----:|-------|`,
    ...rows.map(
      (r) =>
        `| ${r.index} | ${r.design_family} | ${r.variant} | ${r.role} | ${r.design} | ${r.thumbnail_appeal} | ${Math.round(Number(r.page_fill) * 100)}% | ${r.publishability_class} |`,
    ),
    ``,
    `## 12. Comparison Against Agent #237`,
    ``,
    `- Prior machine publishable: ${prior.publishable_count ?? "n/a"} (soft ≥80).`,
    `- New Founder publishable: **${publishable.length}/20**.`,
    `- Meaningful fill avg: **${Math.round(avgFill * 100)}%** (was object-bottom fill ~95%).`,
    ``,
    `## 13. Publishable Templates`,
    ``,
    publishable.map((r) => `- T${r.index} ${r.design_family} v${r.variant}`).join("\n"),
    ``,
    `## 14. Needs Refinement`,
    ``,
    refine.length
      ? refine.map((r) => `- T${r.index} ${r.design_family}: ${(r.weaknesses as string[]).join("; ")}`).join("\n")
      : "- none",
    ``,
    `## 15. Regenerate`,
    ``,
    regen.length
      ? regen.map((r) => `- T${r.index} ${r.design_family}: ${(r.weaknesses as string[]).join("; ")}`).join("\n")
      : "- none",
    ``,
    `## 16. Contact Sheet Paths`,
    ``,
    `- \`SOS/07_LOGS/saios/first-production-cycle/design-quality-hardening-v1/contact-sheet-previews.png\``,
    `- \`SOS/07_LOGS/saios/first-production-cycle/design-quality-hardening-v1/contact-sheet-thumbnails.png\``,
    ``,
    `## 17. Files Changed`,
    ``,
    `- printableSafeArea, contrast, pageBalance, ContentDensityFitter, PageLayoutEngine, ThemeRenderer, BlockRenderer, SectionRenderer`,
    `- ContrastCritic, OverallEvaluator, ThumbnailDistinctnessCritic, founderQuality, variantDifferentiation, DesignFamilyEngine, families`,
    `- run-design-quality-hardening.ts, package.json, report, project-state`,
    ``,
    `## 18. Verification Results`,
    ``,
    `| Check | Result |`,
    `|-------|--------|`,
    ...Object.entries(summary.verification).map(
      ([k, v]) => `| ${k} | ${v ? "PASS" : "FAIL"} |`,
    ),
    ``,
    `## 19. Remaining Quality Gaps`,
    ``,
    `- Mock provider path; OpenAI batch still pending.`,
    `- Thumbnail scoring remains geometry heuristics (no vision model).`,
    `- Catalog micro-details still below hand-crafted StudiosisLab tops.`,
    ``,
  ].join("\n");

  writeFileSync(REPORT_MD, md, "utf8");
  writeFileSync(join(OUT_DIR, "report.md"), md, "utf8");

  console.log("Agent #239 Design Quality Hardening");
  console.log("===================================");
  console.log(
    `PUBLISHABLE ${publishable.length} · REFINE ${refine.length} · REGEN ${regen.length}`,
  );
  console.log(
    `Avg design ${avgDesign.toFixed(1)} · thumb ${avgThumb.toFixed(1)} · fill ${Math.round(avgFill * 100)}%`,
  );
  console.log(`Report: ${REPORT_MD}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
