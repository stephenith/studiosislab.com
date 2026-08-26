/**
 * SAIOS Version 1 — Type contracts (skeleton)
 *
 * Architecture only. No runtime implementation in v1.
 * Future implementation: SOS/SAIOS/runtime/
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Job Queue
// ---------------------------------------------------------------------------

export type Job = {
  job_id: string;
  priority: Priority;
  parent_job_id: string | null;
  creator: "chief-ai" | "founder" | "system" | string;
  assigned_worker: string | null;
  dependencies: string[];
  job_type: JobType;
  status: JobStatus;
  created_at: IsoTimestamp;
  updated_at: IsoTimestamp;
  started_at: IsoTimestamp | null;
  completed_at: IsoTimestamp | null;
  blocked_at?: IsoTimestamp | null;
  founder_message?: string;
  prompt_path: string | null;
  report_path: string | null;
  metadata: JobMetadata;
};

export type JobMetadata = {
  intent?: string;
  classification?: string;
  knowledge_domains?: KnowledgeDomain[];
  verify_profile?: VerifyProfile;
  requires_approval?: boolean;
  scope_paths?: string[];
  revenue_impact?: "ad-readiness" | "traffic" | "conversion" | "none";
  max_attempts?: number;
  attempt?: number;
  block_reason?: string;
  notes?: string[];
};

export interface JobQueue {
  create(job: Omit<Job, "created_at" | "updated_at" | "status"> & { status?: JobStatus }): Promise<Job>;
  get(jobId: string): Promise<Job | null>;
  list(filter: { status?: JobStatus; job_type?: JobType }): Promise<Job[]>;
  transition(jobId: string, to: JobStatus, note?: string): Promise<Job>;
  assign(jobId: string, workerId: string): Promise<Job>;
  claim(jobId: string, workerId: string, expectedType: JobType): Promise<Job>;
  cancel(jobId: string, reason: string): Promise<Job>;
  dependenciesSatisfied(job: Job): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Agent Registry
// ---------------------------------------------------------------------------

export type WorkerCapability = "implement" | "verify" | "research" | "plan";

export type WorkerType = {
  type_id: string;
  display_name: string;
  capabilities: WorkerCapability[];
  owner_module: "cursor-runner" | "qa-runner" | string;
  type_version: string;
  description: string;
  tags?: string[];
};

export type WorkerInstance = {
  worker_id: string;
  type_id: string;
  status: WorkerStatus;
  owner: string;
  version: string;
  cursor_agent_version?: string;
  current_job_id: string | null;
  registered_at: IsoTimestamp;
  last_heartbeat: IsoTimestamp;
  metadata?: Record<string, unknown>;
};

export interface AgentRegistry {
  registerType(type: WorkerType): Promise<void>;
  getType(typeId: string): Promise<WorkerType | null>;
  registerInstance(instance: Omit<WorkerInstance, "registered_at" | "last_heartbeat">): Promise<WorkerInstance>;
  retireInstance(workerId: string): Promise<void>;
  heartbeat(workerId: string, patch?: Partial<Pick<WorkerInstance, "status" | "current_job_id">>): Promise<void>;
  listInstances(filter?: { type_id?: string; status?: WorkerStatus }): Promise<WorkerInstance[]>;
  assignWorker(job: Job): Promise<WorkerInstance | null>;
}

// ---------------------------------------------------------------------------
// Chief AI
// ---------------------------------------------------------------------------

export type FounderCommand = {
  source: "telegram" | "api" | "schedule";
  raw_text: string;
  chat_id?: string;
  user_id?: string;
  received_at: IsoTimestamp;
};

export type ExecutionPlan = {
  plan_id: string;
  founder_message: string;
  intent_summary: string;
  jobs: Array<Pick<Job, "job_type" | "priority" | "parent_job_id" | "dependencies" | "metadata">>;
  knowledge_refs: Array<{ domain: KnowledgeDomain; path: string }>;
  requires_approval: boolean;
  created_at: IsoTimestamp;
};

export interface ChiefAI {
  handleFounderCommand(command: FounderCommand): Promise<{ reply: string; plan?: ExecutionPlan }>;
  createJobsFromPlan(plan: ExecutionPlan): Promise<Job[]>;
  monitor(): Promise<{ jobs: Job[]; workers: WorkerInstance[] }>;
  verifyCompletion(jobId: string): Promise<{ complete: boolean; summary: string }>;
  notifyFounder(message: string, metadata?: Record<string, unknown>): Promise<void>;
}

// ---------------------------------------------------------------------------
// Cursor Runner
// ---------------------------------------------------------------------------

export type ExecutionReport = {
  job_id: string;
  worker_id: string;
  status: "done" | "failed";
  exit_code: number | null;
  duration_ms: number;
  cursor_agent_version: string | null;
  output_preview: string;
  files_changed: string[];
  error: string | null;
  finished_at: IsoTimestamp;
};

export interface CursorRunner {
  readonly workerId: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  execute(job: Job): Promise<ExecutionReport>;
}

// ---------------------------------------------------------------------------
// QA Runner
// ---------------------------------------------------------------------------

export type QACheckResult = {
  id: string;
  passed: boolean;
  notes: string;
};

export type QAReport = {
  job_id: string;
  parent_job_id: string;
  worker_id: string;
  verdict: QAVerdict;
  profile: VerifyProfile;
  checks: QACheckResult[];
  finished_at: IsoTimestamp;
  error?: string | null;
};

export interface QARunner {
  readonly workerId: string;
  readonly profile: VerifyProfile;
  start(): Promise<void>;
  stop(): Promise<void>;
  verify(job: Job): Promise<QAReport>;
}

// ---------------------------------------------------------------------------
// Memory
// ---------------------------------------------------------------------------

export type SessionRecord = {
  chat_id: string;
  turns: Array<{ role: "founder" | "chief-ai"; text: string; at: IsoTimestamp }>;
  last_job_id?: string | null;
  last_intent?: string | null;
};

export type ProjectState = {
  updated_at: IsoTimestamp;
  active_jobs: { pending: number; running: number; blocked: number };
  last_completion?: { job_id: string; at: IsoTimestamp } | null;
  notes?: string[];
};

export interface MemoryStore {
  readSession(chatId: string): Promise<SessionRecord | null>;
  appendSessionTurn(chatId: string, role: SessionRecord["turns"][0]["role"], text: string): Promise<void>;
  readProject(): Promise<ProjectState>;
  updateProject(patch: Partial<ProjectState>): Promise<ProjectState>;
  appendProjectEvent(event: Record<string, unknown>): Promise<void>;
  readLongTermPreferences(): Promise<Record<string, unknown>>;
  writeLongTermPreferences(prefs: Record<string, unknown>): Promise<void>;
}

// ---------------------------------------------------------------------------
// Knowledge Base
// ---------------------------------------------------------------------------

export type KnowledgeRef = {
  domain: KnowledgeDomain;
  path: string;
  excerpt?: string;
};

export type KnowledgeSnapshot = {
  job_id: string;
  refs: KnowledgeRef[];
  assembled_at: IsoTimestamp;
};

export interface KnowledgeBase {
  resolveDomains(domains: KnowledgeDomain[]): Promise<KnowledgeRef[]>;
  buildSnapshot(jobId: string, domains: KnowledgeDomain[], maxChars?: number): Promise<KnowledgeSnapshot>;
  getIndex(): Promise<string[]>;
}

// ---------------------------------------------------------------------------
// SAIOS kernel (future runtime entry)
// ---------------------------------------------------------------------------

export type SaiosConfig = {
  repoRoot: string;
  sosRoot: string;
  logsRoot: string;
  saiosRoot: string;
};

export interface SaiosKernel {
  readonly config: SaiosConfig;
  readonly chiefAI: ChiefAI;
  readonly jobQueue: JobQueue;
  readonly registry: AgentRegistry;
  readonly memory: MemoryStore;
  readonly knowledge: KnowledgeBase;
  start(): Promise<void>;
  stop(): Promise<void>;
}
