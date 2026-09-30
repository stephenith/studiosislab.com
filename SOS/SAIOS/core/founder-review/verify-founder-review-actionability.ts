/**
 * Offline Founder Review identity + actionability proof.
 * Does not reconstruct the historical Founder click. Does not mutate
 * historical tasks or decisions.
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import {
  decisionAllowedForValidity,
  evaluateFounderDecisionActionability,
  identitiesBound,
  loadActionabilityOverlay,
  resolveFounderDecisionIdentity,
} from "./FounderReviewActionability.js";
import { loadFounderReviewProjection } from "./FounderReviewProjection.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-review/verify-founder-review-actionability.json",
);
const VIEW = join(REPO, "SOS/SAIOS/dashboard/src/views/FounderReviewView.tsx");
const SERVER = join(REPO, "SOS/SAIOS/dashboard/server.ts");
const OVERLAY = join(
  REPO,
  "SOS/SAIOS/core/founder-review/actionability-overlay.json",
);
const HISTORICAL_TASKS = [
  "revtask-863f67a5-790",
  "revtask-4a0c006c-507",
];
const HISTORICAL_DECISIONS = ["fd-ef2226ce-0da", "fd-87ecc16c-f45"];
const UI_DESIGNER =
  "cand-creative-ui-designer-20260915T122023Z-79af7d-revfb-f81691";
const MOTION_DESIGNER =
  "cand-creative-motion-designer-20260903T032047Z-bed721";

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function assert(ok: boolean, name: string, detail = ""): void {
  checks.push({ name, pass: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function writeManifest(
  root: string,
  id: string,
  status: string,
  opts?: { title?: string; created_at?: string },
): void {
  const dir = join(
    root,
    "SOS/07_LOGS/saios/first-production-cycle/candidates",
    id,
  );
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "candidate.json"),
    JSON.stringify(
      {
        schema_version: 1,
        candidate_id: id,
        task_id: `task-${id}`,
        review_id: `founder-review-${id}`,
        cycle_id: `cycle-${id}`,
        created_at: opts?.created_at ?? "2026-08-01T00:00:00.000Z",
        updated_at: opts?.created_at ?? "2026-08-01T00:00:00.000Z",
        status,
        publication_allowed: false,
        provider: "mock",
        target: {
          category: "creative",
          title: opts?.title ?? "Software Engineer",
          industry: "tech",
          seniority: "mid",
          objective: "test",
          role_family: "creative",
        },
        artifacts: {},
      },
      null,
      2,
    ),
  );
  writeFileSync(join(dir, "preview.png"), "png");
  writeFileSync(join(dir, "thumbnail.png"), "png");
}

function writeWorkspace(root: string): void {
  const dir = join(root, "SOS/07_LOGS/saios/founder-review-workspace");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "active.json"),
    JSON.stringify({
      schema_version: "founder-review-workspace-1.0.0",
      mode: "active_registry_only",
    }),
  );
}

function main(): void {
  const viewSrc = readFileSync(VIEW, "utf8");
  const serverSrc = readFileSync(SERVER, "utf8");
  const taskHashesBefore = new Map<string, string>();
  for (const id of HISTORICAL_TASKS) {
    const p = join(REPO, "SOS/07_LOGS/saios/founder-revision/tasks", `${id}.json`);
    if (existsSync(p)) taskHashesBefore.set(id, sha256(p));
  }

  const selectedPayload =
    /const payload = \{[\s\S]*review_id: selected\.review_id[\s\S]*candidate_id: selected\.candidate_id[\s\S]*\}/.test(
      viewSrc,
    );
  assert(
    selectedPayload,
    "selected_card_equals_submitted_identity",
    "payload bound to selected.review_id / selected.candidate_id",
  );
  assert(
    /fr-v3-identity[\s\S]*data-review-id=\{selected\.review_id\}[\s\S]*data-candidate-id=\{selected\.candidate_id\}/.test(
      viewSrc,
    ) &&
      /Acting on <strong>\{selected\.title\}<\/strong>/.test(viewSrc) &&
      /Resume Template ID: <code>\{selected\.candidate_id\}<\/code>/.test(viewSrc),
    "preview_modal_payload_identity",
    "confirm strip and payload share selected identity",
  );
  assert(
    !/candidate_id:\s*queue\[/.test(viewSrc) &&
      !/review_id:\s*items\[0\]/.test(viewSrc),
    "no_silent_queue_fallback_identity",
  );

  const uiDesigner = {
    review_id: `founder-review-${UI_DESIGNER}`,
    candidate_id: UI_DESIGNER,
    task_id: "revtask-863f67a5-790",
    cycle_id: "cycle-ui-designer",
  };
  const motion = {
    review_id: `founder-review-${MOTION_DESIGNER}`,
    candidate_id: MOTION_DESIGNER,
    task_id: "revtask-motion",
    cycle_id: "cycle-motion",
  };
  const rematch = resolveFounderDecisionIdentity({
    submitted: {
      review_id: motion.review_id,
      candidate_id: UI_DESIGNER,
      task_id: uiDesigner.task_id,
      cycle_id: uiDesigner.cycle_id,
    },
    catalog: [uiDesigner, motion],
  });
  assert(
    rematch.ok === false,
    "disjoint_id_no_rematch",
    rematch.ok ? "unexpected rematch" : rematch.error,
  );
  const mismatch = resolveFounderDecisionIdentity({
    submitted: {
      review_id: uiDesigner.review_id,
      candidate_id: MOTION_DESIGNER,
    },
    catalog: [uiDesigner, motion],
  });
  assert(
    mismatch.ok === false,
    "preview_cannot_be_a_while_payload_is_b",
    mismatch.ok ? "unexpected bind" : mismatch.error,
  );
  const bound = resolveFounderDecisionIdentity({
    submitted: uiDesigner,
    catalog: [uiDesigner, motion],
  });
  assert(
    bound.ok === true &&
      bound.ok &&
      identitiesBound(bound.identity, uiDesigner) &&
      bound.identity.candidate_id !== MOTION_DESIGNER,
    "historical_identity_fixture_not_confused",
    JSON.stringify(bound),
  );

  const fixture = mkdtempSync(join(tmpdir(), "aios-actionability-"));
  try {
    writeWorkspace(fixture);
    writeManifest(fixture, "cand-valid-wait", "READY_FOR_FOUNDER_REVIEW", {
      title: "Valid Waiting Founder",
      created_at: "2026-08-01T00:00:00.000Z",
    });
    writeManifest(fixture, MOTION_DESIGNER, "READY_FOR_FOUNDER_REVIEW", {
      title: "Motion Designer Resume Template",
      created_at: "2026-09-03T03:20:47.000Z",
    });
    writeManifest(fixture, UI_DESIGNER, "READY_FOR_FOUNDER_REVIEW", {
      title: "UI Designer",
      created_at: "2026-09-15T12:20:23.000Z",
    });
    mkdirSync(join(fixture, "SOS/SAIOS/core/founder-review"), {
      recursive: true,
    });
    writeFileSync(
      join(fixture, "SOS/SAIOS/core/founder-review/actionability-overlay.json"),
      `${JSON.stringify(
        {
          schema_version: "founder-review-actionability-1.0.0",
          records: [
            {
              review_id: `founder-review-${UI_DESIGNER}`,
              candidate_id: UI_DESIGNER,
              validity: "AUDIT_INVALID",
              actionability: "NOT_DECISIONABLE",
              historical_task_id: "revtask-863f67a5-790",
              historical_task_status_unchanged: "READY_FOR_FOUNDER_REVIEW",
              reason: "Authorized C5 audit fixture",
              recorded_at: "2026-09-30T11:20:00.000Z",
              source: "authorized_audit",
            },
          ],
        },
        null,
        2,
      )}\n`,
    );
    const items = loadFounderReviewProjection(fixture);
    const valid = items.find((i) => i.candidate_id === "cand-valid-wait");
    const motion = items.find((i) => i.candidate_id === MOTION_DESIGNER);
    const invalid = items.find((i) => i.candidate_id === UI_DESIGNER);
    const fixtureOverlay = loadActionabilityOverlay(fixture);
    assert(
      valid?.status === "waiting_founder" &&
        valid.validity !== "audit_invalid" &&
        valid.actionable !== false,
      "valid_waiting_founder_actionable",
      JSON.stringify({
        status: valid?.status,
        validity: valid?.validity,
        actionable: valid?.actionable,
      }),
    );
    assert(
      decisionAllowedForValidity("valid", "APPROVED") === true &&
        evaluateFounderDecisionActionability({
          overlay: fixtureOverlay,
          identity: {
            review_id: `founder-review-cand-valid-wait`,
            candidate_id: "cand-valid-wait",
          },
          projectedValidity: valid?.validity === "audit_invalid" ? "audit_invalid" : "valid",
          decision: "APPROVED",
        }).allowed === true,
      "valid_waiting_approve_allowed",
    );
    assert(
      decisionAllowedForValidity("valid", "CHANGES_REQUESTED") === true &&
        evaluateFounderDecisionActionability({
          overlay: fixtureOverlay,
          identity: {
            review_id: `founder-review-cand-valid-wait`,
            candidate_id: "cand-valid-wait",
          },
          projectedValidity: "valid",
          decision: "CHANGES_REQUESTED",
        }).allowed === true,
      "valid_waiting_request_changes_allowed",
    );
    assert(
      decisionAllowedForValidity("valid", "REJECTED") === true &&
        evaluateFounderDecisionActionability({
          overlay: fixtureOverlay,
          identity: {
            review_id: `founder-review-cand-valid-wait`,
            candidate_id: "cand-valid-wait",
          },
          projectedValidity: "valid",
          decision: "REJECTED",
        }).allowed === true,
      "valid_waiting_reject_allowed",
    );
    assert(
      invalid?.status === "audit_invalid" &&
        invalid.validity === "audit_invalid" &&
        invalid.actionable === false,
      "audit_invalid_ready_actionability",
      JSON.stringify({
        status: invalid?.status,
        validity: invalid?.validity,
        actionable: invalid?.actionable,
      }),
    );
    const invalidIdentity = {
      review_id: `founder-review-${UI_DESIGNER}`,
      candidate_id: UI_DESIGNER,
    };
    assert(
      decisionAllowedForValidity("audit_invalid", "APPROVED") === false &&
        evaluateFounderDecisionActionability({
          overlay: fixtureOverlay,
          identity: invalidIdentity,
          projectedValidity: "audit_invalid",
          decision: "APPROVED",
        }).allowed === false,
      "audit_invalid_approve_blocked_server",
    );
    assert(
      decisionAllowedForValidity("audit_invalid", "CHANGES_REQUESTED") ===
        false &&
        evaluateFounderDecisionActionability({
          overlay: fixtureOverlay,
          identity: invalidIdentity,
          projectedValidity: "audit_invalid",
          decision: "CHANGES_REQUESTED",
        }).allowed === false,
      "audit_invalid_request_changes_blocked_server",
    );
    assert(
      decisionAllowedForValidity("audit_invalid", "REJECTED") === false &&
        evaluateFounderDecisionActionability({
          overlay: fixtureOverlay,
          identity: invalidIdentity,
          projectedValidity: "audit_invalid",
          decision: "REJECTED",
        }).allowed === false,
      "audit_invalid_reject_blocked_server",
    );
    const decisions = ["APPROVED", "REJECTED", "CHANGES_REQUESTED"] as const;
    assert(
      decisions.every(
        (d) =>
          decisionAllowedForValidity("valid", d) === true &&
          decisionAllowedForValidity("audit_invalid", d) === false,
      ) &&
        /isAuditInvalid\(selected\.status\)/.test(viewSrc) &&
        /canApprove/.test(viewSrc) &&
        /canRequestOrReject/.test(viewSrc) &&
        /if \(isAuditInvalid\(status\)\) return false/.test(viewSrc) &&
        /Approve, Request Changes, or Reject/.test(viewSrc),
      "ui_server_actionability_agreement",
    );
    const craftedReject = evaluateFounderDecisionActionability({
      overlay: fixtureOverlay,
      identity: invalidIdentity,
      projectedValidity: "valid",
      decision: "REJECTED",
    });
    assert(
      craftedReject.allowed === false &&
        rematch.ok === false &&
        mismatch.ok === false,
      "crafted_identity_cannot_bypass_actionability",
      craftedReject.reason ?? "",
    );
    assert(
      motion?.status === "waiting_founder" &&
        motion.validity !== "audit_invalid" &&
        motion.actionable !== false &&
        !fixtureOverlay.records.some((r) => r.candidate_id === MOTION_DESIGNER) &&
        evaluateFounderDecisionActionability({
          overlay: fixtureOverlay,
          identity: {
            review_id: `founder-review-${MOTION_DESIGNER}`,
            candidate_id: MOTION_DESIGNER,
          },
          projectedValidity: "valid",
          decision: "CHANGES_REQUESTED",
        }).allowed === true,
      "motion_designer_valid_actionable_unaffected",
      JSON.stringify({
        status: motion?.status,
        validity: motion?.validity,
        actionable: motion?.actionable,
      }),
    );
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }

  const overlay = loadActionabilityOverlay(REPO);
  assert(
    overlay.records.some((r) => r.candidate_id === UI_DESIGNER) &&
      !overlay.records.some((r) => r.candidate_id === MOTION_DESIGNER) &&
      overlay.records.every(
        (r) =>
          r.actionability === "NOT_DECISIONABLE" &&
          r.validity === "AUDIT_INVALID" &&
          typeof r.historical_task_status_unchanged === "string",
      ) &&
      !/cand-creative-ui-designer-20260915T122023Z-79af7d-revfb-f81691/.test(
        readFileSync(
          join(REPO, "SOS/SAIOS/core/founder-review/FounderReviewActionability.ts"),
          "utf8",
        ),
      ) &&
      !/cand-creative-ui-designer-20260915T122023Z-79af7d-revfb-f81691/.test(
        readFileSync(
          join(REPO, "SOS/SAIOS/core/founder-review/FounderReviewProjection.ts"),
          "utf8",
        ),
      ),
    "no_candidate_id_blacklist_in_code",
  );
  assert(
    overlay.schema_version === "founder-review-actionability-1.0.0" &&
      overlay.records.every((r) => r.source === "authorized_audit"),
    "actionability_overlay_is_current_state_metadata",
  );
  assert(
    existsSync(OVERLAY) &&
      JSON.parse(readFileSync(OVERLAY, "utf8")).schema_version ===
        "founder-review-actionability-1.0.0",
    "canonical_overlay_data_record_present",
  );
  assert(
    /resolveFounderDecisionIdentity/.test(serverSrc) &&
      /evaluateFounderDecisionActionability/.test(serverSrc) &&
      !/decision === "REJECTED"/.test(
        serverSrc.slice(
          serverSrc.indexOf("evaluateFounderDecisionActionability"),
          serverSrc.indexOf("evaluateFounderDecisionActionability") + 800,
        ),
      ),
    "server_enforces_identity_and_actionability",
  );
  assert(
    /isAuditInvalid\(selected\.status\)/.test(viewSrc) &&
      /audit-invalid and is not actionable for Approve, Request Changes, or Reject/.test(
        viewSrc,
      ),
    "dashboard_blocks_audit_invalid_actions",
  );

  for (const id of HISTORICAL_TASKS) {
    const p = join(REPO, "SOS/07_LOGS/saios/founder-revision/tasks", `${id}.json`);
    if (!existsSync(p)) {
      assert(true, `historical_${id}_absent_or_unmodified`, "absent locally");
      continue;
    }
    const raw = JSON.parse(readFileSync(p, "utf8")) as { status?: string };
    assert(
      taskHashesBefore.get(id) === sha256(p) &&
        raw.status === "READY_FOR_FOUNDER_REVIEW",
      `historical_${id}_immutable`,
      raw.status ?? "",
    );
  }
  const decisionsPath = join(
    REPO,
    "SOS/07_LOGS/saios/founder-decisions/decisions.jsonl",
  );
  if (existsSync(decisionsPath)) {
    const ledger = readFileSync(decisionsPath, "utf8");
    const present = HISTORICAL_DECISIONS.filter((id) => ledger.includes(id));
    assert(
      present.length === HISTORICAL_DECISIONS.length || present.length === 0,
      "historical_decisions_unmutated",
      present.length === 0
        ? "historical C5 decisions not on this local ledger"
        : `present=${present.join(",")}`,
    );
  } else {
    assert(true, "historical_decisions_unmutated", "ledger absent locally");
  }

  const pass = checks.every((c) => c.pass);
  mkdirSync(join(OUT, ".."), { recursive: true });
  writeFileSync(
    OUT,
    `${JSON.stringify(
      {
        schema_version: "founder-review-actionability-verify-1.0.0",
        pass,
        founder_historical_click_reconstructed: false,
        dashboard_stale_selection_bug_claimed: false,
        backend_remapping_bug_claimed: false,
        checks,
      },
      null,
      2,
    )}\n`,
  );
  console.log(pass ? "ACTIONABILITY PASS" : "ACTIONABILITY FAIL");
  process.exit(pass ? 0 : 1);
}

main();
