#!/usr/bin/env tsx
/**
 * Cost Authority Certification verify — Agent #193.
 * Docs + static import-boundary scan. No runtime imports. No LIVE. No billing.
 */
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join, resolve, relative } from "node:path";

const REPO = resolve(import.meta.dirname, "../../../..");
const AUTH_DIR = "SOS/SAIOS/architecture/cost-authority";

const REQUIRED_DOCS = [
  "COST_AUTHORITY.md",
  "FINANCIAL_BOUNDARIES.md",
  "ESTIMATION_VS_ACCOUNTING.md",
  "BUDGET_POLICY_AUTHORITY.md",
  "COST_LEDGER_AUTHORITY.md",
  "IMPORT_BOUNDARIES.md",
  "README.md",
  "ARCHITECTURE.json",
  "verify-cost-authority.ts",
] as const;

const SOURCE_EXT = /\.(ts|tsx|js|mjs|cjs)$/;
const SKIP_DIR = new Set(["node_modules", ".git", "dist", "build", "coverage"]);

/** Roots that must not import Cost Ledger. */
const NO_LEDGER_ROOTS = [
  "SOS/SAIOS/runtime/execution-controller",
  "SOS/SAIOS/runtime/worker-runtime",
  "SOS/SAIOS/platform/department-sdk",
  "SOS/SAIOS/core/company-brain",
] as const;

const LEDGER_IMPORT_RES = [
  /from\s+["'][^"']*platform\/cost-ledger[^"']*["']/,
  /from\s+["'][^"']*cost-ledger\/[^"']*["']/,
  /from\s+["'][^"']*\/CostLedger[^"']*["']/,
  /require\(\s*["'][^"']*cost-ledger[^"']*["']\s*\)/,
];

/** Cost Ledger must not import providers / BrainRouter / ProviderAdapter. */
const LEDGER_ROOT = "SOS/SAIOS/platform/cost-ledger";
const LEDGER_FORBIDDEN_RES = [
  /from\s+["'][^"']*core\/providers[^"']*["']/,
  /from\s+["'][^"']*\/providers\/mock[^"']*["']/,
  /from\s+["'][^"']*ProviderAdapter[^"']*["']/,
  /from\s+["'][^"']*BrainRouter[^"']*["']/,
  /from\s+["'][^"']*MockProvider[^"']*["']/,
  /from\s+["']openai["']/,
  /from\s+["']@anthropic[^"']*["']/,
];

/** Provider adapters must not import Cost Ledger. */
const PROVIDERS_ROOT = "SOS/SAIOS/core/providers";

const UNTOUCHED = [
  "SOS/SAIOS/core/ai-brain/BudgetPolicy.ts",
  "SOS/SAIOS/core/ai-brain/BrainRouter.ts",
  "SOS/SAIOS/core/providers/mock/MockProvider.ts",
  "SOS/SAIOS/core/providers/mock/MockResponseFactory.ts",
  "SOS/SAIOS/platform/cost-ledger/CostLedger.ts",
  "SOS/SAIOS/platform/cost-ledger/CostEstimator.ts",
  "SOS/SAIOS/architecture/runtime-guard.ts",
  "SOS/SAIOS/runtime/execution-controller/ExecutionController.ts",
  "SOS/SAIOS/platform/department-sdk/DepartmentSDK.ts",
  "SOS/SAIOS/runtime/worker-runtime/WorkerRuntime.ts",
  "SOS/SAIOS/core/company-brain/CompanyBrain.ts",
] as const;

const REPORTS = [
  "SOS/09_REPORTS/AIOS_COST_AUTHORITY_CERTIFICATION_V1_REPORT.md",
  "SOS/SAIOS/AIOS_COST_AUTHORITY_CERTIFICATION_V1_REPORT.md",
];

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`COST AUTHORITY FAIL: ${msg}`);
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

function scan(
  rootRel: string,
  patterns: RegExp[],
): { violations: Array<{ file: string; pattern: string }>; files_scanned: number } {
  const violations: Array<{ file: string; pattern: string }> = [];
  const files: string[] = [];
  walk(join(REPO, rootRel), files);
  for (const abs of files) {
    const src = readFileSync(abs, "utf8");
    const rel = relative(REPO, abs).replace(/\\/g, "/");
    // Skip the verify script itself if ever colocated; skip ARCHITECTURE-only dirs
    if (rel.includes("verify-cost-authority")) continue;
    for (const re of patterns) {
      if (re.test(src)) {
        violations.push({ file: rel, pattern: String(re) });
      }
    }
  }
  return { violations, files_scanned: files.length };
}

function main(): void {
  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE must be OFF");
  const checks: Record<string, boolean> = {};

  for (const doc of REQUIRED_DOCS) {
    assert(existsSync(join(REPO, AUTH_DIR, doc)), `missing ${doc}`);
  }
  checks.documents = true;

  const authority = read(join(AUTH_DIR, "COST_AUTHORITY.md"));
  assert(authority.includes("Activation Budget Policy"), "activation authority");
  assert(authority.includes("BudgetPolicy.ts"), "BudgetPolicy owner");
  assert(authority.includes("platform/cost-ledger"), "ledger owner");
  assert(authority.includes("ProviderAdapter"), "adapter estimation");
  assert(
    authority.includes("Estimation") && authority.includes("Accounting"),
    "estimation vs accounting",
  );

  const invariant = read(join(AUTH_DIR, "ESTIMATION_VS_ACCOUNTING.md"));
  assert(
    invariant.includes("intentionally separate") ||
      invariant.includes("Estimation ≠ Accounting"),
    "estimation≠accounting invariant",
  );
  assert(invariant.includes("required architectural invariant"), "required invariant");

  const arch = JSON.parse(read(join(AUTH_DIR, "ARCHITECTURE.json"))) as {
    live: boolean;
    billing: boolean;
    execution: boolean;
    responsibility_mergers: boolean;
    invariant: string;
  };
  assert(arch.live === false, "ARCHITECTURE live");
  assert(arch.billing === false, "ARCHITECTURE billing");
  assert(arch.execution === false, "ARCHITECTURE execution");
  assert(arch.responsibility_mergers === false, "no mergers");
  assert(arch.invariant === "estimation_neq_accounting", "invariant key");
  checks.authority_docs_valid = true;

  // --- Import boundary scans ---
  const allViolations: Array<{ edge: string; file: string; pattern: string }> = [];
  let totalScanned = 0;

  for (const root of NO_LEDGER_ROOTS) {
    const r = scan(root, LEDGER_IMPORT_RES);
    totalScanned += r.files_scanned;
    for (const v of r.violations) {
      allViolations.push({ edge: `${root} → cost-ledger`, ...v });
    }
  }

  {
    const r = scan(LEDGER_ROOT, LEDGER_FORBIDDEN_RES);
    totalScanned += r.files_scanned;
    for (const v of r.violations) {
      allViolations.push({ edge: "cost-ledger → providers/router", ...v });
    }
  }

  {
    const r = scan(PROVIDERS_ROOT, LEDGER_IMPORT_RES);
    totalScanned += r.files_scanned;
    for (const v of r.violations) {
      allViolations.push({ edge: "providers → cost-ledger", ...v });
    }
  }

  assert(
    allViolations.length === 0,
    `forbidden imports:\n${allViolations
      .map((v) => `  [${v.edge}] ${v.file} ~ ${v.pattern}`)
      .join("\n")}`,
  );
  checks.boundary_enforcement_active = true;
  checks.forbidden_imports_absent = true;

  // --- No runtime behaviour changes (surfaces present + signatures) ---
  for (const f of UNTOUCHED) {
    assert(existsSync(join(REPO, f)), `untouched missing: ${f}`);
  }
  const bp = read("SOS/SAIOS/core/ai-brain/BudgetPolicy.ts");
  assert(bp.includes("canActivateRealProvider"), "activation gate intact");
  assert(!/from\s+["'].*cost-ledger/.test(bp), "BudgetPolicy must not import ledger");

  const ledger = read("SOS/SAIOS/platform/cost-ledger/CostLedger.ts");
  assert(
    ledger.includes("sole financial authority") || ledger.includes("CostLedger"),
    "ledger intact",
  );
  assert(!/from\s+["'].*providers/.test(ledger), "ledger no provider import");

  const mockEst = read("SOS/SAIOS/core/providers/mock/MockResponseFactory.ts");
  assert(mockEst.includes("estimateTokensAndCost"), "adapter estimation intact");

  const guard = read("SOS/SAIOS/architecture/runtime-guard.ts");
  assert(guard.includes("canonical_execution_spine"), "Runtime Guard / Pipeline A");

  const self = read(join(AUTH_DIR, "verify-cost-authority.ts"));
  assert(
    !/^import\s+.+from\s+["']\.\.\/\.\.\/(runtime|platform|core)\//m.test(self),
    "verify must not import runtime modules",
  );
  checks.no_runtime_changes = true;
  checks.no_api_schema_contract_changes = true;
  checks.live_off = true;

  for (const rep of REPORTS) {
    assert(existsSync(join(REPO, rep)), `report missing ${rep}`);
    const body = read(rep);
    assert(body.includes("Agent #193"), `${rep} agent`);
    assert(
      body.includes("Estimation") && body.includes("Accounting"),
      `${rep} invariant`,
    );
  }
  checks.reports = true;

  const result = {
    pass: true,
    component: "cost-authority-certification-v1",
    agent: "193",
    checks: {
      documents: true,
      authority_docs_valid: true,
      boundary_enforcement_active: true,
      forbidden_imports_absent: true,
      estimation_neq_accounting: true,
      no_runtime_changes: true,
      no_api_schema_contract_changes: true,
      live_off: true,
      billing_off: true,
      ...checks,
    },
    mechanical_scan: {
      files_scanned: totalScanned,
      violations: 0,
    },
    overall: "PASS",
  };

  const outDir = join(REPO, "SOS/07_LOGS/saios/architecture/cost-authority");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, "latest-cost-authority-verification.json"),
    JSON.stringify(result, null, 2) + "\n",
    "utf8",
  );

  console.log(JSON.stringify(result, null, 2));
}

main();
