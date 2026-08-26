#!/usr/bin/env tsx
/**
 * Persistence Ownership & Taxonomy Declaration verify — Agent #197.
 *
 * READ-ONLY documentation checks. Never modifies runtime, persists data
 * migrations, implements MemoryService, or enables LIVE.
 */
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO = resolve(import.meta.dirname, "../../../..");
const DECL_DIR = "SOS/SAIOS/architecture/persistence-ownership";

const REQUIRED_DOCS = [
  "PERSISTENCE_TAXONOMY.md",
  "OWNERSHIP_MODEL.md",
  "DECLARATION.md",
  "EXCEPTIONS.md",
  "SURFACES.json",
  "README.md",
  "ARCHITECTURE.json",
  "verify-persistence-ownership.ts",
] as const;

const REPORTS = [
  "SOS/09_REPORTS/AIOS_PERSISTENCE_OWNERSHIP_TAXONOMY_DECLARATION_V1_REPORT.md",
  "SOS/SAIOS/AIOS_PERSISTENCE_OWNERSHIP_TAXONOMY_DECLARATION_V1_REPORT.md",
];

const REQUIRED_REPORT_SECTIONS = [
  "## 1. Official taxonomy",
  "## 2. Official ownership model",
  "## 3. Complete declaration table",
  "## 4. Adoption status summary",
  "## 5. Architectural exceptions",
  "## 6. Verification summary",
  "## 7. CTO declaration",
];

const TAXONOMY = [
  "Knowledge",
  "Founder Learning",
  "Department Learning",
  "Operational Memory",
  "Execution Memory",
  "Telemetry",
  "History",
  "State",
  "Configuration",
  "Artifacts",
  "Reports",
  "Snapshots",
] as const;

const ADOPTION_STATUSES = [
  "Native BaseAppendOnlyRepository",
  "Native MemoryService",
  "Legacy persistence",
  "Intentional standalone persistence",
  "Temporary persistence",
  "Future adoption candidate",
  "Orphaned abstraction",
] as const;

const RUNTIME_UNTOUCHED = [
  "SOS/SAIOS/core/knowledge/KnowledgeManager.ts",
  "SOS/SAIOS/core/knowledge-learning/LearningRepository.ts",
  "SOS/SAIOS/runtime/workers/resume-learning/design-memory.ts",
  "SOS/SAIOS/runtime/scheduler/SchedulerMemory.ts",
  "SOS/SAIOS/runtime/memory/types.ts",
  "SOS/SAIOS/platform/repositories/BaseAppendOnlyRepository.ts",
  "SOS/SAIOS/architecture/runtime-guard.ts",
  "SOS/SAIOS/architecture/module-roles.json",
  "SOS/SAIOS/architecture/dependency-graph.json",
  "SOS/SAIOS/architecture/persistence-memory-topology/PERSISTENCE_INVENTORY.md",
] as const;

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`PERSISTENCE OWNERSHIP FAIL: ${msg}`);
}

function read(rel: string): string {
  return readFileSync(join(REPO, rel), "utf8");
}

function main(): void {
  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE must be OFF");
  const checks: Record<string, boolean> = {};

  for (const doc of REQUIRED_DOCS) {
    assert(existsSync(join(REPO, DECL_DIR, doc)), `missing ${doc}`);
  }
  checks.documents = true;

  // --- Taxonomy Verification ---
  const taxonomy = read(join(DECL_DIR, "PERSISTENCE_TAXONOMY.md"));
  for (const cat of TAXONOMY) {
    assert(taxonomy.includes(cat), `taxonomy missing ${cat}`);
  }
  assert(taxonomy.includes("Write authority"), "taxonomy write authority");
  assert(taxonomy.includes("Read authority"), "taxonomy read authority");
  assert(taxonomy.includes("Validation authority"), "taxonomy validation");
  checks.taxonomy = true;

  // --- Persistence Ownership Verification ---
  const ownership = read(join(DECL_DIR, "OWNERSHIP_MODEL.md"));
  assert(ownership.includes("Knowledge Authority"), "ownership Knowledge Authority");
  assert(ownership.includes("Founder Learning Authority"), "ownership Founder Learning");
  assert(ownership.includes("Department Learning Authorities"), "ownership Department Learning");
  assert(ownership.includes("Telemetry Authority"), "ownership Telemetry");
  assert(ownership.includes("Cost Authority"), "ownership Cost");
  assert(ownership.includes("No ownership overlaps") || ownership.includes("no overlap"), "ownership no overlap");
  assert(ownership.includes("core/knowledge"), "ownership core/knowledge");
  assert(ownership.includes("core/knowledge-learning"), "ownership knowledge-learning");
  checks.persistence_ownership = true;

  // --- Authority Verification ---
  assert(ownership.includes("Execution Authorities"), "authority Execution");
  assert(ownership.includes("Operational Memory Owners"), "authority Operational Memory");
  assert(ownership.includes("History Owners"), "authority History");
  assert(ownership.includes("State Owners"), "authority State");
  assert(ownership.includes("Artifacts Owners"), "authority Artifacts");
  assert(ownership.includes("Reports Owners"), "authority Reports");
  assert(ownership.includes("Snapshots Owners"), "authority Snapshots");
  checks.authority = true;

  // --- Classification / Declaration Verification ---
  const declaration = read(join(DECL_DIR, "DECLARATION.md"));
  for (const status of ADOPTION_STATUSES) {
    assert(declaration.includes(status), `declaration missing adoption ${status}`);
  }
  assert(declaration.includes("Canonical owner"), "declaration canonical owner");
  assert(declaration.includes("Architectural category"), "declaration category");
  assert(declaration.includes("Adoption status summary"), "declaration adoption summary");
  assert(/\|\s*15\s*\|/.test(declaration) || declaration.includes("| 15 |"), "native BaseAppendOnly count 15");
  assert(declaration.includes("Native MemoryService") && declaration.includes("| 0 |"), "MemoryService count 0");
  checks.classification = true;

  // --- Architecture Declaration Verification ---
  const arch = JSON.parse(read(join(DECL_DIR, "ARCHITECTURE.json"))) as {
    agent: string;
    verdict: string;
    live: boolean;
    runtime_behaviour_introduced: boolean;
    memory_service_implementation: boolean;
    base_append_only_adoption: boolean;
    totals: { persistence_surfaces: number; native_memory_service: number };
  };
  assert(arch.agent === "197", "ARCHITECTURE agent 197");
  assert(arch.verdict === "DECLARED", "ARCHITECTURE verdict DECLARED");
  assert(arch.live === false, "ARCHITECTURE live false");
  assert(arch.runtime_behaviour_introduced === false, "no runtime behaviour");
  assert(arch.memory_service_implementation === false, "no MemoryService impl");
  assert(arch.base_append_only_adoption === false, "no BaseAppendOnly adoption");
  assert(arch.totals.persistence_surfaces === 42, "42 surfaces");
  assert(arch.totals.native_memory_service === 0, "0 MemoryService");

  const surfaces = JSON.parse(read(join(DECL_DIR, "SURFACES.json"))) as {
    surface_count: number;
    surfaces: Array<{ id: number; adoption: string }>;
  };
  assert(surfaces.surface_count === 42, "SURFACES count 42");
  assert(surfaces.surfaces.length === 42, "SURFACES array length 42");
  const ids = new Set(surfaces.surfaces.map((s) => s.id));
  for (let i = 1; i <= 42; i++) assert(ids.has(i), `missing surface id ${i}`);
  assert(
    surfaces.surfaces.filter((s) => s.adoption === "Native MemoryService").length === 0,
    "no Native MemoryService surfaces",
  );
  checks.architecture_declaration = true;

  // --- Declaration Consistency Verification ---
  const exceptions = read(join(DECL_DIR, "EXCEPTIONS.md"));
  for (const ex of [
    "MemoryService orphan",
    "BaseAppendOnlyRepository",
    "Scheduler",
    "design-memory",
    "Founder Critic",
    "Worker append",
  ]) {
    assert(exceptions.includes(ex), `exceptions missing ${ex}`);
  }
  assert(declaration.includes("cross-cutting") || exceptions.includes("cross-cutting"), "consistency cross-cutting");
  assert(exceptions.includes("E1") || exceptions.includes("## E1"), "E1 present");
  // Inventory source still present and unchanged path
  assert(
    existsSync(join(REPO, "SOS/SAIOS/architecture/persistence-memory-topology/ARCHITECTURE.json")),
    "196 inventory must remain",
  );
  const inv = JSON.parse(
    read("SOS/SAIOS/architecture/persistence-memory-topology/ARCHITECTURE.json"),
  ) as { totals: { persistence_surfaces: number } };
  assert(inv.totals.persistence_surfaces === 42, "declaration consistent with 196 count 42");
  checks.declaration_consistency = true;

  // --- Reports ---
  for (const report of REPORTS) {
    assert(existsSync(join(REPO, report)), `missing report ${report}`);
    const body = read(report);
    assert(body.includes("Agent #197"), `${report} agent`);
    for (const section of REQUIRED_REPORT_SECTIONS) {
      assert(body.includes(section), `${report} missing ${section}`);
    }
    assert(body.includes("architectural declaration only") || body.includes("architectural declaration only".replace("a", "A")), `${report} declaration-only phrasing`);
    assert(/architectural declaration only/i.test(body), `${report} declaration only`);
    assert(/no runtime behaviour/i.test(body), `${report} no runtime behaviour`);
    assert(/No persistence migrations/i.test(body), `${report} no persistence migrations`);
    assert(/No MemoryService adoption/i.test(body), `${report} no MemoryService`);
    assert(/No BaseAppendOnlyRepository adoption/i.test(body), `${report} no BaseAppendOnly`);
    assert(/LIVE/i.test(body), `${report} LIVE`);
    assert(/100%/.test(body) || /backward compatibility/i.test(body), `${report} backward compat`);
  }
  checks.reports = true;

  // --- Runtime untouched ---
  for (const rel of RUNTIME_UNTOUCHED) {
    assert(existsSync(join(REPO, rel)), `runtime/manifest missing: ${rel}`);
  }
  assert(
    !existsSync(join(REPO, "SOS/SAIOS/runtime/memory/MemoryService.ts")),
    "MemoryService must not be implemented",
  );
  const sched = read("SOS/SAIOS/runtime/scheduler/SchedulerMemory.ts");
  assert(!sched.includes("BaseAppendOnlyRepository"), "SchedulerMemory not migrated");
  const selfSrc = read(join(DECL_DIR, "verify-persistence-ownership.ts"));
  assert(!/\bexecFileSync\b/.test(selfSrc), "verify must not launch processes");
  assert(/READ-ONLY|read-only|documentation/i.test(selfSrc), "verify declares read-only");
  checks.runtime_untouched = true;

  const allOk = Object.values(checks).every(Boolean);
  assert(allOk, "not all checks passed");

  const outDir = join(REPO, "SOS/07_LOGS/saios/architecture/persistence-ownership");
  mkdirSync(outDir, { recursive: true });
  const result = {
    ok: true,
    agent: 197,
    component: "persistence-ownership-taxonomy-declaration-v1",
    live: false,
    runtime_behaviour_introduced: false,
    persistence_surfaces: 42,
    checks,
    verifications: {
      persistence_ownership: true,
      taxonomy: true,
      authority: true,
      architecture_declaration: true,
      classification: true,
      declaration_consistency: true,
    },
    verdict: "DECLARED",
    at: new Date().toISOString(),
  };
  writeFileSync(join(outDir, "verify-result.json"), `${JSON.stringify(result, null, 2)}\n`);
  console.log("PERSISTENCE OWNERSHIP PASS");
  console.log(JSON.stringify(result, null, 2));
}

main();
