/**
 * RuntimePlanReporter — markdown summary (Agent #169).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { RuntimePlanRepository } from "./RuntimePlanRepository.js";

export class RuntimePlanReporter {
  writeMarkdown(repo: RuntimePlanRepository): string {
    const latest = repo.loadLatest();
    const health = repo.loadHealth();
    const plans = repo.list();
    const lines = [
      "# Runtime Plan Log",
      "",
      `Updated: ${new Date().toISOString()}`,
      `Mode: planning_only · dispatch_allowed=false · execution_allowed=false · publishing_allowed=false`,
      "",
      `Plans: ${health?.plan_count ?? plans.length}`,
      `Ready: ${health?.ready_count ?? 0}`,
      `Blocked: ${health?.blocked_count ?? 0}`,
      "",
      latest
        ? `Latest: ${latest.mission_id} · ${latest.plan_status} · ${latest.runtime_plan_id ?? "—"}`
        : "Latest: none",
      "",
      "## Plans",
      "",
    ];
    for (const p of plans.slice(-20).reverse()) {
      lines.push(
        `- ${p.created_at} · ${p.runtime_plan_id} · ${p.mission_id} · ${p.plan_status} · ${p.plan_checksum.slice(0, 12)}…${p.fixture ? " · fixture" : ""}`,
      );
    }
    lines.push("");
    mkdirSync(repo.dir, { recursive: true });
    const path = join(repo.dir, "RUNTIME_PLAN_LOG.md");
    writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
    return path;
  }
}
