/**
 * Phase 6A — deterministic end-to-end generation role contract (no OpenAI).
 * target → content resolution → integrity → Founder admission decision.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  resolveDeterministicPackFamily,
  resolveRoleSample,
} from "../resume-renderer/SampleContent.js";
import {
  evaluateRoleTargetIntegrity,
} from "./RoleTargetIntegrity.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "../../..");
const OUT = join(
  REPO,
  "07_LOGS/saios/role-integrity/verify-generation-role-contract-e2e-6a.json",
);

type Check = { name: string; pass: boolean; detail: string };
function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: !!cond, detail };
}

function admitToFounder(integrityPass: boolean): "WAITING_FOUNDER" | "ROLE_INTEGRITY_FAILED" {
  return integrityPass ? "WAITING_FOUNDER" : "ROLE_INTEGRITY_FAILED";
}

function main(): void {
  const checks: Check[] = [];

  // Correct role path: marketing_manager pack exists → integrity PASS → WAITING_FOUNDER
  {
    const target = {
      title: "Marketing Manager",
      role_family: "marketing_manager",
    };
    const resolved = resolveRoleSample({ roleFamily: target.role_family });
    checks.push(
      assert(resolved.ok === true, "e2e_correct_content_resolves", String(resolved)),
    );
    if (resolved.ok) {
      const integ = evaluateRoleTargetIntegrity({
        target_title: target.title,
        target_role_family: target.role_family,
        structured_role: resolved.sample.title,
        rendered_role: resolved.sample.title,
        content_source: resolved.source,
        pack_family: resolved.pack_family,
      });
      const state = admitToFounder(integ.pass);
      checks.push(
        assert(
          integ.pass && state === "WAITING_FOUNDER",
          "e2e_correct_role_waiting_founder",
          `${integ.match} → ${state}`,
        ),
      );
    }
  }

  // Wrong role path: operations_analyst missing pack → fail closed before Founder
  {
    const target = {
      title: "Operations Analyst",
      role_family: "operations_analyst",
    };
    const pack = resolveDeterministicPackFamily(target.role_family);
    const resolved = resolveRoleSample({ roleFamily: target.role_family });
    checks.push(
      assert(
        pack.match === "NONE" && resolved.ok === false,
        "e2e_missing_pack_blocks_render",
        `pack=${pack.match} ok=${resolved.ok}`,
      ),
    );
    // If mock wrongly supplied Marketing Manager content:
    const integ = evaluateRoleTargetIntegrity({
      target_title: target.title,
      target_role_family: target.role_family,
      structured_role: "Marketing Manager",
      rendered_role: "Marketing Manager",
      content_source: "deterministic_pack",
      pack_family: "marketing_manager",
    });
    const state = admitToFounder(integ.pass);
    checks.push(
      assert(
        !integ.pass && state === "ROLE_INTEGRITY_FAILED",
        "e2e_wrong_role_rejected_before_founder",
        `${integ.match} → ${state}`,
      ),
    );
    checks.push(
      assert(
        state !== "WAITING_FOUNDER",
        "e2e_mismatch_does_not_count_toward_founder_queue",
        state,
      ),
    );
  }

  // OpenAI mismatch also fails
  {
    const integ = evaluateRoleTargetIntegrity({
      target_title: "Graphic Designer",
      target_role_family: "graphic_designer",
      structured_role: "HR Manager",
      rendered_role: "HR Manager",
      content_source: "openai",
    });
    checks.push(
      assert(
        !integ.pass && admitToFounder(integ.pass) === "ROLE_INTEGRITY_FAILED",
        "e2e_openai_mismatch_also_fails",
        integ.reason,
      ),
    );
  }

  const failed = checks.filter((c) => !c.pass);
  const report = {
    schema_version: "verify-generation-role-contract-e2e-6a-1.0.0",
    ok: failed.length === 0,
    checks,
    failed: failed.map((c) => c.name),
    openai_called: false,
    production_generation: false,
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(report, null, 2));
  if (!report.ok) {
    console.error("FAIL verify-generation-role-contract-e2e-6a", failed);
    process.exit(1);
  }
  console.log("PASS verify-generation-role-contract-e2e-6a", {
    checks: checks.length,
  });
}

main();
