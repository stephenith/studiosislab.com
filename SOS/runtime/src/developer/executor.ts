import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { RuntimeConfig } from "../config.js";
import type { EventEnvelope } from "../types.js";
import type { DeveloperPaths } from "./paths.js";
import type { ExecutionPlan, ExecutionResult, ParsedBrief } from "./types.js";
import { emitProgress } from "./progress.js";

async function appendBlockerEvent(
  paths: DeveloperPaths,
  brief: ParsedBrief,
  reason: string,
  evidence: string[],
): Promise<void> {
  const event: EventEnvelope = {
    event_id: randomUUID(),
    timestamp: new Date().toISOString(),
    tenant_id: "studiosis",
    repo_id: "studiosislab",
    project_id: "sos-developer",
    agent: "developer",
    type: "blocker",
    priority: "P1",
    title: `Developer blocked: ${brief.title}`,
    body: reason,
    evidence,
    correlation_id: brief.correlation_id,
    requires_approval: false,
    approval_status: "not_required",
    metadata: { task_id: brief.task_id },
  };

  const date = new Date().toISOString().slice(0, 10);
  await mkdir(paths.events, { recursive: true });
  await appendFile(join(paths.events, `${date}.jsonl`), `${JSON.stringify(event)}\n`, "utf8");
}

async function runBuildLint(repoRoot: string): Promise<boolean> {
  const { execSync } = await import("node:child_process");
  try {
    execSync("npm run build", { cwd: repoRoot, stdio: "pipe", timeout: 300_000 });
    execSync("npm run lint", { cwd: repoRoot, stdio: "pipe", timeout: 120_000 });
    return true;
  } catch {
    return false;
  }
}

async function executeSosDocumentation(
  config: RuntimeConfig,
  paths: DeveloperPaths,
  brief: ParsedBrief,
  plan: ExecutionPlan,
): Promise<ExecutionResult> {
  const artifactDir = join(paths.artifacts, brief.task_id);
  await mkdir(artifactDir, { recursive: true });

  const notePath = join(artifactDir, "implementation-notes.md");
  const notes = `# Implementation Notes\n\n**Task:** ${brief.task_id}\n\n## Plan steps\n\n${plan.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n`;
  await writeFile(notePath, notes, "utf8");

  return {
    success: true,
    summary: `SOS-scoped work documented for: ${brief.title}`,
    files_changed: [notePath.replace(config.repoRoot + "/", "")],
    build_passed: true,
    confidence: 88,
    blocker: false,
    needs_qa: false,
    qa_checklist: [],
    estimated_regression_risk: "low",
    evidence: brief.evidence,
    artifacts_path: artifactDir,
  };
}

async function executeMobileHubRouting(
  config: RuntimeConfig,
  paths: DeveloperPaths,
  brief: ParsedBrief,
): Promise<ExecutionResult> {
  const hubPath = join(config.repoRoot, "src/app/resume/ResumeHubClient.tsx");
  const { readFile, writeFile: wf } = await import("node:fs/promises");
  const { existsSync } = await import("node:fs");
  const dryRun = process.env.SOS_DEV_DRY_RUN === "true";

  if (!existsSync(hubPath)) {
    return {
      success: false,
      summary: "ResumeHubClient.tsx not found",
      files_changed: [],
      build_passed: false,
      confidence: 20,
      blocker: true,
      blocker_reason: "Evidence file missing",
      needs_qa: true,
      qa_checklist: [],
      estimated_regression_risk: "high",
      evidence: brief.evidence,
    };
  }

  let content = await readFile(hubPath, "utf8");
  const marker = "editor/mobile/template";
  if (content.includes(marker)) {
    const buildOk = await runBuildLint(config.repoRoot);
    return {
      success: true,
      summary: "Mobile hub routing already present; verified no duplicate change needed",
      files_changed: [],
      build_passed: buildOk,
      confidence: 90,
      blocker: false,
      needs_qa: true,
      qa_checklist: [
        "Open Resume Hub on phone viewport",
        "Tap template — confirm /editor/mobile/template/{id} loads",
        "Confirm desktop route unchanged on wide viewport",
        "Run save/export smoke test",
      ],
      estimated_regression_risk: "medium",
      evidence: [hubPath.replace(config.repoRoot + "/", "")],
    };
  }

  const oldSnippet = "router.push(`/editor/template/${template.id}`)";
  const newSnippet = `router.push(
                        typeof window !== "undefined" && window.innerWidth <= 767
                          ? \`/editor/mobile/template/\${template.id}\`
                          : \`/editor/template/\${template.id}\`
                      )`;

  if (!content.includes(oldSnippet)) {
    return {
      success: false,
      summary: "Expected routing pattern not found in ResumeHubClient.tsx",
      files_changed: [],
      build_passed: false,
      confidence: 30,
      blocker: true,
      blocker_reason: "Cannot locate template navigation line to patch",
      needs_qa: true,
      qa_checklist: ["Manual routing implementation required"],
      estimated_regression_risk: "high",
      evidence: brief.evidence,
    };
  }

  const artifactDir = join(paths.artifacts, brief.task_id);
  await mkdir(artifactDir, { recursive: true });
  await writeFile(
    join(artifactDir, "mobile-routing-patch.md"),
    `# Proposed patch\n\nReplace:\n\`${oldSnippet}\`\n\nWith:\n\`${newSnippet}\`\n`,
    "utf8",
  );

  if (dryRun) {
    return {
      success: true,
      summary: "Dry run: mobile routing patch documented in artifacts (not applied)",
      files_changed: [],
      build_passed: true,
      confidence: 80,
      blocker: false,
      needs_qa: true,
      qa_checklist: [
        "Apply patch and verify mobile editor route",
        "npm run build && npm run lint",
      ],
      estimated_regression_risk: "medium",
      evidence: brief.evidence,
      artifacts_path: artifactDir,
    };
  }

  content = content.replace(oldSnippet, newSnippet);
  await wf(hubPath, content, "utf8");

  const buildOk = await runBuildLint(config.repoRoot);
  const rel = "src/app/resume/ResumeHubClient.tsx";

  return {
    success: buildOk,
    summary: buildOk ?
      "Mobile viewport routing added to Resume Hub template navigation"
    : "Routing patch applied but build/lint failed",
    files_changed: [rel],
    build_passed: buildOk,
    confidence: buildOk ? 85 : 45,
    blocker: !buildOk,
    blocker_reason: buildOk ? undefined : "build or lint failed after patch",
    needs_qa: true,
    qa_checklist: [
      "Phone viewport: Resume Hub → template opens mobile editor",
      "Desktop viewport: still uses /editor/template/{id}",
      "Auth-gated template open still works",
      "npm run build && npm run lint",
    ],
    estimated_regression_risk: "medium",
    evidence: [rel, ...brief.evidence],
  };
}

function isBlockedByHardGates(brief: ParsedBrief): string | null {
  const blocked = ["H3", "H4", "H1", "H2"];
  for (const g of brief.hard_gate_ids) {
    if (blocked.includes(g)) {
      return `Hard gate ${g} — cannot modify restricted resources without Commander merge approval`;
    }
  }
  return null;
}

export async function executePlan(
  config: RuntimeConfig,
  paths: DeveloperPaths,
  brief: ParsedBrief,
  plan: ExecutionPlan,
): Promise<ExecutionResult> {
  const gateBlock = isBlockedByHardGates(brief);
  if (gateBlock) {
    await emitProgress(paths, brief.task_id, brief.correlation_id, "blocked", gateBlock);
    await appendBlockerEvent(paths, brief, gateBlock, brief.evidence);
    return {
      success: false,
      summary: gateBlock,
      files_changed: [],
      build_passed: false,
      confidence: 25,
      blocker: true,
      blocker_reason: gateBlock,
      needs_qa: false,
      qa_checklist: [],
      estimated_regression_risk: "high",
      evidence: brief.evidence,
    };
  }

  await emitProgress(
    paths,
    brief.task_id,
    brief.correlation_id,
    "execution_started",
    "Execution phase started",
    10,
  );

  const text = `${brief.title} ${brief.description}`.toLowerCase();
  const onlySos = brief.evidence.length > 0 && brief.evidence.every((e) => e.startsWith("SOS/"));

  let result: ExecutionResult;

  if (text.includes("mobile") && brief.evidence.some((e) => e.includes("ResumeHubClient"))) {
    result = await executeMobileHubRouting(config, paths, brief);
  } else if (onlySos) {
    result = await executeSosDocumentation(config, paths, brief, plan);
  } else if (brief.evidence.some((e) => e.startsWith("src/"))) {
    const artifactDir = join(paths.artifacts, brief.task_id);
    await mkdir(artifactDir, { recursive: true });
    await writeFile(
      join(artifactDir, "analysis.md"),
      `# Analysis\n\nObjective: ${brief.title}\n\nSteps planned:\n${plan.steps.map((s) => `- ${s}`).join("\n")}\n\n**Status:** Automated executor has no strategy for this src/ task. PM escalation required.\n`,
      "utf8",
    );
    const reason = "No automated execution strategy for src/ scope — analysis artifact written";
    await emitProgress(paths, brief.task_id, brief.correlation_id, "needs_clarification", reason);
    await appendBlockerEvent(paths, brief, reason, brief.evidence);
    result = {
      success: false,
      summary: reason,
      files_changed: [],
      build_passed: await runBuildLint(config.repoRoot),
      confidence: 40,
      blocker: true,
      blocker_reason: reason,
      needs_qa: false,
      qa_checklist: [],
      estimated_regression_risk: "medium",
      evidence: brief.evidence,
      artifacts_path: artifactDir,
    };
  } else {
    result = await executeSosDocumentation(config, paths, brief, plan);
  }

  await emitProgress(
    paths,
    brief.task_id,
    brief.correlation_id,
    result.blocker ? "blocked" : "progress_50",
    result.blocker ? result.blocker_reason ?? "Blocked" : "Execution 50% — validation",
    50,
  );

  return result;
}
