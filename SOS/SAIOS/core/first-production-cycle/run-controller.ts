#!/usr/bin/env tsx
/**
 * Canonical Production Controller CLI — Agent #213.
 * Single entry for production. LIVE OFF. No publication.
 *
 * Usage:
 *   npm run aios:controller:run
 *   npm run aios:controller:run -- --size 3 --mock
 *   npm run aios:controller:run -- --target executive:chief-marketing-officer
 *   npm run aios:batch:run -- --size 5 --mock   (delegates here)
 */
import { resolve } from "node:path";
import dotenv from "dotenv";
dotenv.config({
  path: resolve(process.cwd(), ".env.local"),
});
import { runProduction } from "./ProductionController.js";
import {
  controllerHelpText,
  planControllerExecution,
} from "./ControllerCliPlan.js";

async function main(): Promise<void> {
  if (process.env.SOS_AIOS_LIVE === "1") {
    console.error("LIVE must be OFF");
    process.exit(1);
  }
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(controllerHelpText());
    process.exit(0);
  }
  const plan = planControllerExecution(argv);
  if (!plan.ok) {
    console.error(
      JSON.stringify(
        {
          error: "controlled_target_rejected",
          code: plan.code,
          detail: plan.detail,
          generation_started: false,
        },
        null,
        2,
      ),
    );
    process.exit(plan.exit_code);
  }

  if (plan.mode === "controlled" && plan.resolved) {
    console.log(
      JSON.stringify(
        {
          event: "controlled_canonical_target",
          target_selection: plan.target_selection,
          canonical_target_id: plan.resolved.id,
          title: plan.resolved.title,
          role_family: plan.resolved.role_family,
          category: plan.resolved.category,
          design_family_pinned: false,
          architecture_pinned: false,
          batch_size: 1,
          select_target: false,
        },
        null,
        2,
      ),
    );
  }

  const result = await runProduction(plan.production);
  console.log(
    JSON.stringify(
      {
        execution_id: result.execution_id,
        stop_reason: result.stop_reason,
        stop_detail: result.stop_detail,
        health: result.health.status,
        candidate_count: result.candidate_count,
        failure_count: result.failure_count,
        batch_id: result.batch?.batch_id ?? null,
        publication_allowed: result.publication_allowed,
        report_path: result.report_path,
        entrypoint: result.entrypoint,
        target_selection: plan.target_selection,
        controlled_target:
          plan.resolved == null
            ? null
            : {
                id: plan.resolved.id,
                title: plan.resolved.title,
                role_family: plan.resolved.role_family,
                category: plan.resolved.category,
              },
      },
      null,
      2,
    ),
  );
  if (
    result.stop_reason === "fatal_error" ||
    result.stop_reason === "live_refused"
  ) {
    process.exit(1);
  }
  if (result.stop_reason === "health_unhealthy") {
    process.exit(2);
  }
  if (result.stop_reason === "budget_denied") {
    process.exit(3);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
