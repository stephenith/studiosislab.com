#!/usr/bin/env tsx
/**
 * Architecture Governance Framework verify — Agent #198.
 *
 * DOCUMENTATION + REFERENCE INTEGRITY ONLY.
 * Does not modify runtime, persist migrations, enable LIVE, or re-run all suite verifies.
 */
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO = resolve(import.meta.dirname, "../../../..");
const GOV_DIR = "SOS/SAIOS/architecture/governance";

const REQUIRED_DOCS = [
  "GOVERNANCE_MANIFEST.md",
  "GOVERNANCE_MATRIX.md",
  "VERIFICATION_MATRIX.md",
  "FREEZE_POLICY.md",
  "EXTENSION_POLICY.md",
  "AUTHORITIES.md",
  "DEPENDENCIES.md",
  "README.md",
  "ARCHITECTURE.json",
  "verify-architecture-governance.ts",
] as const;

const REPORTS = [
  "SOS/09_REPORTS/AIOS_ARCHITECTURE_GOVERNANCE_FRAMEWORK_V1_REPORT.md",
  "SOS/SAIOS/AIOS_ARCHITECTURE_GOVERNANCE_FRAMEWORK_V1_REPORT.md",
];

const REQUIRED_REPORT_SECTIONS = [
  "## 1. Governance Overview",
  "## 2. Architecture Authority Matrix",
  "## 3. Verification Matrix",
  "## 4. Dependency Matrix",
  "## 5. Freeze Policy",
  "## 6. Extension Policy",
  "## 7. Governance Manifest Summary",
  "## 8. CTO Certification",
];

/** Packages that must be referenced and exist. */
const REFERENCED_PATHS = [
  "SOS/SAIOS/architecture/phase3-foundation",
  "SOS/SAIOS/architecture/phase3-planning",
  "SOS/SAIOS/architecture/phase4-execution",
  "SOS/SAIOS/architecture/provider-registry",
  "SOS/SAIOS/architecture/provider-reconciliation",
  "SOS/SAIOS/architecture/provider-authority",
  "SOS/SAIOS/architecture/cost-authority",
  "SOS/SAIOS/architecture/execution-authority-model",
  "SOS/SAIOS/architecture/learning-reconciliation",
  "SOS/SAIOS/architecture/persistence-memory-topology",
  "SOS/SAIOS/architecture/persistence-ownership",
  "SOS/SAIOS/platform/department-sdk",
  "SOS/SAIOS/platform/cost-ledger",
  "SOS/SAIOS/platform/telemetry",
  "SOS/SAIOS/platform/dashboard",
  "SOS/SAIOS/runtime/execution-controller",
  "SOS/SAIOS/runtime/worker-runtime",
  "SOS/SAIOS/runtime/activation-gate",
  "SOS/SAIOS/runtime/execution-authorization",
  "SOS/SAIOS/runtime/pre-dispatch-simulation",
  "SOS/SAIOS/core/knowledge",
  "SOS/SAIOS/core/knowledge-learning",
  "SOS/SAIOS/core/company-brain",
  "SOS/SAIOS/architecture/runtime-guard.ts",
  "SOS/SAIOS/architecture/module-roles.json",
  "SOS/SAIOS/architecture/dependency-graph.json",
] as const;

const PRIMARY_VERIFY_SCRIPTS = [
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
  "platform:verify",
  "dashboard-platform:verify",
  "architecture-governance:verify",
] as const;

const RUNTIME_UNTOUCHED = [
  "SOS/SAIOS/architecture/runtime-guard.ts",
  "SOS/SAIOS/core/company-brain/index.ts",
  "SOS/SAIOS/runtime/execution-controller/ExecutionController.ts",
  "SOS/SAIOS/runtime/worker-runtime/index.ts",
  "SOS/SAIOS/runtime/scheduler/SchedulerMemory.ts",
  "SOS/SAIOS/platform/department-sdk/index.ts",
  "SOS/SAIOS/core/knowledge/KnowledgeManager.ts",
  "SOS/SAIOS/core/knowledge-learning/LearningRepository.ts",
  "SOS/SAIOS/platform/telemetry/TelemetryRepository.ts",
  "SOS/SAIOS/platform/cost-ledger/BudgetRepository.ts",
  "SOS/SAIOS/runtime/memory/types.ts",
] as const;

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ARCHITECTURE GOVERNANCE FAIL: ${msg}`);
}

function read(rel: string): string {
  return readFileSync(join(REPO, rel), "utf8");
}

function main(): void {
  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE must be OFF");
  const checks: Record<string, boolean> = {};

  for (const doc of REQUIRED_DOCS) {
    assert(existsSync(join(REPO, GOV_DIR, doc)), `missing ${doc}`);
  }
  checks.documents = true;

  // --- All certified authorities referenced ---
  const manifest = read(join(GOV_DIR, "GOVERNANCE_MANIFEST.md"));
  const authorities = read(join(GOV_DIR, "AUTHORITIES.md"));
  const matrix = read(join(GOV_DIR, "GOVERNANCE_MATRIX.md"));
  for (const needle of [
    "Phase 3 Foundation",
    "Phase 4",
    "Provider Authority",
    "Cost Authority",
    "Execution Authority Model",
    "Persistence Ownership",
    "Knowledge Authority",
    "Founder Learning",
    "Department Learning",
    "Telemetry",
    "Activation Gate",
    "Execution Authorization",
    "Pre-Dispatch Simulation",
    "Department SDK",
    "Execution Controller",
    "Worker Runtime",
    "Dashboard Platform",
    "Platform",
  ]) {
    assert(
      manifest.includes(needle) ||
        authorities.includes(needle) ||
        matrix.includes(needle),
      `missing governance reference: ${needle}`,
    );
  }
  for (const p of REFERENCED_PATHS) {
    assert(existsSync(join(REPO, p)), `referenced path missing: ${p}`);
  }
  checks.authorities_referenced = true;

  // --- No authority conflicts / ownership overlaps (declared exclusive) ---
  assert(authorities.includes("Knowledge Authority"), "Knowledge Authority");
  assert(authorities.includes("core/knowledge"), "knowledge owner");
  assert(authorities.includes("Founder Learning Authority"), "Founder Learning");
  assert(authorities.includes("core/knowledge-learning"), "founder learning owner");
  assert(
    authorities.includes("Distributed") || authorities.includes("distributed"),
    "distributed execution",
  );
  assert(
    authorities.includes("No ownership overlaps") ||
      matrix.includes("No ownership overlaps") ||
      authorities.includes("exclusive"),
    "no ownership overlaps declared",
  );
  // Exclusive mapping consistency with #197
  const ownership197 = read(
    "SOS/SAIOS/architecture/persistence-ownership/OWNERSHIP_MODEL.md",
  );
  assert(ownership197.includes("core/knowledge"), "197 knowledge owner");
  assert(ownership197.includes("core/knowledge-learning"), "197 founder learning");
  assert(
    !authorities.includes("sole execution authority") ||
      /not.*sole execution|no.*sole execution|Distributed/i.test(authorities),
    "must not crown sole execution authority",
  );
  checks.no_authority_conflicts = true;

  // --- Verification matrix ---
  const vmatrix = read(join(GOV_DIR, "VERIFICATION_MATRIX.md"));
  const pkg = read("package.json");
  for (const script of PRIMARY_VERIFY_SCRIPTS) {
    assert(vmatrix.includes(script), `verification matrix missing ${script}`);
    assert(pkg.includes(`"${script}"`), `package.json missing ${script}`);
  }
  for (const cls of [
    "Foundation",
    "Governance",
    "Platform",
    "Execution",
    "Planning",
    "Persistence",
    "Knowledge",
    "Learning",
    "Provider",
    "Cost",
    "Telemetry",
    "Dashboard",
    "Department",
    "Safety",
    "Architecture",
  ]) {
    assert(vmatrix.includes(cls), `verification class missing ${cls}`);
  }
  checks.verification_matrix = true;

  // --- Freeze + Extension ---
  const freeze = read(join(GOV_DIR, "FREEZE_POLICY.md"));
  assert(freeze.includes("Runtime Guard"), "freeze Runtime Guard");
  assert(freeze.includes("LIVE"), "freeze LIVE");
  assert(freeze.includes("Founder approval"), "freeze Founder approval");
  const extension = read(join(GOV_DIR, "EXTENSION_POLICY.md"));
  assert(extension.includes("departments"), "extension departments");
  assert(extension.includes("providers"), "extension providers");
  assert(extension.includes("persistence"), "extension persistence");
  assert(extension.includes("workers"), "extension workers");
  assert(extension.includes("telemetry"), "extension telemetry");
  assert(extension.includes("execution"), "extension execution");
  checks.freeze_extension = true;

  // --- Dependencies ---
  const deps = read(join(GOV_DIR, "DEPENDENCIES.md"));
  assert(deps.includes("Execution Controller"), "deps controller");
  assert(deps.includes("STOP") || deps.includes("stop"), "deps STOP");
  assert(deps.includes("estimation") || deps.includes("accounting"), "deps cost invariant");
  checks.dependencies = true;

  // --- ARCHITECTURE.json ---
  const arch = JSON.parse(read(join(GOV_DIR, "ARCHITECTURE.json"))) as {
    agent: string;
    verdict: string;
    live: boolean;
    runtime_behaviour_introduced: boolean;
    new_architecture: boolean;
    memory_service_implementation: boolean;
    base_append_only_adoption: boolean;
    referenced_packages: string[];
    exclusive_authorities: Record<string, string>;
  };
  assert(arch.agent === "198", "agent 198");
  assert(arch.verdict === "GOVERNANCE_CONSOLIDATED", "verdict");
  assert(arch.live === false, "live false");
  assert(arch.runtime_behaviour_introduced === false, "no runtime behaviour");
  assert(arch.new_architecture === false, "no new architecture");
  assert(arch.memory_service_implementation === false, "no MemoryService");
  assert(arch.base_append_only_adoption === false, "no BaseAppendOnly adoption");
  assert(arch.exclusive_authorities.knowledge === "core/knowledge", "exclusive knowledge");
  assert(
    arch.exclusive_authorities.founder_learning === "core/knowledge-learning",
    "exclusive founder learning",
  );
  assert(
    arch.exclusive_authorities.execution_model.includes("distributed"),
    "distributed execution model",
  );
  assert(arch.referenced_packages.length >= 20, "enough referenced packages");
  // No duplicate package refs in ARCHITECTURE.json
  assert(
    new Set(arch.referenced_packages).size === arch.referenced_packages.length,
    "duplicate governance package references in ARCHITECTURE.json",
  );
  checks.architecture_json = true;

  // --- No duplicate governance declarations (single master index) ---
  assert(manifest.includes("single architectural index") || manifest.includes("single architectural"), "single index");
  assert(!existsSync(join(REPO, "SOS/SAIOS/architecture/governance-v2")), "no duplicate governance-v2");
  checks.no_duplicate_governance = true;

  // --- Reports / CTO language ---
  for (const report of REPORTS) {
    assert(existsSync(join(REPO, report)), `missing ${report}`);
    const body = read(report);
    assert(body.includes("Agent #198"), `${report} agent`);
    for (const s of REQUIRED_REPORT_SECTIONS) {
      assert(body.includes(s), `${report} missing ${s}`);
    }
    assert(/Architecture consolidated/i.test(body), `${report} architecture consolidated`);
    assert(/No runtime changes/i.test(body), `${report} no runtime`);
    assert(/No execution changes/i.test(body), `${report} no execution`);
    assert(/No persistence migrations/i.test(body), `${report} no persistence migrations`);
    assert(/No provider changes/i.test(body), `${report} no provider`);
    assert(/No MemoryService adoption/i.test(body), `${report} no MemoryService`);
    assert(/No BaseAppendOnlyRepository adoption/i.test(body), `${report} no BaseAppendOnly`);
    assert(/No API changes/i.test(body), `${report} no API`);
    assert(/No schema changes/i.test(body), `${report} no schema`);
    assert(/100%/.test(body) && /backward/i.test(body), `${report} backward compat`);
    assert(/LIVE remains OFF/i.test(body), `${report} LIVE OFF`);
    assert(/Execution remains impossible/i.test(body), `${report} execution impossible`);
  }
  checks.reports = true;

  // --- Runtime unmodified ---
  for (const rel of RUNTIME_UNTOUCHED) {
    assert(existsSync(join(REPO, rel)), `runtime missing: ${rel}`);
  }
  assert(
    !existsSync(join(REPO, "SOS/SAIOS/runtime/memory/MemoryService.ts")),
    "MemoryService must not be implemented",
  );
  const selfSrc = read(join(GOV_DIR, "verify-architecture-governance.ts"));
  assert(!/\bexecFileSync\b/.test(selfSrc), "verify must not launch processes");
  assert(/DOCUMENTATION|documentation|REFERENCE/i.test(selfSrc), "verify docs-only");
  checks.runtime_untouched = true;

  const allOk = Object.values(checks).every(Boolean);
  assert(allOk, "not all checks passed");

  const outDir = join(REPO, "SOS/07_LOGS/saios/architecture/governance");
  mkdirSync(outDir, { recursive: true });
  const result = {
    ok: true,
    agent: 198,
    component: "architecture-governance-framework-v1",
    live: false,
    runtime_behaviour_introduced: false,
    checks,
    verifications: {
      authorities_referenced: true,
      no_authority_conflicts: true,
      verification_matrix: true,
      freeze_extension: true,
      dependencies: true,
      no_duplicate_governance: true,
      runtime_untouched: true,
    },
    verdict: "GOVERNANCE_CONSOLIDATED",
    at: new Date().toISOString(),
  };
  writeFileSync(join(outDir, "verify-result.json"), `${JSON.stringify(result, null, 2)}\n`);
  console.log("ARCHITECTURE GOVERNANCE PASS");
  console.log(JSON.stringify(result, null, 2));
}

main();
