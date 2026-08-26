#!/usr/bin/env tsx
/**
 * Factory V1 Finalization verification.
 * AGENT #099
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { getResumeCatalogSnapshotFromRoot } from "../../../../src/lib/resumeCatalogRuntime.js";
import { verifyRelease } from "../publication/ReleaseManager.js";
import { buildRuntimeDependencyGraph } from "./DependencyGraphBuilder.js";
import { OPS_DIR, REPORT_DIR } from "./DocumentationGenerator.js";
import {
  FACTORY_FINALIZATION,
  runFactoryFinalization,
  STATE_PATH,
} from "./FactoryFinalizationManager.js";
import { SUBSYSTEM_REGISTRY } from "./SubsystemVerifier.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
const SOS_ROOT = join(REPO_ROOT, "SOS");

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function main(): void {
  assert(FACTORY_FINALIZATION.module === "factory-finalization", "module id");
  assert(FACTORY_FINALIZATION.agent === "099", "agent number");

  const preState = JSON.parse(readFileSync(STATE_PATH, "utf8")) as {
    next_agent: string;
    latest_agent: string;
    latest_release: string;
    latest_catalog: string;
  };
  assert(
    preState.next_agent === "099" || preState.latest_agent === "099",
    "pre-flight: expected agent #099",
  );

  const integrity = JSON.parse(
    readFileSync(join(SOS_ROOT, "07_LOGS/saios/catalog-integrity/publication-safety.json"), "utf8"),
  ) as { safe_to_publish: boolean };
  assert(integrity.safe_to_publish, "catalog integrity PASS");

  const batch = JSON.parse(
    readFileSync(join(SOS_ROOT, "07_LOGS/saios/batch-release/batch-release-summary.json"), "utf8"),
  ) as { dry_run: boolean };
  assert(batch.dry_run === true, "batch release PASS");

  const { readiness, artifacts } = runFactoryFinalization();

  const requiredReports = [
    "factory-architecture.md",
    "operations-manual.md",
    "maintenance-guide.md",
    "release-checklist.md",
    "founder-operations.md",
    "developer-onboarding.md",
    "disaster-recovery.md",
    "factory-final-report.md",
  ];
  for (const file of requiredReports) {
    assert(existsSync(join(REPORT_DIR, file)), `report: ${file}`);
  }

  assert(existsSync(join(OPS_DIR, "runtime-dependency-graph.json")), "dependency graph");
  assert(existsSync(join(OPS_DIR, "production-readiness.json")), "production readiness");

  const saved = JSON.parse(readFileSync(STATE_PATH, "utf8")) as {
    latest_agent: string;
    next_agent: string;
    factory_v1: Record<string, unknown>;
  };
  assert(saved.latest_agent === "099", "factory state latest_agent");
  assert(saved.next_agent === "100", "factory state next_agent");
  assert(saved.factory_v1?.status === "STABLE", "V1 STABLE lock");
  assert(saved.factory_v1?.production_ready === true, "V1 production ready");

  for (const sub of SUBSYSTEM_REGISTRY) {
    assert(existsSync(join(REPO_ROOT, sub.module_path)), `module available: ${sub.id}`);
  }

  const graph = buildRuntimeDependencyGraph();
  assert(graph.nodes.length >= 18, "runtime dependencies valid");

  const failed = readiness.subsystems.filter((s) => s.status === "fail");
  assert(failed.length === 0, `no failed subsystems: ${failed.map((f) => f.id).join(", ")}`);

  const t094 = verifyRelease({ catalog_id: "t094", target_root: REPO_ROOT });
  assert(t094.pass, "t094 live release integrity");

  const runtime = getResumeCatalogSnapshotFromRoot(REPO_ROOT);
  assert(runtime.templates.some((t) => t.id === "t094"), "runtime catalog t094");

  const checks = {
    every_runtime_module_available: SUBSYSTEM_REGISTRY.every((s) =>
      existsSync(join(REPO_ROOT, s.module_path)),
    ),
    every_verification_passes: failed.length === 0,
    factory_state_consistent: saved.latest_agent === "099",
    runtime_dependencies_valid: graph.pipeline_order.length >= 14,
    no_broken_integrations: t094.pass && runtime.templates.length > 0,
    resume_factory_production_ready: readiness.production_ready,
  };

  assert(Object.values(checks).every(Boolean), "all verification checks");
  assert(readiness.readiness_score >= 85, "readiness score threshold");

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "factory-finalization",
        agent: "099",
        readiness_score: readiness.readiness_score,
        factory_v1_status: readiness.factory_v1_status,
        feature_complete: readiness.feature_complete,
        production_ready: readiness.production_ready,
        foundation_locked: readiness.foundation_locked,
        subsystems_passed: readiness.subsystems.filter(
          (s) => s.status === "pass" || s.status === "read_only_pass",
        ).length,
        subsystems_total: readiness.subsystems.length,
        report_dir: artifacts.report_dir,
        checks,
      },
      null,
      2,
    ),
  );
}

main();
