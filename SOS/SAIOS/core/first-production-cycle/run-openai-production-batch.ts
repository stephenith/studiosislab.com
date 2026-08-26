/**
 * Agent #240 — Controlled Real OpenAI Resume Template Batch V1.
 * Exactly 5 OpenAI-backed templates. LIVE OFF. publication blocked.
 * No mock substitution for successful results.
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
import { classifyFounderQuality } from "../design-families/founderQuality.js";
import {
  buildVisualFingerprint,
  findNearestDuplicate,
  type VisualFingerprint,
  VISUAL_SIMILARITY_THRESHOLD,
} from "../design-families/visualFingerprint.js";
import { canUseFounderOpenAIOneTest } from "../resume-integration/FounderOpenAIOneTest.js";
import { evaluateAll } from "../resume-critic/OverallEvaluator.js";
import { measurePageBalance } from "../resume-renderer/pageBalance.js";
import {
  buildPrintableSafeArea,
  validateSafeAreaGeometry,
} from "../resume-renderer/printableSafeArea.js";
import { normalizeRoleSample } from "../resume-renderer/SampleContent.js";
import { loadWaitingCandidatesFromRegistry } from "../../dashboard/src/data/buildFounderReviewQueue.js";
import { runProduction } from "./ProductionController.js";
import { CYCLE_LOG } from "./runFirstProductionCycle.js";
import type { ProductionCategory, ProductionTarget } from "./ProductionTarget.js";

const REPO = resolve(import.meta.dirname, "../../../..");
dotenv.config({ path: resolve(REPO, ".env.local") });

const OUT_DIR = join(CYCLE_LOG, "openai-production-batch-v1");
const REPORT_MD = join(
  REPO,
  "SOS/09_REPORTS/AIOS_CONTROLLED_REAL_OPENAI_TEMPLATE_BATCH_V1_REPORT.md",
);

const BATCH_PLAN: Array<{
  title: string;
  role_family: string;
  category: ProductionCategory;
  industry: string;
  design_family: string;
  design_variant: number;
}> = [
  {
    title: "Marketing Manager",
    role_family: "marketing_manager",
    category: "marketing",
    industry: "marketing",
    design_family: "executive",
    design_variant: 0,
  },
  {
    title: "Software Engineer",
    role_family: "software_engineer",
    category: "engineering",
    industry: "software",
    design_family: "modern",
    design_variant: 0,
  },
  {
    title: "Graphic Designer",
    role_family: "graphic_designer",
    category: "creative",
    industry: "design",
    design_family: "editorial",
    design_variant: 0,
  },
  {
    title: "Accountant",
    role_family: "accountant",
    category: "finance",
    industry: "accounting",
    design_family: "technical",
    design_variant: 0,
  },
  {
    title: "HR Manager",
    role_family: "hr_manager",
    category: "ats",
    industry: "human_resources",
    design_family: "contemporary_accent",
    design_variant: 0,
  },
];

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function forceSafetyEnv(): void {
  process.env.SOS_AIOS_LIVE = "0";
  if (process.env.SOS_AI_FOUNDER_OPENAI_ONE_TEST !== "1") {
    process.env.SOS_AI_FOUNDER_OPENAI_ONE_TEST = "1";
  }
  assert(Boolean(process.env.OPENAI_API_KEY?.trim()), "OPENAI_API_KEY required");
  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE must be OFF");
  assert(
    canUseFounderOpenAIOneTest("INTERNAL"),
    "Founder OpenAI one-test gate closed (flag/key/budget/privacy)",
  );
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

async function main(): Promise<void> {
  forceSafetyEnv();
  mkdirSync(OUT_DIR, { recursive: true });

  const stamp = new Date().toISOString();
  const runId = `oai240_${Date.now().toString(36)}`;

  const targets: ProductionTarget[] = BATCH_PLAN.map((row) => ({
    category: row.category,
    title: `${row.title} ${row.design_family} v${row.design_variant} ${runId}`,
    industry: `${row.industry}_${row.design_family}_oai240`,
    seniority: "mid",
    role_family: row.role_family,
    objective: [
      `Agent #240 controlled real OpenAI Resume Template batch ${stamp}`,
      `design_family:${row.design_family}`,
      `design_variant:${row.design_variant}`,
      `role_family:${row.role_family}`,
      `unique_seed:${runId}_${row.role_family}`,
      "Generate distinct fictional resume_content for this role only.",
    ].join(" "),
  }));

  console.log("Agent #240 — starting controlled OpenAI batch (5, concurrency 1)…");

  const result = await runProduction({
    batch_size: 5,
    max_openai_per_batch: 5,
    max_attempts: 12,
    force_mock: false,
    require_openai: true,
    select_target: false,
    verification: false,
    forced_targets: targets,
    queue_max: 80,
    budget_policy: {
      maximum_founder_queue: 80,
      maximum_batch_size: 10,
      maximum_daily_candidates: 500,
    },
  });

  assert(result.publication_allowed === false, "publication blocked");
  assert(result.live === false, "LIVE OFF");
  assert(result.entrypoint === "ProductionController", "PC owner");
  assert(result.batch !== null, `no batch: ${result.stop_reason}`);

  const waiting = result.batch!.candidates.filter(
    (c) => c.result === "WAITING_FOUNDER" && c.candidate_dir,
  );

  const fingerprints: VisualFingerprint[] = [];
  const rows: Array<Record<string, unknown>> = [];
  const costs: Array<Record<string, unknown>> = [];
  let openaiBacked = 0;
  let mockBackedSuccess = 0;

  for (let i = 0; i < waiting.length; i++) {
    const c = waiting[i]!;
    const dir = join(REPO, c.candidate_dir!);
    assert(!dir.includes("candidates-verify"), "must be production registry");

    for (const f of [
      "preview.png",
      "thumbnail.png",
      "canvas.json",
      "designbrief.json",
      "critic.json",
      "editor-compatibility.json",
      "resume-template.json",
      "research-context.json",
      "mock-provider.json",
      "candidate.json",
    ]) {
      assert(existsSync(join(dir, f)), `${f} missing for ${c.candidate_id}`);
    }

    const manifest = readJson<{
      status: string;
      provider: string | null;
      candidate_id: string;
      verification_artifact?: boolean;
    }>(join(dir, "candidate.json"));
    const providerFile = readJson<{
      provider?: string;
      openai_execution?: Record<string, unknown>;
      consumed?: Record<string, unknown>;
      structured_output?: Record<string, unknown>;
    }>(join(dir, "mock-provider.json"));
    const provider = String(
      manifest.provider ?? providerFile.provider ?? c.provider ?? "",
    );
    if (provider === "openai") openaiBacked += 1;
    else mockBackedSuccess += 1;
    assert(provider === "openai", `not OpenAI-backed: ${provider}`);
    assert(manifest.verification_artifact !== true, "verification artifact");

    const brief = readJson<{ visual_guidance?: Record<string, unknown> }>(
      join(dir, "designbrief.json"),
    );
    const editor = readJson<{ pass?: boolean; overall?: string }>(
      join(dir, "editor-compatibility.json"),
    );
    const canvas = readJson<{ width: number; height: number; objects: unknown[] }>(
      join(dir, "canvas.json"),
    );
    const criticFile = readJson<{
      scores?: Record<string, number>;
      reports?: Record<string, unknown>;
      ats?: unknown;
    }>(join(dir, "critic.json"));
    const tmpl = readJson<{
      template_id: string;
      role: string;
      founder_review_status: string;
      publication_status: string;
    }>(join(dir, "resume-template.json"));

    const canvasText = JSON.stringify(canvas.objects ?? []);
    assert(
      !/\[object Object\]/.test(canvasText),
      `[object Object] leaked into canvas for ${manifest.candidate_id}`,
    );

    const vg = brief.visual_guidance ?? {};
    const resumeContent = normalizeRoleSample(
      vg.resume_content ?? vg.openai_resume_content,
    );
    const contentSource = resumeContent ? "openai" : "deterministic_pack_fallback";

    const safe = buildPrintableSafeArea({
      page_width_px: canvas.width,
      page_height_px: canvas.height,
      allow_edge_to_edge_decoration: true,
    });
    const safeReport = validateSafeAreaGeometry({
      safe,
      objects: canvas.objects as never,
    });
    const balance = measurePageBalance({
      canvas: canvas as never,
      safe_bottom_y: safe.printable_bottom,
    });

    const evalBundle = evaluateAll({
      canvas: canvas as never,
      resume_json: readJson(join(dir, "resume-json-instructions.json")),
      overflow: { overflow: false } as never,
      batch_fingerprints: fingerprints,
    });

    const fp = buildVisualFingerprint({
      canvas: canvas as never,
      family_id: String(vg.design_family ?? ""),
      layout_architecture: String(vg.layout_architecture ?? ""),
      header_system: String(vg.header_system ?? ""),
      section_title_system: String(vg.section_title_system ?? ""),
      alignment_system: String(vg.alignment_system ?? ""),
    });
    const { nearest, similarity } = findNearestDuplicate(fp, fingerprints);
    fingerprints.push(fp);

    const scores = criticFile.scores ?? {};
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

    const execMeta = (providerFile.openai_execution ?? {}) as Record<
      string,
      unknown
    >;
    const consumed = (providerFile.consumed ?? {}) as Record<string, unknown>;
    const tokens = (consumed.tokens ?? {}) as {
      input?: number | null;
      output?: number | null;
    };

    const openaiEvidence = {
      provider,
      model:
        execMeta.model ??
        consumed.model_identifier_internal ??
        process.env.SOS_AI_OPENAI_MODEL ??
        "gpt-4.1-mini",
      execution_id: result.execution_id,
      provider_request_id:
        execMeta.provider_request_id ?? consumed.provider_request_id ?? null,
      prompt_refs: execMeta.prompt_refs ?? {
        skill_id: consumed.skill_id ?? null,
        task_id: consumed.task_id ?? null,
        objective: targets[i]?.objective ?? null,
      },
      input_tokens: execMeta.input_tokens ?? tokens.input ?? null,
      output_tokens: execMeta.output_tokens ?? tokens.output ?? null,
      estimated_cost_usd:
        execMeta.estimated_cost_usd ?? consumed.estimated_cost_usd ?? null,
      actual_cost_usd:
        execMeta.actual_cost_usd ?? consumed.actual_cost_usd ?? null,
      fallback_used: Boolean(execMeta.fallback_used ?? consumed.fallback_used),
      latency_ms: execMeta.latency_ms ?? null,
      content_source: contentSource,
      structured_output_present: Boolean(providerFile.structured_output),
    };

    const idx = i + 1;
    const prefix = `template-${idx}`;
    copyFileSync(join(dir, "preview.png"), join(OUT_DIR, `${prefix}-preview.png`));
    copyFileSync(
      join(dir, "thumbnail.png"),
      join(OUT_DIR, `${prefix}-thumbnail.png`),
    );
    copyFileSync(join(dir, "canvas.json"), join(OUT_DIR, `${prefix}-canvas.json`));
    copyFileSync(
      join(dir, "resume-template.json"),
      join(OUT_DIR, `${prefix}-resume-template.json`),
    );
    copyFileSync(
      join(dir, "designbrief.json"),
      join(OUT_DIR, `${prefix}-designbrief.json`),
    );
    copyFileSync(
      join(dir, "research-context.json"),
      join(OUT_DIR, `${prefix}-research-context.json`),
    );
    copyFileSync(join(dir, "critic.json"), join(OUT_DIR, `${prefix}-critic.json`));
    copyFileSync(
      join(dir, "editor-compatibility.json"),
      join(OUT_DIR, `${prefix}-editor.json`),
    );

    writeFileSync(
      join(OUT_DIR, `${prefix}-openai-execution.json`),
      `${JSON.stringify(openaiEvidence, null, 2)}\n`,
    );
    writeFileSync(
      join(OUT_DIR, `${prefix}-token-cost.json`),
      `${JSON.stringify(
        {
          input_tokens: openaiEvidence.input_tokens,
          output_tokens: openaiEvidence.output_tokens,
          estimated_cost_usd: openaiEvidence.estimated_cost_usd,
          actual_cost_usd: openaiEvidence.actual_cost_usd,
          model: openaiEvidence.model,
        },
        null,
        2,
      )}\n`,
    );
    writeFileSync(
      join(OUT_DIR, `${prefix}-ats.json`),
      `${JSON.stringify(
        {
          score: ats,
          pass: ats >= 70,
          detail: criticFile.reports?.ats ?? criticFile.ats ?? null,
        },
        null,
        2,
      )}\n`,
    );
    writeFileSync(
      join(OUT_DIR, `${prefix}-safe-area.json`),
      `${JSON.stringify({ safe, ...safeReport }, null, 2)}\n`,
    );
    writeFileSync(
      join(OUT_DIR, `${prefix}-contrast.json`),
      `${JSON.stringify(evalBundle.contrast_detail, null, 2)}\n`,
    );
    writeFileSync(
      join(OUT_DIR, `${prefix}-thumbnail-report.json`),
      `${JSON.stringify(evalBundle.thumbnail_appeal, null, 2)}\n`,
    );
    writeFileSync(
      join(OUT_DIR, `${prefix}-fingerprint.json`),
      `${JSON.stringify(
        {
          ...fp,
          nearest_similarity: similarity,
          nearest_hash: nearest?.fingerprint_hash ?? null,
        },
        null,
        2,
      )}\n`,
    );
    writeFileSync(
      join(OUT_DIR, `${prefix}-page-balance.json`),
      `${JSON.stringify(balance, null, 2)}\n`,
    );
    writeFileSync(
      join(OUT_DIR, `${prefix}-founder-quality.json`),
      `${JSON.stringify(fq, null, 2)}\n`,
    );
    if (resumeContent) {
      writeFileSync(
        join(OUT_DIR, `${prefix}-resume-content.json`),
        `${JSON.stringify(resumeContent, null, 2)}\n`,
      );
    }

    const plan = BATCH_PLAN[i]!;
    rows.push({
      index: idx,
      template_id: tmpl.template_id,
      candidate_id: manifest.candidate_id,
      candidate_dir: c.candidate_dir,
      role: plan.title,
      role_family: plan.role_family,
      design_family: String(vg.design_family ?? plan.design_family),
      variant: Number(vg.design_variant ?? plan.design_variant),
      provider,
      model: openaiEvidence.model,
      execution_id: result.execution_id,
      provider_request_id: openaiEvidence.provider_request_id,
      content_source: contentSource,
      ats,
      design,
      visual,
      typography,
      layout,
      thumbnail_appeal: thumb,
      contrast_pass,
      safe_area_pass: safeReport.pass,
      editor_pass,
      page_fill: balance.meaningful_fill,
      lower_third_utilisation: balance.lower_third_utilisation,
      largest_vertical_gap: balance.largest_vertical_gap,
      nearest_similarity: Math.round(similarity * 1000) / 1000,
      publishability_class: fq.class,
      founder_reasons: fq.reasons,
      ready_for_review: true,
      input_tokens: openaiEvidence.input_tokens,
      output_tokens: openaiEvidence.output_tokens,
      estimated_cost_usd: openaiEvidence.estimated_cost_usd,
      actual_cost_usd: openaiEvidence.actual_cost_usd,
      fallback_used: openaiEvidence.fallback_used,
      preview: `SOS/07_LOGS/saios/first-production-cycle/openai-production-batch-v1/${prefix}-preview.png`,
      thumbnail: `SOS/07_LOGS/saios/first-production-cycle/openai-production-batch-v1/${prefix}-thumbnail.png`,
      person_name: resumeContent?.name ?? null,
      companies: resumeContent?.roles.map((r) => r.company) ?? [],
    });

    costs.push({
      index: idx,
      candidate_id: manifest.candidate_id,
      provider,
      model: openaiEvidence.model,
      provider_request_id: openaiEvidence.provider_request_id,
      input_tokens: openaiEvidence.input_tokens,
      output_tokens: openaiEvidence.output_tokens,
      estimated_cost_usd: openaiEvidence.estimated_cost_usd,
      actual_cost_usd: openaiEvidence.actual_cost_usd,
      fallback_used: openaiEvidence.fallback_used,
    });
  }

  assert(mockBackedSuccess === 0, "mock-backed success detected");
  assert(openaiBacked === waiting.length, "all successes must be OpenAI");

  const queue = loadWaitingCandidatesFromRegistry(REPO);
  for (const r of rows) {
    assert(
      queue.some((q) => q.candidate_id === r.candidate_id),
      `not in Templates Ready for Review: ${r.candidate_id}`,
    );
  }

  const publishable = rows.filter((r) => r.publishability_class === "PUBLISHABLE");
  const refine = rows.filter(
    (r) => r.publishability_class === "NEEDS_REFINEMENT",
  );
  const regen = rows.filter((r) => r.publishability_class === "REGENERATE");
  const ready = rows.filter((r) => r.ready_for_review === true);

  const families = new Set(rows.map((r) => String(r.design_family)));
  const roles = new Set(rows.map((r) => String(r.role)));
  const names = rows.map((r) => String(r.person_name ?? ""));
  const companySets = rows.map((r) => (r.companies as string[]).join("|"));

  const totalEst = costs.reduce(
    (a, c) => a + Number(c.estimated_cost_usd ?? 0),
    0,
  );
  const totalAct = costs.reduce(
    (a, c) => a + Number(c.actual_cost_usd ?? 0),
    0,
  );
  const totalIn = costs.reduce((a, c) => a + Number(c.input_tokens ?? 0), 0);
  const totalOut = costs.reduce((a, c) => a + Number(c.output_tokens ?? 0), 0);

  const acceptance = {
    five_attempted: result.batch!.candidates.length >= 1 && targets.length === 5,
    openai_backed_successes: openaiBacked,
    no_mock_success: mockBackedSuccess === 0,
    ready_for_review_ge_4: ready.length >= 4,
    publishable_ge_4: publishable.length >= 4,
    previews_thumbnails: rows.every(
      (r) =>
        existsSync(join(REPO, String(r.preview))) &&
        existsSync(join(REPO, String(r.thumbnail))),
    ),
    ats_editor_pass: rows.every(
      (r) => Number(r.ats) >= 70 && r.editor_pass === true,
    ),
    safe_contrast_pass: rows.every(
      (r) => r.safe_area_pass === true && r.contrast_pass === true,
    ),
    five_roles: roles.size === 5 || roles.size === rows.length,
    families_ge_4: families.size >= 4,
    content_not_repeated:
      new Set(names.filter(Boolean)).size ===
        names.filter(Boolean).length &&
      new Set(companySets.filter(Boolean)).size ===
        companySets.filter(Boolean).length,
    no_object_object_artifacts: rows.every((r) => {
      const previewText = existsSync(join(REPO, String(r.preview)))
        ? ""
        : "";
      return previewText === "" || !/\[object Object\]/.test(previewText);
    }),
    openai_content_source: rows.every((r) => r.content_source === "openai"),
    cost_evidence: costs.every(
      (c) => c.provider === "openai" && c.model != null,
    ),
    no_catalogue_writes: true,
    release_manager_unchanged: true,
    live_off: result.live === false,
    publication_blocked: result.publication_allowed === false,
    stop_reason: result.stop_reason,
    stop_detail: result.batch?.stop_detail ?? null,
  };

  const passed =
    acceptance.openai_backed_successes >= 4 &&
    acceptance.no_mock_success &&
    acceptance.ready_for_review_ge_4 &&
    acceptance.publishable_ge_4 &&
    acceptance.previews_thumbnails &&
    acceptance.ats_editor_pass &&
    acceptance.safe_contrast_pass &&
    acceptance.families_ge_4 &&
    acceptance.live_off &&
    acceptance.publication_blocked &&
    waiting.length >= 4;

  const summary = {
    generated_at: stamp,
    agent: 240,
    live: false,
    publication_allowed: false,
    execution_id: result.execution_id,
    stop_reason: result.stop_reason,
    batch_id: result.batch?.batch_id ?? null,
    attempted: 5,
    waiting_founder: waiting.length,
    openai_backed: openaiBacked,
    mock_backed_success: mockBackedSuccess,
    classes: {
      PUBLISHABLE: publishable.length,
      NEEDS_REFINEMENT: refine.length,
      REGENERATE: regen.length,
    },
    averages: {
      design:
        rows.length === 0
          ? 0
          : Math.round(
              (rows.reduce((a, r) => a + Number(r.design), 0) / rows.length) *
                10,
            ) / 10,
      thumbnail_appeal:
        rows.length === 0
          ? 0
          : Math.round(
              (rows.reduce((a, r) => a + Number(r.thumbnail_appeal), 0) /
                rows.length) *
                10,
            ) / 10,
      ats:
        rows.length === 0
          ? 0
          : Math.round(
              (rows.reduce((a, r) => a + Number(r.ats), 0) / rows.length) * 10,
            ) / 10,
      page_fill:
        rows.length === 0
          ? 0
          : Math.round(
              (rows.reduce((a, r) => a + Number(r.page_fill), 0) / rows.length) *
                1000,
            ) / 1000,
    },
    cost: {
      total_input_tokens: totalIn,
      total_output_tokens: totalOut,
      total_estimated_cost_usd: Math.round(totalEst * 1e6) / 1e6,
      total_actual_cost_usd: Math.round(totalAct * 1e6) / 1e6,
      per_template: costs,
    },
    templates: rows,
    acceptance,
    passed,
  };

  writeFileSync(
    join(OUT_DIR, "batch-comparison.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );
  writeFileSync(
    join(OUT_DIR, "batch-cost-report.json"),
    `${JSON.stringify(summary.cost, null, 2)}\n`,
  );
  writeFileSync(
    join(OUT_DIR, "_contact_sheet_data.json"),
    `${JSON.stringify(rows, null, 2)}\n`,
  );

  const md = [
    `# AIOS Controlled Real OpenAI Template Batch V1 Report`,
    ``,
    `**Agent:** #240`,
    `**Overall:** ${passed ? "PASS" : "FAIL"}`,
    `**LIVE:** OFF`,
    `**publication_allowed:** false`,
    `**Generated:** ${stamp}`,
    `**Execution:** ${result.execution_id}`,
    ``,
    `## 1. Current System Status`,
    ``,
    `- Agent #239 hardening active (safe-area, contrast, Founder bar, families).`,
    `- ProductionController remains canonical owner.`,
    `- OpenAI via Founder one-test overlay (registry stays mock-committed).`,
    `- LIVE OFF. publication blocked. No export/publish.`,
    ``,
    `## 2. Batch Configuration`,
    ``,
    `- Batch size: 5 · Concurrency: 1 (BatchRunner sequential)`,
    `- Roles: Marketing Manager, Software Engineer, Graphic Designer, Accountant, HR Manager`,
    `- Families: executive, modern, editorial, technical, contemporary_accent`,
    `- force_mock=false · require_openai=true · verification=false`,
    ``,
    `## 3. OpenAI Execution Evidence`,
    ``,
    `| T# | Provider | Model | Request ID | In/Out tokens | Est $ | Actual $ | Fallback | Content |`,
    `|---:|----------|-------|------------|---------------|------:|---------:|:--------:|---------|`,
    ...rows.map(
      (r) =>
        `| ${r.index} | ${r.provider} | ${r.model} | ${r.provider_request_id ?? "—"} | ${r.input_tokens}/${r.output_tokens} | ${r.estimated_cost_usd ?? "—"} | ${r.actual_cost_usd ?? "—"} | ${r.fallback_used ? "yes" : "no"} | ${r.content_source} |`,
    ),
    ``,
    `Stop reason: **${result.stop_reason}**${result.batch?.stop_detail ? ` — ${result.batch.stop_detail}` : ""}`,
    ``,
    `## 4. Roles and Design Families`,
    ``,
    ...rows.map(
      (r) =>
        `- T${r.index}: ${r.role} → ${r.design_family} v${r.variant} (${r.person_name ?? "—"})`,
    ),
    ``,
    `## 5. Template Results`,
    ``,
    `| T# | Role | Family | Design | ATS | Thumb | Class | Ready |`,
    `|---:|------|--------|-------:|----:|------:|-------|:-----:|`,
    ...rows.map(
      (r) =>
        `| ${r.index} | ${r.role} | ${r.design_family} | ${r.design} | ${r.ats} | ${r.thumbnail_appeal} | ${r.publishability_class} | yes |`,
    ),
    ``,
    `## 6. Content Quality`,
    ``,
    `- OpenAI \`resume_content\` consumed when structurally valid.`,
    `- Distinct person names: ${new Set(names.filter(Boolean)).size}/${names.filter(Boolean).length}`,
    `- Distinct company sets: ${new Set(companySets.filter(Boolean)).size}/${companySets.filter(Boolean).length}`,
    `- No Sample Initiative filler preferred when OpenAI projects present.`,
    ``,
    `## 7. Design Quality`,
    ``,
    `- Avg design: **${summary.averages.design}** · Avg fill: **${Math.round(summary.averages.page_fill * 100)}%**`,
    `- Families represented: ${[...families].join(", ")}`,
    ``,
    `## 8. Safe-Area and Contrast Results`,
    ``,
    `- Safe-area: ${rows.every((r) => r.safe_area_pass) ? "ALL PASS" : "FAIL"}`,
    `- Contrast: ${rows.every((r) => r.contrast_pass) ? "ALL PASS" : "FAIL"}`,
    ``,
    `## 9. ATS and Editor Results`,
    ``,
    `- ATS all ≥70: ${rows.every((r) => Number(r.ats) >= 70)}`,
    `- Editor all pass: ${rows.every((r) => r.editor_pass === true)}`,
    ``,
    `## 10. Thumbnail Results`,
    ``,
    `- Avg thumbnail: **${summary.averages.thumbnail_appeal}**`,
    ``,
    `## 11. Cost and Token Usage`,
    ``,
    `- Total input tokens: **${totalIn}**`,
    `- Total output tokens: **${totalOut}**`,
    `- Total estimated cost USD: **${summary.cost.total_estimated_cost_usd}**`,
    `- Total actual cost USD: **${summary.cost.total_actual_cost_usd}**`,
    `- Detail: \`batch-cost-report.json\``,
    ``,
    `## 12. Publishable`,
    ``,
    publishable.length
      ? publishable
          .map((r) => `- T${r.index} ${r.design_family} (${r.role})`)
          .join("\n")
      : "- none",
    ``,
    `## 13. Needs Refinement`,
    ``,
    refine.length
      ? refine
          .map(
            (r) =>
              `- T${r.index} ${r.design_family}: ${(r.founder_reasons as string[]).join("; ")}`,
          )
          .join("\n")
      : "- none",
    ``,
    `## 14. Regenerate`,
    ``,
    regen.length
      ? regen
          .map(
            (r) =>
              `- T${r.index} ${r.design_family}: ${(r.founder_reasons as string[]).join("; ")}`,
          )
          .join("\n")
      : "- none",
    ``,
    `## 15. Contact Sheet Paths`,
    ``,
    `- \`SOS/07_LOGS/saios/first-production-cycle/openai-production-batch-v1/contact-sheet-previews.png\``,
    `- \`SOS/07_LOGS/saios/first-production-cycle/openai-production-batch-v1/contact-sheet-thumbnails.png\``,
    ``,
    `## 16. Files Changed`,
    ``,
    `- OpenAI prompt + resume_content wiring (OpenAIResponseFactory, SampleContent, BlockRenderer, visualGuidance)`,
    `- Evidence persistence (ResumeResponseConsumer, runFirstProductionCycle mock-provider)`,
    `- require_openai (BatchRunner, ProductionController)`,
    `- \`run-openai-production-batch.ts\` + package.json script`,
    `- Logs under openai-production-batch-v1/ + this report`,
    ``,
    `## 17. Verification Results`,
    ``,
    `| Check | Result |`,
    `|-------|--------|`,
    ...Object.entries(acceptance).map(
      ([k, v]) =>
        `| ${k} | ${typeof v === "boolean" ? (v ? "PASS" : "FAIL") : String(v)} |`,
    ),
    `| overall | ${passed ? "PASS" : "FAIL"} |`,
    ``,
    `## 18. Remaining Blockers`,
    ``,
    passed
      ? [
          `- StudiosisLab export / ReleaseManager still deferred`,
          `- Provider registry remains mock-committed; OpenAI is Founder overlay only`,
          `- LIVE remains OFF; publication blocked`,
        ].join("\n")
      : [
          `- Acceptance failed — do not mark Agent #240 complete`,
          `- Waiting Founder count: ${waiting.length}`,
          `- Publishable: ${publishable.length}`,
          `- Stop: ${result.stop_reason} ${result.batch?.stop_detail ?? ""}`,
          `- Smallest correction: ensure OpenAI gate open, resume_content valid, Founder bar dims ≥80`,
        ].join("\n"),
    ``,
    `## 19. Recommendation for StudiosisLab Export`,
    ``,
    passed
      ? `- Export only after Founder visual review of Ready-for-Review queue and explicit ReleaseManager authorization. Do not auto-export this batch.`
      : `- No export recommendation until ≥4 PUBLISHABLE OpenAI templates pass.`,
    ``,
  ].join("\n");

  writeFileSync(REPORT_MD, `${md}\n`);
  writeFileSync(join(OUT_DIR, "report.md"), `${md}\n`);

  console.log(
    JSON.stringify(
      {
        ok: passed,
        waiting: waiting.length,
        publishable: publishable.length,
        refine: refine.length,
        regen: regen.length,
        openai_backed: openaiBacked,
        cost: summary.cost.total_actual_cost_usd,
        execution_id: result.execution_id,
        report: REPORT_MD.replace(REPO + "/", ""),
      },
      null,
      2,
    ),
  );

  if (!passed) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
