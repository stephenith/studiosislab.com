/**
 * SnapshotSource — Agent #174.
 * Owns loading one company_brain snapshot slice. No domain orchestration.
 */

export type SnapshotSourceState = {
  id: string;
  path: string;
  available: boolean;
  error?: string;
};

export type SnapshotLoadContext = {
  repoRoot: string;
  /** Caller-owned source tracker (must match loadSnapshot behavior). */
  sources: SnapshotSourceState[];
  /**
   * Read JSON relative to repo root; must push into ctx.sources
   * exactly like dashboard loadSnapshot.safeReadJson.
   */
  readJson: (rel: string) => unknown | null;
  /** Current mission status when available (for pending flags). */
  missionStatus: string | null;
};

/**
 * A snapshot source contributes a fixed set of company_brain fields.
 * Output must be bitwise-identical to the previous inline mapping.
 */
export type SnapshotSource = {
  readonly id: string;
  /** Stable field keys contributed to company_brain. */
  readonly fields: readonly string[];
  load(ctx: SnapshotLoadContext): Record<string, unknown>;
  empty(): Record<string, unknown>;
};
