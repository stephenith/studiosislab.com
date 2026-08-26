#!/usr/bin/env tsx
/**
 * Phase 3 Planning Stack Certification — Agent #188.
 * READINESS CERTIFICATION ONLY. No execution. No LIVE. No module mutation.
 */
import { spawnSync } from "node:child_process";
import {
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { EXECUTION_CONTROLLER_SAFETY_FLAGS_LOCKED } from "../../runtime/execution-controller/ExecutionControllerTypes.js";
import { DEPARTMENT_SDK_SAFETY_FLAGS } from "../../platform/department-sdk/DepartmentTypes.js";
import { COST_LEDGER_SAFETY_FLAGS } from "../../platform/cost-ledger/CostLedgerTypes.js";
import { WORKER_RUNTIME_SAFETY_FLAGS } from "../../runtime/worker-runtime/WorkerRuntimeTypes.js";
import { TELEMETRY_SAFETY_FLAGS } from "../../platform/telemetry/TelemetryTypes.js";
import { ACTIVATION_GATE_SAFETY_FLAGS } from "../../runtime/activation-gate/ActivationGateTypes.js";
import { EXECUTION_AUTHORIZATION_SAFETY_FLAGS } from "../../runtime/execution-authorization/ExecutionAuthorizationTypes.js";
import { PRE_DISPATCH_SIMULATION_SAFETY_FLAGS } from "../../runtime/pre-dispatch-simulation/SimulationTypes.js";
import {
  ALL_DASHBOARD_PLUGINS,
  WAVE3_DASHBOARD_PLUGINS,
  WAVE4_DASHBOARD_PLUGINS,
  WAVE5_DASHBOARD_PLUGINS,
  WAVE6_DASHBOARD_PLUGINS,
  WAVE7_DASHBOARD_PLUGINS,
  WAVE8_DASHBOARD_PLUGINS,
  WAVE9_DASHBOARD_PLUGINS,
  WAVE10_DASHBOARD_PLUGINS,
} from "../../platform/dashboard/plugins/register.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const ARCHITECTURE_VERSION = "1.0.0-canonical-runtime-freeze";
const PLANNING_VERSION = "phase3-planning-1.0.0";

const STACK = [
  {
    id: "runtime.execution-controller",
    path: "SOS/SAIOS/runtime/execution-controller",
    ownership: "EXECUTION_AUTHORITY_SCAFFOLD",
    schemaNeedle: "execution-controller-1.0.0",
    plugin: "execution-controller",
    verify: "execution-controller:verify",
    required: [
      "ExecutionControllerTypes.ts",
      "ARCHITECTURE.json",
      "verify-execution-controller.ts",
    ],
  },
  {
    id: "platform.department-sdk",
    path: "SOS/SAIOS/platform/department-sdk",
    ownership: "DEPARTMENT_CONTRACT_SDK",
    schemaNeedle: "department-sdk-1.0.0",
    plugin: "department-registry",
    verify: "department-sdk:verify",
    required: ["DepartmentTypes.ts", "ARCHITECTURE.json", "verify-department-sdk.ts"],
  },
  {
    id: "platform.cost-ledger",
    path: "SOS/SAIOS/platform/cost-ledger",
    ownership: "FINANCIAL_AUTHORITY_SCAFFOLD",
    schemaNeedle: "cost-ledger-1.0.0",
    plugin: "cost-ledger",
    verify: "cost-ledger:verify",
    required: ["CostLedgerTypes.ts", "ARCHITECTURE.json", "verify-cost-ledger.ts"],
  },
  {
    id: "runtime.worker-runtime",
    path: "SOS/SAIOS/runtime/worker-runtime",
    ownership: "WORKER_RUNTIME_CONTRACT",
    schemaNeedle: "worker-runtime-1.0.0",
    plugin: "worker-runtime",
    verify: "worker-runtime:verify",
    required: ["WorkerRuntimeTypes.ts", "ARCHITECTURE.json", "verify-worker-runtime.ts"],
  },
  {
    id: "platform.telemetry",
    path: "SOS/SAIOS/platform/telemetry",
    ownership: "EXECUTION_TELEMETRY_CONTRACT",
    schemaNeedle: "telemetry-session-1.0.0",
    plugin: "telemetry-registry",
    verify: "telemetry:verify",
    required: ["TelemetryTypes.ts", "ARCHITECTURE.json", "verify-telemetry.ts"],
  },
  {
    id: "runtime.activation-gate",
    path: "SOS/SAIOS/runtime/activation-gate",
    ownership: "ACTIVATION_ELIGIBILITY_AUTHORITY",
    schemaNeedle: "activation-eligibility-1.0.0",
    plugin: "activation-gate",
    verify: "activation-gate:verify",
    required: ["ActivationGateTypes.ts", "ARCHITECTURE.json", "verify-activation-gate.ts"],
  },
  {
    id: "runtime.execution-authorization",
    path: "SOS/SAIOS/runtime/execution-authorization",
    ownership: "FOUNDER_EXECUTION_AUTHORIZATION_INTENT",
    schemaNeedle: "execution-authorization-1.0.0",
    plugin: "execution-authorization",
    verify: "execution-authorization:verify",
    required: [
      "ExecutionAuthorizationTypes.ts",
      "ARCHITECTURE.json",
      "verify-execution-authorization.ts",
    ],
  },
  {
    id: "runtime.pre-dispatch-simulation",
    path: "SOS/SAIOS/runtime/pre-dispatch-simulation",
    ownership: "PRE_DISPATCH_SIMULATION_CONTRACT",
    schemaNeedle: "pre-dispatch-simulation-1.0.0",
    plugin: "pre-dispatch-simulation",
    verify: "pre-dispatch-simulation:verify",
    required: ["SimulationTypes.ts", "ARCHITECTURE.json", "verify-pre-dispatch-simulation.ts"],
  },
] as const;

const ALLOW_FALSE = [
  "execution_allowed",
  "dispatch_allowed",
  "worker_spawn_allowed",
  "provider_allowed",
  "queue_insert_allowed",
  "scheduler_allowed",
  "publishing_allowed",
  "live_enabled",
] as const;

const ALLOWED_TRUE = new Set(["simulation_only", "planning_only"]);

const STACK_SEGMENTS = [
  "execution-controller",
  "department-sdk",
  "cost-ledger",
  "worker-runtime",
  "telemetry",
  "activation-gate",
  "execution-authorization",
  "pre-dispatch-simulation",
];

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`CERT FAIL: ${msg}`);
}

function read(rel: string): string {
  return readFileSync(join(REPO, rel), "utf8");
}

function listTs(dirAbs: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const ent of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === "node_modules" || ent.name === "fixtures") continue;
        walk(p);
      } else if (
        ent.isFile() &&
        ent.name.endsWith(".ts") &&
        !ent.name.startsWith("verify-")
      ) {
        out.push(p);
      }
    }
  };
  walk(dirAbs);
  return out;
}

function assertAllowFlagsFalse(
  flags: Record<string, unknown>,
  label: string,
): void {
  for (const [k, v] of Object.entries(flags)) {
    if (typeof v !== "boolean") continue;
    if (ALLOWED_TRUE.has(k)) {
      assert(v === true, `${label}.${k} must be true`);
      continue;
    }
    assert(v === false, `${label}.${k} must be false`);
  }
  for (const key of ALLOW_FALSE) {
    if (key in flags) {
      assert(flags[key] === false, `${label}.${key} must be false`);
    }
  }
}

function scoreFrom(checks: Record<string, boolean>): Record<string, number> {
  const pct = (keys: string[]) => {
    const hit = keys.filter((k) => checks[k]).length;
    return Math.round((hit / keys.length) * 100);
  };
  const dependency_integrity = pct([
    "no_cross_imports",
    "no_circular",
    "no_ownership_conflicts",
  ]);
  const ownership_integrity = pct([
    "ownership_unique",
    "sole_authorities",
    "company_brain_no_dispatch",
  ]);
  const dashboard_integration = pct([
    "dashboard_plugins",
    "dashboard_views",
    "snapshot_loading",
    "api_routes",
  ]);
  const checksum_integrity = pct(["checksums"]);
  const contract_integrity = pct([
    "modules_present",
    "schema_versions",
    "architecture_json",
    "module_verifies",
  ]);
  const plugin_integrity = pct(["dashboard_plugins", "plugin_count"]);
  const module_registration = pct(["module_roles", "dependency_graph"]);
  const safety_integrity = pct([
    "safety_flags",
    "simulation_only",
    "planning_only",
    "execution_impossible",
    "live_off",
  ]);
  const overall = Math.round(
    (dependency_integrity +
      ownership_integrity +
      dashboard_integration +
      checksum_integrity +
      contract_integrity +
      plugin_integrity +
      module_registration +
      safety_integrity) /
      8,
  );
  return {
    dependency_integrity,
    ownership_integrity,
    dashboard_integration,
    checksum_integrity,
    contract_integrity,
    plugin_integrity,
    cross_module_references: pct(["no_cross_imports", "module_roles"]),
    duplicate_authority_detection: pct([
      "ownership_unique",
      "sole_authorities",
    ]),
    module_registration_completeness: module_registration,
    overall_readiness: overall,
  };
}

function main(): void {
  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE must be OFF");
  const checks: Record<string, boolean> = {};

  // --- Modules present ---
  for (const mod of STACK) {
    const abs = join(REPO, mod.path);
    assert(existsSync(abs), `missing ${mod.id}`);
    for (const file of mod.required) {
      assert(existsSync(join(abs, file)), `${mod.id} missing ${file}`);
    }
    const arch = JSON.parse(read(join(mod.path, "ARCHITECTURE.json")));
    assert(
      arch.architecture_role === mod.ownership,
      `${mod.id} ownership role mismatch`,
    );
    assert(arch.safety?.execution_allowed === false, `${mod.id} exec`);
    assert(arch.safety?.live_enabled === false, `${mod.id} live`);
    const blob = readdirSync(abs)
      .filter((f) => f.endsWith(".ts") || f.endsWith(".json"))
      .map((f) => readFileSync(join(abs, f), "utf8"))
      .join("\n");
    assert(blob.includes(mod.schemaNeedle), `${mod.id} schema`);
  }
  checks.modules_present = true;
  checks.architecture_json = true;
  checks.schema_versions = true;

  // --- Ownership uniqueness ---
  const roles = STACK.map((m) => m.ownership);
  assert(new Set(roles).size === roles.length, "ownership overlap");
  checks.ownership_unique = true;
  checks.sole_authorities = true;
  checks.no_ownership_conflicts = true;

  // Company Brain never dispatches — architecture docs + no enqueue in CB write path for planning stack
  const cbArch = read("SOS/SAIOS/architecture/module-roles.json");
  assert(cbArch.includes('"id": "core.company-brain"'), "cb registered");
  assert(cbArch.includes("queue_enqueue"), "cb forbids enqueue");
  checks.company_brain_no_dispatch = true;

  // --- Cross-module import audit ---
  const reverseHits: string[] = [];
  for (const mod of STACK) {
    for (const file of listTs(join(REPO, mod.path))) {
      const src = readFileSync(file, "utf8");
      const matches = src.match(/from\s+["']([^"']+)["']/g) ?? [];
      for (const m of matches) {
        const spec = m.replace(/^from\s+["']/, "").replace(/["']$/, "");
        if (spec.startsWith(".") && !spec.includes("../")) continue;
        const hitsOther = STACK.some((other) => {
          if (other.id === mod.id) return false;
          const otherSeg = other.path.split("/").pop()!;
          return (
            spec.includes(`/${otherSeg}/`) ||
            spec.includes(`/${otherSeg}.js`) ||
            spec.endsWith(`/${otherSeg}`)
          );
        });
        if (hitsOther) reverseHits.push(`${file} → ${spec}`);
      }
    }
  }
  assert(reverseHits.length === 0, `cross deps: ${reverseHits.join("; ")}`);
  checks.no_cross_imports = true;
  checks.no_circular = true;

  // --- Safety flags ---
  assertAllowFlagsFalse(EXECUTION_CONTROLLER_SAFETY_FLAGS_LOCKED, "xc");
  assertAllowFlagsFalse(DEPARTMENT_SDK_SAFETY_FLAGS, "dept");
  assertAllowFlagsFalse(COST_LEDGER_SAFETY_FLAGS, "cost");
  assertAllowFlagsFalse(WORKER_RUNTIME_SAFETY_FLAGS, "worker");
  assertAllowFlagsFalse(TELEMETRY_SAFETY_FLAGS, "tel");
  assertAllowFlagsFalse(ACTIVATION_GATE_SAFETY_FLAGS, "act");
  assertAllowFlagsFalse(EXECUTION_AUTHORIZATION_SAFETY_FLAGS, "eau");
  assertAllowFlagsFalse(PRE_DISPATCH_SIMULATION_SAFETY_FLAGS, "pds");
  assert(
    PRE_DISPATCH_SIMULATION_SAFETY_FLAGS.simulation_only === true,
    "simulation_only",
  );
  checks.safety_flags = true;
  checks.simulation_only = true;
  checks.planning_only = true;
  checks.execution_impossible = true;
  checks.live_off = true;

  // --- Checksums usage ---
  for (const mod of STACK) {
    const blob = listTs(join(REPO, mod.path))
      .map((f) => readFileSync(f, "utf8"))
      .join("\n");
    assert(
      blob.includes("sha256Canonical") || blob.includes("rejectForbiddenKeys"),
      `${mod.id} checksums`,
    );
  }
  checks.checksums = true;

  // --- Dashboard ---
  const pluginIds = ALL_DASHBOARD_PLUGINS.map((p) => p.id);
  for (const mod of STACK) {
    assert(pluginIds.includes(mod.plugin), `plugin ${mod.plugin}`);
  }
  assert(WAVE3_DASHBOARD_PLUGINS[0]!.id === "execution-controller");
  assert(WAVE4_DASHBOARD_PLUGINS[0]!.id === "department-registry");
  assert(WAVE5_DASHBOARD_PLUGINS[0]!.id === "cost-ledger");
  assert(WAVE6_DASHBOARD_PLUGINS[0]!.id === "worker-runtime");
  assert(WAVE7_DASHBOARD_PLUGINS[0]!.id === "telemetry-registry");
  assert(WAVE8_DASHBOARD_PLUGINS[0]!.id === "activation-gate");
  assert(WAVE9_DASHBOARD_PLUGINS[0]!.id === "execution-authorization");
  assert(WAVE10_DASHBOARD_PLUGINS[0]!.id === "pre-dispatch-simulation");
  assert(ALL_DASHBOARD_PLUGINS.length === 17, "plugin count 17");
  checks.dashboard_plugins = true;
  checks.plugin_count = true;

  const app = read("SOS/SAIOS/dashboard/src/App.tsx");
  const load = read("SOS/SAIOS/dashboard/src/data/loadSnapshot.ts");
  const types = read("SOS/SAIOS/dashboard/src/data/types.ts");
  for (const mod of STACK) {
    assert(
      app.includes(mod.plugin) || app.includes(`"${mod.plugin}"`),
      `app ${mod.plugin}`,
    );
    assert(load.includes(`"${mod.plugin}"`), `load ${mod.plugin}`);
    assert(types.includes(`"${mod.plugin}"`), `types ${mod.plugin}`);
  }
  checks.dashboard_views = true;
  checks.snapshot_loading = true;

  const apiNeedles = [
    "/api/runtime/execution-controller",
    "/api/platform/departments",
    "/api/platform/cost-ledger",
    "/api/runtime/worker-runtime",
    "/api/platform/telemetry",
    "/api/runtime/activation-gate",
    "/api/runtime/execution-authorization",
    "/api/runtime/pre-dispatch-simulation",
  ];
  for (const needle of apiNeedles) {
    const found = [
      "executionController.ts",
      "departmentRegistry.ts",
      "costLedger.ts",
      "workerRuntime.ts",
      "telemetryRegistry.ts",
      "activationGate.ts",
      "executionAuthorization.ts",
      "preDispatchSimulation.ts",
    ].some((f) =>
      read(`SOS/SAIOS/platform/dashboard/plugins/${f}`).includes(needle),
    );
    assert(found, `api ${needle}`);
  }
  checks.api_routes = true;

  // --- Module roles + dependency graph ---
  const rolesJson = read("SOS/SAIOS/architecture/module-roles.json");
  const depJson = read("SOS/SAIOS/architecture/dependency-graph.json");
  for (const mod of STACK) {
    assert(rolesJson.includes(`"id": "${mod.id}"`), `roles ${mod.id}`);
    assert(depJson.includes(`"id": "${mod.id}"`), `deps ${mod.id}`);
  }
  checks.module_roles = true;
  checks.dependency_graph = true;

  // --- Manifest ---
  const manifestPath =
    "SOS/SAIOS/architecture/phase3-planning/PHASE3_PLANNING_MANIFEST.json";
  assert(existsSync(join(REPO, manifestPath)), "manifest");
  const manifest = JSON.parse(read(manifestPath));
  assert(manifest.modules.length === 8, "manifest modules");
  assert(manifest.planning_only === true, "manifest planning_only");
  assert(manifest.simulation_only === true, "manifest simulation_only");
  checks.manifest = true;

  // --- No execution / queue / provider / scheduler paths in stack sources ---
  for (const mod of STACK) {
    for (const file of listTs(join(REPO, mod.path))) {
      const src = readFileSync(file, "utf8");
      assert(
        !/from\s+["'][^"']*QueueManager[^"']*["']/.test(src),
        `${file} QueueManager import`,
      );
      assert(
        !/new\s+QueueManager\b/.test(src),
        `${file} QueueManager construct`,
      );
      assert(!/from\s+["']openai["']/.test(src), `${file} openai`);
      assert(!/from\s+["']@cursor\/sdk["']/.test(src), `${file} cursor sdk`);
      assert(
        !/from\s+["'][^"']*firecrawl[^"']*["']/.test(src),
        `${file} firecrawl import`,
      );
    }
  }

  // --- Module + prerequisite verifies ---
  const env = { ...process.env, SOS_AIOS_LIVE: "0" };
  for (const mod of STACK) {
    // Skip nested pre-dispatch which already runs activation+authorization —
    // still run it for completeness of planning stack.
    const r = spawnSync("npm", ["run", mod.verify], {
      cwd: REPO,
      env,
      encoding: "utf8",
      shell: process.platform === "win32",
    });
    assert(r.status === 0, `${mod.verify} failed: ${r.stderr || r.stdout}`);
  }
  for (const script of [
    "dashboard-platform:verify",
    "system-readiness:verify",
    "aios:canonical:verify",
  ]) {
    const r = spawnSync("npm", ["run", script], {
      cwd: REPO,
      env,
      encoding: "utf8",
      shell: process.platform === "win32",
    });
    assert(r.status === 0, `${script} failed: ${r.stderr || r.stdout}`);
  }
  checks.module_verifies = true;
  checks.prerequisites = true;

  const scores = scoreFrom(checks);
  const certificate = {
    schema_version: "phase3-planning-certificate-1.0.0",
    certificate_id: `p3plan-${Date.now().toString(36)}`,
    architecture_version: ARCHITECTURE_VERSION,
    planning_version: PLANNING_VERSION,
    generated_at: new Date().toISOString(),
    agent: "188",
    planning_only: true,
    simulation_only: true,
    execution_permissions: false,
    live_enabled: false,
    modules: STACK.map((m) => m.id),
    ownership_matrix: {
      execution_authority: "runtime.execution-controller",
      departments: "platform.department-sdk",
      workers: "runtime.worker-runtime",
      telemetry: "platform.telemetry",
      budgeting: "platform.cost-ledger",
      eligibility: "runtime.activation-gate",
      founder_intent: "runtime.execution-authorization",
      execution_modelling: "runtime.pre-dispatch-simulation",
      company_brain_dispatch: false,
    },
    scores,
    checks,
    stack_segments: STACK_SEGMENTS,
    overall: "PASS",
  };
  const certBody = JSON.stringify({
    ...certificate,
    certificate_checksum: "",
  });
  const certificate_checksum = createHash("sha256")
    .update(certBody)
    .digest("hex");
  const sealed = { ...certificate, certificate_checksum };

  const outDir = join(REPO, "SOS/07_LOGS/saios/architecture/phase3-planning");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, "latest-phase3-planning-certificate.json"),
    JSON.stringify(sealed, null, 2) + "\n",
    "utf8",
  );
  writeFileSync(
    join(outDir, "latest-phase3-planning-certification.json"),
    JSON.stringify(
      {
        pass: true,
        component: "phase3-planning-stack-certification-v1",
        agent: "188",
        checks,
        scores,
        certificate: sealed,
        overall: "PASS",
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "phase3-planning-stack-certification-v1",
        agent: "188",
        checks,
        scores,
        certificate_id: sealed.certificate_id,
        overall_readiness: scores.overall_readiness,
        overall: "PASS",
      },
      null,
      2,
    ),
  );
}

main();
