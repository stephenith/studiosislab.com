/**
 * DesignBrief Engine — Knowledge→Skills→Brain→Mock → DesignBrief → Resume JSON.
 * Does not call OpenAI, enable LIVE, publish, or render Fabric templates.
 */
import { resolve, join } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { createDesignBrief } from "./DesignBrief.js";
import { DesignBriefRepository } from "./DesignBriefRepository.js";
import type {
  BrainPlanningOutput,
  DesignBriefEngineResult,
} from "./types.js";

export type DesignBriefEngineOptions = {
  repoRoot?: string;
  providerResponsePath?: string;
  task_id?: string | null;
  skill_id?: string | null;
  persist?: boolean;
  fixture?: boolean;
  brain_output?: BrainPlanningOutput;
};

function loadMockPlanning(path: string): {
  output: BrainPlanningOutput;
  task_id: string | null;
  skill_id: string | null;
} {
  const raw = JSON.parse(readFileSync(path, "utf8")) as {
    provider?: string;
    structured_output?: BrainPlanningOutput;
    consumed?: {
      skill_id?: string;
      task_id?: string;
      structured_output?: BrainPlanningOutput;
    };
  };
  const output =
    raw.structured_output ??
    raw.consumed?.structured_output ??
    ({} as BrainPlanningOutput);
  return {
    output,
    task_id: raw.consumed?.task_id ?? null,
    skill_id: raw.consumed?.skill_id ?? null,
  };
}

export class DesignBriefEngine {
  constructor(private readonly repoRoot: string) {}

  run(opts: DesignBriefEngineOptions = {}): DesignBriefEngineResult {
    if (process.env.SOS_AIOS_LIVE === "1") {
      throw new Error("DesignBriefEngine refuses to run while SOS_AIOS_LIVE=1");
    }

    const root = opts.repoRoot ?? this.repoRoot;
    let brain_output = opts.brain_output;
    let task_id = opts.task_id ?? null;
    let skill_id = opts.skill_id ?? null;

    if (!brain_output) {
      const providerPath =
        opts.providerResponsePath ??
        join(root, "SOS/07_LOGS/saios/first-dry-run/provider-response.json");
      if (!existsSync(providerPath)) {
        throw new Error(`Missing Mock provider response: ${providerPath}`);
      }
      const loaded = loadMockPlanning(providerPath);
      brain_output = loaded.output;
      task_id = task_id ?? loaded.task_id;
      skill_id = skill_id ?? loaded.skill_id;
    }

    const brief = createDesignBrief({
      brain_output,
      task_id,
      skill_id,
      fixture: opts.fixture,
    });

    const wrote_artifacts: string[] = [];
    if (opts.persist !== false) {
      const outDir = join(
        root,
        opts.fixture
          ? "SOS/07_LOGS/saios/designbrief/fixtures"
          : "SOS/07_LOGS/saios/designbrief",
      );
      const repo = new DesignBriefRepository(outDir);
      wrote_artifacts.push(...repo.write(brief, { fixture: opts.fixture }));
    }

    return {
      brief,
      wrote_artifacts,
      overall: brief.validation.pass ? "PASS" : "FAIL",
    };
  }
}

export function createDefaultEngine(repoRoot?: string): DesignBriefEngine {
  const root =
    repoRoot ?? resolve(import.meta.dirname, "../../../..");
  return new DesignBriefEngine(root);
}
