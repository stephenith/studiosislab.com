/**
 * Run Production Readiness Audit — Agent #228.
 */
import { buildProductionReadinessAudit } from "./ProductionReadinessAudit.js";

function main(): void {
  process.env.SOS_AIOS_LIVE = "0";
  const report = buildProductionReadinessAudit();
  console.log(JSON.stringify(report, null, 2));
  if (report.launch_recommendation === "NOT_READY") process.exit(1);
}

main();
