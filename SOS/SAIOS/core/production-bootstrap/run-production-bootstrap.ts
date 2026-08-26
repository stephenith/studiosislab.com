/**
 * Run Production Bootstrap — Agent #229.
 */
import { runProductionBootstrap } from "./ProductionBootstrap.js";

function main(): void {
  process.env.SOS_AIOS_LIVE = "0";
  const report = runProductionBootstrap();
  console.log(JSON.stringify(report, null, 2));
  if (report.readiness === "NOT_READY") process.exit(1);
}

main();
