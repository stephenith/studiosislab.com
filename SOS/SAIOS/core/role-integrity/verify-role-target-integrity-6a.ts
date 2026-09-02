/**
 * Phase 6A — Role-target integrity verifier (no network, no production mutation).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { selectRoleForFamily } from "../design-families/DesignFamilyEngine.js";
import { PRODUCTION_ROLE_TAXONOMY } from "../first-production-cycle/ProductionRoleTaxonomy.js";
import {
  RoleContentUnavailableError,
  pickRoleSample,
  resolveDeterministicPackFamily,
  resolveRoleSample,
} from "../resume-renderer/SampleContent.js";
import {
  auditRolePackCoverage,
  evaluateCanvasRoleTargetIntegrity,
  evaluateRoleTargetIntegrity,
  normalizeRoleKey,
  rolesAreCompatible,
} from "./RoleTargetIntegrity.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "../../..");
const OUT = join(
  REPO,
  "07_LOGS/saios/role-integrity/verify-role-target-integrity-6a.json",
);

type Check = { name: string; pass: boolean; detail: string };
function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: !!cond, detail };
}

function canvasWithRole(title: string, name = "Pat Example") {
  return {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects: [
      {
        type: "textbox",
        id: "h-name",
        top: 48,
        left: 48,
        text: name,
        fontSize: 28,
        data: { section: "header", role: "name" },
      },
      {
        type: "textbox",
        id: "h-role",
        top: 82,
        left: 48,
        text: title,
        fontSize: 14,
        data: { section: "header", role: "professional_title" },
      },
    ],
  };
}

function main(): void {
  const checks: Check[] = [];

  checks.push(
    assert(
      evaluateRoleTargetIntegrity({
        target_title: "Operations Analyst",
        target_role_family: "operations_analyst",
        structured_role: "Marketing Manager",
        rendered_role: "Marketing Manager",
      }).pass === false,
      "A_operations_analyst_vs_marketing_manager_fail",
      "ok",
    ),
  );

  checks.push(
    assert(
      evaluateRoleTargetIntegrity({
        target_title: "Graphic Designer",
        target_role_family: "graphic_designer",
        structured_role: "HR Manager",
        rendered_role: "HR Manager",
      }).pass === false,
      "B_graphic_designer_vs_hr_manager_fail",
      "ok",
    ),
  );

  checks.push(
    assert(
      evaluateRoleTargetIntegrity({
        target_title: "Marketing Manager",
        target_role_family: "marketing_manager",
        structured_role: "Marketing Manager",
        rendered_role: "Marketing Manager",
      }).pass === true,
      "C_marketing_manager_match_pass",
      "ok",
    ),
  );

  {
    const alias = rolesAreCompatible("hr_manager", "human_resources_manager");
    const r = evaluateRoleTargetIntegrity({
      target_title: "HR Manager",
      target_role_family: "hr_manager",
      structured_role: "Human Resources Manager",
      rendered_role: "Human Resources Manager",
    });
    checks.push(
      assert(
        alias.ok &&
          alias.kind === "ROLE_COMPATIBLE_ALIAS" &&
          r.pass === true,
        "D_explicit_hr_alias_pass",
        `${alias.kind}/${r.match}`,
      ),
    );
  }

  {
    let threw = false;
    try {
      pickRoleSample("operations_analyst", 0);
    } catch (e) {
      threw = e instanceof RoleContentUnavailableError;
    }
    const resolved = resolveDeterministicPackFamily("operations_analyst");
    const viaResolve = resolveRoleSample({ roleFamily: "operations_analyst" });
    checks.push(
      assert(
        threw &&
          resolved.match === "NONE" &&
          viaResolve.ok === false,
        "E_missing_pack_fail_closed",
        `threw=${threw} match=${resolved.match}`,
      ),
    );
  }

  checks.push(
    assert(
      evaluateRoleTargetIntegrity({
        target_title: "Software Engineer",
        target_role_family: "software_engineer",
        structured_role: "Software Engineer",
        rendered_role: "Accountant",
      }).pass === false,
      "F_structured_ok_rendered_wrong_fail",
      "ok",
    ),
  );

  checks.push(
    assert(
      evaluateRoleTargetIntegrity({
        target_title: "Software Engineer",
        target_role_family: "software_engineer",
        structured_role: "Accountant",
        rendered_role: "Software Engineer",
      }).pass === false,
      "G_structured_wrong_rendered_ok_fail",
      "ok",
    ),
  );

  checks.push(
    assert(
      evaluateRoleTargetIntegrity({
        target_title: "Marketing Manager",
        target_role_family: "marketing_manager",
        structured_role: "Software Engineer",
        rendered_role: "Software Engineer",
      }).pass === false,
      "H_revision_role_change_fail",
      "ok",
    ),
  );

  checks.push(
    assert(
      selectRoleForFamily("professional_sidebar", 0, "graphic_designer") ===
        "graphic_designer",
      "design_family_preserves_preferred_role",
      selectRoleForFamily("professional_sidebar", 0, "graphic_designer"),
    ),
  );

  const families = PRODUCTION_ROLE_TAXONOMY.map((e) =>
    normalizeRoleKey(e.title),
  );
  const coverage = auditRolePackCoverage(families);
  checks.push(
    assert(
      coverage.missing_role_content.includes("operations_analyst") &&
        coverage.exact_pack_covered.includes("marketing_manager"),
      "pack_coverage_audit_lists_missing",
      `missing=${coverage.missing_role_content.length}`,
    ),
  );

  checks.push(
    assert(
      evaluateCanvasRoleTargetIntegrity({
        target_title: "Marketing Manager",
        target_role_family: "marketing_manager",
        canvas: canvasWithRole("Marketing Manager"),
        sample_title: "Marketing Manager",
      }).pass === true,
      "canvas_extraction_match",
      "ok",
    ),
  );
  checks.push(
    assert(
      evaluateCanvasRoleTargetIntegrity({
        target_title: "Operations Analyst",
        target_role_family: "operations_analyst",
        canvas: canvasWithRole("Marketing Manager"),
        sample_title: "Marketing Manager",
      }).pass === false,
      "canvas_extraction_mismatch",
      "ok",
    ),
  );

  const failed = checks.filter((c) => !c.pass);
  const report = {
    schema_version: "verify-role-target-integrity-6a-1.0.0",
    ok: failed.length === 0,
    checks,
    failed: failed.map((c) => c.name),
    pack_coverage: coverage,
    historical_mutated: false,
    openai_called: false,
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(report, null, 2));
  if (!report.ok) {
    console.error("FAIL verify-role-target-integrity-6a", failed);
    process.exit(1);
  }
  console.log("PASS verify-role-target-integrity-6a", {
    checks: checks.length,
    missing_packs: coverage.missing_role_content.length,
  });
}

main();
