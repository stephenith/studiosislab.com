/**
 * Mock capabilities — all registered Brain capabilities supported in dry-run.
 * Agent #118 — no SDK, no API.
 */
import {
  DETERMINISTIC_CAPABILITIES,
  ECONOMICAL_CAPABILITIES,
  STRONG_CAPABILITIES,
  listAllCapabilities,
} from "../../ai-brain/CapabilityRegistry.js";
import type { BrainCapability } from "../../ai-brain/types.js";

export const MOCK_SUPPORTED_CAPABILITIES: readonly BrainCapability[] =
  listAllCapabilities();

export function isMockSupported(capability: BrainCapability): boolean {
  return (MOCK_SUPPORTED_CAPABILITIES as readonly string[]).includes(capability);
}

export function mockCapabilityGroups() {
  return {
    strong: [...STRONG_CAPABILITIES],
    economical: [...ECONOMICAL_CAPABILITIES],
    deterministic: [...DETERMINISTIC_CAPABILITIES],
  };
}
