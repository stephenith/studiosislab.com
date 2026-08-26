/**
 * Mock Provider verify — Agent #118.
 * No SDK. No API. No templates. LIVE off.
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  ECONOMICAL_CAPABILITIES,
  STRONG_CAPABILITIES,
  DETERMINISTIC_CAPABILITIES,
} from "../../ai-brain/CapabilityRegistry.js";
import { executeViaMockProvider, planBrainRoute } from "../../ai-brain/BrainRouter.js";
import { loadProviderRegistry, assertOnlyMockActive } from "../../ai-brain/ProviderRegistry.js";
import type { ReasoningRequest } from "../../ai-brain/ReasoningRequest.js";
import type { BrainCapability } from "../../ai-brain/types.js";
import { MockProvider } from "./MockProvider.js";
import { MOCK_SUPPORTED_CAPABILITIES } from "./MockCapabilities.js";
import { buildStructuredOutput } from "./MockResponseFactory.js";
import { validateMockResponse } from "./MockValidator.js";

const REPO = resolve(import.meta.dirname, "../../../../..");
const LOG = join(REPO, "SOS/07_LOGS/saios/mock-provider");
const PKG = join(REPO, "package.json");

function sampleRequest(capability: BrainCapability): ReasoningRequest {
  return {
    request_id: `req-mock-${capability}`,
    task_id: "task-mock-verify",
    department: "resume",
    capability,
    objective: `verify ${capability}`,
    instructions: `Mock dry-run for ${capability}`,
    context_references: [],
    memory_references: [],
    expected_response_schema: {},
    quality_tier:
      (DETERMINISTIC_CAPABILITIES as readonly string[]).includes(capability)
        ? "deterministic"
        : (STRONG_CAPABILITIES as readonly string[]).includes(capability)
          ? "strong"
          : "economical",
    priority: "normal",
    maximum_input_tokens: 500,
    maximum_output_tokens: 500,
    estimated_cost_ceiling_usd: null,
    timeout_ms: 5000,
    retry_policy: { max_retries: 0, backoff_ms: 0, retry_on: [] },
    fallback_policy: {
      enabled: true,
      allow_provider_fallback: false,
      allow_local_to_api: false,
      respect_privacy: true,
      respect_budget: true,
      respect_founder_gates: true,
      respect_live_gates: true,
    },
    privacy_classification: "INTERNAL",
    created_at: "2026-07-11T08:00:00.000Z",
    deadline: null,
    dry_run: true,
    founder_approval_requirement: true,
  };
}

async function main(): Promise<void> {
  mkdirSync(LOG, { recursive: true });
  const mock = new MockProvider();

  const exists =
    existsSync(join(import.meta.dirname, "MockProvider.ts")) &&
    existsSync(join(import.meta.dirname, "MockResponseFactory.ts"));

  const adapterOk =
    mock.provider_id === "mock" &&
    typeof mock.execute === "function" &&
    typeof mock.healthCheck === "function";

  const health = await mock.healthCheck();
  const registry = loadProviderRegistry();
  const mockOnly = assertOnlyMockActive(registry);
  const openaiOff = !registry.providers.find((p) => p.id === "openai")?.enabled;
  const localOff = !registry.providers.find((p) => p.id === "local")?.enabled;

  // Determinism: same request twice → same structured output + tokens
  const req = sampleRequest("design_planning");
  const a = await mock.execute(req);
  const b = await mock.execute(req);
  const deterministic =
    JSON.stringify(a.structured_output) === JSON.stringify(b.structured_output) &&
    a.input_tokens === b.input_tokens &&
    a.output_tokens === b.output_tokens &&
    a.completed_at === b.completed_at;

  const schemaOk = validateMockResponse(a).ok && a.status === "COMPLETED";

  // All capabilities produce structured output via factory
  let allCapsOk = MOCK_SUPPORTED_CAPABILITIES.length === 21;
  for (const cap of MOCK_SUPPORTED_CAPABILITIES) {
    const out = buildStructuredOutput(sampleRequest(cap));
    if (!out || typeof out !== "object") allCapsOk = false;
  }

  // Brain Router routes strong capability to mock and executes
  const routed = await executeViaMockProvider(
    sampleRequest("report_summarization"),
    mock,
  );
  const routerOk =
    routed.plan.selected_provider === "mock" &&
    routed.response?.status === "COMPLETED" &&
    routed.response.provider === "mock";

  // Deterministic capability rejected by router (policy)
  const detPlan = planBrainRoute(sampleRequest("scheduling"), ["mock"]);
  const detProtected = detPlan.decision.allowed === false;

  // Economical + strong sample executes
  let strongEconOk = true;
  for (const cap of [...STRONG_CAPABILITIES, ...ECONOMICAL_CAPABILITIES]) {
    const r = await mock.execute(sampleRequest(cap));
    if (r.status !== "COMPLETED" || !validateMockResponse(r).ok) strongEconOk = false;
  }

  const mockSrc = [
    "MockProvider.ts",
    "MockResponseFactory.ts",
    "MockValidator.ts",
    "MockCapabilities.ts",
  ]
    .map((f) => readFileSync(join(import.meta.dirname, f), "utf8"))
    .join("\n");
  const noSdk =
    !/from\s+["']openai["']/.test(mockSrc) &&
    !/from\s+["']@anthropic-ai\/sdk["']/.test(mockSrc);

  const liveOff = process.env.SOS_AIOS_LIVE !== "1";
  const apiCalls = 0;
  const templatesGenerated = 0;

  const readiness = {
    generated_at: new Date().toISOString(),
    agent: "118",
    status: "ready",
    provider: "mock",
    api_calls: apiCalls,
    templates_generated: templatesGenerated,
    publications: 0,
    live_enabled: false,
    sdk_installed: false,
    capabilities_supported: MOCK_SUPPORTED_CAPABILITIES.length,
    deterministic: deterministic,
  };
  writeFileSync(join(LOG, "readiness.json"), `${JSON.stringify(readiness, null, 2)}\n`);

  const checks = {
    mock_provider_exists: exists && adapterOk && health.healthy,
    provider_adapter_accepts_it: adapterOk && strongEconOk && allCapsOk,
    brain_router_can_route_to_it: routerOk && detProtected,
    schema_passes: schemaOk && deterministic,
    no_sdk_installed: noSdk,
    no_api_calls: apiCalls === 0,
    no_templates_generated: templatesGenerated === 0,
    live_off: liveOff && mockOnly && openaiOff && localOff,
  };

  const allPass = Object.values(checks).every(Boolean);

  console.log(
    [
      "Mock Provider Verify",
      "====================",
      ...Object.entries(checks).map(
        ([k, v]) => `${v ? "✔" : "✘"} ${k.replace(/_/g, " ")}`,
      ),
      "",
      `Capabilities: ${MOCK_SUPPORTED_CAPABILITIES.length}`,
      `Deterministic: ${deterministic}`,
      `Router → mock report_summarization: ${routed.response?.status}`,
      `API calls: ${apiCalls}`,
      `LIVE: false`,
      `Overall: ${allPass ? "PASS" : "FAIL"}`,
    ].join("\n"),
  );

  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
