/**
 * Canonical Production Bootstrap — Agent #229.
 * Preparation only. Never executes production.
 */
export {
  PRODUCTION_BOOTSTRAP_VERSION,
  runProductionBootstrap,
  loadProductionBootstrapSurface,
  type BootstrapCheck,
  type BootstrapCheckStatus,
  type BootstrapReadiness,
  type ProductionBootstrapReport,
  type ProductionBootstrapSurface,
} from "./ProductionBootstrap.js";
