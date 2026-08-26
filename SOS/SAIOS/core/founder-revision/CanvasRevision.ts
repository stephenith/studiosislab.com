/**
 * Minimal Fabric canvas revisions for Founder feedback.
 * Preserves design identity — no redesign.
 * Never creates overlapping text blocks.
 */

export type FabricObj = {
  type?: string;
  text?: string;
  top?: number;
  left?: number;
  fontSize?: number;
  fontWeight?: string | number;
  lineHeight?: number;
  width?: number;
  height?: number;
  [key: string]: unknown;
};

export type CanvasDoc = {
  version?: string;
  width?: number;
  height?: number;
  objects?: FabricObj[];
  [key: string]: unknown;
};

function titleCaseSkill(s: string): string {
  return s
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w[0]!.toUpperCase() + w.slice(1)))
    .join(" ");
}

export function splitSkills(raw: string): string[] {
  const t = raw.trim();
  if (!t) return [];
  if (t.includes("·")) {
    return t.split(/\s*·\s*/).map((x) => x.trim()).filter(Boolean);
  }
  if (t.includes("|")) {
    return t.split(/\s*\|\s*/).map((x) => x.trim()).filter(Boolean);
  }
  if (
    /^[a-z0-9_]+(\.[a-z0-9_ ]+)+$/i.test(t.replace(/\s+/g, " ").trim()) ||
    (t.includes(".") && !t.includes(" ") && t.split(".").length >= 3)
  ) {
    return t.split(".").map((x) => x.trim()).filter(Boolean);
  }
  if (t.includes(".") && t.split(".").length >= 4 && t.length < 220) {
    return t.split(".").map((x) => x.trim()).filter(Boolean);
  }
  if (t.includes(",")) {
    return t.split(/\s*,\s*/).map((x) => x.trim()).filter(Boolean);
  }
  return [t];
}

/** ATS-readable multi-line bullets / two-column text list. */
export function formatSkillsReadable(raw: string): string {
  const parts = splitSkills(raw).map(titleCaseSkill);
  if (parts.length === 0) return raw;
  const lines: string[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    const a = parts[i]!;
    const b = parts[i + 1];
    if (b) lines.push(`• ${a}    • ${b}`);
    else lines.push(`• ${a}`);
  }
  return lines.join("\n");
}

export function fictionalContact(role: string, personName: string): string {
  const slug =
    personName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 28) || "example-name";
  const local = slug.replace(/-/g, ".") || "example.name";
  const cityByRole: Record<string, string> = {
    "Marketing Manager": "Austin, TX",
    "Software Engineer": "Seattle, WA",
    "Graphic Designer": "Brooklyn, NY",
    Accountant: "Austin, TX",
    "HR Manager": "Chicago, IL",
  };
  const city = cityByRole[role] ?? "Austin, TX";
  const phoneByRole: Record<string, string> = {
    "Marketing Manager": "+1 (555) 010-2401",
    "Software Engineer": "+1 (555) 010-2402",
    "Graphic Designer": "+1 (555) 010-2403",
    Accountant: "+1 (555) 010-2404",
    "HR Manager": "+1 (555) 010-2405",
  };
  const phone = phoneByRole[role] ?? "+1 (555) 000-0000";
  // Single line preserves existing header rhythm / object height.
  return `${local}@example.com  ·  ${phone}  ·  ${city}  ·  linkedin.com/in/${slug}`;
}

function isSectionHeader(text: string): boolean {
  return /^(0?\d\s+)?(SUMMARY|EXPERIENCE|PROJECTS|SKILLS|EDUCATION|CERTIFICATIONS|CERTIFICATES)\b/i.test(
    text.trim(),
  );
}

function findPersonName(objects: FabricObj[]): string {
  for (const o of objects) {
    const t = o.text;
    if (typeof t !== "string") continue;
    if (
      t.length > 3 &&
      t.length < 40 &&
      !t.includes("@") &&
      !isSectionHeader(t) &&
      !t.startsWith("•")
    ) {
      if (
        /^[A-Z][a-z]+(\s+[A-Z]\.?)?\s+[A-Z][a-z]+/.test(t) ||
        /^[A-Z][a-z]+\s+[A-Z][a-z]+/.test(t)
      ) {
        return t.trim();
      }
    }
  }
  return "Alex Example";
}

function estHeight(o: FabricObj): number {
  if (typeof o.height === "number" && o.height > 0) return o.height;
  const fs = Number(o.fontSize ?? 10);
  const lh = Number(o.lineHeight ?? 1.35);
  const lines = typeof o.text === "string" ? Math.max(1, o.text.split("\n").length) : 1;
  return fs * lh * lines;
}

function shiftObjectsBelow(
  objects: FabricObj[],
  afterTop: number,
  delta: number,
  sameColumnLeft?: number,
): void {
  if (Math.abs(delta) < 0.01) return;
  for (const o of objects) {
    if (typeof o.top !== "number" || o.top <= afterTop + 0.01) continue;
    if (
      sameColumnLeft != null &&
      Math.abs(Number(o.left ?? 0) - sameColumnLeft) > 40
    ) {
      continue;
    }
    o.top = Number((o.top + delta).toFixed(2));
  }
}

/** Compact oversized bullet / inter-job gaps; never create overlap. */
function compactBulletGaps(objects: FabricObj[]): string[] {
  const applied: string[] = [];
  const bullets = objects
    .map((o, i) => ({ o, i, top: o.top ?? 0, text: String(o.text ?? "") }))
    .filter((x) => x.text.startsWith("•"));

  for (let k = 0; k < bullets.length - 1; k++) {
    const a = bullets[k]!;
    const b = bullets[k + 1]!;
    const h = estHeight(a.o);
    const visualGap = b.top - (a.top + h);
    // Same-job bullets: tighten loose gaps
    // Inter-job blocks: reduce excessive whitespace but keep clear separation
    let targetVisual: number | null = null;
    if (visualGap > 8 && visualGap <= 28) targetVisual = 6;
    else if (visualGap > 28 && visualGap <= 70) targetVisual = 18;
    else continue;
    const delta = targetVisual - visualGap;
    if (delta >= -0.5) continue;
    shiftObjectsBelow(objects, a.top, delta, Number(a.o.left ?? 0));
    for (let m = k + 1; m < bullets.length; m++) {
      bullets[m]!.top = objects[bullets[m]!.i]!.top ?? bullets[m]!.top;
    }
    applied.push(
      `compacted bullet visual gap ${visualGap.toFixed(1)}→${targetVisual}`,
    );
  }
  return [...new Set(applied)];
}

/** HR feedback: ensure readable gaps between Education / Skills / Certifications. */
function ensureReadableTailSectionGaps(objects: FabricObj[]): string[] {
  const applied: string[] = [];
  const headers = objects
    .map((o, i) => ({ o, i, top: o.top ?? 0, text: String(o.text ?? "").trim() }))
    .filter((x) =>
      /^(0?\d\s+)?(EDUCATION|SKILLS|CERTIFICATIONS|CERTIFICATES)\b/i.test(x.text),
    )
    .sort((a, b) => a.top - b.top);
  const minGap = 28;
  for (let k = 0; k < headers.length - 1; k++) {
    const a = headers[k]!;
    const b = headers[k + 1]!;
    let lastBottom = a.top + estHeight(a.o);
    for (const o of objects) {
      const top = o.top ?? 0;
      if (top <= a.top || top >= b.top) continue;
      lastBottom = Math.max(lastBottom, top + estHeight(o));
    }
    const visualGap = b.top - lastBottom;
    if (visualGap >= minGap) continue;
    const delta = minGap - visualGap;
    shiftObjectsBelow(objects, lastBottom - 0.01, delta, Number(a.o.left ?? 0));
    for (let m = k + 1; m < headers.length; m++) {
      headers[m]!.top = objects[headers[m]!.i]!.top ?? headers[m]!.top;
    }
    applied.push(`increased spacing before "${b.text}"`);
  }
  return applied.length
    ? ["improved spacing between Education, Skills, and Certifications"]
    : [];
}

/** Reduce oversized gaps before section headers without overlapping prior content. */
function compactMajorSectionGaps(
  objects: FabricObj[],
  maxVisualGap = 36,
  opts: { stopBefore?: RegExp } = {},
): string[] {
  const applied: string[] = [];
  const headers = objects
    .map((o, i) => ({ o, i, top: o.top ?? 0, text: String(o.text ?? "") }))
    .filter((x) => isSectionHeader(x.text))
    .sort((a, b) => a.top - b.top);

  for (let k = 0; k < headers.length - 1; k++) {
    const a = headers[k]!;
    const b = headers[k + 1]!;
    if (opts.stopBefore?.test(b.text.trim())) continue;
    let lastBottom = a.top + estHeight(a.o);
    let lastTop = a.top;
    for (const o of objects) {
      const top = o.top ?? 0;
      if (top <= a.top || top >= b.top) continue;
      const bottom = top + estHeight(o);
      if (bottom > lastBottom) {
        lastBottom = bottom;
        lastTop = top;
      }
    }
    const visualGap = b.top - lastBottom;
    if (visualGap <= maxVisualGap) continue;
    const delta = maxVisualGap - visualGap;
    shiftObjectsBelow(objects, lastTop, delta, Number(a.o.left ?? 0));
    for (let m = k + 1; m < headers.length; m++) {
      headers[m]!.top = objects[headers[m]!.i]!.top ?? headers[m]!.top;
    }
    applied.push(`compacted section gap before "${b.text.trim()}"`);
  }
  return applied;
}

function bumpSectionHeadings(objects: FabricObj[]): string[] {
  const applied: string[] = [];
  for (const o of objects) {
    const t = String(o.text ?? "");
    if (!isSectionHeader(t)) continue;
    const fs = Number(o.fontSize ?? 11);
    const weightNum = Number(o.fontWeight ?? 400);
    const weight = String(o.fontWeight ?? "400");
    if (fs <= 11.5) {
      o.fontSize = 12;
      o.fontWeight = "700";
      applied.push(`heading hierarchy: ${t.trim()}`);
    } else if (fs <= 13 && (weightNum < 700 || weight === "normal" || weight === "600")) {
      o.fontWeight = "700";
      if (fs < 12.5) o.fontSize = Number((fs + 0.5).toFixed(1));
      applied.push(`heading hierarchy: ${t.trim()}`);
    }
  }
  return applied.length ? ["improved section heading hierarchy slightly"] : [];
}

/** Push later same-column text down until no negative gaps remain. */
function resolveOverlaps(objects: FabricObj[]): number {
  const texts = objects
    .map((o, i) => ({ o, i }))
    .filter((x) => typeof x.o.text === "string" && String(x.o.text).trim());
  texts.sort((a, b) => (a.o.top ?? 0) - (b.o.top ?? 0));
  let fixes = 0;
  for (let i = 0; i < texts.length; i++) {
    const prev = texts[i]!.o;
    const prevLeft = Number(prev.left ?? 0);
    const prevRight = prevLeft + Number(prev.width ?? 200);
    const prevBottom = (prev.top ?? 0) + estHeight(prev);
    for (let j = i + 1; j < texts.length; j++) {
      const cur = texts[j]!.o;
      const curLeft = Number(cur.left ?? 0);
      const curRight = curLeft + Number(cur.width ?? 200);
      const overlapX = Math.min(prevRight, curRight) - Math.max(prevLeft, curLeft);
      if (overlapX < 20) continue;
      const gap = (cur.top ?? 0) - prevBottom;
      if (gap >= 2) break; // later items are further down in sort order mostly
      if (gap < 2) {
        const need = 2 - gap;
        cur.top = Number(((cur.top ?? 0) + need).toFixed(2));
        // cascade: shift everything below cur in same column a bit
        shiftObjectsBelow(objects, (cur.top ?? 0) - need + 0.01, need, curLeft);
        // refresh tops in texts array
        for (const t of texts) {
          t.o.top = objects[t.i]!.top;
        }
        texts.sort((a, b) => (a.o.top ?? 0) - (b.o.top ?? 0));
        fixes += 1;
        break;
      }
    }
  }
  return fixes;
}

export function reviseCanvas(input: {
  canvas: CanvasDoc;
  role: string;
  requested_changes?: string[];
}): { canvas: CanvasDoc; changes_applied: string[]; changes_not_applied: string[] } {
  const canvas = JSON.parse(JSON.stringify(input.canvas)) as CanvasDoc;
  const objects = canvas.objects ?? [];
  const changes_applied: string[] = [];
  const changes_not_applied: string[] = [];
  const pageH = Number(canvas.height ?? 1123);
  const req = (input.requested_changes ?? []).join("\n").toLowerCase();
  const wantsMoreTailSpacing =
    input.role === "HR Manager" ||
    /increase spacing between.*(education|skills|cert)/i.test(req);

  // Contact — single-line fictional demo (matches original contact rhythm)
  const person = findPersonName(objects);
  let contactUpdated = false;
  for (const o of objects) {
    const t = String(o.text ?? "");
    if (!t.includes("@") && !/fictmail|linkedin\.com/i.test(t)) continue;
    if (t.length > 160 && !t.includes("@")) continue;
    if (t.includes("@") || /fictmail/i.test(t)) {
      o.text = fictionalContact(input.role, person);
      o.lineHeight = o.lineHeight ?? 1.4;
      // Keep single-line height; widen if needed for longer demo string
      if (typeof o.height === "number" && o.height > 28) {
        o.height = Math.max(14, Number(o.fontSize ?? 10) * 1.4);
      }
      contactUpdated = true;
      changes_applied.push(
        "replaced contact details with realistic fictional demo information",
      );
      break;
    }
  }
  if (!contactUpdated) {
    changes_not_applied.push("contact block not found as expected");
  }

  // Experience bullet spacing (height-aware)
  const bulletChanges = compactBulletGaps(objects);
  if (bulletChanges.length) {
    changes_applied.push(
      "reduced excessive vertical spacing between Experience bullets",
    );
  }

  // Skills formatting before section compaction so growth is accounted for
  let skillsUpdated = false;
  for (let i = 0; i < objects.length; i++) {
    const t = String(objects[i]!.text ?? "");
    if (!/SKILLS/i.test(t) || t.length > 40) continue;
    for (let j = i + 1; j < Math.min(i + 8, objects.length); j++) {
      const sj = String(objects[j]!.text ?? "");
      if (!sj || isSectionHeader(sj)) continue;
      if (sj.startsWith("•") && sj.length < 40) continue;
      if (sj.length < 12) continue;
      // Prefer the first non-bullet dense skills blob after SKILLS
      const looksLikeSkillsBlob =
        !sj.startsWith("•") ||
        (sj.includes("·") || sj.includes(",") || sj.split(".").length >= 3);
      if (!looksLikeSkillsBlob && sj.startsWith("•")) continue;
      const beforeTop = objects[j]!.top ?? 0;
      const formatted = formatSkillsReadable(sj);
      if (formatted === sj) continue;
      const lineCount = formatted.split("\n").length;
      const fs = Number(objects[j]!.fontSize ?? 10.5);
      const lh = 1.35;
      const oldH = estHeight(objects[j]!);
      const newH = Math.max(oldH, fs * lh * lineCount + 2);
      objects[j]!.text = formatted;
      objects[j]!.lineHeight = lh;
      objects[j]!.height = newH;
      skillsUpdated = true;
      changes_applied.push(
        "formatted Skills as ATS-readable bullets / two-column text list",
      );
      const grow = newH - oldH;
      if (grow > 1) {
        shiftObjectsBelow(objects, beforeTop, grow + 6, Number(objects[j]!.left ?? 0));
        changes_applied.push("adjusted spacing below Skills for multi-line list");
      }
      break;
    }
    break;
  }
  if (!skillsUpdated) {
    // Fallback: find long comma/dot skill lines anywhere
    for (const o of objects) {
      const sj = String(o.text ?? "");
      if (sj.length < 40 || sj.startsWith("•")) continue;
      if (isSectionHeader(sj) || sj.includes("@")) continue;
      if (!(sj.includes(",") || sj.includes("·") || (sj.includes(".") && !sj.includes(" ")))) {
        continue;
      }
      const parts = splitSkills(sj);
      if (parts.length < 3) continue;
      const beforeTop = o.top ?? 0;
      const formatted = formatSkillsReadable(sj);
      const lineCount = formatted.split("\n").length;
      const fs = Number(o.fontSize ?? 10.5);
      const oldH = estHeight(o);
      const newH = Math.max(oldH, fs * 1.35 * lineCount + 2);
      o.text = formatted;
      o.lineHeight = 1.35;
      o.height = newH;
      skillsUpdated = true;
      changes_applied.push(
        "formatted Skills as ATS-readable bullets / two-column text list",
      );
      const grow = newH - oldH;
      if (grow > 1) {
        shiftObjectsBelow(objects, beforeTop, grow + 6, Number(o.left ?? 0));
        changes_applied.push("adjusted spacing below Skills for multi-line list");
      }
      break;
    }
  }
  if (!skillsUpdated) {
    changes_not_applied.push("skills content block not reformatted");
  }

  // Major section whitespace (after skills growth)
  if (!wantsMoreTailSpacing) {
    const sectionChanges = compactMajorSectionGaps(objects, 34);
    if (sectionChanges.length) {
      changes_applied.push("reduced excessive whitespace between major sections");
    }
  } else {
    // HR: increase Education/Skills/Cert readability — do not compact those gaps
    changes_applied.push(...ensureReadableTailSectionGaps(objects));
  }

  // Heading hierarchy (light touch) — when Founder asked or role needs it
  const wantsHeadingBump =
    /heading|hierarchy|prominent|font weight|slightly larger|bolder/i.test(req) ||
    ["Graphic Designer", "Accountant", "Marketing Manager"].includes(input.role);
  if (wantsHeadingBump) {
    changes_applied.push(...bumpSectionHeadings(objects));
  }

  // Punctuation / bullet consistency
  for (const o of objects) {
    if (typeof o.text === "string" && o.text.startsWith("•  ")) {
      o.text = `• ${o.text.slice(3).trimStart()}`;
    }
  }
  changes_applied.push("standardized bullet punctuation and spacing");

  // Resolve any residual overlaps by pushing down (never pull up into collisions)
  const overlapFixes = resolveOverlaps(objects);
  if (overlapFixes > 0) {
    changes_applied.push("resolved residual text overlaps after spacing edits");
  }

  // Soft one-page guard: pack until content fits (or no further safe compaction)
  let maxBottom = contentMaxBottom(objects);
  if (maxBottom > pageH - 20) {
    packToSinglePage(objects, pageH, { protectTailSections: wantsMoreTailSpacing });
    resolveOverlaps(objects);
    packToSinglePage(objects, pageH, { protectTailSections: wantsMoreTailSpacing });
    changes_applied.push("tightened section gaps to preserve one-page intent");
  }

  // Re-assert HR Education/Skills/Cert readability after packing
  if (wantsMoreTailSpacing) {
    const tail = ensureReadableTailSectionGaps(objects);
    if (tail.length) {
      changes_applied.push(...tail);
      if (contentMaxBottom(objects) > pageH - 20) {
        packToSinglePage(objects, pageH, { protectTailSections: true });
      }
    }
  }

  const uniq = [...new Set(changes_applied)];
  return { canvas, changes_applied: uniq, changes_not_applied };
}

function contentMaxBottom(objects: FabricObj[]): number {
  let maxBottom = 0;
  for (const o of objects) {
    maxBottom = Math.max(maxBottom, (o.top ?? 0) + estHeight(o));
  }
  return maxBottom;
}

/** Progressive safe compaction to keep one-page intent without redesign. */
function packToSinglePage(
  objects: FabricObj[],
  pageH: number,
  opts: { protectTailSections?: boolean } = {},
): void {
  const limit = pageH - 20;
  for (let pass = 0; pass < 4; pass++) {
    if (contentMaxBottom(objects) <= limit) return;
    if (!opts.protectTailSections) {
      compactMajorSectionGaps(objects, Math.max(18, 34 - pass * 6));
    } else {
      // Compact only gaps before Education; leave Skills/Cert spacing alone
      compactMajorSectionGaps(objects, Math.max(22, 36 - pass * 4), {
        stopBefore: /SKILLS|CERTIFICATIONS|CERTIFICATES/i,
      });
    }
    compactBulletGaps(objects);
    // Slightly tighten multi-line skills blocks if still over
    if (contentMaxBottom(objects) > limit) {
      for (const o of objects) {
        const t = String(o.text ?? "");
        if (!t.includes("\n") || !t.startsWith("•")) continue;
        if (t.split("\n").length < 2) continue;
        const lh = Number(o.lineHeight ?? 1.35);
        if (lh > 1.2) {
          o.lineHeight = Number((lh - 0.05).toFixed(2));
          const fs = Number(o.fontSize ?? 10.5);
          const lines = t.split("\n").length;
          o.height = fs * Number(o.lineHeight) * lines + 2;
        }
      }
    }
    // Uniform micro-compress of content below header band if still over
    const over = contentMaxBottom(objects) - limit;
    if (over > 0) {
      const anchor = 180;
      const movable = objects.filter((o) => (o.top ?? 0) > anchor);
      if (movable.length > 1) {
        const tops = movable.map((o) => o.top ?? 0);
        const minT = Math.min(...tops);
        const maxT = Math.max(...tops);
        const span = Math.max(1, maxT - minT);
        const scale = Math.max(0.92, (span - over) / span);
        for (const o of movable) {
          const t = o.top ?? 0;
          o.top = Number((minT + (t - minT) * scale).toFixed(2));
        }
      }
    }
    resolveOverlaps(objects);
  }
}
