/**
 * Brain Router — routing orchestration + ProviderAdapter execution.
 * Agent #117/#118/#201 — no vendor SDK imports.
 */
import { canActivateRealProvider, readBudgetFromEnv } from "./BudgetPolicy.js";
import { isDeterministicOnly } from "./CapabilityRegistry.js";
import {
  assertFallbackRespectsSafety,
  canFallbackToExternal,
  DEFAULT_FALLBACK_POLICY,
} from "./FallbackPolicy.js";
import {
  decideRoute,
  DEFAULT_ROUTING_POLICY,
  type RoutingDecision,
} from "./ModelRoutingPolicy.js";
import type { ProviderAdapter } from "./ProviderAdapter.js";
import {
  assertOnlyMockActive,
  isProviderReady,
  listSelectableProviders,
  loadProviderRegistry,
  type ProviderRegistryState,
} from "./ProviderRegistry.js";
import type { ReasoningRequest } from "./ReasoningRequest.js";
import type { ProviderId } from "./types.js";

export type BrainRoutePlan = {
  decision: RoutingDecision;
  budget_blocks_real_provider: boolean;
  only_mock_active: boolean;
  fallback_safety_ok: boolean;
  dry_run: boolean;
  selected_provider: ProviderId | null;
};

export type ExecuteViaProviderOptions = {
  registry?: ProviderRegistryState;
  healthyProviders?: ProviderId[];
  adapters?: Partial<Record<ProviderId, ProviderAdapter>>;
};

/**
 * Plan a route without executing any provider.
 * Real providers remain blocked until budgets + enablement are set.
 */
export function planBrainRoute(
  request: ReasoningRequest,
  healthyProviders: ProviderId[] = ["mock"],
  registry: ProviderRegistryState = loadProviderRegistry(),
): BrainRoutePlan {
  const onlyMock = assertOnlyMockActive(registry);
  const budget = readBudgetFromEnv();
  const budgetBlocks = !canActivateRealProvider(budget);
  const decision = decideRoute(
    request,
    DEFAULT_ROUTING_POLICY,
    healthyProviders.filter((p) => {
      if (p === "mock") return true;
      if (budgetBlocks) return false;
      if (request.dry_run) return false;
      return isProviderReady(registry, p);
    }),
  );

  let selected: ProviderId | null = null;
  if (decision.allowed && decision.preferred_providers.length > 0) {
    selected = decision.preferred_providers[0] ?? null;
    // Force mock while only mock is active / dry_run / budgets unset
    if (onlyMock || request.dry_run || budgetBlocks) {
      if (decision.preferred_providers.includes("mock")) selected = "mock";
      else if (isDeterministicOnly(request.capability)) selected = null;
      else selected = "mock";
    }
  }

  if (
    selected &&
    selected !== "mock" &&
    selected !== "local" &&
    !canFallbackToExternal(request.privacy_classification)
  ) {
    selected = decision.preferred_providers.includes("mock") ? "mock" : null;
  }

  // Real provider must still be ready in registry
  if (selected && selected !== "mock" && !isProviderReady(registry, selected)) {
    selected = decision.preferred_providers.includes("mock") ? "mock" : null;
  }

  return {
    decision,
    budget_blocks_real_provider: budgetBlocks,
    only_mock_active: onlyMock,
    fallback_safety_ok: assertFallbackRespectsSafety(DEFAULT_FALLBACK_POLICY),
    dry_run: request.dry_run,
    selected_provider: selected,
  };
}

export class BrainRouter {
  plan(request: ReasoningRequest): BrainRoutePlan {
    return planBrainRoute(request);
  }
}

export type BrainExecuteResult = {
  plan: BrainRoutePlan;
  response: import("./ReasoningResponse.js").ReasoningResponse | null;
  error?: string;
};

async function resolveAdapter(
  id: ProviderId,
  adapters?: Partial<Record<ProviderId, ProviderAdapter>>,
): Promise<ProviderAdapter> {
  const injected = adapters?.[id];
  if (injected) return injected;

  if (id === "mock") {
    const { createMockProvider } = await import(
      "../providers/mock/MockProvider.js"
    );
    return createMockProvider();
  }
  if (id === "openai") {
    const { createOpenAIProvider } = await import(
      "../providers/openai/OpenAIProvider.js"
    );
    return createOpenAIProvider();
  }
  throw new Error(`No ProviderAdapter implementation for ${id}`);
}

/**
 * Configuration-driven execution via the selected ProviderAdapter.
 * Does not import vendor SDKs — adapters own those.
 */
export async function executeViaProvider(
  request: ReasoningRequest,
  options: ExecuteViaProviderOptions = {},
): Promise<BrainExecuteResult> {
  const registry = options.registry ?? loadProviderRegistry();
  const healthy =
    options.healthyProviders ?? listSelectableProviders(registry);
  const plan = planBrainRoute(request, healthy, registry);

  if (!plan.decision.allowed) {
    return {
      plan,
      response: null,
      error: plan.decision.reason,
    };
  }
  if (!plan.selected_provider) {
    return {
      plan,
      response: null,
      error: "No provider selected",
    };
  }

  const adapter = await resolveAdapter(
    plan.selected_provider,
    options.adapters,
  );
  if (adapter.provider_id !== plan.selected_provider) {
    return {
      plan,
      response: null,
      error: `Adapter mismatch: expected ${plan.selected_provider}, got ${adapter.provider_id}`,
    };
  }

  const execRequest =
    plan.selected_provider === "mock"
      ? { ...request, dry_run: true }
      : { ...request, dry_run: false };

  const response = await adapter.execute(execRequest);
  return { plan, response };
}

/**
 * End-to-end dry-run execution via Mock Provider (Agent #118).
 * Backward-compatible wrapper around executeViaProvider.
 */
export async function executeViaMockProvider(
  request: ReasoningRequest,
  mock: import("../providers/mock/MockProvider.js").MockProvider,
): Promise<BrainExecuteResult> {
  return executeViaProvider(
    { ...request, dry_run: true },
    {
      healthyProviders: ["mock"],
      adapters: { mock },
    },
  );
}
