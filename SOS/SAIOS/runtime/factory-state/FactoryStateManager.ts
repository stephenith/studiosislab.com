/**
 * Factory State Manager — build and persist project state.
 * AGENT #095 — Factory State Manager & Project Memory
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { discoverFactoryState } from "./FactoryStateDiscoverer.js";
import { renderFactoryStateReport, renderProjectStatus } from "./FactoryStateReporter.js";
import type { FactoryProjectState } from "./types.js";

export const FACTORY_STATE_MANAGER = {
  module: "factory-state-manager",
  version: "1.0.0",
  agent: "095",
  role: "orchestration_only",
  prohibitions: [
    "no_resume_generation",
    "no_design_intelligence_mutation",
    "no_publication_execution",
    "no_auto_publish",
  ],
} as const;

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
const SOS_ROOT = join(REPO_ROOT, "SOS");
const STATE_PATH = join(SOS_ROOT, "project-state.json");
const STATUS_PATH = join(SOS_ROOT, "PROJECT_STATUS.md");
const REPORT_PATH = join(SOS_ROOT, "09_REPORTS/factory-state-report.md");

export function buildFactoryState(): FactoryProjectState {
  return discoverFactoryState();
}

export function persistFactoryState(state: FactoryProjectState = buildFactoryState()): {
  state_path: string;
  status_path: string;
  report_path: string;
  state: FactoryProjectState;
} {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
  writeFileSync(STATUS_PATH, renderProjectStatus(state));
  writeFileSync(REPORT_PATH, renderFactoryStateReport(state));
  return {
    state_path: STATE_PATH,
    status_path: STATUS_PATH,
    report_path: REPORT_PATH,
    state,
  };
}

export function loadFactoryStatePath(): string {
  return STATE_PATH;
}

export { STATE_PATH, STATUS_PATH, REPORT_PATH };
