export const ESIGN_TARGET_ERRORS = {
  missing_countersign_target:
    "This agreement has no countersign position. Completion is unavailable.",
  recipient_outside_target:
    "The recipient signature must stay inside the countersign box.",
} as const;

export type EsignTargetFailureReason = keyof typeof ESIGN_TARGET_ERRORS;

export type NormRect = {
  page: number;
  xNorm: number;
  yNorm: number;
  wNorm: number;
  hNorm: number;
};

const CONTAIN_EPS = 0.004;

export function readLockedCountersignTarget(value: unknown): NormRect | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (data.locked !== true) return null;
  const page = typeof data.page === "number" ? data.page : Number.NaN;
  const xNorm = Number(data.xNorm);
  const yNorm = Number(data.yNorm);
  const wNorm = Number(data.wNorm);
  const hNorm = Number(data.hNorm);
  if (!Number.isInteger(page) || page < 1) return null;
  if (![xNorm, yNorm, wNorm, hNorm].every((item) => Number.isFinite(item))) return null;
  if (!(wNorm > 0) || !(hNorm > 0)) return null;
  if (xNorm < -0.001 || yNorm < -0.001) return null;
  if (xNorm + wNorm > 1.01 || yNorm + hNorm > 1.01) return null;
  return { page, xNorm, yNorm, wNorm, hNorm };
}

export function recipientPlacementInsideTarget(
  target: NormRect,
  placement: unknown
): boolean {
  if (typeof placement !== "object" || placement === null || Array.isArray(placement)) {
    return false;
  }
  const data = placement as Record<string, unknown>;
  const page = Number(data.page);
  const xNorm = Number(data.xNorm);
  const yNorm = Number(data.yNorm);
  const wNorm = Number(data.wNorm);
  const hNorm = Number(data.hNorm);
  if (page !== target.page) return false;
  if (![xNorm, yNorm, wNorm, hNorm].every((item) => Number.isFinite(item))) return false;
  if (!(wNorm > 0) || !(hNorm > 0)) return false;
  if (xNorm < target.xNorm - CONTAIN_EPS) return false;
  if (yNorm < target.yNorm - CONTAIN_EPS) return false;
  if (xNorm + wNorm > target.xNorm + target.wNorm + CONTAIN_EPS) return false;
  if (yNorm + hNorm > target.yNorm + target.hNorm + CONTAIN_EPS) return false;
  return true;
}

export const ESIGN_PLACEMENT_ERRORS = {
  missing_recipient_signature:
    "Recipient signature is missing. Refresh the page and try again.",
  ambiguous_submission:
    "This signing session is out of date. Refresh the page and try again.",
  missing_recipient_id:
    "Recipient signature is missing an id. Refresh the page and try again.",
  missing_recipient_image:
    "Recipient signature image is missing. Refresh the page and try again.",
  recipient_id_conflicts_with_sender:
    "Recipient signature conflicts with a sender signature. Refresh the page and try again.",
} as const;

export type EsignPlacementFailureReason = keyof typeof ESIGN_PLACEMENT_ERRORS;

export type EsignPlacementMergeResult =
  | { ok: true; placements: unknown[] }
  | { ok: false; reason: EsignPlacementFailureReason; error: string };

function fail(reason: EsignPlacementFailureReason): EsignPlacementMergeResult {
  return { ok: false, reason, error: ESIGN_PLACEMENT_ERRORS[reason] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Keep every stored sender placement that has an image, once, then append the
 * single recipient placement. Identity is the placement id. Coordinates and
 * image bytes are not compared.
 */
export function mergeRecipientPlacement(
  stored: unknown,
  incoming: unknown
): EsignPlacementMergeResult {
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return fail("missing_recipient_signature");
  }
  if (incoming.length !== 1) {
    return fail("ambiguous_submission");
  }

  const recipient = incoming[0];
  if (!isRecord(recipient) || !nonEmptyString(recipient.id)) {
    return fail("missing_recipient_id");
  }
  if (!nonEmptyString(recipient.imageDataUrl)) {
    return fail("missing_recipient_image");
  }

  const storedList = Array.isArray(stored) ? stored : [];
  const storedIds = new Set<string>();
  for (const item of storedList) {
    if (isRecord(item) && nonEmptyString(item.id)) {
      storedIds.add(item.id.trim());
    }
  }
  if (storedIds.has(recipient.id.trim())) {
    return fail("recipient_id_conflicts_with_sender");
  }

  const senderPlacements = storedList.filter(
    (item) => isRecord(item) && nonEmptyString(item.imageDataUrl)
  );
  return { ok: true, placements: [...senderPlacements, recipient] };
}
