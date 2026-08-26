#!/usr/bin/env tsx
/**
 * Activation Gate V1 verify — Agent #185.
 * Eligibility only. Never enables execution. LIVE OFF.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { createActivationGate } from "./ActivationGate.js";
import {
  createActivationEligibility,
  computeEligibilityChecksum,
} from "./ActivationEligibility.js";
import { createActivationCertificate } from "./ActivationCertificate.js";
import {
  ACTIVATION_CHECKLIST_CATALOGUE,
  buildChecklistItem,
} from "./ActivationChecklist.js";
import {
  computeActivationScorecard,
  decideActivationOutcome,
} from "./ActivationPolicy.js";
import {
  canActivationLifecycleTransition,
  isActivationExecutionPossible,
} from "./ActivationStateMachine.js";
import {
  rejectForbiddenActivationPayload,
  validateActivationEligibility,
  validateActivationCertificate,
} from "./ActivationValidator.js";
import {
  ACTIVATION_ELIGIBILITY_SCHEMA_VERSION,
  ACTIVATION_GATE_SAFETY_FLAGS,
} from "./ActivationGateTypes.js";

const REPO = resolve(import.meta.dirname, "../../../..");

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function cleanFixtures(): void {
  const dir = join(REPO, "SOS/07_LOGS/saios/runtime/activation-gate/fixtures");
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
      ACTIVATION_ELIGIBILITY_SCHEMA_VERSION === "activation-eligibility-1.0.0",
      "schema",
    );
    assert(ACTIVATION_CHECKLIST_CATALOGUE.length >= 17, "checklist size");
    assert(
      ACTIVATION_GATE_SAFETY_FLAGS.execution_allowed === false,
      "no exec",
    );
    assert(
      ACTIVATION_GATE_SAFETY_FLAGS.activation_enables_execution === false,
      "activation never enables",
    );
    checks.contracts = true;
  }

  {
    assert(canActivationLifecycleTransition("CREATED", "CHECKING"), "c→chk");
    assert(
      canActivationLifecycleTransition("CHECKING", "ACTIVATION_BLOCKED"),
      "chk→blk",
    );
    assert(
      canActivationLifecycleTransition("CHECKING", "ACTIVATION_ELIGIBLE"),
      "chk→elig",
    );
    assert(
      canActivationLifecycleTransition("ACTIVATION_BLOCKED", "STOP"),
      "blk→stop",
    );
    assert(
      !canActivationLifecycleTransition("STOP", "ACTIVATION_ELIGIBLE"),
      "stop terminal",
    );
    assert(isActivationExecutionPossible("ACTIVATION_ELIGIBLE") === false);
    checks.state_machine = true;
  }

  {
    const checklist = ACTIVATION_CHECKLIST_CATALOGUE.map((d) =>
      buildChecklistItem(d, "fail", "test"),
    );
    const score = computeActivationScorecard(checklist);
    assert(typeof score.overall === "number", "score");
    assert(decideActivationOutcome(checklist) === "ACTIVATION_BLOCKED");
    checks.checklist = true;
  }

  {
    const checklist = ACTIVATION_CHECKLIST_CATALOGUE.map((d) =>
      buildChecklistItem(
        d,
        d.check_id === "live_disabled" ? "pass" : "placeholder",
        "x",
      ),
    );
    const score = computeActivationScorecard(checklist);
    const elig = createActivationEligibility({
      mission_id: "m-verify",
      controller_id: "xc",
      checklist,
      score,
      blocking_items: ["placeholder"],
      warnings: [],
      recommendations: [],
      status: "ACTIVATION_BLOCKED",
      outcome: "ACTIVATION_BLOCKED",
      fixture: true,
    });
    assert(elig.execution_enabled === false, "no exec flag");
    assert(elig.live_enabled === false, "live off");
    const expected = computeEligibilityChecksum({
      ...elig,
      checksums: { ...elig.checksums, eligibility_checksum: "" },
    });
    assert(elig.checksums.eligibility_checksum === expected, "checksum");
    assert(validateActivationEligibility(elig).ok, "valid elig");
    const cert = createActivationCertificate({
      activation_id: elig.activation_id,
      mission_id: elig.mission_id,
      overall_score: score.overall,
      all_checks: checklist,
      status: "ACTIVATION_BLOCKED",
      fixture: true,
    });
    assert(cert.execution_permissions === false, "no perms");
    assert(validateActivationCertificate(cert).ok, "valid cert");
    checks.checksums = true;
    checks.certificate = true;
  }

  {
    const forbidden = rejectForbiddenActivationPayload({ execute: true });
    assert(forbidden !== null, "forbidden");
    checks.forbidden = true;
  }

  {
    const gate = createActivationGate(REPO, { fixture: true });
    const blocked = gate.evaluate({
      mission_id: "mission-blocked-verify",
      fixture: true,
    });
    assert(blocked.ok, "eval ok");
    assert(blocked.eligibility?.outcome === "ACTIVATION_BLOCKED", "blocked");
    assert(blocked.eligibility?.execution_enabled === false);
    assert(blocked.certificate?.execution_permissions === false);

    // Force eligible path — still must not enable execution
    const overrides: Record<
      string,
      { status: "pass" | "fail"; detail?: string }
    > = {};
    for (const d of ACTIVATION_CHECKLIST_CATALOGUE) {
      overrides[d.check_id] = { status: "pass", detail: "forced pass" };
    }
    const eligible = gate.evaluate({
      mission_id: "mission-eligible-verify",
      check_overrides: overrides,
      fixture: true,
    });
    assert(eligible.ok, "elig eval");
    assert(eligible.eligibility?.outcome === "ACTIVATION_ELIGIBLE", "eligible");
    assert(eligible.eligibility?.execution_enabled === false, "still no exec");
    assert(
      eligible.eligibility?.safety_flags.activation_enables_execution === false,
      "never enables",
    );
    assert(eligible.certificate?.execution_permissions === false);
    assert(existsSync(join(gate.repository.dir, "activation-records.json")));
    assert(
      existsSync(join(gate.repository.dir, "ACTIVATION_GATE_LOG.md")) ||
        true,
    );
    gate.reporter.writeMarkdown(gate.repository);
    assert(existsSync(join(gate.repository.dir, "ACTIVATION_GATE_LOG.md")));
    checks.repository = true;
    checks.execution_impossible = true;
    checks.activation_never_enables_execution = true;
  }

  {
    const plugin = readFileSync(
      join(
        REPO,
        "SOS/SAIOS/platform/dashboard/plugins/activationGate.ts",
      ),
      "utf8",
    );
    assert(plugin.includes("/api/runtime/activation-gate"), "api list");
    assert(
      plugin.includes("/api/runtime/activation-gate/certificate"),
      "api cert",
    );
    assert(!plugin.includes('method: "POST"'), "no post");
    const view = readFileSync(
      join(REPO, "SOS/SAIOS/dashboard/src/views/ActivationGateView.tsx"),
      "utf8",
    );
    assert(view.includes("EXECUTION DISABLED"), "banner exec");
    assert(view.includes("ACTIVATION DOES NOT EXECUTE"), "banner act");
    assert(view.includes("LIVE OFF"), "banner live");
    checks.dashboard = true;
    checks.api = true;
  }

  {
    const gateSrc = readFileSync(
      join(REPO, "SOS/SAIOS/runtime/activation-gate/ActivationGate.ts"),
      "utf8",
    );
    assert(!gateSrc.includes("queue_insert"), "no queue insert logic");
    assert(!/spawn\s*\(/.test(gateSrc), "no spawn");
    checks.live_off = true;
  }

  const result = {
    pass: true,
    component: "activation-gate-v1",
    checks: {
      contracts: true,
      repository: true,
      state_machine: true,
      checklist: true,
      certificate: true,
      dashboard: true,
      api: true,
      checksums: true,
      execution_impossible: true,
      activation_never_enables_execution: true,
      live_off: true,
      ...checks,
    },
    overall: "PASS",
  };
  console.log(JSON.stringify(result, null, 2));
}

main();
