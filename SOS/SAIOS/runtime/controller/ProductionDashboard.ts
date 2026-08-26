/**
 * Production dashboard — aggregate metrics across production history.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { DashboardMetrics, ProductionSessionRecord } from "./types.js";
import { loadHistoryIndex, discoverSessionsFromDisk } from "./ProductionHistory.js";
import { CONTROLLER_ROOT } from "./ProductionSession.js";

const DASHBOARD_PATH = join(CONTROLLER_ROOT, "dashboard.json");

export function buildDashboard(activeSession: ProductionSessionRecord | null): DashboardMetrics {
  const index = loadHistoryIndex();
  const disk = discoverSessionsFromDisk();
  const sessions = mergeSessions(index.sessions, disk);

  const completed = sessions.filter((s) => s.completed_at);
  const passed = completed.filter((s) => s.pass);
  const approval_rate =
    completed.length > 0 ? Math.round((passed.length / completed.length) * 1000) / 10 : 0;

  const confidences = completed
    .map((s) => s.confidence)
    .filter((c): c is number => typeof c === "number");
  const average_confidence =
    confidences.length > 0
      ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
      : 0;

  const templates_generated = sessions.reduce((acc, s) => acc + s.templates_generated, 0);

  const industryCounts = countBy(sessions, (s) => s.industry ?? "general");
  const layoutCounts = countBy(
    sessions.filter((s) => s.pass),
    (s) => `${s.priority}-layout`,
  );

  const learning_growth = sessions.filter((s) => s.pass).length;

  return {
    generated_at: new Date().toISOString(),
    active_session: activeSession?.session_id ?? null,
    completed_sessions: completed.length,
    templates_generated,
    approval_rate,
    average_confidence,
    learning_growth,
    top_industries: topN(industryCounts, 5).map(({ name, count }) => ({
      industry: name,
      count,
    })),
    most_successful_layouts: topN(layoutCounts, 5).map(({ name, count }) => ({
      layout: name,
      count,
    })),
    worker_performance: [
      {
        worker: "resume-production-worker",
        jobs: templates_generated,
        success_rate: approval_rate,
      },
      {
        worker: "resume-qa-worker",
        jobs: templates_generated,
        success_rate: approval_rate,
      },
      {
        worker: "resume-learning-engine",
        jobs: learning_growth,
        success_rate: 100,
      },
    ],
    cursor_usage: sessions.length,
  };
}

export function persistDashboard(metrics: DashboardMetrics): string {
  mkdirSync(CONTROLLER_ROOT, { recursive: true });
  writeFileSync(DASHBOARD_PATH, JSON.stringify(metrics, null, 2));
  return DASHBOARD_PATH;
}

function mergeSessions(
  a: Array<{ session_id: string; templates_generated: number; confidence: number | null; completed_at: string | null; pass: boolean; industry: string | null; priority: string }>,
  b: typeof a,
) {
  const map = new Map<string, (typeof a)[0]>();
  for (const s of [...a, ...b]) map.set(s.session_id, s);
  return [...map.values()];
}

function countBy<T>(items: T[], keyFn: (item: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const k = keyFn(item);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

function topN(counts: Record<string, number>, n: number): Array<{ name: string; count: number }> {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, count]) => ({ name, count }));
}
