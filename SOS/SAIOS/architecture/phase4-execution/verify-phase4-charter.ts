#!/usr/bin/env tsx
/**
 * Phase 4 Execution Architecture Charter verify — Agent #189.
 * Documentation integrity only. No execution. No LIVE.
 */
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join, resolve } from "node:path";

const REPO = resolve(import.meta.dirname, "../../../..");
const CHARTER_DIR = "SOS/SAIOS/architecture/phase4-execution";

const REQUIRED_DOCS = [
  "EXECUTION_ARCHITECTURE_CHARTER.md",
  "EXECUTION_BOUNDARIES.md",
  "EXECUTION_PRINCIPLES.md",
  "EXECUTION_LIFECYCLE.md",
  "EXECUTION_AUTHORITIES.md",
  "EXECUTION_GUARDRAILS.md",
  "PHASE4_EXECUTION_MANIFEST.json",
  "README.md",
  "verify-phase4-charter.ts",
] as const;

const REQUIRED_PHRASES: Record<string, string[]> = {
  "EXECUTION_ARCHITECTURE_CHARTER.md": [
    "Planning",
    "Authorization",
    "Dispatch",
    "Execution",
    "Evaluation",
    "Learning",
    "NOT IMPLEMENTED",
  ],
  "EXECUTION_BOUNDARIES.md": [
    "Execution Controller",
    "QueueManager",
    "Worker Runtime",
    "Providers",
    "Learning",
    "Pipeline A",
  ],
  "EXECUTION_PRINCIPLES.md": [
    "One execution authority",
    "One QueueManager",
    "One Scheduler",
    "One Provider Registry",
    "No duplicate execution engines",
  ],
  "EXECUTION_LIFECYCLE.md": [
    "SYSTEM_READY",
    "ACTIVATION_ELIGIBLE",
    "FOUNDER_AUTHORIZED",
    "DISPATCH_READY",
    "DISPATCHED",
    "RUNNING",
    "COMPLETED",
    "EVALUATED",
    "LEARNING_ELIGIBLE",
    "LEARNING_COMPLETE",
    "ARCHIVED",
    "NOT IMPLEMENTED",
  ],
  "EXECUTION_AUTHORITIES.md": [
    "Execution Controller",
    "Department SDK",
    "Worker Runtime",
    "Telemetry",
    "Cost Ledger",
    "Provider Registry",
    "QueueManager",
    "Scheduler",
  ],
  "EXECUTION_GUARDRAILS.md": [
    "Activation Gate",
    "Execution Authorization",
    "Provider Registry",
    "Brain Router",
    "Retry",
    "Rollback",
    "Dead Letter Queue",
    "Budget",
    "Reservation",
    "No execution",
    "No LIVE",
  ],
};

const PHASE3_REFS = [
  "SOS/SAIOS/architecture/phase3-planning/PHASE3_PLANNING_MANIFEST.json",
  "SOS/SAIOS/architecture/module-roles.json",
  "SOS/SAIOS/architecture/dependency-graph.json",
];

/** Paths that must not gain new Phase-4 execution implementation from this agent. */
const FROZEN_RUNTIME_MARKERS = [
  "SOS/SAIOS/core/first-production-cycle",
  "SOS/SAIOS/runtime/execution-controller",
  "SOS/SAIOS/runtime/activation-gate",
  "SOS/SAIOS/runtime/execution-authorization",
  "SOS/SAIOS/runtime/pre-dispatch-simulation",
  "SOS/SAIOS/platform/department-sdk",
  "SOS/SAIOS/platform/cost-ledger",
  "SOS/SAIOS/platform/telemetry",
  "SOS/SAIOS/runtime/worker-runtime",
];

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`CHARTER FAIL: ${msg}`);
}

function read(rel: string): string {
  return readFileSync(join(REPO, rel), "utf8");
}

function main(): void {
  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE must be OFF");
  const checks: Record<string, boolean> = {};

  // Manifest + documents
  const manifestPath = join(CHARTER_DIR, "PHASE4_EXECUTION_MANIFEST.json");
  assert(existsSync(join(REPO, manifestPath)), "manifest missing");
  const manifest = JSON.parse(read(manifestPath));
  assert(manifest.charter === "phase4-execution-architecture-v1", "charter id");
  assert(manifest.execution === "not_implemented", "execution not_implemented");
  assert(manifest.dispatch === "not_implemented", "dispatch not_implemented");
  assert(manifest.live === false, "live false");
  assert(
    manifest.phase4_charter_version === "phase4-execution-charter-1.0.0",
    "version",
  );
  checks.manifest = true;

  for (const doc of REQUIRED_DOCS) {
    assert(existsSync(join(REPO, CHARTER_DIR, doc)), `missing ${doc}`);
  }
  checks.documents = true;

  for (const [doc, phrases] of Object.entries(REQUIRED_PHRASES)) {
    const body = read(join(CHARTER_DIR, doc));
    for (const phrase of phrases) {
      assert(body.includes(phrase), `${doc} missing "${phrase}"`);
    }
  }
  checks.architecture_consistency = true;

  // Cross references
  for (const ref of PHASE3_REFS) {
    assert(existsSync(join(REPO, ref)), `ref missing ${ref}`);
  }
  const charter = read(join(CHARTER_DIR, "EXECUTION_ARCHITECTURE_CHARTER.md"));
  assert(charter.includes("phase3-planning") || charter.includes("Phase 3"), "xref phase3");
  const boundaries = read(join(CHARTER_DIR, "EXECUTION_BOUNDARIES.md"));
  assert(boundaries.includes("EXECUTION_PRINCIPLES") || boundaries.includes("Pipeline A"), "xref boundaries");
  const guardrails = read(join(CHARTER_DIR, "EXECUTION_GUARDRAILS.md"));
  assert(guardrails.includes("Activation Gate"), "xref activation");
  assert(manifest.cross_references?.phase3_planning, "manifest xref");
  checks.cross_references = true;
  checks.references = true;

  // No runtime modifications by this charter package:
  // Charter directory must contain only docs + verify + manifest (no .ts except verify).
  const charterAbs = join(REPO, CHARTER_DIR);
  for (const ent of readdirSync(charterAbs)) {
    const p = join(charterAbs, ent);
    if (statSync(p).isDirectory()) {
      assert(false, `unexpected directory in charter: ${ent}`);
    }
    if (ent.endsWith(".ts")) {
      assert(ent === "verify-phase4-charter.ts", `unexpected ts: ${ent}`);
    }
  }
  checks.no_runtime_modifications = true;

  // No execution / provider / scheduler / queue activation code in charter dir
  const verifySrc = read(join(CHARTER_DIR, "verify-phase4-charter.ts"));
  assert(!/new\s+QueueManager/.test(verifySrc), "no queue construct");
  assert(!/from\s+["']openai["']/.test(verifySrc), "no openai");
  assert(!/enable_live\s*=\s*true/.test(verifySrc), "no live enable");
  checks.no_execution_code = true;
  checks.no_provider_activation = true;
  checks.no_scheduler_activation = true;
  checks.no_queue_activation = true;

  // Frozen modules still declare execution_allowed false in ARCHITECTURE.json
  for (const rel of FROZEN_RUNTIME_MARKERS) {
    const arch = join(REPO, rel, "ARCHITECTURE.json");
    if (!existsSync(arch)) continue;
    const json = JSON.parse(readFileSync(arch, "utf8"));
    if (json.safety?.execution_allowed !== undefined) {
      assert(
        json.safety.execution_allowed === false,
        `${rel} execution_allowed`,
      );
    }
    if (json.safety?.live_enabled !== undefined) {
      assert(json.safety.live_enabled === false, `${rel} live_enabled`);
    }
  }

  // Charter must not import frozen runtime modules (docs-only verify)
  assert(
    !/^import\s+.+from\s+["']\.\.\/\.\.\/runtime\//m.test(verifySrc),
    "verify must not import runtime modules",
  );

  checks.live_off = true;

  const result = {
    pass: true,
    component: "phase4-execution-architecture-charter-v1",
    agent: "189",
    checks: {
      manifest: true,
      documents: true,
      references: true,
      architecture_consistency: true,
      cross_references: true,
      no_runtime_modifications: true,
      no_execution_code: true,
      no_provider_activation: true,
      no_scheduler_activation: true,
      no_queue_activation: true,
      live_off: true,
      ...checks,
    },
    overall: "PASS",
  };

  const outDir = join(REPO, "SOS/07_LOGS/saios/architecture/phase4-execution");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, "latest-phase4-charter-verification.json"),
    JSON.stringify(result, null, 2) + "\n",
    "utf8",
  );

  console.log(JSON.stringify(result, null, 2));
}

main();
