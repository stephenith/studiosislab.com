/**
 * TelemetryRegistry — discovery/facade (Agent #183).
 * References XC / Worker Runtime / Cost Ledger only — does not modify them.
 */
import { resolve } from "node:path";
import { TelemetryRepository } from "./TelemetryRepository.js";
import { TelemetryReporter } from "./TelemetryReporter.js";
import { createTelemetrySession } from "./TelemetrySession.js";
import { createTelemetryTimeline } from "./TelemetryTimeline.js";
import { createTelemetryCorrelation } from "./TelemetryCorrelation.js";
import { createTelemetrySnapshot } from "./TelemetrySnapshot.js";
import { listEventCatalogue } from "./TelemetryEvent.js";
import type {
  TelemetryEventCatalogueEntry,
  TelemetrySessionSummary,
} from "./TelemetryTypes.js";

function resolveRepoRoot(fromDir = import.meta.dirname): string {
  return resolve(fromDir, "../../../..");
}

export class TelemetryRegistry {
  readonly repository: TelemetryRepository;
  readonly reporter: TelemetryReporter;
  readonly root: string;
  private seeded = false;

  constructor(repoRoot?: string, opts?: { fixture?: boolean }) {
    this.root = repoRoot ?? resolveRepoRoot();
    this.repository = new TelemetryRepository(this.root, opts);
    this.reporter = new TelemetryReporter();
  }

  bootstrapCatalog(): { ok: boolean; registered: string[]; errors: string[] } {
    if (process.env.SOS_AIOS_LIVE === "1") {
      return { ok: false, registered: [], errors: ["LIVE must be OFF"] };
    }
    this.repository.loadPersisted();
    const registered: string[] = [];
    const errors: string[] = [];

    if (this.repository.listSessions().length === 0) {
      const correlationId = `tcr-seed-${Date.now().toString(36)}`;
      const timelineId = `tlt-seed-${Date.now().toString(36)}`;
      const sessionId = `tel-seed-${Date.now().toString(36)}`;

      const correlation = createTelemetryCorrelation({
        correlation_id: correlationId,
        mission_id: "mission-placeholder",
        execution_controller_id: "execution-controller-ref",
        department_id: "resume",
        worker_runtime_id: "worker-runtime-ref",
        cost_session_id: "cost-session-ref-placeholder",
        runtime_plan_id: "runtime-plan-ref",
        telemetry_session_id: sessionId,
        fixture: this.repository.fixture,
      });
      const cr = this.repository.registerCorrelation(correlation);
      if (!cr.ok && cr.error) errors.push(cr.error);
      else registered.push(correlation.correlation_id);

      const timeline = createTelemetryTimeline({
        timeline_id: timelineId,
        telemetry_session_id: sessionId,
        fixture: this.repository.fixture,
      });
      const tr = this.repository.registerTimeline(timeline);
      if (!tr.ok && tr.error) errors.push(tr.error);
      else registered.push(timeline.timeline_id);

      const session = createTelemetrySession({
        telemetry_session_id: sessionId,
        mission_id: "mission-placeholder",
        execution_controller_id: "execution-controller-ref",
        department_id: "resume",
        worker_runtime_id: "worker-runtime-ref",
        cost_session_id: "cost-session-ref-placeholder",
        runtime_plan_id: "runtime-plan-ref",
        runtime_release_id: "runtime-release-ref",
        system_readiness_id: "system-readiness-ref",
        correlation_id: correlation.correlation_id,
        timeline_id: timeline.timeline_id,
        status: "CREATED",
        correlation_checksum: correlation.correlation_checksum,
        timeline_checksum: timeline.timeline_checksum,
        fixture: this.repository.fixture,
      });
      const sr = this.repository.registerSession(session);
      if (!sr.ok && sr.error) errors.push(sr.error);
      else registered.push(session.telemetry_session_id);

      const snap = createTelemetrySnapshot({
        session_id: session.telemetry_session_id,
        status: "CREATED",
        fixture: this.repository.fixture,
      });
      const snapR = this.repository.registerSnapshot(snap);
      if (!snapR.ok && snapR.error) errors.push(snapR.error);
      else registered.push(snap.snapshot_id);
    }

    this.reporter.writeMarkdown(this.repository);
    this.seeded = true;
    return { ok: errors.length === 0, registered, errors };
  }

  ensureBootstrapped(): void {
    if (this.seeded) return;
    this.repository.loadPersisted();
    if (this.repository.listSessions().length === 0) {
      this.bootstrapCatalog();
    } else {
      this.seeded = true;
      this.repository.persist();
    }
  }

  listSessions(): TelemetrySessionSummary[] {
    this.ensureBootstrapped();
    return this.repository.discover();
  }

  loadSession(id: string) {
    this.ensureBootstrapped();
    return this.repository.findSession(id);
  }

  listEvents(): TelemetryEventCatalogueEntry[] {
    return listEventCatalogue();
  }
}

export function createTelemetryRegistry(
  repoRoot?: string,
  opts?: { fixture?: boolean },
): TelemetryRegistry {
  return new TelemetryRegistry(repoRoot, opts);
}
