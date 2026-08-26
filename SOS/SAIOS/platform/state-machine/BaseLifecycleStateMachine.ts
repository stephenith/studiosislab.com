/**
 * BaseLifecycleStateMachine — Agent #173.
 * Generic transition table helpers. No domain statuses baked in.
 */

export type TransitionTable = Partial<Record<string, readonly string[]>>;

export function canTransition(
  from: string,
  to: string,
  table: TransitionTable,
  opts?: { blockedTargets?: readonly string[] },
): boolean {
  const blocked = opts?.blockedTargets ?? [];
  if (blocked.includes(to)) return false;
  return (table[from] ?? []).includes(to);
}

export function assertTransition(
  from: string,
  to: string,
  table: TransitionTable,
  opts?: { blockedTargets?: readonly string[]; label?: string },
): void {
  if (!canTransition(from, to, table, opts)) {
    const label = opts?.label ?? "lifecycle";
    throw new Error(`Invalid ${label} transition: ${from} → ${to}`);
  }
}

export const DEFAULT_EXECUTION_BLOCKED_TARGETS = [
  "IN_PROGRESS",
  "COMPLETED",
  "QUEUED",
  "DISPATCHED",
  "RUNNING",
  "EXECUTING",
  "SCHEDULED",
  "STARTED",
  "LIVE",
] as const;

export class BaseLifecycleStateMachine {
  constructor(
    readonly table: TransitionTable,
    readonly blockedTargets: readonly string[] = DEFAULT_EXECUTION_BLOCKED_TARGETS,
  ) {}

  can(from: string, to: string): boolean {
    return canTransition(from, to, this.table, {
      blockedTargets: this.blockedTargets,
    });
  }

  assert(from: string, to: string, label = "lifecycle"): void {
    assertTransition(from, to, this.table, {
      blockedTargets: this.blockedTargets,
      label,
    });
  }
}
