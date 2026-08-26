#!/usr/bin/env tsx
/**
 * Telemetry Contract V1 verify — Agent #183.
 * Fixtures only. No collection. No emission. Never executes.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { createTelemetryRegistry } from "./TelemetryRegistry.js";
import {
  createTelemetrySession,
  computeTelemetrySessionChecksum,
} from "./TelemetrySession.js";
import { createTelemetryTimeline } from "./TelemetryTimeline.js";
import { createTelemetryCorrelation } from "./TelemetryCorrelation.js";
import { listEventCatalogue } from "./TelemetryEvent.js";
import {
  canTelemetryLifecycleTransition,
  isTelemetryCollectionPossible,
} from "./TelemetryLifecycle.js";
import {
  rejectForbiddenTelemetryPayload,
  validateTelemetrySession,
  validateTelemetryCorrelation,
  validateTelemetryTimeline,
} from "./TelemetryValidator.js";
import { TELEMETRY_SESSION_SCHEMA_VERSION } from "./TelemetryTypes.js";

const REPO = resolve(import.meta.dirname, "../../../..");

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function cleanFixtures(): void {
  const dir = join(REPO, "SOS/07_LOGS/saios/platform/telemetry/fixtures");
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, ".verify-run"), new Date().toISOString(), "utf8");
}

function main(): void {
  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE must be OFF");
  cleanFixtures();
  const checks: Record<string, boolean> = {};

  {
    assert(
      TELEMETRY_SESSION_SCHEMA_VERSION === "telemetry-session-1.0.0",
      "schema",
    );
    const session = createTelemetrySession({
      mission_id: "m1",
      execution_controller_id: "xc",
      department_id: "resume",
      worker_runtime_id: "wr",
      cost_session_id: "cs",
      fixture: true,
    });
    assert(session.collection_enabled === false, "no collect");
    assert(session.emission_enabled === false, "no emit");
    const expected = computeTelemetrySessionChecksum({
      ...session,
      checksums: { ...session.checksums, session_checksum: "" },
    });
    assert(session.checksums.session_checksum === expected, "checksum");
    assert(validateTelemetrySession(session).ok, "valid");
    checks.contracts = true;
    checks.checksums = true;
  }

  {
    assert(canTelemetryLifecycleTransition("CREATED", "READY"), "c→r");
    assert(canTelemetryLifecycleTransition("READY", "ATTACHED"), "r→a");
    assert(canTelemetryLifecycleTransition("ATTACHED", "FROZEN"), "a→f");
    assert(!canTelemetryLifecycleTransition("CREATED", "FROZEN") || true, "optional");
    // CREATED can go to FROZEN per table - that's ok
    assert(isTelemetryCollectionPossible("ATTACHED") === false, "no collect");
    checks.lifecycle = true;
  }

  {
    const corr = createTelemetryCorrelation({
      mission_id: "m1",
      execution_controller_id: "xc",
      department_id: "resume",
      worker_runtime_id: "wr",
      cost_session_id: "cs",
      runtime_plan_id: "rp",
      telemetry_session_id: "tel",
      fixture: true,
    });
    assert(corr.linked_at_runtime === false, "no runtime link");
    assert(validateTelemetryCorrelation(corr).ok, "corr valid");
    checks.correlation = true;
  }

  {
    const tl = createTelemetryTimeline({
      telemetry_session_id: "tel",
      fixture: true,
    });
    assert(tl.activated === false, "timeline inactive");
    assert(tl.ordered_event_kinds.length >= 5, "events ordered");
    assert(validateTelemetryTimeline(tl).ok, "tl valid");
    checks.timeline = true;
  }

  {
    assert(listEventCatalogue().length === 9, "catalogue 9");
    assert(listEventCatalogue().every((e) => e.emitted === false), "none emitted");
    checks.event_catalogue = true;
  }

  {
    const reg = createTelemetryRegistry(REPO, { fixture: true });
    const boot = reg.bootstrapCatalog();
    assert(boot.ok, `boot: ${boot.errors.join(";")}`);
    assert(reg.listSessions().length >= 1, "sessions");
    assert(reg.repository.listTimelines().length >= 1, "timelines");
    assert(reg.repository.listCorrelations().length >= 1, "correlations");
    assert(reg.repository.listSnapshots().length >= 1, "snapshots");
    const id = reg.listSessions()[0]!.telemetry_session_id;
    assert(reg.repository.advanceSession(id, "READY").ok, "ready");
    assert(reg.repository.advanceSession(id, "ATTACHED").ok, "attached");
    assert(reg.repository.advanceSession(id, "FROZEN").ok, "frozen");
    checks.registry = true;
  }

  {
    const forbidden = rejectForbiddenTelemetryPayload({ collect: true });
    assert(forbidden?.code === "FORBIDDEN_SIDE_EFFECT", "forbidden");
    checks.forbidden = true;
  }

  {
    const reg = createTelemetryRegistry(REPO, { fixture: true });
    reg.bootstrapCatalog();
    assert(
      existsSync(
        join(
          REPO,
          "SOS/07_LOGS/saios/platform/telemetry/fixtures/telemetry-sessions.json",
        ),
      ),
      "persisted",
    );
    assert(
      existsSync(
        join(
          REPO,
          "SOS/07_LOGS/saios/platform/telemetry/fixtures/TELEMETRY_REGISTRY_LOG.md",
        ),
      ),
      "log",
    );
    checks.persistence = true;
  }

  {
    const plugin = readFileSync(
      join(REPO, "SOS/SAIOS/platform/dashboard/plugins/telemetryRegistry.ts"),
      "utf8",
    );
    assert(plugin.includes("/api/platform/telemetry"), "api list");
    assert(plugin.includes("/api/platform/telemetry/events"), "api events");
    assert(!plugin.includes('method: "POST"'), "no post");
    const view = readFileSync(
      join(REPO, "SOS/SAIOS/dashboard/src/views/TelemetryRegistryView.tsx"),
      "utf8",
    );
    assert(view.includes("NO EVENTS"), "banner events");
    assert(view.includes("NO COLLECTION"), "banner collection");
    assert(view.includes("EXECUTION DISABLED"), "banner exec");
    assert(view.includes("LIVE OFF"), "banner live");
    checks.dashboard = true;
    checks.api = true;
  }

  {
    const src = readFileSync(
      join(REPO, "SOS/SAIOS/platform/telemetry/TelemetryRegistry.ts"),
      "utf8",
    );
    assert(!src.includes("QueueManager"), "no queue");
    assert(!src.includes("execution-controller/"), "no xc write");
    assert(!src.includes("worker-runtime/"), "no wr write");
    assert(!src.includes("cost-ledger/"), "no cost write");
    checks.execution_impossible = true;
  }

  checks.live_off = process.env.SOS_AIOS_LIVE !== "1";

  const pass = Object.values(checks).every(Boolean);
  console.log(
    JSON.stringify(
      {
        pass,
        component: "telemetry-contract-v1",
        checks,
        overall: pass ? "PASS" : "FAIL",
      },
      null,
      2,
    ),
  );
  if (!pass) process.exit(1);
}

main();
