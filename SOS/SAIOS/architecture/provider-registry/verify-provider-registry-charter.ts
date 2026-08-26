#!/usr/bin/env tsx
/**
 * Provider Registry Architecture Charter verify — Agent #190.
 * Documentation integrity only. No providers. No LIVE.
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
const CHARTER_DIR = "SOS/SAIOS/architecture/provider-registry";

const REQUIRED_DOCS = [
  "PROVIDER_REGISTRY_CHARTER.md",
  "PROVIDER_REGISTRY_ARCHITECTURE.md",
  "PROVIDER_CAPABILITY_MODEL.md",
  "PROVIDER_SELECTION_POLICY.md",
  "PROVIDER_VALIDATION_FLOW.md",
  "PROVIDER_COST_POLICY.md",
  "PROVIDER_SECURITY_MODEL.md",
  "PROVIDER_FAILURE_MODEL.md",
  "PROVIDER_LIFECYCLE.md",
  "PROVIDER_REGISTRY_MANIFEST.json",
  "README.md",
  "verify-provider-registry-charter.ts",
] as const;

const REQUIRED_PHRASES: Record<string, string[]> = {
  "PROVIDER_REGISTRY_CHARTER.md": [
    "Provider registration",
    "Capability catalog",
    "One Provider Registry",
    "No direct model access",
    "No worker-to-provider communication",
    "NOT IMPLEMENTED",
  ],
  "PROVIDER_REGISTRY_ARCHITECTURE.md": [
    "Brain Router",
    "Provider Registry",
    "Cost Ledger",
    "Pipeline A",
  ],
  "PROVIDER_CAPABILITY_MODEL.md": [
    "Reasoning",
    "Vision",
    "Embeddings",
    "Function Calling",
    "Streaming",
    "Long Context",
  ],
  "PROVIDER_SELECTION_POLICY.md": [
    "Skills",
    "Brain Router",
    "Provider Registry",
    "Validation",
    "Cost Policy",
    "Provider Adapter",
  ],
  "PROVIDER_VALIDATION_FLOW.md": [
    "REGISTERED",
    "VALIDATED",
    "CERTIFIED",
    "ACTIVE",
    "DEPRECATED",
    "ARCHIVED",
  ],
  "PROVIDER_COST_POLICY.md": [
    "Token accounting",
    "Budget ownership",
    "Daily limits",
    "Monthly limits",
    "Emergency reserve",
  ],
  "PROVIDER_SECURITY_MODEL.md": [
    "API keys",
    "Secrets",
    "Encryption",
    "Rotation",
    "Least privilege",
  ],
  "PROVIDER_FAILURE_MODEL.md": [
    "Timeout",
    "Retry",
    "Circuit breaker",
    "Fallback",
    "Budget exhausted",
    "Rate limit",
  ],
  "PROVIDER_LIFECYCLE.md": [
    "Mock",
    "OpenAI",
    "Anthropic",
    "Gemini",
    "Ollama",
    "Custom Provider",
  ],
};

const CROSS_REFS = [
  "SOS/SAIOS/architecture/phase4-execution/PHASE4_EXECUTION_MANIFEST.json",
  "SOS/SAIOS/architecture/phase3-planning/PHASE3_PLANNING_MANIFEST.json",
  "SOS/SAIOS/architecture/module-roles.json",
  "SOS/SAIOS/platform/cost-ledger/ARCHITECTURE.json",
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

  const manifestPath = join(CHARTER_DIR, "PROVIDER_REGISTRY_MANIFEST.json");
  assert(existsSync(join(REPO, manifestPath)), "manifest missing");
  const manifest = JSON.parse(read(manifestPath));
  assert(manifest.charter === "provider-registry-architecture-v1", "charter id");
  assert(manifest.providers === "not_implemented", "providers");
  assert(manifest.adapters === "not_implemented", "adapters");
  assert(manifest.inference === "not_implemented", "inference");
  assert(manifest.live === false, "live");
  assert(
    manifest.provider_registry_charter_version ===
      "provider-registry-charter-1.0.0",
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

  for (const ref of CROSS_REFS) {
    assert(existsSync(join(REPO, ref)), `ref ${ref}`);
  }
  const charter = read(join(CHARTER_DIR, "PROVIDER_REGISTRY_CHARTER.md"));
  assert(charter.includes("phase4-execution") || charter.includes("Phase 4"), "xref p4");
  assert(manifest.cross_references?.phase4_execution, "manifest xref");
  checks.cross_references = true;

  const charterAbs = join(REPO, CHARTER_DIR);
  for (const ent of readdirSync(charterAbs)) {
    const p = join(charterAbs, ent);
    if (statSync(p).isDirectory()) {
      assert(false, `unexpected directory: ${ent}`);
    }
    if (ent.endsWith(".ts")) {
      assert(
        ent === "verify-provider-registry-charter.ts",
        `unexpected ts: ${ent}`,
      );
    }
  }
  checks.no_runtime_changes = true;

  const verifySrc = read(join(CHARTER_DIR, "verify-provider-registry-charter.ts"));
  assert(!/new\s+OpenAI/.test(verifySrc), "no openai client");
  assert(!/from\s+["']openai["']/.test(verifySrc), "no openai import");
  assert(!/from\s+["']@anthropic/.test(verifySrc), "no anthropic");
  assert(!/from\s+["']@google\/generative-ai["']/.test(verifySrc), "no gemini");
  assert(!/enable_live\s*=\s*true/.test(verifySrc), "no live");
  assert(
    !/^import\s+.+from\s+["']\.\.\/\.\.\/(runtime|platform|core)\//m.test(
      verifySrc,
    ),
    "no runtime imports",
  );
  checks.no_provider_implementation = true;
  checks.live_off = true;

  const result = {
    pass: true,
    component: "provider-registry-architecture-charter-v1",
    agent: "190",
    checks: {
      documents: true,
      manifest: true,
      cross_references: true,
      architecture_consistency: true,
      no_runtime_changes: true,
      no_provider_implementation: true,
      live_off: true,
      ...checks,
    },
    overall: "PASS",
  };

  const outDir = join(
    REPO,
    "SOS/07_LOGS/saios/architecture/provider-registry",
  );
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, "latest-provider-registry-charter-verification.json"),
    JSON.stringify(result, null, 2) + "\n",
    "utf8",
  );

  console.log(JSON.stringify(result, null, 2));
}

main();
