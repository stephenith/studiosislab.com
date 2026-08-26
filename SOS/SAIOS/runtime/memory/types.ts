/**
 * SAIOS Memory module — types
 */

import type { IsoTimestamp, MemoryTier } from "../shared/types.js";

export type SessionTurn = {
  role: "founder" | "chief-ai";
  text: string;
  at: IsoTimestamp;
};

export type SessionMemory = {
  chat_id: string;
  turns: SessionTurn[];
  last_job_id?: string | null;
  updated_at: IsoTimestamp;
};

export type ProjectMemory = {
  updated_at: IsoTimestamp;
  active_jobs: { pending: number; running: number; blocked: number };
  last_completion?: { job_id: string; at: IsoTimestamp } | null;
  notes: string[];
};

export type LongTermMemory = {
  updated_at: IsoTimestamp;
  preferences: Record<string, unknown>;
  decision_refs: string[];
};

export interface SessionMemoryStore {
  read(chatId: string): Promise<SessionMemory | null>;
  append(chatId: string, turn: SessionTurn): Promise<SessionMemory>;
  clear(chatId: string): Promise<void>;
}

export interface ProjectMemoryStore {
  read(): Promise<ProjectMemory>;
  update(patch: Partial<ProjectMemory>): Promise<ProjectMemory>;
  appendEvent(event: Record<string, unknown>): Promise<void>;
}

export interface LongTermMemoryStore {
  read(): Promise<LongTermMemory>;
  write(memory: LongTermMemory): Promise<LongTermMemory>;
}

export type MemoryService = {
  sessionMemory: SessionMemoryStore;
  projectMemory: ProjectMemoryStore;
  longTermMemory: LongTermMemoryStore;
  tierPath(tier: MemoryTier): string;
};
