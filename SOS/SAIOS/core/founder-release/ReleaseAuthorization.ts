/**
 * Mint/verify Founder release authorizations.
 * Only FounderReleaseController may mint. ReleaseManager only verifies.
 */
import { createHash, randomUUID } from "node:crypto";
import type { FounderReleaseAuthorization } from "./types.js";

const AUTH_SCOPE = "export_package_release" as const;
const CONFIRM = "RELEASE_TO_STUDIOSISLAB" as const;

/** Local non-secret binder — not a network credential; binds approval to package. */
function binderMaterial(input: {
  export_package_id: string;
  catalogue_id: string;
  reservation_id: string;
  nonce: string;
  approved_at: string;
}): string {
  return [
    "aios-founder-release-v1",
    input.export_package_id,
    input.catalogue_id,
    input.reservation_id,
    input.nonce,
    input.approved_at,
    CONFIRM,
  ].join("|");
}

function sign(material: string): string {
  return createHash("sha256").update(material).digest("hex");
}

export function mintFounderReleaseAuthorization(input: {
  export_package_id: string;
  catalogue_id: string;
  reservation_id: string;
  founder_name: string;
  confirm_phrase: string;
  explicit_approval: boolean;
}): FounderReleaseAuthorization {
  if (input.explicit_approval !== true) {
    throw new Error("explicit_approval must be true — never infer approval");
  }
  if (input.confirm_phrase !== CONFIRM) {
    throw new Error(
      `confirm_phrase must be ${CONFIRM} — Founder confirmation required`,
    );
  }
  const approved_at = new Date().toISOString();
  const nonce = randomUUID();
  const authorization_id = `auth-${approved_at.slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8)}`;
  const material = binderMaterial({
    export_package_id: input.export_package_id,
    catalogue_id: input.catalogue_id,
    reservation_id: input.reservation_id,
    nonce,
    approved_at,
  });
  return {
    authorization_id,
    export_package_id: input.export_package_id,
    catalogue_id: input.catalogue_id,
    reservation_id: input.reservation_id,
    founder_name: input.founder_name,
    approved_at,
    explicit_approval: true,
    confirm_phrase: CONFIRM,
    scope: AUTH_SCOPE,
    nonce,
    signature: sign(material),
  };
}

export function verifyFounderReleaseAuthorization(
  auth: FounderReleaseAuthorization | null | undefined,
  expected: {
    export_package_id: string;
    catalogue_id: string;
    reservation_id: string;
  },
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!auth) {
    return { ok: false, errors: ["Release authorization missing"] };
  }
  if (auth.explicit_approval !== true) {
    errors.push("explicit_approval must be true");
  }
  if (auth.confirm_phrase !== CONFIRM) {
    errors.push("confirm_phrase invalid");
  }
  if (auth.scope !== AUTH_SCOPE) {
    errors.push("authorization scope invalid");
  }
  if (auth.export_package_id !== expected.export_package_id) {
    errors.push("authorization export_package_id mismatch");
  }
  if (auth.catalogue_id !== expected.catalogue_id) {
    errors.push("authorization catalogue_id mismatch");
  }
  if (auth.reservation_id !== expected.reservation_id) {
    errors.push("authorization reservation_id mismatch");
  }
  const material = binderMaterial({
    export_package_id: auth.export_package_id,
    catalogue_id: auth.catalogue_id,
    reservation_id: auth.reservation_id,
    nonce: auth.nonce,
    approved_at: auth.approved_at,
  });
  if (auth.signature !== sign(material)) {
    errors.push("authorization signature invalid");
  }
  return { ok: errors.length === 0, errors };
}
