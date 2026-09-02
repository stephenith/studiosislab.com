/**
 * First Complete Autonomous Resume Department Cycle — Agent #132 / #204 / #205 / #206 / #207.
 * Skill dry-run. LIVE OFF. No publication.
 * Provider: Mock by default; OpenAI only via existing Founder one-test gates.
 * #205: deterministic ProductionTarget intake before ResumeKnowledgeGateway.
 * #206: deterministic ResearchContext enrichment before AI planning.
 * #207: per-run candidate identity + isolated candidate workspace (authoritative artifacts).
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { ResumeKnowledgeGateway } from "../resume-integration/ResumeKnowledgeGateway.js";
import { DesignBriefEngine } from "../designbrief/DesignBriefEngine.js";
import { createResumeRenderer } from "../resume-renderer/ResumeRenderer.js";
import { createResumeCritic } from "../resume-critic/ResumeCritic.js";
import { CriticGate } from "../critic-gate/CriticGate.js";
import { createFounderGateRuntime } from "../founder-gate-runtime/FounderGateRuntime.js";
import type { FounderDecisionKind } from "../founder-decisions/types.js";
import {
  ENGINES,
  acquireExecutionLock,
  enforceEngineAccess,
} from "../../architecture/runtime-guard.js";
import type { ProductionTarget } from "./ProductionTarget.js";
import { resolveProductionTarget } from "./selectProductionTarget.js";
import type { ResearchContext } from "./ResearchContext.js";
import {
  assertResearchContext,
  formatResearchBriefing,
} from "./ResearchContext.js";
import { buildResearchContext } from "./buildResearchContext.js";
import {
  PreviewGuaranteeError,
  buildResumeTemplateObject,
  writePreviewAndThumbnailGuaranteed,
  writeResumeTemplateRuntimeReport,
} from "./ResumeTemplateRuntime.js";
import {
  allocateCandidateIdentity,
  type CandidateIdentity,
} from "./CandidateIdentity.js";
import { createCandidateWorkspace } from "./CandidateStore.js";
import {
  evaluateCanvasRoleTargetIntegrity,
  type RoleTargetIntegrityResult,
} from "../role-integrity/RoleTargetIntegrity.js";
import { resolveRoleSample } from "../resume-renderer/SampleContent.js";
import {
  buildDuplicateControlMeta,
  evaluateDuplicate,
  type BatchLocalDuplicateState,
  type DuplicateDecision,
} from "./DuplicateDetector.js";
import {
  MAX_AUTOMATIC_REVISIONS,
  readPreviousBrainOutput,
  runRevisionLoop,
  type CriticFindingsBundle,
  type RevisionLoopOutcome,
} from "./RevisionLoop.js";

const REPO = resolve(import.meta.dirname, "../../../..");
export const CYCLE_LOG = join(REPO, "SOS/07_LOGS/saios/first-production-cycle");

export type StageRecord = {
  stage: string;
  start: string;
  finish: string;
  duration_ms: number;
  status: "completed" | "failed" | "skipped";
  input_reference: string | null;
  output_reference: string | null;
  validation: { pass: boolean; detail?: string };
};

export type CycleResult = {
  overall: "PASS" | "FAIL" | "SKIPPED";
  task_id: string;
  cycle_id: string;
  candidate_id: string;
  candidate_title: string;
  review_id: string;
  run_id: string;
  candidate_dir: string;
  candidate_identity: CandidateIdentity | null;
  production_target: ProductionTarget;
  research_context: ResearchContext | null;
  stages: StageRecord[];
  state:
    | "WAITING_FOUNDER"
    | "CRITIC_BLOCKED"
    | "ROLE_INTEGRITY_FAILED"
    | "COMPLETED"
    | "FAILED"
    | "DUPLICATE_SKIPPED"
    | "PREVIEW_FAILED"
    | "THUMBNAIL_FAILED";
  founder_decision: FounderDecisionKind | null;
  decision_id: string | null;
  learning_count: number;
  critic_ready: boolean;
  publication_allowed: false;
  paused: boolean;
  duplicate_decision?: DuplicateDecision | null;
  revision?: RevisionLoopOutcome | null;
};

async function runStage(
  stage: string,
  input_reference: string | null,
  fn: () => Promise<{
    output_reference: string | null;
    validation: StageRecord["validation"];
    extra?: unknown;
  }>,
): Promise<StageRecord & { extra?: unknown }> {
  const start = new Date().toISOString();
  const t0 = performance.now();
  try {
    const result = await fn();
    const finish = new Date().toISOString();
    return {
      stage,
      start,
      finish,
      duration_ms: Number((performance.now() - t0).toFixed(2)),
      status: result.validation.pass ? "completed" : "failed",
      input_reference,
      output_reference: result.output_reference,
      validation: result.validation,
      extra: result.extra,
    };
  } catch (e) {
    const finish = new Date().toISOString();
    return {
      stage,
      start,
      finish,
      duration_ms: Number((performance.now() - t0).toFixed(2)),
      status: "failed",
      input_reference,
      output_reference: null,
      validation: {
        pass: false,
        detail: e instanceof Error ? e.message : String(e),
      },
    };
  }
}

export async function runFirstProductionCycle(opts?: {
  /** @deprecated Real path never auto-decides. Fixtures only via founder-gate-runtime. */
  founderDecision?: FounderDecisionKind;
  founderActor?: string;
  founderReason?: string;
  /** When true (default), stop at WAITING_FOUNDER without recording a decision. */
  pause_for_founder?: boolean;
  /** Explicit production target. When omitted, DEFAULT (Marketing Manager) unless select_target. */
  target?: ProductionTarget;
  /** When true and target omitted, select next target via coverage (deterministic). */
  select_target?: boolean;
  /** Agent #209 — optional batch orchestration metadata recorded on candidate.json */
  batch?: {
    batch_id: string;
    batch_sequence: number;
    batch_size: number;
  };
  /** Agent #210 — batch-local fingerprints for duplicate preflight */
  duplicate_context?: BatchLocalDuplicateState | null;
  /** When false, skip duplicate preflight (BatchRunner already checked). Default true. */
  duplicate_preflight?: boolean;
  excludeFingerprints?: Set<string> | string[];
  /** Agent #211 — bounded critic revision loop */
  revision?: {
    enabled?: boolean;
    max_revisions?: number;
    /** Verify-only: force FAIL while revision_number <= N */
    force_fail_through_attempt?: number | null;
  };
  /**
   * Agent #231 — when true, persist under candidates-verify/ and stamp
   * verification_artifact. Does not enter Founder Review / Budget / Health.
   */
  verification?: boolean;
  verification_context?: string;
}): Promise<CycleResult> {
  enforceEngineAccess(ENGINES.CANONICAL_FIRST_PRODUCTION_CYCLE);
  const releaseLock = acquireExecutionLock(
    ENGINES.CANONICAL_FIRST_PRODUCTION_CYCLE.id,
  );
  try {
    return await runFirstProductionCycleInner(opts);
  } finally {
    releaseLock();
  }
}

async function runFirstProductionCycleInner(opts?: {
  founderDecision?: FounderDecisionKind;
  founderActor?: string;
  founderReason?: string;
  pause_for_founder?: boolean;
  target?: ProductionTarget;
  select_target?: boolean;
  batch?: {
    batch_id: string;
    batch_sequence: number;
    batch_size: number;
  };
  duplicate_context?: BatchLocalDuplicateState | null;
  duplicate_preflight?: boolean;
  excludeFingerprints?: Set<string> | string[];
  revision?: {
    enabled?: boolean;
    max_revisions?: number;
    force_fail_through_attempt?: number | null;
  };
  verification?: boolean;
  verification_context?: string;
}): Promise<CycleResult> {
  if (process.env.SOS_AIOS_LIVE === "1") {
    throw new Error("First production cycle refuses SOS_AIOS_LIVE=1");
  }

  mkdirSync(CYCLE_LOG, { recursive: true });

  const registry_kind = opts?.verification ? "verification" : "production";
  const verification_context = opts?.verification
    ? opts.verification_context ?? "aios-verify"
    : undefined;

  const production_target = resolveProductionTarget({
    target: opts?.target,
    select_target: opts?.select_target,
    excludeFingerprints: opts?.excludeFingerprints,
  });

  // Agent #210 — duplicate preflight before research / gateway / OpenAI / design
  const preflightEnabled = opts?.duplicate_preflight !== false;
  let duplicate_decision: DuplicateDecision | null = null;
  if (preflightEnabled) {
    duplicate_decision = evaluateDuplicate({
      target: production_target,
      cycleLog: CYCLE_LOG,
      batchLocal: opts?.duplicate_context ?? null,
      registry_kind,
    });
    // Lightweight diagnostic (not a WAITING_FOUNDER candidate)
    try {
      writeFileSync(
        join(CYCLE_LOG, "duplicate-preflight-latest.json"),
        `${JSON.stringify(
          {
            target: {
              category: production_target.category,
              title: production_target.title,
              industry: production_target.industry,
              seniority: production_target.seniority,
            },
            decision: duplicate_decision,
          },
          null,
          2,
        )}\n`,
        "utf8",
      );
    } catch {
      /* ignore diagnostic write failures */
    }

    if (duplicate_decision.decision === "SKIP_DUPLICATE") {
      const skipAt = new Date().toISOString();
      return {
        overall: "SKIPPED",
        task_id: "",
        cycle_id: "",
        candidate_id: "",
        candidate_title: `${production_target.title} Resume`,
        review_id: "",
        run_id: "",
        candidate_dir: "",
        candidate_identity: null,
        production_target,
        research_context: null,
        stages: [
          {
            stage: "duplicate_preflight",
            start: skipAt,
            finish: skipAt,
            duration_ms: 0,
            status: "completed",
            input_reference: null,
            output_reference: join(CYCLE_LOG, "duplicate-preflight-latest.json"),
            validation: {
              pass: true,
              detail: `SKIP_DUPLICATE:${duplicate_decision.duplicate_type}`,
            },
          },
        ],
        state: "DUPLICATE_SKIPPED",
        founder_decision: null,
        decision_id: null,
        learning_count: 0,
        critic_ready: false,
        publication_allowed: false,
        paused: false,
        duplicate_decision,
        revision: null,
      };
    }
  }

  const identity = allocateCandidateIdentity(production_target);
  const ws = createCandidateWorkspace(
    CYCLE_LOG,
    identity,
    production_target,
    opts?.batch ?? null,
    {
      registry_kind,
      verification_context: verification_context ?? null,
    },
  );
  ws.writeLatestPointer("RUNNING");

  if (duplicate_decision?.decision === "ALLOW") {
    ws.updateManifest({
      duplicate_control: buildDuplicateControlMeta(
        duplicate_decision,
        Boolean(opts?.duplicate_context),
      ),
    });
  } else if (!duplicate_decision) {
    // Preflight disabled but still stamp fingerprint for registry compatibility
    const forced = evaluateDuplicate({
      target: production_target,
      cycleLog: CYCLE_LOG,
      batchLocal: opts?.duplicate_context ?? null,
      registry_kind,
    });
    if (forced.decision === "ALLOW") {
      duplicate_decision = forced;
      ws.updateManifest({
        duplicate_control: buildDuplicateControlMeta(
          forced,
          Boolean(opts?.duplicate_context),
        ),
      });
    }
  }

  const task_id = identity.task_id;
  const cycle_id = identity.cycle_id;
  const candidate_id = identity.candidate_id;
  const candidate_title = identity.candidate_title;
  const review_id = identity.review_id;
  const run_id = identity.run_id;
  const objective = production_target.objective;
  const pause_for_founder = opts?.pause_for_founder !== false;

  const stages: StageRecord[] = [];
  const learning_count = 0;
  const decision_id: string | null = null;
  let critic_ready = false;
  let paused = false;
  // Mutable bag — assignments inside stage closures must remain readable outside.
  const cx: {
    cycleState: CycleResult["state"];
    terminalWritten: boolean;
    provider: string;
  } = {
    cycleState: "FAILED",
    terminalWritten: false,
    provider: "mock",
  };
  let providerPath = "";
  let designbriefResumeJson = "";
  let designbriefLayout = "";
  let knowledgeOut = "";
  let skillsOut = "";
  let brainOut = "";
  let criticScores: {
    overall: number;
    ats: number;
    visual: number;
    typography: number;
    layout: number;
    technical: number;
    consistency: number;
    sections: number;
    ready: boolean;
  } | null = null;
  let gateResult: Awaited<ReturnType<CriticGate["evaluate"]>> | null = null;
  let research_context = buildResearchContext(production_target);
  let researchBriefing = formatResearchBriefing(research_context);
  let revisionOutcome: RevisionLoopOutcome | null = null;

  const markFailed = (failure_stage: string, failure_detail: string) => {
    if (cx.terminalWritten) return;
    cx.terminalWritten = true;
    cx.cycleState = "FAILED";
    ws.updateManifest({
      status: "FAILED",
      provider: cx.provider,
      failure_stage,
      failure_detail,
    });
    ws.writeLatestPointer("FAILED");
  };

  const markPreviewFailed = (failure_detail: string) => {
    if (cx.terminalWritten) return;
    cx.terminalWritten = true;
    cx.cycleState = "PREVIEW_FAILED";
    ws.updateManifest({
      status: "PREVIEW_FAILED",
      provider: cx.provider,
      failure_stage: "preview",
      failure_detail,
    });
    ws.writeLatestPointer("PREVIEW_FAILED");
  };

  const markThumbnailFailed = (failure_detail: string) => {
    if (cx.terminalWritten) return;
    cx.terminalWritten = true;
    cx.cycleState = "THUMBNAIL_FAILED";
    ws.updateManifest({
      status: "THUMBNAIL_FAILED",
      provider: cx.provider,
      failure_stage: "thumbnail",
      failure_detail,
    });
    ws.writeLatestPointer("THUMBNAIL_FAILED");
  };

  const markWaitingFounder = () => {
    if (cx.terminalWritten) return;
    // Agent #233 — Ready for Review requires preview + thumbnail
    const previewAbs = join(ws.dir, "preview.png");
    const thumbAbs = join(ws.dir, "thumbnail.png");
    if (!existsSync(previewAbs)) {
      markPreviewFailed("refusing WAITING_FOUNDER without preview.png");
      return;
    }
    if (!existsSync(thumbAbs)) {
      markThumbnailFailed("refusing WAITING_FOUNDER without thumbnail.png");
      return;
    }
    cx.terminalWritten = true;
    cx.cycleState = "WAITING_FOUNDER";
    ws.updateManifest({
      status: "WAITING_FOUNDER",
      provider: cx.provider,
      failure_stage: null,
      failure_detail: null,
      template_id: identity.candidate_id,
      product_kind: "resume_template",
    });
    ws.writeLatestPointer("WAITING_FOUNDER");
  };

  const markCriticBlocked = () => {
    if (cx.terminalWritten) return;
    cx.terminalWritten = true;
    cx.cycleState = "CRITIC_BLOCKED";
    ws.updateManifest({
      status: "CRITIC_BLOCKED",
      provider: cx.provider,
      failure_stage: null,
      failure_detail: null,
    });
    ws.writeLatestPointer("CRITIC_BLOCKED");
  };

  const markRoleIntegrityFailed = (detail: string) => {
    if (cx.terminalWritten) return;
    cx.terminalWritten = true;
    cx.cycleState = "ROLE_INTEGRITY_FAILED";
    ws.updateManifest({
      status: "ROLE_INTEGRITY_FAILED",
      provider: cx.provider,
      failure_stage: "role_target_integrity",
      failure_detail: detail,
    });
    ws.writeLatestPointer("ROLE_INTEGRITY_FAILED");
  };

  try {
    // 1. Scheduler
    stages.push(
      await runStage("scheduler", null, async () => {
        const out = ws.writeArtifact("scheduler.json", {
          accepted: true,
          task_id,
          cycle_id,
          run_id,
          mode: "dry_run",
          at: new Date().toISOString(),
        });
        return {
          output_reference: out,
          validation: { pass: true, detail: "job accepted" },
        };
      }),
    );

    // 2. Queue
    stages.push(
      await runStage("queue", stages[0].output_reference, async () => {
        const out = ws.writeArtifact("queue.json", {
          queued: true,
          task_id,
          position: 1,
          department: "resume",
        });
        return {
          output_reference: out,
          validation: { pass: true, detail: "enqueued" },
        };
      }),
    );

    // 3. Production intake — decide WHAT to build (before any AI planning)
    stages.push(
      await runStage(
        "production_intake",
        stages[1].output_reference,
        async () => {
          const out = ws.writeArtifact("production-target.json", {
            ...production_target,
            selected_at: new Date().toISOString(),
            owner: "canonical_resume_production_intake",
            ai_planner: false,
            company_brain: false,
          });
          const ok =
            Boolean(production_target.category) &&
            Boolean(production_target.title) &&
            Boolean(production_target.industry) &&
            Boolean(production_target.seniority) &&
            Boolean(production_target.objective);
          return {
            output_reference: out,
            validation: {
              pass: ok,
              detail: ok
                ? `target=${production_target.category}/${production_target.title}`
                : "incomplete production target",
            },
          };
        },
      ),
    );

    // 4. Research — enrich ProductionTarget before AI planning
    research_context = buildResearchContext(production_target);
    researchBriefing = formatResearchBriefing(research_context);
    stages.push(
      await runStage("research", stages[2].output_reference, async () => {
        const out = ws.writeArtifact("research-context.json", research_context);
        ws.writeArtifact("research-handoff.json", {
          production_target,
          research_attached: true,
          research_briefing: researchBriefing,
          sources: research_context.research_sources,
          owner: "canonical_resume_research",
          ai_planner: false,
        });
        return {
          output_reference: out,
          validation: {
            pass: assertResearchContext(research_context),
            detail: assertResearchContext(research_context)
              ? `research=${research_context.category}; sources=${research_context.research_sources.length}`
              : "incomplete research context",
          },
        };
      }),
    );

    // 5. Resume Department
    stages.push(
      await runStage(
        "resume_department",
        stages[3].output_reference,
        async () => {
          const out = ws.writeArtifact("resume-department.json", {
            department: "resume",
            dry_run: true,
            auto_publish: false,
            candidate_id,
            candidate_title,
            objective,
            production_target,
            research_context_ref: join(ws.dir, "research-context.json"),
          });
          return {
            output_reference: out,
            validation: { pass: true, detail: "department admitted candidate" },
          };
        },
      ),
    );

    // 6–9. Knowledge → Skills → Brain → Provider (via ResumeKnowledgeGateway)
    const gwStage = await runStage(
      "knowledge_skills_brain_mock",
      stages[4].output_reference,
      async () => {
        const gw = new ResumeKnowledgeGateway();
        const result = await gw.executeWithKnowledge({
          operation: "planning",
          task_id,
          objective,
          input: {
            role_family: production_target.role_family,
            category: production_target.category,
            title: production_target.title,
            industry: production_target.industry,
            seniority: production_target.seniority,
            production_target,
            research_context,
            research_briefing: researchBriefing,
            constraints: {
              ats_friendly: true,
              columns: research_context.layout_guidance.columns,
              section_order: research_context.layout_guidance.section_order,
            },
            cycle: "first_production_cycle",
          },
          dry_run: true,
        });

        const selectedProvider =
          result.selected_provider ??
          result.primary_response?.provider ??
          result.consumed?.provider ??
          "mock";
        cx.provider = selectedProvider;
        const usedOpenAI = selectedProvider === "openai";

        knowledgeOut = ws.writeArtifact("knowledge.json", {
          snapshot_id: result.knowledge_snapshot?.meta?.snapshot_id ?? null,
          domains: result.domains_loaded,
          references: result.knowledge_references,
          learning_merged: result.knowledge?.learning_merged ?? null,
        });

        skillsOut = ws.writeArtifact("skills.json", {
          skill_id: result.skill_request.skill_id,
          status: result.primary_response?.status ?? null,
        });

        brainOut = ws.writeArtifact("brain.json", {
          provider: selectedProvider,
          router: "ResumeBrainGateway",
          dry_run: result.skill_request.dry_run,
          openai: usedOpenAI,
          research_attached: Boolean(
            result.skill_request.input.research_context,
          ),
          research_briefing_present: Boolean(
            result.skill_request.input.research_briefing,
          ),
          steps: result.steps.map((s) => s.skill_id),
          founder_memory_consumed: Boolean(
            result.founder_memory_selection?.FOUNDER_MEMORY_CONSUMED,
          ),
          founder_memory_ids:
            result.founder_memory_selection?.memory_ids ?? [],
        });
        if (result.founder_memory_selection) {
          ws.writeArtifact(
            "founder-memory-selection.json",
            result.founder_memory_selection,
          );
        }

        providerPath = ws.writeArtifact("mock-provider.json", {
          provider: selectedProvider,
          status: result.primary_response?.status ?? "FAILED",
          structured_output: result.primary_response?.structured_output ?? null,
          consumed: result.consumed,
          template_generated: false,
          published: false,
          openai_execution: {
            provider: selectedProvider,
            model:
              result.primary_response?.model_identifier_internal ??
              result.consumed?.model_identifier_internal ??
              null,
            provider_request_id:
              result.primary_response?.provider_request_id ??
              result.consumed?.provider_request_id ??
              null,
            input_tokens:
              result.primary_response?.input_tokens ??
              result.consumed?.tokens?.input ??
              null,
            output_tokens:
              result.primary_response?.output_tokens ??
              result.consumed?.tokens?.output ??
              null,
            estimated_cost_usd:
              result.primary_response?.estimated_cost_usd ??
              result.consumed?.estimated_cost_usd ??
              null,
            actual_cost_usd:
              result.primary_response?.actual_cost_usd ??
              result.consumed?.actual_cost_usd ??
              null,
            fallback_used: Boolean(
              result.primary_response?.fallback_used ??
                result.consumed?.fallback_used,
            ),
            latency_ms: result.primary_response?.latency_ms ?? null,
            prompt_refs: {
              skill_id: result.skill_request?.skill_id ?? null,
              task_id: result.skill_request?.task_id ?? null,
              objective: result.skill_request?.input?.objective ?? null,
            },
          },
        });

        const ok =
          result.primary_response?.status === "COMPLETED" &&
          result.primary_response.structured_output !== null &&
          process.env.SOS_AIOS_LIVE !== "1";

        return {
          output_reference: providerPath,
          validation: {
            pass: ok,
            detail: ok
              ? `Provider path completed (${selectedProvider})`
              : "Provider/knowledge path failed",
          },
          extra: { knowledgeOut, skillsOut, brainOut, result, selectedProvider },
        };
      },
    );
    // Expand into named stages for timeline compliance
    const bundleStart = gwStage.start;
    const bundleFinish = gwStage.finish;
    const half = Math.max(1, Math.round(gwStage.duration_ms / 4));
    const named = ["knowledge", "skills", "brain", "mock_provider"] as const;
    named.forEach((name, i) => {
      stages.push({
        stage: name,
        start: bundleStart,
        finish: bundleFinish,
        duration_ms: half,
        status: gwStage.status,
        input_reference:
          i === 0
            ? stages[4].output_reference
            : name === "skills"
              ? knowledgeOut || join(ws.dir, "knowledge.json")
              : name === "brain"
                ? skillsOut || join(ws.dir, "skills.json")
                : brainOut || join(ws.dir, "brain.json"),
        output_reference:
          name === "mock_provider"
            ? providerPath
            : name === "knowledge"
              ? knowledgeOut || join(ws.dir, "knowledge.json")
              : name === "skills"
                ? skillsOut || join(ws.dir, "skills.json")
                : brainOut || join(ws.dir, "brain.json"),
        validation: gwStage.validation,
      });
    });

    // 8. DesignBrief
    stages.push(
      await runStage("designbrief", providerPath, async () => {
        const engine = new DesignBriefEngine(REPO);
        const mock = JSON.parse(readFileSync(providerPath, "utf8")) as {
          structured_output?: Record<string, unknown> | null;
          consumed?: {
            structured_output?: Record<string, unknown> | null;
            skill_id?: string;
          };
        };
        const brain_raw =
          mock.structured_output ?? mock.consumed?.structured_output ?? {};
        if (!brain_raw || Object.keys(brain_raw).length === 0) {
          throw new Error("No structured_output for DesignBrief");
        }
        // Agent #235–237 — objective + role + design_family/variant for Family Engine
        const familyMatch = String(objective).match(
          /design_family\s*[:=]?\s*([a-z_]+)/i,
        );
        const variantMatch = String(objective).match(
          /design_variant\s*[:=]?\s*(\d+)/i,
        );
        const designVariant = variantMatch
          ? Number(variantMatch[1])
          : undefined;
        const brain_output = {
          ...brain_raw,
          objective,
          role_family: production_target.role_family,
          design_family: familyMatch?.[1] ?? undefined,
          design_variant: designVariant,
          notes: [
            ...(Array.isArray((brain_raw as { notes?: unknown }).notes)
              ? ((brain_raw as { notes: unknown[] }).notes.map(String))
              : []),
            String(objective),
            `role_family:${production_target.role_family}`,
            familyMatch ? `design_family:${familyMatch[1]}` : "",
            designVariant !== undefined
              ? `design_variant:${designVariant}`
              : "",
          ].filter(Boolean),
        };
        const result = engine.run({
          brain_output: brain_output as never,
          task_id,
          skill_id: mock.consumed?.skill_id ?? "resume.layout_planning",
          persist: true,
          fixture: false,
        });

        const out = ws.writeArtifact("designbrief.json", result.brief);
        designbriefResumeJson = join(
          REPO,
          "SOS/07_LOGS/saios/designbrief/resume-json-instructions.json",
        );
        designbriefLayout = join(
          REPO,
          "SOS/07_LOGS/saios/designbrief/layout-blueprint.json",
        );
        // Copy designbrief log into candidate (+ flat dual-write via writeArtifact)
        const resumeInstructions = JSON.parse(
          readFileSync(designbriefResumeJson, "utf8"),
        ) as unknown;
        ws.writeArtifact("resume-json-instructions.json", resumeInstructions);
        return {
          output_reference: out,
          validation: {
            pass: result.overall === "PASS" && result.brief.validation.pass,
            detail: `brief_id=${result.brief.brief_id}`,
          },
        };
      }),
    );

    // 9–10. Resume Renderer + Canvas JSON
    stages.push(
      await runStage(
        "resume_renderer",
        stages[stages.length - 1].output_reference,
        async () => {
          const renderer = createResumeRenderer(REPO);
          const rendered = renderer.render({
            resumeJsonPath: designbriefResumeJson,
            layoutBlueprintPath: designbriefLayout,
            taskId: task_id,
            persist: true,
          });
          const rendererCanvasPath = join(
            REPO,
            "SOS/07_LOGS/saios/resume-renderer/canvas.json",
          );
          const out = ws.writeArtifact("renderer.json", {
            overall: rendered.overall,
            object_count: rendered.canvas_json.objects.length,
            overflow: rendered.overflow.overflow,
            validation: rendered.validation,
            fabric_version: rendered.canvas_json.version,
          });
          const canvasParsed = JSON.parse(
            readFileSync(rendererCanvasPath, "utf8"),
          ) as unknown;
          ws.writeArtifact("canvas.json", canvasParsed);
          ws.writeArtifact("canvas-meta.json", {
            path: join(ws.dir, "canvas.json"),
            source_renderer: rendererCanvasPath,
            version: rendered.canvas_json.version,
            objects: rendered.canvas_json.objects.length,
          });
          // Agent #233 — preview + thumbnail mandatory (never swallow)
          try {
            await writePreviewAndThumbnailGuaranteed({
              canvasJson: canvasParsed as {
                version?: string;
                width?: number;
                height?: number;
                objects?: unknown[];
              },
              outputDir: ws.dir,
              reviewId: review_id,
            });
            ws.recordBinaryIfPresent("preview.png");
            ws.recordBinaryIfPresent("thumbnail.png");
          } catch (err) {
            if (err instanceof PreviewGuaranteeError) {
              if (err.code === "PREVIEW_FAILED") markPreviewFailed(err.detail);
              else markThumbnailFailed(err.detail);
              return {
                output_reference: out,
                validation: {
                  pass: false,
                  detail: err.message,
                },
                extra: rendered,
              };
            }
            const detail = err instanceof Error ? err.message : String(err);
            markPreviewFailed(detail);
            return {
              output_reference: out,
              validation: { pass: false, detail },
              extra: rendered,
            };
          }
          return {
            output_reference: out,
            validation: {
              pass: rendered.overall === "PASS",
              detail: `objects=${rendered.canvas_json.objects.length}`,
            },
            extra: rendered,
          };
        },
      ),
    );

    stages.push({
      stage: "canvas_json",
      start: stages[stages.length - 1].start,
      finish: stages[stages.length - 1].finish,
      duration_ms: 0,
      status: stages[stages.length - 1].status,
      input_reference: stages[stages.length - 1].output_reference,
      output_reference: join(ws.dir, "canvas.json"),
      validation: {
        pass: existsSync(join(ws.dir, "canvas.json")),
        detail: "Fabric 6.9.1 canvas persisted",
      },
    });

    // 11. Editor Compatibility (structural)
    stages.push(
      await runStage(
        "editor_compatibility",
        join(ws.dir, "canvas.json"),
        async () => {
          const canvas = JSON.parse(
            readFileSync(join(ws.dir, "canvas.json"), "utf8"),
          ) as {
            version: string;
            objects: Array<Record<string, unknown>>;
          };
          const required = [
            "version",
            "type",
            "left",
            "top",
            "width",
            "height",
            "originX",
            "id",
            "selectable",
            "evented",
          ];
          let ok = canvas.version === "6.9.1" && canvas.objects.length > 0;
          for (const o of canvas.objects) {
            for (const k of required) {
              if (o[k] === undefined) ok = false;
            }
          }
          const out = ws.writeArtifact("editor-compatibility.json", {
            conversion_required: false,
            fabric_version: canvas.version,
            object_count: canvas.objects.length,
            pass: ok,
          });
          return {
            output_reference: out,
            validation: {
              pass: ok,
              detail: ok ? "editor-compatible" : "schema gaps",
            },
          };
        },
      ),
    );

    // 12–13. Resume Critic + bounded RevisionLoop (#211) → Critic Gate
    const revisionEnabled = opts?.revision?.enabled !== false;
    const maxRevisions =
      opts?.revision?.max_revisions ?? MAX_AUTOMATIC_REVISIONS;

    const runEditorCompatCheck = (): boolean => {
      const canvas = JSON.parse(
        readFileSync(join(ws.dir, "canvas.json"), "utf8"),
      ) as {
        version: string;
        objects: Array<Record<string, unknown>>;
      };
      const required = [
        "version",
        "type",
        "left",
        "top",
        "width",
        "height",
        "originX",
        "id",
        "selectable",
        "evented",
      ];
      let ok = canvas.version === "6.9.1" && canvas.objects.length > 0;
      for (const o of canvas.objects) {
        for (const k of required) {
          if (o[k] === undefined) ok = false;
        }
      }
      ws.writeArtifact("editor-compatibility.json", {
        conversion_required: false,
        fabric_version: canvas.version,
        object_count: canvas.objects.length,
        pass: ok,
      });
      return ok;
    };

    const regenerateFromRevision = async (ctx: {
      revision_number: number;
      production_target: Record<string, unknown>;
      research_context: Record<string, unknown> | null;
      previous_brain_output: Record<string, unknown> | null;
      critic_findings: CriticFindingsBundle;
    }): Promise<void> => {
      const gw = new ResumeKnowledgeGateway();
      const result = await gw.executeWithKnowledge({
        operation: "planning",
        task_id,
        objective,
        input: {
          role_family: production_target.role_family,
          category: production_target.category,
          title: production_target.title,
          industry: production_target.industry,
          seniority: production_target.seniority,
          production_target,
          research_context,
          research_briefing: researchBriefing,
          constraints: {
            ats_friendly: true,
            columns: research_context.layout_guidance.columns,
            section_order: research_context.layout_guidance.section_order,
          },
          cycle: "first_production_cycle",
          revision_number: ctx.revision_number,
          revision_context: {
            revision_number: ctx.revision_number,
            previous_brain_output: ctx.previous_brain_output,
            critic_findings: ctx.critic_findings,
            original_target: production_target,
            research_attached: true,
          },
        },
        dry_run: true,
      });

      const selectedProvider =
        result.selected_provider ??
        result.primary_response?.provider ??
        result.consumed?.provider ??
        "mock";
      cx.provider = selectedProvider;

      ws.writeArtifact("knowledge.json", {
        snapshot_id: result.knowledge_snapshot?.meta?.snapshot_id ?? null,
        domains: result.domains_loaded,
        references: result.knowledge_references,
        learning_merged: result.knowledge?.learning_merged ?? null,
        revision_number: ctx.revision_number,
      });
      ws.writeArtifact("skills.json", {
        skill_id: result.skill_request.skill_id,
        status: result.primary_response?.status ?? null,
        revision_number: ctx.revision_number,
      });
      brainOut = ws.writeArtifact("brain.json", {
        provider: selectedProvider,
        router: "ResumeBrainGateway",
        dry_run: result.skill_request.dry_run,
        openai: selectedProvider === "openai",
        revision_number: ctx.revision_number,
        research_attached: Boolean(
          result.skill_request.input.research_context,
        ),
        steps: result.steps.map((s) => s.skill_id),
        founder_memory_consumed: Boolean(
          result.founder_memory_selection?.FOUNDER_MEMORY_CONSUMED,
        ),
        founder_memory_ids:
          result.founder_memory_selection?.memory_ids ?? [],
      });
      if (result.founder_memory_selection) {
        ws.writeArtifact(
          "founder-memory-selection.json",
          result.founder_memory_selection,
        );
      }
      providerPath = ws.writeArtifact("mock-provider.json", {
        provider: selectedProvider,
        status: result.primary_response?.status ?? "FAILED",
        structured_output: result.primary_response?.structured_output ?? null,
        consumed: result.consumed,
        template_generated: false,
        published: false,
        revision_number: ctx.revision_number,
        openai_execution: {
          provider: selectedProvider,
          model:
            result.primary_response?.model_identifier_internal ??
            result.consumed?.model_identifier_internal ??
            null,
          provider_request_id:
            result.primary_response?.provider_request_id ??
            result.consumed?.provider_request_id ??
            null,
          input_tokens:
            result.primary_response?.input_tokens ??
            result.consumed?.tokens?.input ??
            null,
          output_tokens:
            result.primary_response?.output_tokens ??
            result.consumed?.tokens?.output ??
            null,
          estimated_cost_usd:
            result.primary_response?.estimated_cost_usd ??
            result.consumed?.estimated_cost_usd ??
            null,
          actual_cost_usd:
            result.primary_response?.actual_cost_usd ??
            result.consumed?.actual_cost_usd ??
            null,
          fallback_used: Boolean(
            result.primary_response?.fallback_used ??
              result.consumed?.fallback_used,
          ),
          latency_ms: result.primary_response?.latency_ms ?? null,
          prompt_refs: {
            skill_id: result.skill_request?.skill_id ?? null,
            task_id: result.skill_request?.task_id ?? null,
            objective: result.skill_request?.input?.objective ?? null,
            revision_number: ctx.revision_number,
          },
        },
      });

      if (
        result.primary_response?.status !== "COMPLETED" ||
        result.primary_response.structured_output === null
      ) {
        throw new Error(
          `Revision ${ctx.revision_number}: provider/knowledge path failed`,
        );
      }

      const engine = new DesignBriefEngine(REPO);
      const brain_raw =
        result.primary_response.structured_output ??
        result.consumed?.structured_output ??
        {};
      const familyMatch = String(production_target.objective).match(
        /design_family\s*[:=]?\s*([a-z_]+)/i,
      );
      const variantMatch = String(production_target.objective).match(
        /design_variant\s*[:=]?\s*(\d+)/i,
      );
      const designVariant = variantMatch
        ? Number(variantMatch[1])
        : undefined;
      const brain_output = {
        ...brain_raw,
        objective: production_target.objective,
        role_family: production_target.role_family,
        design_family: familyMatch?.[1] ?? undefined,
        design_variant: designVariant,
        notes: [
          ...(Array.isArray((brain_raw as { notes?: unknown }).notes)
            ? ((brain_raw as { notes: unknown[] }).notes.map(String))
            : []),
          String(production_target.objective),
          `role_family:${production_target.role_family}`,
          familyMatch ? `design_family:${familyMatch[1]}` : "",
          designVariant !== undefined
            ? `design_variant:${designVariant}`
            : "",
        ].filter(Boolean),
      };
      const briefResult = engine.run({
        brain_output: brain_output as never,
        task_id,
        skill_id: result.consumed?.skill_id ?? "resume.layout_planning",
        persist: true,
        fixture: false,
      });
      ws.writeArtifact("designbrief.json", {
        ...briefResult.brief,
        revision_number: ctx.revision_number,
      });
      designbriefResumeJson = join(
        REPO,
        "SOS/07_LOGS/saios/designbrief/resume-json-instructions.json",
      );
      designbriefLayout = join(
        REPO,
        "SOS/07_LOGS/saios/designbrief/layout-blueprint.json",
      );
      const resumeInstructions = JSON.parse(
        readFileSync(designbriefResumeJson, "utf8"),
      ) as unknown;
      ws.writeArtifact("resume-json-instructions.json", resumeInstructions);

      const renderer = createResumeRenderer(REPO);
      const rendered = renderer.render({
        resumeJsonPath: designbriefResumeJson,
        layoutBlueprintPath: designbriefLayout,
        taskId: task_id,
        persist: true,
      });
      const rendererCanvasPath = join(
        REPO,
        "SOS/07_LOGS/saios/resume-renderer/canvas.json",
      );
      ws.writeArtifact("renderer.json", {
        overall: rendered.overall,
        object_count: rendered.canvas_json.objects.length,
        overflow: rendered.overflow.overflow,
        validation: rendered.validation,
        fabric_version: rendered.canvas_json.version,
        revision_number: ctx.revision_number,
      });
      const canvasParsed = JSON.parse(
        readFileSync(rendererCanvasPath, "utf8"),
      ) as unknown;
      ws.writeArtifact("canvas.json", canvasParsed);
      ws.writeArtifact("canvas-meta.json", {
        path: join(ws.dir, "canvas.json"),
        source_renderer: rendererCanvasPath,
        version: rendered.canvas_json.version,
        objects: rendered.canvas_json.objects.length,
        revision_number: ctx.revision_number,
      });
      try {
        await writePreviewAndThumbnailGuaranteed({
          canvasJson: canvasParsed as {
            version?: string;
            width?: number;
            height?: number;
            objects?: unknown[];
          },
          outputDir: ws.dir,
          reviewId: review_id,
        });
        ws.recordBinaryIfPresent("preview.png");
        ws.recordBinaryIfPresent("thumbnail.png");
      } catch (err) {
        if (err instanceof PreviewGuaranteeError) {
          throw err;
        }
        throw new PreviewGuaranteeError(
          "PREVIEW_FAILED",
          err instanceof Error ? err.message : String(err),
        );
      }

      if (!runEditorCompatCheck()) {
        throw new Error(
          `Revision ${ctx.revision_number}: editor compatibility failed`,
        );
      }
    };

    stages.push(
      await runStage(
        "revision_loop",
        join(ws.dir, "editor-compatibility.json"),
        async () => {
          try {
          if (!revisionEnabled) {
            // Single critic pass only (no automatic revisions)
            const critic = createResumeCritic(REPO);
            const result = critic.critique({
              canvasPath: join(ws.dir, "canvas.json"),
              resumeJsonPath: join(ws.dir, "resume-json-instructions.json"),
              overflowPath: join(
                REPO,
                "SOS/07_LOGS/saios/resume-renderer/overflow.json",
              ),
              validationPath: join(
                REPO,
                "SOS/07_LOGS/saios/resume-renderer/validation.json",
              ),
              persist: true,
            });
            criticScores = {
              ...result.scores,
              ready: result.readiness.ready,
            };
            critic_ready = result.readiness.ready;
            ws.writeArtifact("critic.json", {
              scores: result.scores,
              readiness: result.readiness,
              used_ai: false,
              used_mock_provider: false,
              revision_number: 0,
            });
            revisionOutcome = {
              outcome: result.readiness.ready ? "PASS" : "CRITIC_BLOCKED",
              final_ready: result.readiness.ready,
              final_scores: criticScores,
              revisions_performed: 0,
              attempts: 1,
              max_revisions: 0,
              history: [],
              history_path: "",
            };
            const out = ws.writeArtifact("revision-loop.json", revisionOutcome);
            return {
              output_reference: out,
              validation: {
                pass: true,
                detail: "revision loop disabled — single critic pass",
              },
            };
          }

          revisionOutcome = await runRevisionLoop({
            candidateDir: ws.dir,
            max_revisions: maxRevisions,
            hooks: {
              force_fail_through_attempt:
                opts?.revision?.force_fail_through_attempt ?? null,
            },
            critique: (revision_number) => {
              const critic = createResumeCritic(REPO);
              const result = critic.critique({
                canvasPath: join(ws.dir, "canvas.json"),
                resumeJsonPath: join(ws.dir, "resume-json-instructions.json"),
                overflowPath: join(
                  REPO,
                  "SOS/07_LOGS/saios/resume-renderer/overflow.json",
                ),
                validationPath: join(
                  REPO,
                  "SOS/07_LOGS/saios/resume-renderer/validation.json",
                ),
                persist: true,
              });
              const findings: CriticFindingsBundle["findings"] = [];
              for (const [category, report] of Object.entries(result.reports)) {
                for (const f of report.findings) {
                  findings.push({
                    category,
                    code: f.code,
                    severity: f.severity,
                    message: f.message,
                    points_deducted: f.points_deducted,
                  });
                }
              }
              const critic_artifact = {
                scores: result.scores,
                readiness: result.readiness,
                used_ai: false,
                used_mock_provider: false,
                revision_number,
                findings_count: findings.length,
              };
              ws.writeArtifact("critic.json", critic_artifact);
              return {
                ready: result.readiness.ready,
                scores: {
                  ...result.scores,
                  ready: result.readiness.ready,
                },
                blocked_reasons: result.readiness.blocked_reasons,
                findings,
                critic_artifact,
              };
            },
            buildContext: (next_revision_number, critic) => ({
              revision_number: next_revision_number,
              production_target: {
                category: production_target.category,
                title: production_target.title,
                industry: production_target.industry,
                seniority: production_target.seniority,
                objective: production_target.objective,
                role_family: production_target.role_family,
              },
              research_context: research_context as unknown as Record<
                string,
                unknown
              >,
              previous_brain_output: readPreviousBrainOutput(ws.dir),
              critic_findings: {
                blocked_reasons: critic.blocked_reasons,
                findings: critic.findings,
                scores: critic.scores,
              },
            }),
            revise: regenerateFromRevision,
          });

          criticScores = revisionOutcome.final_scores;
          critic_ready = revisionOutcome.final_ready;
          const out = ws.writeArtifact("revision-loop.json", {
            outcome: revisionOutcome.outcome,
            revisions_performed: revisionOutcome.revisions_performed,
            attempts: revisionOutcome.attempts,
            max_revisions: revisionOutcome.max_revisions,
            final_ready: revisionOutcome.final_ready,
            history_path: revisionOutcome.history_path,
            publication_allowed: false,
          });
          return {
            output_reference: out,
            validation: {
              pass: true,
              detail: `outcome=${revisionOutcome.outcome} revisions=${revisionOutcome.revisions_performed}/${revisionOutcome.max_revisions}`,
            },
          };
          } catch (err) {
            if (err instanceof PreviewGuaranteeError) {
              if (err.code === "PREVIEW_FAILED") markPreviewFailed(err.detail);
              else markThumbnailFailed(err.detail);
              return {
                output_reference: join(ws.dir, "preview-error.json"),
                validation: { pass: false, detail: err.message },
              };
            }
            throw err;
          }
        },
      ),
    );

    // Final critic artifact stage (authoritative latest critic.json)
    stages.push(
      await runStage("resume_critic", join(ws.dir, "revision-loop.json"), async () => {
        const ready = Boolean(criticScores?.ready);
        const technical = criticScores?.technical ?? 0;
        return {
          output_reference: join(ws.dir, "critic.json"),
          validation: {
            pass: ready && technical === 100,
            detail: `ready=${ready} overall=${criticScores?.overall ?? "n/a"} revisions=${revisionOutcome?.revisions_performed ?? 0}`,
          },
        };
      }),
    );

    // Phase 6A — pre-Founder professional role-target integrity (hard gate)
    let roleIntegrity: RoleTargetIntegrityResult | null = null;
    stages.push(
      await runStage(
        "role_target_integrity",
        join(ws.dir, "canvas.json"),
        async () => {
          const canvas = JSON.parse(
            readFileSync(join(ws.dir, "canvas.json"), "utf8"),
          ) as { objects?: unknown[] };
          let resumeContent: unknown = null;
          const rjPath = join(ws.dir, "resume-json-instructions.json");
          if (existsSync(rjPath)) {
            try {
              const rj = JSON.parse(readFileSync(rjPath, "utf8")) as {
                visual_guidance?: {
                  resume_content?: unknown;
                  openai_resume_content?: unknown;
                  role_family?: string;
                };
              };
              resumeContent =
                rj.visual_guidance?.resume_content ??
                rj.visual_guidance?.openai_resume_content ??
                null;
            } catch {
              resumeContent = null;
            }
          }
          // Mock/deterministic path may not persist resume_content on VG —
          // recover structured title from the pack that BlockRenderer used.
          let sampleTitle: string | null = null;
          let packFamily: string | null = null;
          let contentSource: "openai" | "deterministic_pack" | "unknown" =
            cx.provider === "openai"
              ? "openai"
              : cx.provider === "mock"
                ? "deterministic_pack"
                : "unknown";
          if (resumeContent && typeof resumeContent === "object") {
            sampleTitle = String(
              (resumeContent as { title?: unknown }).title ?? "",
            ).trim() || null;
            contentSource = "openai";
          } else {
            const pack = resolveRoleSample({
              roleFamily: production_target.role_family,
            });
            if (pack.ok) {
              sampleTitle = pack.sample.title;
              packFamily = pack.pack_family;
              contentSource = pack.source;
            }
          }
          roleIntegrity = evaluateCanvasRoleTargetIntegrity({
            target_title: production_target.title,
            target_role_family: production_target.role_family,
            canvas,
            resume_content: resumeContent,
            openai_resume_content: resumeContent,
            sample_title: sampleTitle,
            content_source: contentSource,
            pack_family: packFamily,
          });
          const out = ws.writeArtifact(
            "role-target-integrity.json",
            roleIntegrity,
          );
          if (!roleIntegrity.pass) {
            critic_ready = false;
            markRoleIntegrityFailed(roleIntegrity.reason);
          }
          return {
            output_reference: out,
            validation: {
              pass: roleIntegrity.pass,
              detail: `${roleIntegrity.match}: ${roleIntegrity.reason}`,
            },
          };
        },
      ),
    );

    // 13. Critic Gate
    stages.push(
      await runStage("critic_gate", join(ws.dir, "critic.json"), async () => {
        if (!criticScores) throw new Error("missing critic scores");
        const gate = new CriticGate();
        gateResult = gate.evaluate({
          task_id,
          cycle_id,
          candidate_id,
          candidate_title,
          fixture: false,
          critic_report_reference:
            "SOS/07_LOGS/saios/resume-critic/readiness.json",
          scores: criticScores,
        });
        const out = ws.writeArtifact("gate.json", {
          gate: gateResult.gate,
          review_create: gateResult.review_create,
          queue: gateResult.queue,
          revision_outcome: revisionOutcome?.outcome ?? null,
          revisions_performed: revisionOutcome?.revisions_performed ?? 0,
        });
        return {
          output_reference: out,
          validation: {
            pass:
              gateResult.gate.ready &&
              gateResult.review_create.allowed &&
              gateResult.gate.publication_allowed === false,
            detail: `ready=${gateResult.gate.ready} review_allowed=${gateResult.review_create.allowed}`,
          },
        };
      }),
    );

    // 14. Founder Review Queue
    stages.push(
      await runStage(
        "founder_review_queue",
        join(ws.dir, "gate.json"),
        async () => {
          const out = ws.writeArtifact("review.json", {
            review_id,
            task_id,
            cycle_id,
            run_id,
            candidate_id,
            status: "waiting_founder",
            critic_ready,
            founder_review_allowed:
              gateResult?.gate.founder_review_allowed ?? false,
            publication_allowed: false,
            queue_action_id: gateResult?.queue.added_id ?? null,
            dashboard: "SOS/SAIOS/dashboard Founder Review",
            auto_decision: false,
            candidate_dir: ws.dir,
          });
          return {
            output_reference: out,
            validation: {
              pass: Boolean(gateResult?.gate.founder_review_allowed),
              detail: "queued for interactive founder decision",
            },
          };
        },
      ),
    );

    // Pre-write dashboard so pause artifact_references resolve to real files
    ws.writeArtifact("dashboard.json", {
      current_stage: "WAITING_FOUNDER",
      current_candidate: candidate_title,
      current_duration_ms: stages.reduce((a, s) => a + s.duration_ms, 0),
      current_queue: gateResult?.queue.added_id ?? null,
      critic_score: criticScores,
      founder_waiting: true,
      completed_cycle: false,
      recent_learning: 0,
      task_id,
      cycle_id,
      run_id,
      review_id,
      candidate_id,
      candidate_dir: ws.dir,
      candidate_manifest: join(ws.dir, "candidate.json"),
      publication_allowed: false,
      live: false,
      provider: cx.provider,
      production_target,
      research_context_present: true,
      paused: true,
      waiting_banner:
        "WAITING FOR FOUNDER — execution paused — no automatic decision — no automatic publication",
    });

    // 15. WAITING_FOUNDER pause — real path never auto-decides
    stages.push(
      await runStage(
        "waiting_founder",
        join(ws.dir, "review.json"),
        async () => {
          if (!pause_for_founder) {
            throw new Error(
              "Auto-decision removed from real cycle path — use founder-gate-runtime fixtures",
            );
          }
          if (!critic_ready || !gateResult?.gate.ready) {
            if (cx.cycleState !== "ROLE_INTEGRITY_FAILED") {
              markCriticBlocked();
            }
            const out = ws.writeArtifact("waiting-founder.json", {
              state: cx.cycleState,
              message:
                cx.cycleState === "ROLE_INTEGRITY_FAILED"
                  ? "Role-target integrity failed — never reaches founder gate"
                  : "Critic blocked — never reaches founder gate",
              candidate_dir: ws.dir,
              role_integrity: roleIntegrity,
            });
            return {
              output_reference: out,
              validation: {
                pass: true,
                detail:
                  cx.cycleState === "ROLE_INTEGRITY_FAILED"
                    ? "role integrity blocked — no founder pause"
                    : "critic blocked — no founder pause",
              },
            };
          }

          const priorOk = stages.every(
            (s) => s.status === "completed" && s.validation.pass,
          );
          if (!priorOk) {
            const failed = stages.find(
              (s) => s.status === "failed" || !s.validation.pass,
            );
            if (
              cx.cycleState !== "PREVIEW_FAILED" &&
              cx.cycleState !== "THUMBNAIL_FAILED"
            ) {
              markFailed(
                failed?.stage ?? "pre_founder",
                failed?.validation.detail ??
                  "prior stage failed — not WAITING_FOUNDER",
              );
            }
            const out = ws.writeArtifact("waiting-founder.json", {
              state: cx.cycleState,
              message:
                cx.cycleState === "PREVIEW_FAILED" ||
                cx.cycleState === "THUMBNAIL_FAILED"
                  ? "Preview/thumbnail guarantee failed — not Ready for Review"
                  : "Prior stage failed — refusing WAITING_FOUNDER",
              candidate_dir: ws.dir,
            });
            return {
              output_reference: out,
              validation: {
                pass: false,
                detail:
                  failed?.validation.detail ??
                  "refused WAITING_FOUNDER after prior failure",
              },
            };
          }

          // Agent #233 — require assets before founder pause
          if (!existsSync(join(ws.dir, "preview.png"))) {
            markPreviewFailed("missing preview.png before founder pause");
            const out = ws.writeArtifact("waiting-founder.json", {
              state: "PREVIEW_FAILED",
              message: "Preview required for Ready for Review",
              candidate_dir: ws.dir,
            });
            return {
              output_reference: out,
              validation: { pass: false, detail: "PREVIEW_FAILED" },
            };
          }
          if (!existsSync(join(ws.dir, "thumbnail.png"))) {
            markThumbnailFailed("missing thumbnail.png before founder pause");
            const out = ws.writeArtifact("waiting-founder.json", {
              state: "THUMBNAIL_FAILED",
              message: "Thumbnail required for Ready for Review",
              candidate_dir: ws.dir,
            });
            return {
              output_reference: out,
              validation: { pass: false, detail: "THUMBNAIL_FAILED" },
            };
          }

          const founderGate = createFounderGateRuntime();
          const completed = stages
            .filter((s) => s.status === "completed")
            .map((s) => s.stage);
          const artifact_references: Record<string, string> = {
            canvas: join(ws.dir, "canvas.json"),
            critic: join(ws.dir, "critic.json"),
            gate: join(ws.dir, "gate.json"),
            review: join(ws.dir, "review.json"),
            designbrief: join(ws.dir, "designbrief.json"),
            production_target: join(ws.dir, "production-target.json"),
            research_context: join(ws.dir, "research-context.json"),
            dashboard: join(ws.dir, "dashboard.json"),
            candidate_dir: ws.dir,
            candidate_manifest: join(ws.dir, "candidate.json"),
          };
          const previewAbs = join(ws.dir, "preview.png");
          const thumbAbs = join(ws.dir, "thumbnail.png");
          if (existsSync(previewAbs)) artifact_references.preview = previewAbs;
          if (existsSync(thumbAbs)) artifact_references.thumbnail = thumbAbs;

          const cp = founderGate.pause({
            cycle_id,
            task_id,
            candidate_id,
            candidate_title,
            review_id,
            completed_stages: [...completed, "founder_review_queue"],
            artifact_references,
            critic_result: criticScores
              ? {
                  overall: criticScores.overall,
                  ats: criticScores.ats,
                  technical: criticScores.technical,
                  ready: criticScores.ready,
                }
              : null,
            queue_action_id: gateResult?.queue.added_id ?? null,
            from_state: "CRITIC_EVALUATION",
            fixture: false,
          });

          paused = true;
          markWaitingFounder();

          // Agent #233 — canonical Resume Template object + runtime report
          if (cx.cycleState === "WAITING_FOUNDER") {
            let editorStatus: "PASS" | "FAIL" | "UNKNOWN" = "UNKNOWN";
            try {
              const ec = JSON.parse(
                readFileSync(join(ws.dir, "editor-compatibility.json"), "utf8"),
              ) as { pass?: boolean };
              editorStatus = ec.pass === true ? "PASS" : "FAIL";
            } catch {
              /* unknown */
            }
            let designFamily: string | null = null;
            try {
              const db = JSON.parse(
                readFileSync(join(ws.dir, "designbrief.json"), "utf8"),
              ) as { design_family?: string; family?: string };
              designFamily = db.design_family ?? db.family ?? null;
            } catch {
              /* optional */
            }
            const tmpl = buildResumeTemplateObject({
              manifest: ws.getManifest(),
              research_summary: researchBriefing.slice(0, 500),
              ats_family: production_target.role_family,
              design_family: designFamily,
              editor_compatibility_status: editorStatus,
              critic_score: criticScores?.overall ?? null,
              ats_score: criticScores?.ats ?? null,
              overall_quality_score: criticScores?.overall ?? null,
              design_brief_summary: "designbrief.json",
            });
            writeResumeTemplateRuntimeReport({
              cycleLog: CYCLE_LOG,
              templateDir: ws.dir,
              template: tmpl,
            });
            ws.writeArtifact("resume-template.json", tmpl);
          }

          const out = ws.writeArtifact("waiting-founder.json", {
            state: cx.cycleState,
            checkpoint: cp,
            product_kind: "resume_template",
            founder_review_status:
              cx.cycleState === "WAITING_FOUNDER"
                ? "ready_for_review"
                : cx.cycleState.toLowerCase(),
            message:
              cx.cycleState === "WAITING_FOUNDER"
                ? "Resume Template ready for Founder Review. No auto-decision. No publication."
                : `Resume Template not Ready for Review (${cx.cycleState})`,
            live: false,
            dry_run: true,
            provider: cx.provider,
            template_id: candidate_id,
            candidate_id,
            review_id,
            candidate_dir: ws.dir,
            production_target_summary: {
              category: production_target.category,
              title: production_target.title,
              industry: production_target.industry,
              seniority: production_target.seniority,
            },
          });
          ws.writeArtifact("learning.json", {
            learning_count: 0,
            deferred: true,
            reason: "Learning writes only after interactive founder decision",
          });
          return {
            output_reference: out,
            validation: {
              pass: cp.state === "WAITING_FOUNDER" && cx.cycleState === "WAITING_FOUNDER",
              detail:
                cx.cycleState === "WAITING_FOUNDER"
                  ? "paused for founder — Ready for Review"
                  : cx.cycleState,
            },
          };
        },
      ),
    );

    // Cycle paused — not completed until dashboard decision
    stages.push(
      await runStage(
        "cycle_paused",
        join(ws.dir, "waiting-founder.json"),
        async () => {
          const out = ws.writeArtifact("cycle-complete.json", {
            task_id,
            cycle_id,
            run_id,
            candidate_id,
            review_id,
            candidate_dir: ws.dir,
            completed: false,
            paused: true,
            state: cx.cycleState,
            founder_decision: null,
            publication_allowed: false,
            live: false,
            note: "Resume only after interactive Founder Decision",
          });
          return {
            output_reference: out,
            validation: {
              pass:
                paused ||
                cx.cycleState === "CRITIC_BLOCKED" ||
                cx.cycleState === "ROLE_INTEGRITY_FAILED",
              detail: cx.cycleState,
            },
          };
        },
      ),
    );

    const requiredStages = [
      "scheduler",
      "queue",
      "production_intake",
      "research",
      "resume_department",
      "knowledge",
      "skills",
      "brain",
      "mock_provider",
      "designbrief",
      "resume_renderer",
      "canvas_json",
      "editor_compatibility",
      "resume_critic",
      "role_target_integrity",
      "critic_gate",
      "founder_review_queue",
      "waiting_founder",
      "cycle_paused",
    ];
    const present = new Set(stages.map((s) => s.stage));
    const allPresent = requiredStages.every((s) => present.has(s));
    const allOk = stages.every(
      (s) => s.status === "completed" && s.validation.pass,
    );

    if (
      cx.cycleState !== "WAITING_FOUNDER" &&
      cx.cycleState !== "CRITIC_BLOCKED" &&
      cx.cycleState !== "ROLE_INTEGRITY_FAILED" &&
      cx.cycleState !== "PREVIEW_FAILED" &&
      cx.cycleState !== "THUMBNAIL_FAILED"
    ) {
      const failed = stages.find(
        (s) => s.status === "failed" || !s.validation.pass,
      );
      markFailed(
        failed?.stage ?? "cycle",
        failed?.validation.detail ?? "cycle did not reach WAITING_FOUNDER",
      );
    } else if (!allOk && cx.cycleState === "WAITING_FOUNDER") {
      // Never leave WAITING_FOUNDER recorded if any stage failed
      const failed = stages.find(
        (s) => s.status === "failed" || !s.validation.pass,
      );
      cx.terminalWritten = false;
      markFailed(
        failed?.stage ?? "cycle",
        failed?.validation.detail ?? "stage failed after pause",
      );
      paused = false;
    }

    // Persist cycle reports (candidate + flat dual-write)
    ws.writeArtifact("timeline.json", {
      task_id,
      cycle_id,
      run_id,
      candidate_id,
      review_id,
      candidate_dir: ws.dir,
      stages,
      state: cx.cycleState,
    });
    ws.writeArtifact("pipeline.json", {
      pipeline: requiredStages,
      executed: stages.map((s) => s.stage),
      all_present: allPresent,
      stops_at: "WAITING_FOUNDER",
      auto_decision: false,
    });
    ws.writeArtifact("stage-durations.json", {
      stages: stages.map((s) => ({
        stage: s.stage,
        duration_ms: s.duration_ms,
        status: s.status,
      })),
      total_ms: stages.reduce((a, s) => a + s.duration_ms, 0),
    });

    const dashboard = {
      current_stage: cx.cycleState,
      current_candidate: candidate_title,
      current_duration_ms: stages.reduce((a, s) => a + s.duration_ms, 0),
      current_queue: gateResult?.queue.added_id ?? null,
      critic_score: criticScores,
      founder_waiting: cx.cycleState === "WAITING_FOUNDER",
      completed_cycle: false,
      recent_learning: 0,
      task_id,
      cycle_id,
      run_id,
      review_id,
      candidate_id,
      candidate_dir: ws.dir,
      candidate_manifest: join(ws.dir, "candidate.json"),
      publication_allowed: false,
      live: false,
      provider: cx.provider,
      production_target,
      research_context_present: true,
      paused: cx.cycleState === "WAITING_FOUNDER",
      waiting_banner:
        cx.cycleState === "WAITING_FOUNDER"
          ? "WAITING FOR FOUNDER — execution paused — no automatic decision — no automatic publication"
          : `state=${cx.cycleState}`,
    };
    ws.writeArtifact("dashboard.json", dashboard);

    const summary = [
      `# First Production Cycle Summary`,
      ``,
      `- candidate: **${candidate_title}** (\`${candidate_id}\`)`,
      `- target: **${production_target.category}** / ${production_target.title} / ${production_target.industry} / ${production_target.seniority}`,
      `- research: ATS ${research_context.ats_guidance.compatibility_tier} · ${research_context.layout_guidance.structure} · sources=${research_context.research_sources.length}`,
      `- task: \`${task_id}\``,
      `- cycle: \`${cycle_id}\``,
      `- run: \`${run_id}\``,
      `- review: \`${review_id}\``,
      `- candidate_dir: \`${ws.dir}\``,
      `- state: **${cx.cycleState}**`,
      `- paused: ${paused}`,
      `- founder decision: _(awaiting interactive dashboard)_`,
      `- learning entries: 0 (deferred)`,
      `- critic ready: ${critic_ready}`,
      `- revisions: ${revisionOutcome?.revisions_performed ?? 0}/${revisionOutcome?.max_revisions ?? MAX_AUTOMATIC_REVISIONS} · outcome=${revisionOutcome?.outcome ?? "n/a"}`,
      `- publication_allowed: false`,
      `- LIVE: OFF`,
      `- provider: ${cx.provider}`,
      `- auto_decision: false`,
      `- stages: ${stages.length} · all_present=${allPresent} · all_ok=${allOk}`,
      ``,
      `## Stage durations`,
      ``,
      ...stages.map((s) => `- ${s.stage}: ${s.duration_ms}ms · ${s.status}`),
      ``,
    ].join("\n");
    writeFileSync(join(ws.dir, "cycle-summary.md"), summary, "utf8");
    writeFileSync(join(CYCLE_LOG, "cycle-summary.md"), summary, "utf8");

    const overall: CycleResult["overall"] =
      allPresent && allOk && cx.cycleState === "WAITING_FOUNDER"
        ? "PASS"
        : "FAIL";

    if (overall === "FAIL" && !cx.terminalWritten) {
      const failed = stages.find(
        (s) => s.status === "failed" || !s.validation.pass,
      );
      markFailed(
        failed?.stage ?? "cycle",
        failed?.validation.detail ?? "cycle did not reach WAITING_FOUNDER",
      );
    }

    ws.writeArtifact("execution-summary.json", {
      task_id,
      cycle_id,
      run_id,
      review_id,
      candidate_id,
      candidate_title,
      candidate_dir: ws.dir,
      state: cx.cycleState,
      overall,
      paused,
      critic_ready,
      publication_allowed: false,
      provider: cx.provider,
      production_target,
      stages: stages.map((s) => ({
        stage: s.stage,
        status: s.status,
        duration_ms: s.duration_ms,
      })),
      completed_at: new Date().toISOString(),
    });

    void opts?.founderDecision;
    void opts?.founderActor;
    void opts?.founderReason;

    return {
      overall,
      task_id,
      cycle_id,
      candidate_id,
      candidate_title,
      review_id,
      run_id,
      candidate_dir: ws.dir,
      candidate_identity: identity,
      production_target,
      research_context,
      stages,
      state: cx.cycleState,
      founder_decision: null,
      decision_id,
      learning_count,
      critic_ready,
      publication_allowed: false,
      paused,
      duplicate_decision,
      revision: revisionOutcome,
    };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    const failed = stages.find((s) => s.status === "failed");
    markFailed(failed?.stage ?? "exception", detail);

    try {
      ws.writeArtifact("execution-summary.json", {
        task_id,
        cycle_id,
        run_id,
        review_id,
        candidate_id,
        candidate_title,
        candidate_dir: ws.dir,
        state: "FAILED",
        overall: "FAIL",
        paused: false,
        critic_ready,
        publication_allowed: false,
        provider: cx.provider,
        production_target,
        failure_detail: detail,
        stages: stages.map((s) => ({
          stage: s.stage,
          status: s.status,
          duration_ms: s.duration_ms,
        })),
        completed_at: new Date().toISOString(),
      });
    } catch {
      /* best-effort summary on exception path */
    }

    return {
      overall: "FAIL",
      task_id,
      cycle_id,
      candidate_id,
      candidate_title,
      review_id,
      run_id,
      candidate_dir: ws.dir,
      candidate_identity: identity,
      production_target,
      research_context,
      stages,
      state: "FAILED",
      founder_decision: null,
      decision_id,
      learning_count,
      critic_ready,
      publication_allowed: false,
      paused: false,
      duplicate_decision,
      revision: revisionOutcome,
    };
  }
}
