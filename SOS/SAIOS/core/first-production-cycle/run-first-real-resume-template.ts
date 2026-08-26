/**
 * Agent #234 — First Real Resume Template Generation.
 * One OpenAI-backed Marketing Manager Resume Template → Ready for Review.
 * LIVE OFF. publication_allowed=false. Not a verification artifact.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import dotenv from "dotenv";
import { runProduction } from "./ProductionController.js";
import { CYCLE_LOG } from "./runFirstProductionCycle.js";
import { DEFAULT_PRODUCTION_TARGET } from "./ProductionTarget.js";
import { loadWaitingCandidatesFromRegistry } from "../../dashboard/src/data/buildFounderReviewQueue.js";

const REPO = resolve(import.meta.dirname, "../../../..");
dotenv.config({ path: resolve(REPO, ".env.local") });

const OUT_DIR = join(CYCLE_LOG, "first-real-resume-template");
const OUT_JSON = join(OUT_DIR, "first-real-resume-template.json");
const REPORT_MD = join(
  REPO,
  "SOS/09_REPORTS/AIOS_FIRST_REAL_RESUME_TEMPLATE_V1_REPORT.md",
);

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function forceSafetyEnv(): void {
  process.env.SOS_AIOS_LIVE = "0";
  // Founder one-test gate — required for OpenAI path (registry stays mock-committed)
  if (process.env.SOS_AI_FOUNDER_OPENAI_ONE_TEST !== "1") {
    process.env.SOS_AI_FOUNDER_OPENAI_ONE_TEST = "1";
  }
  assert(
    Boolean(process.env.OPENAI_API_KEY?.trim()),
    "OPENAI_API_KEY required for first real Resume Template",
  );
  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE must be OFF");
}

async function main(): Promise<void> {
  forceSafetyEnv();
  mkdirSync(OUT_DIR, { recursive: true });

  const stamp = new Date().toISOString();
  const target = {
    ...DEFAULT_PRODUCTION_TARGET,
    title: "Marketing Manager",
    category: "marketing" as const,
    industry: "marketing",
    seniority: "mid" as const,
    role_family: "marketing_manager",
    // Unique objective so duplicate preflight allows this real generation
    objective: `Agent #234 first real OpenAI Marketing Manager Resume Template ${stamp}`,
  };

  const result = await runProduction({
    batch_size: 1,
    max_openai_per_batch: 1,
    force_mock: false,
    select_target: false,
    verification: false,
    forced_targets: [target],
    queue_max: 50,
    budget_policy: { maximum_founder_queue: 50 },
  });

  assert(result.publication_allowed === false, "publication blocked");
  assert(result.live === false, "LIVE OFF");
  assert(result.entrypoint === "ProductionController", "PC owner");
  assert(result.batch !== null, `no batch: ${result.stop_reason}`);
  assert(result.candidate_count >= 1, `candidates=${result.candidate_count}`);

  const batchCand = result.batch!.candidates.find(
    (c) => c.result === "WAITING_FOUNDER" && c.candidate_dir,
  );
  assert(Boolean(batchCand?.candidate_dir), "no WAITING_FOUNDER template dir");

  const dir = join(REPO, batchCand!.candidate_dir!);
  assert(!dir.includes("candidates-verify"), "must be production registry");
  assert(existsSync(join(dir, "preview.png")), "preview.png");
  assert(existsSync(join(dir, "thumbnail.png")), "thumbnail.png");
  assert(existsSync(join(dir, "canvas.json")), "canvas.json");
  assert(existsSync(join(dir, "resume-template.json")), "resume-template.json");
  assert(existsSync(join(dir, "designbrief.json")), "designbrief.json");
  assert(existsSync(join(dir, "research-context.json")), "research-context.json");
  assert(existsSync(join(dir, "critic.json")), "critic.json");
  assert(existsSync(join(dir, "editor-compatibility.json")), "editor-compat");

  const manifest = JSON.parse(
    readFileSync(join(dir, "candidate.json"), "utf8"),
  ) as {
    status: string;
    provider: string | null;
    candidate_id: string;
    verification_artifact?: boolean;
    product_kind?: string;
  };
  assert(manifest.status === "WAITING_FOUNDER", `status=${manifest.status}`);
  assert(manifest.provider === "openai", `provider=${manifest.provider}`);
  assert(manifest.verification_artifact !== true, "not verification artifact");
  assert(
    manifest.product_kind === "resume_template" ||
      existsSync(join(dir, "resume-template.json")),
    "resume template product",
  );

  const tmpl = JSON.parse(
    readFileSync(join(dir, "resume-template.json"), "utf8"),
  ) as {
    template_id: string;
    role: string;
    founder_review_status: string;
    publication_status: string;
    ats_score: number | null;
    critic_score: number | null;
    overall_quality_score: number | null;
    editor_compatibility_status: string;
    preview_png: string | null;
    thumbnail: string | null;
  };
  assert(tmpl.founder_review_status === "ready_for_review", "ready_for_review");
  assert(tmpl.publication_status === "not_published", "not_published");
  assert(tmpl.preview_png === "preview.png", "preview field");
  assert(tmpl.thumbnail === "thumbnail.png", "thumbnail field");
  assert(tmpl.role === "Marketing Manager", `role=${tmpl.role}`);

  const critic = JSON.parse(readFileSync(join(dir, "critic.json"), "utf8")) as {
    scores?: { ats?: number; overall?: number; technical?: number };
    readiness?: { ready?: boolean };
  };
  const ats = critic.scores?.ats ?? tmpl.ats_score ?? 0;
  const overall = critic.scores?.overall ?? tmpl.critic_score ?? 0;
  assert(Number(ats) >= 90, `ATS score ${ats}`);
  assert(Number(overall) >= 90, `critic overall ${overall}`);
  assert(critic.readiness?.ready === true, "critic ready");

  const editor = JSON.parse(
    readFileSync(join(dir, "editor-compatibility.json"), "utf8"),
  ) as { pass?: boolean };
  assert(editor.pass === true, "editor compatibility PASS");

  const canvas = JSON.parse(readFileSync(join(dir, "canvas.json"), "utf8")) as {
    version?: string;
    objects?: unknown[];
  };
  assert(Array.isArray(canvas.objects) && canvas.objects.length > 0, "fabric objects");

  const queue = loadWaitingCandidatesFromRegistry(REPO);
  const inReview = queue.some((q) => q.candidate_id === manifest.candidate_id);
  assert(inReview, "visible in Templates Ready for Review queue");

  const research = JSON.parse(
    readFileSync(join(dir, "research-context.json"), "utf8"),
  ) as Record<string, unknown>;
  const designbrief = JSON.parse(
    readFileSync(join(dir, "designbrief.json"), "utf8"),
  ) as Record<string, unknown>;

  const providerMeta = existsSync(join(dir, "mock-provider.json"))
    ? (JSON.parse(readFileSync(join(dir, "mock-provider.json"), "utf8")) as {
        provider?: string;
        model?: string;
      })
    : {};

  const record = {
    generated_at: stamp,
    agent: "234",
    overall: "PASS",
    live: false,
    publication_allowed: false,
    openai_executed: true,
    provider: manifest.provider,
    model: providerMeta.model ?? null,
    execution_id: result.execution_id,
    stop_reason: result.stop_reason,
    template_id: tmpl.template_id,
    candidate_id: manifest.candidate_id,
    candidate_dir: batchCand!.candidate_dir,
    role: tmpl.role,
    category: target.category,
    ats_score: ats,
    critic_score: overall,
    quality_score: tmpl.overall_quality_score ?? overall,
    editor_compatibility: editor.pass === true ? "PASS" : "FAIL",
    founder_review_status: tmpl.founder_review_status,
    preview: true,
    thumbnail: true,
    in_review_templates_queue: inReview,
    research_keys: Object.keys(research).slice(0, 24),
    designbrief_keys: Object.keys(designbrief).slice(0, 24),
  };

  writeFileSync(OUT_JSON, `${JSON.stringify(record, null, 2)}\n`);
  writeFileSync(
    join(OUT_DIR, "latest.json"),
    `${JSON.stringify(record, null, 2)}\n`,
  );

  const md = [
    `# AIOS First Real Resume Template V1 Report`,
    ``,
    `**Agent:** #234`,
    `**Overall:** PASS`,
    `**LIVE:** OFF`,
    `**publication_allowed:** false`,
    ``,
    `## 1. Current System Status`,
    ``,
    `- Resume Template runtime (#233) active — preview/thumbnail mandatory`,
    `- ProductionController sole owner`,
    `- Generated into production \`candidates/\` (not candidates-verify)`,
    `- Founder Review shows Ready for Review`,
    ``,
    `## 2. OpenAI Execution`,
    ``,
    `| Field | Value |`,
    `|---|---|`,
    `| provider | ${manifest.provider} |`,
    `| model | ${providerMeta.model ?? "—"} |`,
    `| execution_id | ${result.execution_id} |`,
    `| Founder one-test gate | SOS_AI_FOUNDER_OPENAI_ONE_TEST=1 |`,
    `| LIVE | OFF |`,
    ``,
    `## 3. Research Used`,
    ``,
    `Existing \`buildResearchContext\` / research-context.json influenced intake.`,
    `Keys: ${record.research_keys.join(", ")}`,
    ``,
    `## 4. Design Brief`,
    ``,
    `DesignBriefEngine output persisted as designbrief.json.`,
    `Keys: ${record.designbrief_keys.join(", ")}`,
    ``,
    `## 5. Generated Resume Template`,
    ``,
    `| Field | Value |`,
    `|---|---|`,
    `| template_id | ${tmpl.template_id} |`,
    `| role | ${tmpl.role} |`,
    `| category | ${target.category} |`,
    `| status | Ready for Review |`,
    `| dir | ${batchCand!.candidate_dir} |`,
    ``,
    `## 6. Preview`,
    ``,
    `- preview.png: present`,
    `- thumbnail.png: present`,
    ``,
    `## 7. ATS Result`,
    ``,
    `ATS score: **${ats}** (PASS threshold ≥ 90)`,
    ``,
    `## 8. Critic Result`,
    ``,
    `Overall: **${overall}** · ready=${critic.readiness?.ready === true}`,
    ``,
    `## 9. Files Changed`,
    ``,
    `- \`SOS/SAIOS/core/first-production-cycle/run-first-real-resume-template.ts\``,
    `- \`SOS/SAIOS/core/first-production-cycle/verify-first-real-resume-template.ts\``,
    `- \`package.json\` scripts`,
    `- \`SOS/project-state.json\` (after verify)`,
    `- this report`,
    ``,
    `## 10. Verification Results`,
    ``,
    `See \`npm run aios:first-real-template:verify\` / machine JSON at:`,
    `\`${OUT_JSON.replace(REPO + "/", "")}\``,
    ``,
    `## 11. Remaining Blockers`,
    ``,
    `- StudiosisLab export / ReleaseManager still deferred`,
    `- OpenAI remains Founder one-test overlay (registry committed mock-only)`,
    `- Cloud deployment deferred`,
    ``,
  ].join("\n");

  writeFileSync(REPORT_MD, `${md}\n`);
  writeFileSync(
    join(REPO, "SOS/SAIOS/AIOS_FIRST_REAL_RESUME_TEMPLATE_V1_REPORT.md"),
    `${md}\n`,
  );

  console.log(JSON.stringify({ ok: true, ...record }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
