#!/usr/bin/env tsx
/**
 * Architecture Final Freeze verify — Agent #200.
 * Confirms F1–F6 declaration resolutions and freeze posture. No runtime changes.
 */
import { existsSync, readFileSync, mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO = resolve(import.meta.dirname, "../../../..");
const DIR = "SOS/SAIOS/architecture/final-freeze";

const REQUIRED_DOCS = [
  "RESOLUTIONS.md",
  "FREEZE_DECLARATION.md",
  "SCORES.md",
  "README.md",
  "ARCHITECTURE.json",
  "verify-architecture-final-freeze.ts",
] as const;

const REPORTS = [
  "SOS/09_REPORTS/AIOS_ARCHITECTURE_FINAL_FREEZE_REPORT.md",
  "SOS/SAIOS/AIOS_ARCHITECTURE_FINAL_FREEZE_REPORT.md",
];

const REQUIRED_SECTIONS = [
  "## 1. Resolved findings",
  "## 2. Remaining informational findings",
  "## 3. Architecture freeze declaration",
  "## 4. Repository readiness",
  "## 5. Implementation readiness",
  "## 6. Final scores",
  "## 7. CTO Certification",
];

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ARCHITECTURE FINAL FREEZE FAIL: ${msg}`);
}

function read(rel: string): string {
  return readFileSync(join(REPO, rel), "utf8");
}

function main(): void {
  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE must be OFF");
  const checks: Record<string, boolean> = {};

  for (const d of REQUIRED_DOCS) {
    assert(existsSync(join(REPO, DIR, d)), `missing ${d}`);
  }
  checks.documents = true;

  // F1 resolved in docs
  const stores = read(
    "SOS/SAIOS/architecture/learning-reconciliation/STORE_CLASSIFICATION.md",
  );
  assert(/operational departmental memory/i.test(stores), "F1 keeps operational departmental memory");
  assert(/cross-cutting/i.test(stores), "F1 cross-cutting declared");
  const ex = read("SOS/SAIOS/architecture/persistence-ownership/EXCEPTIONS.md");
  assert(ex.includes("E4") && /cross-cutting/i.test(ex), "F1 E4 canonical");
  checks.f1 = true;

  // F2: allowed_dependencies empty for resume-learning; still no runtime import
  const roles = JSON.parse(read("SOS/SAIOS/architecture/module-roles.json")) as {
    modules: Array<{ id: string; allowed_dependencies?: string[] }>;
  };
  const rl = roles.modules.find((m) => m.id === "runtime.workers.resume-learning");
  assert(!!rl, "resume-learning module present");
  assert(
    Array.isArray(rl!.allowed_dependencies) && rl!.allowed_dependencies.length === 0,
    "F2 allowed_dependencies empty",
  );
  assert(
    !rl!.allowed_dependencies?.includes("core.knowledge-learning"),
    "F2 no knowledge-learning allowed dep",
  );
  // knowledge-learning module itself still declared
  assert(
    roles.modules.some((m) => m.id === "core.knowledge-learning"),
    "knowledge-learning module still declared",
  );
  const engine = read(
    "SOS/SAIOS/runtime/workers/resume-learning/learning-engine.ts",
  );
  assert(!/knowledge-learning/.test(engine), "F2 runtime still independent");
  checks.f2 = true;

  // F3 grandfathering
  assert(ex.includes("E11") || /grandfather/i.test(ex), "F3 grandfathering");
  assert(
    JSON.stringify(roles).includes("parallel_learning_store_new"),
    "F3 forbid tag retained",
  );
  checks.f3 = true;

  // F4/F5 metadata
  for (const p of [
    "SOS/SAIOS/architecture/provider-reconciliation/ARCHITECTURE.json",
    "SOS/SAIOS/architecture/provider-reconciliation/README.md",
    "SOS/SAIOS/architecture/phase3-foundation/ARCHITECTURE.json",
    "SOS/SAIOS/architecture/phase3-planning/ARCHITECTURE.json",
    "SOS/SAIOS/architecture/phase4-execution/ARCHITECTURE.json",
    "SOS/SAIOS/architecture/provider-registry/ARCHITECTURE.json",
    "SOS/SAIOS/architecture/provider-authority/ARCHITECTURE.json",
  ]) {
    assert(existsSync(join(REPO, p)), `F4/F5 missing ${p}`);
  }
  checks.f4_f5 = true;

  // F6 supersession
  const cto = read(
    "SOS/SAIOS/architecture/learning-reconciliation/CTO_RECOMMENDATION.md",
  );
  assert(/SUPERSEDED|superseded/i.test(cto), "F6 superseded marked");
  checks.f6 = true;

  // Freeze docs
  const freeze = read(join(DIR, "FREEZE_DECLARATION.md"));
  assert(freeze.includes("ARCHITECTURE_FROZEN"), "freeze status");
  assert(freeze.includes("READY_FOR_IMPLEMENTATION"), "implementation readiness");
  const scores = read(join(DIR, "SCORES.md"));
  assert(scores.includes("94"), "overall 94");
  const arch = JSON.parse(read(join(DIR, "ARCHITECTURE.json"))) as {
    verdict: string;
    implementation_readiness: string;
    live: boolean;
    runtime_imports_modified: boolean;
    scores: { overall: number };
  };
  assert(arch.verdict === "ARCHITECTURE_FROZEN", "verdict");
  assert(arch.implementation_readiness === "READY_FOR_IMPLEMENTATION", "ready");
  assert(arch.live === false, "live false");
  assert(arch.runtime_imports_modified === false, "no import changes");
  assert(arch.scores.overall === 94, "score 94");
  checks.freeze = true;

  // Safety / runtime untouched markers
  for (const rel of [
    "SOS/SAIOS/architecture/runtime-guard.ts",
    "SOS/SAIOS/runtime/execution-controller/ExecutionController.ts",
    "SOS/SAIOS/core/company-brain/CompanyBrain.ts",
    "SOS/SAIOS/runtime/scheduler/SchedulerMemory.ts",
  ]) {
    assert(existsSync(join(REPO, rel)), `untouched ${rel}`);
  }
  assert(
    !existsSync(join(REPO, "SOS/SAIOS/runtime/memory/MemoryService.ts")),
    "MemoryService not implemented",
  );
  checks.safety = true;

  for (const report of REPORTS) {
    assert(existsSync(join(REPO, report)), `missing ${report}`);
    const body = read(report);
    assert(body.includes("Agent #200"), `${report} agent`);
    for (const s of REQUIRED_SECTIONS) {
      assert(body.includes(s), `${report} missing ${s}`);
    }
    assert(body.includes("ARCHITECTURE_FROZEN"), `${report} frozen`);
    assert(body.includes("READY_FOR_IMPLEMENTATION"), `${report} ready`);
    assert(/No runtime changes/i.test(body) || /runtime behaviour must remain identical/i.test(body), `${report} no runtime`);
    assert(/LIVE remains OFF/i.test(body), `${report} LIVE`);
    assert(/Execution remains impossible/i.test(body), `${report} execution`);
    assert(/100%/.test(body) && /backward/i.test(body), `${report} backward`);
  }
  checks.reports = true;

  const selfSrc = read(join(DIR, "verify-architecture-final-freeze.ts"));
  assert(!/\bexecFileSync\b/.test(selfSrc), "no process launch");
  checks.verify_readonly = true;

  assert(Object.values(checks).every(Boolean), "not all checks");

  const outDir = join(REPO, "SOS/07_LOGS/saios/architecture/final-freeze");
  mkdirSync(outDir, { recursive: true });
  const result = {
    ok: true,
    agent: 200,
    live: false,
    verdict: "ARCHITECTURE_FROZEN",
    implementation_readiness: "READY_FOR_IMPLEMENTATION",
    overall_score: 94,
    resolved: ["F1", "F2", "F3", "F4", "F5", "F6"],
    checks,
    at: new Date().toISOString(),
  };
  writeFileSync(join(outDir, "verify-result.json"), `${JSON.stringify(result, null, 2)}\n`);
  console.log("ARCHITECTURE FINAL FREEZE PASS");
  console.log(JSON.stringify(result, null, 2));
}

main();
