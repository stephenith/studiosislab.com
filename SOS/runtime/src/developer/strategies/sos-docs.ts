import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { RuntimeConfig } from "../../config.js";
import type { ParsedBrief, WorkPlan } from "../types.js";
import type { StrategyOutput } from "./types.js";
import { getDeveloperPaths } from "../paths.js";

export async function executeSosDocsStrategy(
  config: RuntimeConfig,
  brief: ParsedBrief,
  workPlan: WorkPlan,
): Promise<StrategyOutput> {
  const paths = getDeveloperPaths(config);
  const artifactDir = join(paths.artifacts, brief.task_id);
  await mkdir(artifactDir, { recursive: true });

  const notePath = join(artifactDir, "implementation-notes.md");
  const rel = notePath.replace(config.repoRoot + "/", "");
  const notes = `# Implementation Notes

**Task:** ${brief.task_id}
**Objective:** ${workPlan.objective}

## Steps

${workPlan.acceptance_criteria.map((s, i) => `${i + 1}. ${s}`).join("\n")}
`;
  await writeFile(notePath, notes, "utf8");

  return {
    files_changed: [rel],
    diff_summary: "SOS documentation artifact written",
    implementation_summary: `SOS-scoped work documented for: ${brief.title}`,
  };
}
