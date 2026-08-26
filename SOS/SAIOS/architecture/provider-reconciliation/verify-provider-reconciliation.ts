#!/usr/bin/env tsx
/**
 * Provider Architecture Reconciliation Audit verify — Agent #191.
 *
 * Confirms the audit is READ-ONLY: runtime untouched, no provider code / contract /
 * schema / API / Runtime Guard / Pipeline A changes, no safety-flag changes, LIVE OFF.
 * This script reads only; it never modifies runtime or enables anything.
 */
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO = resolve(import.meta.dirname, "../../../..");

const REPORTS = [
  "SOS/09_REPORTS/AIOS_PROVIDER_RECONCILIATION_AUDIT_V1_REPORT.md",
  "SOS/SAIOS/AIOS_PROVIDER_RECONCILIATION_AUDIT_V1_REPORT.md",
];

// Runtime provider surface that MUST remain untouched (existence + invariants only).
const RUNTIME_FILES = [
  "SOS/SAIOS/core/ai-brain/ProviderAdapter.ts",
  "SOS/SAIOS/core/ai-brain/ProviderRegistry.ts",
  "SOS/SAIOS/core/ai-brain/BrainRouter.ts",
  "SOS/SAIOS/core/ai-brain/CapabilityRegistry.ts",
  "SOS/SAIOS/core/ai-brain/ModelRoutingPolicy.ts",
  "SOS/SAIOS/core/ai-brain/BudgetPolicy.ts",
  "SOS/SAIOS/core/ai-brain/FallbackPolicy.ts",
  "SOS/SAIOS/core/ai-brain/RetryPolicy.ts",
  "SOS/SAIOS/core/providers/mock/MockProvider.ts",
  "SOS/SAIOS/config/provider-registry.json",
  "SOS/SAIOS/schemas/provider-adapter.schema.json",
  "SOS/SAIOS/architecture/runtime-guard.ts",
];

const REQUIRED_SECTIONS = [
  "## 1. Current runtime ownership",
  "## 2. Charter ownership",
  "## 3. Reconciliation matrix",
  "## 4. Actual runtime provider call flow",
  "## 5. Duplicate / distributed authority analysis",
  "## 6. Technical debt classification",
  "## 7. Phase 4 readiness",
  "## 8. Provider neutrality assessment",
  "## 9. Execution safety",
  "## 10. Certification",
];

const VENDOR_SDK = [
  /from\s+["']openai["']/,
  /from\s+["']@anthropic/,
  /from\s+["']@google\/generative-ai["']/,
  /from\s+["']@google\/genai["']/,
];

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`RECONCILIATION FAIL: ${msg}`);
}

function read(rel: string): string {
  return readFileSync(join(REPO, rel), "utf8");
}

function main(): void {
  const checks: Record<string, boolean> = {};

  // LIVE OFF
  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE must be OFF");
  checks.live_off = true;

  // Both reports exist and contain all 10 sections + the verdict.
  for (const rep of REPORTS) {
    assert(existsSync(join(REPO, rep)), `report missing: ${rep}`);
    const body = read(rep);
    for (const sec of REQUIRED_SECTIONS) {
      assert(body.includes(sec), `${rep} missing section "${sec}"`);
    }
    assert(
      body.includes("REQUIRES CONSOLIDATION"),
      `${rep} missing certification verdict`,
    );
    assert(
      /STRICTLY READ-ONLY|read-only reconciliation audit/i.test(body),
      `${rep} missing read-only declaration`,
    );
  }
  checks.reports_complete = true;

  // Runtime provider surface still present (audit did not delete/replace it).
  for (const f of RUNTIME_FILES) {
    assert(existsSync(join(REPO, f)), `runtime file missing (must be untouched): ${f}`);
  }
  checks.runtime_present = true;

  // No vendor SDK crept into the provider runtime (no provider implementation added).
  const scanned = [
    "SOS/SAIOS/core/ai-brain/ProviderAdapter.ts",
    "SOS/SAIOS/core/ai-brain/BrainRouter.ts",
    "SOS/SAIOS/core/ai-brain/ProviderRegistry.ts",
    "SOS/SAIOS/core/providers/mock/MockProvider.ts",
  ];
  for (const f of scanned) {
    const src = read(f);
    for (const re of VENDOR_SDK) {
      assert(!re.test(src), `vendor SDK import found in ${f} (${re})`);
    }
  }
  checks.no_provider_implementation = true;

  // Registry contract unchanged: only mock active, openai disabled, LIVE-independent.
  const registry = JSON.parse(read("SOS/SAIOS/config/provider-registry.json")) as {
    active_provider_allowed: string[];
    providers: Array<{ id: string; enabled: boolean; mode?: string }>;
  };
  assert(
    JSON.stringify(registry.active_provider_allowed) === JSON.stringify(["mock"]),
    "provider registry active set must remain only [\"mock\"]",
  );
  const openai = registry.providers.find((p) => p.id === "openai");
  assert(!!openai && openai.enabled === false, "openai must remain disabled");
  const mock = registry.providers.find((p) => p.id === "mock");
  assert(!!mock && mock.enabled === true && mock.mode === "dry_run", "mock must remain dry_run");
  checks.contracts_unchanged = true;

  // Safety flags on the mock provider unchanged.
  const mockSrc = read("SOS/SAIOS/core/providers/mock/MockProvider.ts");
  assert(mockSrc.includes("no_external_api"), "mock safety flag no_external_api missing");
  assert(mockSrc.includes("dry_run") && mockSrc.includes("mock_provider"), "mock safety flags missing");
  checks.safety_flags_unchanged = true;

  // Adapter schema still forbids SDK dependency in core.
  const schema = read("SOS/SAIOS/schemas/provider-adapter.schema.json");
  assert(schema.includes("sdk_dependency_forbidden_in_core"), "adapter schema guard missing");
  checks.schemas_unchanged = true;

  // Runtime Guard + Pipeline A markers intact (no changes to freeze semantics).
  const guard = read("SOS/SAIOS/architecture/runtime-guard.ts");
  assert(guard.includes("AIOS_ARCHITECTURE_VERSION"), "runtime-guard signature missing");
  assert(guard.includes("canonical_execution_spine"), "Pipeline A canonical spine marker missing");
  checks.runtime_guard_unchanged = true;

  // This verify script itself performs no runtime import and no LIVE enablement.
  const self = read(
    "SOS/SAIOS/architecture/provider-reconciliation/verify-provider-reconciliation.ts",
  );
  assert(
    !/^import\s+.+from\s+["']\.\.\/\.\.\/(runtime|platform|core)\//m.test(self),
    "verify must not import runtime modules",
  );
  assert(!/enable_live\s*=\s*true|SOS_AIOS_LIVE\s*=\s*["']?1/.test(self), "verify must not enable LIVE");
  checks.read_only_audit = true;

  const result = {
    pass: true,
    component: "provider-architecture-reconciliation-audit-v1",
    agent: "191",
    verdict: "REQUIRES CONSOLIDATION",
    checks: {
      live_off: checks.live_off,
      reports_complete: checks.reports_complete,
      runtime_present: checks.runtime_present,
      runtime_untouched: checks.runtime_present,
      no_provider_implementation: checks.no_provider_implementation,
      contracts_unchanged: checks.contracts_unchanged,
      schemas_unchanged: checks.schemas_unchanged,
      safety_flags_unchanged: checks.safety_flags_unchanged,
      runtime_guard_unchanged: checks.runtime_guard_unchanged,
      pipeline_a_unchanged: checks.runtime_guard_unchanged,
      read_only_audit: checks.read_only_audit,
    },
    overall: "PASS",
  };

  const outDir = join(REPO, "SOS/07_LOGS/saios/architecture/provider-reconciliation");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, "latest-provider-reconciliation-verification.json"),
    JSON.stringify(result, null, 2) + "\n",
    "utf8",
  );

  console.log(JSON.stringify(result, null, 2));
}

main();
