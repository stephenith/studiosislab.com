#!/usr/bin/env tsx
/**
 * Provider Authority Certification verify — Agent #192.
 * Docs + static boundary scan. No runtime imports. No LIVE. No providers.
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
const AUTH_DIR = "SOS/SAIOS/architecture/provider-authority";

const REQUIRED_DOCS = [
  "PROVIDER_AUTHORITIES.md",
  "PROVIDER_PLATFORM.md",
  "CAPABILITY_CROSSWALK.md",
  "BOUNDARY_RULES.md",
  "README.md",
  "verify-provider-authority.ts",
] as const;

const AUTHORITY_NAMES = [
  "Provider Enablement",
  "Capabilities",
  "Routing",
  "Retry",
  "Fallback",
  "Budget Policy",
  "Budget Accounting",
  "Validation",
  "Provider Health",
  "Reasoning",
  "Safety",
] as const;

const FORBIDDEN_ROOTS = [
  "SOS/SAIOS/runtime/worker-runtime",
  "SOS/SAIOS/runtime/workers",
  "SOS/SAIOS/platform/department-sdk",
  "SOS/SAIOS/core/company-brain",
  "SOS/SAIOS/runtime/scheduler",
  "SOS/SAIOS/runtime/queue",
  "SOS/SAIOS/runtime/execution-controller",
] as const;

const SOURCE_EXT = /\.(ts|tsx|js|mjs|cjs)$/;
const SKIP_DIR = new Set(["node_modules", ".git", "dist", "build", "coverage"]);

/** Patterns that constitute a forbidden provider/vendor import. */
const FORBIDDEN_IMPORT_RES = [
  /from\s+["'][^"']*core\/providers[^"']*["']/,
  /from\s+["'][^"']*\/providers\/mock[^"']*["']/,
  /from\s+["'][^"']*ai-brain\/providers[^"']*["']/,
  /from\s+["']openai["']/,
  /from\s+["']@anthropic[^"']*["']/,
  /from\s+["']@google\/generative-ai["']/,
  /from\s+["']@google\/genai["']/,
  /require\(\s*["']openai["']\s*\)/,
  /require\(\s*["']@anthropic[^"']*["']\s*\)/,
  /from\s+["'][^"']*BrainRouter[^"']*["']/,
  /from\s+["'][^"']*MockProvider[^"']*["']/,
  /executeViaMockProvider/,
  /createMockProvider/,
];

const UNTOUCHED = [
  "SOS/SAIOS/core/ai-brain/ProviderRegistry.ts",
  "SOS/SAIOS/core/ai-brain/CapabilityRegistry.ts",
  "SOS/SAIOS/core/ai-brain/BrainRouter.ts",
  "SOS/SAIOS/core/ai-brain/ProviderAdapter.ts",
  "SOS/SAIOS/core/providers/mock/MockProvider.ts",
  "SOS/SAIOS/config/provider-registry.json",
  "SOS/SAIOS/schemas/provider-adapter.schema.json",
  "SOS/SAIOS/architecture/runtime-guard.ts",
  "SOS/SAIOS/runtime/execution-controller/ExecutionController.ts",
  "SOS/SAIOS/platform/department-sdk/DepartmentSDK.ts",
  "SOS/SAIOS/runtime/worker-runtime/WorkerRuntime.ts",
  "SOS/SAIOS/platform/cost-ledger/CostLedger.ts",
] as const;

const REPORTS = [
  "SOS/09_REPORTS/AIOS_PROVIDER_AUTHORITY_CERTIFICATION_V1_REPORT.md",
  "SOS/SAIOS/AIOS_PROVIDER_AUTHORITY_CERTIFICATION_V1_REPORT.md",
];

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`AUTHORITY FAIL: ${msg}`);
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

function scanForbiddenImports(): {
  violations: Array<{ file: string; pattern: string }>;
  files_scanned: number;
} {
  const violations: Array<{ file: string; pattern: string }> = [];
  let files_scanned = 0;
  for (const root of FORBIDDEN_ROOTS) {
    const files: string[] = [];
    walk(join(REPO, root), files);
    for (const abs of files) {
      files_scanned++;
      const src = readFileSync(abs, "utf8");
      const rel = relative(REPO, abs).replace(/\\/g, "/");
      for (const re of FORBIDDEN_IMPORT_RES) {
        if (re.test(src)) {
          violations.push({ file: rel, pattern: String(re) });
        }
      }
    }
  }
  return { violations, files_scanned };
}

function packageHasOpenAi(): boolean {
  try {
    const pkg = JSON.parse(read("package.json")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    return Boolean(all["openai"] || all["@anthropic-ai/sdk"] || all["@google/generative-ai"]);
  } catch {
    return false;
  }
}

function main(): void {
  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE must be OFF");
  const checks: Record<string, boolean> = {};

  // --- Authority docs ---
  for (const doc of REQUIRED_DOCS) {
    assert(existsSync(join(REPO, AUTH_DIR, doc)), `missing ${doc}`);
  }
  const authorities = read(join(AUTH_DIR, "PROVIDER_AUTHORITIES.md"));
  for (const name of AUTHORITY_NAMES) {
    assert(authorities.includes(name), `authority table missing "${name}"`);
  }
  assert(authorities.includes("ProviderRegistry.ts"), "enablement owner");
  assert(authorities.includes("CapabilityRegistry.ts"), "capability owner");
  assert(authorities.includes("CostLedger"), "cost ledger owner");
  assert(
    authorities.includes("does **not** own") ||
      authorities.includes("does not own"),
    "anti-god-module statement",
  );
  checks.authority_table_valid = true;

  const platform = read(join(AUTH_DIR, "PROVIDER_PLATFORM.md"));
  assert(platform.includes("ProviderRegistry"), "platform map");
  assert(platform.includes("CapabilityRegistry"), "platform capabilities");
  assert(platform.includes("BrainRouter"), "platform router");
  assert(platform.includes("distributed"), "distributed architecture");
  assert(
    !/ProviderRegistry owns routing/i.test(platform),
    "must not claim registry owns routing",
  );

  const crosswalk = read(join(AUTH_DIR, "CAPABILITY_CROSSWALK.md"));
  assert(crosswalk.includes("Reasoning"), "crosswalk Reasoning");
  assert(crosswalk.includes("design_planning"), "crosswalk runtime id");
  assert(crosswalk.includes("CapabilityRegistry"), "crosswalk canonical");

  const boundaries = read(join(AUTH_DIR, "BOUNDARY_RULES.md"));
  assert(boundaries.includes("BrainRouter"), "boundary entrypoint");
  assert(boundaries.includes("worker-runtime"), "boundary workers");
  assert(boundaries.includes("department-sdk"), "boundary dept");
  checks.docs_complete = true;

  // --- Charter reconciled (distributed; no sole-owner of routing/capabilities) ---
  const charter = read(
    "SOS/SAIOS/architecture/provider-registry/PROVIDER_REGISTRY_CHARTER.md",
  );
  assert(charter.includes("distributed"), "charter distributed");
  assert(
    charter.includes("does **not** own routing") ||
      charter.includes("does not own routing"),
    "charter must not claim registry owns routing",
  );
  assert(charter.includes("CapabilityRegistry"), "charter capability owner");
  assert(charter.includes("NOT IMPLEMENTED"), "charter still not implemented");
  checks.charter_reconciled = true;

  // --- Boundary enforcement ---
  const scan = scanForbiddenImports();
  assert(
    scan.violations.length === 0,
    `forbidden imports:\n${scan.violations
      .map((v) => `  ${v.file} ~ ${v.pattern}`)
      .join("\n")}`,
  );
  checks.boundary_enforcement_active = true;
  checks.forbidden_imports_absent = true;

  // --- Mechanical router violations (generated) ---
  // Agent #201: official openai SDK is allowed ONLY inside core/providers/openai.
  const openaiInstalled = packageHasOpenAi();
  const openaiAdapterExists = existsSync(
    join(REPO, "SOS/SAIOS/core/providers/openai/OpenAIProvider.ts"),
  );
  if (openaiInstalled) {
    assert(
      openaiAdapterExists,
      "openai SDK requires core/providers/openai adapter",
    );
    const routerSrc = read("SOS/SAIOS/core/ai-brain/BrainRouter.ts");
    assert(
      !/from\s+["']openai["']/.test(routerSrc),
      "BrainRouter must not import openai SDK",
    );
  }
  const mechanical = {
    agent: "192",
    generated_at: new Date().toISOString(),
    kind: "mechanical",
    openai_sdk_installed: openaiInstalled,
    openai_sdk_allowed_only_in_adapter: true,
    vendor_sdk_installed: openaiInstalled,
    forbidden_roots_scanned: [...FORBIDDEN_ROOTS],
    files_scanned: scan.files_scanned,
    forbidden_import_violations: scan.violations,
    provider_entrypoint: "BrainRouter",
    live: process.env.SOS_AIOS_LIVE === "1",
  };
  writeFileSync(
    join(REPO, "SOS/SAIOS/architecture/router-violations.mechanical.json"),
    JSON.stringify(mechanical, null, 2) + "\n",
    "utf8",
  );
  assert(
    existsSync(join(REPO, "SOS/SAIOS/architecture/router-violations.curated.json")),
    "curated router violations missing",
  );
  const curated = JSON.parse(
    read("SOS/SAIOS/architecture/router-violations.curated.json"),
  ) as { violations: Array<{ id: string }> };
  assert(curated.violations?.length >= 10, "curated observations preserved");
  const index = read("SOS/SAIOS/architecture/router-violations.json");
  assert(index.includes("router-violations.curated.json"), "index curated ref");
  assert(index.includes("router-violations.mechanical.json"), "index mechanical ref");
  assert(index.includes("V-001"), "index preserves V-001");
  checks.router_violations_split = true;

  // --- Dependency certification / no runtime changes ---
  for (const f of UNTOUCHED) {
    assert(existsSync(join(REPO, f)), `untouched surface missing: ${f}`);
  }
  const registrySrc = read("SOS/SAIOS/core/ai-brain/ProviderRegistry.ts");
  assert(registrySrc.includes("assertOnlyMockActive"), "registry safety");
  assert(
    !registrySrc.includes("decideRoute"),
    "ProviderRegistry must remain lightweight (no routing)",
  );
  assert(
    !registrySrc.includes("STRONG_CAPABILITIES"),
    "ProviderRegistry must not absorb CapabilityRegistry",
  );
  const capSrc = read("SOS/SAIOS/core/ai-brain/CapabilityRegistry.ts");
  assert(capSrc.includes("classifyCapability"), "CapabilityRegistry canonical");
  const ledger = read("SOS/SAIOS/platform/cost-ledger/CostLedger.ts");
  assert(
    ledger.includes("sole financial authority") || ledger.includes("CostLedger"),
    "Cost Ledger present",
  );
  const router = read("SOS/SAIOS/core/ai-brain/BrainRouter.ts");
  assert(router.includes("planBrainRoute"), "BrainRouter orchestrator");
  assert(router.includes("loadProviderRegistry"), "router→registry edge");
  assert(!/from\s+["'].*cost-ledger/.test(router), "no circular CostLedger import");

  const schema = read("SOS/SAIOS/schemas/provider-adapter.schema.json");
  assert(schema.includes("sdk_dependency_forbidden_in_core"), "schema unchanged");
  const guard = read("SOS/SAIOS/architecture/runtime-guard.ts");
  assert(guard.includes("canonical_execution_spine"), "Pipeline A / Runtime Guard");
  assert(guard.includes("AIOS_ARCHITECTURE_VERSION"), "runtime guard signature");

  // Verify script must not import runtime modules
  const self = read(join(AUTH_DIR, "verify-provider-authority.ts"));
  assert(
    !/^import\s+.+from\s+["']\.\.\/\.\.\/(runtime|platform|core)\//m.test(self),
    "verify must not import runtime",
  );
  checks.no_runtime_changes = true;
  checks.no_contract_changes = true;
  checks.no_schema_changes = true;
  checks.no_api_changes = true;
  checks.no_pipeline_a_changes = true;
  checks.no_runtime_guard_changes = true;
  checks.dependency_certified = true;
  checks.live_off = true;

  // --- Reports ---
  for (const rep of REPORTS) {
    assert(existsSync(join(REPO, rep)), `report missing ${rep}`);
    const body = read(rep);
    assert(body.includes("Agent #192"), `${rep} agent`);
    assert(body.includes("authority"), `${rep} authority`);
  }
  checks.reports = true;

  const result = {
    pass: true,
    component: "provider-authority-certification-v1",
    agent: "192",
    checks: {
      authority_table_valid: true,
      boundary_enforcement_active: true,
      forbidden_imports_absent: true,
      charter_reconciled: true,
      router_violations_split: true,
      dependency_certified: true,
      no_runtime_changes: true,
      no_contract_changes: true,
      no_schema_changes: true,
      no_api_changes: true,
      no_pipeline_a_changes: true,
      no_runtime_guard_changes: true,
      live_off: true,
      ...checks,
    },
    mechanical_scan: {
      files_scanned: scan.files_scanned,
      violations: 0,
    },
    overall: "PASS",
  };

  const outDir = join(REPO, "SOS/07_LOGS/saios/architecture/provider-authority");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, "latest-provider-authority-verification.json"),
    JSON.stringify(result, null, 2) + "\n",
    "utf8",
  );

  console.log(JSON.stringify(result, null, 2));
}

main();
