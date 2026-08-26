/**
 * Adaptive Resume Composer — public API.
 */
export { ADAPTIVE_COMPOSER, runAdaptiveComposition, allocateCompositionId } from "./AdaptiveComposerDirector.js";
export { COMPONENT_LIBRARY, DEFAULT_SECTION_ORDER } from "./ComponentLibrary.js";
export { loadComposerMemory, appendComposerMemory, COMPOSER_MEMORY_ROOT } from "./ComposerMemory.js";
export { COMPOSER_OUTPUT_ROOT } from "./ComposerReporter.js";
export type {
  AdaptiveComposerOptions,
  AdaptiveComposerResult,
  CompositionPlan,
  CompositionConfidence,
  ComponentCategory,
  ComponentVariant,
  LayoutMode,
  CompositionMode,
} from "./types.js";
