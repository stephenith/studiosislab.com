/**
 * Deterministic HEADER_IDENTITY_BLOCK layout.
 *
 * Owns header-band ↔ name ↔ role/contact geometry using wrap-aware effective
 * heights. Does not hard-code production template IDs. Prefer expanding the
 * header background and shifting the identity stack over forcing text overlap.
 */
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import {
  effectiveObjectBBox,
  effectiveTextHeightScaled,
  isFabricTextObject,
} from "./TextEffectiveHeight.js";

/** Matches RevisionLayoutNormalizer MIN_HEADING_BODY_GAP_PX (avoid circular import). */
export const HEADER_IDENTITY_PAD_PX = 8;
/** Matches RevisionLayoutNormalizer MIN_SECTION_GAP_PX. */
export const HEADER_TO_SUMMARY_CLEARANCE_PX = 12;

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

export type HeaderIdentityMembers = {
  background: FabricObj;
  background_index: number;
  name: FabricObj;
  name_index: number;
  contact: FabricObj;
  contact_index: number;
};

export type HeaderIdentityLayoutReport = {
  schema_version: "header-identity-layout-1.0.0";
  ok: boolean;
  applied: boolean;
  error: string | null;
  reason_codes: string[];
  before: {
    band_top: number;
    band_bottom: number;
    name_top: number;
    name_effective_bottom: number;
    contact_top: number;
    contact_effective_bottom: number;
  } | null;
  after: {
    band_top: number;
    band_bottom: number;
    name_top: number;
    name_effective_bottom: number;
    contact_top: number;
    contact_effective_bottom: number;
  } | null;
  band_expanded: boolean;
  summary_shift_px: number;
  required_contact_up: boolean;
  contact_delta_top: number | null;
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

function isNameLike(o: FabricObj): boolean {
  const role = roleOf(o);
  if (/\bname\b/.test(role) || role === "header-name") return true;
  if (!isFabricTextObject(o)) return false;
  if (isContactLike(o)) return false;
  return true;
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
    return (
      /\b(upward|upwards|higher)\b/.test(n) ||
      /\braise\b/.test(n) ||
      (/\bmov(?:e|ing)|shift|nudge|reposition\b/.test(n) &&
        /\b(up|upward|upwards)\b/.test(n))
    );
  });
}

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
  return {
    background,
    background_index,
    name,
    name_index,
    contact,
    contact_index,
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

/**
 * Apply deterministic header identity geometry onto a canvas clone.
 * Mutates the provided canvas objects in place.
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
    return {
      schema_version: "header-identity-layout-1.0.0",
      ok: true,
      applied: false,
      error: null,
      reason_codes: ["header_identity_members_not_detected"],
      before: null,
      after: null,
      band_expanded: false,
      summary_shift_px: 0,
      required_contact_up: false,
      contact_delta_top: null,
    };
  }

  const requireUp =
    input.require_contact_upward === true ||
    feedbackRequiresContactUpward(input.requested_changes ?? []);

  const pad = HEADER_IDENTITY_PAD_PX;
  const clear = HEADER_TO_SUMMARY_CLEARANCE_PX;

  const bandTop0 = asNum(members.background.top) ?? 0;
  const bandH0 = Math.max(1, asNum(members.background.height) ?? 1);
  const bandBottom0 = bandTop0 + bandH0;
  const nameTop0 = asNum(members.name.top) ?? 0;
  const nameEh = textEffectiveHeight(members.name);
  const nameEb0 = nameTop0 + nameEh;
  const contactTop0 = asNum(members.contact.top) ?? 0;
  const contactEh = textEffectiveHeight(members.contact);
  const contactEb0 = contactTop0 + contactEh;

  const before = {
    band_top: bandTop0,
    band_bottom: bandBottom0,
    name_top: nameTop0,
    name_effective_bottom: nameEb0,
    contact_top: contactTop0,
    contact_effective_bottom: contactEb0,
  };

  const requiredHeight = pad + nameEh + pad + contactEh + pad;
  reason_codes.push(`required_height=${requiredHeight}`);

  const alreadySafe =
    nameTop0 + 1e-9 >= bandTop0 + pad - 0.5 &&
    contactTop0 + 1e-9 >= nameEb0 + pad - 0.5 &&
    contactEb0 <= bandBottom0 - pad + 0.5 &&
    bandH0 + 1e-9 >= requiredHeight - 0.5;

  if (alreadySafe && !requireUp) {
    reason_codes.push("header_identity_already_safe");
    return {
      schema_version: "header-identity-layout-1.0.0",
      ok: true,
      applied: false,
      error: null,
      reason_codes,
      before,
      after: before,
      band_expanded: false,
      summary_shift_px: 0,
      required_contact_up: false,
      contact_delta_top: 0,
    };
  }

  // Place stack: prefer keeping name near current top pad when feasible.
  let bandTop = bandTop0;
  let nameTop = Math.max(bandTop + pad, nameTop0);
  let contactTop = nameTop + nameEh + pad;

  if (requireUp) {
    // Never move contact downward relative to prior top.
    const maxContactTop = contactTop0;
    if (contactTop > maxContactTop + 0.5) {
      const shiftUp = contactTop - maxContactTop;
      nameTop = snap(nameTop - shiftUp);
      contactTop = snap(maxContactTop);
      bandTop = snap(Math.min(bandTop, nameTop - pad));
      reason_codes.push("stack_raised_to_honor_contact_up");
    } else if (contactTop < contactTop0 - 0.5) {
      reason_codes.push("contact_moved_up");
    } else {
      reason_codes.push("contact_top_preserved_for_up_gate");
    }
  }

  // Ensure name sits below band top with padding.
  if (nameTop < bandTop + pad) {
    nameTop = snap(bandTop + pad);
    contactTop = snap(nameTop + nameEh + pad);
    if (requireUp && contactTop > contactTop0 + 0.5) {
      // Pull band+name further up so contact can stay <= prior.
      const overflow = contactTop - contactTop0;
      bandTop = snap(bandTop - overflow);
      nameTop = snap(nameTop - overflow);
      contactTop = snap(contactTop0);
      reason_codes.push("band_raised_for_up_and_padding");
    }
  }

  // Recompute contact if name moved without up constraint violation path.
  if (!requireUp) {
    contactTop = snap(nameTop + nameEh + pad);
  } else {
    // Keep gap after final nameTop.
    const minContact = snap(nameTop + nameEh + pad);
    if (minContact <= contactTop0 + 0.5) {
      contactTop = Math.min(contactTop0, Math.max(minContact, contactTop));
      // Prefer a slight raise when still overflowing prior band.
      if (contactEb0 > bandBottom0 - pad + 0.5 && contactTop > minContact) {
        contactTop = snap(Math.max(minContact, Math.min(contactTop, contactTop0 - 1)));
      }
      contactTop = snap(Math.max(minContact, Math.min(contactTop, contactTop0)));
    } else {
      // Need more room above contact — raise name/band.
      const need = minContact - contactTop0;
      bandTop = snap(bandTop - need);
      nameTop = snap(nameTop - need);
      contactTop = snap(contactTop0);
      reason_codes.push("raised_name_band_to_keep_contact_up");
    }
  }

  if (bandTop < 0) {
    return {
      schema_version: "header-identity-layout-1.0.0",
      ok: false,
      applied: false,
      error:
        "header identity layout cannot honor containment, padding, and upward contact intent within page top bounds",
      reason_codes: [...reason_codes, "page_top_exhausted"],
      before,
      after: null,
      band_expanded: false,
      summary_shift_px: 0,
      required_contact_up: requireUp,
      contact_delta_top: null,
    };
  }

  const contactEb = contactTop + contactEh;
  let bandBottom = snap(Math.max(bandBottom0, contactEb + pad));
  let bandHeight = snap(bandBottom - bandTop);
  if (bandHeight + 1e-9 < requiredHeight) {
    bandBottom = snap(bandTop + requiredHeight);
    bandHeight = snap(bandBottom - bandTop);
  }

  if (pageH > 0 && bandBottom > pageH - clear) {
    return {
      schema_version: "header-identity-layout-1.0.0",
      ok: false,
      applied: false,
      error:
        "header identity layout would push the header band past safe page bounds",
      reason_codes: [...reason_codes, "page_bottom_exhausted"],
      before,
      after: null,
      band_expanded: bandBottom > bandBottom0 + 0.5 || bandTop < bandTop0 - 0.5,
      summary_shift_px: 0,
      required_contact_up: requireUp,
      contact_delta_top: snap(contactTop - contactTop0),
    };
  }

  // Apply band + identity positions.
  members.background.top = snap(bandTop);
  members.background.height = snap(bandHeight);
  members.name.top = snap(nameTop);
  members.contact.top = snap(contactTop);

  // Shift non-header objects that start above the new clearance floor.
  let summary_shift_px = 0;
  for (let i = 0; i < objects.length; i++) {
    const o = objects[i]!;
    if (isSystemBg(o)) continue;
    if (sectionOf(o) === "header") continue;
    const top = asNum(o.top);
    if (top == null) continue;
    // Only shift objects that horizontally overlap the header band and sit
    // below the prior header region (body / summary), not unrelated overlays.
    const oLeft = asNum(o.left) ?? 0;
    const oWidth = Math.max(0, asNum(o.width) ?? 0);
    const bLeft = asNum(members.background.left) ?? 0;
    const bWidth = Math.max(0, asNum(members.background.width) ?? 0);
    const overlap =
      Math.min(oLeft + oWidth, bLeft + bWidth) - Math.max(oLeft, bLeft);
    if (overlap < 8) continue;
    if (top + 1e-9 < bandTop0 - 1) continue;
    const needTop = bandBottom + clear;
    if (top + 1e-9 >= needTop) continue;
    const delta = snap(needTop - top);
    if (delta <= 0.01) continue;
    o.top = snap(top + delta);
    summary_shift_px = Math.max(summary_shift_px, delta);
    reason_codes.push(`shifted_${objectId(o, i)}_by_${delta}`);
  }

  // Fail closed if any shifted object falls past page bottom.
  if (pageH > 0) {
    for (let i = 0; i < objects.length; i++) {
      const o = objects[i]!;
      if (isSystemBg(o)) continue;
      const bb = effectiveObjectBBox(o);
      if (bb.bottom > pageH + 0.5) {
        return {
          schema_version: "header-identity-layout-1.0.0",
          ok: false,
          applied: false,
          error:
            "header identity layout would push body content past the page bottom",
          reason_codes: [...reason_codes, "body_page_oob"],
          before,
          after: null,
          band_expanded: true,
          summary_shift_px,
          required_contact_up: requireUp,
          contact_delta_top: snap(contactTop - contactTop0),
        };
      }
    }
  }

  if (requireUp && contactTop - contactTop0 > 0.5) {
    return {
      schema_version: "header-identity-layout-1.0.0",
      ok: false,
      applied: false,
      error:
        "header identity layout cannot satisfy explicit upward contact intent without unsafe geometry",
      reason_codes: [...reason_codes, "contact_up_unsatisfied"],
      before,
      after: null,
      band_expanded: true,
      summary_shift_px,
      required_contact_up: requireUp,
      contact_delta_top: snap(contactTop - contactTop0),
    };
  }

  const after = {
    band_top: snap(bandTop),
    band_bottom: snap(bandBottom),
    name_top: snap(nameTop),
    name_effective_bottom: snap(nameTop + nameEh),
    contact_top: snap(contactTop),
    contact_effective_bottom: snap(contactTop + contactEh),
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
    before,
    after,
    band_expanded,
    summary_shift_px,
    required_contact_up: requireUp,
    contact_delta_top: snap(contactTop - contactTop0),
  };
}
