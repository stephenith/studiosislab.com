/**
 * Resume Catalog & Publication Manager — public API.
 */
export { PUBLICATION_MANAGER, runPublicationPrep } from "./PublicationDirector.js";
export { loadCatalog, upsertCatalogEntry, PUBLICATION_ROOT } from "./CatalogManager.js";
export { assignPermanentTemplateId, loadExistingManifestIds } from "./TemplateIdAssigner.js";
export { resolvePublicationState, canTransition, PUBLICATION_STATE_LABELS } from "./PublicationStates.js";
export { appendPublicationMemory, loadPublicationMemory } from "./PublicationMemory.js";
export * from "./types.js";
