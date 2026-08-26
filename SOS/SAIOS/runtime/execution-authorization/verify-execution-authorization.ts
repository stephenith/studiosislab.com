#!/usr/bin/env tsx
/**
 * Execution Authorization V1 verify — Agent #186.
 * Founder intent only. Never enables execution. LIVE OFF.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import {
  createExecutionAuthorization,
  createExecutionAuthorizationRecord,
} from "./ExecutionAuthorization.js";
import { createExecutionAuthorizationCertificate } from "./ExecutionAuthorizationCertificate.js";
import {
  canExecutionAuthorizationTransition,
  isAuthorizationExecutionPossible,
} from "./ExecutionAuthorizationStateMachine.js";
import {
  computeAuthorizationChecksum,
  rejectForbiddenAuthorizationPayload,
  validateExecutionAuthorization,
  validateExecutionAuthorizationCertificate,
} from "./ExecutionAuthorizationValidator.js";
import {
  assertAuthorizationDoesNotEnableExecution,
  EXECUTION_AUTHORIZATION_POLICY,
} from "./ExecutionAuthorizationPolicy.js";
import {
  EXECUTION_AUTHORIZATION_SCHEMA_VERSION,
  EXECUTION_AUTHORIZATION_SAFETY_FLAGS,
} from "./ExecutionAuthorizationTypes.js";

const REPO = resolve(import.meta.dirname, "../../../..");

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function cleanFixtures(): void {
  const dir = join(
    REPO,
    "SOS/07_LOGS/saios/runtime/execution-authorization/fixtures",
  );
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
      EXECUTION_AUTHORIZATION_SCHEMA_VERSION ===
        "execution-authorization-1.0.0",
      "schema",
    );
    assert(
      EXECUTION_AUTHORIZATION_SAFETY_FLAGS.execution_allowed === false,
      "no exec",
    );
    assert(
      EXECUTION_AUTHORIZATION_SAFETY_FLAGS.authorization_enables_execution ===
        false,
      "never enables",
    );
    assert(
      EXECUTION_AUTHORIZATION_SAFETY_FLAGS.overrides_activation_gate === false,
      "no override",
    );
    assertAuthorizationDoesNotEnableExecution();
    assert(EXECUTION_AUTHORIZATION_POLICY.enables_execution === false);
    checks.contracts = true;
  }

  {
    assert(
      canExecutionAuthorizationTransition("CREATED", "WAITING_FOUNDER"),
      "c→w",
    );
    assert(
      canExecutionAuthorizationTransition("WAITING_FOUNDER", "AUTHORIZED"),
      "w→a",
    );
    assert(
      canExecutionAuthorizationTransition("WAITING_FOUNDER", "REJECTED"),
      "w→r",
    );
    assert(canExecutionAuthorizationTransition("AUTHORIZED", "STOP"), "a→s");
    assert(!canExecutionAuthorizationTransition("STOP", "AUTHORIZED"), "term");
    assert(isAuthorizationExecutionPossible("AUTHORIZED") === false);
    checks.state_machine = true;
  }

  {
    const record = createExecutionAuthorizationRecord({
      mission_id: "m-verify",
      activation_id: "act-ref",
      reason: "verify intent",
      status: "WAITING_FOUNDER",
      fixture: true,
    });
    assert(record.execution_enabled === false);
    assert(record.overrides_activation_gate === false);
    const expected = computeAuthorizationChecksum({
      ...record,
      checksums: { ...record.checksums, authorization_checksum: "" },
    });
    assert(record.checksums.authorization_checksum === expected, "checksum");
    assert(validateExecutionAuthorization(record).ok, "valid");
    const cert = createExecutionAuthorizationCertificate({
      authorization_id: record.authorization_id,
      mission_id: record.mission_id,
      activation_reference: record.activation_id,
      status: "AUTHORIZED",
      authorization_checksum: record.checksums.authorization_checksum,
      fixture: true,
    });
    assert(cert.execution_permissions === false);
    assert(validateExecutionAuthorizationCertificate(cert).ok);
    checks.checksums = true;
    checks.certificate = true;
  }

  {
    assert(rejectForbiddenAuthorizationPayload({ execute: true }) !== null);
    checks.forbidden = true;
  }

  {
    const auth = createExecutionAuthorization(REPO, { fixture: true });
    const rejected = auth.recordIntent({
      mission_id: "mission-auth-reject-verify",
      reason: "verify reject",
      decision: "REJECTED",
      fixture: true,
    });
    assert(rejected.ok, "reject ok");
    assert(rejected.authorization?.outcome === "REJECTED");
    assert(rejected.authorization?.execution_enabled === false);
    assert(rejected.certificate?.execution_permissions === false);

    const authorized = auth.recordIntent({
      mission_id: "mission-auth-ok-verify",
      reason: "verify authorize intent",
      decision: "AUTHORIZED",
      fixture: true,
    });
    assert(authorized.ok, "auth ok");
    assert(authorized.authorization?.outcome === "AUTHORIZED");
    assert(authorized.authorization?.execution_enabled === false);
    assert(
      authorized.authorization?.safety_flags.authorization_enables_execution ===
        false,
    );
    assert(authorized.authorization?.overrides_activation_gate === false);
    assert(authorized.certificate?.execution_permissions === false);
    auth.reporter.writeMarkdown(auth.repository);
    assert(
      existsSync(join(auth.repository.dir, "EXECUTION_AUTHORIZATION_LOG.md")),
    );
    checks.repository = true;
    checks.authorization_never_enables_execution = true;
    checks.execution_impossible = true;
  }

  {
    const plugin = readFileSync(
      join(
        REPO,
        "SOS/SAIOS/platform/dashboard/plugins/executionAuthorization.ts",
      ),
      "utf8",
    );
    assert(plugin.includes("/api/runtime/execution-authorization"), "api");
    assert(
      plugin.includes("/api/runtime/execution-authorization/certificate"),
      "cert api",
    );
    assert(!plugin.includes('method: "POST"'), "no post");
    const view = readFileSync(
      join(
        REPO,
        "SOS/SAIOS/dashboard/src/views/ExecutionAuthorizationView.tsx",
      ),
      "utf8",
    );
    assert(view.includes("AUTHORIZATION IS NOT EXECUTION"), "banner1");
    assert(view.includes("EXECUTION DISABLED"), "banner2");
    assert(view.includes("LIVE OFF"), "banner3");
    checks.dashboard = true;
    checks.api = true;
  }

  checks.live_off = true;

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "execution-authorization-v1",
        checks: {
          contracts: true,
          repository: true,
          certificate: true,
          dashboard: true,
          api: true,
          checksums: true,
          authorization_never_enables_execution: true,
          execution_impossible: true,
          live_off: true,
          state_machine: true,
          ...checks,
        },
        overall: "PASS",
      },
      null,
      2,
    ),
  );
}

main();
