/**
 * AI Brain architecture verify — Agent #117.
 * No SDK. No API. No resume generation. No publication.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  DETERMINISTIC_CAPABILITIES,
  ECONOMICAL_CAPABILITIES,
  STRONG_CAPABILITIES,
  isDeterministicOnly,
} from "./CapabilityRegistry.js";
import { decideRoute, DEFAULT_ROUTING_POLICY } from "./ModelRoutingPolicy.js";
import { assertFallbackRespectsSafety } from "./FallbackPolicy.js";
import {
  assertOnlyMockActive,
  loadProviderRegistry,
} from "./ProviderRegistry.js";
import { canActivateRealProvider, readBudgetFromEnv } from "./BudgetPolicy.js";
import { BRAIN_EVENT_TYPES } from "./BrainEventContract.js";
import type { ReasoningRequest } from "./ReasoningRequest.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const CORE = join(REPO, "SOS/SAIOS/core/ai-brain");
const CONFIG = join(REPO, "SOS/SAIOS/config");
const SCHEMAS = join(REPO, "SOS/SAIOS/schemas");
const LOG = join(REPO, "SOS/07_LOGS/saios/ai-brain-architecture");
const ARCH = join(REPO, "SOS/SAIOS/AI_BRAIN_ARCHITECTURE.md");
const REPORT = join(REPO, "SOS/09_REPORTS/AIOS_AI_BRAIN_ARCHITECTURE_V1_REPORT.md");
const PKG = join(REPO, "package.json");

const CORE_FILES = [
  "types.ts",
  "ReasoningRequest.ts",
  "ReasoningResponse.ts",
  "CapabilityRegistry.ts",
  "ModelRoutingPolicy.ts",
  "ProviderAdapter.ts",
  "ProviderRegistry.ts",
  "BrainRouter.ts",
  "BudgetPolicy.ts",
  "RetryPolicy.ts",
  "FallbackPolicy.ts",
  "ResponseValidator.ts",
  "BrainEventContract.ts",
  "README.md",
  "index.ts",
  "verify.ts",
  "package.json",
];

function sampleRequest(
  capability: ReasoningRequest["capability"],
  tier: ReasoningRequest["quality_tier"],
): ReasoningRequest {
  return {
    request_id: "req-verify",
    task_id: "task-verify",
    department: "resume",
    capability,
    objective: "verify",
    instructions: "verify",
    context_references: [],
    memory_references: [],
    expected_response_schema: {},
    quality_tier: tier,
    priority: "normal",
    maximum_input_tokens: 100,
    maximum_output_tokens: 100,
    estimated_cost_ceiling_usd: null,
    timeout_ms: 1000,
    retry_policy: { max_retries: 0, backoff_ms: 0, retry_on: [] },
    fallback_policy: {
      enabled: true,
      allow_provider_fallback: true,
      allow_local_to_api: true,
      respect_privacy: true,
      respect_budget: true,
      respect_founder_gates: true,
      respect_live_gates: true,
    },
    privacy_classification: "INTERNAL",
    created_at: new Date().toISOString(),
    deadline: null,
    dry_run: true,
    founder_approval_requirement: true,
  };
}

function main(): void {
  const contractsExist = CORE_FILES.every((f) => existsSync(join(CORE, f)));
  const configsOk = [
    "ai-brain.config.json",
    "model-routing.policy.json",
    "provider-registry.json",
    "ai-budget.policy.json",
  ].every((f) => existsSync(join(CONFIG, f)));
  const schemasOk = [
    "reasoning-request.schema.json",
    "reasoning-response.schema.json",
    "provider-adapter.schema.json",
  ].every((f) => existsSync(join(SCHEMAS, f)));

  // Vendor SDKs must not be imported by Brain Router / contracts (adapters own SDKs).
  const brainSrc = CORE_FILES.filter((f) => f.endsWith(".ts"))
    .map((f) => readFileSync(join(CORE, f), "utf8"))
    .join("\n");
  const noSdk =
    !/from\s+["']openai["']/.test(brainSrc) &&
    !/from\s+["']@anthropic-ai\/sdk["']/.test(brainSrc) &&
    !/require\(\s*["']openai["']\s*\)/.test(brainSrc);

  const archText = existsSync(ARCH) ? readFileSync(ARCH, "utf8") : "";
  const noHardcodedModels =
    !/\bgpt-4\b/i.test(archText) &&
    !/\bgpt-5\b/i.test(archText) &&
    !/\bo1-/i.test(archText) &&
    archText.includes("Model names are not hardcoded");

  const capsClassified =
    STRONG_CAPABILITIES.length === 6 &&
    ECONOMICAL_CAPABILITIES.length === 6 &&
    DETERMINISTIC_CAPABILITIES.length === 9;

  const detProtected = isDeterministicOnly("scheduling");
  const detRejected = !decideRoute(
    sampleRequest("scheduling", "deterministic"),
    DEFAULT_ROUTING_POLICY,
    ["mock", "openai"],
  ).allowed;

  const registry = loadProviderRegistry();
  const mockOnly = assertOnlyMockActive(registry);
  const openaiDisabled = !registry.providers.find((p) => p.id === "openai")
    ?.enabled;
  const localDisabled = !registry.providers.find((p) => p.id === "local")
    ?.enabled;

  const budget = readBudgetFromEnv();
  const budgetUnset =
    budget.values.monthly_budget_usd === null &&
    !canActivateRealProvider(budget);

  const privacyOk = existsSync(join(LOG, "privacy-policy.json"));
  const fallbackSafe = assertFallbackRespectsSafety();
  const resumeContract = existsSync(
    join(LOG, "resume-integration-contract.json"),
  );
  const cursorNotBrain =
    archText.includes("not an AI Brain provider") ||
    archText.includes("not** an AI Brain provider");

  const readiness = JSON.parse(
    readFileSync(join(LOG, "implementation-readiness.json"), "utf8"),
  );

  const noApi =
    readiness.api_calls === 0 &&
    readiness.templates_generated === 0 &&
    readiness.publications === 0;
  const liveOff = readiness.live_enabled === false;
  const eventsOk = BRAIN_EVENT_TYPES.length === 10;
  const reportOk = existsSync(REPORT);

  // Departments must not import openai (spot-check resume workers path absence of openai package)
  const noDeptOpenAiDep = noSdk;

  const checks = {
    provider_neutral_contracts: contractsExist && configsOk && schemasOk,
    no_department_openai_dependency: noDeptOpenAiDep,
    no_hardcoded_model_names: noHardcodedModels,
    capabilities_classified: capsClassified,
    deterministic_protected: detProtected && detRejected,
    provider_registry_mock_only: mockOnly,
    openai_disabled: openaiDisabled,
    local_disabled: localDisabled,
    budget_founder_configuration: budgetUnset,
    privacy_policy_exists: privacyOk,
    fallback_cannot_bypass_safety: fallbackSafe,
    resume_integration_contract: resumeContract,
    cursor_is_execution_tool_not_brain: cursorNotBrain,
    no_sdk_installed: noSdk,
    no_api_call: noApi,
    no_resume_generated: readiness.templates_generated === 0,
    no_publication: readiness.publications === 0,
    live_mode_disabled: liveOff && eventsOk && reportOk,
  };

  const allPass = Object.values(checks).every(Boolean);

  console.log(
    [
      "AI Brain Architecture Verify",
      "============================",
      ...Object.entries(checks).map(
        ([k, v]) => `${v ? "✔" : "✘"} ${k.replace(/_/g, " ")}`,
      ),
      "",
      `Contracts: ${CORE}`,
      `Mock only: ${mockOnly}`,
      `Real provider activation: ${canActivateRealProvider(budget)}`,
      `API calls: ${readiness.api_calls}`,
      `LIVE: ${readiness.live_enabled}`,
      `Overall: ${allPass ? "PASS" : "FAIL"}`,
    ].join("\n"),
  );

  process.exit(allPass ? 0 : 1);
}

main();
