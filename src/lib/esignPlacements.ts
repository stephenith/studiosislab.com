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
