/**
 * Production history — persist every session; never overwrite; enable replay.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ProductionSessionRecord } from "./types.js";
import { CONTROLLER_ROOT } from "./ProductionSession.js";

const HISTORY_INDEX = join(CONTROLLER_ROOT, "history", "index.json");

export type HistoryIndex = {
  version: string;
  updated_at: string;
  sessions: HistoryEntry[];
};

export type HistoryEntry = {
  session_id: string;
  objective: string;
  started_at: string;
  completed_at: string | null;
  pass: boolean;
  templates_generated: number;
  confidence: number | null;
  industry: string | null;
  priority: string;
  session_dir: string;
  replayable: boolean;
};

export function appendToHistory(session: ProductionSessionRecord): HistoryIndex {
  mkdirSync(join(CONTROLLER_ROOT, "history"), { recursive: true });
  const index = loadHistoryIndex();

  const entry: HistoryEntry = {
    session_id: session.session_id,
    objective: session.objective,
    started_at: session.started_at,
    completed_at: session.completed_at,
    pass: session.pass,
    templates_generated: session.templates_generated,
    confidence: session.confidence,
    industry: session.command.industry,
    priority: session.command.priority,
    session_dir: session.session_dir,
    replayable: true,
  };

  const existing = index.sessions.findIndex((s) => s.session_id === session.session_id);
  if (existing >= 0) {
    index.sessions[existing] = entry;
  } else {
    index.sessions.push(entry);
  }

  index.updated_at = new Date().toISOString();
  writeFileSync(HISTORY_INDEX, JSON.stringify(index, null, 2));
  return index;
}

export function loadHistoryIndex(): HistoryIndex {
  if (!existsSync(HISTORY_INDEX)) {
    return { version: "1.0.0", updated_at: new Date().toISOString(), sessions: [] };
  }
  return JSON.parse(readFileSync(HISTORY_INDEX, "utf8")) as HistoryIndex;
}

export function loadSessionForReplay(session_id: string): ProductionSessionRecord | null {
  const index = loadHistoryIndex();
  const entry = index.sessions.find((s) => s.session_id === session_id);
  if (!entry) return null;
  const sessionPath = join(entry.session_dir, "session.json");
  if (!existsSync(sessionPath)) return null;
  return JSON.parse(readFileSync(sessionPath, "utf8")) as ProductionSessionRecord;
}

export function listReplayableSessions(): HistoryEntry[] {
  return loadHistoryIndex().sessions.filter((s) => s.replayable);
}

export function discoverSessionsFromDisk(): HistoryEntry[] {
  const sessionsDir = join(CONTROLLER_ROOT, "sessions");
  if (!existsSync(sessionsDir)) return [];
  return readdirSync(sessionsDir)
    .filter((n) => n.startsWith("production-"))
    .map((session_id) => {
      const sessionPath = join(sessionsDir, session_id, "session.json");
      if (!existsSync(sessionPath)) return null;
      const s = JSON.parse(readFileSync(sessionPath, "utf8")) as ProductionSessionRecord;
      return {
        session_id: s.session_id,
        objective: s.objective,
        started_at: s.started_at,
        completed_at: s.completed_at,
        pass: s.pass,
        templates_generated: s.templates_generated,
        confidence: s.confidence,
        industry: s.command.industry,
        priority: s.command.priority,
        session_dir: s.session_dir,
        replayable: true,
      } satisfies HistoryEntry;
    })
    .filter((e): e is HistoryEntry => e !== null);
}
