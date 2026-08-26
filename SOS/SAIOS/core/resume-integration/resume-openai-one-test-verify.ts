/**
 * Resume OpenAI one-test verify — Agent #203.
 * Demo path: ResumeKnowledgeGateway → BrainRouter → OpenAI (or Mock fallback).
 * LIVE OFF. No publication / templates / Scheduler / Queue / Workers.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

import { ResumeKnowledgeGateway } from "./ResumeKnowledgeGateway.js";
import { canUseFounderOpenAIOneTest } from "./FounderOpenAIOneTest.js";
import { assertOnlyMockActive, loadProviderRegistry } from "../ai-brain/ProviderRegistry.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const LOG = join(REPO, "SOS/07_LOGS/saios/resume-openai-one-test");

async function main(): Promise<void> {
  mkdirSync(LOG, { recursive: true });

  const liveOff = process.env.SOS_AIOS_LIVE !== "1";
  const committed = loadProviderRegistry();
  const gatesOpen = canUseFounderOpenAIOneTest("INTERNAL");

  const gateway = new ResumeKnowledgeGateway();
  const result = await gateway.executeWithKnowledge({
    operation: "planning",
    task_id: "resume-openai-one-test-001",
    objective:
      "Create a planning response for an ATS-friendly Marketing Manager template (Founder one-test)",
    input: {
      role_family: "marketing_manager",
      constraints: { ats_friendly: true, columns: 1 },
    },
    dry_run: true,
  });

  const provider = result.primary_response?.provider ?? null;
  const selected = result.selected_provider ?? provider;
  const status = result.primary_response?.status ?? null;
  const consumed = result.consumed;

  const expectedOpenAI = gatesOpen;
  const providerOk = expectedOpenAI
    ? selected === "openai" && provider === "openai" && status === "COMPLETED"
    : selected === "mock" && provider === "mock" && status === "COMPLETED";

  const consumerOk =
    consumed != null &&
    consumed.template_generated === false &&
    consumed.published === false &&
    consumed.provider === (expectedOpenAI ? "openai" : "mock");

  // Fallback probe: without key, gates must force mock (logic check)
  const prevKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  const gatesWithoutKey = canUseFounderOpenAIOneTest("INTERNAL");
  if (prevKey !== undefined) process.env.OPENAI_API_KEY = prevKey;
  else delete process.env.OPENAI_API_KEY;
  const fallbackLogicOk = gatesWithoutKey === false;

  const privacyBlocked = canUseFounderOpenAIOneTest("CONFIDENTIAL") === false;

  const artifact = {
    generated_at: new Date().toISOString(),
    agent: "203",
    demo_path: result.flow,
    gates_open: gatesOpen,
    selected_provider: selected,
    stub_or_live: expectedOpenAI ? "live_openai" : "mock",
    live_response: expectedOpenAI ? result.primary_response : null,
    live_consumed: expectedOpenAI ? consumed : null,
    mock_response: expectedOpenAI ? null : result.primary_response,
    mock_consumed: expectedOpenAI ? null : consumed,
    primary_response: result.primary_response,
    consumed,
    real_network_call: {
      attempted: expectedOpenAI,
      success: expectedOpenAI && status === "COMPLETED",
      status,
      provider_request_id:
        result.primary_response?.provider_request_id ?? null,
      error: null as string | null,
    },
    safety: {
      live_off: liveOff,
      skill_dry_run: result.skill_request.dry_run,
      template_generated: consumed?.template_generated ?? false,
      published: consumed?.published ?? false,
      committed_registry_mock_only: assertOnlyMockActive(committed),
    },
  };

  writeFileSync(
    join(LOG, "response.json"),
    `${JSON.stringify(artifact, null, 2)}\n`,
  );
  writeFileSync(
    join(LOG, "readiness.json"),
    `${JSON.stringify(
      {
        generated_at: artifact.generated_at,
        agent: "203",
        status: "ready",
        gates_open: gatesOpen,
        provider: selected,
        live_enabled: false,
        templates_generated: 0,
        publications: 0,
      },
      null,
      2,
    )}\n`,
  );

  const filesOk = [
    "FounderOpenAIOneTest.ts",
    "ResumeBrainGateway.ts",
    "ResumeKnowledgeGateway.ts",
    "ResumeResponseConsumer.ts",
  ].every((f) => existsSync(join(import.meta.dirname, f)));

  const checks = {
    resume_openai_one_test_files: filesOk,
    live_off: liveOff,
    provider_selection_matches_gates: providerOk,
    resume_consumer_safe: Boolean(consumerOk),
    missing_api_key_forces_mock_gate: fallbackLogicOk,
    confidential_privacy_blocks_openai: privacyBlocked,
    no_publication: consumed?.published === false,
    no_template_generation: consumed?.template_generated === false,
  };

  const allPass = Object.values(checks).every(Boolean);

  console.log(
    [
      "Resume OpenAI One-Test Verify",
      "=============================",
      ...Object.entries(checks).map(
        ([k, v]) => `${v ? "✔" : "✘"} ${k.replace(/_/g, " ")}`,
      ),
      "",
      `Gates open: ${gatesOpen}`,
      `Provider: ${selected}`,
      `Status: ${status}`,
      `Provider request id: ${result.primary_response?.provider_request_id ?? "n/a"}`,
      `Artifact: ${join(LOG, "response.json")}`,
      `LIVE: false`,
      `Overall: ${allPass ? "PASS" : "FAIL"}`,
    ].join("\n"),
  );

  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
