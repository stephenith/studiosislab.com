#!/usr/bin/env tsx
/**
 * Persistence & Memory Topology Reconciliation verify — Agent #196.
 *
 * READ-ONLY: confirms inventory docs/report completeness and that runtime
 * persistence modules remain present and untouched. Never modifies runtime,
 * migrates stores, implements MemoryService, or enables LIVE.
 */
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO = resolve(import.meta.dirname, "../../../..");
const AUDIT_DIR = "SOS/SAIOS/architecture/persistence-memory-topology";

const REQUIRED_DOCS = [
  "PERSISTENCE_INVENTORY.md",
  "OWNERSHIP_TOPOLOGY.md",
  "CLASSIFICATION.md",
  "ADOPTION_GAPS.md",
  "DRIFT_MATRIX.md",
  "TAXONOMY.md",
  "SCALABILITY.md",
  "CTO_RECOMMENDATION.md",
  "README.md",
  "ARCHITECTURE.json",
  "verify-persistence-memory-topology.ts",
] as const;

const REPORTS = [
  "SOS/09_REPORTS/AIOS_PERSISTENCE_MEMORY_TOPOLOGY_RECONCILIATION_V1_REPORT.md",
  "SOS/SAIOS/AIOS_PERSISTENCE_MEMORY_TOPOLOGY_RECONCILIATION_V1_REPORT.md",
];

const REQUIRED_REPORT_SECTIONS = [
  "## 1. Total persistence stores discovered",
  "## 2. Ownership map",
  "## 3. Classification table",
  "## 4. Repository adoption table",
  "## 5. MemoryService adoption table",
  "## 6. BaseAppendOnlyRepository adoption table",
  "## 7. Architectural drift summary",
  "## 8. Orphaned abstractions",
  "## 9. Naming collisions",
  "## 10. Scalability assessment",
  "## 11. CTO recommendation",
];

/** Runtime persistence surfaces that MUST remain present (untouched). */
const RUNTIME_UNTOUCHED = [
  "SOS/SAIOS/core/knowledge/KnowledgeManager.ts",
  "SOS/SAIOS/core/knowledge-learning/LearningRepository.ts",
  "SOS/SAIOS/core/knowledge-learning/LearningWriteBack.ts",
  "SOS/SAIOS/runtime/workers/resume-learning/design-memory.ts",
  "SOS/SAIOS/runtime/workers/resume-learning/learning-engine.ts",
  "SOS/SAIOS/runtime/workers/resume-production/learning-append.ts",
  "SOS/SAIOS/runtime/workers/resume-production/learning-append-v3.ts",
  "SOS/SAIOS/runtime/design-brain/DesignMemory.ts",
  "SOS/SAIOS/runtime/adaptive-composer/ComposerMemory.ts",
  "SOS/SAIOS/runtime/benchmark/BenchmarkMemory.ts",
  "SOS/SAIOS/runtime/publication/PublicationMemory.ts",
  "SOS/SAIOS/runtime/competitive-validation/CompetitiveMemory.ts",
  "SOS/SAIOS/runtime/visual-render/VisualRenderMemory.ts",
  "SOS/SAIOS/runtime/scheduler/SchedulerMemory.ts",
  "SOS/SAIOS/runtime/research/ResearchMemory.ts",
  "SOS/SAIOS/runtime/founder-critic/CriticMemory.ts",
  "SOS/SAIOS/runtime/memory/types.ts",
  "SOS/SAIOS/platform/repositories/BaseAppendOnlyRepository.ts",
  "SOS/SAIOS/architecture/runtime-guard.ts",
  "SOS/SAIOS/architecture/dependency-graph.json",
  "SOS/SAIOS/architecture/module-roles.json",
] as const;

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`PERSISTENCE MEMORY TOPOLOGY FAIL: ${msg}`);
}

function read(rel: string): string {
  return readFileSync(join(REPO, rel), "utf8");
}

function main(): void {
  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE must be OFF");
  const checks: Record<string, boolean> = {};

  // --- Persistence Topology Verification ---
  for (const doc of REQUIRED_DOCS) {
    assert(existsSync(join(REPO, AUDIT_DIR, doc)), `missing ${doc}`);
  }
  const inventory = read(join(AUDIT_DIR, "PERSISTENCE_INVENTORY.md"));
  assert(inventory.includes("Total surfaces: 42"), "inventory total 42");
  assert(inventory.includes("knowledge/learning"), "inventory founder learning");
  assert(inventory.includes("scheduler-learning"), "inventory scheduler learning");
  assert(inventory.includes("composer-learning"), "inventory composer");
  assert(inventory.includes("founder-preferences"), "inventory design-brain");
  assert(inventory.includes("benchmark-learning"), "inventory benchmark");
  assert(inventory.includes("publication-learning"), "inventory publication");
  assert(inventory.includes("BaseAppendOnlyRepository"), "inventory cites BaseAppendOnly");
  assert(inventory.includes("MemoryService"), "inventory cites MemoryService");
  checks.persistence_topology = true;

  // --- Memory Topology Verification ---
  const ownership = read(join(AUDIT_DIR, "OWNERSHIP_TOPOLOGY.md"));
  assert(ownership.includes("CROSS-CUTTING") || ownership.includes("cross-cutting"), "ownership cross-cutting");
  assert(ownership.includes("design-memory"), "ownership design-memory");
  assert(ownership.includes("Misplaced") || ownership.includes("misplaced"), "ownership misplaced");
  assert(ownership.includes("Orphan") || ownership.includes("orphan"), "ownership orphan");
  assert(ownership.includes("DesignMemory"), "ownership naming collision DesignMemory");
  const taxonomy = read(join(AUDIT_DIR, "TAXONOMY.md"));
  assert(taxonomy.includes("Knowledge"), "taxonomy Knowledge");
  assert(taxonomy.includes("Learning"), "taxonomy Learning");
  assert(taxonomy.includes("Operational Memory"), "taxonomy Operational Memory");
  assert(taxonomy.includes("Execution Memory"), "taxonomy Execution Memory");
  assert(taxonomy.includes("Telemetry"), "taxonomy Telemetry");
  checks.memory_topology = true;

  // --- Ownership Verification ---
  assert(ownership.includes("Canonical owners") || ownership.includes("canonical"), "canonical owners");
  assert(ownership.includes("Satellite") || ownership.includes("satellite"), "satellites");
  assert(
    ownership.includes("scheduler-learning"),
    "ownership scheduler misplaced evidence",
  );
  checks.ownership = true;

  // --- Classification Verification ---
  const classification = read(join(AUDIT_DIR, "CLASSIFICATION.md"));
  for (const cat of [
    "Knowledge Authority",
    "Founder Learning",
    "Department Learning",
    "Operational Memory",
    "Execution Memory",
    "Telemetry",
    "History",
    "State",
    "Temporary",
    "Legacy",
    "Duplicate",
  ]) {
    assert(classification.includes(cat), `classification missing ${cat}`);
  }
  assert(classification.includes("Total") || classification.includes("42"), "classification totals");
  checks.classification = true;

  // --- Architecture Drift Verification ---
  const drift = read(join(AUDIT_DIR, "DRIFT_MATRIX.md"));
  assert(drift.includes("CONFLICT"), "drift CONFLICT");
  assert(drift.includes("module-roles.json"), "drift module-roles");
  assert(drift.includes("dependency-graph.json"), "drift dependency-graph");
  assert(drift.includes("Learning Reconciliation") || drift.includes("#195"), "drift cites #195");
  assert(drift.includes("Execution Authority") || drift.includes("#194"), "drift cites #194");
  assert(drift.includes("Scheduler"), "drift scheduler");
  checks.architecture_drift = true;

  // --- Adoption Gap Verification ---
  const gaps = read(join(AUDIT_DIR, "ADOPTION_GAPS.md"));
  assert(gaps.includes("BaseAppendOnlyRepository"), "gaps BaseAppendOnly");
  assert(gaps.includes("MemoryService"), "gaps MemoryService");
  assert(gaps.includes("should already be using"), "gaps should-already-using");
  assert(gaps.includes("intentionally should NOT"), "gaps intentional non-use");
  assert(gaps.includes("LearningRepository"), "gaps LearningRepository");
  assert(gaps.includes("None") || gaps.includes("zero") || gaps.includes("0"), "gaps zero MemoryService impl");
  checks.adoption_gaps = true;

  // --- Scalability Verification ---
  const scale = read(join(AUDIT_DIR, "SCALABILITY.md"));
  assert(scale.includes("Website"), "scale Website");
  assert(scale.includes("fragmentation"), "scale fragmentation");
  assert(scale.includes("No.") || scale.includes("does not scale") || scale.includes("would increase"), "scale negative");
  assert(scale.includes("MemoryService"), "scale cites MemoryService");
  checks.scalability = true;

  // --- CTO + ARCHITECTURE.json ---
  const cto = read(join(AUDIT_DIR, "CTO_RECOMMENDATION.md"));
  assert(cto.includes("REQUIRES DECLARATION"), "CTO verdict");
  assert(
    cto.includes("Persistence Ownership & Taxonomy Declaration") ||
      cto.includes("persistence_ownership_and_taxonomy_declaration"),
    "CTO next milestone",
  );
  assert(!/implement MemoryService|migrate.*BaseAppendOnly/i.test(cto.split("## Correct next")[1] ?? cto) ||
    cto.includes("must NOT"), "CTO must not prescribe implementation as next");
  const arch = JSON.parse(read(join(AUDIT_DIR, "ARCHITECTURE.json"))) as {
    agent: string;
    totals: { persistence_surfaces: number; memory_service_implementations: number };
    verdict: string;
    live: boolean;
  };
  assert(arch.agent === "196", "ARCHITECTURE agent 196");
  assert(arch.totals.persistence_surfaces === 42, "ARCHITECTURE surfaces 42");
  assert(arch.totals.memory_service_implementations === 0, "ARCHITECTURE MemoryService 0");
  assert(arch.verdict === "REQUIRES_DECLARATION", "ARCHITECTURE verdict");
  assert(arch.live === false, "ARCHITECTURE live false");
  checks.cto_architecture = true;

  // --- Reports ---
  for (const report of REPORTS) {
    assert(existsSync(join(REPO, report)), `missing report ${report}`);
    const body = read(report);
    assert(body.includes("Agent #196"), `${report} agent`);
    for (const section of REQUIRED_REPORT_SECTIONS) {
      assert(body.includes(section), `${report} missing ${section}`);
    }
    assert(body.includes("42"), `${report} total 42`);
    assert(body.includes("REQUIRES DECLARATION"), `${report} verdict`);
    assert(body.includes("LIVE"), `${report} LIVE`);
    assert(
      body.includes("cross-cutting") || body.includes("CROSS-CUTTING"),
      `${report} cross-cutting design-memory`,
    );
  }
  checks.reports = true;

  // --- Runtime untouched ---
  for (const rel of RUNTIME_UNTOUCHED) {
    assert(existsSync(join(REPO, rel)), `runtime missing/moved: ${rel}`);
  }
  // Ensure learning memory files do not suddenly extend BaseAppendOnly
  const composer = read("SOS/SAIOS/runtime/adaptive-composer/ComposerMemory.ts");
  assert(
    !composer.includes("BaseAppendOnlyRepository"),
    "ComposerMemory must remain non-migrated (read-only audit)",
  );
  const schedMem = read("SOS/SAIOS/runtime/scheduler/SchedulerMemory.ts");
  assert(
    !schedMem.includes("BaseAppendOnlyRepository"),
    "SchedulerMemory must remain non-migrated",
  );
  const memTypes = read("SOS/SAIOS/runtime/memory/types.ts");
  assert(memTypes.includes("MemoryService"), "MemoryService types remain");
  assert(
    !existsSync(join(REPO, "SOS/SAIOS/runtime/memory/MemoryService.ts")),
    "MemoryService must not have been implemented by this agent",
  );
  checks.runtime_untouched = true;

  // Self: read-only posture (no child-process launches)
  const selfSrc = read(join(AUDIT_DIR, "verify-persistence-memory-topology.ts"));
  assert(
    !/\bchild_process\b/.test(selfSrc) && !/\bexecFileSync\b/.test(selfSrc),
    "verify must not spawn runtime",
  );
  assert(/READ-ONLY|read-only/.test(selfSrc), "verify declares read-only");
  checks.verify_readonly = true;

  const allOk = Object.values(checks).every(Boolean);
  assert(allOk, "not all checks passed");

  const outDir = join(REPO, "SOS/07_LOGS/saios/architecture/persistence-memory-topology");
  mkdirSync(outDir, { recursive: true });
  const result = {
    ok: true,
    agent: 196,
    component: "persistence-memory-topology-reconciliation-v1",
    live: false,
    persistence_surfaces: 42,
    checks,
    verifications: {
      persistence_topology: true,
      memory_topology: true,
      ownership: true,
      classification: true,
      architecture_drift: true,
      adoption_gaps: true,
      scalability: true,
    },
    verdict: "REQUIRES_DECLARATION",
    next_milestone: "persistence_ownership_and_taxonomy_declaration_v1",
    at: new Date().toISOString(),
  };
  writeFileSync(join(outDir, "verify-result.json"), `${JSON.stringify(result, null, 2)}\n`);
  console.log("PERSISTENCE MEMORY TOPOLOGY PASS");
  console.log(JSON.stringify(result, null, 2));
}

main();
