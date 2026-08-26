/**
 * ProviderValidationManager — orchestration façade for Agent #134.
 */
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { COMPARISON_DIMENSIONS, buildComparisonScorecard } from "./ComparisonScorecard.js";
import {
  ProviderComparisonEngine,
  buildProviderComparisonContract,
} from "./ProviderComparisonContract.js";
import { MockBaselineRunner } from "./MockBaselineRunner.js";
import {
  RealProviderReadinessGate,
  buildBudgetConfigurationContract,
  buildFounderAuthorizationContract,
} from "./RealProviderReadinessGate.js";
import { ValidationCandidateSelector } from "./ValidationCandidateSelector.js";
import { ValidationInputFreezer } from "./ValidationInputFreezer.js";
import { ValidationArtifactValidator } from "./ValidationArtifactValidator.js";
import { ValidationReporter, ValidationStore } from "./ValidationReporter.js";
import type {
  ProviderValidationSnapshot,
  ValidationCandidate,
} from "./types.js";

export class ProviderValidationManager {
  readonly store: ValidationStore;
  readonly selector = new ValidationCandidateSelector();
  readonly freezer = new ValidationInputFreezer();
  readonly baselineRunner = new MockBaselineRunner();
  readonly readinessGate = new RealProviderReadinessGate();
  readonly comparison = new ProviderComparisonEngine();
  readonly validator = new ValidationArtifactValidator();
  readonly reporter = new ValidationReporter();

  constructor(
    private readonly repoRoot = resolve(import.meta.dirname, "../../../.."),
  ) {
    this.store = new ValidationStore(repoRoot);
  }

  async prepare(options?: {
    fixtureCandidate?: ValidationCandidate;
  }): Promise<ProviderValidationSnapshot> {
    if (process.env.SOS_AIOS_LIVE === "1") {
      throw new Error("LIVE must be OFF for provider validation preparation");
    }

    const selection = this.selector.select({
      fixtureCandidate: options?.fixtureCandidate,
    });

    if (selection.status === "BLOCKED") {
      this.store.append("validation-candidates.jsonl", {
        at: new Date().toISOString(),
        status: "BLOCKED",
        candidate: selection.candidate,
        founder_action: selection.founder_action,
      });
      this.store.appendEvent(
        "PROVIDER_VALIDATION_CANDIDATE_BLOCKED",
        selection.reason,
        { founder_action: selection.founder_action },
      );
      this.store.appendEvent(
        "PROVIDER_VALIDATION_BLOCKED",
        "Real-provider path blocked — awaiting interactive dashboard APPROVED resume template",
      );

      const readiness = this.readinessGate.evaluate({
        validation_id: null,
        candidate_selected: false,
      });
      this.store.appendEvent(
        "REAL_PROVIDER_CONFIGURATION_MISSING",
        `Missing: ${readiness.missing_configuration.join(", ")}`,
      );

      const contract = buildProviderComparisonContract(null);
      this.store.writeSnapshots({
        candidate: selection.candidate,
        selection_status: "BLOCKED",
        founder_action: selection.founder_action,
        pkg: null,
        baseline: null,
        readiness,
        comparison_contract: contract,
      });

      return {
        generated_at: new Date().toISOString(),
        selection_status: "BLOCKED",
        candidate: selection.candidate,
        founder_action: selection.founder_action,
        package: null,
        mock_baseline: null,
        readiness,
        comparison_dimensions_count: COMPARISON_DIMENSIONS.length,
        real_provider_request_executed: false,
        live: false,
        dry_run: true,
        openai_disabled: true,
        publication_allowed: false,
      };
    }

    const candidate = selection.candidate!;
    this.store.append("validation-candidates.jsonl", {
      at: new Date().toISOString(),
      status: "SELECTED",
      candidate,
    });
    this.store.appendEvent(
      "PROVIDER_VALIDATION_CANDIDATE_SELECTED",
      `Selected ${candidate.candidate_id}`,
      { cycle_id: candidate.cycle_id, decision_id: candidate.founder_decision_id },
    );

    const pkg = this.freezer.freeze(candidate);
    const pkgCheck = this.validator.validatePackage(pkg);
    if (!pkgCheck.ok) throw new Error(pkgCheck.errors.join("; "));

    this.store.append("validation-packages.jsonl", pkg);
    this.store.appendEvent(
      "VALIDATION_INPUT_FROZEN",
      `Frozen ${pkg.validation_id} checksum=${pkg.input_checksum.slice(0, 12)}`,
    );

    this.store.appendEvent(
      "MOCK_BASELINE_STARTED",
      `Mock baseline for ${pkg.validation_id}`,
    );
    const baseline = await this.baselineRunner.run(pkg);
    const baseCheck = this.validator.validateBaseline(baseline, pkg);
    if (!baseCheck.ok) throw new Error(baseCheck.errors.join("; "));

    this.store.append("mock-baselines.jsonl", {
      baseline_id: baseline.baseline_id,
      validation_id: baseline.validation_id,
      provider: baseline.provider,
      cost_usd: baseline.cost_usd,
      estimated_tokens: baseline.estimated_tokens,
      deterministic_checksum: baseline.deterministic_checksum,
      input_checksum: pkg.input_checksum,
      publication_candidate_created: false,
      completed_at: baseline.completed_at,
      fixture: baseline.fixture,
    });
    this.store.appendEvent(
      "MOCK_BASELINE_COMPLETED",
      `Baseline ${baseline.baseline_id} cost=0`,
    );

    const auth = buildFounderAuthorizationContract(pkg.validation_id);
    this.store.append("authorization-records.jsonl", auth);

    const readiness = this.readinessGate.evaluate({
      validation_id: pkg.validation_id,
      candidate_selected: true,
      authorization: auth,
    });
    if (readiness.state === "WAITING_FOUNDER_AUTHORIZATION") {
      this.store.appendEvent(
        "REAL_PROVIDER_WAITING_FOUNDER_AUTHORIZATION",
        "One-time founder authorization required; READY_FOR_ONE_TEST not auto-granted",
      );
    } else {
      this.store.appendEvent(
        "REAL_PROVIDER_CONFIGURATION_MISSING",
        `State=${readiness.state}; missing=${readiness.missing_configuration.join(",")}`,
      );
    }
    this.store.appendEvent(
      "PROVIDER_VALIDATION_BLOCKED",
      "Real provider execution blocked in Agent #134",
    );

    const contract = buildProviderComparisonContract(pkg.validation_id);
    this.store.writeSnapshots({
      candidate,
      selection_status: "SELECTED",
      founder_action: null,
      pkg,
      baseline,
      readiness,
      comparison_contract: contract,
    });

    return {
      generated_at: new Date().toISOString(),
      selection_status: "SELECTED",
      candidate,
      founder_action: null,
      package: pkg,
      mock_baseline: baseline,
      readiness,
      comparison_dimensions_count: COMPARISON_DIMENSIONS.length,
      real_provider_request_executed: false,
      live: false,
      dry_run: true,
      openai_disabled: true,
      publication_allowed: false,
    };
  }

  writeReports(snap: ProviderValidationSnapshot): void {
    const v1 = join(this.repoRoot, "SOS/07_LOGS/saios/provider-validation-v1");
    const formal = join(
      this.repoRoot,
      "SOS/09_REPORTS/AIOS_REAL_PROVIDER_VALIDATION_PREPARATION_V1_REPORT.md",
    );
    const scorecard = buildComparisonScorecard();
    const artifacts: Record<string, unknown> = {
      "candidate-selection.json": {
        status: snap.selection_status,
        candidate: snap.candidate,
        founder_action: snap.founder_action,
      },
      "frozen-input-contract.json": snap.package,
      "mock-baseline-flow.json": {
        baseline: snap.mock_baseline
          ? {
              baseline_id: snap.mock_baseline.baseline_id,
              validation_id: snap.mock_baseline.validation_id,
              cost_usd: 0,
              same_input_checksum: snap.package?.input_checksum ?? null,
              publication_candidate_created: false,
            }
          : null,
        status: snap.mock_baseline ? "COMPLETED" : "SKIPPED_BLOCKED",
      },
      "comparison-scorecard.json": scorecard,
      "budget-configuration-contract.json": buildBudgetConfigurationContract(),
      "founder-authorization-contract.json":
        snap.readiness.founder_authorization ??
        buildFounderAuthorizationContract(snap.package?.validation_id ?? null),
      "real-provider-readiness.json": snap.readiness,
      "dashboard-map.json": {
        route: "provider-validation",
        read_only: true,
        run_real_provider_control: false,
        warnings: [
          "LIVE OFF",
          "dry_run",
          "OpenAI disabled",
          "no real-provider request executed",
          "no automatic publication",
        ],
      },
      "security-review.json": {
        no_sdk: true,
        no_external_api: true,
        localhost_dashboard: true,
        no_caddy_dns: true,
        telegram_unchanged: true,
      },
      "readiness.json": {
        generated_at: new Date().toISOString(),
        agent: "134",
        status: "ready",
        preparation_ready: true,
        real_provider_status: "blocked_until_configuration",
        selection_status: snap.selection_status,
      },
    };

    const summary = [
      `# Real-Provider Validation Preparation V1`,
      ``,
      `Agent #134 — preparation only.`,
      ``,
      `- Resume template selection: ${snap.selection_status}`,
      `- Mock baseline: ${snap.mock_baseline ? "COMPLETED" : "SKIPPED"}`,
      `- Real provider readiness: ${snap.readiness.state}`,
      `- Comparison dimensions: ${snap.comparison_dimensions_count}`,
      `- No OpenAI SDK · No external API · LIVE OFF · dry_run · no publication`,
      ``,
    ].join("\n");

    this.reporter.writeReportFiles(v1, artifacts, summary);

    writeFileSync(
      formal,
      [
        `# AIOS Real-Provider Validation Preparation V1 Report`,
        ``,
        `**Agent:** #134`,
        `**Status:** preparation ready · real provider blocked until configuration`,
        ``,
        `| Item | Value |`,
        `|------|-------|`,
        `| Resume template selection | ${snap.selection_status} |`,
        `| Founder action | ${snap.founder_action ?? "—"} |`,
        `| Mock baseline | ${snap.mock_baseline ? snap.mock_baseline.baseline_id : "skipped"} |`,
        `| Readiness | ${snap.readiness.state} |`,
        `| Missing | ${snap.readiness.missing_configuration.join(", ") || "—"} |`,
        ``,
        `## Hard constraints`,
        ``,
        `- No OpenAI SDK installed`,
        `- No external API call`,
        `- LIVE OFF · dry_run · OpenAI disabled · Local disabled`,
        `- Publication impossible`,
        `- No automatic READY_FOR_ONE_TEST`,
        ``,
        `## Next`,
        ``,
        `Agent #135 — Founder budget/credential configuration + one-time authorization UX (still no LIVE/publish).`,
        ``,
      ].join("\n"),
    );
  }
}

export function createProviderValidationManager(): ProviderValidationManager {
  return new ProviderValidationManager();
}

// re-export helpers used by verify
export {
  validateBudgetEnv,
  authorizationPermitsOneRequest,
  buildFounderAuthorizationContract,
  buildBudgetConfigurationContract,
};
