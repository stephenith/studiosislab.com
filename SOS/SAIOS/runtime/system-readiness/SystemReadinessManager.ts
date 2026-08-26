/**
 * SystemReadinessManager — governance spine freeze certificate (Agent #171).
 * Read-only certification. Never executes.
 */
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { MissionRegistry } from "../../core/company-brain/MissionRegistry.js";
import { canTransition } from "../../core/company-brain/MissionValidator.js";
import type {
  MissionContract,
  MissionLifecycleStatus,
} from "../../core/company-brain/mission-types.js";
import { QueueSubmissionRepository } from "../../core/company-brain/QueueSubmissionRepository.js";
import { ShadowQueueRepository } from "../queue/ShadowQueueRepository.js";
import { RuntimePlanRepository } from "../planner/RuntimePlanRepository.js";
import { RuntimeReleaseRepository } from "../runtime-release/RuntimeReleaseRepository.js";
import { SystemReadinessRepository } from "./SystemReadinessRepository.js";
import { SystemReadinessReporter } from "./SystemReadinessReporter.js";
import {
  createSystemReadinessCertificate,
  SAFETY_FLAGS_LOCKED,
} from "./SystemReadinessCertificate.js";
import {
  listPresentReports,
  validateSystemReadiness,
} from "./SystemReadinessValidator.js";
import type {
  SystemReadinessHealth,
  SystemReadinessResult,
  SystemReadinessSnapshot,
  VerificationSummary,
} from "./system-readiness-types.js";
import {
  ARCHITECTURE_VERSION,
  GOVERNANCE_VERSION,
} from "./system-readiness-types.js";

function resolveRepoRoot(fromDir = import.meta.dirname): string {
  return resolve(fromDir, "../../../..");
}

export class SystemReadinessManager {
  readonly registry: MissionRegistry;
  readonly reporter: SystemReadinessReporter;
  readonly root: string;

  constructor(repoRoot?: string) {
    this.root = repoRoot ?? resolveRepoRoot();
    this.registry = new MissionRegistry(this.root);
    this.reporter = new SystemReadinessReporter();
  }

  private repo(fixture?: boolean): SystemReadinessRepository {
    return new SystemReadinessRepository(this.root, {
      fixture: Boolean(fixture),
    });
  }

  getForMission(missionId: string, fixture?: boolean) {
    const fromFixture = this.repo(true).getForMission(missionId);
    if (fixture) return fromFixture;
    return this.repo(false).getForMission(missionId) ?? fromFixture;
  }

  /**
   * Issue immutable readiness certificate for RUNTIME_RELEASE_APPROVED missions.
   */
  certify(
    missionId: string,
    opts?: {
      fixture?: boolean;
      verification_summary?: Partial<VerificationSummary>;
    },
  ): SystemReadinessResult {
    if (process.env.SOS_AIOS_LIVE === "1") {
      return fail("LIVE must be OFF", "LIVE_ON");
    }

    const fixture = Boolean(opts?.fixture);
    const store = this.repo(fixture);
    const mission = this.registry.get(missionId);
    const plan = new RuntimePlanRepository(this.root, {
      fixture,
    }).getForMission(missionId);
    const shadow = new ShadowQueueRepository(this.root, {
      fixture,
    }).getForMission(missionId);
    const submission = new QueueSubmissionRepository(this.root, {
      fixture,
    }).getForMission(missionId);
    const releases = new RuntimeReleaseRepository(this.root, { fixture })
      .listDecisions()
      .filter(
        (d) =>
          d.mission_id === missionId &&
          d.decision === "APPROVED" &&
          d.status === "CONSUMED",
      );
    const release = releases.length ? releases[releases.length - 1]! : null;

    const already =
      plan != null &&
      store.hasCertificate(missionId, plan.plan_checksum);

    if (already) {
      const existing = store.getForMission(missionId);
      return {
        ok: true,
        certificate: existing,
        mission_status: mission?.status ?? existing?.certificate_status ?? null,
        next_safe_action:
          existing?.next_safe_action ??
          "Certificate already issued · STOP — execution remains impossible",
        artifact_paths: [],
        duplicate: true,
      };
    }

    const validation = validateSystemReadiness(
      mission,
      plan,
      release,
      shadow,
      submission,
      this.root,
      { already_certified: already },
    );

    const verification_summary: VerificationSummary = {
      company_brain: opts?.verification_summary?.company_brain ?? true,
      mission_approval: opts?.verification_summary?.mission_approval ?? true,
      queue_admission: opts?.verification_summary?.queue_admission ?? true,
      execution_package: opts?.verification_summary?.execution_package ?? true,
      execution_package_ack:
        opts?.verification_summary?.execution_package_ack ?? true,
      queue_submission: opts?.verification_summary?.queue_submission ?? true,
      shadow_queue: opts?.verification_summary?.shadow_queue ?? true,
      runtime_plan: opts?.verification_summary?.runtime_plan ?? true,
      runtime_release: opts?.verification_summary?.runtime_release ?? true,
      overall: "PASS",
    };
    const verifyFail = Object.entries(verification_summary)
      .filter(([k, v]) => k !== "overall" && v !== true)
      .map(([k]) => k);
    if (verifyFail.length) {
      verification_summary.overall = "FAIL";
    }

    const reports_present = listPresentReports(this.root);
    const scoreBase = validation.timeline.filter((t) => t.satisfied).length;
    const scoreMax = validation.timeline.length;
    let readiness_score = Math.round((scoreBase / scoreMax) * 100);
    if (verification_summary.overall !== "PASS") {
      readiness_score = Math.min(readiness_score, 70);
    }
    if (!validation.ok) {
      readiness_score = Math.min(readiness_score, 60);
    }

    const certificate_status =
      validation.ok && verification_summary.overall === "PASS"
        ? "SYSTEM_READY"
        : "SYSTEM_BLOCKED";

    if (!plan || !release || !shadow) {
      const first = validation.errors[0];
      // Still emit blocked certificate for inspectability when mission exists
      if (!mission) {
        return fail(
          first?.message ?? "Cannot certify",
          first?.code ?? "CERTIFY_FAILED",
        );
      }
    }

    const cert = createSystemReadinessCertificate({
      mission_id: mission!.mission_id,
      mission_version: mission!.mission_version,
      runtime_plan_id: plan?.runtime_plan_id ?? "",
      runtime_release_id: release?.release_id ?? "",
      shadow_queue_id: shadow?.shadow_queue_id ?? "",
      submission_id: submission?.submission_id ?? plan?.submission_id ?? "",
      checksum_chain: {
        execution_package_checksum:
          plan?.execution_package_checksum ??
          shadow?.execution_package_checksum ??
          "",
        acknowledgement_checksum:
          plan?.acknowledgement_checksum ??
          shadow?.acknowledgement_checksum ??
          "",
        submission_checksum:
          plan?.submission_checksum ??
          shadow?.submission_checksum ??
          submission?.submission_checksum ??
          "",
        shadow_submission_checksum: shadow?.submission_checksum ?? "",
        plan_checksum: plan?.plan_checksum ?? "",
        release_plan_checksum: release?.plan_checksum ?? "",
      },
      current_lifecycle: mission!.status,
      certificate_status,
      lifecycle_timeline: validation.timeline,
      verification_summary,
      reports_present,
      blockers: validation.blockers,
      readiness_score,
      fixture,
    });

    const paths = store.save(cert);
    const now = new Date().toISOString();
    store.appendEvent({
      event_id: `srevt-${randomUUID().slice(0, 8)}`,
      event_type:
        certificate_status === "SYSTEM_READY"
          ? "CERTIFICATE_ISSUED"
          : "CERTIFICATE_BLOCKED",
      at: now,
      mission_id: mission!.mission_id,
      certificate_id: cert.certificate_id,
      summary: `${certificate_status} · score ${readiness_score}`,
      fixture,
    });

    let mission_status: string = mission!.status;
    if (
      certificate_status === "SYSTEM_READY" &&
      mission!.status === "RUNTIME_RELEASE_APPROVED" &&
      canTransition(mission!.status, "SYSTEM_READY")
    ) {
      const updated = this.applyStatus(mission!, "SYSTEM_READY", fixture);
      mission_status = updated.status;
      store.appendEvent({
        event_id: `srevt-${randomUUID().slice(0, 8)}`,
        event_type: "MISSION_STATUS_UPDATED",
        at: now,
        mission_id: updated.mission_id,
        certificate_id: cert.certificate_id,
        summary: "RUNTIME_RELEASE_APPROVED → SYSTEM_READY",
        fixture,
      });
      store.appendHistory({
        at: now,
        mission_id: updated.mission_id,
        certificate_id: cert.certificate_id,
        from_status: "RUNTIME_RELEASE_APPROVED",
        to_status: "SYSTEM_READY",
        note: "System readiness freeze certified",
        fixture,
      });
    } else if (
      certificate_status === "SYSTEM_BLOCKED" &&
      mission!.status === "RUNTIME_RELEASE_APPROVED" &&
      canTransition(mission!.status, "SYSTEM_BLOCKED")
    ) {
      const updated = this.applyStatus(mission!, "SYSTEM_BLOCKED", fixture);
      mission_status = updated.status;
      store.appendEvent({
        event_id: `srevt-${randomUUID().slice(0, 8)}`,
        event_type: "MISSION_STATUS_UPDATED",
        at: now,
        mission_id: updated.mission_id,
        certificate_id: cert.certificate_id,
        summary: "RUNTIME_RELEASE_APPROVED → SYSTEM_BLOCKED",
        fixture,
      });
    }

    this.refreshSnapshots(fixture);
    this.reporter.writeMarkdown(store);

    if (
      cert.safety_flags.execution_allowed !== false ||
      cert.safety_flags.live_enabled !== false
    ) {
      throw new Error("Safety invariant violated");
    }

    return {
      ok: certificate_status === "SYSTEM_READY",
      certificate: cert,
      mission_status,
      next_safe_action: cert.next_safe_action,
      artifact_paths: paths,
      error:
        certificate_status === "SYSTEM_BLOCKED"
          ? validation.errors[0]?.message ?? "System blocked"
          : undefined,
      error_code:
        certificate_status === "SYSTEM_BLOCKED"
          ? validation.errors[0]?.code ?? "SYSTEM_BLOCKED"
          : undefined,
    };
  }

  private applyStatus(
    mission: MissionContract,
    status: MissionLifecycleStatus,
    fixture?: boolean,
  ): MissionContract {
    const updated: MissionContract = {
      ...mission,
      status,
      current_stage: status,
      updated_at: new Date().toISOString(),
      execution_allowed: false,
      queue_admission_allowed: false,
      publishing_allowed: false,
      founder_approval_required: true,
      planning_notes: [
        ...mission.planning_notes,
        `System readiness → ${status} (Agent #171; freeze — no execution)`,
      ],
      fixture: fixture ?? mission.fixture,
    };
    this.registry.save(updated, { set_current: !fixture });
    return updated;
  }

  refreshSnapshots(fixture?: boolean): void {
    const repo = this.repo(fixture);
    const certs = repo.list();
    const latest = certs.length ? certs[certs.length - 1]! : null;
    const ready = certs.filter((c) => c.certificate_status === "SYSTEM_READY");
    const blocked = certs.filter(
      (c) => c.certificate_status === "SYSTEM_BLOCKED",
    );

    const snapshot: SystemReadinessSnapshot = {
      schema_version: "system-readiness-snapshot-1.0.0",
      updated_at: new Date().toISOString(),
      mission_id: latest?.mission_id ?? null,
      certificate_id: latest?.certificate_id ?? null,
      certificate_status: latest?.certificate_status ?? "EMPTY",
      readiness_score: latest?.readiness_score ?? null,
      architecture_version: ARCHITECTURE_VERSION,
      governance_version: GOVERNANCE_VERSION,
      safety_flags: SAFETY_FLAGS_LOCKED,
      next_safe_action: latest?.next_safe_action ?? null,
    };
    repo.writeLatest(snapshot);

    const health: SystemReadinessHealth = {
      schema_version: "system-readiness-health-1.0.0",
      updated_at: new Date().toISOString(),
      certificate_count: certs.length,
      ready_count: ready.length,
      blocked_count: blocked.length,
      safety_flags: SAFETY_FLAGS_LOCKED,
      live: false,
      mode: "readiness_freeze_only",
      status: certs.length ? "healthy" : "idle",
    };
    repo.writeHealth(health);
  }
}

function fail(
  error: string,
  error_code: string,
  mission_status: string | null = null,
): SystemReadinessResult {
  return {
    ok: false,
    certificate: null,
    mission_status,
    next_safe_action: null,
    artifact_paths: [],
    error,
    error_code,
  };
}

export function createSystemReadinessManager(
  repoRoot?: string,
): SystemReadinessManager {
  return new SystemReadinessManager(repoRoot);
}
