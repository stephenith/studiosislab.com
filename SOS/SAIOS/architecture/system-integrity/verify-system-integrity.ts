#!/usr/bin/env tsx
/**
 * System Integrity Certification verify — Agent #199.
 *
 * Repository-wide REFERENCE + CONSISTENCY checks only.
 * Does not repair architecture, modify runtime, or enable LIVE.
 */
import { existsSync, readFileSync, mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO = resolve(import.meta.dirname, "../../../..");
const INT_DIR = "SOS/SAIOS/architecture/system-integrity";

const REQUIRED_DOCS = [
  "FINDINGS.md",
  "SCORES.md",
  "INTEGRITY_MATRIX.md",
  "README.md",
  "ARCHITECTURE.json",
  "verify-system-integrity.ts",
] as const;

const REPORTS = [
  "SOS/09_REPORTS/AIOS_SYSTEM_INTEGRITY_CERTIFICATION_V1_REPORT.md",
  "SOS/SAIOS/AIOS_SYSTEM_INTEGRITY_CERTIFICATION_V1_REPORT.md",
];

const REQUIRED_REPORT_SECTIONS = [
  "## 1. Certification scope",
  "## 2. Architecture layers verified",
  "## 3. Authority integrity",
  "## 4. Persistence integrity",
  "## 5. Dependency integrity",
  "## 6. Verification script integrity",
  "## 7. Dashboard integrity",
  "## 8. Project-state integrity",
  "## 9. Safety integrity",
  "## 10. Findings",
  "## 11. System Integrity Score",
  "## 12. CTO Certification",
];

const ARCH_PACKAGES = [
  "phase3-foundation",
  "phase3-planning",
  "phase4-execution",
  "provider-registry",
  "provider-reconciliation",
  "provider-authority",
  "cost-authority",
  "execution-authority-model",
  "learning-reconciliation",
  "persistence-memory-topology",
  "persistence-ownership",
  "governance",
] as const;

const PRIMARY_SCRIPTS = [
  "phase3-foundation:verify",
  "phase3-planning:verify",
  "phase4-charter:verify",
  "provider-registry-charter:verify",
  "provider-reconciliation:verify",
  "provider-authority:verify",
  "cost-authority:verify",
  "execution-authority-model:verify",
  "learning-reconciliation:verify",
  "persistence-memory-topology:verify",
  "persistence-ownership:verify",
  "architecture-governance:verify",
  "platform:verify",
  "dashboard-platform:verify",
  "system-integrity:verify",
] as const;

const RUNTIME_UNTOUCHED = [
  "SOS/SAIOS/architecture/runtime-guard.ts",
  "SOS/SAIOS/core/company-brain/CompanyBrain.ts",
  "SOS/SAIOS/runtime/execution-controller/ExecutionController.ts",
  "SOS/SAIOS/runtime/scheduler/SchedulerMemory.ts",
  "SOS/SAIOS/runtime/worker-runtime/index.ts",
  "SOS/SAIOS/platform/department-sdk/index.ts",
  "SOS/SAIOS/core/knowledge/KnowledgeManager.ts",
  "SOS/SAIOS/core/knowledge-learning/LearningRepository.ts",
  "SOS/SAIOS/architecture/module-roles.json",
  "SOS/SAIOS/architecture/dependency-graph.json",
] as const;

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`SYSTEM INTEGRITY FAIL: ${msg}`);
}

function read(rel: string): string {
  return readFileSync(join(REPO, rel), "utf8");
}

function main(): void {
  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE must be OFF");
  const checks: Record<string, boolean> = {};

  for (const doc of REQUIRED_DOCS) {
    assert(existsSync(join(REPO, INT_DIR, doc)), `missing ${doc}`);
  }
  checks.documents = true;

  // Architecture layers present
  for (const pkg of ARCH_PACKAGES) {
    assert(
      existsSync(join(REPO, "SOS/SAIOS/architecture", pkg)),
      `missing architecture package ${pkg}`,
    );
  }
  for (const mod of [
    "SOS/SAIOS/runtime/activation-gate",
    "SOS/SAIOS/runtime/execution-authorization",
    "SOS/SAIOS/runtime/pre-dispatch-simulation",
    "SOS/SAIOS/platform/department-sdk",
    "SOS/SAIOS/runtime/execution-controller",
    "SOS/SAIOS/runtime/worker-runtime",
    "SOS/SAIOS/platform/telemetry",
    "SOS/SAIOS/platform/dashboard",
    "SOS/SAIOS/platform",
    "SOS/SAIOS/core/company-brain",
    "SOS/SAIOS/core/knowledge",
    "SOS/SAIOS/core/knowledge-learning",
  ]) {
    assert(existsSync(join(REPO, mod)), `missing module ${mod}`);
  }
  checks.layers = true;

  // Authority exclusivity (docs)
  const own197 = read(
    "SOS/SAIOS/architecture/persistence-ownership/OWNERSHIP_MODEL.md",
  );
  const auth198 = read("SOS/SAIOS/architecture/governance/AUTHORITIES.md");
  assert(own197.includes("core/knowledge"), "197 knowledge owner");
  assert(own197.includes("core/knowledge-learning"), "197 founder learning");
  assert(auth198.includes("core/knowledge"), "198 knowledge");
  assert(auth198.includes("core/knowledge-learning"), "198 founder learning");
  assert(
    auth198.includes("distributed") || auth198.includes("Distributed"),
    "198 distributed execution",
  );
  const exec194 = JSON.parse(
    read("SOS/SAIOS/architecture/execution-authority-model/ARCHITECTURE.json"),
  ) as { central_execution_authority: boolean; dispatch_after_controller: boolean };
  assert(exec194.central_execution_authority === false, "no central execution authority");
  assert(exec194.dispatch_after_controller === false, "no dispatch after controller");
  checks.authority = true;

  // Persistence
  const surfaces = JSON.parse(
    read("SOS/SAIOS/architecture/persistence-ownership/SURFACES.json"),
  ) as { surface_count: number; surfaces: Array<{ id: number; owner: string }> };
  assert(surfaces.surface_count === 42, "42 surfaces");
  assert(surfaces.surfaces.length === 42, "42 surface rows");
  const inv = JSON.parse(
    read("SOS/SAIOS/architecture/persistence-memory-topology/ARCHITECTURE.json"),
  ) as { totals: { persistence_surfaces: number } };
  assert(inv.totals.persistence_surfaces === 42, "196 count matches 197");
  const owners = surfaces.surfaces.map((s) => `${s.id}:${s.owner}`);
  assert(new Set(owners).size === owners.length, "no duplicate id:owner rows");
  checks.persistence = true;

  // Findings: #200 must have resolved F1–F3; evidence of resolution (not open drift)
  const findings = read(join(INT_DIR, "FINDINGS.md"));
  for (const f of ["F1", "F2", "F3", "F4", "F5", "F6", "RESOLVED", "BLOCKER"]) {
    assert(findings.includes(f), `findings missing ${f}`);
  }
  assert(/HIGH findings — RESOLVED|HIGH.*RESOLVED/i.test(findings), "HIGH resolved");
  // F1 resolution evidence
  const stores195 = read(
    "SOS/SAIOS/architecture/learning-reconciliation/STORE_CLASSIFICATION.md",
  );
  assert(
    /operational departmental memory/i.test(stores195),
    "F1: operational departmental memory retained",
  );
  assert(/cross-cutting/i.test(stores195), "F1: cross-cutting declared in #195 docs");
  const decl197 = read(
    "SOS/SAIOS/architecture/persistence-ownership/EXCEPTIONS.md",
  );
  assert(/cross-cutting/i.test(decl197), "F1: #197 E4 cross-cutting");
  // F2 resolution: no allowed dep; still no import
  const rolesJson = JSON.parse(read("SOS/SAIOS/architecture/module-roles.json")) as {
    modules: Array<{ id: string; allowed_dependencies?: string[] }>;
  };
  const rlMod = rolesJson.modules.find((m) => m.id === "runtime.workers.resume-learning");
  assert(!!rlMod, "resume-learning module");
  assert(
    !(rlMod!.allowed_dependencies ?? []).includes("core.knowledge-learning"),
    "F2: allowed dep removed",
  );
  const rlFiles = readdirSync(
    join(REPO, "SOS/SAIOS/runtime/workers/resume-learning"),
  ).filter((n) => n.endsWith(".ts"));
  let importsKl = false;
  for (const n of rlFiles) {
    if (read(`SOS/SAIOS/runtime/workers/resume-learning/${n}`).includes("knowledge-learning")) {
      importsKl = true;
    }
  }
  assert(!importsKl, "F2: runtime still has no knowledge-learning import");
  assert(
    JSON.stringify(rolesJson).includes("parallel_learning_store_new"),
    "F3: forbid tag retained",
  );
  assert(/grandfather/i.test(decl197), "F3: grandfathering declared");
  checks.findings_evidence = true;

  // Verify scripts registered + architecture verifies not orphaned
  const pkg = read("package.json");
  for (const s of PRIMARY_SCRIPTS) {
    assert(pkg.includes(`"${s}"`), `package.json missing ${s}`);
  }
  const archVerifies = readdirSync(join(REPO, "SOS/SAIOS/architecture"), {
    withFileTypes: true,
  })
    .filter((d) => d.isDirectory())
    .flatMap((d) => {
      const dir = join(REPO, "SOS/SAIOS/architecture", d.name);
      return readdirSync(dir)
        .filter((n) => n.startsWith("verify") && n.endsWith(".ts"))
        .map((n) => ({ dir: d.name, file: n, rel: `SOS/SAIOS/architecture/${d.name}/${n}` }));
    });
  assert(archVerifies.length >= 12, "expected architecture verify files");
  for (const v of archVerifies) {
    assert(pkg.includes(v.rel) || pkg.includes(v.file), `orphaned verify? ${v.rel}`);
  }
  checks.verification_scripts = true;

  // Dashboard plugins
  const register = read("SOS/SAIOS/platform/dashboard/plugins/register.ts");
  assert(register.includes("ALL_DASHBOARD_PLUGINS"), "dashboard ALL plugins");
  const pluginFiles = readdirSync(
    join(REPO, "SOS/SAIOS/platform/dashboard/plugins"),
  ).filter((n) => n.endsWith(".ts") && n !== "register.ts");
  assert(pluginFiles.length === 17, `expected 17 plugin files, got ${pluginFiles.length}`);
  for (const n of pluginFiles) {
    assert(register.includes(`./${n.replace(/\.ts$/, "")}`), `plugin not registered: ${n}`);
  }
  const dashVerify = read(
    "SOS/SAIOS/platform/dashboard/verify-dashboard-platform.ts",
  );
  assert(dashVerify.includes("ALL_DASHBOARD_PLUGINS.length === 17"), "dashboard verify expects 17");
  checks.dashboard = true;

  // Project state — Agent #201 advances latest after freeze; keep prior agents accepted.
  const state = JSON.parse(read("SOS/project-state.json")) as {
    latest_agent: string;
    next_agent: string;
    operations: Record<string, string>;
    history: Array<{ ref?: string }>;
  };
  assert(
    state.latest_agent === "199" ||
      state.latest_agent === "200" ||
      state.latest_agent === "201" ||
      state.latest_agent === "202" ||
      state.latest_agent === "203" ||
      state.latest_agent === "204" ||
      state.latest_agent === "205" ||
      state.latest_agent === "206" ||
      state.latest_agent === "207" ||
      state.latest_agent === "208" ||
      state.latest_agent === "209" ||
      state.latest_agent === "210" ||
      state.latest_agent === "211" ||
      state.latest_agent === "212" ||
      state.latest_agent === "213" ||
      state.latest_agent === "214" ||
      state.latest_agent === "215" ||
      state.latest_agent === "216" ||
      state.latest_agent === "217" ||
      state.latest_agent === "218" ||
      state.latest_agent === "219" ||
      state.latest_agent === "220" ||
      state.latest_agent === "221" ||
      state.latest_agent === "222A" ||
      state.latest_agent === "222B" ||
      state.latest_agent === "223" ||
      state.latest_agent === "224" || state.latest_agent === "225" || state.latest_agent === "226" || state.latest_agent === "227" || state.latest_agent === "228" || state.latest_agent === "229" || state.latest_agent === "230" || state.latest_agent === "231" || state.latest_agent === "232" || state.latest_agent === "233" || state.latest_agent === "234",
    "latest_agent 199–234",
  );
  assert(
    state.next_agent === "200" ||
      state.next_agent === "201" ||
      state.next_agent === "202" ||
      state.next_agent === "203" ||
      state.next_agent === "204" ||
      state.next_agent === "205" ||
      state.next_agent === "206" ||
      state.next_agent === "207" ||
      state.next_agent === "208" ||
      state.next_agent === "209" ||
      state.next_agent === "210" ||
      state.next_agent === "211" ||
      state.next_agent === "212" ||
      state.next_agent === "213" ||
      state.next_agent === "214" ||
      state.next_agent === "215" ||
      state.next_agent === "216" ||
      state.next_agent === "217" ||
      state.next_agent === "218" ||
      state.next_agent === "219" ||
      state.next_agent === "220" ||
      state.next_agent === "221" ||
      state.next_agent === "222" ||
      state.next_agent === "222B" ||
      state.next_agent === "222C" ||
      state.next_agent === "224" ||
      state.next_agent === "225" || state.next_agent === "226" || state.next_agent === "227" || state.next_agent === "228" || state.next_agent === "229" || state.next_agent === "230" || state.next_agent === "231" || state.next_agent === "232" || state.next_agent === "233" || state.next_agent === "234" || state.next_agent === "235",
    "next_agent 200–235",
  );
  for (const key of [
    "provider_reconciliation_audit",
    "provider_authority_certified",
    "cost_authority_certified",
    "execution_authority_model_certified",
    "learning_reconciliation_audit",
    "persistence_memory_topology_reconciliation",
    "persistence_ownership_declared",
    "architecture_governance_framework",
    "system_integrity_certification",
  ]) {
    assert(state.operations[key] === "complete", `operations.${key} complete`);
  }
  if (
    state.latest_agent === "200" ||
    state.latest_agent === "201" ||
    state.latest_agent === "202" ||
    state.latest_agent === "203" ||
    state.latest_agent === "204" ||
    state.latest_agent === "205" ||
    state.latest_agent === "206" ||
    state.latest_agent === "207" ||
    state.latest_agent === "208" ||
    state.latest_agent === "209" ||
    state.latest_agent === "210" ||
    state.latest_agent === "211" ||
    state.latest_agent === "212" ||
    state.latest_agent === "213" ||
    state.latest_agent === "214" ||
    state.latest_agent === "215" ||
    state.latest_agent === "216" ||
    state.latest_agent === "217" || state.latest_agent === "218" || state.latest_agent === "219" || state.latest_agent === "220" || state.latest_agent === "221" || state.latest_agent === "222A" || state.latest_agent === "222B" || state.latest_agent === "223" || state.latest_agent === "224" || state.latest_agent === "225" || state.latest_agent === "226" || state.latest_agent === "227" || state.latest_agent === "228" || state.latest_agent === "229" || state.latest_agent === "230" || state.latest_agent === "231" || state.latest_agent === "232" || state.latest_agent === "233" || state.latest_agent === "234"
  ) {
    assert(
      state.operations.architecture_final_freeze === "complete",
      "operations.architecture_final_freeze complete",
    );
  }
  if (state.latest_agent === "201") {
    assert(
      state.operations.openai_provider_implementation === "complete",
      "operations.openai_provider_implementation complete",
    );
  }
  if (
    state.latest_agent === "202" ||
    state.latest_agent === "203" ||
    state.latest_agent === "204" ||
    state.latest_agent === "205" ||
    state.latest_agent === "206" ||
    state.latest_agent === "207" ||
    state.latest_agent === "208" ||
    state.latest_agent === "209" ||
    state.latest_agent === "210" ||
    state.latest_agent === "211" ||
    state.latest_agent === "212" ||
    state.latest_agent === "213" ||
    state.latest_agent === "214" ||
    state.latest_agent === "215" ||
    state.latest_agent === "216" ||
    state.latest_agent === "217" || state.latest_agent === "218" || state.latest_agent === "219" || state.latest_agent === "220" || state.latest_agent === "221" || state.latest_agent === "222A" || state.latest_agent === "222B" || state.latest_agent === "223" || state.latest_agent === "224" || state.latest_agent === "225" || state.latest_agent === "226" || state.latest_agent === "227" || state.latest_agent === "228" || state.latest_agent === "229" || state.latest_agent === "230" || state.latest_agent === "231" || state.latest_agent === "232" || state.latest_agent === "233" || state.latest_agent === "234"
  ) {
    assert(
      state.operations.openai_live_response_persistence === "complete" ||
        state.operations.openai_provider_implementation === "complete",
      "openai provider ops present",
    );
  }
  if (
    state.latest_agent === "203" ||
    state.latest_agent === "204" ||
    state.latest_agent === "205" ||
    state.latest_agent === "206" ||
    state.latest_agent === "207" ||
    state.latest_agent === "208" ||
    state.latest_agent === "209" ||
    state.latest_agent === "210" ||
    state.latest_agent === "211" ||
    state.latest_agent === "212" ||
    state.latest_agent === "213" ||
    state.latest_agent === "214" ||
    state.latest_agent === "215" ||
    state.latest_agent === "216" ||
    state.latest_agent === "217" || state.latest_agent === "218" || state.latest_agent === "219" || state.latest_agent === "220" || state.latest_agent === "221" || state.latest_agent === "222A" || state.latest_agent === "222B" || state.latest_agent === "223" || state.latest_agent === "224" || state.latest_agent === "225" || state.latest_agent === "226" || state.latest_agent === "227" || state.latest_agent === "228" || state.latest_agent === "229" || state.latest_agent === "230" || state.latest_agent === "231" || state.latest_agent === "232" || state.latest_agent === "233" || state.latest_agent === "234"
  ) {
    assert(
      state.operations.first_real_ai_resume_flow === "complete",
      "operations.first_real_ai_resume_flow complete",
    );
  }
  if (
    state.latest_agent === "204" ||
    state.latest_agent === "205" ||
    state.latest_agent === "206" ||
    state.latest_agent === "207" ||
    state.latest_agent === "208" ||
    state.latest_agent === "209" ||
    state.latest_agent === "210" ||
    state.latest_agent === "211" ||
    state.latest_agent === "212" ||
    state.latest_agent === "213" ||
    state.latest_agent === "214" ||
    state.latest_agent === "215" ||
    state.latest_agent === "216" ||
    state.latest_agent === "217" || state.latest_agent === "218" || state.latest_agent === "219" || state.latest_agent === "220" || state.latest_agent === "221" || state.latest_agent === "222A" || state.latest_agent === "222B" || state.latest_agent === "223" || state.latest_agent === "224" || state.latest_agent === "225" || state.latest_agent === "226" || state.latest_agent === "227" || state.latest_agent === "228" || state.latest_agent === "229" || state.latest_agent === "230" || state.latest_agent === "231" || state.latest_agent === "232" || state.latest_agent === "233" || state.latest_agent === "234"
  ) {
    assert(
      state.operations.canonical_openai_runtime_enablement === "complete",
      "operations.canonical_openai_runtime_enablement complete",
    );
  }
  if (
    state.latest_agent === "205" ||
    state.latest_agent === "206" ||
    state.latest_agent === "207" ||
    state.latest_agent === "208" ||
    state.latest_agent === "209" ||
    state.latest_agent === "210" ||
    state.latest_agent === "211" ||
    state.latest_agent === "212" ||
    state.latest_agent === "213" ||
    state.latest_agent === "214" ||
    state.latest_agent === "215" ||
    state.latest_agent === "216" ||
    state.latest_agent === "217" || state.latest_agent === "218" || state.latest_agent === "219" || state.latest_agent === "220" || state.latest_agent === "221" || state.latest_agent === "222A" || state.latest_agent === "222B" || state.latest_agent === "223" || state.latest_agent === "224" || state.latest_agent === "225" || state.latest_agent === "226" || state.latest_agent === "227" || state.latest_agent === "228" || state.latest_agent === "229" || state.latest_agent === "230" || state.latest_agent === "231" || state.latest_agent === "232" || state.latest_agent === "233" || state.latest_agent === "234"
  ) {
    assert(
      state.operations.canonical_resume_production_intake === "complete",
      "operations.canonical_resume_production_intake complete",
    );
  }
  if (
    state.latest_agent === "206" ||
    state.latest_agent === "207" ||
    state.latest_agent === "208" ||
    state.latest_agent === "209" ||
    state.latest_agent === "210" ||
    state.latest_agent === "211" ||
    state.latest_agent === "212" ||
    state.latest_agent === "213" ||
    state.latest_agent === "214" ||
    state.latest_agent === "215" ||
    state.latest_agent === "216" ||
    state.latest_agent === "217" || state.latest_agent === "218" || state.latest_agent === "219" || state.latest_agent === "220" || state.latest_agent === "221" || state.latest_agent === "222A" || state.latest_agent === "222B" || state.latest_agent === "223" || state.latest_agent === "224" || state.latest_agent === "225" || state.latest_agent === "226" || state.latest_agent === "227" || state.latest_agent === "228" || state.latest_agent === "229" || state.latest_agent === "230" || state.latest_agent === "231" || state.latest_agent === "232" || state.latest_agent === "233" || state.latest_agent === "234"
  ) {
    assert(
      state.operations.canonical_resume_research_integration === "complete",
      "operations.canonical_resume_research_integration complete",
    );
  }
  if (
    state.latest_agent === "207" ||
    state.latest_agent === "208" ||
    state.latest_agent === "209" ||
    state.latest_agent === "210" ||
    state.latest_agent === "211" ||
    state.latest_agent === "212" ||
    state.latest_agent === "213" ||
    state.latest_agent === "214" ||
    state.latest_agent === "215" ||
    state.latest_agent === "216" ||
    state.latest_agent === "217" || state.latest_agent === "218" || state.latest_agent === "219" || state.latest_agent === "220" || state.latest_agent === "221" || state.latest_agent === "222A" || state.latest_agent === "222B" || state.latest_agent === "223" || state.latest_agent === "224" || state.latest_agent === "225" || state.latest_agent === "226" || state.latest_agent === "227" || state.latest_agent === "228" || state.latest_agent === "229" || state.latest_agent === "230" || state.latest_agent === "231" || state.latest_agent === "232" || state.latest_agent === "233" || state.latest_agent === "234"
  ) {
    assert(
      state.operations.canonical_candidate_artifact_isolation === "complete",
      "operations.canonical_candidate_artifact_isolation complete",
    );
  }
  if (
    state.latest_agent === "208" ||
    state.latest_agent === "209" ||
    state.latest_agent === "210" ||
    state.latest_agent === "211" ||
    state.latest_agent === "212" ||
    state.latest_agent === "213" ||
    state.latest_agent === "214" ||
    state.latest_agent === "215" ||
    state.latest_agent === "216" ||
    state.latest_agent === "217" || state.latest_agent === "218" || state.latest_agent === "219" || state.latest_agent === "220" || state.latest_agent === "221" || state.latest_agent === "222A" || state.latest_agent === "222B" || state.latest_agent === "223" || state.latest_agent === "224" || state.latest_agent === "225" || state.latest_agent === "226" || state.latest_agent === "227" || state.latest_agent === "228" || state.latest_agent === "229" || state.latest_agent === "230" || state.latest_agent === "231" || state.latest_agent === "232" || state.latest_agent === "233" || state.latest_agent === "234"
  ) {
    assert(
      state.operations.canonical_founder_review_registry_integration ===
        "complete",
      "operations.canonical_founder_review_registry_integration complete",
    );
  }
  if (
    state.latest_agent === "209" ||
    state.latest_agent === "210" ||
    state.latest_agent === "211" ||
    state.latest_agent === "212" ||
    state.latest_agent === "213" ||
    state.latest_agent === "214" ||
    state.latest_agent === "215" ||
    state.latest_agent === "216" ||
    state.latest_agent === "217" || state.latest_agent === "218" || state.latest_agent === "219" || state.latest_agent === "220" || state.latest_agent === "221" || state.latest_agent === "222A" || state.latest_agent === "222B" || state.latest_agent === "223" || state.latest_agent === "224" || state.latest_agent === "225" || state.latest_agent === "226" || state.latest_agent === "227" || state.latest_agent === "228" || state.latest_agent === "229" || state.latest_agent === "230" || state.latest_agent === "231" || state.latest_agent === "232" || state.latest_agent === "233" || state.latest_agent === "234"
  ) {
    assert(
      state.operations.canonical_sequential_batch_production === "complete",
      "operations.canonical_sequential_batch_production complete",
    );
  }
  if (state.latest_agent === "210" || state.latest_agent === "211" || state.latest_agent === "212" || state.latest_agent === "213" || state.latest_agent === "214" || state.latest_agent === "215" || state.latest_agent === "216" || state.latest_agent === "217" || state.latest_agent === "218" || state.latest_agent === "219" || state.latest_agent === "220" || state.latest_agent === "221" || state.latest_agent === "222A" || state.latest_agent === "222B" || state.latest_agent === "223" || state.latest_agent === "224" || state.latest_agent === "225" || state.latest_agent === "226" || state.latest_agent === "227" || state.latest_agent === "228" || state.latest_agent === "229" || state.latest_agent === "230" || state.latest_agent === "231" || state.latest_agent === "232" || state.latest_agent === "233" || state.latest_agent === "234") {
    assert(
      state.operations.canonical_duplicate_prevention === "complete",
      "operations.canonical_duplicate_prevention complete",
    );
  }
  if (state.latest_agent === "211" || state.latest_agent === "212" || state.latest_agent === "213" || state.latest_agent === "214" || state.latest_agent === "215" || state.latest_agent === "216" || state.latest_agent === "217" || state.latest_agent === "218" || state.latest_agent === "219" || state.latest_agent === "220" || state.latest_agent === "221" || state.latest_agent === "222A" || state.latest_agent === "222B" || state.latest_agent === "223" || state.latest_agent === "224" || state.latest_agent === "225" || state.latest_agent === "226" || state.latest_agent === "227" || state.latest_agent === "228" || state.latest_agent === "229" || state.latest_agent === "230" || state.latest_agent === "231" || state.latest_agent === "232" || state.latest_agent === "233" || state.latest_agent === "234") {
    assert(
      state.operations.canonical_critic_revision_loop === "complete",
      "operations.canonical_critic_revision_loop complete",
    );
  }
  if (state.latest_agent === "212" || state.latest_agent === "213" || state.latest_agent === "214" || state.latest_agent === "215" || state.latest_agent === "216" || state.latest_agent === "217" || state.latest_agent === "218" || state.latest_agent === "219" || state.latest_agent === "220" || state.latest_agent === "221" || state.latest_agent === "222A" || state.latest_agent === "222B" || state.latest_agent === "223" || state.latest_agent === "224" || state.latest_agent === "225" || state.latest_agent === "226" || state.latest_agent === "227" || state.latest_agent === "228" || state.latest_agent === "229" || state.latest_agent === "230" || state.latest_agent === "231" || state.latest_agent === "232" || state.latest_agent === "233" || state.latest_agent === "234") {
    assert(
      state.operations.canonical_production_health_gate === "complete",
      "operations.canonical_production_health_gate complete",
    );
  }
  if (state.latest_agent === "213" || state.latest_agent === "214" || state.latest_agent === "215" || state.latest_agent === "216" || state.latest_agent === "217" || state.latest_agent === "218" || state.latest_agent === "219" || state.latest_agent === "220" || state.latest_agent === "221" || state.latest_agent === "222A" || state.latest_agent === "222B" || state.latest_agent === "223" || state.latest_agent === "224" || state.latest_agent === "225" || state.latest_agent === "226" || state.latest_agent === "227" || state.latest_agent === "228" || state.latest_agent === "229" || state.latest_agent === "230" || state.latest_agent === "231" || state.latest_agent === "232" || state.latest_agent === "233" || state.latest_agent === "234") {
    assert(
      state.operations.canonical_production_controller === "complete",
      "operations.canonical_production_controller complete",
    );
  }
  if (state.latest_agent === "214" || state.latest_agent === "215" || state.latest_agent === "216" || state.latest_agent === "217" || state.latest_agent === "218" || state.latest_agent === "219" || state.latest_agent === "220" || state.latest_agent === "221" || state.latest_agent === "222A" || state.latest_agent === "222B" || state.latest_agent === "223" || state.latest_agent === "224" || state.latest_agent === "225" || state.latest_agent === "226" || state.latest_agent === "227" || state.latest_agent === "228" || state.latest_agent === "229" || state.latest_agent === "230" || state.latest_agent === "231" || state.latest_agent === "232" || state.latest_agent === "233" || state.latest_agent === "234") {
    assert(
      state.operations.canonical_autonomous_production_service === "complete",
      "operations.canonical_autonomous_production_service complete",
    );
  }
  if (state.latest_agent === "215" || state.latest_agent === "216" || state.latest_agent === "217" || state.latest_agent === "218" || state.latest_agent === "219" || state.latest_agent === "220" || state.latest_agent === "221" || state.latest_agent === "222A" || state.latest_agent === "222B" || state.latest_agent === "223" || state.latest_agent === "224" || state.latest_agent === "225" || state.latest_agent === "226" || state.latest_agent === "227" || state.latest_agent === "228" || state.latest_agent === "229" || state.latest_agent === "230" || state.latest_agent === "231" || state.latest_agent === "232" || state.latest_agent === "233" || state.latest_agent === "234") {
    assert(
      state.operations.canonical_portfolio_intelligence === "complete",
      "operations.canonical_portfolio_intelligence complete",
    );
  }
  if (state.latest_agent === "216" || state.latest_agent === "217" || state.latest_agent === "218" || state.latest_agent === "219" || state.latest_agent === "220" || state.latest_agent === "221" || state.latest_agent === "222A" || state.latest_agent === "222B" || state.latest_agent === "223" || state.latest_agent === "224" || state.latest_agent === "225" || state.latest_agent === "226" || state.latest_agent === "227" || state.latest_agent === "228" || state.latest_agent === "229" || state.latest_agent === "230" || state.latest_agent === "231" || state.latest_agent === "232" || state.latest_agent === "233" || state.latest_agent === "234") {
    assert(
      state.operations.canonical_production_strategy_engine === "complete",
      "operations.canonical_production_strategy_engine complete",
    );
  }
  if (state.latest_agent === "217" || state.latest_agent === "218" || state.latest_agent === "219" || state.latest_agent === "220" || state.latest_agent === "221" || state.latest_agent === "222A" || state.latest_agent === "222B" || state.latest_agent === "223" || state.latest_agent === "224" || state.latest_agent === "225" || state.latest_agent === "226" || state.latest_agent === "227" || state.latest_agent === "228" || state.latest_agent === "229" || state.latest_agent === "230" || state.latest_agent === "231" || state.latest_agent === "232" || state.latest_agent === "233" || state.latest_agent === "234") {
    assert(
      state.operations.canonical_strategy_driven_intake === "complete",
      "operations.canonical_strategy_driven_intake complete",
    );
  }
  if (state.latest_agent === "218" || state.latest_agent === "219" || state.latest_agent === "220" || state.latest_agent === "221" || state.latest_agent === "222A" || state.latest_agent === "222B" || state.latest_agent === "223" || state.latest_agent === "224" || state.latest_agent === "225" || state.latest_agent === "226" || state.latest_agent === "227" || state.latest_agent === "228" || state.latest_agent === "229" || state.latest_agent === "230" || state.latest_agent === "231" || state.latest_agent === "232" || state.latest_agent === "233" || state.latest_agent === "234") {
    assert(
      state.operations.canonical_resource_budget_governor === "complete",
      "operations.canonical_resource_budget_governor complete",
    );
  }
  if (state.latest_agent === "219" || state.latest_agent === "220" || state.latest_agent === "221" || state.latest_agent === "222A" || state.latest_agent === "222B" || state.latest_agent === "223" || state.latest_agent === "224" || state.latest_agent === "225" || state.latest_agent === "226" || state.latest_agent === "227" || state.latest_agent === "228" || state.latest_agent === "229" || state.latest_agent === "230" || state.latest_agent === "231" || state.latest_agent === "232" || state.latest_agent === "233" || state.latest_agent === "234") {
    assert(
      state.operations.canonical_operations_dashboard === "complete",
      "operations.canonical_operations_dashboard complete",
    );
  }
  if (state.latest_agent === "220" || state.latest_agent === "221" || state.latest_agent === "222A" || state.latest_agent === "222B" || state.latest_agent === "223" || state.latest_agent === "224" || state.latest_agent === "225" || state.latest_agent === "226" || state.latest_agent === "227" || state.latest_agent === "228" || state.latest_agent === "229" || state.latest_agent === "230" || state.latest_agent === "231" || state.latest_agent === "232" || state.latest_agent === "233" || state.latest_agent === "234") {
    assert(
      state.operations.canonical_adaptive_scheduling_policy === "complete",
      "operations.canonical_adaptive_scheduling_policy complete",
    );
  }
  if (state.latest_agent === "221" || state.latest_agent === "222A" || state.latest_agent === "222B" || state.latest_agent === "223" || state.latest_agent === "224" || state.latest_agent === "225" || state.latest_agent === "226" || state.latest_agent === "227" || state.latest_agent === "228" || state.latest_agent === "229" || state.latest_agent === "230" || state.latest_agent === "231" || state.latest_agent === "232" || state.latest_agent === "233" || state.latest_agent === "234") {
    assert(
      state.operations.canonical_operational_policy_advisor === "complete",
      "operations.canonical_operational_policy_advisor complete",
    );
  }
  if (state.latest_agent === "222A" || state.latest_agent === "222B" || state.latest_agent === "223" || state.latest_agent === "224" || state.latest_agent === "225" || state.latest_agent === "226" || state.latest_agent === "227" || state.latest_agent === "228" || state.latest_agent === "229" || state.latest_agent === "230" || state.latest_agent === "231" || state.latest_agent === "232" || state.latest_agent === "233" || state.latest_agent === "234") {
    assert(
      state.operations.command_center_foundation === "complete",
      "operations.command_center_foundation complete",
    );
  }
  if (state.latest_agent === "222B" || state.latest_agent === "223" || state.latest_agent === "224" || state.latest_agent === "225" || state.latest_agent === "226" || state.latest_agent === "227" || state.latest_agent === "228" || state.latest_agent === "229" || state.latest_agent === "230" || state.latest_agent === "231" || state.latest_agent === "232" || state.latest_agent === "233" || state.latest_agent === "234") {
    assert(
      state.operations.mission_control_ui === "complete",
      "operations.mission_control_ui complete",
    );
  }
  if (state.latest_agent === "223" || state.latest_agent === "224" || state.latest_agent === "225" || state.latest_agent === "226" || state.latest_agent === "227" || state.latest_agent === "228" || state.latest_agent === "229" || state.latest_agent === "230" || state.latest_agent === "231" || state.latest_agent === "232" || state.latest_agent === "233" || state.latest_agent === "234") {
    assert(
      state.operations.engineering_intelligence === "complete",
      "operations.engineering_intelligence complete",
    );
  }
  if (state.latest_agent === "224" || state.latest_agent === "225" || state.latest_agent === "226" || state.latest_agent === "227" || state.latest_agent === "228" || state.latest_agent === "229" || state.latest_agent === "230" || state.latest_agent === "231" || state.latest_agent === "232" || state.latest_agent === "233" || state.latest_agent === "234") {
    assert(
      state.operations.engineering_review === "complete",
      "operations.engineering_review complete",
    );
  }
  if (state.latest_agent === "225" || state.latest_agent === "226" || state.latest_agent === "227" || state.latest_agent === "228" || state.latest_agent === "229" || state.latest_agent === "230" || state.latest_agent === "231" || state.latest_agent === "232" || state.latest_agent === "233" || state.latest_agent === "234") {
    assert(
      state.operations.founder_action_adapters === "complete",
      "operations.founder_action_adapters complete",
    );
  }
  if (state.latest_agent === "226" || state.latest_agent === "227" || state.latest_agent === "228" || state.latest_agent === "229" || state.latest_agent === "230" || state.latest_agent === "231" || state.latest_agent === "232" || state.latest_agent === "233" || state.latest_agent === "234") {
    assert(
      state.operations.system_orchestrator === "complete",
      "operations.system_orchestrator complete",
    );
  }
  if (state.latest_agent === "227" || state.latest_agent === "228" || state.latest_agent === "229" || state.latest_agent === "230" || state.latest_agent === "231" || state.latest_agent === "232" || state.latest_agent === "233" || state.latest_agent === "234") {
    assert(
      state.operations.end_to_end_validation === "complete",
      "operations.end_to_end_validation complete",
    );
  }
  if (state.latest_agent === "228" || state.latest_agent === "229" || state.latest_agent === "230" || state.latest_agent === "231" || state.latest_agent === "232" || state.latest_agent === "233" || state.latest_agent === "234") {
    assert(
      state.operations.production_readiness === "complete",
      "operations.production_readiness complete",
    );
  }
  if (state.latest_agent === "229" || state.latest_agent === "230" || state.latest_agent === "231" || state.latest_agent === "232" || state.latest_agent === "233" || state.latest_agent === "234") {
    assert(
      state.operations.production_bootstrap === "complete",
      "operations.production_bootstrap complete",
    );
  }
  if (state.latest_agent === "230" || state.latest_agent === "231" || state.latest_agent === "232" || state.latest_agent === "233" || state.latest_agent === "234") {
    assert(
      state.operations.founder_supervised_production_runner === "complete",
      "operations.founder_supervised_production_runner complete",
    );
  }
  if (state.latest_agent === "231" || state.latest_agent === "232" || state.latest_agent === "233" || state.latest_agent === "234") {
    assert(
      state.operations.verification_artifact_isolation === "complete",
      "operations.verification_artifact_isolation complete",
    );
    assert(
      state.operations.founder_queue_recovery === "complete",
      "operations.founder_queue_recovery complete",
    );
  }
  if (state.latest_agent === "233" || state.latest_agent === "234") {
    assert(
      state.operations.resume_template_runtime === "complete",
      "operations.resume_template_runtime complete",
    );
  }
  if (state.latest_agent === "234") {
    assert(
      state.operations.first_real_resume_template === "complete",
      "operations.first_real_resume_template complete",
    );
  }
  assert(
    state.history.some((h) =>
      (h.ref ?? "").includes("AIOS_SYSTEM_INTEGRITY_CERTIFICATION_V1_REPORT"),
    ),
    "history must include system integrity report",
  );
  checks.project_state = true;

  // Safety
  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE OFF");
  assert(
    !existsSync(join(REPO, "SOS/SAIOS/runtime/memory/MemoryService.ts")),
    "MemoryService not implemented",
  );
  for (const rel of RUNTIME_UNTOUCHED) {
    assert(existsSync(join(REPO, rel)), `runtime missing ${rel}`);
  }

  const engSrc = join(REPO, "SOS/SAIOS/core/engineering-intelligence/EngineeringIntelligence.ts");
  assert(existsSync(engSrc), "EngineeringIntelligence present");
  const engTxt = readFileSync(engSrc, "utf8");
  assert(engTxt.includes("advisory_only: true"), "EI advisory only");
  assert(engTxt.includes("owns_code: false"), "EI owns no code");
  assert(engTxt.includes("owns_production: false"), "EI owns no production");
  assert(engTxt.includes("can_mutate_architecture: false"), "EI cannot mutate architecture");


  const reviewOverlay = join(REPO, "SOS/SAIOS/core/engineering-intelligence/FounderEngineeringReviewOverlay.ts");
  assert(existsSync(reviewOverlay), "FounderEngineeringReviewOverlay present");
  const reviewTxt = readFileSync(reviewOverlay, "utf8");
  assert(reviewTxt.includes("execution_triggered: false"), "review never executes");
  assert(reviewTxt.includes("cleanup_triggered: false"), "review never cleanup");
  assert(reviewTxt.includes("code_modified: false"), "review never modifies code");
  assert(!reviewTxt.includes("buildEngineeringIntelligenceReport"), "review does not regenerate EI");

  const faa = join(REPO, "SOS/SAIOS/core/founder-action-adapters/FounderActionAdapters.ts");
  assert(existsSync(faa), "FounderActionAdapters present");
  const faaTxt = readFileSync(faa, "utf8");
  assert(faaTxt.includes("owns_production: false"), "FAA never owns production");
  assert(faaTxt.includes("owns_business_logic: false"), "FAA only delegates");
  assert(faaTxt.includes("runProduction"), "FAA delegates to ProductionController");
  assert(faaTxt.includes("production_controller_bypassed: false"), "FAA never bypasses ProductionController");
  assert(faaTxt.includes("runtime_guard_bypassed: false"), "FAA never bypasses Runtime Guard");
  assert(!faaTxt.includes("class ProductionEngine"), "FAA is not a ProductionEngine");

  const orch = join(REPO, "SOS/SAIOS/core/system-orchestrator/SystemOrchestrator.ts");
  assert(existsSync(orch), "SystemOrchestrator present");
  const orchTxt = readFileSync(orch, "utf8");
  assert(orchTxt.includes("coordination_only: true"), "Orchestrator coordination only");
  assert(orchTxt.includes("owns_production: false"), "Orchestrator never owns production");
  assert(orchTxt.includes("owns_business_logic: false"), "Orchestrator no business logic");
  assert(orchTxt.includes("runProduction"), "Orchestrator delegates to ProductionController");
  assert(!orchTxt.includes("class ProductionEngine"), "Orchestrator is not a ProductionEngine");

  const pv = join(REPO, "SOS/SAIOS/core/production-validation/EndToEndProductionValidation.ts");
  assert(existsSync(pv), "EndToEndProductionValidation present");
  const pvTxt = readFileSync(pv, "utf8");
  assert(pvTxt.includes("owns_production: false"), "validation never owns production");
  assert(pvTxt.includes("owns_orchestration: false"), "validation never owns orchestration");
  assert(pvTxt.includes("owns_business_logic: false"), "validation never owns business logic");
  assert(pvTxt.includes("modifies_architecture: false"), "validation never modifies architecture");
  assert(!pvTxt.includes("class ProductionEngine"), "validation is not a ProductionEngine");

  const pra = join(REPO, "SOS/SAIOS/core/production-readiness/ProductionReadinessAudit.ts");
  assert(existsSync(pra), "ProductionReadinessAudit present");
  const praTxt = readFileSync(pra, "utf8");
  assert(praTxt.includes("owns_production: false"), "readiness never owns production");
  assert(praTxt.includes("owns_orchestration: false"), "readiness never owns orchestration");
  assert(praTxt.includes("owns_business_logic: false"), "readiness never owns business logic");
  assert(praTxt.includes("owns_governance: false"), "readiness never owns governance");
  assert(praTxt.includes("executes_production: false"), "readiness never executes production");
  assert(!praTxt.includes("runProduction("), "readiness does not call runProduction");

  const boot = join(REPO, "SOS/SAIOS/core/production-bootstrap/ProductionBootstrap.ts");
  assert(existsSync(boot), "ProductionBootstrap present");
  const bootTxt = readFileSync(boot, "utf8");
  assert(bootTxt.includes("executes_production: false"), "bootstrap cannot execute production");
  assert(bootTxt.includes("publication_allowed: false"), "bootstrap cannot publish");
  assert(bootTxt.includes("bypasses_founder_approval: false"), "bootstrap cannot bypass Founder approval");
  assert(bootTxt.includes("bypasses_runtime_guard: false"), "bootstrap cannot bypass Runtime Guard");
  assert(bootTxt.includes("owns_production: false"), "bootstrap owns no production");
  assert(!bootTxt.includes("runProduction("), "bootstrap does not call runProduction");

  const spr = join(REPO, "SOS/SAIOS/core/supervised-production-runner/FounderSupervisedProductionRunner.ts");
  assert(existsSync(spr), "FounderSupervisedProductionRunner present");
  const sprTxt = readFileSync(spr, "utf8");
  assert(sprTxt.includes("owns_production: false"), "runner owns no production");
  assert(sprTxt.includes("owns_orchestration: false"), "runner owns no orchestration");
  assert(sprTxt.includes("owns_governance: false"), "runner owns no governance");
  assert(sprTxt.includes("bypasses_founder_approval: false"), "runner cannot bypass Founder approval");
  assert(sprTxt.includes("bypasses_runtime_guard: false"), "runner cannot bypass Runtime Guard");
  assert(sprTxt.includes("can_publish: false"), "runner cannot publish");
  assert(sprTxt.includes("can_enable_live: false"), "runner cannot enable LIVE");
  assert(sprTxt.includes("exceeds_first_run_limits: false"), "runner cannot exceed first-run limits");
  assert(!sprTxt.includes("runProduction("), "runner does not call runProduction");
  assert(sprTxt.includes("executeFounderAction"), "runner delegates via FAA");

  checks.safety = true;

  // Scores + ARCHITECTURE.json
  const scoresDoc = read(join(INT_DIR, "SCORES.md"));
  assert(scoresDoc.includes("Overall Repository Integrity"), "scores overall");
  assert(scoresDoc.includes("94") || scoresDoc.includes("88"), "overall score present");
  const arch = JSON.parse(read(join(INT_DIR, "ARCHITECTURE.json"))) as {
    agent: string;
    verdict: string;
    live: boolean;
    scores: { overall: number };
    findings: { blocker: number; total: number };
    post_freeze?: { overall: number; verdict: string };
  };
  assert(arch.agent === "199", "agent 199 package");
  assert(arch.live === false, "live false");
  assert(arch.findings.blocker === 0, "0 blockers");
  // After #200, overall score documented as 94 in SCORES.md / post_freeze
  if (arch.post_freeze) {
    assert(arch.post_freeze.overall === 94, "post_freeze overall 94");
  }
  assert(
    arch.scores.overall === 88 || arch.scores.overall === 94,
    "baseline or updated overall",
  );
  checks.scores = true;

  // Matrix
  const matrix = read(join(INT_DIR, "INTEGRITY_MATRIX.md"));
  assert(matrix.includes("ALIGN") || matrix.includes("PASS"), "matrix has aligns");
  assert(
    matrix.includes("RESOLVED") ||
      read(join(INT_DIR, "FINDINGS.md")).includes("RESOLVED"),
    "resolutions recorded",
  );
  checks.matrix = true;

  // Reports
  for (const report of REPORTS) {
    assert(existsSync(join(REPO, report)), `missing ${report}`);
    const body = read(report);
    assert(body.includes("Agent #199"), `${report} agent`);
    for (const s of REQUIRED_REPORT_SECTIONS) {
      assert(body.includes(s), `${report} missing ${s}`);
    }
    assert(/CERTIFIED_WITH_FINDINGS|Certified with findings|ARCHITECTURE_FROZEN/i.test(body), `${report} verdict`);
    assert(body.includes("88") || body.includes("94"), `${report} score`);
    assert(/No runtime changes/i.test(body), `${report} no runtime`);
    assert(/LIVE remains OFF/i.test(body), `${report} LIVE`);
    assert(/Execution remains impossible/i.test(body), `${report} execution`);
    assert(/100%/.test(body) && /backward/i.test(body), `${report} backward`);
    assert(/No MemoryService adoption/i.test(body), `${report} no MemoryService`);
    assert(/No BaseAppendOnlyRepository adoption/i.test(body), `${report} no BaseAppendOnly`);
  }
  checks.reports = true;

  const selfSrc = read(join(INT_DIR, "verify-system-integrity.ts"));
  assert(!/\bexecFileSync\b/.test(selfSrc), "verify must not launch processes");
  assert(/Verify-only|verification only|REFERENCE/i.test(selfSrc), "docs-only verify");
  checks.verify_readonly = true;

  const allOk = Object.values(checks).every(Boolean);
  assert(allOk, "not all checks passed");

  const outDir = join(REPO, "SOS/07_LOGS/saios/architecture/system-integrity");
  mkdirSync(outDir, { recursive: true });
  const result = {
    ok: true,
    agent: 199,
    component: "system-integrity-certification-v1",
    live: false,
    execution_impossible: true,
    overall_score: 88,
    findings: { blocker: 0, high: 3, medium: 3, low: 1, info: 4, total: 11 },
    checks,
    verdict: "CERTIFIED_WITH_FINDINGS",
    at: new Date().toISOString(),
  };
  writeFileSync(join(outDir, "verify-result.json"), `${JSON.stringify(result, null, 2)}\n`);
  console.log("SYSTEM INTEGRITY PASS");
  console.log(JSON.stringify(result, null, 2));
}

main();
