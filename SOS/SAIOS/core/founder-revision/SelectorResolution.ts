/**
 * Shared canvas selector resolution + plan uniqueness validation.
 * Fail closed: never silently pick among ambiguous matches.
 */
import type { CanvasOperation, RevisionPlan } from "./revision-task-types.js";
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import { ensureObjectIds } from "./CanvasInventory.js";

export type MatchDiag = {
  id: string;
  type: string | null;
  role: string | null;
  section: string | null;
  text: string | null;
  page: number;
  left: number | null;
  top: number | null;
  width: number | null;
  height: number | null;
};

export type SelectorIssue = {
  operation_index: number;
  op: string;
  target_id?: string;
  selector?: CanvasOperation["selector"];
  reason: "unresolved" | "ambiguous" | "missing_target";
  matched: MatchDiag[];
  closest?: MatchDiag[];
};

export type SelectorValidationResult = {
  ok: boolean;
  issues: SelectorIssue[];
  error: string | null;
};

const MULTI_OK = new Set<string>(["align_objects", "group_objects"]);

export function objectId(o: Record<string, unknown>, index: number): string {
  if (typeof o.id === "string" && o.id.trim()) return o.id;
  const data = o.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const id = (data as { id?: unknown }).id;
    if (typeof id === "string" && id.trim()) return id;
  }
  return `obj-${index}`;
}

function objectData(o: Record<string, unknown>): Record<string, unknown> {
  return o.data && typeof o.data === "object" && !Array.isArray(o.data)
    ? (o.data as Record<string, unknown>)
    : {};
}

export function toMatchDiag(
  o: Record<string, unknown>,
  index: number,
): MatchDiag {
  const data = objectData(o);
  const text = typeof o.text === "string" ? String(o.text).slice(0, 120) : null;
  return {
    id: objectId(o, index),
    type: typeof o.type === "string" ? o.type : null,
    role: data.role != null ? String(data.role) : null,
    section: data.section != null ? String(data.section) : null,
    text,
    page: 1,
    left: typeof o.left === "number" ? o.left : null,
    top: typeof o.top === "number" ? o.top : null,
    width: typeof o.width === "number" ? o.width : null,
    height: typeof o.height === "number" ? o.height : null,
  };
}

/** Exact selector filter — same semantics as CanvasOperationExecutor. */
export function matchSelectorIndices(
  objects: Array<Record<string, unknown>>,
  sel: NonNullable<CanvasOperation["selector"]>,
): number[] {
  const matches: number[] = [];
  for (let i = 0; i < objects.length; i++) {
    const o = objects[i]!;
    if (sel.type && String(o.type).toLowerCase() !== sel.type.toLowerCase())
      continue;
    if (sel.fill && String(o.fill) !== sel.fill) continue;
    if (sel.text_includes) {
      const t = typeof o.text === "string" ? o.text : "";
      if (!t.toLowerCase().includes(sel.text_includes.toLowerCase())) continue;
    }
    const data = objectData(o);
    if (sel.role && String(data.role ?? "") !== sel.role) continue;
    if (sel.section && String(data.section ?? "") !== sel.section) continue;
    matches.push(i);
  }
  return matches;
}

export function matchTargetIdIndices(
  objects: Array<Record<string, unknown>>,
  targetId: string,
): number[] {
  const exact = objects
    .map((o, i) => ({ i, id: objectId(o, i) }))
    .filter((x) => x.id === targetId)
    .map((x) => x.i);
  if (exact.length > 0) return exact;
  return objects
    .map((o, i) => ({ i, id: objectId(o, i) }))
    .filter(
      (x) =>
        x.id.startsWith(targetId) ||
        targetId.startsWith(x.id) ||
        x.id.includes(targetId),
    )
    .map((x) => x.i);
}

/** Closest candidates when unresolved — partial field overlap, capped. */
export function closestCandidates(
  objects: Array<Record<string, unknown>>,
  sel: NonNullable<CanvasOperation["selector"]>,
  limit = 5,
): MatchDiag[] {
  const scored: Array<{ score: number; i: number }> = [];
  for (let i = 0; i < objects.length; i++) {
    const o = objects[i]!;
    const data = objectData(o);
    let score = 0;
    if (sel.type && String(o.type).toLowerCase() === sel.type.toLowerCase())
      score += 3;
    if (sel.section && String(data.section ?? "") === sel.section) score += 3;
    if (sel.role && String(data.role ?? "") === sel.role) score += 4;
    if (sel.fill && String(o.fill) === sel.fill) score += 1;
    if (sel.text_includes) {
      const t = typeof o.text === "string" ? o.text : "";
      if (t.toLowerCase().includes(sel.text_includes.toLowerCase())) score += 5;
      else if (
        t &&
        sel.text_includes.length >= 4 &&
        t.toLowerCase().includes(sel.text_includes.toLowerCase().slice(0, 4))
      ) {
        score += 1;
      }
    }
    if (score > 0) scored.push({ score, i });
  }
  scored.sort((a, b) => b.score - a.score || a.i - b.i);
  return scored.slice(0, limit).map((s) => toMatchDiag(objects[s.i]!, s.i));
}

function formatIssue(issue: SelectorIssue): string {
  const sel = issue.selector
    ? ` selector=${JSON.stringify(issue.selector)}`
    : issue.target_id
      ? ` target_id=${issue.target_id}`
      : "";
  if (issue.reason === "ambiguous") {
    const ids = issue.matched
      .map(
        (m) =>
          `${m.id}(role=${m.role ?? "null"},section=${m.section ?? "null"},text=${JSON.stringify(m.text)},bounds=${m.left},${m.top},${m.width}x${m.height},page=${m.page})`,
      )
      .join("; ");
    return `operations[${issue.operation_index}] ${issue.op}: ambiguous${sel} matched ${issue.matched.length} objects: ${ids}`;
  }
  if (issue.reason === "unresolved") {
    const closest =
      issue.closest && issue.closest.length
        ? ` closest=[${issue.closest.map((m) => m.id).join(", ")}]`
        : "";
    return `operations[${issue.operation_index}] ${issue.op}: unresolved${sel}${closest}`;
  }
  return `operations[${issue.operation_index}] ${issue.op}: missing target_id/selector`;
}

/**
 * Validate every plan operation resolves uniquely (unless multi-target op).
 * Does not mutate the plan or canvas.
 */
export function validatePlanSelectorsAgainstCanvas(
  canvas: FabricCanvasDoc,
  operations: CanvasOperation[],
): SelectorValidationResult {
  const doc = ensureObjectIds(
    JSON.parse(JSON.stringify(canvas)) as FabricCanvasDoc,
  );
  const objects = doc.objects ?? [];
  const issues: SelectorIssue[] = [];

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i]!;
    const allowMultiple = MULTI_OK.has(op.op);

    if (op.target_ids?.length) {
      for (const tid of op.target_ids) {
        const idxs = matchTargetIdIndices(objects, tid);
        if (idxs.length === 0) {
          issues.push({
            operation_index: i,
            op: op.op,
            target_id: tid,
            reason: "unresolved",
            matched: [],
            closest: [],
          });
        } else if (idxs.length > 1 && !allowMultiple) {
          issues.push({
            operation_index: i,
            op: op.op,
            target_id: tid,
            reason: "ambiguous",
            matched: idxs.map((j) => toMatchDiag(objects[j]!, j)),
          });
        }
      }
      continue;
    }

    if (op.target_id) {
      const idxs = matchTargetIdIndices(objects, op.target_id);
      if (idxs.length === 0) {
        issues.push({
          operation_index: i,
          op: op.op,
          target_id: op.target_id,
          reason: "unresolved",
          matched: [],
          closest: [],
        });
      } else if (idxs.length > 1 && !allowMultiple) {
        // Fuzzy multi-match without exact id — treat as ambiguous (fail closed).
        // Exact single id already filtered above.
        const exact = idxs.filter(
          (j) => objectId(objects[j]!, j) === op.target_id,
        );
        if (exact.length === 1) {
          /* unique exact — ok */
        } else if (exact.length === 0 && idxs.length > 1) {
          issues.push({
            operation_index: i,
            op: op.op,
            target_id: op.target_id,
            reason: "ambiguous",
            matched: idxs.map((j) => toMatchDiag(objects[j]!, j)),
          });
        }
      }
      continue;
    }

    if (op.selector) {
      const idxs = matchSelectorIndices(objects, op.selector);
      if (idxs.length === 0) {
        issues.push({
          operation_index: i,
          op: op.op,
          selector: op.selector,
          reason: "unresolved",
          matched: [],
          closest: closestCandidates(objects, op.selector),
        });
      } else if (idxs.length > 1 && !allowMultiple) {
        issues.push({
          operation_index: i,
          op: op.op,
          selector: op.selector,
          reason: "ambiguous",
          matched: idxs.map((j) => toMatchDiag(objects[j]!, j)),
        });
      }
      continue;
    }

    if (op.op === "add_object") continue;

    issues.push({
      operation_index: i,
      op: op.op,
      reason: "missing_target",
      matched: [],
    });
  }

  if (!issues.length) return { ok: true, issues: [], error: null };
  return {
    ok: false,
    issues,
    error: issues.map(formatIssue).join(" | "),
  };
}

export function validateRevisionPlanSelectors(
  canvas: FabricCanvasDoc,
  plan: RevisionPlan,
): SelectorValidationResult {
  return validatePlanSelectorsAgainstCanvas(canvas, plan.operations);
}

/** Executor-facing diagnostic error strings (fail closed). */
export function formatUnresolvedSelectorError(
  sel: NonNullable<CanvasOperation["selector"]>,
  closest: MatchDiag[],
): string {
  const closestPart =
    closest.length > 0
      ? ` closest=[${closest
          .map(
            (m) =>
              `${m.id}(role=${m.role ?? "null"},section=${m.section ?? "null"},text=${JSON.stringify(m.text)})`,
          )
          .join("; ")}]`
      : "";
  return `unresolved selector ${JSON.stringify(sel)}${closestPart}`;
}

export function formatAmbiguousSelectorError(
  sel: NonNullable<CanvasOperation["selector"]>,
  matched: MatchDiag[],
): string {
  const ids = matched
    .map(
      (m) =>
        `${m.id}(role=${m.role ?? "null"},section=${m.section ?? "null"},text=${JSON.stringify(m.text)},bounds=${m.left},${m.top},${m.width}x${m.height},page=${m.page})`,
    )
    .join("; ");
  return `ambiguous selector matched ${matched.length} objects selector=${JSON.stringify(sel)}: ${ids}`;
}
