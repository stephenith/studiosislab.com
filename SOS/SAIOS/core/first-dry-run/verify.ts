/**
 * Verify first complete AIOS dry run — Agent #124.
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { runFirstDryRun } from "./runFirstDryRun.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const LOG = join(REPO, "SOS/07_LOGS/saios/first-dry-run");
const REPORT = join(REPO, "SOS/09_REPORTS/AIOS_FIRST_DRY_RUN_REPORT.md");
const PKG = join(REPO, "package.json");

async function main() {
  mkdirSync(LOG, { recursive: true });

  if (process.env.SOS_AIOS_LIVE === "1") {
    console.error("LIVE must be OFF");
    process.exit(1);
  }

  const run = await runFirstDryRun();

  const required = [
    "execution-timeline.json",
    "execution-graph.json",
    "knowledge-used.json",
    "skill-used.json",
    "provider-response.json",
    "qa-summary.json",
    "founder-review.json",
    "dashboard-update.json",
    "readiness.json",
  ];
  const filesOk = required.every((f) => existsSync(join(LOG, f)));

  const timeline = JSON.parse(
    readFileSync(join(LOG, "execution-timeline.json"), "utf8"),
  );
  const dash = JSON.parse(
    readFileSync(join(LOG, "dashboard-update.json"), "utf8"),
  );
  const founder = JSON.parse(
    readFileSync(join(LOG, "founder-review.json"), "utf8"),
  );
  const qa = JSON.parse(readFileSync(join(LOG, "qa-summary.json"), "utf8"));
  const actionQueue = JSON.parse(
    readFileSync(
      join(REPO, "SOS/07_LOGS/saios/founder-control-center/founder-action-queue.json"),
      "utf8",
    ),
  );

  const pkg = JSON.parse(readFileSync(PKG, "utf8"));
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const noSdk = !("openai" in deps) && !("@anthropic-ai/sdk" in deps);

  const stages = (timeline.timeline as Array<{ stage: string }>).map(
    (e) => e.stage,
  );

  const checks = {
    scheduler_executed: run.checks.scheduler_executed && stages.includes("scheduler"),
    queue_executed: run.checks.queue_executed && stages.includes("queue"),
    resume_department_executed: stages.includes("resume_department"),
    knowledge_loaded: stages.includes("knowledge") && run.checks.knowledge_loaded,
    snapshot_built: stages.includes("snapshot") && run.checks.snapshot_built,
    brain_gateway_executed: stages.includes("brain_gateway"),
    brain_router_executed: stages.includes("brain_router"),
    mock_provider_executed: stages.includes("mock_provider"),
    structured_response_received: stages.includes("structured_response"),
    deterministic_qa_executed: stages.includes("qa") && qa.deterministic === true,
    founder_queue_updated:
      stages.includes("founder_review") &&
      actionQueue.actions?.some((a: { id: string }) => a.id === founder.id),
    dashboard_artifacts_updated:
      filesOk &&
      dash.mission_control?.current_cycle?.id === run.task_id &&
      dash.mission_control?.current_cycle?.founder_review_pending === true,
    no_template_generated: dash.template_generated === false,
    no_publication: dash.published === false,
    no_openai: noSdk,
    live_off: process.env.SOS_AIOS_LIVE !== "1" && dash.live === false,
  };

  const overall = Object.values(checks).every(Boolean) && run.overall === "PASS";

  // Refresh readiness with verify checks
  writeFileSync(
    join(LOG, "readiness.json"),
    `${JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        agent: "124",
        status: overall ? "completed" : "blocked",
        task_id: run.task_id,
        checks,
        overall: overall ? "PASS" : "FAIL",
        templates_generated: 0,
        publications: 0,
        api_calls: 0,
        live_enabled: false,
      },
      null,
      2,
    )}\n`,
  );

  const report = `# AIOS First Dry Run Report

**Agent:** #124  
**Generated:** ${new Date().toISOString()}  
**Overall:** ${overall ? "PASS" : "FAIL"}  
**Task:** \`${run.task_id}\`

## Flow

Scheduler → Queue → Resume → Knowledge → Snapshot → Brain Gateway → Skill → Brain Router → Mock → Response → QA → Founder Queue → Dashboard

## Timeline

${(timeline.timeline as Array<{ at: string; stage: string; summary: string }>)
  .map((e) => `- ${e.at} · **${e.stage}** — ${e.summary}`)
  .join("\n")}

## Mission Control fields

- Cycle: \`${dash.mission_control.current_cycle.id}\`
- Stage: ${dash.mission_control.current_cycle.stage}
- Skill: \`${dash.mission_control.current_cycle.skill_id}\`
- Domains: ${dash.mission_control.current_cycle.knowledge_domains.join(" → ")}
- Provider: ${dash.mission_control.current_cycle.provider}
- QA: ${dash.mission_control.current_cycle.qa_status}
- Founder review pending: **true**

## Constraints

- No template JSON
- No publication
- No OpenAI
- LIVE OFF

## Checks

| Check | Result |
|-------|--------|
${Object.entries(checks)
  .map(([k, v]) => `| ${k} | ${v ? "PASS" : "FAIL"} |`)
  .join("\n")}
`;
  writeFileSync(REPORT, `${report}\n`);

  console.log("First Dry Run Verify");
  console.log("====================");
  for (const [k, v] of Object.entries(checks)) {
    console.log(`${v ? "✔" : "✖"} ${k.replace(/_/g, " ")}`);
  }
  console.log("");
  console.log(`Task: ${run.task_id}`);
  console.log(`Founder review: ${founder.status}`);
  console.log(`LIVE: false`);
  console.log(`Overall: ${overall ? "PASS" : "FAIL"}`);

  process.exit(overall ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
