/**
 * Provider registry — configuration-backed enablement.
 * Default: Mock enabled (dry_run); all others disabled.
 * Agent #201 — supports implemented / credentials_configured for OpenAI.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ProviderId } from "./types.js";

export type ProviderRecord = {
  id: ProviderId;
  enabled: boolean;
  mode: "dry_run" | "live" | "disabled";
  credentials_configured: boolean;
  implemented?: boolean;
  endpoint_configured?: boolean;
  notes?: string;
};

export type ProviderRegistryState = {
  version: string;
  active_provider_allowed: ProviderId[];
  providers: ProviderRecord[];
};

const DEFAULT_REGISTRY: ProviderRegistryState = {
  version: "1.0.0",
  active_provider_allowed: ["mock"],
  providers: [
    {
      id: "mock",
      enabled: true,
      mode: "dry_run",
      credentials_configured: false,
      implemented: true,
      notes: "Only active provider for Agent #117/#118 dry-run",
    },
    {
      id: "openai",
      enabled: false,
      mode: "disabled",
      credentials_configured: false,
      implemented: true,
      notes: "OpenAI adapter implemented Agent #201 — disabled until Founder enables",
    },
    {
      id: "local",
      enabled: false,
      mode: "disabled",
      credentials_configured: false,
      endpoint_configured: false,
      notes: "Future local machine — disabled",
    },
    {
      id: "future_provider",
      enabled: false,
      mode: "disabled",
      credentials_configured: false,
      notes: "Reserved",
    },
  ],
};

export function defaultProviderRegistry(): ProviderRegistryState {
  return structuredClone(DEFAULT_REGISTRY);
}

export function loadProviderRegistry(
  configPath?: string,
): ProviderRegistryState {
  const path =
    configPath ??
    resolve(
      import.meta.dirname,
      "../../config/provider-registry.json",
    );
  if (!existsSync(path)) return defaultProviderRegistry();
  return JSON.parse(readFileSync(path, "utf8")) as ProviderRegistryState;
}

export function isProviderEnabled(
  registry: ProviderRegistryState,
  id: ProviderId,
): boolean {
  const rec = registry.providers.find((p) => p.id === id);
  return Boolean(rec?.enabled);
}

export function getProviderRecord(
  registry: ProviderRegistryState,
  id: ProviderId,
): ProviderRecord | undefined {
  return registry.providers.find((p) => p.id === id);
}

/**
 * Provider is selectable for real execution when enabled, implemented,
 * and credentials are marked configured in registry.
 */
export function isProviderReady(
  registry: ProviderRegistryState,
  id: ProviderId,
): boolean {
  const rec = getProviderRecord(registry, id);
  if (!rec) return false;
  if (id === "mock") return rec.enabled;
  return Boolean(
    rec.enabled &&
      rec.implemented === true &&
      rec.credentials_configured === true,
  );
}

/** Providers that may appear in the healthy set for routing. */
export function listSelectableProviders(
  registry: ProviderRegistryState,
): ProviderId[] {
  const out: ProviderId[] = [];
  for (const p of registry.providers) {
    if (p.id === "mock" && p.enabled) out.push("mock");
    else if (isProviderReady(registry, p.id)) out.push(p.id);
  }
  if (!out.includes("mock")) {
    // Mock remains available as dry-run safety fallback when listed in active set
    const mock = getProviderRecord(registry, "mock");
    if (mock?.enabled !== false) out.push("mock");
  }
  return out;
}

export function assertOnlyMockActive(registry: ProviderRegistryState): boolean {
  const enabled = registry.providers.filter((p) => p.enabled).map((p) => p.id);
  return enabled.length === 1 && enabled[0] === "mock";
}

export function resolveConfigDir(): string {
  return join(resolve(import.meta.dirname, "../../config"));
}
