/**
 * ActivationGate — sole eligibility authority (Agent #185).
 * Computes ACTIVATION_ELIGIBLE | ACTIVATION_BLOCKED. Never executes.
 *
 * References Phase 3 / governance modules by ID metadata only.
 * Does not import or modify Execution Controller, Department SDK,
 * Worker Runtime, Cost Ledger, Telemetry, or Company Brain.
 */
import { resolve } from "node:path";
import { ActivationRepository } from "./ActivationRepository.js";
import { ActivationReporter } from "./ActivationReporter.js";
import {
  ACTIVATION_CHECKLIST_CATALOGUE,
  buildChecklistItem,
} from "./ActivationChecklist.js";
import {
  computeActivationScorecard,
  decideActivationOutcome,
  deriveBlockingItems,
  deriveRecommendations,
  deriveWarnings,
} from "./ActivationPolicy.js";
import { createActivationEligibility } from "./ActivationEligibility.js";
import { createActivationCertificate } from "./ActivationCertificate.js";
import type {
  ActivationCertificateContract,
  ActivationCheckResultStatus,
  ActivationEligibilityContract,
  ActivationSummary,
} from "./ActivationGateTypes.js";
import { ACTIVATION_GATE_SAFETY_FLAGS } from "./ActivationGateTypes.js";

function resolveRepoRoot(fromDir = import.meta.dirname): string {
  return resolve(fromDir, "../../../..");
}

export type ActivationEvaluateInput = {
  mission_id: string;
  controller_id?: string | null;
  /** Optional overrides for check statuses (fixture / tests). */
  check_overrides?: Partial<
    Record<string, { status: ActivationCheckResultStatus; detail?: string }>
  >;
  /** When true, treat architecture/refs as declared present (scaffold). */
  declare_spine_refs?: boolean;
  fixture?: boolean;
  notes?: string[];
};

function defaultStatusFor(
  checkId: string,
  opts: ActivationEvaluateInput,
): { status: ActivationCheckResultStatus; detail: string } {
  const liveOff = process.env.SOS_AIOS_LIVE !== "1";
  if (checkId === "live_disabled") {
    return liveOff
      ? { status: "pass", detail: "SOS_AIOS_LIVE is not 1 · LIVE OFF" }
      : { status: "fail", detail: "LIVE is ON — activation blocked" };
  }

  const placeholders = new Set([
    "provider_registry_validated",
    "execution_authorization_present",
    "founder_approval_present",
  ]);
  if (placeholders.has(checkId)) {
    return {
      status: "placeholder",
      detail: "Placeholder check — not satisfied in V1 scaffold",
    };
  }

  if (opts.declare_spine_refs) {
    return {
      status: "pass",
      detail: "Spine reference declared present (metadata only · not executed)",
    };
  }

  if (
    checkId === "architecture_versions_match" ||
    checkId === "checksum_chain_valid"
  ) {
    return {
      status: "pass",
      detail: "Contract schema versions declared · checksum helpers present",
    };
  }

  return {
    status: "fail",
    detail:
      "Referenced module not wired into Activation Gate evaluation (reference-only V1)",
  };
}

export class ActivationGate {
  readonly repository: ActivationRepository;
  readonly reporter: ActivationReporter;
  readonly root: string;
  private seeded = false;

  constructor(repoRoot?: string, opts?: { fixture?: boolean }) {
    this.root = repoRoot ?? resolveRepoRoot();
    this.repository = new ActivationRepository(this.root, opts);
    this.reporter = new ActivationReporter();
  }

  /**
   * Compute eligibility for a mission. Does not enable execution.
   */
  evaluate(
    input: ActivationEvaluateInput,
  ): {
    ok: boolean;
    eligibility?: ActivationEligibilityContract;
    certificate?: ActivationCertificateContract;
    error?: string;
  } {
    if (process.env.SOS_AIOS_LIVE === "1") {
      return { ok: false, error: "LIVE must be OFF" };
    }
    if (!input.mission_id?.trim()) {
      return { ok: false, error: "mission_id required" };
    }

    const checklist = ACTIVATION_CHECKLIST_CATALOGUE.map((def) => {
      const override = input.check_overrides?.[def.check_id];
      const base = defaultStatusFor(def.check_id, input);
      const status = override?.status ?? base.status;
      const detail = override?.detail ?? base.detail;
      return buildChecklistItem(def, status, detail);
    });

    const score = computeActivationScorecard(checklist);
    const blocking_items = deriveBlockingItems(checklist);
    const warnings = deriveWarnings(checklist);
    const recommendations = deriveRecommendations(checklist);
    const outcome = decideActivationOutcome(checklist);

    const eligibility = createActivationEligibility({
      mission_id: input.mission_id,
      controller_id: input.controller_id ?? "execution-controller-ref",
      checklist,
      score,
      blocking_items,
      warnings,
      recommendations,
      status: outcome,
      outcome,
      fixture: input.fixture ?? this.repository.fixture,
      notes: [
        ...(input.notes ?? []),
        "Activation Gate evaluates eligibility only.",
        "No safety flag may change as a result of evaluation.",
        `activation_enables_execution=${ACTIVATION_GATE_SAFETY_FLAGS.activation_enables_execution}`,
      ],
    });

    const reg = this.repository.register(eligibility);
    if (!reg.ok) return { ok: false, error: reg.error };

    const certificate = createActivationCertificate({
      activation_id: eligibility.activation_id,
      mission_id: eligibility.mission_id,
      overall_score: score.overall,
      all_checks: checklist,
      status: outcome,
      fixture: eligibility.fixture,
    });
    const cr = this.repository.registerCertificate(certificate);
    if (!cr.ok) return { ok: false, error: cr.error };

    this.repository.advance(eligibility.activation_id, "STOP");
    const frozen = this.repository.find(eligibility.activation_id)!;

    this.reporter.writeMarkdown(this.repository);
    return { ok: true, eligibility: frozen, certificate };
  }

  ensureBootstrapped(): void {
    if (this.seeded) return;
    this.repository.loadPersisted();
    if (this.repository.listActivations().length === 0) {
      this.evaluate({
        mission_id: "mission-placeholder",
        controller_id: "execution-controller-ref",
        declare_spine_refs: false,
        fixture: this.repository.fixture,
        notes: ["Bootstrap seed — expected ACTIVATION_BLOCKED"],
      });
    } else {
      this.repository.persist();
    }
    this.seeded = true;
  }

  list(): ActivationSummary[] {
    this.ensureBootstrapped();
    return this.repository.listActivations();
  }

  loadByMission(missionId: string): ActivationEligibilityContract | null {
    this.ensureBootstrapped();
    return this.repository.findByMission(missionId);
  }

  loadCertificateByMission(
    missionId: string,
  ): ActivationCertificateContract | null {
    this.ensureBootstrapped();
    return this.repository.findCertificateByMission(missionId);
  }
}

export function createActivationGate(
  repoRoot?: string,
  opts?: { fixture?: boolean },
): ActivationGate {
  return new ActivationGate(repoRoot, opts);
}
