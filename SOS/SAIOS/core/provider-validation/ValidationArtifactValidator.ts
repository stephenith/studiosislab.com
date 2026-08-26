/**
 * ValidationArtifactValidator + ValidationReporter + persistence helpers.
 */
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import type {
  MockBaselineResult,
  ProviderValidationSnapshot,
  ValidationCandidate,
  ValidationEventType,
  ValidationInputPackage,
} from "./types.js";
import type { RealProviderReadiness } from "./types.js";

function atomicWrite(path: string, data: unknown): void {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`);
  renameSync(tmp, path);
}

export class ValidationArtifactValidator {
  validatePackage(pkg: ValidationInputPackage): { ok: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!pkg.validation_id) errors.push("validation_id required");
    if (!pkg.input_checksum || pkg.input_checksum.length < 32) {
      errors.push("input_checksum required");
    }
    if (pkg.provider_prompt_locked !== true) {
      errors.push("provider_prompt_locked must be true");
    }
    if (pkg.publication_allowed !== false) errors.push("publication must be false");
    if (pkg.dry_run !== true) errors.push("dry_run must be true");
    if (pkg.token_ceilings_placeholder.max_input_tokens !== null) {
      errors.push("token ceilings must remain placeholder null until founder config");
    }
    if (pkg.cost_ceiling_placeholder.max_cost_usd !== null) {
      errors.push("cost ceiling must remain placeholder null until founder config");
    }
    return { ok: errors.length === 0, errors };
  }

  validateBaseline(
    baseline: MockBaselineResult,
    pkg: ValidationInputPackage,
  ): { ok: boolean; errors: string[] } {
    const errors: string[] = [];
    if (baseline.validation_id !== pkg.validation_id) {
      errors.push("baseline validation_id mismatch");
    }
    if (baseline.provider !== "mock") errors.push("baseline must use mock");
    if (baseline.cost_usd !== 0) errors.push("mock cost must be 0");
    if (baseline.publication_candidate_created !== false) {
      errors.push("must not create publication candidate");
    }
    return { ok: errors.length === 0, errors };
  }
}

export class ValidationStore {
  readonly dir: string;

  constructor(repoRoot = resolve(import.meta.dirname, "../../../..")) {
    this.dir = join(repoRoot, "SOS/07_LOGS/saios/provider-validation");
    mkdirSync(this.dir, { recursive: true });
  }

  append(file: string, row: unknown): void {
    appendFileSync(join(this.dir, file), `${JSON.stringify(row)}\n`);
  }

  appendEvent(
    type: ValidationEventType,
    summary: string,
    extra: Record<string, unknown> = {},
  ): void {
    this.append("validation-events.jsonl", {
      at: new Date().toISOString(),
      type,
      summary,
      ...extra,
    });
  }

  writeSnapshots(input: {
    candidate: ValidationCandidate | null;
    selection_status: string;
    founder_action: string | null;
    pkg: ValidationInputPackage | null;
    baseline: MockBaselineResult | null;
    readiness: RealProviderReadiness;
    comparison_contract: unknown;
  }): void {
    atomicWrite(join(this.dir, "selected-candidate.json"), {
      updated_at: new Date().toISOString(),
      selection_status: input.selection_status,
      founder_action: input.founder_action,
      candidate: input.candidate,
    });
    atomicWrite(join(this.dir, "current-validation-package.json"), {
      updated_at: new Date().toISOString(),
      package: input.pkg,
    });
    atomicWrite(join(this.dir, "mock-baseline-summary.json"), {
      updated_at: new Date().toISOString(),
      baseline: input.baseline
        ? {
            baseline_id: input.baseline.baseline_id,
            validation_id: input.baseline.validation_id,
            provider: input.baseline.provider,
            cost_usd: input.baseline.cost_usd,
            estimated_tokens: input.baseline.estimated_tokens,
            deterministic_checksum: input.baseline.deterministic_checksum,
            publication_candidate_created:
              input.baseline.publication_candidate_created,
          }
        : null,
    });
    atomicWrite(join(this.dir, "real-provider-readiness.json"), input.readiness);
    atomicWrite(join(this.dir, "comparison-contract.json"), input.comparison_contract);
    atomicWrite(join(this.dir, "provider-validation-health.json"), {
      updated_at: new Date().toISOString(),
      selection_status: input.selection_status,
      readiness_state: input.readiness.state,
      live: false,
      dry_run: true,
      openai_disabled: true,
      publication_allowed: false,
      real_provider_request_executed: false,
    });
  }
}

export class ValidationReporter {
  writeMarkdown(snap: ProviderValidationSnapshot): string {
    return [
      `# Provider Validation Preparation`,
      ``,
      `Selection: **${snap.selection_status}**`,
      `Readiness: **${snap.readiness.state}**`,
      `Founder action: ${snap.founder_action ?? "—"}`,
      `Mock baseline: ${snap.mock_baseline ? snap.mock_baseline.baseline_id : "not run"}`,
      ``,
      `LIVE OFF · dry_run · OpenAI disabled · no real-provider request · no publication`,
      ``,
    ].join("\n");
  }

  writeReportFiles(
    v1Dir: string,
    artifacts: Record<string, unknown>,
    summaryMd: string,
  ): void {
    mkdirSync(v1Dir, { recursive: true });
    for (const [name, data] of Object.entries(artifacts)) {
      writeFileSync(join(v1Dir, name), `${JSON.stringify(data, null, 2)}\n`);
    }
    writeFileSync(join(v1Dir, "implementation-summary.md"), summaryMd);
  }
}

export function loadSnapshotFromStore(
  repoRoot = resolve(import.meta.dirname, "../../../.."),
): Partial<ProviderValidationSnapshot> | null {
  const dir = join(repoRoot, "SOS/07_LOGS/saios/provider-validation");
  const health = join(dir, "provider-validation-health.json");
  if (!existsSync(health)) return null;
  const selected = JSON.parse(
    readFileSync(join(dir, "selected-candidate.json"), "utf8"),
  );
  const readiness = JSON.parse(
    readFileSync(join(dir, "real-provider-readiness.json"), "utf8"),
  );
  const pkgWrap = JSON.parse(
    readFileSync(join(dir, "current-validation-package.json"), "utf8"),
  );
  const baseWrap = JSON.parse(
    readFileSync(join(dir, "mock-baseline-summary.json"), "utf8"),
  );
  return {
    generated_at: new Date().toISOString(),
    selection_status: selected.selection_status,
    candidate: selected.candidate,
    founder_action: selected.founder_action,
    package: pkgWrap.package,
    mock_baseline: baseWrap.baseline,
    readiness,
    real_provider_request_executed: false,
    live: false,
    dry_run: true,
    openai_disabled: true,
    publication_allowed: false,
  };
}
