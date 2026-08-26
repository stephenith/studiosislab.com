/**
 * Agent #234 — verify first real Resume Template artifacts (no new OpenAI call).
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { CYCLE_LOG } from "./runFirstProductionCycle.js";
import { loadWaitingCandidatesFromRegistry } from "../../dashboard/src/data/buildFounderReviewQueue.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const RECORD = join(
  CYCLE_LOG,
  "first-real-resume-template/first-real-resume-template.json",
);

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function main(): void {
  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE OFF");
  assert(existsSync(RECORD), `missing ${RECORD} — run aios:first-real-template:run first`);
  const rec = JSON.parse(readFileSync(RECORD, "utf8")) as {
    overall: string;
    openai_executed: boolean;
    provider: string;
    template_id: string;
    candidate_id: string;
    candidate_dir: string;
    ats_score: number;
    critic_score: number;
    editor_compatibility: string;
    preview: boolean;
    thumbnail: boolean;
    publication_allowed: boolean;
    live: boolean;
  };

  assert(rec.overall === "PASS", "record overall");
  assert(rec.openai_executed === true, "openai_executed");
  assert(rec.provider === "openai", "provider openai");
  assert(rec.publication_allowed === false, "publication");
  assert(rec.live === false, "live");
  assert(rec.preview === true && rec.thumbnail === true, "preview/thumb flags");
  assert(rec.ats_score >= 90, "ATS");
  assert(rec.critic_score >= 90, "critic");
  assert(rec.editor_compatibility === "PASS", "editor");

  const dir = join(REPO, rec.candidate_dir);
  assert(existsSync(join(dir, "preview.png")), "preview file");
  assert(existsSync(join(dir, "thumbnail.png")), "thumbnail file");
  assert(existsSync(join(dir, "canvas.json")), "canvas");
  assert(existsSync(join(dir, "resume-template.json")), "resume-template");
  assert(!dir.includes("candidates-verify"), "production registry");

  const manifest = JSON.parse(
    readFileSync(join(dir, "candidate.json"), "utf8"),
  ) as { provider: string; status: string; verification_artifact?: boolean };
  assert(manifest.provider === "openai", "manifest provider");
  assert(manifest.status === "WAITING_FOUNDER", "WAITING_FOUNDER");
  assert(manifest.verification_artifact !== true, "not verify artifact");

  const queue = loadWaitingCandidatesFromRegistry(REPO);
  assert(
    queue.some((q) => q.candidate_id === rec.candidate_id),
    "in Templates Ready for Review",
  );

  const report = join(
    REPO,
    "SOS/09_REPORTS/AIOS_FIRST_REAL_RESUME_TEMPLATE_V1_REPORT.md",
  );
  assert(existsSync(report), "report md");

  console.log(
    JSON.stringify(
      {
        ok: true,
        agent: "234",
        template_id: rec.template_id,
        provider: rec.provider,
        ats_score: rec.ats_score,
        critic_score: rec.critic_score,
        in_review_templates: true,
        live: false,
        publication_allowed: false,
      },
      null,
      2,
    ),
  );
  console.log("PASS aios:first-real-template:verify");
}

main();
