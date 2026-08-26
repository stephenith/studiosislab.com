/**
 * Run End-to-End Production Validation — Agent #227.
 */
import { runEndToEndProductionValidation } from "./EndToEndProductionValidation.js";

async function main(): Promise<void> {
  process.env.SOS_AIOS_LIVE = "0";
  const report = await runEndToEndProductionValidation();
  console.log(JSON.stringify(report, null, 2));
  if (report.overall_status === "FAIL") process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
