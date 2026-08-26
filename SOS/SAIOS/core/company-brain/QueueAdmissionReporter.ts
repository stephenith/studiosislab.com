/**
 * QueueAdmissionReporter — markdown summary (Agent #164).
 * Platform consolidation (Agent #176): BaseMarkdownReporter.
 */
import { BaseMarkdownReporter } from "../../platform/reporters/BaseMarkdownReporter.js";
import type { QueueAdmissionRepository } from "./QueueAdmissionRepository.js";

export class QueueAdmissionReporter {
  private readonly base = new BaseMarkdownReporter();

  writeMarkdown(repo: QueueAdmissionRepository): string {
    const review = repo.loadLatestReview();
    const health = repo.loadHealth();
    const decisions = repo.listDecisions();
    const listLines = decisions
      .slice(-20)
      .reverse()
      .map(
        (d) =>
          `- ${d.created_at} · ${d.decision_id} · ${d.mission_id}@v${d.mission_version} · ${d.decision} · ${d.status}${d.fixture ? " · fixture" : ""}`,
      );
    return this.base.writeSimple({
      dir: repo.dir,
      filename: "QUEUE_ADMISSION_LOG.md",
      title: "Queue Admission Readiness Log",
      headerLines: [
        `Updated: ${new Date().toISOString()}`,
        `Mode: readiness_review_only · execution_allowed=false · enqueue=false · publish=false`,
        "",
        `Pending reviews: ${health?.pending_review_count ?? 0}`,
        `READY_FOR_QUEUE: ${health?.ready_for_queue_count ?? 0}`,
        `Blocked: ${health?.blocked_count ?? 0}`,
        "",
        review
          ? `Latest review: ${review.review_id} · score ${review.overall_score} · ${review.verdict}`
          : "Latest review: none",
      ],
      listHeading: "Decisions",
      listLines,
    });
  }
}
