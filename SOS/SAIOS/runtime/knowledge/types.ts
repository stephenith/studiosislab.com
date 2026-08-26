/**
 * SAIOS Knowledge module — types
 */

import type { IsoTimestamp, JobId, KnowledgeDomain } from "../shared/types.js";

export type KnowledgeRef = {
  domain: KnowledgeDomain;
  path: string;
  excerpt?: string;
};

export type KnowledgeSnapshot = {
  job_id: JobId;
  refs: KnowledgeRef[];
  assembled_at: IsoTimestamp;
};

export interface KnowledgeService {
  listDomains(): Promise<KnowledgeDomain[]>;
  resolveRefs(domains: KnowledgeDomain[]): Promise<KnowledgeRef[]>;
  buildSnapshot(jobId: JobId, domains: KnowledgeDomain[]): Promise<KnowledgeSnapshot>;
  getIndexPaths(): Promise<string[]>;
}
