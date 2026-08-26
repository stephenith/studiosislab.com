/**
 * Validates Resume ↔ Brain integration invariants.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { SkillRequest } from "../skills/Skill.js";
import { listResumeSkillMappings } from "./ResumeSkillMapper.js";

const FORBIDDEN_PATTERNS = [
  /\bopenai\b/i,
  /\bprompt\b/i,
  /\bgpt-4\b/i,
  /\bgpt-5\b/i,
  /\bmodel_name\b/i,
  /\bsk-[a-zA-Z0-9]/,
];

export function assertNoRawPromptInSkillRequest(
  request: SkillRequest,
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if ("prompt" in request.input) errors.push("raw prompt in input");
  if ("model" in request.input || "model_name" in request.input) {
    errors.push("model field in input");
  }
  const blob = JSON.stringify(request);
  for (const re of FORBIDDEN_PATTERNS) {
    if (re.test(blob) && re.source.includes("prompt")) {
      // allow skill names that don't contain prompt; check input only for prompt
    }
  }
  if (/\bprompt\b/i.test(JSON.stringify(request.input))) {
    errors.push("prompt token in skill input");
  }
  if (/\bopenai\b/i.test(blob)) errors.push("openai reference in skill request");
  if (/\bgpt-/i.test(blob)) errors.push("model name in skill request");
  return { ok: errors.length === 0, errors };
}

export function assertResumeIntegrationSourcesClean(): {
  ok: boolean;
  errors: string[];
} {
  const dir = resolve(import.meta.dirname);
  const files = [
    "ResumeSkillRequest.ts",
    "ResumeSkillMapper.ts",
    "ResumeBrainGateway.ts",
    "ResumeResponseConsumer.ts",
    "ResumeIntegrationValidator.ts",
    "ResumeKnowledgeAttach.ts",
    "ResumeKnowledgeGateway.ts",
    "ResumeFactoryEntryBridge.ts",
    "ResumeFactoryEntryRegistry.ts",
    "FounderOpenAIOneTest.ts",
  ];
  const errors: string[] = [];
  for (const f of files) {
    const p = join(dir, f);
    if (!existsSync(p)) {
      errors.push(`missing ${f}`);
      continue;
    }
    const text = readFileSync(p, "utf8");
    if (/\bfrom ["']openai["']/.test(text)) errors.push(`${f} imports openai`);
    if (/\bgpt-4\b|\bgpt-5\b/i.test(text)) errors.push(`${f} hardcodes model`);
  }

  const mappings = listResumeSkillMappings();
  const skillOps = mappings.filter((m) => m.kind === "skill");
  if (skillOps.length < 5) errors.push("expected skill mappings for resume ops");
  const det = mappings.filter((m) => m.kind === "deterministic");
  if (det.length < 2) errors.push("qa and publication_gate must be deterministic");

  return { ok: errors.length === 0, errors };
}
