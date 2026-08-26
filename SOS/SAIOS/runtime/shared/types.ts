/**
 * SAIOS runtime — shared primitives
 * Skeleton v1.0 — types only
 */

export type Priority = "P0" | "P1" | "P2" | "P3";

export type IsoTimestamp = string;

export type JobStatus = "pending" | "running" | "blocked" | "completed" | "cancelled";

export type JobType = "plan" | "implement" | "verify" | "research" | "notify";

export type WorkerStatus = "registered" | "idle" | "busy" | "draining" | "retired";

export type QAVerdict = "pass" | "fail" | "inconclusive";

export type MemoryTier = "session" | "project" | "long-term";

export type KnowledgeDomain =
  | "vision"
  | "roadmap"
  | "architecture"
  | "standards"
  | "product-mobile"
  | "product-templates"
  | "ops"
  | "revenue";

export type VerifyProfile = "founder-file" | "sos-only" | "product" | "full";

/** `JOB-YYYYMMDD-HHMMSS-{slug}` */
export type JobId = string;

/** `WRK-{type}-{shortid}` */
export type WorkerId = string;

/** `PLAN-{id}` or job-backed plan reference */
export type PlanId = string;

export type Result<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};
