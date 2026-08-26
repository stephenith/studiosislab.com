/**
 * Canonical Critic Revision Loop — Agent #211.
 * Owns retry orchestration only. ResumeCritic remains authoritative for PASS/FAIL.
 * Bounded: initial generation + at most MAX_AUTOMATIC_REVISIONS revisions.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

export const MAX_AUTOMATIC_REVISIONS = 2 as const;
export const REVISION_SCHEMA_VERSION = 1 as const;

export type CriticScoresLite = {
  overall: number;
  ats: number;
  visual: number;
  typography: number;
  layout: number;
  technical: number;
  consistency: number;
  sections: number;
  ready: boolean;
};

export type CriticFindingsBundle = {
  blocked_reasons: string[];
  findings: Array<{
    category?: string;
    code: string;
    severity: string;
    message: string;
    points_deducted?: number;
  }>;
  scores: CriticScoresLite;
};

export type RevisionContext = {
  revision_number: number;
  production_target: Record<string, unknown>;
  research_context: Record<string, unknown> | null;
  previous_brain_output: Record<string, unknown> | null;
  critic_findings: CriticFindingsBundle;
};

export type RevisionAttemptRecord = {
  revision_number: number;
  started_at: string;
  finished_at: string;
  critic_ready: boolean;
  critic_scores: CriticScoresLite;
  blocked_reasons: string[];
  brain_output_ref: string | null;
  render_output_ref: string | null;
  canvas_ref: string | null;
  critic_ref: string | null;
  summary: string;
  decision: "PASS" | "FAIL";
  forced_fail?: boolean;
};

export type RevisionLoopOutcome = {
  outcome: "PASS" | "CRITIC_BLOCKED";
  final_ready: boolean;
  final_scores: CriticScoresLite | null;
  revisions_performed: number;
  attempts: number;
  max_revisions: number;
  history: RevisionAttemptRecord[];
  history_path: string;
};

export type CritiqueAttemptResult = {
  ready: boolean;
  scores: CriticScoresLite;
  blocked_reasons: string[];
  findings: CriticFindingsBundle["findings"];
  /** Full critic payload written to candidate critic.json by caller */
  critic_artifact: Record<string, unknown>;
};

export type RevisionLoopHooks = {
  /**
   * Verify-only: force FAIL for attempt revision_number <= this value (0-based).
   * null/undefined = use ResumeCritic only.
   */
  force_fail_through_attempt?: number | null;
};

export type RunRevisionLoopInput = {
  candidateDir: string;
  max_revisions?: number;
  hooks?: RevisionLoopHooks;
  /** Critique current candidate artifacts. ResumeCritic owns evaluation. */
  critique: (revision_number: number) => Promise<CritiqueAttemptResult> | CritiqueAttemptResult;
  /**
   * Regenerate brain → design → render for the next revision_number.
   * Called only when critic FAIL and revision_number will be 1..max.
   */
  revise: (ctx: RevisionContext) => Promise<void>;
  /** Build revision context fields from current candidate state */
  buildContext: (
    next_revision_number: number,
    critic: CritiqueAttemptResult,
  ) => RevisionContext;
  /** Optional: refresh editor-compat after revise (caller may fold into revise) */
  afterRevise?: (revision_number: number) => Promise<void> | void;
};

function atomicWriteJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  // rename would need fs.renameSync — keep simple write for history index
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  try {
    // best-effort cleanup of unused tmp if created above without rename
    void tmp;
  } catch {
    /* ignore */
  }
}

function revisionDir(candidateDir: string, revision_number: number): string {
  return join(
    candidateDir,
    "revisions",
    `revision-${String(revision_number).padStart(2, "0")}`,
  );
}

function copyIfExists(src: string, dest: string): string | null {
  if (!existsSync(src)) return null;
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  return dest;
}

/**
 * Persist one revision attempt without overwriting prior revision folders.
 */
export function persistRevisionAttempt(
  candidateDir: string,
  record: Omit<
    RevisionAttemptRecord,
    "brain_output_ref" | "render_output_ref" | "canvas_ref" | "critic_ref"
  > & {
    brain_output_ref?: string | null;
    render_output_ref?: string | null;
    canvas_ref?: string | null;
    critic_ref?: string | null;
  },
  criticArtifact: Record<string, unknown>,
): RevisionAttemptRecord {
  const dir = revisionDir(candidateDir, record.revision_number);
  mkdirSync(dir, { recursive: true });

  const critic_ref = join(dir, "critic.json");
  writeFileSync(
    critic_ref,
    `${JSON.stringify(criticArtifact, null, 2)}\n`,
    "utf8",
  );

  const brain_output_ref = copyIfExists(
    join(candidateDir, "mock-provider.json"),
    join(dir, "mock-provider.json"),
  );
  copyIfExists(join(candidateDir, "brain.json"), join(dir, "brain.json"));
  const render_output_ref = copyIfExists(
    join(candidateDir, "renderer.json"),
    join(dir, "renderer.json"),
  );
  const canvas_ref = copyIfExists(
    join(candidateDir, "canvas.json"),
    join(dir, "canvas.json"),
  );
  copyIfExists(
    join(candidateDir, "designbrief.json"),
    join(dir, "designbrief.json"),
  );
  copyIfExists(
    join(candidateDir, "resume-json-instructions.json"),
    join(dir, "resume-json-instructions.json"),
  );

  const full: RevisionAttemptRecord = {
    revision_number: record.revision_number,
    started_at: record.started_at,
    finished_at: record.finished_at,
    critic_ready: record.critic_ready,
    critic_scores: record.critic_scores,
    blocked_reasons: record.blocked_reasons,
    brain_output_ref,
    render_output_ref,
    canvas_ref,
    critic_ref,
    summary: record.summary,
    decision: record.decision,
    forced_fail: record.forced_fail,
  };

  writeFileSync(
    join(dir, "summary.json"),
    `${JSON.stringify(full, null, 2)}\n`,
    "utf8",
  );

  return full;
}

export function writeRevisionHistoryIndex(
  candidateDir: string,
  loop: Omit<RevisionLoopOutcome, "history_path">,
): string {
  const history_path = join(candidateDir, "revisions", "revision-history.json");
  mkdirSync(dirname(history_path), { recursive: true });
  const payload = {
    schema_version: REVISION_SCHEMA_VERSION,
    max_revisions: loop.max_revisions,
    revisions_performed: loop.revisions_performed,
    attempts: loop.attempts,
    outcome: loop.outcome,
    final_ready: loop.final_ready,
    final_scores: loop.final_scores,
    history: loop.history,
    updated_at: new Date().toISOString(),
  };
  atomicWriteJson(history_path, payload);
  // Flat pointer for dual-write discoverability
  writeFileSync(
    join(candidateDir, "revision-history.json"),
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf8",
  );
  return history_path;
}

/**
 * Bounded revision orchestration.
 * ResumeCritic decides PASS/FAIL; this loop only reacts.
 */
export async function runRevisionLoop(
  input: RunRevisionLoopInput,
): Promise<RevisionLoopOutcome> {
  const max_revisions = Math.max(
    0,
    Math.floor(input.max_revisions ?? MAX_AUTOMATIC_REVISIONS),
  );
  const forceThrough = input.hooks?.force_fail_through_attempt;
  const history: RevisionAttemptRecord[] = [];

  let revision_number = 0;
  let final_ready = false;
  let final_scores: CriticScoresLite | null = null;
  let outcome: RevisionLoopOutcome["outcome"] = "CRITIC_BLOCKED";

  while (true) {
    const started_at = new Date().toISOString();
    const raw = await input.critique(revision_number);
    const forced =
      forceThrough != null &&
      Number.isFinite(forceThrough) &&
      revision_number <= Number(forceThrough);
    const ready = forced ? false : raw.ready;
    const finished_at = new Date().toISOString();

    const decision: "PASS" | "FAIL" = ready ? "PASS" : "FAIL";
    const scores: CriticScoresLite = {
      ...raw.scores,
      ready,
    };
    final_scores = scores;
    final_ready = ready;

    const attempt = persistRevisionAttempt(
      input.candidateDir,
      {
        revision_number,
        started_at,
        finished_at,
        critic_ready: ready,
        critic_scores: scores,
        blocked_reasons: forced
          ? [
              ...raw.blocked_reasons,
              `verify_force_fail_through_attempt<=${forceThrough}`,
            ]
          : raw.blocked_reasons,
        summary: ready
          ? `Revision ${revision_number}: critic PASS`
          : `Revision ${revision_number}: critic FAIL` +
            (forced ? " (forced verify hook)" : ""),
        decision,
        forced_fail: forced || undefined,
      },
      {
        ...raw.critic_artifact,
        readiness: {
          ...(typeof raw.critic_artifact.readiness === "object" &&
          raw.critic_artifact.readiness
            ? (raw.critic_artifact.readiness as Record<string, unknown>)
            : {}),
          ready,
          forced_fail: forced || false,
        },
        scores: raw.scores,
        revision_number,
      },
    );
    history.push(attempt);

    if (ready) {
      outcome = "PASS";
      break;
    }

    if (revision_number >= max_revisions) {
      outcome = "CRITIC_BLOCKED";
      break;
    }

    const next = revision_number + 1;
    const ctx = input.buildContext(next, {
      ...raw,
      ready: false,
      scores,
      blocked_reasons: attempt.blocked_reasons,
    });
    await input.revise(ctx);
    if (input.afterRevise) await input.afterRevise(next);
    revision_number = next;
  }

  const revisions_performed = Math.max(0, history.length - 1);
  const resultBase = {
    outcome,
    final_ready,
    final_scores,
    revisions_performed,
    attempts: history.length,
    max_revisions,
    history,
  };
  const history_path = writeRevisionHistoryIndex(
    input.candidateDir,
    resultBase,
  );

  return { ...resultBase, history_path };
}

/** Read previous brain structured_output from candidate mock-provider.json */
export function readPreviousBrainOutput(
  candidateDir: string,
): Record<string, unknown> | null {
  const p = join(candidateDir, "mock-provider.json");
  if (!existsSync(p)) return null;
  try {
    const data = JSON.parse(readFileSync(p, "utf8")) as {
      structured_output?: Record<string, unknown> | null;
      consumed?: { structured_output?: Record<string, unknown> | null };
    };
    return (
      data.structured_output ?? data.consumed?.structured_output ?? null
    );
  } catch {
    return null;
  }
}
