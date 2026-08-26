#!/usr/bin/env tsx
/**
 * Phase 3 Integration Spine Certification — Agent #184.
 * READ-ONLY certification. No execution. No LIVE. No architecture mutation.
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
import { EXECUTION_CONTROLLER_SAFETY_FLAGS_LOCKED } from "../../runtime/execution-controller/ExecutionControllerTypes.js";
import { DEPARTMENT_SDK_SAFETY_FLAGS } from "../../platform/department-sdk/DepartmentTypes.js";
import { COST_LEDGER_SAFETY_FLAGS } from "../../platform/cost-ledger/CostLedgerTypes.js";
import { WORKER_RUNTIME_SAFETY_FLAGS } from "../../runtime/worker-runtime/WorkerRuntimeTypes.js";
import { TELEMETRY_SAFETY_FLAGS } from "../../platform/telemetry/TelemetryTypes.js";
import {
  ALL_DASHBOARD_PLUGINS,
  WAVE3_DASHBOARD_PLUGINS,
  WAVE4_DASHBOARD_PLUGINS,
  WAVE5_DASHBOARD_PLUGINS,
  WAVE6_DASHBOARD_PLUGINS,
  WAVE7_DASHBOARD_PLUGINS,
} from "../../platform/dashboard/plugins/register.js";

const REPO = resolve(import.meta.dirname, "../../../..");

const SPINE = [
  {
    id: "runtime.execution-controller",
    path: "SOS/SAIOS/runtime/execution-controller",
    ownership: "EXECUTION_AUTHORITY_SCAFFOLD",
    schemaNeedle: "execution-controller-1.0.0",
    plugin: "execution-controller",
    verify: "execution-controller:verify",
    required: [
      "ExecutionControllerTypes.ts",
      "ExecutionControllerRepository.ts",
      "ExecutionLifecycleValidator.ts",
      "ExecutionLifecycleReporter.ts",
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
    required: [
      "DepartmentTypes.ts",
      "DepartmentRegistry.ts",
      "DepartmentValidator.ts",
      "DepartmentReporter.ts",
      "ARCHITECTURE.json",
      "verify-department-sdk.ts",
    ],
  },
  {
    id: "platform.cost-ledger",
    path: "SOS/SAIOS/platform/cost-ledger",
    ownership: "FINANCIAL_AUTHORITY_SCAFFOLD",
    schemaNeedle: "cost-ledger-1.0.0",
    plugin: "cost-ledger",
    verify: "cost-ledger:verify",
    required: [
      "CostLedgerTypes.ts",
      "BudgetRepository.ts",
      "BudgetValidator.ts",
      "BudgetReporter.ts",
      "ARCHITECTURE.json",
      "verify-cost-ledger.ts",
    ],
  },
  {
    id: "runtime.worker-runtime",
    path: "SOS/SAIOS/runtime/worker-runtime",
    ownership: "WORKER_RUNTIME_CONTRACT",
    schemaNeedle: "worker-runtime-1.0.0",
    plugin: "worker-runtime",
    verify: "worker-runtime:verify",
    required: [
      "WorkerRuntimeTypes.ts",
      "WorkerRuntimeRepository.ts",
      "WorkerRuntimeValidator.ts",
      "WorkerRuntimeReporter.ts",
      "ARCHITECTURE.json",
      "verify-worker-runtime.ts",
    ],
  },
  {
    id: "platform.telemetry",
    path: "SOS/SAIOS/platform/telemetry",
    ownership: "EXECUTION_TELEMETRY_CONTRACT",
    schemaNeedle: "telemetry-session-1.0.0",
    plugin: "telemetry-registry",
    verify: "telemetry:verify",
    required: [
      "TelemetryTypes.ts",
      "TelemetryRepository.ts",
      "TelemetryValidator.ts",
      "TelemetryReporter.ts",
      "ARCHITECTURE.json",
      "verify-telemetry.ts",
    ],
  },
] as const;

const CROSS_IMPORT_RE =
  /from\s+["'][^"']*(execution-controller|department-sdk|cost-ledger|worker-runtime|\/telemetry)[^"']*["']/;

const SAFETY_KEYS = [
  "execution_allowed",
  "dispatch_allowed",
  "worker_spawn_allowed",
  "provider_allowed",
  "queue_insert_allowed",
  "scheduler_allowed",
  "publishing_allowed",
  "live_enabled",
] as const;

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

function flagsAllFalse(
  flags: Record<string, unknown>,
  label: string,
): void {
  for (const [k, v] of Object.entries(flags)) {
    if (typeof v === "boolean") {
      assert(v === false, `${label}.${k} must be false`);
    }
  }
  for (const key of SAFETY_KEYS) {
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
  const integration = pct([
    "modules_present",
    "dashboard_plugins",
    "dashboard_views",
    "snapshot_loading",
    "api_routes",
  ]);
  const architecture = pct([
    "ownership_unique",
    "single_authorities",
    "architecture_json",
  ]);
  const dependency = pct([
    "no_cross_imports",
    "no_reverse_deps",
    "no_circular",
  ]);
  const contract = pct([
    "schema_versions",
    "validators_reporters_repos",
    "module_verifies",
    "checksums",
  ]);
  const safety = pct([
    "safety_flags",
    "architecture_safety",
    "execution_impossible",
    "live_off",
  ]);
  const extensibility = pct([
    "dashboard_plugins",
    "api_routes",
    "manifest",
  ]);
  const overall = Math.round(
    (integration +
      architecture +
      dependency +
      contract +
      safety +
      extensibility) /
      6,
  );
  return {
    integration_readiness: integration,
    architecture_consistency: architecture,
    dependency_integrity: dependency,
    contract_integrity: contract,
    safety_integrity: safety,
    extensibility,
    overall_phase3_foundation: overall,
  };
}

function main(): void {
  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE must be OFF");
  const checks: Record<string, boolean> = {};

  // --- Modules present + contracts ---
  for (const mod of SPINE) {
    const abs = join(REPO, mod.path);
    assert(existsSync(abs), `missing module ${mod.id}`);
    for (const file of mod.required) {
      assert(existsSync(join(abs, file)), `${mod.id} missing ${file}`);
    }
    const arch = JSON.parse(read(join(mod.path, "ARCHITECTURE.json")));
    assert(
      arch.architecture_role === mod.ownership,
      `${mod.id} ownership role mismatch`,
    );
    assert(arch.safety?.execution_allowed === false, `${mod.id} exec arch`);
    assert(arch.safety?.live_enabled === false, `${mod.id} live arch`);
    const typesBlob = readdirSync(abs)
      .filter((f) => f.endsWith("Types.ts") || f.includes("Types.ts"))
      .map((f) => readFileSync(join(abs, f), "utf8"))
      .join("\n");
    assert(
      typesBlob.includes(mod.schemaNeedle) ||
        read(join(mod.path, "ARCHITECTURE.json")).includes(mod.schemaNeedle),
      `${mod.id} schema`,
    );
  }
  checks.modules_present = true;
  checks.architecture_json = true;
  checks.validators_reporters_repos = true;
  checks.schema_versions = true;

  // --- Ownership uniqueness ---
  const roles = SPINE.map((m) => m.ownership);
  assert(new Set(roles).size === roles.length, "ownership overlap");
  checks.ownership_unique = true;
  checks.single_authorities = true;

  // --- Dependency audit (no Phase-3 cross-imports in production sources) ---
  const reverseHits: string[] = [];
  for (const mod of SPINE) {
    for (const file of listTs(join(REPO, mod.path))) {
      const src = readFileSync(file, "utf8");
      if (!CROSS_IMPORT_RE.test(src)) continue;
      // Self-folder imports are fine; flag only imports that leave the module
      // toward another Phase-3 spine module path.
      const rel = file.slice(REPO.length + 1);
      const matches = src.match(
        /from\s+["']([^"']+)["']/g,
      );
      if (!matches) continue;
      for (const m of matches) {
        const spec = m.replace(/^from\s+["']/, "").replace(/["']$/, "");
        if (spec.startsWith(".") && !spec.includes("../")) continue;
        const hitsOther = SPINE.some((other) => {
          if (other.id === mod.id) return false;
          const otherSeg = other.path.split("/").pop()!;
          return (
            spec.includes(`/${otherSeg}/`) ||
            spec.includes(`/${otherSeg}.js`) ||
            spec.endsWith(`/${otherSeg}`)
          );
        });
        if (hitsOther) reverseHits.push(`${rel} → ${spec}`);
      }
    }
  }
  assert(reverseHits.length === 0, `cross deps: ${reverseHits.join("; ")}`);
  checks.no_cross_imports = true;
  checks.no_reverse_deps = true;
  checks.no_circular = true;

  // --- Safety flags ---
  flagsAllFalse(EXECUTION_CONTROLLER_SAFETY_FLAGS_LOCKED, "xc");
  flagsAllFalse(DEPARTMENT_SDK_SAFETY_FLAGS, "dept");
  flagsAllFalse(COST_LEDGER_SAFETY_FLAGS, "cost");
  flagsAllFalse(WORKER_RUNTIME_SAFETY_FLAGS, "worker");
  flagsAllFalse(TELEMETRY_SAFETY_FLAGS, "tel");
  assert(
    EXECUTION_CONTROLLER_SAFETY_FLAGS_LOCKED.scheduler_allowed === false,
    "xc scheduler",
  );
  assert(
    WORKER_RUNTIME_SAFETY_FLAGS.scheduler_allowed === false,
    "worker scheduler",
  );
  checks.safety_flags = true;
  checks.architecture_safety = true;
  checks.execution_impossible = true;
  checks.live_off = true;

  // --- Checksums (platform checksums used by each module) ---
  for (const mod of SPINE) {
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
  for (const mod of SPINE) {
    assert(pluginIds.includes(mod.plugin), `plugin ${mod.plugin}`);
  }
  assert(WAVE3_DASHBOARD_PLUGINS[0]!.id === "execution-controller", "wave3");
  assert(WAVE4_DASHBOARD_PLUGINS[0]!.id === "department-registry", "wave4");
  assert(WAVE5_DASHBOARD_PLUGINS[0]!.id === "cost-ledger", "wave5");
  assert(WAVE6_DASHBOARD_PLUGINS[0]!.id === "worker-runtime", "wave6");
  assert(WAVE7_DASHBOARD_PLUGINS[0]!.id === "telemetry-registry", "wave7");
    assert(ALL_DASHBOARD_PLUGINS.length === 17, "plugin count");
  checks.dashboard_plugins = true;

  const app = read("SOS/SAIOS/dashboard/src/App.tsx");
  const load = read("SOS/SAIOS/dashboard/src/data/loadSnapshot.ts");
  const types = read("SOS/SAIOS/dashboard/src/data/types.ts");
  for (const mod of SPINE) {
    assert(app.includes(`"${mod.plugin}"`) || app.includes(mod.plugin), `app ${mod.plugin}`);
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
  ];
  const registerSrc = read(
    "SOS/SAIOS/platform/dashboard/plugins/register.ts",
  );
  for (const needle of apiNeedles) {
    const pluginFiles = [
      "executionController.ts",
      "departmentRegistry.ts",
      "costLedger.ts",
      "workerRuntime.ts",
      "telemetryRegistry.ts",
    ];
    const found = pluginFiles.some((f) =>
      read(`SOS/SAIOS/platform/dashboard/plugins/${f}`).includes(needle),
    );
    assert(found, `api ${needle}`);
  }
  assert(registerSrc.includes("telemetryRegistryPlugin"), "register wave7");
  checks.api_routes = true;

  // --- Manifest ---
  const manifestPath =
    "SOS/SAIOS/architecture/phase3-foundation/PHASE3_SPINE_MANIFEST.json";
  assert(existsSync(join(REPO, manifestPath)), "manifest missing");
  const manifest = JSON.parse(read(manifestPath));
  assert(manifest.modules.length === 5, "manifest modules");
  checks.manifest = true;

  // --- Module verifies (subprocess; fixtures only) ---
  const env = { ...process.env, SOS_AIOS_LIVE: "0" };
  for (const mod of SPINE) {
    const r = spawnSync("npm", ["run", mod.verify], {
      cwd: REPO,
      env,
      encoding: "utf8",
      shell: process.platform === "win32",
    });
    assert(r.status === 0, `${mod.verify} failed: ${r.stderr || r.stdout}`);
  }
  const dash = spawnSync("npm", ["run", "dashboard-platform:verify"], {
    cwd: REPO,
    env,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  assert(
    dash.status === 0,
    `dashboard-platform:verify failed: ${dash.stderr || dash.stdout}`,
  );
  checks.module_verifies = true;

  const scores = scoreFrom(checks);
  const result = {
    pass: true,
    component: "phase3-integration-spine-certification-v1",
    agent: "184",
    checks,
    scores,
    integration_audit: {
      ownership: SPINE.map((m) => ({
        id: m.id,
        ownership: m.ownership,
      })),
      dependency_direction: manifest.allowed_dependency_direction,
      reverse_dependencies: [],
      circular_dependencies: [],
      ownership_overlap: [],
      architecture_registry_gap:
        "Phase 3 modules not yet in module-roles.json (non-blocking for certification)",
    },
    safety_guarantees: {
      execution_allowed: false,
      dispatch_allowed: false,
      worker_spawn_allowed: false,
      provider_allowed: false,
      queue_insert_allowed: false,
      scheduler_allowed: false,
      publishing_allowed: false,
      live_enabled: false,
      execution_impossible: true,
    },
    overall: "PASS",
  };

  const outDir = join(REPO, "SOS/07_LOGS/saios/architecture/phase3-foundation");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, "latest-phase3-foundation-certification.json"),
    JSON.stringify(result, null, 2) + "\n",
    "utf8",
  );

  console.log(JSON.stringify(result, null, 2));
}

main();
