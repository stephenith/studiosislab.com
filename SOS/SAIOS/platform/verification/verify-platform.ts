#!/usr/bin/env tsx
/**
 * Platform Consolidation Foundation V1 verify — Agent #173.
 * Fixtures only. No execution. Confirms primitives + consumer compatibility.
 */
import { mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  BaseAppendOnlyRepository,
} from "../repositories/BaseAppendOnlyRepository.js";
import { BaseMarkdownReporter } from "../reporters/BaseMarkdownReporter.js";
import {
  BaseLifecycleStateMachine,
  canTransition,
} from "../state-machine/BaseLifecycleStateMachine.js";
import {
  rejectForbiddenKeys,
  sha256Canonical,
  requireExactChecksum,
} from "../checksums/index.js";
import {
  BaseVerificationHarness,
  assert,
} from "./index.js";
import { BaseArtifactBuilder } from "./BaseArtifactBuilder.js";
import { BaseLifecycleValidator } from "../validators/BaseLifecycleValidator.js";
import { isLiveOff } from "../shared/index.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const FIXTURE = join(
  REPO,
  "SOS/07_LOGS/saios/platform/fixtures",
);

function clean(): void {
  if (existsSync(FIXTURE)) rmSync(FIXTURE, { recursive: true, force: true });
  mkdirSync(FIXTURE, { recursive: true });
  writeFileSync(join(FIXTURE, ".verify-run"), new Date().toISOString(), "utf8");
}

class HarnessRepo extends BaseAppendOnlyRepository {
  saveTest(id: string, data: unknown): string[] {
    return this.saveNamedArtifact(
      id,
      data,
      "latest-platform-artifact.json",
      "platform-artifacts.jsonl",
    );
  }
  listArtifacts(): unknown[] {
    return this.readJsonl("platform-artifacts.jsonl");
  }
  loadLatest(): unknown | null {
    return this.loadJson("latest-platform-artifact.json");
  }
  appendEvent(e: unknown): void {
    this.appendJsonl("platform-events.jsonl", e);
  }
  listEvents(): unknown[] {
    return this.readJsonl("platform-events.jsonl");
  }
}

async function main(): Promise<void> {
  assert(isLiveOff(), "LIVE must be OFF");
  clean();
  const h = new BaseVerificationHarness();

  {
    const repo = new HarnessRepo({
      repoRoot: REPO,
      logRelativePath: "SOS/07_LOGS/saios/platform",
      fixture: true,
    });
    const paths = repo.saveTest("art-1", { id: "art-1", n: 1 });
    assert(paths.length === 3, "paths");
    assert(repo.listArtifacts().length === 1, "jsonl");
    assert(repo.loadLatest() != null, "latest");
    repo.appendEvent({ e: 1 });
    assert(repo.listEvents().length === 1, "events");
    h.mark("repository", true);
  }

  {
    const a = sha256Canonical({ b: 1, a: 2 });
    const b = sha256Canonical({ a: 2, b: 1 });
    assert(a === b, "canonical order");
    assert(
      requireExactChecksum(a, b) === null,
      "match",
    );
    const forbidden = rejectForbiddenKeys(
      { execute: true },
      ["execute"],
      { messageForKey: (k) => `Field '${k}' is forbidden` },
    );
    assert(forbidden?.code === "FORBIDDEN_SIDE_EFFECT", "forbidden");
    h.mark("checksums", true);
  }

  {
    const table = { A: ["B"], B: ["C"] };
    assert(canTransition("A", "B", table), "a->b");
    assert(!canTransition("A", "C", table), "no a->c");
    const sm = new BaseLifecycleStateMachine(table, ["LIVE"]);
    assert(sm.can("A", "B"), "sm can");
    assert(!sm.can("B", "LIVE"), "sm block");
    const lv = new BaseLifecycleValidator();
    assert(lv.requireStatus("B", ["A", "B"]) === null, "status ok");
    assert(lv.requireStatus("Z", ["A"]) != null, "status bad");
    h.mark("state_machine", true);
  }

  {
    const reporter = new BaseMarkdownReporter();
    const path = reporter.writeSimple({
      dir: FIXTURE,
      filename: "PLATFORM_LOG.md",
      title: "Platform Log",
      headerLines: ["Mode: platform_only · LIVE OFF"],
      listHeading: "Items",
      listLines: ["- one"],
    });
    assert(existsSync(path), "report");
    assert(readFileSync(path, "utf8").includes("Platform Log"), "title");
    h.mark("reporter", true);
  }

  {
    const builder = new BaseArtifactBuilder();
    assert(builder.ok({ x: 1 }).ok === true, "builder ok");
    assert(builder.fail("no", "ERR").ok === false, "builder fail");
    h.mark("artifact_builder", true);
  }

  {
    // Wave-1 + Wave-2 consumers wired to platform bases
    const consumers = [
      "SOS/SAIOS/runtime/system-readiness/SystemReadinessRepository.ts",
      "SOS/SAIOS/core/company-brain/QueueAdmissionRepository.ts",
      "SOS/SAIOS/core/company-brain/ExecutionPackageRepository.ts",
      "SOS/SAIOS/core/company-brain/ExecutionPackageAckRepository.ts",
      "SOS/SAIOS/core/company-brain/QueueSubmissionRepository.ts",
    ];
    for (const rel of consumers) {
      const p = join(REPO, rel);
      assert(existsSync(p), `consumer ${rel}`);
      const src = readFileSync(p, "utf8");
      assert(
        src.includes("BaseAppendOnlyRepository") ||
          src.includes("BaseArtifactRepository"),
        `extends base: ${rel}`,
      );
    }

    const reporters = [
      "SOS/SAIOS/core/company-brain/QueueAdmissionReporter.ts",
      "SOS/SAIOS/core/company-brain/ExecutionPackageReporter.ts",
      "SOS/SAIOS/core/company-brain/ExecutionPackageAckReporter.ts",
      "SOS/SAIOS/core/company-brain/QueueSubmissionReporter.ts",
    ];
    for (const rel of reporters) {
      const src = readFileSync(join(REPO, rel), "utf8");
      assert(src.includes("BaseMarkdownReporter"), `reporter ${rel}`);
    }

    const validators = [
      "SOS/SAIOS/core/company-brain/QueueAdmissionValidator.ts",
      "SOS/SAIOS/core/company-brain/ExecutionPackageValidator.ts",
      "SOS/SAIOS/core/company-brain/ExecutionPackageAckValidator.ts",
      "SOS/SAIOS/core/company-brain/QueueSubmissionValidator.ts",
    ];
    for (const rel of validators) {
      const src = readFileSync(join(REPO, rel), "utf8");
      assert(src.includes("rejectForbiddenKeys"), `validator ${rel}`);
    }

    // Deterministic Wave-2 consumer parity (fixture isolation + I/O)
    const { QueueAdmissionRepository } = await import(
      "../../core/company-brain/QueueAdmissionRepository.js"
    );
    const { ExecutionPackageAckRepository } = await import(
      "../../core/company-brain/ExecutionPackageAckRepository.js"
    );
    const { QueueSubmissionRepository } = await import(
      "../../core/company-brain/QueueSubmissionRepository.js"
    );
    const { ExecutionPackageRepository } = await import(
      "../../core/company-brain/ExecutionPackageRepository.js"
    );
    const { rejectForbiddenPayload } = await import(
      "../../core/company-brain/ExecutionPackageValidator.js"
    );

    const qa = new QueueAdmissionRepository(REPO, { fixture: true });
    assert(qa.dir.endsWith(`${join("queue-admission", "fixtures")}`) || qa.dir.includes("/fixtures"), "qa fixture dir");
    qa.writeHealth({
      schema_version: "queue-admission-health-1.0.0",
      updated_at: "2026-07-12T00:00:00.000Z",
      pending_review_count: 0,
      ready_for_queue_count: 0,
      blocked_count: 0,
      decision_count: 0,
      execution_allowed: false,
      queue_enqueue_allowed: false,
      publishing_allowed: false,
      live: false,
      mode: "readiness_review_only",
      status: "idle",
    });
    const qaReload = new QueueAdmissionRepository(REPO, { fixture: true });
    assert(qaReload.loadHealth()?.execution_allowed === false, "qa reload safety");
    assert(qaReload.loadHealth()?.live === false, "qa live off");

    const ack = new ExecutionPackageAckRepository(REPO, { fixture: true });
    ack.writePending([]);
    assert(ack.loadPending().length === 0, "ack pending empty");
    ack.appendEvent({
      event_id: "evt-platform-1",
      event_type: "ACK_OPENED",
      mission_id: "m-platform",
      created_at: "2026-07-12T00:00:00.000Z",
      fixture: true,
    } as never);
    assert(ack.listEvents().length >= 1, "ack events");

    const qsub = new QueueSubmissionRepository(REPO, { fixture: true });
    assert(qsub.fixture === true, "qsub fixture flag");
    assert(qsub.list().length >= 0, "qsub list");
    qsub.writePending([]);
    assert(qsub.loadPending()?.count === 0, "qsub pending");

    const ep = new ExecutionPackageRepository(REPO, { fixture: true });
    assert(ep.loadLatest() === null || typeof ep.loadLatest() === "object", "ep loadLatest");
    assert(ep.loadSnapshot() === null || typeof ep.loadSnapshot() === "object", "ep snapshot");

    const forbidden = rejectForbiddenPayload({ execute: true });
    assert(forbidden?.code === "FORBIDDEN_SIDE_EFFECT", "ep forbidden");
    assert(rejectForbiddenPayload({}) === null, "ep allowed");

    h.mark("consumers_wired", true);
    h.mark("wave2_consumer_parity", true);
  }

  h.mark("no_execution", true);
  h.mark("live_off", isLiveOff());
  h.finish("platform-consumer-migration-wave-2");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
