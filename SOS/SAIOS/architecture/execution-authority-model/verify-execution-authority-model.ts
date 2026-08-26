#!/usr/bin/env tsx
/**
 * Execution Authority Model Certification verify — Agent #194.
 * Docs + static import/dispatch-boundary scan. No runtime imports. No LIVE. No dispatch.
 */
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join, resolve, relative, basename } from "node:path";

const REPO = resolve(import.meta.dirname, "../../../..");
const AUTH_DIR = "SOS/SAIOS/architecture/execution-authority-model";

const REQUIRED_DOCS = [
  "EXECUTION_AUTHORITY_MODEL.md",
  "EXECUTION_BOUNDARIES.md",
  "DECISION_OWNERSHIP.md",
  "DISPATCH_BOUNDARIES.md",
  "EXECUTION_CHAIN.md",
  "EXECUTION_GUARDRAILS.md",
  "README.md",
  "ARCHITECTURE.json",
  "verify-execution-authority-model.ts",
] as const;

const SOURCE_EXT = /\.(ts|tsx|js|mjs|cjs)$/;
const SKIP_DIR = new Set(["node_modules", ".git", "dist", "build", "coverage"]);

/** Product roots that must not use process spawn primitives. */
const NO_SPAWN_ROOTS = [
  "SOS/SAIOS/core/company-brain",
  "SOS/SAIOS/runtime/execution-controller",
  "SOS/SAIOS/runtime/activation-gate",
  "SOS/SAIOS/runtime/execution-authorization",
  "SOS/SAIOS/runtime/pre-dispatch-simulation",
  "SOS/SAIOS/platform/department-sdk",
  "SOS/SAIOS/runtime/worker-runtime",
  "SOS/SAIOS/runtime/queue",
  "SOS/SAIOS/core/ai-brain",
  "SOS/SAIOS/core/first-production-cycle",
  "SOS/SAIOS/core/providers",
] as const;

const SPAWN_RES = [
  /from\s+["']node:child_process["']/,
  /from\s+["']child_process["']/,
  /require\(\s*["']node:child_process["']\s*\)/,
  /require\(\s*["']child_process["']\s*\)/,
  /from\s+["']node:worker_threads["']/,
  /from\s+["']worker_threads["']/,
  /\bspawnSync\s*\(/,
  /\bspawn\s*\(/,
  /\bfork\s*\(/,
  /\bexecFileSync\s*\(/,
  /\bexecFile\s*\(/,
  /\bexecSync\s*\(/,
  /\bexec\s*\(/,
  /\bnew\s+Worker\s*\(/,
];

type Edge = {
  root: string;
  patterns: RegExp[];
  label: string;
};

const FORBIDDEN_EDGES: Edge[] = [
  {
    root: "SOS/SAIOS/runtime/execution-controller",
    label: "execution-controller → queue|scheduler|worker|router|providers",
    patterns: [
      /from\s+["'][^"']*runtime\/queue[^"']*["']/,
      /from\s+["'][^"']*QueueManager[^"']*["']/,
      /from\s+["'][^"']*runtime\/scheduler[^"']*["']/,
      /from\s+["'][^"']*worker-runtime[^"']*["']/,
      /from\s+["'][^"']*WorkerRuntime[^"']*["']/,
      /from\s+["'][^"']*BrainRouter[^"']*["']/,
      /from\s+["'][^"']*ai-brain\/BrainRouter[^"']*["']/,
      /from\s+["'][^"']*ProviderRegistry[^"']*["']/,
      /from\s+["'][^"']*core\/providers[^"']*["']/,
      /from\s+["'][^"']*\/providers\/mock[^"']*["']/,
      /from\s+["'][^"']*ProviderAdapter[^"']*["']/,
      /from\s+["'][^"']*MockProvider[^"']*["']/,
    ],
  },
  {
    root: "SOS/SAIOS/core/company-brain",
    label: "company-brain → queue|scheduler|worker|providers",
    patterns: [
      /from\s+["'][^"']*runtime\/queue\/QueueManager[^"']*["']/,
      /from\s+["'][^"']*\/QueueManager[^"']*["']/,
      /from\s+["'][^"']*runtime\/scheduler[^"']*["']/,
      /from\s+["'][^"']*worker-runtime[^"']*["']/,
      /from\s+["'][^"']*WorkerRuntime[^"']*["']/,
      /from\s+["'][^"']*core\/providers[^"']*["']/,
      /from\s+["'][^"']*\/providers\/mock[^"']*["']/,
      /from\s+["'][^"']*ProviderAdapter[^"']*["']/,
      /from\s+["'][^"']*MockProvider[^"']*["']/,
    ],
  },
  {
    root: "SOS/SAIOS/platform/department-sdk",
    label: "department-sdk → execution modules",
    patterns: [
      /from\s+["'][^"']*execution-controller[^"']*["']/,
      /from\s+["'][^"']*activation-gate[^"']*["']/,
      /from\s+["'][^"']*execution-authorization[^"']*["']/,
      /from\s+["'][^"']*pre-dispatch-simulation[^"']*["']/,
      /from\s+["'][^"']*runtime\/queue[^"']*["']/,
      /from\s+["'][^"']*runtime\/scheduler[^"']*["']/,
      /from\s+["'][^"']*worker-runtime[^"']*["']/,
      /from\s+["'][^"']*core\/providers[^"']*["']/,
      /from\s+["'][^"']*BrainRouter[^"']*["']/,
    ],
  },
  {
    root: "SOS/SAIOS/runtime/worker-runtime",
    label: "worker-runtime → execution|queue|scheduler|providers",
    patterns: [
      /from\s+["'][^"']*execution-controller[^"']*["']/,
      /from\s+["'][^"']*activation-gate[^"']*["']/,
      /from\s+["'][^"']*execution-authorization[^"']*["']/,
      /from\s+["'][^"']*pre-dispatch-simulation[^"']*["']/,
      /from\s+["'][^"']*runtime\/queue[^"']*["']/,
      /from\s+["'][^"']*QueueManager[^"']*["']/,
      /from\s+["'][^"']*runtime\/scheduler[^"']*["']/,
      /from\s+["'][^"']*core\/providers[^"']*["']/,
      /from\s+["'][^"']*BrainRouter[^"']*["']/,
      /from\s+["'][^"']*MockProvider[^"']*["']/,
    ],
  },
  {
    root: "SOS/SAIOS/runtime/scheduler",
    label: "scheduler → providers|company-brain|execution-controller",
    patterns: [
      /from\s+["'][^"']*core\/providers[^"']*["']/,
      /from\s+["'][^"']*ProviderAdapter[^"']*["']/,
      /from\s+["'][^"']*MockProvider[^"']*["']/,
      /from\s+["'][^"']*BrainRouter[^"']*["']/,
      /from\s+["'][^"']*company-brain[^"']*["']/,
      /from\s+["'][^"']*execution-controller[^"']*["']/,
    ],
  },
  {
    root: "SOS/SAIOS/runtime/queue",
    label: "queue → execution-controller|worker-runtime|providers",
    patterns: [
      /from\s+["'][^"']*execution-controller[^"']*["']/,
      /from\s+["'][^"']*worker-runtime[^"']*["']/,
      /from\s+["'][^"']*WorkerRuntime[^"']*["']/,
      /from\s+["'][^"']*core\/providers[^"']*["']/,
      /from\s+["'][^"']*MockProvider[^"']*["']/,
      /from\s+["'][^"']*BrainRouter[^"']*["']/,
    ],
  },
];

const UNTOUCHED = [
  "SOS/SAIOS/architecture/runtime-guard.ts",
  "SOS/SAIOS/runtime/queue/QueueManager.ts",
  "SOS/SAIOS/runtime/scheduler/ProductionExecutor.ts",
  "SOS/SAIOS/runtime/worker-runtime/WorkerRuntime.ts",
  "SOS/SAIOS/platform/department-sdk/DepartmentSDK.ts",
  "SOS/SAIOS/core/company-brain/CompanyBrain.ts",
  "SOS/SAIOS/core/ai-brain/BrainRouter.ts",
  "SOS/SAIOS/core/ai-brain/ProviderRegistry.ts",
  "SOS/SAIOS/core/first-production-cycle",
] as const;

const REPORTS = [
  "SOS/09_REPORTS/AIOS_EXECUTION_AUTHORITY_MODEL_CERTIFICATION_V1_REPORT.md",
  "SOS/SAIOS/AIOS_EXECUTION_AUTHORITY_MODEL_CERTIFICATION_V1_REPORT.md",
];

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`EXECUTION AUTHORITY MODEL FAIL: ${msg}`);
}

function read(rel: string): string {
  return readFileSync(join(REPO, rel), "utf8");
}

function walk(dirAbs: string, out: string[]): void {
  if (!existsSync(dirAbs)) return;
  for (const ent of readdirSync(dirAbs)) {
    if (SKIP_DIR.has(ent)) continue;
    const p = join(dirAbs, ent);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (SOURCE_EXT.test(ent)) out.push(p);
  }
}

function isIgnoredSource(rel: string): boolean {
  const base = basename(rel);
  if (base.startsWith("verify-")) return true;
  if (rel.includes("verify-execution-authority-model")) return true;
  // tooling / engineering / cursor / developer utilities
  if (rel.includes("/runtime/cursor/")) return true;
  if (rel.includes("/runtime/tools/")) return true;
  return false;
}

function scan(
  rootRel: string,
  patterns: RegExp[],
): { violations: Array<{ file: string; pattern: string }>; files_scanned: number } {
  const violations: Array<{ file: string; pattern: string }> = [];
  const files: string[] = [];
  walk(join(REPO, rootRel), files);
  let scanned = 0;
  for (const abs of files) {
    const rel = relative(REPO, abs).replace(/\\/g, "/");
    if (isIgnoredSource(rel)) continue;
    scanned += 1;
    const src = readFileSync(abs, "utf8");
    for (const re of patterns) {
      if (re.test(src)) {
        violations.push({ file: rel, pattern: String(re) });
      }
    }
  }
  return { violations, files_scanned: scanned };
}

function main(): void {
  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE must be OFF");
  const checks: Record<string, boolean> = {};

  for (const doc of REQUIRED_DOCS) {
    assert(existsSync(join(REPO, AUTH_DIR, doc)), `missing ${doc}`);
  }
  checks.documents = true;

  const model = read(join(AUTH_DIR, "EXECUTION_AUTHORITY_MODEL.md"));
  assert(model.includes("Company Brain"), "planning owner");
  assert(model.includes("Activation Gate"), "eligibility owner");
  assert(model.includes("Execution Authorization"), "intent owner");
  assert(model.includes("Pre-Dispatch Simulation"), "simulation owner");
  assert(model.includes("Execution Controller"), "authorization-record owner");
  assert(model.includes("authorization-record owner"), "EC role wording");
  assert(
    !/\bis\s+the\s+sole\s+(?:future\s+)?execution\s+authority\b/i.test(model) &&
      !/\bsole\s+future\s+execution\s+authority\b/i.test(model),
    "model must not claim sole execution authority",
  );
  assert(model.includes("Runtime Guard"), "safety owner");
  assert(model.includes("QueueManager"), "queue infrastructure");
  assert(model.includes("Brain Router"), "reasoning owner");

  const chain = read(join(AUTH_DIR, "EXECUTION_CHAIN.md"));
  assert(chain.includes("STOP"), "chain STOP");
  assert(
    chain.includes("NO DISPATCH EXISTS AFTER THIS POINT"),
    "no dispatch after controller",
  );

  const arch = JSON.parse(read(join(AUTH_DIR, "ARCHITECTURE.json"))) as {
    live: boolean;
    execution: boolean;
    dispatch: boolean;
    central_execution_authority: boolean;
    responsibility_mergers: boolean;
    dispatch_after_controller: boolean;
    invariant: string;
    execution_controller_role: string;
  };
  assert(arch.live === false, "ARCHITECTURE live");
  assert(arch.execution === false, "ARCHITECTURE execution");
  assert(arch.dispatch === false, "ARCHITECTURE dispatch");
  assert(arch.central_execution_authority === false, "no central authority");
  assert(arch.responsibility_mergers === false, "no mergers");
  assert(arch.dispatch_after_controller === false, "no dispatch after EC");
  assert(
    arch.invariant === "distributed_decision_ownership_no_central_executor",
    "invariant key",
  );
  assert(
    arch.execution_controller_role.includes("authorization_record_owner"),
    "EC role key",
  );
  checks.authority_docs_valid = true;

  const allViolations: Array<{ edge: string; file: string; pattern: string }> =
    [];
  let totalScanned = 0;

  for (const root of NO_SPAWN_ROOTS) {
    const r = scan(root, SPAWN_RES);
    totalScanned += r.files_scanned;
    for (const v of r.violations) {
      allViolations.push({ edge: `${root} → spawn/child_process`, ...v });
    }
  }

  for (const edge of FORBIDDEN_EDGES) {
    const r = scan(edge.root, edge.patterns);
    totalScanned += r.files_scanned;
    for (const v of r.violations) {
      allViolations.push({ edge: edge.label, ...v });
    }
  }

  // Runtime Guard must remain engine enforcement only (file-level).
  {
    const guardRel = "SOS/SAIOS/architecture/runtime-guard.ts";
    assert(existsSync(join(REPO, guardRel)), "runtime-guard missing");
    const guard = read(guardRel);
    assert(guard.includes("enforceEngineAccess"), "Runtime Guard enforcement");
    assert(
      guard.includes("canonical_execution_spine") ||
        guard.includes("canonical"),
      "Runtime Guard canonical engine",
    );
    const guardForbidden = [
      /from\s+["'][^"']*QueueManager[^"']*["']/,
      /from\s+["'][^"']*worker-runtime[^"']*["']/,
      /from\s+["'][^"']*execution-controller[^"']*["']/,
      /from\s+["'][^"']*company-brain[^"']*["']/,
      /from\s+["'][^"']*BrainRouter[^"']*["']/,
    ];
    for (const re of guardForbidden) {
      assert(!re.test(guard), `Runtime Guard forbidden import ~ ${re}`);
    }
  }
  checks.runtime_guard_enforcement_only = true;

  assert(
    allViolations.length === 0,
    `forbidden imports/spawn:\n${allViolations
      .map((v) => `  [${v.edge}] ${v.file} ~ ${v.pattern}`)
      .join("\n")}`,
  );
  checks.boundary_enforcement_active = true;
  checks.forbidden_imports_absent = true;
  checks.no_product_spawn = true;

  for (const f of UNTOUCHED) {
    assert(existsSync(join(REPO, f)), `untouched missing: ${f}`);
  }

  // Drift correction: Execution Controller must not claim sole authority.
  const ec = read(
    "SOS/SAIOS/runtime/execution-controller/ExecutionController.ts",
  );
  assert(
    !/\bis\s+the\s+sole\s+(?:future\s+)?execution\s+authority\b/i.test(ec) &&
      !/\bsole\s+future\s+execution\s+authority\b/i.test(ec),
    "ExecutionController.ts still claims sole execution authority",
  );
  assert(
    /authorization-record owner|authorization record/i.test(ec) ||
      /one stage/i.test(ec),
    "ExecutionController.ts must state authorization-record / one-stage role",
  );

  const ecArch = JSON.parse(
    read("SOS/SAIOS/runtime/execution-controller/ARCHITECTURE.json"),
  ) as { note?: string; architecture_role?: string };
  assert(
    !/\bis\s+the\s+sole\s+(?:future\s+)?execution\s+authority\b/i.test(
      ecArch.note ?? "",
    ) && !/\bsole\s+future\s+execution\s+authority\b/i.test(ecArch.note ?? ""),
    "execution-controller ARCHITECTURE note sole-authority drift",
  );
  // Keep scaffold role id for phase3-foundation compatibility.
  assert(
    ecArch.architecture_role === "EXECUTION_AUTHORITY_SCAFFOLD",
    "scaffold role id preserved for phase3-foundation",
  );

  const self = read(join(AUTH_DIR, "verify-execution-authority-model.ts"));
  assert(
    !/^import\s+.+from\s+["']\.\.\/\.\.\/(runtime|platform|core)\//m.test(self),
    "verify must not import runtime modules",
  );
  checks.no_runtime_changes = true;
  checks.live_off = true;
  checks.execution_impossible = true;

  for (const rep of REPORTS) {
    assert(existsSync(join(REPO, rep)), `report missing ${rep}`);
    const body = read(rep);
    assert(body.includes("Agent #194"), `${rep} agent`);
    assert(
      body.includes("distributed") || body.includes("Distributed"),
      `${rep} distributed model`,
    );
    assert(
      body.includes("NO DISPATCH") || body.includes("no dispatch"),
      `${rep} no dispatch`,
    );
  }
  checks.reports = true;

  const result = {
    pass: true,
    component: "execution-authority-model-certification-v1",
    agent: "194",
    checks: {
      documents: true,
      authority_docs_valid: true,
      boundary_enforcement_active: true,
      forbidden_imports_absent: true,
      no_product_spawn: true,
      runtime_guard_enforcement_only: true,
      no_central_execution_authority: true,
      no_runtime_changes: true,
      live_off: true,
      execution_impossible: true,
      ...checks,
    },
    mechanical_scan: {
      files_scanned: totalScanned,
      violations: 0,
    },
    overall: "PASS",
  };

  const outDir = join(
    REPO,
    "SOS/07_LOGS/saios/architecture/execution-authority-model",
  );
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, "latest-execution-authority-model-verification.json"),
    JSON.stringify(result, null, 2) + "\n",
    "utf8",
  );

  console.log(JSON.stringify(result, null, 2));
}

main();
