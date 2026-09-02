/**
 * Founder Preference Memory V1 — public exports.
 */
export {
  FOUNDER_PREFERENCE_MEMORY_SCHEMA,
  type FounderPreferenceMemoryRecord,
  type GenerationTargetContext,
  type MemoryScope,
  type MemoryStatus,
  type SignalType,
} from "./FounderPreferenceMemoryTypes.js";
export {
  FounderPreferenceMemoryStore,
  founderMemoryDir,
  ensureFounderMemoryDirs,
  identityKey,
  contentHash,
} from "./FounderPreferenceMemoryStore.js";
export {
  classifyIssueType,
  normalizeRuleText,
  isMeaningfulFeedback,
  isGenericRejection,
} from "./FounderPreferenceNormalizer.js";
export {
  FounderPreferenceWriter,
  writeFounderPreferenceMemorySafe,
  enrichFromCandidateArtifacts,
  chooseScope,
} from "./FounderPreferenceWriter.js";
export {
  FounderPreferenceRetriever,
  retrieveFounderPreferencesSafe,
} from "./FounderPreferenceRetriever.js";
export {
  selectFounderMemory,
  classifyMemoryEligibility,
  conflictsWithCurrentFounderRequest,
  isLayoutDesignConstraintText,
  FOUNDER_MEMORY_SELECTION_SCHEMA,
  MAX_SELECTED_RULES,
  MAX_MEMORY_PROMPT_CHARS,
  type FounderMemorySelectionResult,
  type MemoryEligibilityKind,
} from "./FounderMemoryConsumption.js";
export {
  renderFounderDesignMemoryBlock,
  appendFounderMemoryToInstructions,
  appendFounderMemorySelectionToInstructions,
  applyFounderDesignMemoryInstructions,
  deriveGenerationTargetContext,
  isDesignPlanningSkill,
  FOUNDER_DESIGN_MEMORY_HEADER,
  MAX_PROMPT_CHARS,
} from "./FounderPreferencePrompt.js";
export { FounderMemoryDatasetExporter } from "./FounderMemoryDatasetExporter.js";
