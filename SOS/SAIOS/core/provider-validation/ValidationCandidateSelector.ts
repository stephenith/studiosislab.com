/**
 * ValidationCandidateSelector — only interactive dashboard APPROVED candidates.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ValidationCandidate } from "./types.js";

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function readJsonl<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as T);
}

export type SelectionResult = {
  status: "SELECTED" | "BLOCKED";
  candidate: ValidationCandidate | null;
  founder_action: string | null;
  reason: string;
};

export class ValidationCandidateSelector {
  constructor(
    private readonly repoRoot = resolve(import.meta.dirname, "../../../.."),
  ) {}

  select(options?: { fixtureCandidate?: ValidationCandidate }): SelectionResult {
    if (options?.fixtureCandidate?.eligible) {
      return {
        status: "SELECTED",
        candidate: options.fixtureCandidate,
        founder_action: null,
        reason: "Fixture eligible resume template (verify isolation)",
      };
    }

    const cycleDir = join(
      this.repoRoot,
      "SOS/07_LOGS/saios/first-production-cycle",
    );
    const consumptions = readJsonl<{
      decision_id: string;
      cycle_id: string;
      review_id: string;
      decision: string;
      fixture?: boolean;
    }>(
      join(
        this.repoRoot,
        "SOS/07_LOGS/saios/founder-gate-runtime/decision-consumption.jsonl",
      ),
    ).filter((c) => !c.fixture && c.decision === "APPROVED");

    const decisions = readJsonl<{
      decision_id: string;
      review_id: string;
      task_id: string;
      cycle_id: string;
      decision: string;
      publication_allowed: boolean;
      source_interface?: string;
      fixture?: boolean;
    }>(
      join(
        this.repoRoot,
        "SOS/07_LOGS/saios/founder-decisions/decisions.jsonl",
      ),
    ).filter((d) => !d.fixture && d.decision === "APPROVED");

    // Prefer interactive: decision consumed by founder-gate-runtime after pause
    const interactive = consumptions
      .map((c) => {
        const d = decisions.find((x) => x.decision_id === c.decision_id);
        if (!d) return null;
        return this.assessCycleCandidate(cycleDir, {
          decision_id: d.decision_id,
          review_id: d.review_id,
          task_id: d.task_id,
          cycle_id: d.cycle_id,
          source: "interactive_dashboard" as const,
        });
      })
      .filter((x): x is ValidationCandidate => Boolean(x?.eligible));

    if (interactive.length) {
      // Deterministic: lowest cycle_id then decision_id
      interactive.sort((a, b) =>
        `${a.cycle_id}:${a.founder_decision_id}`.localeCompare(
          `${b.cycle_id}:${b.founder_decision_id}`,
        ),
      );
      return {
        status: "SELECTED",
        candidate: interactive[0],
        founder_action: null,
        reason: "Interactive dashboard APPROVED candidate selected",
      };
    }

    // Historical auto (#132) exists but is not eligible for real-provider prep
    const historical = decisions.find(
      (d) =>
        d.cycle_id === "cycle-resume-dept-001" ||
        d.review_id === "founder-review-cycle-ats-marketing-manager-001",
    );
    const assessed = this.assessCycleCandidate(cycleDir, {
      decision_id: historical?.decision_id ?? null,
      review_id:
        historical?.review_id ??
        "founder-review-cycle-ats-marketing-manager-001",
      task_id: historical?.task_id ?? "cycle-ats-marketing-manager-001",
      cycle_id: historical?.cycle_id ?? "cycle-resume-dept-001",
      source: historical ? "historical_auto" : "none",
    });

    return {
      status: "BLOCKED",
      candidate: assessed,
      founder_action:
        "Approve one waiting dry-run candidate through the dashboard",
      reason:
        "No eligible real dashboard-approved (interactive) candidate — do not fabricate approval; historical auto-decision is not eligible",
    };
  }

  private assessCycleCandidate(
    cycleDir: string,
    meta: {
      decision_id: string | null;
      review_id: string;
      task_id: string;
      cycle_id: string;
      source: ValidationCandidate["source"];
    },
  ): ValidationCandidate {
    const editor = readJson<{ overall?: string; pass?: boolean }>(
      join(cycleDir, "editor-compatibility.json"),
    );
    const critic = readJson<{
      scores?: { overall?: number; ats?: number; technical?: number; ready?: boolean };
      ready?: boolean;
    }>(join(cycleDir, "critic.json"));
    const gate = readJson<{
      gate?: { ready?: boolean; publication_allowed?: boolean };
      ready?: boolean;
    }>(join(cycleDir, "gate.json"));
    const waiting = readJson<{ state?: string }>(
      join(cycleDir, "waiting-founder.json"),
    );
    const review = readJson<{ candidate_id?: string; status?: string }>(
      join(cycleDir, "review.json"),
    );
    const dash = readJson<{ current_candidate?: string }>(
      join(cycleDir, "dashboard.json"),
    );

    const evidenceFiles = [
      "knowledge.json",
      "skills.json",
      "brain.json",
      "designbrief.json",
      "renderer.json",
      "critic.json",
      "canvas.json",
    ];
    const evidence_complete = evidenceFiles.every((f) =>
      existsSync(join(cycleDir, f)),
    );

    const editor_compat_pass =
      editor?.pass === true ||
      String(editor?.overall ?? "").toUpperCase() === "PASS";
    const critic_pass = Boolean(
      critic?.ready ?? critic?.scores?.ready ?? (critic?.scores?.overall ?? 0) >= 90,
    );
    const critic_gate_pass = Boolean(gate?.gate?.ready ?? gate?.ready);
    const reached_waiting_founder =
      waiting?.state === "WAITING_FOUNDER" ||
      review?.status === "waiting_founder" ||
      review?.status === "decided";

    const blocking: string[] = [];
    if (!editor_compat_pass) blocking.push("editor_compatibility");
    if (!critic_pass) blocking.push("resume_critic");
    if (!critic_gate_pass) blocking.push("critic_gate");
    if (!reached_waiting_founder) blocking.push("waiting_founder");
    if (!evidence_complete) blocking.push("incomplete_evidence");
    if (meta.source !== "interactive_dashboard") {
      blocking.push("requires_interactive_dashboard_approval");
    }
    if (!meta.decision_id || meta.source !== "interactive_dashboard") {
      blocking.push("missing_interactive_approved_decision");
    }

    const eligible =
      meta.source === "interactive_dashboard" &&
      Boolean(meta.decision_id) &&
      editor_compat_pass &&
      critic_pass &&
      critic_gate_pass &&
      reached_waiting_founder &&
      evidence_complete &&
      blocking.length === 0;

    return {
      candidate_id: review?.candidate_id ?? "cand-ats-mm-001",
      task_id: meta.task_id,
      cycle_id: meta.cycle_id,
      review_id: meta.review_id,
      title: dash?.current_candidate ?? "ATS Marketing Manager Resume",
      founder_decision_id: meta.decision_id,
      decision: meta.decision_id ? "APPROVED" : null,
      source: meta.source,
      publication_allowed: false,
      editor_compat_pass,
      critic_pass,
      critic_gate_pass,
      reached_waiting_founder,
      evidence_complete,
      eligible,
      blocking_reasons: blocking,
      artifact_dir: "SOS/07_LOGS/saios/first-production-cycle",
    };
  }
}
