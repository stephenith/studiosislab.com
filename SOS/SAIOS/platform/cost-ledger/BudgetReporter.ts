/**
 * BudgetReporter — markdown summary (Agent #181).
 */
import { BaseMarkdownReporter } from "../reporters/BaseMarkdownReporter.js";
import type { BudgetRepository } from "./BudgetRepository.js";

export class BudgetReporter {
  private readonly base = new BaseMarkdownReporter();

  writeMarkdown(repo: BudgetRepository): string {
    const health = repo.buildHealth();
    const budgets = repo.listBudgets();
    const sessions = repo.listSessions();
    const listLines = [
      ...budgets.map(
        (b) =>
          `- budget · ${b.budget_id} · ${b.budget_kind} · ${b.status} · amount=${b.amount.amount ?? "null"}${b.fixture ? " · fixture" : ""}`,
      ),
      ...sessions.map(
        (s) =>
          `- session · ${s.session_id} · ${s.mission_id} · ${s.status}${s.fixture ? " · fixture" : ""}`,
      ),
    ];
    return this.base.writeSimple({
      dir: repo.dir,
      filename: "COST_LEDGER_LOG.md",
      title: "Cost Ledger Scaffold Log",
      headerLines: [
        `Updated: ${new Date().toISOString()}`,
        `Mode: cost_ledger_contracts_only · billing=false · execution_allowed=false · LIVE OFF`,
        "",
        `Budgets: ${health.budget_count}`,
        `Sessions: ${health.session_count}`,
        "",
      ],
      listHeading: "Entries",
      listLines,
    });
  }
}
