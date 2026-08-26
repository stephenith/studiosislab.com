/**
 * Deterministic Fabric canvas operation executor.
 * OpenAI never runs arbitrary code — only validated operations apply.
 *
 * Backward compatibility: `adjust_spacing` remains executable here as a
 * geometry alias of set_position/move_object (left/top/delta_*), for
 * historical evidence/replays. NEW OpenAI plans must NOT emit adjust_spacing
 * (removed from PLANNER_ALLOWED_OPS / revision_planning schema).
 * There is no values.spacing field and no auto-conversion of spacing→delta_top.
 */
import type {
  CanvasOperation,
  CanvasOpType,
  OperationLogEntry,
} from "./revision-task-types.js";
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import { ensureObjectIds } from "./CanvasInventory.js";
import {
  closestCandidates,
  formatAmbiguousSelectorError,
  formatUnresolvedSelectorError,
  matchSelectorIndices,
  objectId,
  toMatchDiag,
} from "./SelectorResolution.js";
import { assertAlignObjectsExecutable } from "./StructuralAlignmentSafety.js";

function isSystemBg(o: Record<string, unknown>): boolean {
  const data = o.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const d = data as Record<string, unknown>;
    return d.system === true || d.kind === "page-bg" || d.role === "pageBackground";
  }
  return false;
}

function finite(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function snap(n: number): number {
  return Number(n.toFixed(2));
}

function geomSummary(o: Record<string, unknown>): Record<string, unknown> {
  return {
    id: o.id,
    type: o.type,
    left: o.left,
    top: o.top,
    width: o.width,
    height: o.height,
    fill: o.fill,
    stroke: o.stroke,
    text: typeof o.text === "string" ? String(o.text).slice(0, 120) : null,
    fontSize: o.fontSize,
    lineHeight: o.lineHeight,
  };
}

function resolveTarget(
  objects: Array<Record<string, unknown>>,
  op: CanvasOperation,
  opts: { allowMultiple?: boolean } = {},
):
  | { obj: Record<string, unknown>; index: number; objs?: Array<Record<string, unknown>> }
  | { error: string } {
  if (op.target_id) {
    let index = objects.findIndex((o, i) => objectId(o, i) === op.target_id);
    if (index < 0) {
      // Prefix / contains fuzzy match (models often shorten ids)
      const tid = op.target_id;
      const fuzzy = objects
        .map((o, i) => ({ i, id: objectId(o, i) }))
        .filter(
          (x) =>
            x.id === tid ||
            x.id.startsWith(tid) ||
            tid.startsWith(x.id) ||
            x.id.includes(tid),
        );
      if (fuzzy.length === 1) index = fuzzy[0]!.i;
      else if (fuzzy.length > 1) {
        // Prefer exact role header-band when extending shapes
        const band = fuzzy.find((x) => {
          const o = objects[x.i]!;
          const data =
            o.data && typeof o.data === "object" && !Array.isArray(o.data)
              ? (o.data as Record<string, unknown>)
              : {};
          return data.role === "header-band";
        });
        if (band) index = band.i;
        else {
          // Prefer largest area rect
          fuzzy.sort((a, b) => {
            const oa = objects[a.i]!;
            const ob = objects[b.i]!;
            const aa = Number(oa.width ?? 0) * Number(oa.height ?? 0);
            const bb = Number(ob.width ?? 0) * Number(ob.height ?? 0);
            return bb - aa;
          });
          index = fuzzy[0]!.i;
        }
      }
    }
    if (index < 0) return { error: `unresolved target_id ${op.target_id}` };
    return { obj: objects[index]!, index };
  }
  const sel = op.selector;
  if (!sel) return { error: "missing target_id/selector" };
  const matches = matchSelectorIndices(objects, sel);
  if (matches.length === 0) {
    return {
      error: formatUnresolvedSelectorError(
        sel,
        closestCandidates(objects, sel),
      ),
    };
  }
  if (matches.length > 1 && opts.allowMultiple) {
    return {
      obj: objects[matches[0]!]!,
      index: matches[0]!,
      objs: matches.map((i) => objects[i]!),
    };
  }
  if (matches.length > 1) {
    return {
      error: formatAmbiguousSelectorError(
        sel,
        matches.map((i) => toMatchDiag(objects[i]!, i)),
      ),
    };
  }
  const index = matches[0]!;
  return { obj: objects[index]!, index };
}

function clampToPage(
  o: Record<string, unknown>,
  pageW: number,
  pageH: number,
): void {
  if (finite(o.left)) o.left = snap(Math.max(0, Math.min(pageW - 4, o.left)));
  if (finite(o.top)) o.top = snap(Math.max(0, Math.min(pageH - 4, o.top)));
  if (finite(o.width)) o.width = snap(Math.max(1, Math.min(pageW, o.width)));
  if (finite(o.height)) o.height = snap(Math.max(1, Math.min(pageH, o.height)));
}

export type ExecuteResult = {
  ok: boolean;
  canvas: FabricCanvasDoc;
  log: OperationLogEntry[];
  error: string | null;
};

export function executeCanvasOperations(input: {
  canvas: FabricCanvasDoc;
  operations: CanvasOperation[];
}): ExecuteResult {
  const canvas = ensureObjectIds(
    JSON.parse(JSON.stringify(input.canvas)) as FabricCanvasDoc,
  );
  const objects = canvas.objects ?? [];
  canvas.objects = objects;
  const pageW = finite(canvas.width) ? canvas.width : 794;
  const pageH = finite(canvas.height) ? canvas.height : 1123;
  const log: OperationLogEntry[] = [];

  for (let i = 0; i < input.operations.length; i++) {
    const op = input.operations[i]!;
    try {
      if (op.op === "align_objects" || op.op === "group_objects") {
        let ids = op.target_ids?.length
          ? op.target_ids
          : op.target_id
            ? [op.target_id]
            : [];
        // Allow selector to expand to many objects for align
        if (!ids.length && op.selector) {
          const resolved = resolveTarget(objects, op, { allowMultiple: true });
          if ("error" in resolved) throw new Error(resolved.error);
          const many = resolved.objs ?? [resolved.obj];
          ids = many.map((o, idx) => objectId(o, resolved.index + idx));
          // Re-resolve ids properly from objects list
          ids = objects
            .map((o, i) => objectId(o, i))
            .filter((id) => {
              const o = objects.find((x, j) => objectId(x, j) === id)!;
              const data =
                o.data && typeof o.data === "object" && !Array.isArray(o.data)
                  ? (o.data as Record<string, unknown>)
                  : {};
              const sel = op.selector!;
              if (sel.type && String(o.type).toLowerCase() !== sel.type.toLowerCase())
                return false;
              if (sel.section && String(data.section ?? "") !== sel.section) return false;
              if (sel.role && String(data.role ?? "") !== sel.role) return false;
              if (sel.text_includes) {
                const t = typeof o.text === "string" ? o.text : "";
                if (!t.toLowerCase().includes(sel.text_includes.toLowerCase()))
                  return false;
              }
              return true;
            });
        }
        if (!ids.length) throw new Error("align/group requires target_ids or selector");
        const targets = ids.map((id) => {
          const idx = objects.findIndex((o, j) => objectId(o, j) === id);
          if (idx < 0) {
            // fuzzy
            const fuzzy = objects
              .map((o, j) => ({ j, id: objectId(o, j) }))
              .filter((x) => x.id.startsWith(id) || id.startsWith(x.id) || x.id.includes(id));
            if (fuzzy.length === 0) throw new Error(`unresolved target_id ${id}`);
            return objects[fuzzy[0]!.j]!;
          }
          return objects[idx]!;
        });
        const before = { ids, lefts: targets.map((t) => t.left) };
        if (op.op === "align_objects") {
          const alignLeft = finite(op.values?.align_left)
            ? Number(op.values!.align_left)
            : finite(targets[0]?.left)
              ? Number(targets[0]!.left)
              : null;
          if (alignLeft == null) throw new Error("align_left missing");
          // Defense-in-depth: reject unsafe structural mixes / OOB before mutate.
          // Do not clamp align_objects into a different geometry.
          assertAlignObjectsExecutable({
            targets: targets as Array<Record<string, unknown>>,
            target_ids: ids,
            align_left: alignLeft,
            page_width: pageW,
            page_height: pageH,
            // Pre-mutation canvas (lane topology from established geometry).
            canvas: input.canvas,
          });
          for (const t of targets) {
            if (isSystemBg(t)) throw new Error("refusing locked page background");
            t.left = snap(alignLeft);
          }
        } else {
          const gid = `group-${Date.now().toString(36)}`;
          for (const t of targets) {
            const data =
              t.data && typeof t.data === "object" && !Array.isArray(t.data)
                ? { ...(t.data as Record<string, unknown>) }
                : {};
            data.group_id = gid;
            t.data = data;
            t.groupId = gid;
          }
        }
        log.push({
          index: i,
          op: op.op,
          target_id: ids.join(","),
          founder_feedback_item: op.founder_feedback_item,
          ok: true,
          before,
          after: { ids, lefts: targets.map((t) => t.left) },
          error: null,
        });
        continue;
      }

      if (op.op === "add_object") {
        const vals = op.values ?? {};
        const newId =
          typeof vals.id === "string" && vals.id
            ? vals.id
            : `added-${Date.now().toString(36)}-${i}`;
        const neu: Record<string, unknown> = {
          type: String(vals.type ?? "textbox"),
          id: newId,
          left: finite(vals.left) ? vals.left : 48,
          top: finite(vals.top) ? vals.top : 800,
          width: finite(vals.width) ? vals.width : 698,
          height: finite(vals.height) ? vals.height : 40,
          fill: typeof vals.fill === "string" ? vals.fill : "#0a0a0a",
          text: typeof vals.text === "string" ? vals.text : "",
          fontSize: finite(vals.fontSize) ? vals.fontSize : 10.5,
          lineHeight: finite(vals.lineHeight) ? vals.lineHeight : 1.35,
          data: {
            id: newId,
            section: typeof vals.section === "string" ? vals.section : "content",
            fictional_sample_only: true,
          },
        };
        clampToPage(neu, pageW, pageH);
        objects.push(neu);
        log.push({
          index: i,
          op: op.op,
          target_id: newId,
          founder_feedback_item: op.founder_feedback_item,
          ok: true,
          before: null,
          after: geomSummary(neu),
          error: null,
        });
        continue;
      }

      if (op.op === "remove_object") {
        const resolved = resolveTarget(objects, op);
        if ("error" in resolved) throw new Error(resolved.error);
        if (isSystemBg(resolved.obj)) {
          throw new Error("refusing to remove locked page background");
        }
        const before = geomSummary(resolved.obj);
        objects.splice(resolved.index, 1);
        log.push({
          index: i,
          op: op.op,
          target_id: String(before.id),
          founder_feedback_item: op.founder_feedback_item,
          ok: true,
          before,
          after: null,
          error: null,
        });
        continue;
      }

      if (op.op === "ungroup_objects") {
        const resolved = resolveTarget(objects, op);
        if ("error" in resolved) throw new Error(resolved.error);
        const before = geomSummary(resolved.obj);
        const data =
          resolved.obj.data &&
          typeof resolved.obj.data === "object" &&
          !Array.isArray(resolved.obj.data)
            ? { ...(resolved.obj.data as Record<string, unknown>) }
            : {};
        delete data.group_id;
        resolved.obj.data = data;
        delete resolved.obj.groupId;
        log.push({
          index: i,
          op: op.op,
          target_id: String(before.id),
          founder_feedback_item: op.founder_feedback_item,
          ok: true,
          before,
          after: geomSummary(resolved.obj),
          error: null,
        });
        continue;
      }

      const multiOk =
        op.op === "set_position" ||
        op.op === "move_object" ||
        op.op === "adjust_spacing" ||
        op.op === "set_fill" ||
        op.op === "adjust_font_size" ||
        op.op === "adjust_line_height";
      const resolved = resolveTarget(objects, op, {
        allowMultiple: Boolean(op.selector && multiOk),
      });
      if ("error" in resolved) throw new Error(resolved.error);
      const targets =
        resolved.objs && resolved.objs.length > 0
          ? resolved.objs
          : [resolved.obj];

      const beforeMulti = targets.map((t) => geomSummary(t));
      for (const obj of targets) {
        if (isSystemBg(obj) && op.op !== "set_fill") {
          throw new Error("refusing mutation of locked page background");
        }
        const vals = op.values ?? {};

        const applyPos = () => {
          if (finite(vals.left)) obj.left = snap(Number(vals.left));
          if (finite(vals.top)) obj.top = snap(Number(vals.top));
          if (finite(vals.delta_left) && finite(obj.left)) {
            obj.left = snap(Number(obj.left) + Number(vals.delta_left));
          }
          if (finite(vals.delta_top) && finite(obj.top)) {
            obj.top = snap(Number(obj.top) + Number(vals.delta_top));
          }
        };
        const applyDim = () => {
          if (finite(vals.width)) obj.width = snap(Number(vals.width));
          if (finite(vals.height)) obj.height = snap(Number(vals.height));
          if (finite(vals.delta_width) && finite(obj.width)) {
            obj.width = snap(Number(obj.width) + Number(vals.delta_width));
          }
          if (finite(vals.delta_height) && finite(obj.height)) {
            obj.height = snap(Number(obj.height) + Number(vals.delta_height));
          }
        };

        switch (op.op as CanvasOpType) {
          case "move_object":
          case "set_position":
          case "adjust_spacing":
            applyPos();
            if (typeof vals.fill === "string") obj.fill = vals.fill;
            break;
          case "resize_object":
          case "set_dimensions":
          case "extend_shape":
            applyPos();
            applyDim();
            break;
          case "set_fill":
            if (typeof vals.fill !== "string") throw new Error("fill required");
            obj.fill = vals.fill;
            break;
          case "set_stroke":
            if (typeof vals.stroke === "string") obj.stroke = vals.stroke;
            if (finite(vals.strokeWidth))
              obj.strokeWidth = Number(vals.strokeWidth);
            break;
          case "update_text":
            if (typeof vals.text !== "string") throw new Error("text required");
            obj.text = vals.text;
            break;
          case "adjust_font_size":
            if (finite(vals.fontSize)) obj.fontSize = Number(vals.fontSize);
            else if (finite(vals.delta_fontSize) && finite(obj.fontSize)) {
              obj.fontSize = snap(
                Number(obj.fontSize) + Number(vals.delta_fontSize),
              );
            } else throw new Error("fontSize required");
            break;
          case "adjust_line_height":
            if (finite(vals.lineHeight)) obj.lineHeight = Number(vals.lineHeight);
            else throw new Error("lineHeight required");
            break;
          default:
            throw new Error(`unsupported op ${op.op}`);
        }

        for (const k of [
          "left",
          "top",
          "width",
          "height",
          "fontSize",
          "lineHeight",
        ]) {
          if (k in obj && obj[k] != null && !finite(obj[k])) {
            throw new Error(`invalid geometry ${k}=${String(obj[k])}`);
          }
        }
        clampToPage(obj, pageW, pageH);
      }

      log.push({
        index: i,
        op: op.op,
        target_id: targets.map((t) => String(t.id)).join(","),
        founder_feedback_item: op.founder_feedback_item,
        ok: true,
        before: beforeMulti.length === 1 ? beforeMulti[0]! : { items: beforeMulti },
        after:
          targets.length === 1
            ? geomSummary(targets[0]!)
            : { items: targets.map((t) => geomSummary(t)) },
        error: null,
      });
      continue;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log.push({
        index: i,
        op: op.op,
        target_id: op.target_id ?? null,
        founder_feedback_item: op.founder_feedback_item,
        ok: false,
        before: null,
        after: null,
        error: msg,
      });
      return {
        ok: false,
        canvas,
        log,
        error: `operation[${i}] failed: ${msg}`,
      };
    }
  }

  return { ok: true, canvas, log, error: null };
}
