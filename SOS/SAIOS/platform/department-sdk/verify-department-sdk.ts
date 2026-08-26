#!/usr/bin/env tsx
/**
 * Department SDK V1 verify — Agent #180.
 * Fixtures only. Contracts only. Never executes.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { createDepartmentSDK } from "./DepartmentSDK.js";
import { buildResumeDepartmentReference } from "./catalog/resumeReference.js";
import { buildPlaceholderDepartments } from "./catalog/placeholders.js";
import { validateDepartment, rejectForbiddenDepartmentPayload } from "./DepartmentValidator.js";
import {
  canDepartmentLifecycleTransition,
  isExecutionPossibleInStatus,
} from "./DepartmentLifecycle.js";
import {
  DEPARTMENT_CONTRACT_VERSION,
  DEPARTMENT_SDK_SCHEMA_VERSION,
} from "./DepartmentTypes.js";
import { createDepartmentContract } from "./Department.js";
import { defineDirector } from "./DepartmentDirector.js";

const REPO = resolve(import.meta.dirname, "../../../..");

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function cleanFixtures(): void {
  const dir = join(REPO, "SOS/07_LOGS/saios/platform/department-sdk/fixtures");
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, ".verify-run"), new Date().toISOString(), "utf8");
}

function main(): void {
  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE must be OFF");
  cleanFixtures();
  const checks: Record<string, boolean> = {};

  {
    assert(DEPARTMENT_SDK_SCHEMA_VERSION === "department-sdk-1.0.0", "sdk ver");
    assert(
      DEPARTMENT_CONTRACT_VERSION === "department-contract-1.0.0",
      "contract ver",
    );
    checks.contracts = true;
  }

  {
    const resume = buildResumeDepartmentReference();
    assert(resume.department_id === "resume", "resume id");
    assert(resume.reference === true, "resume ref");
    assert(resume.placeholder === false, "resume not placeholder");
    assert(resume.director.director_id === "resume.director", "director");
    assert(resume.managers.length >= 2, "managers");
    assert(resume.workers.length >= 4, "workers");
    assert(resume.capabilities.length >= 8, "capabilities");
    assert(resume.execution_policy.may_execute === false, "exec policy");
    assert(resume.safety_flags.live_enabled === false, "live");
    const v = validateDepartment(resume);
    assert(v.ok, `resume valid: ${v.errors[0]?.message}`);
    checks.resume_reference = true;
    checks.metadata = true;
  }

  {
    const placeholders = buildPlaceholderDepartments();
    assert(placeholders.length === 8, "8 placeholders");
    const ids = placeholders.map((p) => p.department_id).sort();
    assert(
      ids.join(",") ===
        "finance,hr,legal,marketing,publisher,seo,support,website",
      "placeholder ids",
    );
    for (const p of placeholders) {
      assert(p.placeholder === true, `${p.department_id} placeholder`);
      assert(validateDepartment(p).ok, `${p.department_id} valid`);
    }
    checks.placeholder_departments = true;
  }

  {
    const sdk = createDepartmentSDK(REPO, { fixture: true });
    const boot = sdk.bootstrapCanonicalCatalog();
    assert(boot.ok, `boot: ${boot.errors.join(";")}`);
    const list = sdk.listDepartments();
    assert(list.length === 9, `expected 9 departments, got ${list.length}`);
    assert(list.some((d) => d.department_id === "resume"), "has resume");
    assert(sdk.loadDepartment("resume") != null, "load resume");
    assert(sdk.discoverDirector("resume")?.director_id === "resume.director", "disc director");
    assert(sdk.discoverManagers("resume").length >= 2, "disc managers");
    assert(sdk.discoverWorkers("resume").length >= 4, "disc workers");
    assert(sdk.discoverCapabilities("resume").length >= 8, "disc caps");
    const validated = sdk.validateDepartment("website");
    assert(validated.ok, "validate website");
    checks.registry = true;
    checks.validation = true;
  }

  {
    assert(
      canDepartmentLifecycleTransition("REGISTERED", "VALIDATED"),
      "reg→val",
    );
    assert(canDepartmentLifecycleTransition("VALIDATED", "READY"), "val→ready");
    assert(canDepartmentLifecycleTransition("READY", "ACTIVE"), "ready→active");
    assert(canDepartmentLifecycleTransition("ACTIVE", "PAUSED"), "active→paused");
    assert(
      !canDepartmentLifecycleTransition("REGISTERED", "ACTIVE"),
      "no skip",
    );
    assert(isExecutionPossibleInStatus("ACTIVE") === false, "active no exec");
    assert(isExecutionPossibleInStatus("READY") === false, "ready no exec");
    checks.lifecycle = true;
  }

  {
    const forbidden = rejectForbiddenDepartmentPayload({ execute: true });
    assert(forbidden?.code === "FORBIDDEN_SIDE_EFFECT", "forbidden");
    const bad = createDepartmentContract({
      department_id: "bad",
      department_name: "Bad",
      department_type: "placeholder",
      director: defineDirector({
        director_id: "bad-dir",
        director_name: "Bad",
        description: "x",
        manager_ids: ["missing"],
      }),
    });
    assert(!validateDepartment(bad).ok, "bad director managers");
    checks.validation_strict = true;
  }

  {
    const sdk = createDepartmentSDK(REPO, { fixture: true });
    sdk.bootstrapCanonicalCatalog();
    assert(
      existsSync(
        join(
          REPO,
          "SOS/07_LOGS/saios/platform/department-sdk/fixtures/departments.json",
        ),
      ),
      "persisted",
    );
    assert(
      existsSync(
        join(
          REPO,
          "SOS/07_LOGS/saios/platform/department-sdk/fixtures/DEPARTMENT_REGISTRY_LOG.md",
        ),
      ),
      "log",
    );
    const reload = createDepartmentSDK(REPO, { fixture: true });
    assert(reload.registry.loadPersisted() === 9, "reload 9");
    checks.persistence = true;
  }

  {
    const plugin = readFileSync(
      join(
        REPO,
        "SOS/SAIOS/platform/dashboard/plugins/departmentRegistry.ts",
      ),
      "utf8",
    );
    assert(plugin.includes("/api/platform/departments"), "api list");
    assert(plugin.includes("/api/platform/departments/registry"), "api registry");
    assert(!plugin.includes("method: \"POST\""), "no post");
    const view = readFileSync(
      join(REPO, "SOS/SAIOS/dashboard/src/views/DepartmentRegistryView.tsx"),
      "utf8",
    );
    assert(view.includes("EXECUTION DISABLED"), "banner exec");
    assert(view.includes("LIVE OFF"), "banner live");
    checks.dashboard = true;
    checks.api = true;
  }

  {
    const src = [
      readFileSync(join(REPO, "SOS/SAIOS/platform/department-sdk/DepartmentSDK.ts"), "utf8"),
      readFileSync(join(REPO, "SOS/SAIOS/platform/department-sdk/DepartmentRegistry.ts"), "utf8"),
    ].join("\n");
    assert(!src.includes("QueueManager"), "no queue");
    assert(!/\.spawn\(/.test(src), "no spawn");
    assert(!src.includes("ExecutionController"), "no exec controller write");
    checks.execution_impossible = true;
  }

  checks.live_off = process.env.SOS_AIOS_LIVE !== "1";

  const pass = Object.values(checks).every(Boolean);
  console.log(
    JSON.stringify(
      {
        pass,
        component: "department-sdk-v1",
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
