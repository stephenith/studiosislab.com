#!/usr/bin/env node
/**
 * SAIOS Shadow Mode verification
 * Run: npm run shadow:verify (from SOS/SAIOS/runtime)
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { ShadowCoordinator, createLegacyShadowHandler } from "./ShadowCoordinator.js";
import { resolveShadowPaths } from "./paths.js";
import type { TelegramInboundLike } from "../integration/types.js";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

const FOUNDER_COMMANDS = [
  "Build another invoice template.",
  "Create a new receipt template for mobile.",
  "Add a quote template with urgent delivery.",
  "Implement a simple estimate template.",
  "Build a delivery note template.",
  "Create a packing slip template.",
  "Add a purchase order template.",
  "Implement a credit note template.",
  "Build a proforma invoice template.",
  "Create a work order template for contractors.",
  "Build a timesheet template.",
  "Create a service agreement template.",
  "Add a maintenance log template.",
  "Implement a job costing template.",
  "Build a rental agreement template.",
  "Create a sales receipt template.",
  "Add a payment reminder template.",
  "Implement a client onboarding template.",
  "Build a project proposal template.",
  "Create a subcontractor invoice template.",
  "Add a warranty claim template.",
  "Implement a field report template.",
  "Build a safety checklist template.",
  "Create a material request template.",
  "Add a change order template.",
];

async function main(): Promise<void> {
  const ts = String(Date.now());
  const runId = `verify-${ts}`;
  const paths = resolveShadowPaths(runId, join(resolveShadowPaths().shadowRoot, "verify-runs", runId));
  const legacyLogsRoot = join(paths.shadowRoot, "legacy-mirror", "07_LOGS");

  await mkdir(paths.shadowRoot, { recursive: true });
  await mkdir(paths.workspaceDir, { recursive: true });
  await mkdir(legacyLogsRoot, { recursive: true });

  const legacyHandler = await createLegacyShadowHandler(legacyLogsRoot);
  const coordinator = new ShadowCoordinator({
    runId,
    legacyHandler,
    shadowRoot: paths.shadowRoot,
  });

  const chatId = "shadow-verify-founder";

  for (let i = 0; i < FOUNDER_COMMANDS.length; i++) {
    const inbound: TelegramInboundLike = {
      update_id: 5000 + i,
      message_id: 6000 + i,
      chat_id: chatId,
      user_id: 99,
      username: "founder",
      text: FOUNDER_COMMANDS[i]!,
      received_at: new Date().toISOString(),
    };

    const result = await coordinator.processFounderMessage(inbound, i + 1);
    assert(result.legacy.ok, `legacy failed for command ${i + 1}: ${result.legacy.error}`);
    assert(result.saios?.ok, `saios shadow failed for command ${i + 1}`);
    assert(result.comparison.pass, `comparison failed for command ${i + 1}`);
  }

  const { pass, path: reportPath } = await coordinator.finalizeReport();
  assert(pass, "shadow run report should pass");
  assert(existsSync(reportPath), "comparison report file should exist");

  const report = JSON.parse(await readFile(reportPath, "utf8")) as {
    pass: boolean;
    command_count: number;
    legacy_success_count: number;
    saios_success_count: number;
    comparison_pass_count: number;
  };

  assert(report.command_count === 25, `expected 25 commands, got ${report.command_count}`);
  assert(report.legacy_success_count === 25, "legacy should succeed 25 times");
  assert(report.saios_success_count === 25, "saios shadow should succeed 25 times");
  assert(report.comparison_pass_count === 25, "comparisons should pass 25 times");

  await rm(paths.shadowRoot, { recursive: true, force: true });

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "shadow-mode",
        founder_commands: 25,
        legacy_success: report.legacy_success_count,
        saios_shadow_success: report.saios_success_count,
        comparison_pass: report.comparison_pass_count,
        report_path: reportPath,
        checks: {
          legacy_pipeline_succeeds: true,
          saios_shadow_succeeds: true,
          comparison_report_generated: true,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(JSON.stringify({ pass: false, error: String(err) }, null, 2));
  process.exit(1);
});
