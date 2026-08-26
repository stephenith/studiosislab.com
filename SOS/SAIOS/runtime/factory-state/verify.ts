#!/usr/bin/env tsx
/**
 * Factory State Manager verification.
 * AGENT #095
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  FACTORY_STATE_MANAGER,
  buildFactoryState,
  persistFactoryState,
  REPORT_PATH,
  STATE_PATH,
  STATUS_PATH,
} from "./FactoryStateManager.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function main(): void {
  assert(FACTORY_STATE_MANAGER.module === "factory-state-manager", "module id");
  assert(FACTORY_STATE_MANAGER.agent === "095", "agent number");

  const state = buildFactoryState();
  const persisted = persistFactoryState(state);

  assert(existsSync(STATE_PATH), "project-state.json exists");
  assert(existsSync(STATUS_PATH), "PROJECT_STATUS.md exists");
  assert(existsSync(REPORT_PATH), "factory-state-report.md exists");

  const saved = JSON.parse(readFileSync(STATE_PATH, "utf8")) as typeof state;
  assert(saved.latest_agent.length === 3, "latest agent format");
  assert(saved.next_agent.length === 3, "next agent format");
  assert(Number(saved.next_agent) === Number(saved.latest_agent) + 1, "next agent continuity");
  assert(saved.latest_founder_review.startsWith("FR#"), "founder review format");
  assert(saved.discovery.agents.records.length > 0, "agents discovered");
  assert(saved.discovery.founder_reviews.length >= 4, "founder reviews discovered");
  assert(saved.discovery.releases.length > 0, "releases discovered");
  assert(saved.discovery.published_templates.includes("t094"), "t094 published");
  assert(saved.latest_release.includes("release-t094"), "latest release discovered");
  assert(saved.latest_catalog === "t094", "latest catalog discovered");
  assert(saved.latest_generation.length > 0, "latest generation discovered");
  assert(saved.history.length > 0, "history populated");
  assert(saved.pending_actions.length > 0, "pending actions populated");

  const manifest = JSON.parse(
    readFileSync(join(REPO_ROOT, "templates.manifest.json"), "utf8"),
  ) as { templates: Array<{ id: string; status: string }> };
  const t094 = manifest.templates.find((t) => t.id === "t094");
  assert(t094?.status === "published", "manifest publication consistency");

  const checks = {
    numbering_continuity: Number(saved.next_agent) === Number(saved.latest_agent) + 1,
    report_consistency: existsSync(REPORT_PATH) && existsSync(STATUS_PATH),
    founder_review_consistency: saved.discovery.founder_reviews.some((fr) => fr.number === 4),
    publication_consistency: saved.discovery.published_templates.includes("t094"),
    release_consistency: saved.discovery.releases.some((r) => r.status === "released"),
    catalog_consistency: saved.latest_catalog === "t094",
    project_state_consistency: saved.latest_agent === "095",
  };

  assert(Object.values(checks).every(Boolean), "all verification checks");

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "factory-state-manager",
        agent: "095",
        state_path: persisted.state_path,
        status_path: persisted.status_path,
        report_path: persisted.report_path,
        latest_agent: saved.latest_agent,
        next_agent: saved.next_agent,
        latest_founder_review: saved.latest_founder_review,
        next_founder_review: saved.next_founder_review,
        latest_release: saved.latest_release,
        latest_catalog: saved.latest_catalog,
        checks,
        overall: "PASS",
      },
      null,
      2,
    ),
  );
}

main();
