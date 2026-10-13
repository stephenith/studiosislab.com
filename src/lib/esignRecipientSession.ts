export type RecipientSessionDecision =
  | { ok: true }
  | { ok: false; status: number; error: string };

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

/**
 * A recipient may open a mobile signing session only for an authenticated
 * invitation that is still sent or viewed. Completion, expiry, and a
 * different bound recipient are refused. This does not grant document ownership.
 */
export function recipientSessionInviteDecision(
  invite: unknown,
  actorUid: string,
  now = Date.now()
): RecipientSessionDecision {
  if (typeof invite !== "object" || invite === null || Array.isArray(invite)) {
    return { ok: false, status: 404, error: "Invite not found" };
  }
  const data = invite as Record<string, unknown>;
  const status = typeof data.status === "string" ? data.status : "";
  if (status === "completed") {
    return {
      ok: false,
      status: 409,
      error: "This invitation is already completed.",
    };
  }
  const expiresAt = toDate(data.expiresAt);
  if (expiresAt && expiresAt.getTime() <= now) {
    return { ok: false, status: 410, error: "Invite has expired" };
  }
  const recipientUid = typeof data.recipientUid === "string" ? data.recipientUid : "";
  if (recipientUid && actorUid && recipientUid !== actorUid) {
    return {
      ok: false,
      status: 403,
      error: "You are not allowed to sign this invitation",
    };
  }
  if (status !== "sent" && status !== "viewed") {
    return {
      ok: false,
      status: 403,
      error: "This invitation cannot be used to sign",
    };
  }
  return { ok: true };
}
