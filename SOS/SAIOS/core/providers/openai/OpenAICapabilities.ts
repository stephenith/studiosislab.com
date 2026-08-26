/**
 * OpenAI provider capabilities — non-deterministic Brain capabilities only.
 * Agent #201 — SDK stays in this package.
 */
import {
  ECONOMICAL_CAPABILITIES,
  STRONG_CAPABILITIES,
} from "../../ai-brain/CapabilityRegistry.js";
import type { BrainCapability } from "../../ai-brain/types.js";

/** Deterministic capabilities are never sent to OpenAI (routing policy). */
export const OPENAI_SUPPORTED_CAPABILITIES: readonly BrainCapability[] = [
  ...STRONG_CAPABILITIES,
  ...ECONOMICAL_CAPABILITIES,
];

export function isOpenAISupported(capability: BrainCapability): boolean {
  return (OPENAI_SUPPORTED_CAPABILITIES as readonly string[]).includes(
    capability,
  );
}
