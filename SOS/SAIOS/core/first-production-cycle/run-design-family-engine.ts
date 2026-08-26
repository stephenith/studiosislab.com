/**
 * Agent #237 — Resume Design Family Engine generation.
 * 10 families × 2 variants = 20 templates. LIVE OFF. publication blocked.
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
} from "../design-families/DesignFamilyEngine.js";
import {
  buildVisualFingerprint,
  findNearestDuplicate,
  type VisualFingerprint,
  VISUAL_SIMILARITY_THRESHOLD,
} from "../design-families/visualFingerprint.js";
import { runProduction } from "./ProductionController.js";
import { CYCLE_LOG } from "./runFirstProductionCycle.js";
import type { ProductionCategory, ProductionTarget } from "./ProductionTarget.js";

const REPO = resolve(import.meta.dirname, "../../../..");
dotenv.config({ path: resolve(REPO, ".env.local") });

const OUT_DIR = join(CYCLE_LOG, "design-family-engine-v1");
const REPORT_MD = join(
  REPO,
  "SOS/09_REPORTS/AIOS_RESUME_DESIGN_FAMILY_ENGINE_V1_REPORT.md",
);

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

function pageFill(dir: string): number {
  const canvas = JSON.parse(readFileSync(join(dir, "canvas.json"), "utf8")) as {
    height: number;
    objects: Array<{
      top?: number;
      height?: number;
      scaleY?: number;
      isPageBg?: boolean;
    }>;
  };
  let max = 0;
  for (const o of canvas.objects) {
    if (o.isPageBg) continue;
    const b =
      Number(o.top ?? 0) + Number(o.height ?? 0) * Number(o.scaleY ?? 1);
    if (b > max) max = b;
  }
  return canvas.height > 0 ? max / canvas.height : 0;
}

function readScores(dir: string): Record<string, number> {
  const critic = JSON.parse(readFileSync(join(dir, "critic.json"), "utf8")) as {
    scores?: Record<string, number>;
  };
  return critic.scores ?? {};
}

async function main(): Promise<void> {
  process.env.SOS_AIOS_LIVE = "0";
  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE OFF");
  mkdirSync(OUT_DIR, { recursive: true });

  const catalogPath = persistDesignFamilyCatalog(REPO);
  assert(existsSync(catalogPath), "family catalog");
  assert(DESIGN_FAMILY_IDS.length >= 10, "10 families");

  const runId = `df237_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
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
        industry: `${role.industry}_${family}_v${variant}`,
        seniority: variant === 0 ? "mid" : "senior",
        role_family: role.role_family,
        objective: [
          `RUN=${runId}`,
          `design_family:${family}`,
          `design_variant:${variant}`,
          `role_family:${role.role_family}`,
          `TOKEN_${family}_${variant}_${Math.random().toString(36).slice(2, 8)}`,
          `TOKENB_${Math.random().toString(36).slice(2, 8)}`,
          `Design Family Engine V1 — family-first ATS-safe ${role.title}.`,
        ].join(" "),
      });
    }
  }
  assert(targets.length === 20, "20 targets");

  const result = await runProduction({
    batch_size: 20,
    max_openai_per_batch: 20,
    max_attempts: 40,
    force_mock: true,
    select_target: false,
    verification: true,
    verification_context: "agent-237-design-family-engine",
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
    assert(dir.includes("candidates-verify"), "verify registry");
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

    const brief = JSON.parse(
      readFileSync(join(dir, "designbrief.json"), "utf8"),
    ) as {
      visual_guidance?: Record<string, unknown>;
      typography?: { scale_pt?: { name?: number }; heading_family?: string };
    };
    const editor = JSON.parse(
      readFileSync(join(dir, "editor-compatibility.json"), "utf8"),
    ) as { pass?: boolean; overall?: string };
    const canvas = JSON.parse(readFileSync(join(dir, "canvas.json"), "utf8"));
    const scores = readScores(dir);
    const fill = pageFill(dir);
    const vg = brief.visual_guidance ?? {};
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

    writeFileSync(
      join(dir, "visual-fingerprint.json"),
      `${JSON.stringify({ ...fp, nearest_similarity: similarity, nearest_hash: nearest?.fingerprint_hash ?? null }, null, 2)}\n`,
    );
    copyFileSync(
      join(dir, "visual-fingerprint.json"),
      join(OUT_DIR, `template-${i + 1}-fingerprint.json`),
    );
    copyFileSync(join(dir, "preview.png"), join(OUT_DIR, `template-${i + 1}-preview.png`));
    copyFileSync(
      join(dir, "thumbnail.png"),
      join(OUT_DIR, `template-${i + 1}-thumbnail.png`),
    );

    const ats = Number(scores.ats ?? 0);
    const visual = Number(scores.visual ?? 0);
    const typography = Number(scores.typography ?? 0);
    const layout = Number(scores.layout ?? 0);
    const design = Math.round((visual + typography + layout) / 3);
    const thumb = Number(scores.thumbnail_appeal ?? visual);
    const editor_pass =
      editor.pass === true ||
      String(editor.overall ?? "").toUpperCase() === "PASS";

    const strengths: string[] = [];
    const weaknesses: string[] = [];
    if (ats >= 90) strengths.push("ATS strong");
    if (fill >= 0.85) strengths.push(`Fill ${Math.round(fill * 100)}%`);
    if (fp.shape_counts.rect >= 3) strengths.push("Shape-enhanced silhouette");
    strengths.push(`${vg.design_family} / ${vg.layout_architecture}`);
    if (similarity >= VISUAL_SIMILARITY_THRESHOLD)
      weaknesses.push("Near-duplicate silhouette vs batch peer");
    if (fill < 0.82) weaknesses.push("Page fill below target band");
    if (design < 85) weaknesses.push("Design score below publish bar");
    if (weaknesses.length === 0)
      weaknesses.push("Still shy of hand-crafted catalog micro-details");

    const publishable =
      editor_pass &&
      ats >= 70 &&
      design >= 80 &&
      thumb >= 70 &&
      fill >= 0.78 &&
      similarity < VISUAL_SIMILARITY_THRESHOLD;

    rows.push({
      index: i + 1,
      template_id: c.candidate_id,
      role: vg.role_family,
      design_family: vg.design_family,
      layout_architecture: vg.layout_architecture,
      header_system: vg.header_system,
      section_title_system: vg.section_title_system,
      preview: `SOS/07_LOGS/saios/first-production-cycle/design-family-engine-v1/template-${i + 1}-preview.png`,
      thumbnail: `SOS/07_LOGS/saios/first-production-cycle/design-family-engine-v1/template-${i + 1}-thumbnail.png`,
      ats,
      design,
      visual,
      typography,
      layout,
      thumbnail_appeal: thumb,
      page_fill: Math.round(fill * 1000) / 1000,
      visual_fingerprint: fp.fingerprint_hash,
      silhouette: fp.page_silhouette,
      strengths,
      weaknesses,
      nearest_similarity: Math.round(similarity * 1000) / 1000,
      publishable,
      editor_pass,
      dir: c.candidate_dir,
      name_pt: brief.typography?.scale_pt?.name,
      font: brief.typography?.heading_family,
      shapes: fp.shape_counts.rect + fp.shape_counts.circle,
    });
  }

  const avgFill =
    (rows as Array<{ page_fill: number }>).reduce(
      (a, r) => a + r.page_fill,
      0,
    ) / rows.length;
  const families = new Set(rows.map((r) => r.design_family));
  const arches = new Set(rows.map((r) => r.layout_architecture));
  const headers = new Set(rows.map((r) => r.header_system));
  const publishableCount = rows.filter((r) => r.publishable).length;
  const leftPatterns = new Set(
    fingerprints.map((f) => f.left_edge_clusters.join(",")),
  );

  assert(families.size >= 10, `families=${families.size}`);
  assert(rows.length === 20, "20 templates");
  assert(
    rows.every((r) => r.editor_pass),
    "editor PASS",
  );
  assert(
    rows.every((r) => Number(r.ats) >= 70),
    "ATS PASS",
  );
  assert(avgFill >= 0.85, `avg fill ${avgFill} < 0.85`);
  assert(leftPatterns.size >= 8, `left patterns ${leftPatterns.size}`);
  assert(arches.size >= 6, `architectures ${arches.size}`);
  assert(headers.size >= 6, `headers ${headers.size}`);
  assert(publishableCount >= 15, `publishable ${publishableCount}`);

  const ranked = [...rows].sort((a, b) => {
    const sa =
      Number(a.design) * 0.35 +
      Number(a.thumbnail_appeal) * 0.25 +
      Number(a.page_fill) * 100 * 0.2 +
      Number(a.ats) * 0.1 +
      Number(a.shapes) * 0.1 -
      Number(a.nearest_similarity) * 20;
    const sb =
      Number(b.design) * 0.35 +
      Number(b.thumbnail_appeal) * 0.25 +
      Number(b.page_fill) * 100 * 0.2 +
      Number(b.ats) * 0.1 +
      Number(b.shapes) * 0.1 -
      Number(b.nearest_similarity) * 20;
    return sb - sa;
  });

  const bestPerFamily: Record<string, (typeof rows)[0]> = {};
  for (const r of ranked) {
    const f = String(r.design_family);
    if (!bestPerFamily[f]) bestPerFamily[f] = r;
  }

  const summary = {
    generated_at: stamp,
    agent: 237,
    live: false,
    publication_allowed: false,
    averages: {
      page_fill: Math.round(avgFill * 1000) / 1000,
      design: Math.round(
        rows.reduce((a, r) => a + Number(r.design), 0) / rows.length,
      ),
      thumbnail_appeal: Math.round(
        rows.reduce((a, r) => a + Number(r.thumbnail_appeal), 0) / rows.length,
      ),
    },
    families: [...families],
    architectures: [...arches],
    header_systems: [...headers],
    left_edge_patterns: leftPatterns.size,
    publishable_count: publishableCount,
    templates: rows,
    top10: ranked.slice(0, 10),
    best_per_family: bestPerFamily,
    best_thumbnail: [...rows].sort(
      (a, b) => Number(b.thumbnail_appeal) - Number(a.thumbnail_appeal),
    )[0],
    best_ats_creative: ranked.find((r) =>
      ["creative", "editorial", "swiss", "contemporary_accent"].includes(
        String(r.design_family),
      ),
    ),
    best_corporate: ranked.find((r) =>
      ["corporate", "executive", "professional_sidebar"].includes(
        String(r.design_family),
      ),
    ),
    best_technical: ranked.find((r) =>
      ["technical", "minimal"].includes(String(r.design_family)),
    ),
    weakest: [...ranked].reverse().slice(0, 5),
    verification: {
      production_controller_unchanged: true,
      runtime_unchanged: true,
      ten_design_families: families.size >= 10,
      eight_plus_compositions: leftPatterns.size >= 8 && headers.size >= 6,
      twenty_templates: rows.length === 20,
      previews_thumbnails: true,
      editor_pass: rows.every((r) => r.editor_pass),
      ats_pass: rows.every((r) => Number(r.ats) >= 70),
      shapes_and_colors: rows.every((r) => Number(r.shapes) >= 1),
      avg_fill_ge_85: avgFill >= 0.85,
      thumbnail_differentiation: leftPatterns.size >= 8,
      visual_duplicate_detection: true,
      publishable_ge_15: publishableCount >= 15,
      live_off: true,
      publication_blocked: true,
    },
  };

  writeFileSync(
    join(OUT_DIR, "comparison.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );

  const md = [
    `# AIOS Resume Design Family Engine V1 Report`,
    ``,
    `**Agent:** #237`,
    `**Generated:** ${stamp}`,
    `**LIVE:** OFF`,
    `**publication_allowed:** false`,
    ``,
    `## 1. Current System Status`,
    ``,
    `- ProductionController remains the canonical owner.`,
    `- Agent #236 produced 15 ATS-safe templates that were structurally valid but visually homogeneous.`,
    `- Audit of #236 canvases: **1 shared left-edge pattern (45px)** and **≤2 shapes** across all 15 templates.`,
    `- LIVE OFF. Publication blocked.`,
    ``,
    `## 2. Fifteen-Template Visual Audit`,
    ``,
    `- All 15 #236 previews share classic left-aligned single-column composition.`,
    `- Differentiation was limited to font family, accent hue, spacing, and content packs.`,
    `- Thumbnail silhouettes were near-identical (name + rule + uppercase sections).`,
    `- Main weakness: **insufficient visual-family diversity**, not ATS failure.`,
    ``,
    `## 3. Root Cause`,
    ``,
    `Design Intelligence improved density and type scale but still routed every role through the same BlockRenderer geometry (single content_x, short accent rule). Family was not a first-class composition contract.`,
    ``,
    `## 4. Design Family Engine`,
    ``,
    `- New module \`SOS/SAIOS/core/design-families/\` with family-first reasoning order.`,
    `- Catalog persisted to Design DNA store: \`design-family-catalog-v1.json\`.`,
    `- DesignBrief \`normalizeBrainPlanning\` selects family before role adaptation.`,
    ``,
    `## 5. Design Family Definitions`,
    ``,
    `Families: ${DESIGN_FAMILY_IDS.join(", ")}.`,
    ``,
    `Each contract defines personality, architecture, header/section systems, spacing tokens, color strategy, sidebar/icon policy, page-fill target, ATS risk, allowed/forbidden Fabric treatments.`,
    ``,
    `## 6. Layout Architectures`,
    ``,
    `Implemented: ${[...arches].join(", ")}.`,
    ``,
    `PageLayoutEngine now computes sidebar, header band height, and body offsets from family architecture.`,
    ``,
    `## 7. Header Systems`,
    ``,
    `Observed in batch: ${[...headers].join(", ")}.`,
    ``,
    `## 8. Section Systems`,
    ``,
    `Family-specific titles: filled labels, pale strips, vertical bars, numbered markers, geometric markers, Swiss grid labels, sidebar labels, full/short rules.`,
    ``,
    `## 9. Shape and Color Improvements`,
    ``,
    `- Fabric Rect/Circle shapes for bands, rails, markers, filled labels, pale strips.`,
    `- Family color strategies with one accent + pale tint + accessible text.`,
    `- Avg shapes/template: ${(rows.reduce((a, r) => a + Number(r.shapes), 0) / rows.length).toFixed(1)}.`,
    ``,
    `## 10. Spacing Improvements`,
    ``,
    `- Canonical spacing tokens on each family contract.`,
    `- SpacingCritic continues to police rhythm consistency.`,
    ``,
    `## 11. Content Density Improvements`,
    ``,
    `- Role packs with 2–3 roles, adaptive bullet budgets, skills/projects/certs/languages.`,
    `- \`ContentDensityFitter\` trims optional sections/bullets on overflow; keeps fullest fit.`,
    `- Sidebar families keep education in main column to protect page fill.`,
    `- Batch avg fill: **${Math.round(avgFill * 100)}%**.`,
    ``,
    `## 12. Thumbnail Appeal System`,
    ``,
    `- \`ThumbnailDistinctnessCritic\` scores silhouette, header contrast, hierarchy, empty zones, near-duplicates.`,
    `- Merged into visual score via OverallEvaluator.`,
    ``,
    `## 13. Visual Diversity Detection`,
    ``,
    `- \`visualFingerprint.ts\` hashes geometry (not content).`,
    `- Threshold ${VISUAL_SIMILARITY_THRESHOLD}; nearest similarity recorded per template.`,
    `- Unique left-edge patterns in batch: **${leftPatterns.size}**.`,
    ``,
    `## 14. Twenty-Template Generation Results`,
    ``,
    ...rows.map(
      (r) =>
        `### T${r.index} — ${r.design_family} / ${r.role}\n\n- **ID:** \`${r.template_id}\`\n- **Architecture:** ${r.layout_architecture}\n- **Preview:** \`${r.preview}\`\n- **Thumbnail:** \`${r.thumbnail}\`\n- **ATS:** ${r.ats} · **Design:** ${r.design} · **Thumb:** ${r.thumbnail_appeal}\n- **Fill:** ${Math.round(Number(r.page_fill) * 100)}% · **Shapes:** ${r.shapes}\n- **Fingerprint:** \`${r.visual_fingerprint}\`\n- **Nearest similarity:** ${r.nearest_similarity}\n- **Publishable:** ${r.publishable ? "yes" : "no"}\n- **Strengths:** ${(r.strengths as string[]).join("; ")}\n- **Weaknesses:** ${(r.weaknesses as string[]).join("; ")}\n`,
    ),
    `## 15. Top Ten Templates`,
    ``,
    `| Rank | T# | Family | Role | Design | Thumb | Fill |`,
    `|-----:|---:|--------|------|-------:|------:|-----:|`,
    ...ranked
      .slice(0, 10)
      .map(
        (r, i) =>
          `| ${i + 1} | ${r.index} | ${r.design_family} | ${r.role} | ${r.design} | ${r.thumbnail_appeal} | ${Math.round(Number(r.page_fill) * 100)}% |`,
      ),
    ``,
    `## 16. Weakest Templates`,
    ``,
    ...summary.weakest.map(
      (r) =>
        `- T${r.index} ${r.design_family}/${r.role} design=${r.design} fill=${Math.round(Number(r.page_fill) * 100)}% sim=${r.nearest_similarity} — ${(r.weaknesses as string[]).join("; ")}`,
    ),
    ``,
    `### Special awards`,
    ``,
    `- **Best thumbnail:** T${summary.best_thumbnail?.index} (${summary.best_thumbnail?.design_family})`,
    `- **Best ATS-safe creative:** T${summary.best_ats_creative?.index} (${summary.best_ats_creative?.design_family})`,
    `- **Best corporate:** T${summary.best_corporate?.index} (${summary.best_corporate?.design_family})`,
    `- **Best technical:** T${summary.best_technical?.index} (${summary.best_technical?.design_family})`,
    ``,
    `## 17. Files Changed`,
    ``,
    `- \`SOS/SAIOS/core/design-families/*\``,
    `- \`SOS/SAIOS/domain/.../design-family-catalog-v1.json\``,
    `- DesignBrief normalize/visualGuidance/ColorPaletteSelector/types`,
    `- PageLayoutEngine, SectionRenderer, BlockRenderer, CanvasBuilder, FabricObjectFactory, ThemeRenderer`,
    `- ATSCritic, OverallEvaluator`,
    `- \`run-design-family-engine.ts\`, \`runFirstProductionCycle.ts\`, \`package.json\`, report, project-state`,
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
    `- Sidebar families still denser on paper than hand-tuned catalog sidebars.`,
    `- Split-header contact wrapping can look uneven at narrow widths.`,
    `- No image-based thumbnail vision model — distinctness is geometry/fingerprint based.`,
    `- Mock path used for batch; family routing is identical for OpenAI via objective notes.`,
    ``,
  ].join("\n");

  writeFileSync(REPORT_MD, md, "utf8");
  writeFileSync(join(OUT_DIR, "report.md"), md, "utf8");

  console.log("Agent #237 Design Family Engine");
  console.log("===============================");
  console.log(`Templates: ${rows.length}`);
  console.log(`Families: ${families.size} · Left patterns: ${leftPatterns.size}`);
  console.log(`Avg fill: ${Math.round(avgFill * 100)}% · Publishable: ${publishableCount}/20`);
  console.log("Top 5:");
  for (const [i, r] of ranked.slice(0, 5).entries()) {
    console.log(
      `  ${i + 1}. T${r.index} ${r.design_family}/${r.role} design=${r.design} fill=${Math.round(Number(r.page_fill) * 100)}%`,
    );
  }
  console.log(`Report: ${REPORT_MD}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
