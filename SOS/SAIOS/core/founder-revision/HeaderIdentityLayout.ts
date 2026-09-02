/**
 * Deterministic HEADER_IDENTITY_BLOCK layout.
 *
 * Owns header-band ↔ ordered identity text stack geometry using wrap-aware
 * effective heights. Models N identity texts (name → optional title/role →
 * contact), not a hard-coded name↔contact pair. Prefer expanding the header
 * background when the internal text stack is already sequentially safe.
 */
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import {
  effectiveObjectBBox,
  effectiveTextHeightScaled,
  isFabricTextObject,
} from "./TextEffectiveHeight.js";
import { parseExplicitMoveDirections } from "./PositionOpCanonicalization.js";

/** Matches RevisionLayoutNormalizer MIN_HEADING_BODY_GAP_PX (avoid circular import). */
export const HEADER_IDENTITY_PAD_PX = 8;
/** Matches RevisionLayoutNormalizer MIN_SECTION_GAP_PX. */
export const HEADER_TO_SUMMARY_CLEARANCE_PX = 12;

/** Phase 5X ownership mode recorded on each layout application. */
export type HeaderIdentityOwnershipMode = "FULL_STACK" | "BAND_ONLY" | "NONE";

type FabricObj = Record<string, unknown> & {
  id?: string;
  type?: string;
  text?: string;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  data?: Record<string, unknown>;
  role?: string;
};

export type HeaderIdentityTextMember = {
  object: FabricObj;
  index: number;
  kind: "name" | "title" | "contact" | "other";
};

/**
 * Header identity membership. `name` / `contact` remain for legacy callers;
 * `identityTextsOrdered` is the Phase 5X source of truth (2+ texts).
 */
export type HeaderIdentityMembers = {
  background: FabricObj;
  background_index: number;
  name: FabricObj;
  name_index: number;
  contact: FabricObj;
  contact_index: number;
  /** All header identity texts ordered by top (name → … → contact). */
  identityTextsOrdered: HeaderIdentityTextMember[];
};

export type HeaderIdentityLayoutReport = {
  schema_version: "header-identity-layout-1.0.0";
  ok: boolean;
  applied: boolean;
  error: string | null;
  reason_codes: string[];
  ownership_mode: HeaderIdentityOwnershipMode;
  before: {
    band_top: number;
    band_bottom: number;
    name_top: number;
    name_effective_bottom: number;
    contact_top: number;
    contact_effective_bottom: number;
    identity_tops: number[];
  } | null;
  after: {
    band_top: number;
    band_bottom: number;
    name_top: number;
    name_effective_bottom: number;
    contact_top: number;
    contact_effective_bottom: number;
    identity_tops: number[];
  } | null;
  band_expanded: boolean;
  summary_shift_px: number;
  required_contact_up: boolean;
  contact_delta_top: number | null;
  text_positions_preserved: boolean;
};

function normalizeFeedback(s: string): string {
  return s
    .replace(/^\*+\s*/, "")
    .replace(/^\d+\.\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function asNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function objectId(o: FabricObj, index: number): string {
  if (typeof o.id === "string" && o.id.trim()) return o.id;
  const data = o.data;
  if (data && typeof data.id === "string" && data.id.trim()) return data.id;
  return `obj-${index}`;
}

function sectionOf(o: FabricObj): string | null {
  const s = o.data?.section;
  return typeof s === "string" && s.trim() ? s.trim().toLowerCase() : null;
}

function roleOf(o: FabricObj): string {
  return String(o.data?.role ?? o.role ?? "").toLowerCase();
}

function isSystemBg(o: FabricObj): boolean {
  const role = roleOf(o);
  return (
    o.data?.system === true ||
    o.data?.kind === "page-bg" ||
    role === "pagebackground"
  );
}

function isRect(o: FabricObj): boolean {
  return String(o.type ?? "")
    .toLowerCase()
    .includes("rect");
}

function isContactLike(o: FabricObj): boolean {
  const role = roleOf(o);
  const text = typeof o.text === "string" ? o.text : "";
  if (/\bcontact\b/.test(role)) return true;
  if (/@/.test(text)) return true;
  if (/\(\s*\d{3}\s*\)/.test(text) || /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/.test(text)) {
    return true;
  }
  if (/linkedin/i.test(text)) return true;
  return false;
}

function isTitleLike(o: FabricObj): boolean {
  const role = roleOf(o);
  if (/\b(title|role|subtitle|job.?title|headline)\b/.test(role)) return true;
  return false;
}

function isNameLike(o: FabricObj): boolean {
  const role = roleOf(o);
  if (/\bname\b/.test(role) || role === "header-name") return true;
  if (!isFabricTextObject(o)) return false;
  if (isContactLike(o)) return false;
  return true;
}

function classifyIdentityKind(o: FabricObj): HeaderIdentityTextMember["kind"] {
  if (isContactLike(o)) return "contact";
  if (isTitleLike(o)) return "title";
  const role = roleOf(o);
  if (/\bname\b/.test(role) || role === "header-name") return "name";
  return "other";
}

/**
 * Founder lines that describe header identity containment / internal padding.
 * Style-only color/font requests are excluded.
 */
export function isHeaderIdentityLayoutOwnedChange(
  requestedChange: string,
): boolean {
  const n = normalizeFeedback(requestedChange);
  if (!n) return false;
  if (
    /\b(mismatch|restore the correct|do not invent|fabricat|rewrite (?:the )?content|wrong role|font size|recolor|change (?:the )?color)\b/.test(
      n,
    )
  ) {
    return false;
  }
  // Collision / section-body overlap work is not header-identity geometry.
  if (
    /\b(collision|collisions|overlap|overlapping|displaced|cover|covers)\b/.test(
      n,
    )
  ) {
    return false;
  }

  const headerCtx =
    /\bheader\b/.test(n) ||
    /\bidentity\s+block\b/.test(n) ||
    (/\b(name|role|contact)\b/.test(n) &&
      /\b(header|identity|padding|band)\b/.test(n));

  if (!headerCtx) return false;

  if (
    /\b(contained|containment)\b/.test(n) &&
    /\b(header|identity)\b/.test(n)
  ) {
    return true;
  }
  if (
    /\b(inside|within)\b/.test(n) &&
    /\bheader\b/.test(n) &&
    /\b(name|contact|role|identity|padding|band|rectangle)\b/.test(n)
  ) {
    return true;
  }
  if (
    /\b(bottom|top|internal|vertical)\s+padding\b/.test(n) &&
    /\bheader\b/.test(n)
  ) {
    return true;
  }
  if (
    /\bbalance\b/.test(n) &&
    /\b(spacing|padding)\b/.test(n) &&
    /\bheader\b/.test(n)
  ) {
    return true;
  }
  if (
    /\b(mov(?:e|ing)|raise|shift|reposition|nudge)\b/.test(n) &&
    /\b(contact|role)\b/.test(n) &&
    /\b(up|upward|higher|inside|within|header|padding|boundary)\b/.test(n)
  ) {
    return true;
  }
  if (
    /\bunified\b/.test(n) &&
    /\b(header|identity)\b/.test(n) &&
    /\b(name|role|contact)\b/.test(n)
  ) {
    return true;
  }
  // Preserve geometry/style while header spacing is owned elsewhere.
  if (
    /\bpreserv(?:e|ing)\b/.test(n) &&
    /\b(alignment|typography|color|header width|visual style|design)\b/.test(
      n,
    ) &&
    /\bheader\b/.test(n)
  ) {
    return true;
  }
  return false;
}

export function isHeaderIdentityLayoutFeedback(
  requestedChanges: string[],
): boolean {
  const owned = requestedChanges.filter((c) =>
    isHeaderIdentityLayoutOwnedChange(c),
  );
  if (owned.length >= 2) return true;
  return owned.some(
    (c) =>
      /\b(contained|inside|within|padding|balance|upward|raise)\b/i.test(c) &&
      /\b(header|contact|identity)\b/i.test(c),
  );
}

export function feedbackRequiresContactUpward(
  requestedChanges: string[],
): boolean {
  return requestedChanges.some((c) => {
    const n = normalizeFeedback(c);
    if (!/\b(contact|role)\b/.test(n)) return false;
    // Phase 5Y: only POSITIVE upward movement intent (negation-aware).
    const dirs = parseExplicitMoveDirections(c);
    if (dirs.has("up")) return true;
    // Imperative raise of contact/role without going through *ward forms.
    if (/\braise\b/.test(n) && !/\b(?:do\s+not|don't|dont|never|avoid)\b/.test(n)) {
      return true;
    }
    return false;
  });
}

/**
 * Founder asks to keep header identity text tops fixed / preserve name-title-
 * contact positions when already non-overlapping — prefer BAND_ONLY.
 * Does NOT match generic "preserve the rest … spacing" body-preservation lines.
 */
export function feedbackRequestsPreserveHeaderTextPositions(
  requestedChanges: string[],
): boolean {
  return requestedChanges.some((c) => {
    const n = normalizeFeedback(c);
    if (
      /\b(?:keeping|keep)\s+(?:its\s+)?top\s+edge\s+fixed\b/.test(n) ||
      /\btop\s+edge\s+fixed\b/.test(n)
    ) {
      return true;
    }
    if (
      /\bpreserv(?:e|ing)\b/.test(n) &&
      /\b(?:name|title|contact)\b/.test(n) &&
      /\b(?:position|vertical|hierarchy|spacing|non-?overlapping)\b/.test(n)
    ) {
      return true;
    }
    return false;
  });
}

/** No rendered box overlap between consecutive identity texts (gap >= -0.5). */
export function isHeaderIdentityStackNonOverlapping(
  members: HeaderIdentityTextMember[],
): boolean {
  if (members.length < 2) return false;
  for (let i = 0; i < members.length - 1; i++) {
    const prev = members[i]!;
    const next = members[i + 1]!;
    const prevBottom =
      (asNum(prev.object.top) ?? 0) + textEffectiveHeight(prev.object);
    const nextTop = asNum(next.object.top) ?? 0;
    if (nextTop - prevBottom < -0.5) return false;
  }
  return true;
}

/** Stable object id for inventory / coverage bridging. */
export function headerIdentityMemberId(
  o: FabricObj,
  index: number,
): string {
  return objectId(o, index);
}

/**
 * Resolve header identity members from a full canvas document.
 * Shared by deterministic layout and FeedbackCoverage proofs.
 */
export function resolveHeaderIdentityMembersFromCanvas(
  canvas: FabricCanvasDoc,
): HeaderIdentityMembers | null {
  return detectHeaderIdentityMembers(canvas.objects ?? []);
}

/**
 * Detect header band + ordered identity texts (name → … → contact).
 * Intermediate title/role/subtitle texts between name and contact are included.
 */
export function detectHeaderIdentityMembers(
  objects: FabricObj[],
): HeaderIdentityMembers | null {
  const headerIdx: number[] = [];
  for (let i = 0; i < objects.length; i++) {
    const o = objects[i]!;
    if (isSystemBg(o)) continue;
    if (sectionOf(o) === "header") headerIdx.push(i);
  }
  if (headerIdx.length < 3) return null;

  let background: FabricObj | null = null;
  let background_index = -1;
  let bestBandArea = -1;
  for (const i of headerIdx) {
    const o = objects[i]!;
    if (!isRect(o)) continue;
    const role = roleOf(o);
    const w = Math.max(0, asNum(o.width) ?? 0);
    const h = Math.max(0, asNum(o.height) ?? 0);
    const area = w * h;
    const bandRole =
      /band|strip|background|bg|pale|header/.test(role) || role === "";
    if (!bandRole && bestBandArea >= 0) continue;
    if (area > bestBandArea) {
      bestBandArea = area;
      background = o;
      background_index = i;
    }
  }
  if (!background || background_index < 0) return null;

  let contact: FabricObj | null = null;
  let contact_index = -1;
  let name: FabricObj | null = null;
  let name_index = -1;

  for (const i of headerIdx) {
    const o = objects[i]!;
    if (!isFabricTextObject(o)) continue;
    if (isContactLike(o)) {
      const top = asNum(o.top) ?? 0;
      if (
        contact == null ||
        top >= (asNum(contact.top) ?? Number.NEGATIVE_INFINITY)
      ) {
        contact = o;
        contact_index = i;
      }
    }
  }

  for (const i of headerIdx) {
    const o = objects[i]!;
    if (!isFabricTextObject(o)) continue;
    if (contact_index === i) continue;
    if (!isNameLike(o)) continue;
    const top = asNum(o.top) ?? 0;
    if (
      name == null ||
      top < (asNum(name.top) ?? Number.POSITIVE_INFINITY)
    ) {
      name = o;
      name_index = i;
    }
  }

  if (!name || !contact || name_index < 0 || contact_index < 0) return null;

  const nameTop = asNum(name.top) ?? 0;
  const contactTop = asNum(contact.top) ?? 0;

  // Collect all header texts from name through contact (inclusive), by top.
  const between: HeaderIdentityTextMember[] = [];
  for (const i of headerIdx) {
    const o = objects[i]!;
    if (!isFabricTextObject(o)) continue;
    const top = asNum(o.top) ?? 0;
    if (i === name_index || i === contact_index) {
      between.push({
        object: o,
        index: i,
        kind: i === contact_index ? "contact" : "name",
      });
      continue;
    }
    // Intermediate texts: geometrically between name and contact tops,
    // or explicitly titled roles in the header section.
    const kind = classifyIdentityKind(o);
    const geometricallyBetween =
      top + 1e-9 >= nameTop - 0.5 && top - 1e-9 <= contactTop + 0.5;
    if (geometricallyBetween || kind === "title") {
      between.push({
        object: o,
        index: i,
        kind: kind === "contact" ? "other" : kind === "name" ? "title" : kind,
      });
    }
  }

  between.sort((a, b) => {
    const ta = asNum(a.object.top) ?? 0;
    const tb = asNum(b.object.top) ?? 0;
    if (ta !== tb) return ta - tb;
    return a.index - b.index;
  });

  // Ensure name is first and contact is last in the ordered stack.
  const withoutEnds = between.filter(
    (m) => m.index !== name_index && m.index !== contact_index,
  );
  const identityTextsOrdered: HeaderIdentityTextMember[] = [
    { object: name, index: name_index, kind: "name" },
    ...withoutEnds.map((m) => ({
      ...m,
      kind: m.kind === "name" ? ("title" as const) : m.kind,
    })),
    { object: contact, index: contact_index, kind: "contact" },
  ];

  return {
    background,
    background_index,
    name,
    name_index,
    contact,
    contact_index,
    identityTextsOrdered,
  };
}

function textEffectiveHeight(o: FabricObj): number {
  const eh = effectiveTextHeightScaled(o);
  if (eh != null && eh > 0) return eh;
  const bb = effectiveObjectBBox(o);
  return Math.max(1, bb.height);
}

function snap(n: number): number {
  return Math.round(n * 100) / 100;
}

function memberTops(members: HeaderIdentityTextMember[]): number[] {
  return members.map((m) => asNum(m.object.top) ?? 0);
}

/**
 * Internal stack is sequentially safe when consecutive identity texts have a
 * positive non-overlapping gap. Exact touching (gap≈0) is treated as unsafe so
 * FULL_STACK can restore canonical HEADER_IDENTITY_PAD spacing.
 */
export function isHeaderIdentityStackSequentiallySafe(
  members: HeaderIdentityTextMember[],
): boolean {
  if (members.length < 2) return false;
  for (let i = 0; i < members.length - 1; i++) {
    const prev = members[i]!;
    const next = members[i + 1]!;
    const prevBottom =
      (asNum(prev.object.top) ?? 0) + textEffectiveHeight(prev.object);
    const nextTop = asNum(next.object.top) ?? 0;
    const gap = nextTop - prevBottom;
    if (gap < 0.5) return false;
  }
  return true;
}

function emptyReport(
  partial: Partial<HeaderIdentityLayoutReport> & {
    ok: boolean;
    reason_codes: string[];
  },
): HeaderIdentityLayoutReport {
  return {
    schema_version: "header-identity-layout-1.0.0",
    applied: false,
    error: null,
    ownership_mode: "NONE",
    before: null,
    after: null,
    band_expanded: false,
    summary_shift_px: 0,
    required_contact_up: false,
    contact_delta_top: null,
    text_positions_preserved: true,
    ...partial,
  };
}

/**
 * Apply deterministic header identity geometry onto a canvas clone.
 * Mutates the provided canvas objects in place.
 *
 * Phase 5X:
 * - BAND_ONLY when internal stack is sequentially safe → expand band only
 * - FULL_STACK when texts overlap → reflow all ordered members then expand band
 */
export function applyHeaderIdentityBlockLayout(input: {
  canvas: FabricCanvasDoc;
  requested_changes?: string[];
  /** When true, contact.top must not increase (Phase 4I UP). */
  require_contact_upward?: boolean;
}): HeaderIdentityLayoutReport {
  const reason_codes: string[] = [];
  const objects = (input.canvas.objects ?? []) as FabricObj[];
  const pageH = asNum(input.canvas.height) ?? 0;
  const members = detectHeaderIdentityMembers(objects);
  if (!members) {
    return emptyReport({
      ok: true,
      reason_codes: ["header_identity_members_not_detected"],
      ownership_mode: "NONE",
    });
  }

  const requireUp =
    input.require_contact_upward === true ||
    feedbackRequiresContactUpward(input.requested_changes ?? []);

  const pad = HEADER_IDENTITY_PAD_PX;
  const clear = HEADER_TO_SUMMARY_CLEARANCE_PX;
  const stack = members.identityTextsOrdered;

  const bandTop0 = asNum(members.background.top) ?? 0;
  const bandH0 = Math.max(1, asNum(members.background.height) ?? 1);
  const bandBottom0 = bandTop0 + bandH0;
  const nameTop0 = asNum(members.name.top) ?? 0;
  const nameEh = textEffectiveHeight(members.name);
  const nameEb0 = nameTop0 + nameEh;
  const contactTop0 = asNum(members.contact.top) ?? 0;
  const contactEh = textEffectiveHeight(members.contact);
  const contactEb0 = contactTop0 + contactEh;
  const identityTops0 = memberTops(stack);

  const before = {
    band_top: bandTop0,
    band_bottom: bandBottom0,
    name_top: nameTop0,
    name_effective_bottom: nameEb0,
    contact_top: contactTop0,
    contact_effective_bottom: contactEb0,
    identity_tops: identityTops0,
  };

  const stackSafe = isHeaderIdentityStackSequentiallySafe(stack);
  const stackNonOverlapping = isHeaderIdentityStackNonOverlapping(stack);
  const preservePositions = feedbackRequestsPreserveHeaderTextPositions(
    input.requested_changes ?? [],
  );
  const containmentOk = contactEb0 <= bandBottom0 - pad + 0.5;
  const nameTopPadOk = nameTop0 + 1e-9 >= bandTop0 + pad - 0.5;

  // Stacked height if reflowed with canonical pad between every member.
  let stackedHeight = pad;
  for (const m of stack) {
    stackedHeight += textEffectiveHeight(m.object) + pad;
  }
  reason_codes.push(
    `identity_members=${stack.length}`,
    `required_height=${stackedHeight}`,
    stackSafe ? "stack_sequentially_safe" : "stack_sequentially_unsafe",
    stackNonOverlapping
      ? "stack_non_overlapping"
      : "stack_has_overlap",
    preservePositions ? "preserve_header_text_positions" : "no_preserve_text_request",
  );

  if (stackSafe && containmentOk && nameTopPadOk && !requireUp) {
    reason_codes.push("header_identity_already_safe");
    return emptyReport({
      ok: true,
      reason_codes,
      ownership_mode: "NONE",
      before,
      after: before,
      contact_delta_top: 0,
      text_positions_preserved: true,
    });
  }

  // ---- BAND_ONLY: preserve internal text tops; expand band ----
  // Positive-gap stacks, or Founder-requested preserve when non-overlapping
  // (including exact touching gap=0 — no rendered overlap under Phase 5W).
  const bandOnlyEligible =
    !requireUp &&
    (stackSafe || (preservePositions && stackNonOverlapping));
  if (bandOnlyEligible) {
    const lowestEb = Math.max(
      ...stack.map(
        (m) => (asNum(m.object.top) ?? 0) + textEffectiveHeight(m.object),
      ),
    );
    const requiredBottom = snap(lowestEb + pad);
    let bandTop = bandTop0;
    let bandBottom = snap(Math.max(bandBottom0, requiredBottom));
    let bandHeight = snap(bandBottom - bandTop);
    reason_codes.push(
      "ownership_mode=BAND_ONLY",
      `required_band_bottom=${requiredBottom}`,
    );

    if (pageH > 0 && bandBottom > pageH - clear) {
      return emptyReport({
        ok: false,
        error:
          "header identity layout would push the header band past safe page bounds",
        reason_codes: [...reason_codes, "page_bottom_exhausted"],
        ownership_mode: "BAND_ONLY",
        before,
        required_contact_up: requireUp,
        contact_delta_top: 0,
      });
    }

    members.background.top = snap(bandTop);
    members.background.height = snap(bandHeight);

    let summary_shift_px = 0;
    const shiftResult = shiftBodyForBandClearance({
      objects,
      background: members.background,
      bandTop0,
      bandBottom,
      clear,
      reason_codes,
    });
    summary_shift_px = shiftResult.summary_shift_px;

    if (pageH > 0) {
      const oob = bodyPastPageBottom(objects, pageH);
      if (oob) {
        return emptyReport({
          ok: false,
          error:
            "header identity layout would push body content past the page bottom",
          reason_codes: [...reason_codes, "body_page_oob"],
          ownership_mode: "BAND_ONLY",
          before,
          band_expanded: true,
          summary_shift_px,
          required_contact_up: requireUp,
          contact_delta_top: 0,
        });
      }
    }

    const after = {
      band_top: snap(bandTop),
      band_bottom: snap(bandBottom),
      name_top: nameTop0,
      name_effective_bottom: nameEb0,
      contact_top: contactTop0,
      contact_effective_bottom: contactEb0,
      identity_tops: identityTops0,
    };

    return {
      schema_version: "header-identity-layout-1.0.0",
      ok: true,
      applied: true,
      error: null,
      reason_codes,
      ownership_mode: "BAND_ONLY",
      before,
      after,
      band_expanded: after.band_bottom > before.band_bottom + 0.5,
      summary_shift_px,
      required_contact_up: requireUp,
      contact_delta_top: 0,
      text_positions_preserved: true,
    };
  }

  // ---- FULL_STACK: reflow all ordered identity texts ----
  reason_codes.push("ownership_mode=FULL_STACK");
  let bandTop = bandTop0;
  const tops: number[] = new Array(stack.length);
  tops[0] = Math.max(bandTop + pad, nameTop0);

  const placeForward = () => {
    for (let i = 1; i < stack.length; i++) {
      const prev = stack[i - 1]!;
      const prevEh = textEffectiveHeight(prev.object);
      tops[i] = snap(tops[i - 1]! + prevEh + pad);
    }
  };
  placeForward();

  if (requireUp) {
    const maxContactTop = contactTop0;
    const contactIdx = stack.length - 1;
    if (tops[contactIdx]! > maxContactTop + 0.5) {
      const shiftUp = tops[contactIdx]! - maxContactTop;
      for (let i = 0; i < stack.length; i++) {
        tops[i] = snap(tops[i]! - shiftUp);
      }
      bandTop = snap(Math.min(bandTop, tops[0]! - pad));
      reason_codes.push("stack_raised_to_honor_contact_up");
    } else if (tops[contactIdx]! < contactTop0 - 0.5) {
      reason_codes.push("contact_moved_up");
    } else {
      reason_codes.push("contact_top_preserved_for_up_gate");
    }
    // Clamp contact not below prior; keep sequential gaps.
    tops[contactIdx] = snap(Math.min(tops[contactIdx]!, maxContactTop));
    for (let i = contactIdx - 1; i >= 0; i--) {
      const nextTop = tops[i + 1]!;
      const curEh = textEffectiveHeight(stack[i]!.object);
      const maxTop = snap(nextTop - pad - curEh);
      if (tops[i]! > maxTop + 0.5) {
        tops[i] = maxTop;
      }
    }
    if (tops[0]! < bandTop + pad) {
      bandTop = snap(Math.min(bandTop, tops[0]! - pad));
    }
  } else {
    // Ensure name sits below band top with padding.
    if (tops[0]! < bandTop + pad) {
      tops[0] = snap(bandTop + pad);
      placeForward();
    }
  }

  if (bandTop < 0) {
    return emptyReport({
      ok: false,
      error:
        "header identity layout cannot honor containment, padding, and upward contact intent within page top bounds",
      reason_codes: [...reason_codes, "page_top_exhausted"],
      ownership_mode: "FULL_STACK",
      before,
      required_contact_up: requireUp,
    });
  }

  const contactTop = tops[tops.length - 1]!;
  const contactEb = contactTop + contactEh;
  let bandBottom = snap(Math.max(bandBottom0, contactEb + pad));
  let bandHeight = snap(bandBottom - bandTop);
  if (bandHeight + 1e-9 < stackedHeight) {
    bandBottom = snap(bandTop + stackedHeight);
    bandHeight = snap(bandBottom - bandTop);
  }

  if (pageH > 0 && bandBottom > pageH - clear) {
    return emptyReport({
      ok: false,
      error:
        "header identity layout would push the header band past safe page bounds",
      reason_codes: [...reason_codes, "page_bottom_exhausted"],
      ownership_mode: "FULL_STACK",
      before,
      band_expanded: bandBottom > bandBottom0 + 0.5 || bandTop < bandTop0 - 0.5,
      required_contact_up: requireUp,
      contact_delta_top: snap(contactTop - contactTop0),
      text_positions_preserved: false,
    });
  }

  members.background.top = snap(bandTop);
  members.background.height = snap(bandHeight);
  for (let i = 0; i < stack.length; i++) {
    stack[i]!.object.top = snap(tops[i]!);
  }

  let summary_shift_px = 0;
  const shiftResult = shiftBodyForBandClearance({
    objects,
    background: members.background,
    bandTop0,
    bandBottom,
    clear,
    reason_codes,
  });
  summary_shift_px = shiftResult.summary_shift_px;

  if (pageH > 0) {
    const oob = bodyPastPageBottom(objects, pageH);
    if (oob) {
      return emptyReport({
        ok: false,
        error:
          "header identity layout would push body content past the page bottom",
        reason_codes: [...reason_codes, "body_page_oob"],
        ownership_mode: "FULL_STACK",
        before,
        band_expanded: true,
        summary_shift_px,
        required_contact_up: requireUp,
        contact_delta_top: snap(contactTop - contactTop0),
        text_positions_preserved: false,
      });
    }
  }

  if (requireUp && contactTop - contactTop0 > 0.5) {
    return emptyReport({
      ok: false,
      error:
        "header identity layout cannot satisfy explicit upward contact intent without unsafe geometry",
      reason_codes: [...reason_codes, "contact_up_unsatisfied"],
      ownership_mode: "FULL_STACK",
      before,
      band_expanded: true,
      summary_shift_px,
      required_contact_up: requireUp,
      contact_delta_top: snap(contactTop - contactTop0),
      text_positions_preserved: false,
    });
  }

  const afterTops = memberTops(stack);
  const after = {
    band_top: snap(bandTop),
    band_bottom: snap(bandBottom),
    name_top: snap(tops[0]!),
    name_effective_bottom: snap(tops[0]! + nameEh),
    contact_top: snap(contactTop),
    contact_effective_bottom: snap(contactTop + contactEh),
    identity_tops: afterTops,
  };

  const band_expanded =
    after.band_bottom > before.band_bottom + 0.5 ||
    after.band_top < before.band_top - 0.5;

  return {
    schema_version: "header-identity-layout-1.0.0",
    ok: true,
    applied: true,
    error: null,
    reason_codes,
    ownership_mode: "FULL_STACK",
    before,
    after,
    band_expanded,
    summary_shift_px,
    required_contact_up: requireUp,
    contact_delta_top: snap(contactTop - contactTop0),
    text_positions_preserved: false,
  };
}

function shiftBodyForBandClearance(input: {
  objects: FabricObj[];
  background: FabricObj;
  bandTop0: number;
  bandBottom: number;
  clear: number;
  reason_codes: string[];
}): { summary_shift_px: number } {
  let summary_shift_px = 0;
  for (let i = 0; i < input.objects.length; i++) {
    const o = input.objects[i]!;
    if (isSystemBg(o)) continue;
    if (sectionOf(o) === "header") continue;
    const top = asNum(o.top);
    if (top == null) continue;
    const oLeft = asNum(o.left) ?? 0;
    const oWidth = Math.max(0, asNum(o.width) ?? 0);
    const bLeft = asNum(input.background.left) ?? 0;
    const bWidth = Math.max(0, asNum(input.background.width) ?? 0);
    const overlap =
      Math.min(oLeft + oWidth, bLeft + bWidth) - Math.max(oLeft, bLeft);
    if (overlap < 8) continue;
    if (top + 1e-9 < input.bandTop0 - 1) continue;
    const needTop = input.bandBottom + input.clear;
    if (top + 1e-9 >= needTop) continue;
    const delta = snap(needTop - top);
    if (delta <= 0.01) continue;
    o.top = snap(top + delta);
    summary_shift_px = Math.max(summary_shift_px, delta);
    input.reason_codes.push(`shifted_${objectId(o, i)}_by_${delta}`);
  }
  return { summary_shift_px };
}

function bodyPastPageBottom(objects: FabricObj[], pageH: number): boolean {
  for (const o of objects) {
    if (isSystemBg(o)) continue;
    const bb = effectiveObjectBBox(o);
    if (bb.bottom > pageH + 0.5) return true;
  }
  return false;
}
