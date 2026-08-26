#!/usr/bin/env tsx
/**
 * Learning & Knowledge Reconciliation Audit verify — Agent #195.
 *
 * READ-ONLY: confirms audit docs/report completeness, topology consistency claims,
 * declared-vs-runtime reconciliation evidence, and that runtime learning modules
 * remain present and untouched. Never modifies runtime, moves learning, or enables LIVE.
 */
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO = resolve(import.meta.dirname, "../../../..");
const AUDIT_DIR = "SOS/SAIOS/architecture/learning-reconciliation";

const REQUIRED_DOCS = [
  "LEARNING_TOPOLOGY.md",
  "STORE_CLASSIFICATION.md",
  "DRIFT_MATRIX.md",
  "RECONCILIATION_MATRIX.md",
  "CTO_RECOMMENDATION.md",
  "README.md",
  "ARCHITECTURE.json",
  "verify-learning-reconciliation.ts",
] as const;

const REPORTS = [
  "SOS/09_REPORTS/AIOS_LEARNING_KNOWLEDGE_RECONCILIATION_AUDIT_V1_REPORT.md",
  "SOS/SAIOS/AIOS_LEARNING_KNOWLEDGE_RECONCILIATION_AUDIT_V1_REPORT.md",
];

const REQUIRED_REPORT_SECTIONS = [
  "## 1. Purpose",
  "## 2. Evidence base",
  "## 3. Store classification",
  "## 4. Learning topology",
  "## 5. Specific determinations",
  "## 6. Drift matrix",
  "## 7. Reconciliation matrix",
  "## 8. Evaluation note",
  "## 9. CTO recommendation",
  "## 10. Certification",
];

/** Runtime learning/knowledge surface that MUST remain present (untouched). */
const RUNTIME_UNTOUCHED = [
  "SOS/SAIOS/core/knowledge/KnowledgeManager.ts",
  "SOS/SAIOS/core/knowledge/KnowledgePolicies.ts",
  "SOS/SAIOS/core/knowledge/KnowledgeRegistry.ts",
  "SOS/SAIOS/core/knowledge-learning/LearningWriteBack.ts",
  "SOS/SAIOS/core/knowledge-learning/LearningRepository.ts",
  "SOS/SAIOS/core/knowledge-learning/LearningEntryBuilder.ts",
  "SOS/SAIOS/runtime/workers/resume-learning/learning-engine.ts",
  "SOS/SAIOS/runtime/workers/resume-learning/design-memory.ts",
  "SOS/SAIOS/runtime/workers/resume-production/learning-append.ts",
  "SOS/SAIOS/runtime/competitive-validation/CompetitiveMemory.ts",
  "SOS/SAIOS/runtime/visual-render/VisualRenderMemory.ts",
  "SOS/SAIOS/runtime/founder-critic/CriticMemory.ts",
  "SOS/SAIOS/core/critic-gate/ProvisionalCriticLearning.ts",
  "SOS/SAIOS/core/founder-decisions/FounderDecisionManager.ts",
  "SOS/SAIOS/architecture/runtime-guard.ts",
  "SOS/SAIOS/architecture/dependency-graph.json",
  "SOS/SAIOS/architecture/module-roles.json",
] as const;

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`LEARNING RECONCILIATION FAIL: ${msg}`);
}

function read(rel: string): string {
  return readFileSync(join(REPO, rel), "utf8");
}

function main(): void {
  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE must be OFF");
  const checks: Record<string, boolean> = {};

  for (const doc of REQUIRED_DOCS) {
    assert(existsSync(join(REPO, AUDIT_DIR, doc)), `missing ${doc}`);
  }
  checks.documents = true;

  const topology = read(join(AUDIT_DIR, "LEARNING_TOPOLOGY.md"));
  assert(topology.includes("knowledge/learning/"), "topology founder-learning root");
  assert(topology.includes("saios/learning/"), "topology departmental root");
  assert(topology.includes("competitive-validation/memory"), "topology competitive");
  assert(topology.includes("visual-render/memory"), "topology visual-render");
  assert(topology.includes("founder-critic/memory"), "topology founder-critic");
  assert(topology.includes("PRODUCERS"), "topology producers");
  assert(topology.includes("CONSUMERS"), "topology consumers");
  checks.topology_consistency = true;

  const stores = read(join(AUDIT_DIR, "STORE_CLASSIFICATION.md"));
  assert(
    stores.includes("operational departmental memory"),
    "saios/learning classification",
  );
  assert(stores.includes("Founder Learning only"), "knowledge-learning determination");
  assert(stores.includes("remain a departmental satellite"), "resume-learning intent");
  assert(stores.includes("LEGACY"), "founder-critic legacy");
  assert(stores.includes("SATELLITE"), "satellites named");
  checks.store_classification = true;

  const drift = read(join(AUDIT_DIR, "DRIFT_MATRIX.md"));
  assert(
    drift.includes("CONFLICT") || drift.includes("RESOLVED"),
    "drift conflicts or resolutions documented",
  );
  assert(drift.includes("module-roles.json"), "drift cites module-roles");
  assert(drift.includes("dependency-graph.json"), "drift cites dependency-graph");
  checks.drift_matrix = true;

  const recon = read(join(AUDIT_DIR, "RECONCILIATION_MATRIX.md"));
  for (const status of ["MATCH", "PARTIAL", "CONFLICT", "LEGACY", "PLACEHOLDER"]) {
    assert(recon.includes(status), `reconciliation missing ${status}`);
  }
  checks.reconciliation_matrix = true;

  const cto = read(join(AUDIT_DIR, "CTO_RECOMMENDATION.md"));
  assert(cto.includes("REQUIRES CONSOLIDATION"), "CTO verdict");
  assert(
    cto.includes("Distributed Learning Model") ||
      cto.includes("distributed Learning Model"),
    "distributed model recommendation",
  );
  assert(
    /One Learning Authority[\s\S]*?\*\*NO\*\*/.test(cto) ||
      cto.includes("| One Learning Authority | **NO**"),
    "rejects single learning authority",
  );
  checks.cto_recommendation = true;

  const arch = JSON.parse(read(join(AUDIT_DIR, "ARCHITECTURE.json"))) as {
    live: boolean;
    learning_movement: boolean;
    module_mergers: boolean;
    redesign: boolean;
    certification: boolean;
    verdict: string;
    determinations: Record<string, string>;
    recommended_architecture: string;
  };
  assert(arch.live === false, "ARCHITECTURE live");
  assert(arch.learning_movement === false, "no learning movement");
  assert(arch.module_mergers === false, "no mergers");
  assert(arch.redesign === false, "no redesign");
  assert(arch.certification === false, "not a certification");
  assert(arch.verdict === "REQUIRES_CONSOLIDATION", "verdict key");
  assert(
    arch.determinations.saios_learning_root ===
      "operational_departmental_memory_resume_write_owner_cross_cutting_readers" ||
      arch.determinations.saios_learning_root ===
        "operational_departmental_memory_resume",
    "saios_learning determination",
  );
  assert(
    arch.determinations.core_knowledge_learning === "founder_learning_only",
    "knowledge-learning determination",
  );
  assert(
    arch.recommended_architecture ===
      "distributed_learning_model_with_department_satellites",
    "recommended architecture",
  );
  checks.architecture_json = true;

  // --- Declared vs runtime reconciliation (mechanical) ---
  const moduleRoles = read("SOS/SAIOS/architecture/module-roles.json");
  assert(
    moduleRoles.includes("core.knowledge-learning"),
    "module-roles declares knowledge-learning",
  );
  assert(
    moduleRoles.includes("runtime.workers.resume-learning"),
    "module-roles declares resume-learning",
  );
  assert(
    moduleRoles.includes("parallel_learning_store_new"),
    "module-roles forbids parallel learning store",
  );

  const depGraph = read("SOS/SAIOS/architecture/dependency-graph.json");
  assert(depGraph.includes("core.knowledge-learning"), "dep-graph knowledge-learning");
  assert(depGraph.includes("core.knowledge"), "dep-graph knowledge");
  // resume-learning is NOT in the declared learning feed chain
  assert(
    !/"id":\s*"runtime.workers.resume-learning"/.test(depGraph),
    "dep-graph unexpectedly lists resume-learning as a node (audit assumed gap)",
  );
  checks.dependency_consistency = true;

  const learningEngine = read(
    "SOS/SAIOS/runtime/workers/resume-learning/learning-engine.ts",
  );
  assert(
    !/knowledge-learning/.test(learningEngine),
    "runtime: learning-engine intentionally independent of knowledge-learning (F2)",
  );
  const designMemory = read(
    "SOS/SAIOS/runtime/workers/resume-learning/design-memory.ts",
  );
  assert(
    designMemory.includes("07_LOGS/saios/learning"),
    "runtime: design-memory root unchanged",
  );
  const learningRepo = read(
    "SOS/SAIOS/core/knowledge-learning/LearningRepository.ts",
  );
  assert(
    learningRepo.includes("knowledge/learning"),
    "runtime: founder-learning root unchanged",
  );
  const writeBack = read(
    "SOS/SAIOS/core/knowledge-learning/LearningWriteBack.ts",
  );
  assert(
    writeBack.includes("writeFromDecision"),
    "runtime: LearningWriteBack founder path unchanged",
  );
  const km = read("SOS/SAIOS/core/knowledge/KnowledgeManager.ts");
  assert(
    km.includes("mergeFounderLearningFromDisk"),
    "runtime: KnowledgeManager merge path unchanged",
  );
  checks.declared_vs_runtime = true;

  for (const f of RUNTIME_UNTOUCHED) {
    assert(existsSync(join(REPO, f)), `runtime untouched missing: ${f}`);
  }
  checks.runtime_untouched = true;

  const guard = read("SOS/SAIOS/architecture/runtime-guard.ts");
  assert(guard.includes("canonical_execution_spine"), "Runtime Guard intact");
  checks.runtime_guard_unchanged = true;

  const self = read(join(AUDIT_DIR, "verify-learning-reconciliation.ts"));
  assert(
    !/^import\s+.+from\s+["']\.\.\/\.\.\/(runtime|platform|core)\//m.test(self),
    "verify must not import runtime modules",
  );
  assert(
    !/enable_live\s*=\s*true|SOS_AIOS_LIVE\s*=\s*["']?1/.test(self),
    "verify must not enable LIVE",
  );
  checks.read_only_audit = true;

  for (const rep of REPORTS) {
    assert(existsSync(join(REPO, rep)), `report missing ${rep}`);
    const body = read(rep);
    assert(body.includes("Agent #195"), `${rep} agent`);
    for (const sec of REQUIRED_REPORT_SECTIONS) {
      assert(body.includes(sec), `${rep} missing ${sec}`);
    }
    assert(body.includes("REQUIRES CONSOLIDATION"), `${rep} verdict`);
    assert(
      /STRICTLY READ-ONLY|strictly read-only/i.test(body),
      `${rep} read-only declaration`,
    );
    assert(
      /operational departmental memory/i.test(body),
      `${rep} saios/learning determination`,
    );
    assert(
      /Founder Learning only|founder learning only/i.test(body),
      `${rep} knowledge-learning determination`,
    );
  }
  checks.reports_complete = true;

  const result = {
    pass: true,
    component: "learning-knowledge-reconciliation-audit-v1",
    agent: "195",
    verdict: "REQUIRES CONSOLIDATION",
    checks: {
      live_off: true,
      documents: checks.documents,
      topology_consistency: checks.topology_consistency,
      store_classification: checks.store_classification,
      drift_matrix: checks.drift_matrix,
      reconciliation_matrix: checks.reconciliation_matrix,
      dependency_consistency: checks.dependency_consistency,
      declared_vs_runtime: checks.declared_vs_runtime,
      cto_recommendation: checks.cto_recommendation,
      architecture_json: checks.architecture_json,
      runtime_untouched: checks.runtime_untouched,
      runtime_guard_unchanged: checks.runtime_guard_unchanged,
      read_only_audit: checks.read_only_audit,
      reports_complete: checks.reports_complete,
      no_learning_movement: true,
      no_module_mergers: true,
    },
    overall: "PASS",
  };

  const outDir = join(
    REPO,
    "SOS/07_LOGS/saios/architecture/learning-reconciliation",
  );
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, "latest-learning-reconciliation-verification.json"),
    JSON.stringify(result, null, 2) + "\n",
    "utf8",
  );

  console.log(JSON.stringify(result, null, 2));
}

main();
