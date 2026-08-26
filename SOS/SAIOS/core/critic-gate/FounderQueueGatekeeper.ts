/**
 * FounderQueueGatekeeper — queue updates from Critic Gate (no auto-run).
 */
import {
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { CriticGateResult, RemediationProposal } from "./types.js";

type Action = {
  id: string;
  priority: string;
  title: string;
  detail: string;
  source: string;
  category?: string;
  task_id?: string;
  status?: string;
  overall_score?: number;
  ats_score?: number;
  gate_id?: string;
};

export class FounderQueueGatekeeper {
  constructor(
    private readonly queuePath = join(
      resolve(import.meta.dirname, "../../../.."),
      "SOS/07_LOGS/saios/founder-control-center/founder-action-queue.json",
    ),
  ) {}

  applyGate(
    gate: CriticGateResult,
    remediation?: RemediationProposal | null,
  ): { added_id: string | null; skipped_duplicate: boolean } {
    const targetPath = gate.fixture
      ? join(
          resolve(import.meta.dirname, "../../../.."),
          "SOS/07_LOGS/saios/critic-gate/fixtures/founder-action-queue.json",
        )
      : this.queuePath;

    mkdirSync(dirname(targetPath), { recursive: true });
    let doc: {
      generated_at: string;
      recommended_next_action?: string;
      actions: Action[];
    } = { generated_at: new Date().toISOString(), actions: [] };

    if (existsSync(targetPath)) {
      doc = JSON.parse(readFileSync(targetPath, "utf8"));
      if (!Array.isArray(doc.actions)) doc.actions = [];
    }

    if (gate.ready) {
      const id = `critic-review-${gate.candidate_id}`;
      if (doc.actions.some((a) => a.id === id)) {
        return { added_id: id, skipped_duplicate: true };
      }
      const action: Action = {
        id,
        priority: "P0",
        title: `Review resume template: ${gate.candidate_title}`,
        detail: `Critic Ready=YES · Overall ${gate.overall_score} · ATS ${gate.ats_score} · Technical ${gate.technical_score}. Publication still forbidden without founder approval.`,
        source: "critic-gate",
        category: "founder-approval",
        task_id: gate.task_id,
        status: "waiting_founder",
        overall_score: gate.overall_score,
        ats_score: gate.ats_score,
        gate_id: gate.gate_id,
      };
      doc.actions = [action, ...doc.actions];
      doc.recommended_next_action = action.title;
      doc.generated_at = new Date().toISOString();
      this.write(doc, targetPath);
      return { added_id: id, skipped_duplicate: false };
    }

    const id = `critic-remediation-${gate.candidate_id}`;
    if (doc.actions.some((a) => a.id === id)) {
      return { added_id: id, skipped_duplicate: true };
    }
    const action: Action = {
      id,
      priority: "P1",
      title: `Resolve critic failure: ${gate.candidate_title}`,
      detail: `BLOCKED_BY_CRITIC · ${gate.blocking_reasons.join("; ")}. ${remediation?.detail ?? "Remediation proposed — not auto-started."}`,
      source: "critic-gate",
      category: "remediation",
      task_id: gate.task_id,
      status: "proposed",
      overall_score: gate.overall_score,
      ats_score: gate.ats_score,
      gate_id: gate.gate_id,
    };
    doc.actions = [action, ...doc.actions];
    doc.generated_at = new Date().toISOString();
    this.write(doc, targetPath);
    return { added_id: id, skipped_duplicate: false };
  }

  private write(
    doc: {
      generated_at: string;
      recommended_next_action?: string;
      actions: Action[];
    },
    path: string,
  ): void {
    const tmp = `${path}.tmp`;
    writeFileSync(tmp, `${JSON.stringify(doc, null, 2)}\n`);
    renameSync(tmp, path);
  }
}
