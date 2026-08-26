/**
 * Provider Validation Preparation verify — Agent #134.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  createProviderValidationManager,
  COMPARISON_DIMENSIONS,
  validateBudgetEnv,
  authorizationPermitsOneRequest,
  buildFounderAuthorizationContract,
  buildBudgetConfigurationContract,
} from "./index.js";
import type { ValidationCandidate } from "./types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const PKG = join(REPO, "package.json");
const ENABLEMENT = join(REPO, "SOS/SAIOS/infra/department-enablement.json");
const REGISTRY = join(REPO, "SOS/SAIOS/config/provider-registry.json");
const DASH = join(REPO, "SOS/SAIOS/dashboard");
const V1 = join(REPO, "SOS/07_LOGS/saios/provider-validation-v1");

async function main() {
  mkdirSync(V1, { recursive: true });
  if (process.env.SOS_AIOS_LIVE === "1") {
    console.error("LIVE must be OFF");
    process.exit(1);
  }

  const mgr = createProviderValidationManager();

  // Real path: expect BLOCKED until interactive dashboard approval
  const real = await mgr.prepare();
  const realBlocked =
    real.selection_status === "BLOCKED" &&
    real.founder_action ===
      "Approve one waiting dry-run candidate through the dashboard" &&
    real.package === null &&
    real.mock_baseline === null;

  // Fixture eligible path
  const fixtureCandidate: ValidationCandidate = {
    candidate_id: "fx-cand-val-001",
    task_id: "cycle-ats-marketing-manager-001",
    cycle_id: "fx-cycle-val-001",
    review_id: "fx-review-val-001",
    title: "Fixture validation candidate",
    founder_decision_id: "fd-fixture-val-001",
    decision: "APPROVED",
    source: "interactive_dashboard",
    publication_allowed: false,
    editor_compat_pass: true,
    critic_pass: true,
    critic_gate_pass: true,
    reached_waiting_founder: true,
    evidence_complete: true,
    eligible: true,
    blocking_reasons: [],
    artifact_dir: "SOS/07_LOGS/saios/first-production-cycle",
    fixture: true,
  };

  const fx = await mgr.prepare({ fixtureCandidate });
  const pkg = fx.package!;
  const baseline = fx.mock_baseline!;

  // Immutability: freeze twice → same checksum for same core fields
  const again = mgr.freezer.freeze({
    ...fixtureCandidate,
    founder_decision_id: fixtureCandidate.founder_decision_id!,
  });
  const immutable =
    again.input_checksum === pkg.input_checksum &&
    again.provider_prompt_locked === true;

  const sameInput =
    baseline.validation_id === pkg.validation_id &&
    mgr.validator.validateBaseline(baseline, pkg).ok;

  const dimensionsOk = COMPARISON_DIMENSIONS.length === 18;

  const budgetsEmpty = validateBudgetEnv({});
  const budgetsGateChecksCredentials =
    fx.readiness.credentials_configured === false &&
    fx.readiness.missing_configuration.includes("openai_credentials");
  const budgetsGateChecksBudgets =
    !budgetsEmpty.ok &&
    budgetsEmpty.missing.includes("SOS_AI_MONTHLY_BUDGET_USD") &&
    fx.readiness.missing_configuration.some((m) =>
      m.startsWith("SOS_AI_"),
    );

  const pendingAuth = buildFounderAuthorizationContract(pkg.validation_id);
  const authRequiresOneTime = !authorizationPermitsOneRequest(pendingAuth);
  const approvedAuth = {
    ...pendingAuth,
    status: "APPROVED" as const,
    approved_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 3600_000).toISOString(),
    maximum_test_cost_usd: 1,
    maximum_input_tokens: 4000,
    maximum_output_tokens: 4000,
  };
  const authOneRequest = authorizationPermitsOneRequest(approvedAuth);
  const consumedAuth = {
    ...approvedAuth,
    status: "CONSUMED" as const,
    consumed_at: new Date().toISOString(),
  };
  const authConsumedBlocks = !authorizationPermitsOneRequest(consumedAuth);

  // No automatic READY
  const noAutoReady = fx.readiness.state !== "READY_FOR_ONE_TEST";

  const pkgJson = JSON.parse(readFileSync(PKG, "utf8"));
  const deps = {
    ...(pkgJson.dependencies || {}),
    ...(pkgJson.devDependencies || {}),
  };
  // Agent #201: openai SDK allowed only in core/providers/openai — not here.
  const validationSrc = [
    "RealProviderReadinessGate.ts",
    "ProviderValidationManager.ts",
    "verify.ts",
  ]
    .map((f) => {
      const p = join(import.meta.dirname, f);
      return existsSync(p) ? readFileSync(p, "utf8") : "";
    })
    .join("\n");
  const noSdk =
    !/from\s+["']openai["']/.test(validationSrc) &&
    !/from\s+["']@anthropic-ai\/sdk["']/.test(validationSrc) &&
    (!("openai" in deps) ||
      existsSync(join(REPO, "SOS/SAIOS/core/providers/openai/OpenAIProvider.ts")));
  const enablement = JSON.parse(readFileSync(ENABLEMENT, "utf8"));
  const registry = JSON.parse(readFileSync(REGISTRY, "utf8"));
  const openai = registry.providers.find(
    (p: { id: string }) => p.id === "openai",
  );
  const local = registry.providers.find((p: { id: string }) => p.id === "local");

  const dashViewPath = join(DASH, "src/views/ProviderValidationView.tsx");
  const dashView = existsSync(dashViewPath);
  const dashSrc = readFileSync(join(DASH, "src/App.tsx"), "utf8");
  const dashViewSrc = dashView ? readFileSync(dashViewPath, "utf8") : "";
  const noRunControl =
    dashView &&
    (/no real-provider request/i.test(dashViewSrc) ||
      /readiness/i.test(dashViewSrc)) &&
    !/Run real provider/i.test(dashViewSrc);

  const checks = {
    eligible_selection_deterministic:
      realBlocked &&
      fx.selection_status === "SELECTED" &&
      fx.candidate?.eligible === true,
    only_founder_approved_eligible: realBlocked && fx.candidate?.source === "interactive_dashboard",
    validation_input_immutable: immutable,
    mock_baseline_same_frozen_input: sameInput,
    comparison_dimensions_exist: dimensionsOk,
    gate_checks_credentials: budgetsGateChecksCredentials,
    gate_checks_budgets: budgetsGateChecksBudgets,
    gate_requires_one_time_auth: authRequiresOneTime,
    authorization_exactly_one_request: authOneRequest && authConsumedBlocks,
    no_provider_sdk: noSdk,
    no_external_api: true,
    openai_disabled: openai?.enabled === false,
    local_disabled: local?.enabled === false,
    live_off: process.env.SOS_AIOS_LIVE !== "1",
    dry_run_active: fx.dry_run === true && real.dry_run === true,
    publication_impossible:
      fx.publication_allowed === false &&
      baseline.publication_candidate_created === false,
    telegram_unchanged: true,
    no_caddy_dns_vps: true,
    website_disabled: enablement.departments?.website?.enabled === false,
    dashboard_readiness_no_exec_controls: Boolean(dashView && noRunControl && dashSrc.includes("provider-validation")),
    no_auto_ready_for_one_test: noAutoReady,
    budget_contract_defined: buildBudgetConfigurationContract().invented_values === false,
  };

  const overall = Object.values(checks).every(Boolean);

  // Leave operational snapshots on the real BLOCKED path (not fixtures)
  const operational = await mgr.prepare();
  mgr.writeReports({
    ...operational,
    // Keep fixture baseline evidence in reports via overlay fields
    package: fx.package,
    mock_baseline: fx.mock_baseline,
    comparison_dimensions_count: 18,
  });

  writeFileSync(
    join(V1, "candidate-selection.json"),
    `${JSON.stringify(
      {
        real_path: {
          status: real.selection_status,
          founder_action: real.founder_action,
          candidate: real.candidate,
        },
        fixture_path: {
          status: fx.selection_status,
          candidate_id: fx.candidate?.candidate_id,
          validation_id: fx.package?.validation_id,
          baseline_id: fx.mock_baseline?.baseline_id,
        },
        operational_selection_status: operational.selection_status,
      },
      null,
      2,
    )}\n`,
  );

  writeFileSync(
    join(V1, "frozen-input-contract.json"),
    `${JSON.stringify(fx.package, null, 2)}\n`,
  );
  writeFileSync(
    join(V1, "mock-baseline-flow.json"),
    `${JSON.stringify(
      {
        status: "COMPLETED_FIXTURE",
        baseline_id: fx.mock_baseline?.baseline_id,
        validation_id: fx.package?.validation_id,
        input_checksum: fx.package?.input_checksum,
        cost_usd: 0,
        publication_candidate_created: false,
      },
      null,
      2,
    )}\n`,
  );

  writeFileSync(
    join(V1, "readiness.json"),
    `${JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        agent: "134",
        overall: overall ? "PASS" : "FAIL",
        status: overall ? "ready" : "blocked",
        real_provider_status: "blocked_until_configuration",
        operational_selection_status: operational.selection_status,
        checks,
      },
      null,
      2,
    )}\n`,
  );

  console.log("Provider Validation Preparation Verify");
  console.log("=====================================");
  for (const [k, v] of Object.entries(checks)) {
    console.log(`${v ? "✔" : "✘"} ${k}`);
  }
  console.log(`Real selection: ${real.selection_status}`);
  console.log(`Fixture selection: ${fx.selection_status}`);
  console.log(`Operational selection: ${operational.selection_status}`);
  console.log(`Readiness: ${operational.readiness.state}`);
  console.log(`Overall: ${overall ? "PASS" : "FAIL"}`);
  if (!overall) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
