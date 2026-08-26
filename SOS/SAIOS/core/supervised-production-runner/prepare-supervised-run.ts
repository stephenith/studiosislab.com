#!/usr/bin/env tsx
/**
 * Prepare first supervised run (PENDING_APPROVAL). Does not start production.
 */
import { resolve } from "node:path";
import dotenv from "dotenv";
dotenv.config({ path: resolve(process.cwd(), ".env.local") });
import { prepareSupervisedRun } from "./FounderSupervisedProductionRunner.js";

const simulation = !process.argv.includes("--real");
const report = prepareSupervisedRun({ simulation_mode: simulation });
console.log(
  JSON.stringify(
    {
      run_id: report.run_id,
      batch_status: report.batch_status,
      preflight_ok: report.preflight_ok,
      preflight_blocker: report.preflight_blocker,
      selected_roles: report.selected_roles.map((r) => r.title),
      estimated_maximum_cost_usd: report.estimated_maximum_cost_usd,
      live: report.live,
      publication_allowed: report.publication_allowed,
      report_path: report.report_path,
    },
    null,
    2,
  ),
);
