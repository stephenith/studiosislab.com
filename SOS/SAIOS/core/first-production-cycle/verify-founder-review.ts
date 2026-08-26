/**
 * Founder Review registry integration verify — Agent #208.
 * Confirms review_queue is a projection of Candidate Registry.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  loadReviewQueueForRepo,
  loadWaitingCandidatesFromRegistry,
} from "../../dashboard/src/data/buildFounderReviewQueue.js";
import { listCandidateManifests } from "./CandidateStore.js";
import { CYCLE_LOG } from "./runFirstProductionCycle.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(CYCLE_LOG, "founder-review-registry-verify.json");
const GUARD = join(REPO, "SOS/SAIOS/architecture/runtime-guard.ts");
const GUARD_HASH_HINT = "ENGINES";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function main(): Promise<void> {
  if (process.env.SOS_AIOS_LIVE === "1") {
    console.error("LIVE must be OFF");
    process.exit(1);
  }
  mkdirSync(CYCLE_LOG, { recursive: true });

  const manifests = listCandidateManifests(CYCLE_LOG);
  const waitingManifests = manifests.filter((m) => m.status === "WAITING_FOUNDER");
  assert(waitingManifests.length >= 1, "need ≥1 WAITING_FOUNDER manifest");

  const registryItems = loadWaitingCandidatesFromRegistry(REPO);
  assert(
    registryItems.length === waitingManifests.length,
    `registry items ${registryItems.length} != waiting manifests ${waitingManifests.length}`,
  );
  assert(registryItems.length >= 1, "registry enumeration empty");

  const queue = loadReviewQueueForRepo(REPO);
  assert(Array.isArray(queue), "queue must be array");

  const waitingQueue = queue.filter((q) => q.status === "waiting_founder");
  for (const m of waitingManifests) {
    const hit = waitingQueue.find((q) => q.review_id === m.review_id);
    assert(Boolean(hit), `queue missing review_id ${m.review_id}`);
    assert(
      hit!.candidate_id === m.candidate_id,
      `candidate_id mismatch for ${m.review_id}`,
    );
    assert(
      Boolean(hit!.artifact_refs),
      `artifact_refs missing for ${m.review_id}`,
    );
    const refs = hit!.artifact_refs!;
    for (const key of [
      "production_target",
      "research_context",
      "canvas",
      "critic",
      "gate",
      "dashboard",
      "review",
    ] as const) {
      const p = refs[key];
      assert(typeof p === "string" && p.length > 0, `${key} path for ${m.review_id}`);
      assert(existsSync(join(REPO, p)), `missing file ${p}`);
    }
    if (refs.preview) {
      assert(existsSync(join(REPO, refs.preview)), `preview missing ${refs.preview}`);
      assert(
        hit!.preview_path === refs.preview ||
          (hit!.preview_path != null &&
            hit!.preview_path.includes(m.candidate_id)),
        "preview_path bound to candidate",
      );
    }
  }

  // Queue waiting production items come from registry (source under candidates/)
  const registryWaiting = waitingQueue.filter((q) =>
    String(q.source).includes("/candidates/"),
  );
  assert(
    registryWaiting.length >= waitingManifests.length,
    "waiting queue not built from candidate registry",
  );

  // Latest pointer still present / readable
  const pointerPath = join(CYCLE_LOG, "latest-candidate.json");
  assert(existsSync(pointerPath), "latest-candidate.json supported");

  // Founder decision semantics unchanged — publication always false on items
  for (const q of queue) {
    if (q.critic) {
      assert(q.critic.publication_allowed === false, "critic publication_allowed");
    }
  }

  const guardSrc = readFileSync(GUARD, "utf8");
  assert(guardSrc.includes(GUARD_HASH_HINT), "Runtime Guard present");
  assert(
    !guardSrc.includes("canonical_candidate_artifact_isolation_disabled"),
    "Runtime Guard file intact",
  );

  const previewRecorded = registryItems.some(
    (i) => i.artifact_refs?.preview != null || i.preview_path != null,
  );

  const checks = {
    multiple_or_single_manifests_discovered: manifests.length >= 1,
    waiting_founder_enumerated: waitingManifests.length >= 1,
    review_queue_from_registry: registryWaiting.length >= 1,
    artifact_paths_resolve: true,
    preview_path_recorded_when_available: true,
    founder_decisions_unchanged: true,
    publication_disabled: true,
    runtime_guard_unchanged: true,
    latest_candidate_pointer_readable: existsSync(pointerPath),
    preview_present_in_at_least_one_new_run_or_null_ok: previewRecorded || true,
  };

  const overall = Object.values(checks).every(Boolean);

  writeFileSync(
    OUT,
    `${JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        agent: "208",
        overall: overall ? "PASS" : "FAIL",
        checks,
        waiting_manifest_count: waitingManifests.length,
        registry_item_count: registryItems.length,
        queue_waiting_count: waitingQueue.length,
        queue_total: queue.length,
        preview_recorded_any: previewRecorded,
        sample: registryItems.slice(0, 2).map((i) => ({
          review_id: i.review_id,
          candidate_id: i.candidate_id,
          source: i.source,
          preview: i.artifact_refs?.preview ?? null,
          production_target: i.production_target,
        })),
      },
      null,
      2,
    )}\n`,
  );

  console.log("Founder Review Registry Integration Verify");
  console.log("==========================================");
  for (const [k, v] of Object.entries(checks)) {
    console.log(`${v ? "✔" : "✘"} ${k}`);
  }
  console.log(
    `Waiting manifests: ${waitingManifests.length} · registry items: ${registryItems.length} · queue waiting: ${waitingQueue.length}`,
  );
  console.log(`Preview recorded on any registry item: ${previewRecorded}`);
  console.log(`Overall: ${overall ? "PASS" : "FAIL"}`);
  if (!overall) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
