/**
 * Canonical End-to-End Production Validation — Agent #227.
 * Validation only. Never owns production or orchestration.
 */
export {
  PRODUCTION_VALIDATION_VERSION,
  runEndToEndProductionValidation,
  loadProductionValidationSurface,
  type CheckStatus,
  type ProductionValidationReport,
  type ProductionValidationSurface,
  type ValidationCheck,
} from "./EndToEndProductionValidation.js";
