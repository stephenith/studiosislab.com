/**
 * MissionApprovalReporter — derived markdown summary (Agent #163).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { MissionApprovalRepository } from "./MissionApprovalRepository.js";

export class MissionApprovalReporter {
  writeMarkdown(repo: MissionApprovalRepository): string {
    const decisions = repo.listDecisions(true);
    const health = repo.loadHealth();
    const latest = repo.loadLatestApproval();
    const lines = [
      "# Mission Approval Log",
      "",
      `Updated: ${new Date().toISOString()}`,
      `Mode: approval_only · execution_allowed=false · queue=false · publish=false`,
      "",
      `Pending: ${health?.pending_count ?? 0}`,
      `Approved: ${health?.approved_count ?? 0}`,
      `Rejected: ${health?.rejected_count ?? 0}`,
      `Changes requested: ${health?.changes_requested_count ?? 0}`,
      "",
      `Latest: ${latest?.mission_id ?? "none"} · ${latest?.latest_decision ?? "—"}`,
      "",
      "## Decisions",
      "",
    ];
    for (const d of decisions.slice(-20).reverse()) {
      lines.push(
        `- ${d.created_at} · ${d.decision_id} · ${d.mission_id}@v${d.mission_version} · ${d.decision} · ${d.status}${d.fixture ? " · fixture" : ""}`,
      );
    }
    lines.push("");
    const outDir = join(repo.dir);
    mkdirSync(outDir, { recursive: true });
    const path = join(outDir, "MISSION_APPROVAL_LOG.md");
    writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
    return path;
  }
}
