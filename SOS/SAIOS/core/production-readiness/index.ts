/**
 * Canonical Production Readiness Audit — Agent #228.
 * Audit only. Never owns production, orchestration, business logic, or governance.
 */
export {
  PRODUCTION_READINESS_VERSION,
  buildProductionReadinessAudit,
  loadProductionReadinessSurface,
  type AuditSourceRef,
  type BlockerSeverity,
  type LaunchRecommendation,
  type ProductionReadinessReport,
  type ProductionReadinessSurface,
  type ReadinessBlocker,
  type ReadinessScores,
} from "./ProductionReadinessAudit.js";
