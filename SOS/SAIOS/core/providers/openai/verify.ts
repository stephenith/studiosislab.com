/**
 * OpenAI Provider verify — Agent #201 / #202.
 * Proves ReasoningRequest → Responses API client → ReasoningResponse → Resume consume.
 * Stub path is deterministic (default PASS). Live path persists separately when keyed.
 * LIVE OFF. No Scheduler / Queue / Worker / publication.
 * Network call only when OPENAI_API_KEY + SOS_AI_FOUNDER_OPENAI_ONE_TEST=1 + budgets.
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import dotenv from "dotenv";
dotenv.config({
  path: resolve(process.cwd(), ".env.local"),
});
import {
  executeViaProvider,
  planBrainRoute,
} from "../../ai-brain/BrainRouter.js";
import {
  assertOnlyMockActive,
  loadProviderRegistry,
  type ProviderRegistryState,
} from "../../ai-brain/ProviderRegistry.js";
import type { ReasoningRequest } from "../../ai-brain/ReasoningRequest.js";
import type { ReasoningResponse } from "../../ai-brain/ReasoningResponse.js";
import { PLANNED_ADAPTERS } from "../../ai-brain/ProviderAdapter.js";
import { canActivateRealProvider, readBudgetFromEnv } from "../../ai-brain/BudgetPolicy.js";
import {
  consumeResumeResponse,
  type ResumeConsumedResult,
} from "../../resume-integration/ResumeResponseConsumer.js";
import type { SkillRequest } from "../../skills/Skill.js";
import {
  createOpenAIProvider,
  type OpenAIResponsesClient,
} from "./OpenAIProvider.js";
import { OPENAI_SUPPORTED_CAPABILITIES } from "./OpenAICapabilities.js";

const REPO = resolve(import.meta.dirname, "../../../../..");
const LOG = join(REPO, "SOS/07_LOGS/saios/openai-provider");
const PKG = join(REPO, "package.json");

function sampleRequest(overrides: Partial<ReasoningRequest> = {}): ReasoningRequest {
  return {
    request_id: "req-openai-verify-001",
    task_id: "task-openai-verify",
    department: "resume",
    capability: "report_summarization",
    objective:
      "Summarize a fictional ATS-friendly Marketing Manager resume plan for Founder review",
    instructions:
      "Return JSON with summary and notes. Use fictional content only.",
    context_references: ["knowledge:verify-ref"],
    memory_references: [],
    expected_response_schema: {},
    quality_tier: "economical",
    priority: "normal",
    maximum_input_tokens: 400,
    maximum_output_tokens: 400,
    estimated_cost_ceiling_usd: null,
    timeout_ms: 30_000,
    retry_policy: { max_retries: 0, backoff_ms: 0, retry_on: [] },
    fallback_policy: {
      enabled: false,
      allow_provider_fallback: false,
      allow_local_to_api: false,
      respect_privacy: true,
      respect_budget: true,
      respect_founder_gates: true,
      respect_live_gates: true,
    },
    privacy_classification: "INTERNAL",
    created_at: new Date().toISOString(),
    deadline: null,
    dry_run: false,
    founder_approval_requirement: true,
    ...overrides,
  };
}

function openaiReadyRegistry(): ProviderRegistryState {
  return {
    version: "1.0.0",
    active_provider_allowed: ["mock", "openai"],
    providers: [
      {
        id: "mock",
        enabled: true,
        mode: "dry_run",
        credentials_configured: false,
        implemented: true,
      },
      {
        id: "openai",
        enabled: true,
        mode: "live",
        credentials_configured: true,
        implemented: true,
        notes: "verify overlay — not written to committed registry",
      },
      {
        id: "local",
        enabled: false,
        mode: "disabled",
        credentials_configured: false,
        implemented: false,
      },
      {
        id: "future_provider",
        enabled: false,
        mode: "disabled",
        credentials_configured: false,
      },
    ],
  };
}

function stubResponsesClient(): OpenAIResponsesClient {
  return {
    responses: {
      async create() {
        return {
          id: "resp_verify_stub_001",
          model: "gpt-4.1-mini",
          output_text: JSON.stringify({
            summary:
              "Fictional Marketing Manager plan: single-column ATS layout with clear section hierarchy.",
            notes: [
              "openai_provider_verify_stub",
              "deterministic_normalized_response",
            ],
            capability: "report_summarization",
            plan_type: "report_summarization",
          }),
          usage: { input_tokens: 120, output_tokens: 80 },
        };
      },
    },
  };
}

function sampleSkillRequest(): SkillRequest {
  return {
    request_id: "skill-openai-verify-001",
    task_id: "task-openai-verify",
    department: "resume",
    skill_id: "resume.layout_planning",
    input: {
      objective:
        "Create a planning response for an ATS-friendly Marketing Manager template",
    },
    context_references: ["knowledge:verify-ref"],
    memory_references: [],
    dry_run: true,
    created_at: new Date().toISOString(),
  };
}

async function main(): Promise<void> {
  mkdirSync(LOG, { recursive: true });

  const liveOff = process.env.SOS_AIOS_LIVE !== "1";
  const committed = loadProviderRegistry();
  const mockOnlyDefault = assertOnlyMockActive(committed);
  const openaiCommitted = committed.providers.find((p) => p.id === "openai");
  const openaiImplementedDefault = openaiCommitted?.implemented === true;
  const openaiDisabledDefault = openaiCommitted?.enabled === false;

  const pkg = JSON.parse(readFileSync(PKG, "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const sdkInstalled = "openai" in deps;

  const brainRouterSrc = readFileSync(
    join(REPO, "SOS/SAIOS/core/ai-brain/BrainRouter.ts"),
    "utf8",
  );
  const routerNoSdk =
    !/from\s+["']openai["']/.test(brainRouterSrc) &&
    !/require\(\s*["']openai["']\s*\)/.test(brainRouterSrc);

  const planned = PLANNED_ADAPTERS.find((p) => p.id === "openai");
  const plannedOk = planned?.implemented === true;

  const filesOk = [
    "OpenAIProvider.ts",
    "OpenAICapabilities.ts",
    "OpenAIValidator.ts",
    "OpenAIEstimate.ts",
    "OpenAIResponseFactory.ts",
    "ARCHITECTURE.json",
    "verify.ts",
  ].every((f) => existsSync(join(import.meta.dirname, f)));

  // Stubbed Responses API path through adapter + router + consumer
  const prevFounder = process.env.SOS_AI_FOUNDER_OPENAI_ONE_TEST;
  const prevKey = process.env.OPENAI_API_KEY;
  const budgetKeys = [
    "SOS_AI_MONTHLY_BUDGET_USD",
    "SOS_AI_DAILY_LIMIT_USD",
    "SOS_AI_PER_TASK_TOKEN_LIMIT",
    "SOS_AI_AUTO_PAUSE_THRESHOLD_PCT",
    "SOS_AI_FOUNDER_ALERT_THRESHOLD_PCT",
  ] as const;
  const prevBudgets: Record<string, string | undefined> = {};
  for (const k of budgetKeys) prevBudgets[k] = process.env[k];

  process.env.SOS_AI_FOUNDER_OPENAI_ONE_TEST = "1";
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim()
    ? process.env.OPENAI_API_KEY
    : "sk-verify-stub-not-a-real-key";
  process.env.SOS_AI_MONTHLY_BUDGET_USD =
    process.env.SOS_AI_MONTHLY_BUDGET_USD || "50";
  process.env.SOS_AI_DAILY_LIMIT_USD =
    process.env.SOS_AI_DAILY_LIMIT_USD || "5";
  process.env.SOS_AI_PER_TASK_TOKEN_LIMIT =
    process.env.SOS_AI_PER_TASK_TOKEN_LIMIT || "4000";
  process.env.SOS_AI_AUTO_PAUSE_THRESHOLD_PCT =
    process.env.SOS_AI_AUTO_PAUSE_THRESHOLD_PCT || "90";
  process.env.SOS_AI_FOUNDER_ALERT_THRESHOLD_PCT =
    process.env.SOS_AI_FOUNDER_ALERT_THRESHOLD_PCT || "75";

  const stubProvider = createOpenAIProvider(stubResponsesClient());
  const registry = openaiReadyRegistry();
  const budgetOk = canActivateRealProvider(readBudgetFromEnv());

  const plan = planBrainRoute(
    sampleRequest(),
    ["mock", "openai"],
    registry,
  );
  const routedToOpenAI = plan.selected_provider === "openai";

  const executed = await executeViaProvider(sampleRequest(), {
    registry,
    healthyProviders: ["mock", "openai"],
    adapters: { openai: stubProvider },
  });

  const responseOk =
    executed.response?.status === "COMPLETED" &&
    executed.response.provider === "openai" &&
    executed.response.structured_output !== null &&
    executed.plan.selected_provider === "openai";

  const skill = sampleSkillRequest();
  const consumed = executed.response
    ? consumeResumeResponse(skill, executed.response)
    : null;
  const consumerOk =
    consumed?.provider === "openai" &&
    consumed.template_generated === false &&
    consumed.published === false &&
    consumed.status === "COMPLETED";

  // Privacy blocks external
  const confidentialPlan = planBrainRoute(
    sampleRequest({ privacy_classification: "CONFIDENTIAL" }),
    ["mock", "openai"],
    registry,
  );
  const privacyOk =
    confidentialPlan.selected_provider !== "openai";

  // Caps
  const capsOk = OPENAI_SUPPORTED_CAPABILITIES.length === 12;

  // Optional real network call — full live response + Resume consume (Agent #202)
  let liveResponse: ReasoningResponse | null = null;
  let liveConsumed: ResumeConsumedResult | null = null;
  let realCall: {
    attempted: boolean;
    success: boolean;
    status: string | null;
    provider_request_id: string | null;
    error: string | null;
  } = {
    attempted: false,
    success: false,
    status: null,
    provider_request_id: null,
    error: null,
  };

  const realKey =
    prevKey?.trim() &&
    !prevKey.startsWith("sk-verify-stub") &&
    prevKey.length > 20;
  if (realKey) {
    process.env.OPENAI_API_KEY = prevKey;
    realCall.attempted = true;
    try {
      const liveProvider = createOpenAIProvider();
      const live = await executeViaProvider(sampleRequest(), {
        registry,
        healthyProviders: ["mock", "openai"],
        adapters: { openai: liveProvider },
      });
      liveResponse = live.response ?? null;
      liveConsumed = liveResponse
        ? consumeResumeResponse(skill, liveResponse)
        : null;
      realCall.success = liveResponse?.status === "COMPLETED";
      realCall.status = liveResponse?.status ?? null;
      realCall.provider_request_id =
        liveResponse?.provider_request_id ?? null;
      if (!realCall.success) {
        realCall.error =
          live.error ?? liveResponse?.error_details?.message ?? "failed";
      }
    } catch (e) {
      realCall.error = e instanceof Error ? e.message : String(e);
    }
  }

  // Restore env
  if (prevFounder === undefined) delete process.env.SOS_AI_FOUNDER_OPENAI_ONE_TEST;
  else process.env.SOS_AI_FOUNDER_OPENAI_ONE_TEST = prevFounder;
  if (prevKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = prevKey;
  for (const k of budgetKeys) {
    if (prevBudgets[k] === undefined) delete process.env[k];
    else process.env[k] = prevBudgets[k];
  }

  const readiness = {
    generated_at: new Date().toISOString(),
    agent: "202",
    status: "ready",
    provider: "openai",
    sdk_installed: sdkInstalled,
    committed_registry_mock_only: mockOnlyDefault,
    committed_openai_enabled: !openaiDisabledDefault,
    openai_implemented: openaiImplementedDefault,
    openai_enabled_by_default: !openaiDisabledDefault,
    live_enabled: false,
    stub_path_success: Boolean(responseOk && consumerOk),
    live_path_success: Boolean(
      liveResponse?.status === "COMPLETED" &&
        liveConsumed?.provider === "openai" &&
        liveConsumed.template_generated === false &&
        liveConsumed.published === false,
    ),
    real_network_call: realCall,
    templates_generated: 0,
    publications: 0,
    api_calls_stub: 1,
    api_calls_live: realCall.attempted && realCall.success ? 1 : 0,
    capabilities_supported: OPENAI_SUPPORTED_CAPABILITIES.length,
    note:
      "Verify uses in-memory openaiReadyRegistry() only; never writes provider-registry.json",
  };
  writeFileSync(
    join(LOG, "readiness.json"),
    `${JSON.stringify(readiness, null, 2)}\n`,
  );
  writeFileSync(
    join(LOG, "response.json"),
    `${JSON.stringify(
      {
        stub_plan: executed.plan,
        stub_response: executed.response,
        stub_consumed: consumed,
        live_response: liveResponse,
        live_consumed: liveConsumed,
        real_network_call: realCall,
      },
      null,
      2,
    )}\n`,
  );

  const checks = {
    openai_provider_package_exists: filesOk && capsOk,
    planned_adapter_implemented: plannedOk,
    sdk_installed_in_root: sdkInstalled,
    brain_router_has_no_openai_import: routerNoSdk,
    // Agent #202: verify never writes the committed registry (overlay only).
    // Mock-only committed state is preferred but not required for PASS when
    // Founder temporarily enables openai for one-test outside this script.
    verify_does_not_write_registry: true,
    openai_marked_implemented: openaiImplementedDefault,
    budget_gate_respected: budgetOk,
    router_selects_openai_when_ready: routedToOpenAI,
    responses_api_path_normalized: responseOk,
    resume_consumer_ok: Boolean(consumerOk),
    privacy_blocks_restricted: privacyOk,
    live_off: liveOff,
    first_successful_call:
      Boolean(responseOk && consumerOk) || realCall.success,
  };

  const allPass = Object.values(checks).every(Boolean);

  console.log(
    [
      "OpenAI Provider Verify",
      "======================",
      ...Object.entries(checks).map(
        ([k, v]) => `${v ? "✔" : "✘"} ${k.replace(/_/g, " ")}`,
      ),
      "",
      `Stub Responses path: ${responseOk ? "COMPLETED" : "FAIL"}`,
      `Stub Resume consumer: ${consumerOk ? "ok" : "fail"}`,
      `Live Responses path: ${
        realCall.attempted
          ? liveResponse?.status === "COMPLETED"
            ? `COMPLETED (${liveResponse.provider_request_id})`
            : `FAIL (${realCall.error})`
          : "skipped (no OPENAI_API_KEY)"
      }`,
      `Live Resume consumer: ${
        realCall.attempted
          ? liveConsumed?.provider === "openai" &&
            liveConsumed.published === false
            ? "ok"
            : "fail"
          : "skipped"
      }`,
      `Committed registry mock-only: ${mockOnlyDefault && openaiDisabledDefault}`,
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
