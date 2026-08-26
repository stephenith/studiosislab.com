import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import type { RuntimeConfig } from "../../config.js";
import type { ParsedBrief } from "../types.js";
import { assertPathEditable } from "../safety.js";
import type { StrategyOutput } from "./types.js";

export async function executeMobileHubStrategy(
  config: RuntimeConfig,
  brief: ParsedBrief,
): Promise<StrategyOutput> {
  const hubPath = "src/app/resume/ResumeHubClient.tsx";
  const check = assertPathEditable(hubPath, brief.evidence);
  if (!check.allowed) throw new Error(check.reason);

  const full = join(config.repoRoot, hubPath);
  if (!existsSync(full)) throw new Error("ResumeHubClient.tsx not found");

  let content = await readFile(full, "utf8");
  if (content.includes("editor/mobile/template")) {
    return {
      files_changed: [],
      diff_summary: "Mobile hub routing already present",
      implementation_summary: "Verified mobile routing exists in Resume Hub",
    };
  }

  const oldSnippet = "router.push(`/editor/template/${template.id}`)";
  const newSnippet = `router.push(
                        typeof window !== "undefined" && window.innerWidth <= 767
                          ? \`/editor/mobile/template/\${template.id}\`
                          : \`/editor/template/\${template.id}\`
                      )`;

  if (!content.includes(oldSnippet)) {
    throw new Error("Expected routing pattern not found in ResumeHubClient.tsx");
  }

  content = content.replace(oldSnippet, newSnippet);
  await writeFile(full, content, "utf8");

  return {
    files_changed: [hubPath],
    diff_summary: "Added viewport-aware mobile routing in ResumeHubClient.tsx",
    implementation_summary: "Resume Hub now routes phone viewports to /editor/mobile/template/{id}",
  };
}
