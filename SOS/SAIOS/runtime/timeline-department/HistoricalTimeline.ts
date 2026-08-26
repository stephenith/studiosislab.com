/**
 * Builds historical timeline event stream from known sources.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { TimelineEvent } from "./types.js";

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

export function buildHistoricalEvents(input: {
  repoRoot: string;
  projectHistory: Array<{ at: string; type: string; summary: string; ref?: string }>;
}): { events: TimelineEvent[]; sources: Array<{ id: string; status: "available" | "unavailable"; path: string }> } {
  const sources: Array<{ id: string; status: "available" | "unavailable"; path: string }> = [];
  const events: TimelineEvent[] = [];

  const push = (e: Omit<TimelineEvent, "id" | "date"> & { id?: string }) => {
    const date = e.at.slice(0, 10);
    events.push({
      id: e.id ?? `${e.type}-${date}-${events.length}`,
      at: e.at,
      date,
      type: e.type,
      title: e.title,
      summary: e.summary,
      ref: e.ref ?? null,
      source: e.source,
    });
  };

  // Project state history
  const statePath = join(input.repoRoot, "SOS/project-state.json");
  sources.push({
    id: "project-state",
    path: statePath,
    status: existsSync(statePath) ? "available" : "unavailable",
  });
  for (const h of input.projectHistory) {
    push({
      at: h.at,
      type: h.type,
      title: humanizeType(h.type),
      summary: h.summary,
      ref: h.ref,
      source: "project-state.history",
    });
  }

  // Founder reviews
  const frRoot = join(input.repoRoot, "SOS/07_LOGS/saios");
  let frDirs: string[] = [];
  try {
    frDirs = readdirSync(frRoot).filter((n) => n.startsWith("founder-review-"));
    sources.push({
      id: "founder-reviews",
      path: frRoot,
      status: frDirs.length ? "available" : "unavailable",
    });
  } catch {
    sources.push({ id: "founder-reviews", path: frRoot, status: "unavailable" });
  }
  for (const dir of frDirs) {
    const folder = join(frRoot, dir);
    try {
      const st = statSync(folder);
      push({
        at: st.mtime.toISOString(),
        type: "founder_review_package",
        title: `Founder review package ${dir}`,
        summary: `Review artifacts available in ${dir}`,
        ref: `SOS/07_LOGS/saios/${dir}`,
        source: "founder-review-*",
      });
    } catch {
      /* skip */
    }
  }

  // Release history
  const releasePath = join(
    input.repoRoot,
    "SOS/07_LOGS/saios/publication/release-manager/release-history.json",
  );
  const releases = readJson<Array<{ release_id: string; catalog_id: string; release_date: string; status: string }>>(
    releasePath,
  );
  sources.push({
    id: "release-history",
    path: releasePath,
    status: releases ? "available" : "unavailable",
  });
  for (const r of releases ?? []) {
    push({
      at: r.release_date,
      type: r.status === "released" ? "release" : "release_rollback",
      title: r.status === "released" ? `Published ${r.catalog_id}` : `Rolled back ${r.catalog_id}`,
      summary: `${r.release_id} — ${r.status}`,
      ref: r.release_id,
      source: "release-history",
    });
  }

  // Notification / website ops markers
  const notifPath = join(
    input.repoRoot,
    "SOS/07_LOGS/saios/notification-department/notification-report.md",
  );
  sources.push({
    id: "notification-department",
    path: notifPath,
    status: existsSync(notifPath) ? "available" : "unavailable",
  });
  const webPath = join(input.repoRoot, "SOS/07_LOGS/saios/website-department/website-health.json");
  sources.push({
    id: "website-department",
    path: webPath,
    status: existsSync(webPath) ? "available" : "unavailable",
  });

  // Deduplicate near-identical ids by keeping chronological unique summaries
  const seen = new Set<string>();
  const unique = events
    .sort((a, b) => a.at.localeCompare(b.at))
    .filter((e) => {
      const key = `${e.date}|${e.type}|${e.summary}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return { events: unique, sources };
}

function humanizeType(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
